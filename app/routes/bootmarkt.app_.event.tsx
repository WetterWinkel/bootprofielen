/* eslint-disable @typescript-eslint/no-explicit-any */
// Gebruiksstatistiek van de WetterWinkel-app (alleen gebeurtenistypen, geen inhoud).
// POST www.wetterwinkel.nl/apps/bootmarkt/app/event  { event: "APP_OPEN", detail?: "kaart" }
import type { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { customerGid } from "../lib/wetter-app.server";

const EVENTS = new Set([
  "APP_OPEN", "APP_INSTALLED", "APP_TAB", "APP_ROUTE", "APP_NAV_HOME", "APP_CAPTAIN", "APP_CART",
  "APP_PROFILE_CREATED", "APP_PROFILE_COMPLETED", "APP_VICTRON", "APP_INTRO_DONE", "APP_INTRO_SKIP",
]);

export async function action({ request }: ActionFunctionArgs) {
  const ok = () => new Response(null, { status: 204 });
  try {
    await authenticate.public.appProxy(request);
    const url = new URL(request.url);
    const shop = String(url.searchParams.get("shop") || "");
    const raw = String(url.searchParams.get("logged_in_customer_id") || "");
    if (!shop || !raw) return ok();
    const body: any = await request.json().catch(() => ({}));
    const event = String(body.event || "");
    if (!EVENTS.has(event)) return ok();
    await prisma.captainStorefrontEvent.create({
      data: {
        shop,
        visitorId: customerGid(raw),
        event,
        pageType: "app",
        metadata: { detail: String(body.detail || "").slice(0, 40) },
      },
    });
  } catch (error) {
    console.warn("App-event opslaan mislukt", error);
  }
  return ok();
}

export async function loader() {
  return new Response(null, { status: 405 });
}
