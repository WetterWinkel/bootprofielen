/* eslint-disable @typescript-eslint/no-explicit-any */
// Victron-koppeling (VRM) voor de WetterWinkel-app.
// GET  www.wetterwinkel.nl/apps/bootmarkt/app/victron            → status + actuele waarden
// POST { intent: "connect", token } | { intent: "site", siteId } | { intent: "disconnect" }
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "../shopify.server";
import { customerGid, previewAllowed } from "../lib/wetter-app.server";
import { readLink, saveLink, vrmInstallations, vrmMe, vrmSnapshot } from "../lib/victron.server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function context(request: Request) {
  await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const shop = String(url.searchParams.get("shop") || "").trim();
  const rawCustomerId = String(url.searchParams.get("logged_in_customer_id") || "").trim();
  if (!shop || !rawCustomerId || !previewAllowed(rawCustomerId)) return null;
  const { admin } = await unauthenticated.admin(shop);
  return { admin, customerId: customerGid(rawCustomerId) };
}

// Korte cache zodat snel wisselen tussen tabbladen VRM niet belast.
const cache = new Map<string, { at: number; data: any }>();

async function status(admin: any, customerId: string, fresh = false) {
  const link = await readLink(admin, customerId);
  if (!link) return { success: true, connected: false };
  const key = `${customerId}:${link.siteId}`;
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < 60000) return hit.data;
  const sites = await vrmInstallations(link.token, link.idUser);
  const siteId = link.siteId && sites.some((s: any) => s.idSite === link.siteId) ? link.siteId : sites[0]?.idSite ?? null;
  const data: any = { success: true, connected: true, name: link.name, sites, siteId, snapshot: null };
  if (siteId) data.snapshot = await vrmSnapshot(link.token, siteId);
  cache.set(key, { at: Date.now(), data });
  return data;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const ctx = await context(request);
    if (!ctx) return json({ success: false }, 404);
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";
    return json(await status(ctx.admin, ctx.customerId, fresh));
  } catch (error: any) {
    console.error("WetterWinkel-app victron mislukt", error?.message || error);
    return json({ success: false, connected: true, message: error?.message || "Victron is nu niet bereikbaar." }, error?.status === 401 ? 401 : 502);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const ctx = await context(request);
    if (!ctx) return json({ success: false }, 404);
    const body = await request.json().catch(() => ({}));
    if (body.intent === "connect") {
      const token = String(body.token || "").trim().replace(/^(Token|Bearer)\s+/i, "");
      if (token.length < 20 || token.length > 2000 || /\s/.test(token)) return json({ success: false, message: "Dit lijkt geen geldig VRM-toegangstoken." }, 400);
      const me = await vrmMe(token);
      if (!me.idUser) return json({ success: false, message: "Victron gaf geen gebruiker terug." }, 400);
      const sites = await vrmInstallations(token, me.idUser);
      await saveLink(ctx.admin, ctx.customerId, { token, idUser: me.idUser, name: me.name, siteId: sites[0]?.idSite ?? null });
      for (const k of cache.keys()) if (k.startsWith(ctx.customerId)) cache.delete(k);
      return json({ ...(await status(ctx.admin, ctx.customerId, true)), message: "Victron gekoppeld." });
    }
    if (body.intent === "site") {
      const link = await readLink(ctx.admin, ctx.customerId);
      if (!link) return json({ success: false, message: "Niet gekoppeld." }, 400);
      await saveLink(ctx.admin, ctx.customerId, { ...link, siteId: Number(body.siteId) || null });
      return json(await status(ctx.admin, ctx.customerId, true));
    }
    if (body.intent === "disconnect") {
      await saveLink(ctx.admin, ctx.customerId, null);
      for (const k of cache.keys()) if (k.startsWith(ctx.customerId)) cache.delete(k);
      return json({ success: true, connected: false, message: "Victron ontkoppeld. Trek het token ook in VRM in." });
    }
    return json({ success: false, message: "Onbekende actie." }, 400);
  } catch (error: any) {
    console.error("WetterWinkel-app victron-actie mislukt", error?.message || error);
    return json({ success: false, message: error?.message || "Koppelen lukt nu niet." }, 400);
  }
}
