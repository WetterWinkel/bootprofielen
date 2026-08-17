/* eslint-disable @typescript-eslint/no-explicit-any */
import {randomBytes} from "node:crypto";
import prisma from "../db.server";

export const LISTING_PRICE_CENTS = 0;
export const LISTING_DAYS = 30;
export const MAX_LISTING_PHOTOS = 20;

export const VAT_STATUSES = [
  "PARTICULIER_GEEN_BTW",
  "INCLUSIEF_BTW",
  "EXCLUSIEF_BTW",
  "MARGEREGELING",
  "ONBEKEND",
] as const;

export const SELLER_TYPES = ["PARTICULIER", "ZAKELIJK"] as const;

export type ListingPhoto = {
  id: string | null;
  url: string | null;
  alt: string;
  source: "listing" | "profile";
};

const PROFILE_FIELDS = [
  "naam_schip",
  "merk_boot",
  "model_boot",
  "bouwjaar_boot",
  "boottype",
  "materiaal_romp",
  "lengte",
  "breedte",
  "diepgang",
  "doorvaarthoogte",
  "waterverplaatsing",
  "brandstof",
  "soort_motor",
  "motormerk",
  "motormodel",
  "bouwjaar_motor",
  "aantal_motoren",
  "motorvermogen",
] as const;

function text(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function boolean(value: unknown) {
  return value === true || value === "true";
}

export function priceCents(value: unknown) {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  const separator = comma > dot ? comma : dot;
  const hasBothSeparators = comma >= 0 && dot >= 0;
  const fractionLength = separator >= 0 ? raw.length - separator - 1 : 0;
  const hasDecimalSeparator = separator >= 0 && (hasBothSeparators || fractionLength <= 2);
  const normalized = hasDecimalSeparator
    ? `${raw.slice(0, separator).replace(/[.,]/g, "")}.${raw.slice(separator + 1).replace(/[.,]/g, "")}`
    : raw.replace(/[.,]/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 1 || amount > 100_000_000) {
    throw new Error("Vul een geldige vraagprijs in");
  }
  return Math.round(amount * 100);
}

export function listingPhotos(value: unknown): ListingPhoto[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((photo) => photo && typeof photo === "object")
    .map((photo: any) => ({
      id: photo.id ? String(photo.id) : null,
      url: photo.url ? String(photo.url) : null,
      alt: text(photo.alt, 160) || "Boot te koop",
      source: photo.source === "profile" ? "profile" as const : "listing" as const,
    }))
    .slice(0, MAX_LISTING_PHOTOS);
}

export function cleanListingInput(input: any, profileData: Record<string, any>) {
  const title = text(input?.title, 100);
  const description = text(input?.description, 5000);
  const location = text(input?.location, 120);
  const sellerType = text(input?.sellerType, 30);
  const vatStatus = text(input?.vatStatus, 40);

  if (title.length < 3) throw new Error("Vul een duidelijke advertentietitel in");
  if (description.length < 30) {
    throw new Error("De advertentieomschrijving moet minimaal 30 tekens bevatten");
  }
  if (!location) throw new Error("Vul de plaats of regio van de boot in");
  if (!(SELLER_TYPES as readonly string[]).includes(sellerType)) {
    throw new Error("Kies of de verkoper particulier of zakelijk is");
  }
  if (!(VAT_STATUSES as readonly string[]).includes(vatStatus)) {
    throw new Error("Kies de btw-status van de boot");
  }

  const profile = Object.fromEntries(
    PROFILE_FIELDS.flatMap((key) => {
      const value = profileData?.[key];
      return value === undefined || value === null || value === ""
        ? []
        : [[key, value]];
    }),
  );

  return {
    title,
    description,
    priceCents: priceCents(input?.price),
    sellerType,
    vatStatus,
    location,
    publicData: {
      profile,
      condition: text(input?.condition, 80),
      knownDefects: text(input?.knownDefects, 2000),
      includedEquipment: text(input?.includedEquipment, 2000),
      ceStatus: text(input?.ceStatus, 40),
      ceCategory: text(input?.ceCategory, 20),
      vatProofAvailable: boolean(input?.vatProofAvailable),
      kadasterRegistered: boolean(input?.kadasterRegistered),
      rdwRegistered: boolean(input?.rdwRegistered),
      ownershipConfirmed: boolean(input?.ownershipConfirmed),
      termsAccepted: boolean(input?.termsAccepted),
    },
  };
}

export function listingSlug(title: string) {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 55) || "boot-te-koop";
  return `${base}-${randomBytes(4).toString("hex")}`;
}

export function paymentToken() {
  return randomBytes(24).toString("base64url");
}

export async function expireListings(shop?: string) {
  const now = new Date();
  await prisma.boatListing.updateMany({
    where: {
      ...(shop ? {shop} : {}),
      status: "ACTIVE",
      expiresAt: {lte: now},
    },
    data: {status: "EXPIRED"},
  });
}

export function listingPriceLabel(cents: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function publicListing(listing: any) {
  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    description: listing.description,
    priceCents: listing.priceCents,
    priceLabel: listingPriceLabel(listing.priceCents),
    sellerType: listing.sellerType,
    vatStatus: listing.vatStatus,
    location: listing.location,
    publicData: listing.publicData,
    photos: listingPhotos(listing.photos).filter((photo) => photo.url),
    coverPhotoUrl: listing.coverPhotoUrl,
    publishedAt: listing.publishedAt,
    expiresAt: listing.expiresAt,
  };
}

export function html(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function nl2br(value: unknown) {
  return html(value).replaceAll("\n", "<br>");
}
