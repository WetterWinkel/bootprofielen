/* eslint-disable @typescript-eslint/no-explicit-any */
// Officiële staande mastroute door heel Nederland (Rijkswaterstaat, Basisrecreatietoervaartnet, CC-0).
// www.wetterwinkel.nl/apps/bootmarkt/app/mastroute
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { previewAllowed } from "../lib/wetter-app.server";
import { loadStaandeMast } from "../lib/vaarroute.server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=86400" },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await authenticate.public.appProxy(request);
    const url = new URL(request.url);
    const rawCustomerId = String(url.searchParams.get("logged_in_customer_id") || "");
    if (!rawCustomerId || !previewAllowed(rawCustomerId)) return json({ success: false }, 404);
    const lines = await loadStaandeMast();
    return json({ success: true, lines, source: "Rijkswaterstaat – Basisrecreatietoervaartnet (staande mastroute)" });
  } catch (error: any) {
    console.error("WetterWinkel-app staande mastroute mislukt", error);
    return json({ success: false, message: "Staande mastroute is nu niet bereikbaar." }, 502);
  }
}
