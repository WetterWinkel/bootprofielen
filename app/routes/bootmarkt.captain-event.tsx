/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

const ALLOWED_EVENTS = new Set([
  "TIP_VIEWED",
  "CAPTAIN_OPENED",
  "SEARCH_USED",
  "PRODUCT_ADDED",
  "PROFILE_CTA_CLICKED",
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function customerGid(value: string) {
  return value.startsWith("gid://shopify/Customer/")
    ? value
    : `gid://shopify/Customer/${value}`;
}

function visitorToken(request: Request) {
  const url = new URL(request.url);
  return String(url.searchParams.get("visitor_id") || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 96);
}

function visitorId(request: Request, shop: string) {
  const url = new URL(request.url);
  const rawCustomerId = String(
    url.searchParams.get("logged_in_customer_id") || "",
  ).trim();
  if (rawCustomerId) return customerGid(rawCustomerId);

  const forwardedFor = String(
    request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "",
  )
    .split(",")[0]
    .trim()
    .slice(0, 120);
  const userAgent = String(request.headers.get("user-agent") || "").slice(0, 300);
  const token = visitorToken(request) || "no-browser-token";
  const fingerprint = createHash("sha256")
    .update(`${shop}|${token}|${forwardedFor}|${userAgent}`)
    .digest("hex")
    .slice(0, 48);
  return `anon:${fingerprint}`;
}

function shortString(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function safeContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, any>;
  const product =
    source.product && typeof source.product === "object"
      ? {
          id: shortString(source.product.id, 100),
          title: shortString(source.product.title, 240),
        }
      : null;
  return {
    pageUrl: shortString(source.url, 600),
    pageType: shortString(source.pageType, 80),
    productId: product?.id || "",
    productTitle: product?.title || "",
  };
}

function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, string | number | boolean> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>).slice(0, 12)) {
    const key = rawKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    if (!key) continue;
    if (typeof rawValue === "boolean" || typeof rawValue === "number") {
      output[key] = rawValue;
    } else if (typeof rawValue === "string") {
      output[key] = rawValue.slice(0, 240);
    }
  }
  return output;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.public.appProxy(request);
  return json({ success: false, message: "Gebruik POST voor Captain events." }, 405);
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    await authenticate.public.appProxy(request);
    const url = new URL(request.url);
    const shop = String(url.searchParams.get("shop") || "").trim();
    if (!shop) return json({ success: false, message: "Shop ontbreekt." }, 400);

    const body = await request.json().catch(() => ({}));
    const event = String(body.event || "").trim().toUpperCase();
    if (!ALLOWED_EVENTS.has(event)) {
      return json({ success: false, message: "Onbekend Captain event." }, 400);
    }

    const context = safeContext(body.context);
    await prisma.captainStorefrontEvent.create({
      data: {
        shop,
        visitorId: visitorId(request, shop),
        event,
        pageUrl: context.pageUrl || null,
        pageType: context.pageType || null,
        productId: context.productId || null,
        productTitle: context.productTitle || null,
        metadata: safeMetadata(body.metadata),
      },
    });

    return json({ success: true });
  } catch (error: any) {
    console.warn("Captain storefront event opslaan mislukt", error);
    return json(
      { success: false, message: "Captain event kon niet worden opgeslagen." },
      500,
    );
  }
}
