/* eslint-disable @typescript-eslint/no-explicit-any */
// Weer voor de WetterWinkel-app via onze server (cache 10 min per ~1 km).
// www.wetterwinkel.nl/apps/bootmarkt/app/weer?lat=53.09&lon=5.83
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { previewAllowed } from "../lib/wetter-app.server";

const cache = new Map<string, { at: number; value: any }>();
const TTL = 10 * 60 * 1000;

async function getJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Open-Meteo ${response.status}: ${body.slice(0, 200)}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
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
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset" +
      "&wind_speed_unit=kn&forecast_days=3";
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?${base}&current=wave_height,wave_direction,wave_period`;
    const [weather, marine] = await Promise.all([getJson(forecastUrl), getJson(marineUrl).catch(() => null)]);
    const value = { weather, marine };
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 2000) cache.clear();
    return json({ success: true, ...value });
  } catch (error: any) {
    console.error("WetterWinkel-app weer mislukt", error?.message || error);
    return json({ success: false, message: "Weer is nu niet beschikbaar." }, 502);
  }
}
