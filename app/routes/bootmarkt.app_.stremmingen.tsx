/* eslint-disable @typescript-eslint/no-explicit-any */
// Stremmingen en hinder (berichten aan de scheepvaart, Rijkswaterstaat) voor de app.
// www.wetterwinkel.nl/apps/bootmarkt/app/stremmingen
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { previewAllowed } from "../lib/wetter-app.server";
import { activeNotices, ensureStremmingen } from "../lib/stremmingen.server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=300" },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await authenticate.public.appProxy(request);
    const url = new URL(request.url);
    const rawCustomerId = String(url.searchParams.get("logged_in_customer_id") || "");
    if (!rawCustomerId || !previewAllowed(rawCustomerId)) return json({ success: false }, 404);
    const state = ensureStremmingen();
    if (!state.ready) return json({ success: false, preparing: true, message: "Stremmingen worden geladen…" }, 202);
    const items = activeNotices().map(({ source, issued, district, limitCodes, typeCode, ...rest }) => rest);
    return json({ success: true, updatedAt: state.updatedAt, items, source: "Rijkswaterstaat – berichten aan de scheepvaart (vaarweginformatie.nl)" });
  } catch (error: any) {
    console.error("WetterWinkel-app stremmingen mislukt", error);
    return json({ success: false, message: "Stremmingen zijn nu niet bereikbaar." }, 502);
  }
}
