/* eslint-disable @typescript-eslint/no-explicit-any */
// Victron-koppeling voor de WetterWinkel-app via de officiële VRM API.
// De klant maakt zelf een persoonlijk toegangstoken aan in VRM (Voorkeuren →
// Integraties → Toegangstokens) en plakt dat in de app. We bewaren het token
// versleuteld (AES-256-GCM) in een app-metaveld op de klant; nooit het
// VRM-wachtwoord. Ontkoppelen wist het metaveld.
import crypto from "node:crypto";

const VRM = "https://vrmapi.victronenergy.com/v2";
const NS = "$app";
const KEY = "victron";

function secretKey() {
  const secret = process.env.APP_DATA_SECRET || process.env.SHOPIFY_API_SECRET || "";
  if (!secret) throw new Error("Geen sleutel voor versleuteling ingesteld.");
  return crypto.createHash("sha256").update(`wetterwinkel-victron:${secret}`).digest();
}

export function encrypt(text: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decrypt(blob: string) {
  const [iv, tag, enc] = blob.split(".");
  const d = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
}

export type VictronLink = { token: string; idUser: number; siteId: number | null; name: string };

function authHeader(token: string) {
  // Persoonlijke toegangstokens: "Token …"; tijdelijke login-tokens (JWT) : "Bearer …".
  return token.split(".").length === 3 ? `Bearer ${token}` : `Token ${token}`;
}

async function vrm(token: string, path: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${VRM}${path}`, {
      headers: { "X-Authorization": authHeader(token), Accept: "application/json", "User-Agent": "WetterWinkel-app" },
      signal: ctrl.signal,
    });
    const data: any = await res.json().catch(() => ({}));
    if (res.status === 401) {
      const e: any = new Error("Victron weigert het token. Maak in VRM een nieuw toegangstoken aan.");
      e.status = 401;
      throw e;
    }
    if (res.status === 403) {
      const e: any = new Error("Je VRM-account heeft geen rechten voor deze gegevens.");
      e.status = 403;
      throw e;
    }
    if (!res.ok || data?.success === false) throw new Error(data?.errors ? String(data.errors) : `VRM gaf fout ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function vrmMe(token: string) {
  const d = await vrm(token, "/users/me");
  const u = d.user || d.records || {};
  return { idUser: Number(u.id ?? u.idUser), name: String(u.name || "") };
}

export async function vrmInstallations(token: string, idUser: number) {
  const d = await vrm(token, `/users/${idUser}/installations?extended=1`);
  return (d.records || []).map((r: any) => ({
    idSite: Number(r.idSite),
    name: String(r.name || r.identifier || `Installatie ${r.idSite}`),
    lastSeen: r.last_timestamp ? Number(r.last_timestamp) * 1000 : null,
  }));
}

type Diag = {
  Device?: string;
  instance?: number;
  description?: string;
  formattedValue?: string;
  rawValue?: any;
  dbusServiceType?: string;
  dbusPath?: string;
  code?: string;
  timestamp?: number;
  formatWithUnit?: string;
};

const num = (v: any) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function pick(recs: Diag[], service: RegExp, paths: string[], descs: RegExp[]) {
  for (const p of paths) {
    const r = recs.find((x) => service.test(String(x.dbusServiceType || "")) && x.dbusPath === p && num(x.rawValue) != null);
    if (r) return r;
  }
  for (const d of descs) {
    const r = recs.find((x) => d.test(String(x.description || "")) && num(x.rawValue) != null);
    if (r) return r;
  }
  return null;
}

const FLUID: Record<number, string> = { 0: "Brandstof", 1: "Zoet water", 2: "Grijs water", 3: "Levend water", 4: "Olie", 5: "Zwart water", 6: "Benzine", 7: "Diesel", 8: "LPG", 9: "LNG", 10: "Hydraulische olie", 11: "Drinkwater" };

// Zonder diagnoserechten (bijv. gedeelde installaties): waarden via de widgets ophalen.
const WIDGET_FOR: Array<[RegExp, string]> = [
  [/battery monitor|bms|battery/i, "BatterySummary"],
  [/solar charger|mppt/i, "SolarChargerSummary"],
  [/ve\.bus|multi|quattro|inverter/i, "Status"],
  [/tank/i, "TankSummary"],
];
async function widgetRecords(token: string, idSite: number): Promise<Diag[]> {
  const ov = await vrm(token, `/installations/${idSite}/system-overview`).catch(() => null);
  const devices: any[] = ov?.records?.devices || [];
  const calls: Array<Promise<Diag[]>> = [];
  const seen = new Set<string>();
  for (const dev of devices) {
    const w = WIDGET_FOR.find(([re]) => re.test(String(dev.name || "")))?.[1];
    if (!w || dev.instance == null) continue;
    const key = `${w}:${dev.instance}`;
    if (seen.has(key)) continue;
    seen.add(key);
    calls.push(
      vrm(token, `/installations/${idSite}/widgets/${w}?instance=${dev.instance}`)
        .then((d) =>
          Object.values(d?.records?.data || {})
            .filter((x: any) => x && typeof x === "object" && "rawValue" in x)
            .map((x: any) => ({ ...x, Device: dev.customName || dev.name, description: x.dataAttributeName, timestamp: Math.round(Date.now() / 1000 - (Number(x.secondsAgo) || 0)) })),
        )
        .catch(() => [] as Diag[]),
    );
  }
  if (!calls.length) calls.push(vrm(token, `/installations/${idSite}/widgets/BatterySummary`).then((d) => Object.values(d?.records?.data || {}).filter((x: any) => x && "rawValue" in x).map((x: any) => ({ ...x, Device: "Accu", description: x.dataAttributeName }))));
  return (await Promise.all(calls)).flat();
}

export async function vrmSnapshot(token: string, idSite: number) {
  let recs: Diag[];
  try {
    const d = await vrm(token, `/installations/${idSite}/diagnostics?count=1000`);
    recs = d.records || [];
  } catch (error: any) {
    if (error?.status !== 403) throw error;
    recs = await widgetRecords(token, idSite);
  }
  const val = (r: Diag | null) => (r ? num(r.rawValue) : null);
  const soc = pick(recs, /battery/, ["/Soc"], [/^state of charge$/i, /^battery soc/i]);
  const volt = pick(recs, /battery/, ["/Dc/0/Voltage"], [/^voltage$/i, /battery voltage/i]);
  const amp = pick(recs, /battery/, ["/Dc/0/Current"], [/^current$/i, /battery current/i]);
  const pow = pick(recs, /battery|system/, ["/Dc/0/Power", "/Dc/Battery/Power"], [/battery power/i]);
  const ttg = pick(recs, /battery/, ["/TimeToGo"], [/time to go/i]);
  const temp = pick(recs, /battery/, ["/Dc/0/Temperature"], [/battery temperature/i]);
  // Zonne-energie: alle laadregelaars bij elkaar.
  const pvRecs = recs.filter((x) => /solarcharger/.test(String(x.dbusServiceType || "")) && x.dbusPath === "/Yield/Power");
  let pv: number | null = pvRecs.length ? pvRecs.reduce((s, r) => s + (num(r.rawValue) || 0), 0) : null;
  if (pv == null) pv = val(pick(recs, /system/, ["/Dc/Pv/Power"], [/^pv - dc-coupled$/i, /pv power/i]));
  const yieldToday = recs
    .filter((x) => /solarcharger/.test(String(x.dbusServiceType || "")) && /^\/History\/Daily\/0\/Yield$/.test(String(x.dbusPath || "")))
    .reduce((s, r) => s + (num(r.rawValue) || 0), 0);
  const shore = pick(recs, /vebus|acsystem|system/, ["/Ac/ActiveIn/L1/P", "/Ac/Grid/L1/Power", "/Ac/ActiveIn/P"], [/input power 1/i, /grid l1/i]);
  const shoreConnected = pick(recs, /vebus/, ["/Ac/ActiveIn/Connected"], [/ac input connected/i]);
  const consumption = pick(recs, /system/, ["/Ac/Consumption/L1/Power", "/Dc/System/Power"], [/ac consumption l1/i, /dc system/i]);
  const tanks = recs
    .filter((x) => /tank/.test(String(x.dbusServiceType || "")) && x.dbusPath === "/Level")
    .map((lvl) => {
      const ft = recs.find((x) => /tank/.test(String(x.dbusServiceType || "")) && x.instance === lvl.instance && x.dbusPath === "/FluidType");
      return { name: FLUID[num(ft?.rawValue) ?? -1] || lvl.Device || "Tank", level: num(lvl.rawValue) };
    })
    .filter((t) => t.level != null);
  const alarms = recs
    .filter((x) => /\/Alarms\//.test(String(x.dbusPath || "")) && (num(x.rawValue) || 0) > 0)
    .map((x) => `${x.Device || ""}: ${x.description || x.dbusPath}${num(x.rawValue) === 2 ? " (alarm)" : " (waarschuwing)"}`)
    .slice(0, 8);
  const lastTs = recs.reduce((m, r) => Math.max(m, Number(r.timestamp) || 0), 0);
  // Alle waarden, gegroepeerd per apparaat, voor de "alle waarden"-lijst.
  const groups: Record<string, Array<{ label: string; value: string }>> = {};
  for (const r of recs) {
    if (!r.formattedValue || /\/Alarms\//.test(String(r.dbusPath || ""))) continue;
    const g = `${r.Device || "Overig"}${r.instance != null && r.instance !== 0 ? " " + r.instance : ""}`;
    (groups[g] ||= []).push({ label: String(r.description || r.code || ""), value: String(r.formattedValue) });
  }
  return {
    updatedAt: lastTs ? new Date(lastTs * 1000).toISOString() : null,
    battery: {
      soc: val(soc),
      voltage: val(volt),
      current: val(amp),
      power: val(pow) ?? (val(volt) != null && val(amp) != null ? Math.round(val(volt)! * val(amp)!) : null),
      timeToGo: val(ttg),
      temperature: val(temp),
    },
    solar: { power: pv, yieldTodayKwh: yieldToday || null },
    shore: { power: val(shore), connected: shoreConnected ? val(shoreConnected) === 1 : null },
    consumption: val(consumption),
    tanks,
    alarms,
    groups: Object.entries(groups).slice(0, 20).map(([device, values]) => ({ device, values: values.slice(0, 40) })),
  };
}

// ---- Opslag op de klant (versleuteld app-metaveld) ----
export async function readLink(admin: any, customerId: string): Promise<VictronLink | null> {
  const res = await admin.graphql(
    `#graphql
    query($id: ID!) { customer(id: $id) { metafield(namespace: "${NS}", key: "${KEY}") { value } } }`,
    { variables: { id: customerId } },
  );
  const json: any = await res.json();
  const raw = json.data?.customer?.metafield?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decrypt(raw));
  } catch {
    return null;
  }
}

export async function saveLink(admin: any, customerId: string, link: VictronLink | null) {
  if (!link) {
    const res = await admin.graphql(
      `#graphql
      mutation($m: [MetafieldIdentifierInput!]!) { metafieldsDelete(metafields: $m) { userErrors { message } } }`,
      { variables: { m: [{ ownerId: customerId, namespace: NS, key: KEY }] } },
    );
    const j: any = await res.json();
    const err = j.data?.metafieldsDelete?.userErrors?.[0]?.message;
    if (err) throw new Error(err);
    return;
  }
  const res = await admin.graphql(
    `#graphql
    mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { message } } }`,
    { variables: { m: [{ ownerId: customerId, namespace: NS, key: KEY, type: "multi_line_text_field", value: encrypt(JSON.stringify(link)) }] } },
  );
  const j: any = await res.json();
  const err = j.data?.metafieldsSet?.userErrors?.[0]?.message;
  if (err) throw new Error(err);
}
