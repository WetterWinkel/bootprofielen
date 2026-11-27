/* eslint-disable @typescript-eslint/no-explicit-any */
// Weer voor de WetterWinkel-app via onze server (cache 10 min per ~1 km).
// Bron: MET Norway (api.met.no, CC BY 4.0, ook commercieel toegestaan). Open-Meteo
// alleen nog als reserve en voor golfhoogte: die gratis dienst heeft een daglimiet
// per IP-adres en Render deelt IP-adressen met andere klanten.
// www.wetterwinkel.nl/apps/bootmarkt/app/weer?lat=53.09&lon=5.83
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { previewAllowed } from "../lib/wetter-app.server";

const cache = new Map<string, { at: number; value: any }>();
const TTL = 10 * 60 * 1000;

const UA = "WetterWinkel-app/1.0 (+https://www.wetterwinkel.nl)";

async function getJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json", "User-Agent": UA } });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`${new URL(url).hostname} ${response.status}: ${body.slice(0, 200)}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// MET Norway-symbool -> WMO-weercode (die de app al kent).
function wmo(symbol: string | undefined) {
  const s = String(symbol || "").replace(/_(day|night|polartwilight)$/, "");
  if (!s) return 3;
  if (s.includes("thunder")) return 95;
  if (s === "clearsky") return 0;
  if (s === "fair") return 1;
  if (s === "partlycloudy") return 2;
  if (s === "cloudy") return 3;
  if (s === "fog") return 45;
  if (s.includes("sleet")) return 66;
  if (s.includes("snowshowers")) return s.startsWith("heavy") ? 86 : 85;
  if (s.includes("snow")) return s.startsWith("light") ? 71 : s.startsWith("heavy") ? 75 : 73;
  if (s.includes("rainshowers")) return s.startsWith("light") ? 80 : s.startsWith("heavy") ? 82 : 81;
  if (s.includes("rain")) return s.startsWith("light") ? 61 : s.startsWith("heavy") ? 65 : 63;
  return 3;
}

const KN = 1.943844;
const ymdAms = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
const hmAms = (d: Date) => d.toLocaleTimeString("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit", hour12: false });
const isoLocal = (d: Date) => `${ymdAms(d)}T${hmAms(d)}`;

// Zonsopkomst/-ondergang (zonnestandformule, nauwkeurig op ~1-2 minuten).
function sunTimes(dateYmd: string, lat: number, lon: number) {
  const rad = Math.PI / 180;
  const jd = Date.parse(`${dateYmd}T12:00:00Z`) / 86400000 + 2440587.5;
  const n = Math.round(jd - 2451545.0 + 0.0008);
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const decl = Math.asin(Math.sin(lambda * rad) * Math.sin(23.4397 * rad));
  const cosH = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(decl)) / (Math.cos(lat * rad) * Math.cos(decl));
  if (cosH < -1 || cosH > 1) return null;
  const H = Math.acos(cosH) / rad;
  const toDate = (j: number) => new Date((j - 2440587.5) * 86400000);
  return { rise: toDate(jTransit - H / 360), set: toDate(jTransit + H / 360) };
}

async function metNorway(lat: number, lon: number) {
  const d: any = await getJson(`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
  const ts: any[] = d?.properties?.timeseries || [];
  if (!ts.length) throw new Error("MET Norway gaf geen voorspelling");
  const det = (t: any) => t?.data?.instant?.details || {};
  const next1 = (t: any) => t?.data?.next_1_hours || t?.data?.next_6_hours || {};
  const gust = (t: any) => (det(t).wind_speed_of_gust ?? det(t).wind_speed ?? 0) * KN;
  const first = ts[0];
  const current = {
    time: isoLocal(new Date(first.time)),
    temperature_2m: det(first).air_temperature,
    weather_code: wmo(next1(first).summary?.symbol_code),
    wind_speed_10m: (det(first).wind_speed ?? 0) * KN,
    wind_direction_10m: det(first).wind_from_direction ?? 0,
    wind_gusts_10m: gust(first),
    precipitation: next1(first).details?.precipitation_amount ?? 0,
  };
  const hourlyTs = ts.filter((t) => t.data?.next_1_hours).slice(0, 48);
  const hourly = {
    time: hourlyTs.map((t) => isoLocal(new Date(t.time))),
    wind_speed_10m: hourlyTs.map((t) => (det(t).wind_speed ?? 0) * KN),
    wind_gusts_10m: hourlyTs.map(gust),
    wind_direction_10m: hourlyTs.map((t) => det(t).wind_from_direction ?? 0),
    precipitation_probability: hourlyTs.map((t) => {
      const p = t.data.next_1_hours.details?.probability_of_precipitation;
      return p == null ? null : Math.round(p);
    }),
    temperature_2m: hourlyTs.map((t) => det(t).air_temperature),
  };
  const days = new Map<string, any[]>();
  for (const t of ts) {
    const day = ymdAms(new Date(t.time));
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push(t);
  }
  const dayKeys = [...days.keys()].slice(0, 9);
  const daily: any = {
    time: dayKeys, weather_code: [], temperature_2m_max: [], temperature_2m_min: [], wind_speed_10m_max: [], wind_gusts_10m_max: [],
    sunrise: [], sunset: [], precipitation_sum: [], precipitation_probability_max: [], cloud_cover_mean: [], wind_direction_dominant: [],
  };
  for (const day of dayKeys) {
    const list = days.get(day)!;
    const temps = list.map((t) => det(t).air_temperature).filter((v) => v != null);
    const noon = list.reduce((best, t) => (Math.abs(new Date(t.time).getUTCHours() - 11) < Math.abs(new Date(best.time).getUTCHours() - 11) ? t : best), list[0]);
    daily.weather_code.push(wmo(noon.data?.next_6_hours?.summary?.symbol_code || noon.data?.next_1_hours?.summary?.symbol_code));
    daily.temperature_2m_max.push(Math.max(...temps));
    daily.temperature_2m_min.push(Math.min(...temps));
    daily.wind_speed_10m_max.push(Math.max(...list.map((t) => (det(t).wind_speed ?? 0) * KN)));
    daily.wind_gusts_10m_max.push(Math.max(...list.map(gust)));
    const sun = sunTimes(day, lat, lon);
    daily.sunrise.push(sun ? isoLocal(sun.rise) : `${day}T--:--`);
    daily.sunset.push(sun ? isoLocal(sun.set) : `${day}T--:--`);
    // Alleen daguren (8–20 u) voor het vaarcijfer: 's nachts vaart bijna niemand.
    const dayTime = list.filter((t) => {
      const h = Number(hmAms(new Date(t.time)).slice(0, 2));
      return h >= 8 && h <= 20;
    });
    const span = dayTime.length ? dayTime : list;
    const precip = (t: any) => t.data?.next_1_hours?.details?.precipitation_amount ?? (t.data?.next_6_hours?.details?.precipitation_amount ?? 0) / 6;
    daily.precipitation_sum.push(Math.round(span.reduce((sum, t) => sum + precip(t), 0) * 10) / 10);
    const probs = span.map((t) => t.data?.next_1_hours?.details?.probability_of_precipitation ?? t.data?.next_6_hours?.details?.probability_of_precipitation).filter((v) => v != null);
    daily.precipitation_probability_max.push(probs.length ? Math.round(Math.max(...probs)) : null);
    const clouds = span.map((t) => det(t).cloud_area_fraction).filter((v) => v != null);
    daily.cloud_cover_mean.push(clouds.length ? Math.round(clouds.reduce((a, b) => a + b, 0) / clouds.length) : null);
    // Overheersende windrichting (vectorgemiddelde).
    let sx = 0, sy = 0;
    for (const t of span) {
      const dir = det(t).wind_from_direction, sp = det(t).wind_speed ?? 0;
      if (dir == null) continue;
      sx += Math.sin((dir * Math.PI) / 180) * sp;
      sy += Math.cos((dir * Math.PI) / 180) * sp;
    }
    daily.wind_direction_dominant.push(Math.round(((Math.atan2(sx, sy) * 180) / Math.PI + 360) % 360));
    // Wind en vlagen ook alleen overdag.
    daily.wind_speed_10m_max[daily.wind_speed_10m_max.length - 1] = Math.max(...span.map((t) => (det(t).wind_speed ?? 0) * KN));
    daily.wind_gusts_10m_max[daily.wind_gusts_10m_max.length - 1] = Math.max(...span.map(gust));
  }
  return { current, hourly, daily, source: "MET Norway" };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=300" },
    });
  try {
    await authenticate.public.appProxy(request);
    const url = new URL(request.url);
    const rawCustomerId = String(url.searchParams.get("logged_in_customer_id") || "");
    if (!rawCustomerId || !previewAllowed(rawCustomerId)) return json({ success: false }, 404);

    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return json({ success: false, message: "Ongeldige locatie." }, 400);
    }
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return json({ success: true, ...hit.value });

    const base = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&timezone=Europe%2FAmsterdam`;
    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast?${base}` +
      "&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation" +
      "&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation_probability,temperature_2m" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset,precipitation_sum,precipitation_probability_max,cloud_cover_mean,wind_direction_dominant" +
      "&wind_speed_unit=kn&forecast_days=9";
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?${base}&current=wave_height,wave_direction,wave_period`;
    const [weather, marine] = await Promise.all([
      metNorway(lat, lon).catch((error) => {
        console.warn("[weer] MET Norway mislukt, reserve Open-Meteo:", error?.message || error);
        return getJson(forecastUrl);
      }),
      getJson(marineUrl).catch(() => null),
    ]);
    const value = { weather, marine };
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 2000) cache.clear();
    return json({ success: true, ...value });
  } catch (error: any) {
    console.error("WetterWinkel-app weer mislukt", error?.message || error);
    return json({ success: false, message: "Weer is nu niet beschikbaar." }, 502);
  }
}
