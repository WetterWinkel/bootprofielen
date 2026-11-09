/* eslint-disable @typescript-eslint/no-explicit-any */
// WetterWinkel-app (testversie). Alleen-lezen hulpfuncties; raakt geen
// bestaande routes of databasetabellen aan behalve het serviceboek via de
// bestaande ServiceBookEntry-tabel.
import prisma from "../db.server";
import { serializeServiceBookEntry } from "../servicebook.server";

const METAFIELD_NAMESPACE = "$app";
const METAFIELD_KEY = "bootprofielen";

// Wie de testversie mag zien. Komma-gescheiden numerieke Shopify-klant-id's.
// Standaard alleen Bernard (b.dehoop@icloud.com). Zet APP_PREVIEW_CUSTOMER_IDS=*
// in Render om de app voor iedereen open te zetten.
const DEFAULT_PREVIEW_IDS = "24823426908500";

export function customerGid(value: string) {
  return value.startsWith("gid://shopify/Customer/")
    ? value
    : `gid://shopify/Customer/${value}`;
}

export function previewAllowed(rawCustomerId: string) {
  const setting = (process.env.APP_PREVIEW_CUSTOMER_IDS || DEFAULT_PREVIEW_IDS).trim();
  if (setting === "*") return Boolean(rawCustomerId);
  const id = rawCustomerId.replace("gid://shopify/Customer/", "");
  return setting
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .includes(id);
}

export type AppBoat = { id: string; data: Record<string, any> };

export async function ownedBoats(admin: any, customerId: string): Promise<AppBoat[]> {
  const result = await admin.graphql(
    `#graphql
      query WetterAppBootprofielen($customerId: ID!) {
        customer(id: $customerId) {
          firstName
          metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
            references(first: 50) {
              nodes {
                ... on Metaobject {
                  id
                  fields { key value }
                }
              }
            }
          }
        }
      }
    `,
    { variables: { customerId } },
  );
  const payload: any = await result.json();
  if (payload.errors?.length) throw new Error(payload.errors[0].message);
  return (payload.data?.customer?.metafield?.references?.nodes || []).flatMap(
    (node: any) => {
      const fields = Object.fromEntries(
        (node.fields || []).map((field: any) => [field.key, field.value]),
      );
      if (fields.klant_id !== customerId) return [];
      try {
        return [{ id: node.id, data: JSON.parse(fields.data || "{}") }];
      } catch {
        return [{ id: node.id, data: {} }];
      }
    },
  );
}

export async function customerFirstName(admin: any, customerId: string) {
  const result = await admin.graphql(
    `#graphql
      query WetterAppKlant($customerId: ID!) { customer(id: $customerId) { firstName } }
    `,
    { variables: { customerId } },
  );
  const payload: any = await result.json();
  return String(payload.data?.customer?.firstName || "");
}

export function boatName(boat: AppBoat | null) {
  if (!boat) return "";
  const d = boat.data || {};
  return String(d.naam_schip || [d.merk_boot, d.model_boot].filter(Boolean).join(" ") || "Je boot");
}

export async function serviceEntriesFor(shop: string, customerId: string, profileId: string) {
  const entries = await prisma.serviceBookEntry.findMany({
    where: { shop, customerId, profileId },
    orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  return entries.map((entry) => serializeServiceBookEntry(entry));
}

function searchTermsForBoat(boat: AppBoat | null) {
  const d = boat?.data || {};
  const terms: string[] = [];
  const engine = String(d.motormerk || "").trim();
  if (engine) {
    terms.push(engine);
    // Mercury/Mariner-onderdelen staan in de shop vaak onder Quicksilver.
    if (/mercury|mariner/i.test(engine)) terms.push("Quicksilver");
  }
  const boatBrand = String(d.merk_boot || "").trim();
  if (boatBrand) terms.push(boatBrand);
  return terms.slice(0, 3);
}

function cleanTerm(term: string) {
  return term.replace(/["\\():*]/g, " ").replace(/\s+/g, " ").trim();
}

export async function productsForBoat(admin: any, boat: AppBoat | null) {
  const terms = searchTermsForBoat(boat).map(cleanTerm).filter(Boolean);
  const query = terms.length
    ? `status:active AND (${terms
        .map((term) => `vendor:"${term}" OR title:"${term}" OR tag:"Merk:${term}"`)
        .join(" OR ")})`
    : "status:active AND tag:Bestseller";
  const result = await admin.graphql(
    `#graphql
      query WetterAppProducten($query: String!) {
        products(first: 12, query: $query, sortKey: RELEVANCE) {
          nodes {
            id
            title
            handle
            vendor
            onlineStoreUrl
            featuredMedia { preview { image { url(transform: {maxWidth: 240}) altText } } }
            priceRangeV2 { minVariantPrice { amount } }
            variants(first: 5) { nodes { id availableForSale } }
          }
        }
      }
    `,
    { variables: { query } },
  );
  const payload: any = await result.json();
  if (payload.errors?.length) throw new Error(payload.errors[0].message);
  return (payload.data?.products?.nodes || []).map((product: any) => {
    const variant =
      (product.variants?.nodes || []).find((v: any) => v.availableForSale) ||
      (product.variants?.nodes || [])[0];
    return {
      title: String(product.title || ""),
      vendor: String(product.vendor || ""),
      url: `/products/${product.handle}`,
      image: product.featuredMedia?.preview?.image?.url || "",
      price: Number(product.priceRangeV2?.minVariantPrice?.amount || 0),
      variantId: variant?.id ? String(variant.id).split("/").pop() : "",
    };
  });
}
