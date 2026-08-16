/* eslint-disable @typescript-eslint/no-explicit-any */
import type {ActionFunctionArgs, LoaderFunctionArgs} from "react-router";
import {
  cleanListingInput,
  expireListings,
  listingPhotos,
  listingSlug,
  MAX_LISTING_PHOTOS,
} from "../lib/boat-marketplace.server";
import {
  deleteShopifyImage,
  refreshShopifyImages,
  uploadShopifyImage,
} from "../lib/shopify-images.server";
import prisma from "../db.server";
import {authenticate, unauthenticated} from "../shopify.server";

const PROFILE_NAMESPACE = "$app";
const PROFILE_KEY = "bootprofielen";

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

function customerGid(value: unknown) {
  const id = String(value ?? "");
  if (!id) throw new Error("Geen klant gevonden in het sessietoken");
  return id.startsWith("gid://shopify/Customer/") ? id : `gid://shopify/Customer/${id}`;
}

async function context(request: Request) {
  const {sessionToken, cors} = await authenticate.public.customerAccount(request);
  const destination = String((sessionToken as any).dest ?? "");
  if (!destination) throw new Error("Shop ontbreekt in het sessietoken");
  const shopDomain = new URL(destination.includes("://") ? destination : `https://${destination}`).hostname;
  const {admin} = await unauthenticated.admin(shopDomain);
  return {
    admin,
    cors,
    shopDomain,
    customerId: customerGid((sessionToken as any).sub),
  };
}

async function customerProfiles(admin: any, customerId: string) {
  const result = await admin.graphql(
    `#graphql
      query BootmarktKlantprofielen($customerId: ID!) {
        customer(id: $customerId) {
          metafield(namespace: "${PROFILE_NAMESPACE}", key: "${PROFILE_KEY}") {
            references(first: 100) {
              nodes {
                ... on Metaobject {
                  id
                  fields { key value }
                  photo: field(key: "bootfoto") {
                    value
                    reference {
                      ... on MediaImage { id image { url altText } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    {variables: {customerId}},
  );
  const json: any = await result.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return (json.data?.customer?.metafield?.references?.nodes ?? [])
    .map((node: any) => {
      const fields = Object.fromEntries((node.fields ?? []).map((field: any) => [field.key, field.value]));
      let data = {};
      try { data = JSON.parse(fields.data || "{}"); } catch { data = {}; }
      return {
        id: node.id,
        customerId: fields.klant_id,
        data,
        photo: node.photo?.reference?.image?.url ? {
          id: node.photo.reference.id,
          url: node.photo.reference.image.url,
          alt: node.photo.reference.image.altText || "Boot te koop",
          source: "profile",
        } : null,
      };
    })
    .filter((profile: any) => profile.customerId === customerId);
}

async function refreshListing(admin: any, listing: any) {
  const current = listingPhotos(listing.photos);
  const refreshed = await refreshShopifyImages(admin, current);
  const changed = JSON.stringify(current) !== JSON.stringify(refreshed);
  const coverPhotoUrl = refreshed.find((photo) => photo.url === listing.coverPhotoUrl)?.url
    ?? refreshed.find((photo) => photo.url)?.url
    ?? null;
  if (changed || coverPhotoUrl !== listing.coverPhotoUrl) {
    return prisma.boatListing.update({
      where: {id: listing.id},
      data: {photos: refreshed as any, coverPhotoUrl},
      include: {inquiries: {orderBy: {createdAt: "desc"}, take: 20}},
    });
  }
  return listing;
}

function ownerListing(listing: any) {
  return {
    id: listing.id,
    profileId: listing.profileId,
    slug: listing.slug,
    status: listing.status,
    title: listing.title,
    description: listing.description,
    price: (listing.priceCents / 100).toFixed(2).replace(".", ","),
    sellerType: listing.sellerType,
    vatStatus: listing.vatStatus,
    location: listing.location,
    publicData: listing.publicData,
    photos: listingPhotos(listing.photos),
    coverPhotoUrl: listing.coverPhotoUrl,
    publishedAt: listing.publishedAt,
    expiresAt: listing.expiresAt,
    paidAt: listing.paidAt,
    rejectionReason: listing.rejectionReason,
    inquiries: listing.inquiries ?? [],
  };
}

async function reconcileCheckout(admin: any, listing: any) {
  if (listing.status !== "AWAITING_PAYMENT" || !listing.draftOrderId) return listing;
  try {
    const result = await admin.graphql(
      `#graphql
        query ControleerBootadvertentieBetaling($id: ID!) {
          node(id: $id) {
            ... on DraftOrder { id status order { id } }
          }
        }
      `,
      {variables: {id: listing.draftOrderId}},
    );
    const json: any = await result.json();
    const draft = json.data?.node;
    if (draft?.status !== "COMPLETED") return listing;
    return prisma.boatListing.update({
      where: {id: listing.id},
      data: {
        status: "PENDING_REVIEW",
        paidAt: listing.paidAt || new Date(),
        paidOrderId: listing.paidOrderId || draft.order?.id || null,
      },
      include: {inquiries: {orderBy: {createdAt: "desc"}, take: 20}},
    });
  } catch (error) {
    console.warn("Bootadvertentiebetaling controleren mislukt", error);
    return listing;
  }
}

export async function loader({request}: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") return response({success: true});
  try {
    const {admin, cors, customerId, shopDomain} = await context(request);
    await expireListings(shopDomain);
    const profiles = await customerProfiles(admin, customerId);
    const listings = await prisma.boatListing.findMany({
      where: {shop: shopDomain, customerId},
      orderBy: {updatedAt: "desc"},
      include: {inquiries: {orderBy: {createdAt: "desc"}, take: 20}},
    });
    const reconciled = await Promise.all(listings.map((listing) => reconcileCheckout(admin, listing)));
    const refreshed = await Promise.all(reconciled.map((listing) => refreshListing(admin, listing)));
    return cors(response({
      success: true,
      price: "Gratis",
      durationDays: 30,
      profiles: profiles.map((profile: any) => ({id: profile.id, data: profile.data, photo: profile.photo})),
      listings: refreshed.map(ownerListing),
    }));
  } catch (error: any) {
    console.error("Bootadvertenties ophalen mislukt", error);
    return response({success: false, message: error?.message ?? "Ophalen mislukt"}, 500);
  }
}

export async function action({request}: ActionFunctionArgs) {
  if (request.method === "OPTIONS") return response({success: true});
  try {
    const {admin, cors, customerId, shopDomain} = await context(request);
    await expireListings(shopDomain);
    const body = await request.json();
    const intent = String(body.intent ?? "");
    const profiles = await customerProfiles(admin, customerId);

    if (intent === "save_draft") {
      const profile = profiles.find((item: any) => item.id === String(body.profileId ?? ""));
      if (!profile) return cors(response({success: false, message: "Bootprofiel niet gevonden"}, 404));
      const clean = cleanListingInput(body.listing, profile.data);
      const existing = body.id ? await prisma.boatListing.findFirst({
        where: {id: String(body.id), shop: shopDomain, customerId},
      }) : null;
      if (body.id && !existing) return cors(response({success: false, message: "Advertentie niet gevonden"}, 404));
      if (existing && ["PENDING_REVIEW", "ACTIVE"].includes(existing.status)) {
        return cors(response({success: false, message: "Een betaalde of actieve advertentie kan niet meer worden gewijzigd"}, 409));
      }

      const photos = existing ? listingPhotos(existing.photos) : (profile.photo ? [profile.photo] : []);
      const termsAccepted = Boolean((clean.publicData as any).termsAccepted && (clean.publicData as any).ownershipConfirmed);
      const data = {
        ...clean,
        shop: shopDomain,
        customerId,
        profileId: profile.id,
        photos: photos as any,
        coverPhotoUrl: existing?.coverPhotoUrl || photos.find((photo) => photo.url)?.url || null,
        termsAcceptedAt: termsAccepted ? new Date() : null,
        status: existing && ["EXPIRED", "REJECTED", "SOLD"].includes(existing.status) ? "DRAFT" as const : existing?.status,
        rejectionReason: null,
        ...(existing && ["EXPIRED", "SOLD"].includes(existing.status) ? {
          paymentToken: null,
          draftOrderId: null,
          paidOrderId: null,
          paidAt: null,
          publishedAt: null,
          expiresAt: null,
          soldAt: null,
        } : {}),
      };

      const listing = existing
        ? await prisma.boatListing.update({where: {id: existing.id}, data: data as any})
        : await prisma.boatListing.create({
            data: {...data, status: "DRAFT", slug: listingSlug(clean.title)} as any,
          });
      return cors(response({success: true, message: "Advertentieconcept opgeslagen.", listing: ownerListing(listing)}));
    }

    const listing = await prisma.boatListing.findFirst({
      where: {id: String(body.id ?? ""), shop: shopDomain, customerId},
      include: {inquiries: {orderBy: {createdAt: "desc"}, take: 20}},
    });
    if (!listing) return cors(response({success: false, message: "Advertentie niet gevonden"}, 404));

    if (intent === "upload_photo") {
      if (["PENDING_REVIEW", "ACTIVE"].includes(listing.status)) {
        return cors(response({success: false, message: "Deze advertentie kan nu niet worden gewijzigd"}, 409));
      }
      const photos = listingPhotos(listing.photos);
      if (photos.length >= MAX_LISTING_PHOTOS) {
        return cors(response({success: false, message: "U kunt maximaal 20 foto's toevoegen"}, 400));
      }
      const photo = await uploadShopifyImage(admin, body.photo, listing.title);
      const updatedPhotos = [...photos, photo];
      const updated = await prisma.boatListing.update({
        where: {id: listing.id},
        data: {photos: updatedPhotos as any, coverPhotoUrl: listing.coverPhotoUrl || photo.url},
        include: {inquiries: {orderBy: {createdAt: "desc"}, take: 20}},
      });
      return cors(response({success: true, message: `Foto ${updatedPhotos.length} van 20 opgeslagen.`, listing: ownerListing(updated)}));
    }

    if (intent === "delete_photo") {
      if (["PENDING_REVIEW", "ACTIVE"].includes(listing.status)) {
        return cors(response({success: false, message: "Deze advertentie kan nu niet worden gewijzigd"}, 409));
      }
      const photos = listingPhotos(listing.photos);
      const index = Number(body.index);
      if (!Number.isInteger(index) || !photos[index]) {
        return cors(response({success: false, message: "Foto niet gevonden"}, 404));
      }
      const [removed] = photos.splice(index, 1);
      if (removed.source === "listing") await deleteShopifyImage(admin, removed.id);
      const coverPhotoUrl = listing.coverPhotoUrl === removed.url
        ? photos.find((photo) => photo.url)?.url || null
        : listing.coverPhotoUrl;
      const updated = await prisma.boatListing.update({
        where: {id: listing.id},
        data: {photos: photos as any, coverPhotoUrl},
        include: {inquiries: {orderBy: {createdAt: "desc"}, take: 20}},
      });
      return cors(response({success: true, message: "Foto verwijderd.", listing: ownerListing(updated)}));
    }

    if (intent === "set_cover") {
      const photo = listingPhotos(listing.photos).find((item) => item.url === String(body.url ?? ""));
      if (!photo?.url) return cors(response({success: false, message: "Foto niet gevonden"}, 404));
      const updated = await prisma.boatListing.update({
        where: {id: listing.id},
        data: {coverPhotoUrl: photo.url},
        include: {inquiries: {orderBy: {createdAt: "desc"}, take: 20}},
      });
      return cors(response({success: true, message: "Omslagfoto ingesteld.", listing: ownerListing(updated)}));
    }

    if (intent === "prepare_checkout") {
      const refreshed = await refreshListing(admin, listing);
      const photos = listingPhotos(refreshed.photos).filter((photo) => photo.url);
      if (!photos.length) return cors(response({success: false, message: "Voeg minimaal één advertentiefoto toe"}, 400));
      const publicData: any = listing.publicData;
      if (!listing.termsAcceptedAt || !publicData?.ownershipConfirmed || !publicData?.termsAccepted) {
        return cors(response({success: false, message: "Bevestig het eigendom en de advertentievoorwaarden"}, 400));
      }
      const updated = await prisma.boatListing.update({
        where: {id: listing.id},
        data: {
          status: "PENDING_REVIEW",
          rejectionReason: null,
          paymentToken: null,
          draftOrderId: null,
          paidOrderId: null,
          paidAt: null,
        },
        include: {inquiries: {orderBy: {createdAt: "desc"}, take: 20}},
      });
      return cors(response({
        success: true,
        message: "Uw gratis advertentie staat klaar voor controle door WetterWinkel.",
        listing: ownerListing(updated),
      }));
    }

    if (intent === "mark_sold") {
      if (listing.status !== "ACTIVE") return cors(response({success: false, message: "Alleen een actieve advertentie kan als verkocht worden gemarkeerd"}, 409));
      const updated = await prisma.boatListing.update({
        where: {id: listing.id},
        data: {status: "SOLD", soldAt: new Date()},
        include: {inquiries: {orderBy: {createdAt: "desc"}, take: 20}},
      });
      return cors(response({success: true, message: "De advertentie is gemarkeerd als verkocht en staat niet meer openbaar.", listing: ownerListing(updated)}));
    }

    if (intent === "delete_listing") {
      if (!["DRAFT", "REJECTED", "EXPIRED", "SOLD", "AWAITING_PAYMENT"].includes(listing.status)) {
        return cors(response({success: false, message: "Deze advertentie kan nu niet worden verwijderd"}, 409));
      }
      for (const photo of listingPhotos(listing.photos)) {
        if (photo.source === "listing") {
          try { await deleteShopifyImage(admin, photo.id); } catch (error) { console.warn("Advertentiefoto verwijderen mislukt", error); }
        }
      }
      await prisma.boatListing.delete({where: {id: listing.id}});
      return cors(response({success: true, message: "Advertentie verwijderd."}));
    }

    return cors(response({success: false, message: "Onbekende actie"}, 400));
  } catch (error: any) {
    console.error("========== BOOTADVERTENTIE ERROR ==========", error);
    return response({success: false, message: error?.message ?? "Onbekende fout"}, 500);
  }
}
