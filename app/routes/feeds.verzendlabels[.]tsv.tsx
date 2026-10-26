/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LoaderFunctionArgs } from "react-router";
import { unauthenticated } from "../shopify.server";

// Aanvullende productfeed voor Google Merchant Center:
//   https://bootprofielen.onrender.com/feeds/verzendlabels.tsv
// Kolommen: id (zoals de Shopify Google-app ze aanlevert) en shipping_label.
//   gratis-verzending -> producten met de tag "gratis-verzending"
//   zwaar-pakket      -> producten met de tag "zwaar-pakket" (gaat voor)
// Merchant Center gebruikt shipping_label om per product het juiste
// verzendtarief te tonen (gratis / zwaar pakket).

const SHOP = process.env.FEED_SHOP_DOMAIN || "erjdrq-br.myshopify.com";
const CACHE_MS = 6 * 60 * 60 * 1000;

let cache: { body: string; at: number } | null = null;
let bezig: Promise<string> | null = null;

const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gql(admin: any, query: string, variables?: any) {
  const res = await admin.graphql(query, variables ? { variables } : undefined);
  const json: any = await res.json();
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function bouwFeed(): Promise<string> {
  const { admin } = await unauthenticated.admin(SHOP);

  const start = await gql(
    admin,
    `#graphql
      mutation VerzendlabelsBulk($q: String!) {
        bulkOperationRunQuery(query: $q) {
          bulkOperation { id }
          userErrors { message }
        }
      }`,
    {
      q: `{ products(query: "tag:gratis-verzending OR tag:zwaar-pakket") { edges { node { id tags variants { edges { node { id } } } } } } }`,
    },
  );
  const fout = start.bulkOperationRunQuery.userErrors?.[0]?.message;
  if (fout) throw new Error(fout);
  const opId = start.bulkOperationRunQuery.bulkOperation.id;

  let url: string | null = null;
  for (let i = 0; i < 120; i++) {
    await wacht(3000);
    const d = await gql(
      admin,
      `#graphql
        query VerzendlabelsStatus($id: ID!) {
          node(id: $id) { ... on BulkOperation { status url errorCode } }
        }`,
      { id: opId },
    );
    const op = d.node;
    if (op.status === "COMPLETED") {
      url = op.url;
      break;
    }
    if (["FAILED", "CANCELED", "EXPIRED"].includes(op.status)) {
      throw new Error(`Bulk-operatie ${op.status} ${op.errorCode ?? ""}`);
    }
  }
  if (!url) throw new Error("Bulk-operatie duurde te lang");

  const tekst = await (await fetch(url)).text();
  const labels = new Map<string, string>(); // product-id -> label
  const regels = ["id\tshipping_label"];
  for (const regel of tekst.split("\n")) {
    if (!regel.trim()) continue;
    const r = JSON.parse(regel);
    if (r.__parentId) {
      const label = labels.get(r.__parentId);
      if (!label) continue;
      const pid = r.__parentId.split("/").pop();
      const vid = String(r.id).split("/").pop();
      regels.push(`shopify_ZZ_${pid}_${vid}\t${label}`);
    } else {
      const tags: string[] = r.tags ?? [];
      const label = tags.includes("zwaar-pakket")
        ? "zwaar-pakket"
        : tags.includes("gratis-verzending")
          ? "gratis-verzending"
          : "";
      if (label) labels.set(r.id, label);
    }
  }
  return regels.join("\n") + "\n";
}

function vernieuw() {
  if (!bezig) {
    bezig = bouwFeed()
      .then((body) => {
        cache = { body, at: Date.now() };
        return body;
      })
      .finally(() => {
        bezig = null;
      });
  }
  return bezig;
}

export const loader = async (_args: LoaderFunctionArgs) => {
  const vers = cache && Date.now() - cache.at < CACHE_MS;
  let body: string;
  if (vers) {
    body = cache!.body;
  } else if (cache) {
    // Oude versie direct leveren en op de achtergrond verversen.
    body = cache.body;
    vernieuw().catch((e) => console.error("Verzendlabel-feed", e));
  } else {
    body = await vernieuw();
  }
  return new Response(body, {
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
