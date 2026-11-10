/* eslint-disable @typescript-eslint/no-explicit-any */
// Vaardata voor de WetterWinkel-app (testversie).
// www.wetterwinkel.nl/apps/bootmarkt/app/vaardata?type=bridge&id=6484
//
// Haalt bedieningstijden en marifoonkanalen op bij Rijkswaterstaat
// (Fairway Information Services, vaarweginformatie.nl). Die dienst heeft geen
// CORS, daarom loopt dit via onze server. Alleen-lezen, met cache in geheugen.
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { previewAllowed } from "../lib/wetter-app.server";

const VNDS = "https://www.vaarweginformatie.nl/wfswms/dataservice/1.4";
const HOUR = 60 * 60 * 1000;

type CacheEntry = { at: number; value: any };
const cache = new Map<string, CacheEntry>();

async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 3000) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 500);
    oldest.forEach(([k]) => cache.delete(k));
  }
  return value;
}

async function getJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Vaarweginformatie gaf ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function generation() {
  return cached("generation", 6 * HOUR, async () => {
    const data = await getJson(`${VNDS}/geogeneration`);
    return Number(data.GeoGeneration);
  });
}

// Marifoonkanalen per brug/sluis (ParentId -> kanalen)
function radioByParent() {
  return cached("radio", 24 * HOUR, async () => {
    const gen = await generation();
    const map: Record<string, string[]> = {};
    for (let offset = 0; offset < 6000; offset += 1000) {
      const page = await getJson(`${VNDS}/${gen}/radiocallinpoint?count=1000&offset=${offset}`);
      for (const item of page.Result || []) {
        if (!item.ParentId || !item.VhfChannels?.length) continue;
        const key = String(item.ParentId);
        map[key] = [...new Set([...(map[key] || []), ...item.VhfChannels.map(String)])];
      }
      if ((page.Result || []).length < 1000) break;
    }
    return map;
  });
}

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NL = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

function amsterdamParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { mmdd: `${get("month")}-${get("day")}`, weekday };
}

// Kies het schema dat op deze datum geldt (schema's starten op "--MM-DD").
function scheduleFor(schedules: any[], mmdd: string) {
  const list = (schedules || [])
    .map((s) => ({ ...s, start: String(s.From || "").replace(/^--/, "") }))
    .filter((s) => /^\d\d-\d\d$/.test(s.start))
    .sort((a, b) => (a.start < b.start ? -1 : 1));
  if (!list.length) return null;
  const before = list.filter((s) => s.start <= mmdd);
  return before.length ? before[before.length - 1] : list[list.length - 1];
}

function windowsFor(schedule: any, weekday: number) {
  const day = schedule?.[DAY_KEYS[weekday]];
  return (day?.OperatingTimes || []).map((t: any) => `${t.FromTime}–${t.ToTime}`);
}

function summarizeTimes(times: any) {
  const now = new Date();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(now.getTime() + i * 24 * HOUR);
    const { mmdd, weekday } = amsterdamParts(date);
    const schedule = scheduleFor(times?.NormalSchedules, mmdd);
    days.push({
      label: i === 0 ? "Vandaag" : i === 1 ? "Morgen" : DAY_NL[weekday],
      windows: schedule ? windowsFor(schedule, weekday) : [],
      known: Boolean(schedule),
    });
  }
  return {
    name: String(times?.Name || ""),
    note: String(times?.Note || ""),
    days,
  };
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

    const type = String(url.searchParams.get("type") || "");
    const id = String(url.searchParams.get("id") || "").replace(/\D/g, "");
    if (!["bridge", "lock"].includes(type) || !id) return json({ success: false, message: "Onbekend object." }, 400);

    const gen = await generation();
    const object = await cached(`${type}:${id}`, 24 * HOUR, () => getJson(`${VNDS}/${gen}/${type}/${id}`));
    const radio = await radioByParent().catch(() => ({}) as Record<string, string[]>);
    let times = null;
    if (object?.OperatingTimesId) {
      const raw = await cached(`times:${object.OperatingTimesId}`, 24 * HOUR, () =>
        getJson(`${VNDS}/${gen}/operatingtimes/${object.OperatingTimesId}`),
      ).catch(() => null);
      if (raw) times = summarizeTimes(raw);
    }
    return json({
      success: true,
      object: {
        id: object?.Id,
        name: object?.Name || "",
        city: object?.City || "",
        phone: object?.PhoneNumber || "",
        canOpen: object?.CanOpen ?? null,
        remote: object?.IsRemoteControlled ?? null,
        note: object?.Note || "",
        vhf: radio[String(object?.Id)] || [],
      },
      times,
      source: "Rijkswaterstaat – vaarweginformatie.nl",
    });
  } catch (error: any) {
    console.error("WetterWinkel-app vaardata mislukt", error);
    return json({ success: false, message: "Vaarweginformatie is nu niet bereikbaar." }, 502);
  }
}
