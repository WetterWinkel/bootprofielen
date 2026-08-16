/* eslint-disable @typescript-eslint/no-explicit-any */
import {useEffect, useRef} from "react";
import type {ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs} from "react-router";
import {useFetcher, useLoaderData, useRevalidator} from "react-router";
import {useAppBridge} from "@shopify/app-bridge-react";
import {boundary} from "@shopify/shopify-app-react-router/server";
import {expireListings, LISTING_DAYS, listingPhotos} from "../lib/boat-marketplace.server";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  AWAITING_PAYMENT: "Wacht op betaling",
  PENDING_REVIEW: "Controleren",
  ACTIVE: "Online",
  REJECTED: "Afgekeurd",
  SOLD: "Verkocht",
  EXPIRED: "Verlopen",
};

function mapped(listing: any) {
  return {
    id: listing.id,
    customerId: listing.customerId,
    title: listing.title,
    slug: listing.slug,
    status: listing.status,
    statusLabel: STATUS_LABELS[listing.status] || listing.status,
    description: listing.description,
    price: new Intl.NumberFormat("nl-NL", {style: "currency", currency: "EUR"}).format(listing.priceCents / 100),
    sellerType: listing.sellerType,
    vatStatus: listing.vatStatus,
    location: listing.location,
    coverPhotoUrl: listing.coverPhotoUrl || listingPhotos(listing.photos).find((photo) => photo.url)?.url || null,
    photos: listingPhotos(listing.photos).filter((photo) => photo.url),
    publicData: listing.publicData,
    paidAt: listing.paidAt?.toISOString() ?? null,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    expiresAt: listing.expiresAt?.toISOString() ?? null,
    rejectionReason: listing.rejectionReason,
    inquiryCount: listing._count?.inquiries ?? 0,
    reportCount: listing._count?.reports ?? 0,
  };
}

export const loader = async ({request}: LoaderFunctionArgs) => {
  const {session} = await authenticate.admin(request);
  await expireListings(session.shop);
  const listings = await prisma.boatListing.findMany({
    where: {shop: session.shop},
    orderBy: [{status: "asc"}, {updatedAt: "desc"}],
    include: {_count: {select: {inquiries: true, reports: {where: {resolvedAt: null}}}}},
  });
  const reports = await prisma.boatListingReport.findMany({
    where: {resolvedAt: null, listing: {shop: session.shop}},
    orderBy: {createdAt: "desc"},
    take: 50,
    include: {listing: {select: {title: true, slug: true}}},
  });
  return {
    listings: listings.map(mapped),
    reports: reports.map((report) => ({...report, createdAt: report.createdAt.toISOString()})),
    publicBaseUrl: `${process.env.PUBLIC_STORE_URL || "https://www.wetterwinkel.nl"}/apps/bootmarkt`,
  };
};

export const action = async ({request}: ActionFunctionArgs) => {
  const {session} = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const id = String(form.get("id") ?? "");

  if (intent === "approve") {
    const listing = await prisma.boatListing.findFirst({where: {id, shop: session.shop}});
    if (!listing || listing.status !== "PENDING_REVIEW") {
      return {success: false, message: "Deze advertentie staat niet klaar voor controle."};
    }
    const publishedAt = new Date();
    const expiresAt = new Date(publishedAt.getTime() + LISTING_DAYS * 24 * 60 * 60 * 1000);
    await prisma.boatListing.update({
      where: {id},
      data: {status: "ACTIVE", publishedAt, expiresAt, rejectionReason: null},
    });
    return {success: true, message: `Advertentie goedgekeurd en ${LISTING_DAYS} kalenderdagen online gezet.`};
  }

  if (intent === "reject") {
    const reason = String(form.get("reason") ?? "").trim().slice(0, 500);
    if (!reason) return {success: false, message: "Vul een reden voor afkeuring in."};
    const result = await prisma.boatListing.updateMany({
      where: {id, shop: session.shop, status: "PENDING_REVIEW"},
      data: {status: "REJECTED", rejectionReason: reason},
    });
    return result.count
      ? {success: true, message: "Advertentie afgekeurd. De klant kan deze aanpassen."}
      : {success: false, message: "Advertentie niet gevonden."};
  }

  if (intent === "unpublish") {
    const reason = String(form.get("reason") ?? "Ingetrokken door WetterWinkel").trim().slice(0, 500);
    const result = await prisma.boatListing.updateMany({
      where: {id, shop: session.shop, status: "ACTIVE"},
      data: {status: "REJECTED", rejectionReason: reason},
    });
    return result.count
      ? {success: true, message: "Advertentie is direct van de website verwijderd."}
      : {success: false, message: "Advertentie niet gevonden."};
  }

  if (intent === "resolve_report") {
    await prisma.boatListingReport.updateMany({
      where: {id, listing: {shop: session.shop}},
      data: {resolvedAt: new Date()},
    });
    return {success: true, message: "Melding afgehandeld."};
  }

  return {success: false, message: "Onbekende actie."};
};

export default function BootmarktAdmin() {
  const {listings, reports, publicBaseUrl} = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const handled = useRef("");

  useEffect(() => {
    const message = fetcher.data?.message || "";
    if (fetcher.state === "idle" && message && message !== handled.current) {
      handled.current = message;
      if (fetcher.data?.success) revalidator.revalidate();
      shopify.toast.show(message);
    }
  }, [fetcher.data, fetcher.state, revalidator, shopify]);

  const pending = listings.filter((listing) => listing.status === "PENDING_REVIEW");
  const active = listings.filter((listing) => listing.status === "ACTIVE");

  return (
    <s-page heading="WetterWinkel Bootmarkt">
      <s-section heading="Overzicht">
        <s-stack direction="block" gap="base">
          <s-text>Plaatsing is gratis. Na goedkeuring staat een advertentie 30 kalenderdagen online.</s-text>
          <s-text>Te controleren: {pending.length}</s-text>
          <s-text>Nu online: {active.length}</s-text>
          <s-link href={publicBaseUrl} target="_blank">Open de openbare Bootmarkt</s-link>
        </s-stack>
      </s-section>

      <s-section heading="Advertenties controleren">
        <s-stack direction="block" gap="base">
          {pending.length === 0 && <s-text>Er staan geen advertenties te wachten op controle.</s-text>}
          {pending.map((listing) => (
            <s-box key={listing.id} padding="base" border="base" borderRadius="base">
              <s-stack direction="block" gap="small-300">
                <s-heading>{listing.title}</s-heading>
                {listing.photos.map((photo, index) => photo.url && <s-image key={`${photo.url}-${index}`} src={photo.url} alt={photo.alt || listing.title} aspectRatio="16/9" />)}
                <s-text>{listing.price} · {listing.location} · {listing.sellerType} · {listing.vatStatus}</s-text>
                <s-text>Klant: {listing.customerId}</s-text>
                <s-paragraph>{listing.description}</s-paragraph>
                <s-text>Staat: {String((listing.publicData as any)?.condition || "Niet opgegeven")}</s-text>
                <s-text>Uitrusting: {String((listing.publicData as any)?.includedEquipment || "Niet opgegeven")}</s-text>
                <s-text>Bekende gebreken: {String((listing.publicData as any)?.knownDefects || "Niet opgegeven")}</s-text>
                <s-text>CE: {String((listing.publicData as any)?.ceStatus || "Onbekend")} {String((listing.publicData as any)?.ceCategory || "")}</s-text>
                <s-text>Kadaster: {(listing.publicData as any)?.kadasterRegistered ? "Ja" : "Nee / niet opgegeven"} · RDW: {(listing.publicData as any)?.rdwRegistered ? "Ja" : "Nee / niet opgegeven"}</s-text>
                <s-text>Eigendom bevestigd: {(listing.publicData as any)?.ownershipConfirmed ? "Ja" : "Nee"} · voorwaarden geaccepteerd: {(listing.publicData as any)?.termsAccepted ? "Ja" : "Nee"}</s-text>
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="approve" />
                  <input type="hidden" name="id" value={listing.id} />
                  <s-button type="submit" variant="primary">Goedkeuren en 30 dagen publiceren</s-button>
                </fetcher.Form>
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="reject" />
                  <input type="hidden" name="id" value={listing.id} />
                  <s-text-field name="reason" label="Reden voor aanpassing" />
                  <s-button type="submit" tone="critical">Afkeuren</s-button>
                </fetcher.Form>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      </s-section>

      <s-section heading="Actieve advertenties">
        <s-stack direction="block" gap="base">
          {active.length === 0 && <s-text>Er staan momenteel geen advertenties online.</s-text>}
          {active.map((listing) => (
            <s-box key={listing.id} padding="base" border="base" borderRadius="base">
              <s-stack direction="block" gap="small-300">
                <s-heading>{listing.title}</s-heading>
                <s-text>{listing.price} · online tot {listing.expiresAt ? new Date(listing.expiresAt).toLocaleString("nl-NL") : "onbekend"}</s-text>
                <s-text>{listing.inquiryCount} reacties · {listing.reportCount} open meldingen</s-text>
                <s-link href={`${publicBaseUrl}/${listing.slug}`} target="_blank">Advertentie bekijken</s-link>
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="unpublish" />
                  <input type="hidden" name="id" value={listing.id} />
                  <s-text-field name="reason" label="Reden voor offline halen" />
                  <s-button type="submit" tone="critical">Direct offline halen</s-button>
                </fetcher.Form>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      </s-section>

      <s-section heading="Meldingen over advertenties">
        <s-stack direction="block" gap="base">
          {reports.length === 0 && <s-text>Geen open meldingen.</s-text>}
          {reports.map((report) => (
            <s-box key={report.id} padding="base" border="base" borderRadius="base">
              <s-stack direction="block" gap="small-300">
                <s-heading>{report.listing.title}</s-heading>
                <s-text>{report.reason} · {report.name} ({report.email})</s-text>
                <s-paragraph>{report.details}</s-paragraph>
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="resolve_report" />
                  <input type="hidden" name="id" value={report.id} />
                  <s-button type="submit">Melding afgehandeld</s-button>
                </fetcher.Form>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      </s-section>

      <s-section heading="Veilig advertentiemodel">
        <s-paragraph>
          WetterWinkel verkoopt uitsluitend advertentieruimte. De koopprijs,
          inspectie, juridische eigendomsoverdracht, RDW-overschrijving en een
          eventuele notariële overdracht bij Kadaster-teboekstelling worden
          rechtstreeks door koper en verkoper geregeld.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
