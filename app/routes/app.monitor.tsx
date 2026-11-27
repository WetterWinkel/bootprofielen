/* eslint-disable @typescript-eslint/no-explicit-any */
// Beheerportaal: hoe gebruiken klanten de app en hoe compleet zijn de bootprofielen?
// Shopify-beheer → Apps → Bootprofielen → App-monitor (werkt ook in de Shopify-app op je telefoon).
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { missingProfileFields, requiredProfileKeys } from "../lib/wetter-app.server";

const FIELD_NL: Record<string, string> = {
  boottype: "Soort boot", naam_schip: "Naam", merk_boot: "Merk", model_boot: "Model", bouwjaar_boot: "Bouwjaar",
  lengte: "Lengte", diepgang: "Diepgang", doorvaarthoogte: "Doorvaarthoogte", thuishaven: "Thuishaven",
  aantal_masten: "Aantal masten", masthoogte: "Masthoogte", mast_strijkbaar: "Mast strijkbaar", kieltype: "Kiel",
  soort_bodem: "Bodem", soort_tube: "Tube", tube_diameter: "Tubediameter", max_pk: "Max. pk", rompvorm: "Rompvorm",
  stuurstand: "Stuurstand", trailer: "Trailer", soort_motor: "Soort motor", motormerk: "Merk motor",
  motormodel: "Type motor", motorvermogen: "Vermogen", brandstof: "Brandstof",
};
const EVENT_NL: Record<string, string> = {
  APP_OPEN: "App geopend", APP_INSTALLED: "Geopend als geïnstalleerde app", APP_ROUTE: "Route gepland",
  APP_NAV_HOME: "Naar thuishaven", APP_CAPTAIN: "Captain-vragen in de app", APP_CART: "In winkelwagen vanuit de app",
  APP_PROFILE_CREATED: "Bootprofiel aangemaakt in de app", APP_PROFILE_COMPLETED: "Bootprofiel aangevuld",
  APP_VICTRON: "Victron gekoppeld", APP_INTRO_DONE: "Rondleiding helemaal bekeken", APP_INTRO_SKIP: "Rondleiding overgeslagen",
};
const TAB_NL: Record<string, string> = {
  home: "Home", vaarinfo: "Vaarinformatie", kaart: "Vaarkaart", shop: "Shoppen", boot: "Je boot", captain: "Captain AI", service: "Serviceboek",
};

async function allProfiles(admin: any) {
  const out: any[] = [];
  let after: string | null = null;
  for (let page = 0; page < 40; page++) {
    const res: any = await (await admin.graphql(
      `#graphql
        query MonitorProfielen($after: String) {
          metaobjects(type: "$app:bootprofiel", first: 250, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id updatedAt
              naam: field(key: "naam") { value }
              data: field(key: "data") { value }
              foto: field(key: "bootfoto") { value }
              klant: field(key: "klant_id") { value }
            }
          }
        }`,
      { variables: { after } },
    )).json();
    if (res.errors?.length) throw new Error(res.errors[0].message);
    const conn = res.data?.metaobjects;
    out.push(...(conn?.nodes || []));
    if (!conn?.pageInfo?.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return out;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // ---- Bootprofielen ----
  let profiles: any[] = [];
  let profileError = "";
  try {
    profiles = await allProfiles(admin);
  } catch (error: any) {
    profileError = String(error?.message || error);
  }
  const week = Date.now() - 7 * 86400000;
  const typeCount = new Map<string, number>();
  const missingCount = new Map<string, number>();
  let complete = 0, withPhoto = 0, viaApp = 0, newThisWeek = 0, fillSum = 0;
  const customers = new Set<string>();
  const recent: any[] = [];
  for (const p of profiles) {
    let data: Record<string, any> = {};
    try { data = JSON.parse(p.data?.value || "{}") || {}; } catch { data = {}; }
    const required = requiredProfileKeys(data);
    const missing = missingProfileFields(data);
    const pct = required.length ? Math.round(((required.length - missing.length) / required.length) * 100) : 0;
    fillSum += pct;
    if (!missing.length) complete++;
    for (const k of missing) missingCount.set(k, (missingCount.get(k) || 0) + 1);
    const photo = Boolean(p.foto?.value);
    if (photo) withPhoto++;
    if (data.aangemaakt_via === "app") viaApp++;
    if (Date.parse(p.updatedAt) >= week) newThisWeek++;
    if (p.klant?.value) customers.add(p.klant.value);
    const type = String(data.boottype || "Onbekend");
    typeCount.set(type, (typeCount.get(type) || 0) + 1);
    recent.push({ name: p.naam?.value || data.naam_schip || "Boot", type, pct, photo, via: data.aangemaakt_via === "app" ? "App" : "Website", updatedAt: p.updatedAt });
  }
  recent.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  // ---- Serviceboek ----
  const [serviceEntries, serviceCustomers] = await Promise.all([
    prisma.serviceBookEntry.count({ where: { shop } }),
    prisma.serviceBookEntry.findMany({ where: { shop }, distinct: ["customerId"], select: { customerId: true } }),
  ]);

  // ---- App-gebruik ----
  const since30 = new Date(Date.now() - 30 * 86400000);
  const since7 = new Date(week);
  const [eventGroups, users30, users7, tabEvents, daily] = await Promise.all([
    prisma.captainStorefrontEvent.groupBy({ by: ["event"], where: { shop, pageType: "app", createdAt: { gte: since30 } }, _count: { _all: true } }),
    prisma.captainStorefrontEvent.findMany({ where: { shop, pageType: "app", createdAt: { gte: since30 } }, distinct: ["visitorId"], select: { visitorId: true } }),
    prisma.captainStorefrontEvent.findMany({ where: { shop, pageType: "app", createdAt: { gte: since7 } }, distinct: ["visitorId"], select: { visitorId: true } }),
    prisma.captainStorefrontEvent.findMany({ where: { shop, pageType: "app", event: "APP_TAB", createdAt: { gte: since30 } }, select: { metadata: true } }),
    prisma.captainStorefrontEvent.findMany({ where: { shop, pageType: "app", event: "APP_OPEN", createdAt: { gte: since7 } }, select: { createdAt: true, visitorId: true } }),
  ]);
  const tabs = new Map<string, number>();
  for (const t of tabEvents) {
    const tab = String((t.metadata as any)?.detail || "");
    if (tab) tabs.set(tab, (tabs.get(tab) || 0) + 1);
  }
  const perDay = new Map<string, Set<string>>();
  for (const d of daily) {
    const day = d.createdAt.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam", weekday: "short", day: "numeric", month: "short" });
    if (!perDay.has(day)) perDay.set(day, new Set());
    perDay.get(day)!.add(d.visitorId);
  }

  const total = profiles.length;
  return {
    profileError,
    profiles: {
      total,
      customers: customers.size,
      complete,
      completePct: total ? Math.round((complete / total) * 100) : 0,
      avgFill: total ? Math.round(fillSum / total) : 0,
      withPhoto,
      photoPct: total ? Math.round((withPhoto / total) * 100) : 0,
      viaApp,
      newThisWeek,
      types: [...typeCount.entries()].sort((a, b) => b[1] - a[1]),
      topMissing: [...missingCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => [FIELD_NL[k] || k, n]),
      recent: recent.slice(0, 15),
    },
    service: { entries: serviceEntries, customers: serviceCustomers.length },
    app: {
      users30: users30.length,
      users7: users7.length,
      events: eventGroups.map((g) => [EVENT_NL[g.event] || g.event, g._count._all] as [string, number]).sort((a, b) => b[1] - a[1]),
      tabs: [...tabs.entries()].map(([k, n]) => [TAB_NL[k] || k, n] as [string, number]).sort((a, b) => b[1] - a[1]),
      perDay: [...perDay.entries()].map(([d, s]) => [d, s.size] as [string, number]),
    },
  };
};

export default function Monitor() {
  const { profiles: p, service, app, profileError } = useLoaderData<typeof loader>();
  return (
    <s-page heading="App-monitor">
      <s-section heading="Bootprofielen">
        {profileError ? (
          <s-text>Profielen ophalen lukt nu niet: {profileError}</s-text>
        ) : (
          <s-stack direction="block" gap="base">
            <s-text>
              <strong>{p.total}</strong> bootprofielen van <strong>{p.customers}</strong> klanten · {p.newThisWeek} nieuw of bijgewerkt deze week
            </s-text>
            <s-text>
              Compleet (alle verplichte velden): <strong>{p.complete}</strong> ({p.completePct}%) · gemiddeld {p.avgFill}% ingevuld
            </s-text>
            <s-text>
              Met bootfoto: <strong>{p.withPhoto}</strong> ({p.photoPct}%) · aangemaakt in de app: {p.viaApp}
            </s-text>
            {p.topMissing.length > 0 && (
              <s-text>Vaakst nog leeg: {p.topMissing.map(([k, n]) => `${k} (${n})`).join(", ")}</s-text>
            )}
            {p.types.length > 0 && (
              <s-text>Soorten boten: {p.types.map(([k, n]) => `${k} ${n}`).join(" · ")}</s-text>
            )}
          </s-stack>
        )}
      </s-section>

      <s-section heading="Laatst aangemaakt of bijgewerkt">
        <s-stack direction="block" gap="small-200">
          {p.recent.length === 0 && <s-text>Nog geen bootprofielen.</s-text>}
          {p.recent.map((r: any, i: number) => (
            <s-text key={i}>
              {r.name} · {r.type} · {r.pct}% compleet · {r.photo ? "📷 foto" : "geen foto"} · via {r.via} ·{" "}
              {new Date(r.updatedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
            </s-text>
          ))}
        </s-stack>
      </s-section>

      <s-section heading="Serviceboek">
        <s-text>
          {service.entries} onderhoudsregels van {service.customers} klanten
        </s-text>
      </s-section>

      <s-section heading="App-gebruik">
        <s-stack direction="block" gap="base">
          <s-text>
            Actieve gebruikers: <strong>{app.users7}</strong> deze week · <strong>{app.users30}</strong> in 30 dagen
          </s-text>
          {app.perDay.length > 0 && (
            <s-text>Per dag (deze week): {app.perDay.map(([d, n]) => `${d}: ${n}`).join(" · ")}</s-text>
          )}
          {app.tabs.length > 0 && (
            <s-text>Meest bekeken: {app.tabs.map(([k, n]) => `${k} ${n}`).join(" · ")}</s-text>
          )}
          <s-stack direction="block" gap="small-200">
            {app.events.map(([k, n]) => (
              <s-text key={k}>
                {k}: {n}
              </s-text>
            ))}
          </s-stack>
          <s-paragraph>
            De app slaat alleen op wát er gebeurt (bijv. "route gepland"), niet de inhoud. Zolang de app alleen voor jou
            openstaat, zie je hier vooral je eigen gebruik. Telling vanaf 27 november 2026.
          </s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}
