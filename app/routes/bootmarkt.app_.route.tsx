/* eslint-disable @typescript-eslint/no-explicit-any */
// Routeplanner voor de WetterWinkel-app (testversie).
// www.wetterwinkel.nl/apps/bootmarkt/app/route?from=53.09,5.81&to=52.84,5.71&air=1.9
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { previewAllowed } from "../lib/wetter-app.server";
import { blockedEdges, currentNetwork, ensureNetwork, networkStatus, planRoute } from "../lib/vaarroute.server";
import { activeNotices, blockingPoints, ensureStremmingen, type ActiveNotice } from "../lib/stremmingen.server";

// Berichten aan de scheepvaart die op (of vlak bij) de route liggen.
function noticesAlong(coords: Array<[number, number]>, notices: ActiveNotice[]) {
  if (!coords.length) return [];
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const [la, lo] of coords) {
    minLat = Math.min(minLat, la); maxLat = Math.max(maxLat, la); minLon = Math.min(minLon, lo); maxLon = Math.max(maxLon, lo);
  }
  const pad = 0.003;
  const cum: number[] = [0];
  const m = (a: [number, number], b: [number, number]) => {
    const k = Math.cos((a[0] * Math.PI) / 180);
    return Math.hypot((b[0] - a[0]) * 111320, (b[1] - a[1]) * 111320 * k);
  };
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + m(coords[i - 1], coords[i]));
  const near = (p: [number, number], max: number) => {
    let best = Infinity, at = 0;
    for (let i = 0; i < coords.length; i++) {
      const d = m(p, coords[i]);
      if (d < best) { best = d; at = cum[i]; }
    }
    return best <= max ? at : null;
  };
  const out: Array<ActiveNotice & { atM: number }> = [];
  for (const n of notices) {
    const pts: Array<[number, number]> = n.line ? n.line : [[n.lat, n.lon]];
    if (!pts.some(([la, lo]) => la >= minLat - pad && la <= maxLat + pad && lo >= minLon - pad && lo <= maxLon + pad)) continue;
    const ats = pts.map((p) => near(p, n.line ? 200 : 120)).filter((v): v is number => v != null);
    if (!ats.length) continue;
    out.push({ ...n, atM: Math.round(Math.min(...ats)) });
  }
  return out.sort((a, b) => a.atM - b.atM).slice(0, 25);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function parsePoint(value: string | null): [number, number] | null {
  const parts = String(value || "").split(",").map(Number);
  if (parts.length !== 2 || !parts.every(Number.isFinite)) return null;
  const [lat, lon] = parts;
  // Alleen Nederland en directe omgeving.
  if (lat < 50.5 || lat > 54 || lon < 2.5 || lon > 7.6) return null;
  return [lon, lat];
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await authenticate.public.appProxy(request);
    const url = new URL(request.url);
    const rawCustomerId = String(url.searchParams.get("logged_in_customer_id") || "");
    if (!rawCustomerId || !previewAllowed(rawCustomerId)) return json({ success: false }, 404);

    // Netwerk laden (eerste keer ~5–10 seconden); de app vraagt het daarna opnieuw.
    const pending = ensureNetwork();
    const net = currentNetwork();
    if (!net) {
      pending?.catch(() => null);
      return json({ success: false, preparing: true, message: "De routeplanner wordt voorbereid…" }, 202);
    }
    if (url.searchParams.get("warm")) return json({ success: true, status: networkStatus() });

    const from = parsePoint(url.searchParams.get("from"));
    const to = parsePoint(url.searchParams.get("to"));
    if (!from || !to) return json({ success: false, message: "Kies een vertrekpunt en bestemming in Nederland." }, 400);
    const airRaw = Number(String(url.searchParams.get("air") || "").replace(",", "."));
    const air = Number.isFinite(airRaw) && airRaw > 0 && airRaw < 40 ? airRaw : null;

    // Actuele stremmingen meenemen: de route vaart er zo mogelijk omheen.
    ensureStremmingen();
    const blocking = blockingPoints().filter((b) => b.typeCode !== "LKB");
    const avoidMap = blockedEdges(net, blocking.map((b) => ({ lat: b.lat, lon: b.lon, codes: b.limitCodes, name: b.name })), air);
    const avoid = new Set(avoidMap.keys());
    let result = planRoute(net, from, to, air, avoid);
    let blockedOnRoute: string[] = [];
    let detourFor: string[] = [];
    const direct = avoid.size ? planRoute(net, from, to, air) : result;
    if (!result.ok && direct.ok) {
      // Geen omweg mogelijk: toon de normale route met een duidelijke waarschuwing.
      result = direct;
      blockedOnRoute = [...new Set([...avoidMap.values()])].filter((name) => direct.objects.some((o) => o.name === name)).slice(0, 5);
      if (!blockedOnRoute.length) blockedOnRoute = ["een gestremd object op de route"];
    } else if (result.ok && direct.ok && result.distanceM > direct.distanceM + 50) {
      detourFor = [...new Set([...avoidMap.values()])].slice(0, 3);
    }
    if (!result.ok) return json({ success: false, message: result.reason, blockers: (result as any).blockers || [] });
    const notices = noticesAlong(result.coords, activeNotices());
    return json({
      success: true,
      route: {
        distanceM: Math.round(result.distanceM),
        coords: result.coords.map(([lat, lon]) => [Number(lat.toFixed(5)), Number(lon.toFixed(5))]),
        objects: result.objects.map((o) => ({
          kind: o.kind,
          id: o.id,
          name: o.name,
          city: o.city,
          canOpen: o.canOpen,
          clearance: o.clearance,
          mustOpen: o.mustOpen,
          atM: Math.round(o.atM),
          lat: o.lat,
          lon: o.lon,
        })),
        waterways: result.waterways,
        snapFromM: Math.round(result.snapFromM),
        snapToM: Math.round(result.snapToM),
        air,
        blockedOnRoute,
        detourFor,
        notices: notices.map((n) => ({
          id: n.id, cat: n.cat, status: n.status, rightNow: n.rightNow, name: n.name, type: n.type, limits: n.limits, reason: n.reason,
          when: n.when, contents: n.contents, lat: n.lat, lon: n.lon, atM: n.atM, phones: n.phones, vhf: n.vhf, msg: n.msg,
        })),
      },
      source: "Rijkswaterstaat (NWB Vaarwegen, FIS)",
    });
  } catch (error: any) {
    console.error("WetterWinkel-app route mislukt", error);
    return json({ success: false, message: "De routeplanner is nu niet bereikbaar." }, 502);
  }
}
