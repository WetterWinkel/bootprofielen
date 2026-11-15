/* eslint-disable @typescript-eslint/no-explicit-any */
// Stremmingen en hinder voor de WetterWinkel-app.
// Bron: Rijkswaterstaat, berichten aan de scheepvaart (NtS 4.0, FTM) via de
// officiële webservice van vaarweginformatie.nl. We halen de berichten zelf op
// bij de bron (niet via andere apps), bewaren alleen wat de app nodig heeft en
// verversen elk uur.

const NTS_URL = "https://www.vaarweginformatie.nl/fdd/nts40";
const PAGE = 100;
const COLD_DAYS = 420; // zo ver terug kijken bij de eerste keer laden
const MAX_COLD_PAGES = 160;
const REFRESH_MS = 60 * 60 * 1000;
const UPCOMING_DAYS = 14;

export type Category = "stremming" | "hinder" | "info";

type Period = { start: number; end: number | null; daily: { from: string; to: string } | null; label: string };

export type NoticeItem = {
  id: string; // bericht + object
  msg: string; // bv. RWS 2026/7091
  cat: Category;
  limits: string[]; // Nederlandse omschrijving van de beperkingen
  limitCodes: string[];
  reason: string;
  name: string;
  fairway: string;
  type: string; // brug, sluis, vaarweg, ...
  typeCode: string;
  lat: number;
  lon: number;
  line: Array<[number, number]> | null; // [lat, lon] begin/eind bij een vaarwegvak
  periods: Period[];
  contents: string;
  district: string;
  issued: string;
  phones: string[];
  vhf: string[];
  source: string;
};

type Stored = { serial: number; issued: number; cancelled: boolean; items: NoticeItem[] };

const LIMIT_NL: Record<string, string> = {
  OBSTRU: "Gestremd",
  PAROBS: "Gedeeltelijk gestremd",
  NOSERV: "Geen bediening",
  SERVIC: "Gewijzigde bediening",
  DELAY: "Vertraging",
  CAUTIO: "Extra voorzichtigheid",
  CLEWID: "Beperkte doorvaartbreedte",
  CLEHEI: "Beperkte doorvaarthoogte",
  CLEDEP: "Beperkte diepte",
  AVADEP: "Beperkte diepte",
  CLELEN: "Beperkte lengte",
  VESHEI: "Max. hoogte schip",
  VESLEN: "Max. lengte schip",
  VESBRE: "Max. breedte schip",
  VESDRA: "Max. diepgang schip",
  WAVWAS: "Geen golfslag veroorzaken",
  NOSHIF: "Niet keren",
  SPEED: "Snelheidsbeperking",
  MINPWR: "Minimaal vermogen",
  ALTER: "Alternatieve route",
  NOLIM: "Geen beperking",
  TURNIN: "Niet keren",
  PASSIN: "Niet voorbijlopen",
  OVRTAK: "Niet oplopen",
  NOMOOR: "Niet afmeren",
  NOANCH: "Niet ankeren",
};
const REASON_NL: Record<string, string> = {
  REPAIR: "werkzaamheden",
  CONSTR: "bouwwerkzaamheden",
  INSPEC: "inspectie",
  EVENT: "evenement",
  FIREWO: "vuurwerk",
  ACCIDE: "ongeval",
  DREDGE: "baggerwerk",
  EXERC: "oefening",
  HIGWAT: "hoogwater",
  LOWWAT: "laagwater",
  ICE: "ijs",
  STRIKE: "staking",
  CALAMI: "calamiteit",
  REMAIN: "onderhoud",
  SOUND: "peilingen",
  DIVING: "duikwerk",
  SPECTR: "bijzonder transport",
  SHOOTI: "schietoefening",
  OTHER: "",
};
const TYPE_NL: Record<string, string> = {
  BRI: "Brug",
  BRO: "Brug",
  LCK: "Sluis",
  LKB: "Sluiskolk",
  FWY: "Vaarweg",
  HAR: "Haven",
  FER: "Veerpont",
  MAR: "Jachthaven",
  BER: "Ligplaats",
  WEI: "Stuw",
  TER: "Terminal",
  CNL: "Kanaal",
};

const STREM = new Set(["OBSTRU", "NOSERV"]);

function tag(s: string, name: string) {
  const m = s.match(new RegExp(`<(?:\\w+:)?${name}>([\\s\\S]*?)</(?:\\w+:)?${name}>`));
  return m ? decode(m[1].trim()) : "";
}
function tags(s: string, name: string) {
  const out: string[] = [];
  const re = new RegExp(`<(?:\\w+:)?${name}>([\\s\\S]*?)</(?:\\w+:)?${name}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1]);
  return out;
}
function decode(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => (Number(n) === 13 ? "" : String.fromCharCode(Number(n))))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

// "52 37.1248 N" -> 52.6187
function coord(v: string) {
  const m = v.match(/(-?\d+)\s+([\d.]+)\s*([NSEW])/);
  if (!m) return NaN;
  const n = Number(m[1]) + Number(m[2]) / 60;
  return m[3] === "S" || m[3] === "W" ? -n : n;
}

// "2026-11-15+01:00" + "06:54:00" -> ms
function when(date: string, time: string | null, endOfDay: boolean) {
  const d = date.slice(0, 10);
  const tz = /[+-]\d\d:\d\d$/.test(date) ? date.slice(-6) : "+01:00";
  const t = time ? time.slice(0, 8) : endOfDay ? "23:59:59" : "00:00:00";
  const ms = Date.parse(`${d}T${t}${tz}`);
  return Number.isFinite(ms) ? ms : null;
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam", day: "numeric", month: "short" });
}

function parsePeriods(block: string): Period[] {
  return tags(block, "limitation_period").map((p) => {
    const ds = tag(p, "date_start"), de = tag(p, "date_end");
    const ts = tag(p, "time_start") || null, te = tag(p, "time_end") || null;
    const interval = tag(p, "interval_code");
    const daily = interval && interval !== "CONTIN" && ts && te ? { from: ts.slice(0, 5), to: te.slice(0, 5) } : null;
    const start = when(ds, daily ? null : ts, false) ?? 0;
    const end = de ? when(de, daily ? null : te, !te || !!daily) : null;
    let label = `vanaf ${fmtDate(start)}${!daily && ts ? " " + ts.slice(0, 5) : ""}`;
    if (end) {
      const sameDay = fmtDate(start) === fmtDate(end);
      label = sameDay
        ? `${fmtDate(start)}${!daily && ts ? " " + ts.slice(0, 5) + (te ? "–" + te.slice(0, 5) : "") : ""}`
        : `${fmtDate(start)}${!daily && ts ? " " + ts.slice(0, 5) : ""} – ${fmtDate(end)}${!daily && te ? " " + te.slice(0, 5) : ""}`;
    }
    if (daily) label += ` (dagelijks ${daily.from}–${daily.to})`;
    return { start, end, daily, label };
  });
}

function parseMessage(xml: string): { key: string; serial: number; issued: number; cancelled: boolean; items: NoticeItem[] } | null {
  const ftm = tag(xml, "ftm");
  if (!ftm) return null;
  const nts = tag(ftm, "nts_number");
  const org = tag(nts, "organisation"), year = tag(nts, "year"), number = tag(nts, "number");
  if (!number) return null;
  const key = `${org}/${year}/${number}`;
  const serial = Number(tag(nts, "serial_number")) || 0;
  const issued = Date.parse(tag(xml, "date_issue")) || 0;
  const subject = tag(ftm, "subject_code");
  const cancelled = subject === "CANCEL";
  const district = tag(xml, "district");
  const contents = tag(ftm, "contents").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  const reason = REASON_NL[tag(ftm, "reason_code")] ?? "";
  const phones: string[] = [], vhf: string[] = [];
  for (const c of tags(ftm, "communication")) {
    const code = tag(c, "communication_code"), nr = tag(c, "number");
    if (!nr) continue;
    if (code === "TE" && !phones.includes(nr)) phones.push(nr);
    if (code === "AP" && !vhf.includes(nr)) vhf.push(nr);
  }
  const msgLabel = `${org === "Rijkswaterstaat" ? "RWS" : org} ${year}/${number}`;
  const items: NoticeItem[] = [];
  const blocks = [...tags(ftm, "object").map((b) => ({ b, section: false })), ...tags(ftm, "fairway_section").map((b) => ({ b, section: true }))];
  blocks.forEach(({ b, section }, i) => {
    const geo = tag(b, "geo_object");
    const pts = tags(geo, "coordinate")
      .map((c) => [coord(tag(c, "lat")), coord(tag(c, "long"))] as [number, number])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (!pts.length) return;
    const lims = tags(b, "limitation");
    const codes = [...new Set(lims.map((l) => tag(l, "limitation_code")).filter(Boolean))];
    const periods = lims.flatMap((l) => parsePeriods(l));
    // Waarden bij beperkingen (bv. doorvaarthoogte 3,5 m).
    const limits = codes.map((c) => {
      const l = lims.find((x) => tag(x, "limitation_code") === c) || "";
      const val = tag(l, "value"), unit = tag(l, "reference_code") ? "" : tag(l, "unit");
      return (LIMIT_NL[c] || c) + (val ? ` ${val.replace(".", ",")}${unit === "M" || !unit ? " m" : " " + unit.toLowerCase()}` : "");
    });
    const cat: Category = codes.some((c) => STREM.has(c)) ? "stremming" : codes.length && codes.every((c) => c === "NOLIM") ? "info" : codes.length ? "hinder" : subject === "WARNIN" ? "hinder" : "info";
    const typeCode = tag(geo, "type_code");
    const mid = pts.length > 1 ? [(pts[0][0] + pts[pts.length - 1][0]) / 2, (pts[0][1] + pts[pts.length - 1][1]) / 2] : pts[0];
    items.push({
      id: `${key}#${i}`,
      msg: msgLabel,
      cat,
      limits,
      limitCodes: codes,
      reason,
      name: tag(geo, "name"),
      fairway: tag(geo, "fairway_name"),
      type: TYPE_NL[typeCode] || (section ? "Vaarweg" : "Object"),
      typeCode,
      lat: Number(mid[0].toFixed(5)),
      lon: Number(mid[1].toFixed(5)),
      line: section && pts.length > 1 ? pts.map((p) => [Number(p[0].toFixed(5)), Number(p[1].toFixed(5))] as [number, number]) : null,
      periods,
      contents,
      district,
      issued: new Date(issued).toISOString(),
      phones,
      vhf,
      source: tag(ftm, "source"),
    });
  });
  return { key, serial, issued, cancelled, items };
}

async function fetchPage(offset: number) {
  const body =
    '<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>' +
    '<get_messages_query xmlns="http://www.ris.eu/nts.ms/2.0.4.0"><message_type>FTM</message_type>' +
    `<paging_request><offset>${offset}</offset><limit>${PAGE}</limit><total_count>false</total_count></paging_request>` +
    "</get_messages_query></soapenv:Body></soapenv:Envelope>";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(NTS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '"http://www.ris.eu/nts.ms/get_messages"', "User-Agent": "WetterWinkel-app (wetterwinkel.nl)" },
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`NtS ${res.status}`);
    const text = await res.text();
    if (/<(?:\w+:)?Fault>/.test(text)) throw new Error("NtS fault: " + tag(text, "faultstring"));
    return tags(text, "result_message").map(parseMessage).filter(Boolean) as NonNullable<ReturnType<typeof parseMessage>>[];
  } finally {
    clearTimeout(timer);
  }
}

// ---- Opslag in het geheugen (één per serverproces) ----
const store = new Map<string, Stored>();
let newestIssued = 0;
let lastRefresh = 0;
let loaded = false;
let running: Promise<void> | null = null;
let lastError = "";

function keep(m: NonNullable<ReturnType<typeof parseMessage>>) {
  const old = store.get(m.key);
  if (old && old.serial > m.serial) return;
  if (old && old.serial === m.serial && old.issued >= m.issued) return;
  store.set(m.key, { serial: m.serial, issued: m.issued, cancelled: m.cancelled, items: m.items });
  if (m.issued > newestIssued) newestIssued = m.issued;
}

async function refresh() {
  const started = Date.now();
  try {
    if (!loaded) {
      const stopAt = Date.now() - COLD_DAYS * 86400000;
      for (let p = 0; p < MAX_COLD_PAGES; p++) {
        const msgs = await fetchPage(p * PAGE);
        msgs.forEach(keep);
        if (msgs.length < PAGE / 2) break;
        const oldest = Math.min(...msgs.map((m) => m.issued || Infinity));
        if (oldest < stopAt) break;
      }
      loaded = true;
    } else {
      const since = newestIssued - 6 * 3600000; // overlap
      for (let p = 0; p < 20; p++) {
        const msgs = await fetchPage(p * PAGE);
        msgs.forEach(keep);
        if (!msgs.length || Math.min(...msgs.map((m) => m.issued || Infinity)) < since) break;
      }
    }
    // Afgelopen berichten opruimen.
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.cancelled || v.items.every((it) => it.periods.length && it.periods.every((p) => p.end != null && p.end < now - 86400000))) store.delete(k);
    }
    lastRefresh = Date.now();
    lastError = "";
    console.log(`[stremmingen] ververst: ${store.size} berichten in ${Math.round((Date.now() - started) / 1000)} s`);
  } catch (error: any) {
    lastError = String(error?.message || error);
    console.error("[stremmingen] verversen mislukt", lastError);
    if (loaded) lastRefresh = Date.now() - REFRESH_MS + 10 * 60000; // over 10 min opnieuw
  }
}

export function ensureStremmingen() {
  if (!running && Date.now() - lastRefresh > REFRESH_MS) {
    running = refresh().finally(() => {
      running = null;
    });
  }
  return { ready: loaded, error: lastError, updatedAt: lastRefresh ? new Date(lastRefresh).toISOString() : null };
}

export type Status = "nu" | "gepland";

function insideDaily(d: { from: string; to: string }, now: number) {
  const hm = new Date(now).toLocaleTimeString("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit", hour12: false });
  return d.from <= d.to ? hm >= d.from && hm < d.to : hm >= d.from || hm < d.to;
}

function statusOf(it: NoticeItem, now: number): { status: Status; startsAt: number; rightNow: boolean } | null {
  if (!it.periods.length) return { status: "nu", startsAt: now, rightNow: true };
  let best: { status: Status; startsAt: number; rightNow: boolean } | null = null;
  for (const p of it.periods) {
    if (p.end != null && p.end < now) continue;
    if (p.start <= now) {
      // Bij een dagelijks venster is het alleen binnen die tijden echt dicht.
      return { status: "nu", startsAt: p.start, rightNow: !p.daily || insideDaily(p.daily, now) };
    }
    if (p.start - now <= UPCOMING_DAYS * 86400000 && (!best || p.start < best.startsAt)) best = { status: "gepland", startsAt: p.start, rightNow: false };
  }
  return best;
}

export type ActiveNotice = Omit<NoticeItem, "periods"> & { status: Status; rightNow: boolean; when: string; startsAt: string };

export function activeNotices(now = Date.now()): ActiveNotice[] {
  const out: ActiveNotice[] = [];
  for (const v of store.values()) {
    if (v.cancelled) continue;
    for (const it of v.items) {
      const s = statusOf(it, now);
      if (!s) continue;
      const { periods, ...rest } = it;
      const relevant = periods.filter((p) => p.end == null || p.end >= now).slice(0, 3);
      out.push({ ...rest, status: s.status, rightNow: s.rightNow, when: relevant.map((p) => p.label).join(" · "), startsAt: new Date(s.startsAt).toISOString() });
    }
  }
  return out;
}

// Gestremde objecten (nu) — gebruikt door de routeplanner.
export function blockingPoints(now = Date.now()) {
  return activeNotices(now).filter((n) => n.rightNow && n.cat === "stremming" && !n.line);
}
