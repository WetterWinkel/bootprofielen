import type {LoaderFunctionArgs} from "react-router";
import {expireListings, html, publicListing} from "../lib/boat-marketplace.server";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";

function card(listing: ReturnType<typeof publicListing>) {
  const image = listing.coverPhotoUrl || listing.photos[0]?.url;
  return `
    <article class="ww-market-card">
      <a class="ww-market-image" href="/apps/bootmarkt/${html(listing.slug)}">
        ${image ? `<img src="${html(image)}" alt="${html(listing.title)}" loading="lazy">` : `<span>Geen foto</span>`}
      </a>
      <div class="ww-market-card-body">
        <p class="ww-market-location">${html(listing.location)}</p>
        <h2><a href="/apps/bootmarkt/${html(listing.slug)}">${html(listing.title)}</a></h2>
        <p class="ww-market-price">${html(listing.priceLabel)}</p>
        <a class="ww-market-button" href="/apps/bootmarkt/${html(listing.slug)}">Advertentie bekijken</a>
      </div>
    </article>`;
}

const styles = `
  <style>
    .ww-market{max-width:1280px;margin:0 auto;padding:42px 20px 70px;font-family:inherit;color:#152b4a}
    .ww-market-hero{background:linear-gradient(135deg,#eef8ff,#f4fbff);border:1px solid #d8e9f5;border-radius:22px;padding:34px;margin-bottom:30px}
    .ww-market-hero h1{margin:0 0 8px;font-size:clamp(30px,5vw,52px);line-height:1.05;color:#073d82}
    .ww-market-hero p{max-width:760px;margin:0;font-size:18px;color:#3c5573}
    .ww-market-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
    .ww-market-card{border:1px solid #dce5ec;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 8px 24px rgba(23,49,76,.08)}
    .ww-market-image{display:flex;aspect-ratio:4/3;background:#edf3f7;align-items:center;justify-content:center;color:#718197;overflow:hidden}
    .ww-market-image img{width:100%;height:100%;object-fit:cover;transition:transform .25s ease}
    .ww-market-card:hover img{transform:scale(1.025)}
    .ww-market-card-body{padding:18px}.ww-market-card h2{margin:4px 0 12px;font-size:21px;line-height:1.25}
    .ww-market-card h2 a{color:#0b3769;text-decoration:none}.ww-market-location{margin:0;color:#60758b;font-size:14px}
    .ww-market-price{font-size:23px;font-weight:750;color:#082d58;margin:0 0 16px}.ww-market-button{display:inline-block;background:#0671ce;color:#fff!important;text-decoration:none;padding:11px 16px;border-radius:10px;font-weight:650}
    .ww-market-empty{padding:50px 20px;text-align:center;border:1px dashed #b9cad8;border-radius:18px;color:#53697d}
    @media(max-width:900px){.ww-market-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:600px){.ww-market{padding:24px 14px 50px}.ww-market-grid{grid-template-columns:1fr}.ww-market-hero{padding:24px}}
  </style>`;

export async function loader({request}: LoaderFunctionArgs) {
  const {liquid} = await authenticate.public.appProxy(request);
  const shop = String(new URL(request.url).searchParams.get("shop") ?? "");
  await expireListings(shop);
  const listings = await prisma.boatListing.findMany({
    where: {shop, status: "ACTIVE", expiresAt: {gt: new Date()}},
    orderBy: {publishedAt: "desc"},
    take: 60,
  });
  return liquid(`${styles}
    <main class="ww-market">
      <header class="ww-market-hero">
        <h1>WetterWinkel Bootmarkt</h1>
        <p>Boten aangeboden door watersporters met een WetterWinkel-bootprofiel. WetterWinkel biedt de advertentieruimte; koop, inspectie, betaling en eigendomsoverdracht regelt u rechtstreeks met de verkoper.</p>
      </header>
      ${listings.length
        ? `<section class="ww-market-grid" aria-label="Boten te koop">${listings.map((listing) => card(publicListing(listing))).join("")}</section>`
        : `<div class="ww-market-empty"><h2>Nog geen boten te koop</h2><p>De eerste advertenties verschijnen hier binnenkort.</p></div>`}
    </main>`,
    {headers: {"Cache-Control": "public, max-age=60"}},
  );
}
