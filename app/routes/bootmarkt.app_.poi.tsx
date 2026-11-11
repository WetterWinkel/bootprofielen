/* eslint-disable @typescript-eslint/no-explicit-any */
// Horeca, supermarkten en jachthaven-contactgegevens (OpenStreetMap) voor de
// WetterWinkel-app, via onze server met cache en reserve-servers.
//   /apps/bootmarkt/app/poi?bbox=south,west,north,east
//   /apps/bootmarkt/app/poi?near=lat,lon   (jachthaven-contact binnen 400 m)
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { previewAllowed } from "../lib/wetter-app.server";

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const TILE = 0.04;
const DAY = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: any }>();
const KEEP = [
  "name", "amenity", "shop", "leisure", "waterway", "cuisine", "opening_hours", "phone", "contact:phone", "contact:mobile",
  "email", "contact:email", "website", "contact:website", "url", "vhf", "seamark:radio_station:channel", "communication:vhf",
  "addr:street", "addr:housenumber", "addr:city", "brand",
];

async function overpass(query: string) {
  let lastError: any = null;
  for (const host of MIRRORS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(`${host}?data=${encodeURIComponent(query)}`, {
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": "WetterWinkel-app/1.0 (info@wetterwinkel.nl)" },
      });
      if (!response.ok) throw new Error(`${host} ${response.status}`);
      const data = await response.json();
      return data.elements || [];
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("OpenStreetMap niet bereikbaar");
}

function compact(el: any) {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;
  const tags: Record<string, string> = {};
  for (const k of KEEP) if (el.tags?.[k]) tags[k] = el.tags[k];
  return { id: `${el.type}${el.id}`, lat, lon, tags };
}

// Marrekrite-ligplaatsen (Provincie Fryslân, publiek domein): alle ~680 in één keer.
async function marrekrite() {
  const hit = cache.get("marrekrite");
  if (hit && Date.now() - hit.at < DAY) return hit.value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(
      "https://geoportaal.fryslan.nl/arcgis/services/ProvinciaalGeoRegister/PGR2/MapServer/WFSServer?service=WFS&request=GetFeature&version=2.0.0&typeNames=PGR:Ligplaatsen&count=5000&outputFormat=GEOJSON",
      { signal: controller.signal, headers: { Accept: "application/json" } },
    );
    if (!response.ok) throw new Error(`Marrekrite ${response.status}`);
    const data = await response.json();
    const value = (data.features || []).flatMap((f: any) => {
      const p = f.properties || {};
      const c = f.geometry?.coordinates;
      if (!c) return [];
      return [{
        id: `mk${p.OBJECTID}`,
        lat: Number(c[1]),
        lon: Number(c[0]),
        tags: {
          marrekrite: "yes",
          nr: String(p.NR || ""),
          name: String(p.LOCATIE_NL || ""),
          name_fy: String(p.LOCATIE_FR || ""),
          soort: String(p.SOORT || ""),
          kamperen: String(p.CAMPEREN || ""),
          container: String(p.CONTAINER || ""),
          walverbinding: String(p.WALVERBINDING || ""),
        },
      }];
    });
    cache.set("marrekrite", { at: Date.now(), value });
    return value;
  } finally {
    clearTimeout(timer);
  }
}

async function tile(tx: number, ty: number) {
  const key = `t:${tx}:${ty}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DAY) return hit.value;
  const s = (ty * TILE).toFixed(3), w = (tx * TILE).toFixed(3), n = ((ty + 1) * TILE).toFixed(3), e = ((tx + 1) * TILE).toFixed(3);
  const b = `${s},${w},${n},${e}`;
  const q =
    `[out:json][timeout:25];(` +
    `nwr["amenity"~"^(restaurant|cafe|pub|bar|fast_food|ice_cream)$"](${b});` +
    `nwr["shop"~"^(supermarket|convenience)$"](${b});` +
    `nwr["leisure"="marina"](${b});` +
    `nwr["waterway"="fuel"](${b});` +
    `);out center tags;`;
  const value = (await overpass(q)).map(compact).filter(Boolean);
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 4000) cache.clear();
  return value;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=600" },
    });
  try {
    await authenticate.public.appProxy(request);
    const url = new URL(request.url);
    const rawCustomerId = String(url.searchParams.get("logged_in_customer_id") || "");
    if (!rawCustomerId || !previewAllowed(rawCustomerId)) return json({ success: false }, 404);

    if (url.searchParams.get("marrekrite")) {
      return json({ success: true, items: await marrekrite(), source: "Provincie Fryslân / Marrekrite (publiek domein)" });
    }

    const near = String(url.searchParams.get("near") || "").split(",").map(Number);
    if (near.length === 2 && near.every(Number.isFinite)) {
      const [lat, lon] = near;
      const key = `n:${lat.toFixed(4)},${lon.toFixed(4)}`;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < DAY) return json({ success: true, items: hit.value });
      const q = `[out:json][timeout:15];nwr(around:400,${lat.toFixed(5)},${lon.toFixed(5)})["leisure"="marina"];out center tags 8;`;
      const items = (await overpass(q)).map(compact).filter(Boolean);
      cache.set(key, { at: Date.now(), value: items });
      return json({ success: true, items });
    }

    const parts = String(url.searchParams.get("bbox") || "").split(",").map(Number);
    if (parts.length !== 4 || !parts.every(Number.isFinite)) return json({ success: false, message: "bbox ontbreekt" }, 400);
    const [s, w, n, e] = parts;
    const tiles: Array<[number, number]> = [];
    for (let tx = Math.floor(w / TILE); tx <= Math.floor(e / TILE); tx++) {
      for (let ty = Math.floor(s / TILE); ty <= Math.floor(n / TILE); ty++) tiles.push([tx, ty]);
    }
    if (tiles.length > 16) return json({ success: false, message: "Zoom verder in." }, 400);
    const results = await Promise.all(tiles.map(([tx, ty]) => tile(tx, ty).catch(() => [])));
    const seen = new Set<string>();
    const items = results.flat().filter((it: any) => {
      if (seen.has(it.id) || it.lat < s || it.lat > n || it.lon < w || it.lon > e) return false;
      seen.add(it.id);
      return true;
    });
    return json({ success: true, items });
  } catch (error: any) {
    console.error("WetterWinkel-app poi mislukt", error?.message || error);
    return json({ success: false, message: "Kaartinformatie is nu niet bereikbaar." }, 502);
  }
}
