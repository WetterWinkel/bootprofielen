/* eslint-disable @typescript-eslint/no-explicit-any */
import type {ActionFunctionArgs, LoaderFunctionArgs} from "react-router";
import {expireListings, html, nl2br, publicListing} from "../lib/boat-marketplace.server";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";

const labels: Record<string, string> = {
  naam_schip: "Naam schip", merk_boot: "Merk", model_boot: "Model", bouwjaar_boot: "Bouwjaar",
  boottype: "Boottype", materiaal_romp: "Materiaal romp", lengte: "Lengte (cm)", breedte: "Breedte (cm)",
  diepgang: "Diepgang (cm)", doorvaarthoogte: "Doorvaarthoogte (cm)", waterverplaatsing: "Waterverplaatsing (kg)",
  brandstof: "Brandstof", soort_motor: "Soort motor", motormerk: "Motormerk", motormodel: "Motormodel",
  bouwjaar_motor: "Bouwjaar motor", aantal_motoren: "Aantal motoren", motorvermogen: "Totaal vermogen (pk)",
};

const vatLabels: Record<string, string> = {
  PARTICULIER_GEEN_BTW: "Particuliere verkoop – geen btw van toepassing",
  INCLUSIEF_BTW: "Vraagprijs inclusief btw",
  EXCLUSIEF_BTW: "Vraagprijs exclusief btw",
  MARGEREGELING: "Margeregeling",
  ONBEKEND: "Btw-status niet vastgesteld",
};

const styles = `<style>
  .ww-detail{max-width:1180px;margin:0 auto;padding:32px 20px 70px;font-family:inherit;color:#17324f}.ww-back{display:inline-block;margin-bottom:20px;color:#076cc2;text-decoration:none}
  .ww-detail-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(300px,.8fr);gap:30px}.ww-gallery-main{aspect-ratio:4/3;border-radius:18px;overflow:hidden;background:#edf3f7}.ww-gallery-main img{width:100%;height:100%;object-fit:cover}
  .ww-thumbs{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:10px}.ww-thumbs img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px}.ww-panel{border:1px solid #dce5ec;border-radius:18px;padding:24px;background:#fff;box-shadow:0 8px 24px rgba(23,49,76,.07)}
  .ww-panel h1{font-size:clamp(28px,4vw,44px);line-height:1.05;color:#073d82;margin:0 0 10px}.ww-price{font-size:30px;font-weight:800;color:#082d58;margin:12px 0}.ww-muted{color:#60758b}.ww-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 20px;margin:28px 0}.ww-fact{display:flex;justify-content:space-between;gap:20px;padding:11px 0;border-bottom:1px solid #e6edf2}.ww-fact span:first-child{color:#617589}.ww-section{margin-top:30px}.ww-section h2{color:#0a3a70}.ww-copy{line-height:1.65}.ww-notice{background:#f4f9fd;border:1px solid #d5e7f3;border-radius:12px;padding:15px;line-height:1.5}
  .ww-form{display:grid;gap:12px}.ww-form input,.ww-form textarea,.ww-form select{width:100%;box-sizing:border-box;border:1px solid #b7c7d4;border-radius:9px;padding:12px;font:inherit}.ww-form textarea{min-height:130px}.ww-form button{border:0;border-radius:10px;padding:12px 16px;background:#0671ce;color:#fff;font:inherit;font-weight:700;cursor:pointer}.ww-report{margin-top:18px}.ww-report summary{cursor:pointer;color:#5c6f80}.ww-success{background:#eaf8ef;color:#176a36;padding:12px;border-radius:10px;margin-bottom:14px}
  @media(max-width:800px){.ww-detail-grid{grid-template-columns:1fr}.ww-facts{grid-template-columns:1fr}.ww-thumbs{grid-template-columns:repeat(4,1fr)}}
</style>`;

async function currentListing(shop: string, slug: string) {
  await expireListings(shop);
  return prisma.boatListing.findFirst({
    where: {shop, slug, status: "ACTIVE", expiresAt: {gt: new Date()}},
  });
}

export async function loader({request, params}: LoaderFunctionArgs) {
  const {liquid} = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const shop = String(url.searchParams.get("shop") ?? "");
  const listing = await currentListing(shop, String(params.slug ?? ""));
  if (!listing) return liquid(`<main style="max-width:900px;margin:60px auto;padding:20px"><h1>Advertentie niet gevonden</h1><p>Deze advertentie is verlopen, verkocht of niet meer beschikbaar.</p><a href="/apps/bootmarkt">Terug naar de Bootmarkt</a></main>`, 404);
  const item = publicListing(listing);
  const data: any = item.publicData || {};
  const profile = data.profile || {};
  const mainPhoto = item.coverPhotoUrl || item.photos[0]?.url;
  const sent = url.searchParams.get("sent");

  return liquid(`${styles}<main class="ww-detail">
    <a class="ww-back" href="/apps/bootmarkt">← Terug naar de Bootmarkt</a>
    <div class="ww-detail-grid">
      <div>
        <div class="ww-gallery-main">${mainPhoto ? `<img src="${html(mainPhoto)}" alt="${html(item.title)}">` : "Geen foto"}</div>
        ${item.photos.length > 1 ? `<div class="ww-thumbs">${item.photos.slice(0, 20).map((photo) => `<img src="${html(photo.url)}" alt="${html(photo.alt)}" loading="lazy">`).join("")}</div>` : ""}
        <section class="ww-section"><h2>Over deze boot</h2><div class="ww-copy">${nl2br(item.description)}</div></section>
        <section class="ww-section"><h2>Specificaties</h2><div class="ww-facts">${Object.entries(profile).map(([key, value]) => `<div class="ww-fact"><span>${html(labels[key] || key)}</span><strong>${html(value)}</strong></div>`).join("")}</div></section>
        ${data.includedEquipment ? `<section class="ww-section"><h2>Inbegrepen uitrusting</h2><div class="ww-copy">${nl2br(data.includedEquipment)}</div></section>` : ""}
        ${data.knownDefects ? `<section class="ww-section"><h2>Bekende gebreken en aandachtspunten</h2><div class="ww-copy">${nl2br(data.knownDefects)}</div></section>` : ""}
      </div>
      <aside>
        <div class="ww-panel">
          <h1>${html(item.title)}</h1><p class="ww-muted">${html(item.location)}</p><p class="ww-price">${html(item.priceLabel)}</p>
          <p>${html(vatLabels[item.vatStatus] || item.vatStatus)}</p>
          <div class="ww-facts">
            <div class="ww-fact"><span>Verkoper</span><strong>${item.sellerType === "ZAKELIJK" ? "Zakelijk" : "Particulier"}</strong></div>
            <div class="ww-fact"><span>CE-status</span><strong>${html(data.ceStatus || "Niet opgegeven")}</strong></div>
            <div class="ww-fact"><span>Kadaster</span><strong>${data.kadasterRegistered ? "Teboekgesteld" : "Niet opgegeven / niet teboekgesteld"}</strong></div>
            <div class="ww-fact"><span>RDW</span><strong>${data.rdwRegistered ? "Geregistreerd" : "Niet opgegeven / niet geregistreerd"}</strong></div>
          </div>
          <div class="ww-notice">WetterWinkel biedt alleen advertentieruimte en is geen partij bij de verkoop. Laat de boot, identiteit, eigendom, btw-status en documenten altijd zelf controleren. Bij een Kadaster-teboekgestelde boot is voor de juridische overdracht een notariële akte nodig.</div>
        </div>
        <div class="ww-panel ww-section">
          <h2>Contact met de verkoper</h2>${sent === "contact" ? `<div class="ww-success">Uw bericht is veilig opgeslagen voor de verkoper.</div>` : ""}
          <form class="ww-form" method="post" action="/apps/bootmarkt/${html(item.slug)}">
            <input type="hidden" name="intent" value="contact"><label>Naam<input required name="name" maxlength="100"></label><label>E-mailadres<input required type="email" name="email" maxlength="160"></label><label>Telefoonnummer (optioneel)<input name="phone" maxlength="40"></label><label>Bericht<textarea required name="message" maxlength="3000"></textarea></label><button type="submit">Bericht versturen</button>
          </form>
          <details class="ww-report"><summary>Advertentie melden</summary>${sent === "report" ? `<div class="ww-success">Bedankt. WetterWinkel controleert uw melding.</div>` : ""}<form class="ww-form" method="post" action="/apps/bootmarkt/${html(item.slug)}"><input type="hidden" name="intent" value="report"><label>Naam<input required name="name" maxlength="100"></label><label>E-mailadres<input required type="email" name="email" maxlength="160"></label><label>Reden<select name="reason"><option>Mogelijke fraude</option><option>Onjuiste informatie</option><option>Boot is niet beschikbaar</option><option>Ongepaste inhoud</option><option>Anders</option></select></label><label>Toelichting<textarea required name="details" maxlength="2000"></textarea></label><label><input required type="checkbox" name="truthful" value="yes"> Ik verklaar dat deze melding naar waarheid en te goeder trouw is gedaan.</label><button type="submit">Melding versturen</button></form></details>
        </div>
      </aside>
    </div>
  </main>`, {headers: {"Cache-Control": "public, max-age=30"}});
}

function field(form: FormData, name: string, max: number) {
  return String(form.get(name) ?? "").trim().slice(0, max);
}

export async function action({request, params}: ActionFunctionArgs) {
  await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const shop = String(url.searchParams.get("shop") ?? "");
  const slug = String(params.slug ?? "");
  const listing = await currentListing(shop, slug);
  if (!listing) return new Response("Advertentie niet gevonden", {status: 404});
  const form = await request.formData();
  const intent = field(form, "intent", 20);
  const name = field(form, "name", 100);
  const email = field(form, "email", 160).toLowerCase();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return new Response("Controleer naam en e-mailadres", {status: 400});
  const since = new Date(Date.now() - 60 * 60 * 1000);

  if (intent === "contact") {
    const message = field(form, "message", 3000);
    if (message.length < 10) return new Response("Vul een duidelijk bericht in", {status: 400});
    const recent = await prisma.boatListingInquiry.count({where: {listingId: listing.id, email, createdAt: {gte: since}}});
    if (recent >= 3) return new Response("U hebt recent al meerdere berichten gestuurd", {status: 429});
    await prisma.boatListingInquiry.create({data: {listingId: listing.id, name, email, phone: field(form, "phone", 40) || null, message}});
    return new Response(null, {status: 303, headers: {Location: `/apps/bootmarkt/${slug}?sent=contact`}});
  }

  if (intent === "report") {
    const details = field(form, "details", 2000);
    if (details.length < 10) return new Response("Licht de melding duidelijk toe", {status: 400});
    if (field(form, "truthful", 10) !== "yes") return new Response("Bevestig dat de melding naar waarheid is gedaan", {status: 400});
    const recent = await prisma.boatListingReport.count({where: {listingId: listing.id, email, createdAt: {gte: since}}});
    if (recent >= 2) return new Response("Deze advertentie is al door u gemeld", {status: 429});
    await prisma.boatListingReport.create({data: {listingId: listing.id, name, email, reason: field(form, "reason", 80), details}});
    return new Response(null, {status: 303, headers: {Location: `/apps/bootmarkt/${slug}?sent=report`}});
  }

  return new Response("Onbekende actie", {status: 400});
}
