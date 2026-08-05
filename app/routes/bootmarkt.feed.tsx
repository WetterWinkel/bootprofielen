import type {LoaderFunctionArgs} from "react-router";
import {expireListings, publicListing} from "../lib/boat-marketplace.server";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";

export async function loader({request}: LoaderFunctionArgs) {
  await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const shop = String(url.searchParams.get("shop") ?? "");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 6, 1), 24);
  if (!shop) return new Response(JSON.stringify({listings: []}), {status: 400});
  await expireListings(shop);
  const listings = await prisma.boatListing.findMany({
    where: {shop, status: "ACTIVE", expiresAt: {gt: new Date()}},
    orderBy: {publishedAt: "desc"},
    take: limit,
  });
  return new Response(JSON.stringify({listings: listings.map(publicListing)}), {
    headers: {"Content-Type": "application/json", "Cache-Control": "public, max-age=60"},
  });
}
