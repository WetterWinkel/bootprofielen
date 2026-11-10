/* eslint-disable @typescript-eslint/no-explicit-any */
// Routeplanner voor de WetterWinkel-app (testversie).
// www.wetterwinkel.nl/apps/bootmarkt/app/route?from=53.09,5.81&to=52.84,5.71&air=1.9
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { previewAllowed } from "../lib/wetter-app.server";
import { currentNetwork, ensureNetwork, networkStatus, planRoute } from "../lib/vaarroute.server";

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

    const result = planRoute(net, from, to, air);
    if (!result.ok) return json({ success: false, message: result.reason, blockers: (result as any).blockers || [] });
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
      },
      source: "Rijkswaterstaat (NWB Vaarwegen, FIS)",
    });
  } catch (error: any) {
    console.error("WetterWinkel-app route mislukt", error);
    return json({ success: false, message: "De routeplanner is nu niet bereikbaar." }, 502);
  }
}
