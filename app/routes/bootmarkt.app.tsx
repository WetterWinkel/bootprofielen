/* eslint-disable @typescript-eslint/no-explicit-any */
// WetterWinkel-app (testversie) — www.wetterwinkel.nl/apps/bootmarkt/app
//
// Nieuwe, losstaande route. Raakt geen bestaande Bootmarkt-, Captain AI- of
// bootprofielroutes aan. Alleen zichtbaar voor klant-id's in
// APP_PREVIEW_CUSTOMER_IDS (standaard alleen Bernard).
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { authenticate, unauthenticated } from "../shopify.server";
import { html } from "../lib/boat-marketplace.server";
import { cleanServiceBookInput } from "../servicebook.server";
import {
  boatName,
  customerFirstName,
  customerGid,
  ownedBoats,
  previewAllowed,
  productsForBoat,
  serviceEntriesFor,
} from "../lib/wetter-app.server";

const APP_PATH = "/apps/bootmarkt/app";
const ASSET_VERSION = "11";

function assetBase() {
  return `${(process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "")}/wetter-app`;
}

function page(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// JSON veilig in een <script>-tag zetten.
function embed(data: unknown) {
  return JSON.stringify(data)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll(String.fromCharCode(0x2028), "\\u2028")
    .replaceAll(String.fromCharCode(0x2029), "\\u2029");
}

function shell(title: string, inner: string, state?: unknown) {
  const base = assetBase();
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0B2E4A">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="WetterWinkel">
<title>${html(title)}</title>
<link rel="manifest" href="${APP_PATH}/manifest.webmanifest">
<link rel="apple-touch-icon" href="${base}/icon-180.png?v=${ASSET_VERSION}">
<link rel="icon" type="image/png" href="${base}/icon-192.png?v=${ASSET_VERSION}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap">
<link rel="stylesheet" href="${base}/app.css?v=${ASSET_VERSION}">
</head>
<body>
${inner}
${state ? `<script id="ww-state" type="application/json">${embed(state)}</script>
<script src="${base}/app.js?v=${ASSET_VERSION}" defer></script>` : ""}
</body>
</html>`;
}

function loginPage() {
  const loginUrl = `/account/login?return_url=${encodeURIComponent(APP_PATH)}`;
  return shell(
    "WetterWinkel",
    `<main class="ww-login">
  <div class="ww-wordmark">WetterWinkel</div>
  <h1>Welkom aan boord</h1>
  <p>Log in met je WetterWinkel-account om je boot, Captain AI en je serviceboek te gebruiken.</p>
  <a class="ww-btn ww-btn-primary" href="${loginUrl}">Inloggen</a>
  <a class="ww-btn ww-btn-ghost" href="/">Naar de webshop</a>
</main>`,
  );
}

function comingSoonPage() {
  return shell(
    "WetterWinkel-app – binnenkort",
    `<main class="ww-login">
  <div class="ww-wordmark">WetterWinkel</div>
  <h1>We bouwen hier een app voor maximaal watersportplezier</h1>
  <p>Binnenkort beschikbaar. Tot die tijd vind je alles in onze webshop.</p>
  <a class="ww-btn ww-btn-primary" href="/">Naar de webshop</a>
</main>`,
  );
}

async function context(request: Request) {
  await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const shop = String(url.searchParams.get("shop") || "").trim();
  const rawCustomerId = String(url.searchParams.get("logged_in_customer_id") || "").trim();
  if (!shop) throw new Error("Shop ontbreekt in de beveiligde aanvraag.");
  return { url, shop, rawCustomerId };
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { url, shop, rawCustomerId } = await context(request);
    // Testfase: niet ingelogd of niet op de lijst = "binnenkort"-pagina.
    // Geen toegang tot gegevens of functies.
    // Pas als de app voor iedereen open staat (APP_PREVIEW_CUSTOMER_IDS=*)
    // krijgen niet-ingelogde bezoekers een inlogscherm.
    if (!rawCustomerId && process.env.APP_PREVIEW_CUSTOMER_IDS === "*") return page(loginPage());
    if (!rawCustomerId || !previewAllowed(rawCustomerId)) return page(comingSoonPage());

    const { admin } = await unauthenticated.admin(shop);
    const customerId = customerGid(rawCustomerId);
    const [boats, firstName] = await Promise.all([
      ownedBoats(admin, customerId),
      customerFirstName(admin, customerId).catch(() => ""),
    ]);
    const wanted = url.searchParams.get("boot");
    const boat = boats.find((item) => item.id === wanted) || boats[0] || null;
    const [entries, products] = await Promise.all([
      boat ? serviceEntriesFor(shop, customerId, boat.id) : Promise.resolve([]),
      productsForBoat(admin, boat).catch((error) => {
        console.warn("WetterWinkel-app: producten laden mislukt", error);
        return [];
      }),
    ]);

    const state = {
      appPath: APP_PATH,
      iconUrl: `${assetBase()}/icon-192.png`,
      assetBase: assetBase(),
      firstName,
      boats: boats.map((item) => ({ id: item.id, name: boatName(item), data: item.data })),
      boatId: boat?.id || "",
      products,
      entries,
      profileUrl: "/customer_authentication/redirect?locale=nl&region_country=NL",
    };
    return page(shell("WetterWinkel", `<div id="ww-app"></div>`, state));
  } catch (error: any) {
    console.error("WetterWinkel-app laden mislukt", error);
    return page(
      shell(
        "WetterWinkel",
        `<main class="ww-login"><h1>Even geen verbinding</h1><p>De app kon niet worden geladen. Probeer het zo opnieuw.</p><a class="ww-btn ww-btn-primary" href="${APP_PATH}">Opnieuw proberen</a></main>`,
      ),
      500,
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { shop, rawCustomerId } = await context(request);
    if (!rawCustomerId || !previewAllowed(rawCustomerId)) return json({ success: false }, 404);

    const { admin } = await unauthenticated.admin(shop);
    const customerId = customerGid(rawCustomerId);
    const body = await request.json();
    const boats = await ownedBoats(admin, customerId);
    const boat = boats.find((item) => item.id === String(body.profileId || ""));
    if (!boat) return json({ success: false, message: "Bootprofiel niet gevonden." }, 404);

    if (body.intent === "service_create") {
      const data = cleanServiceBookInput(body.entry);
      await prisma.serviceBookEntry.create({
        data: { shop, customerId, profileId: boat.id, attachments: [], ...data },
      });
      return json({
        success: true,
        message: "Opgeslagen in je serviceboek.",
        entries: await serviceEntriesFor(shop, customerId, boat.id),
      });
    }

    if (body.intent === "service_list") {
      return json({ success: true, entries: await serviceEntriesFor(shop, customerId, boat.id) });
    }

    return json({ success: false, message: "Onbekende actie." }, 400);
  } catch (error: any) {
    console.error("WetterWinkel-app actie mislukt", error);
    return json({ success: false, message: error?.message || "Er ging iets mis." }, 400);
  }
}
