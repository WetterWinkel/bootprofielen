/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import OpenAI from "openai";

export type CaptainSource = {
  title: string;
  url?: string;
  kind: "web" | "manual";
};

export type CaptainProduct = {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  productType: string;
  description: string;
  url: string;
  imageUrl: string | null;
  imageAlt: string | null;
  price: string;
  currency: string;
  available: boolean;
};

type CaptainInput = {
  admin: any;
  shop: string;
  customerId: string;
  profile: { id: string; data?: Record<string, unknown> } | null;
  serviceEntries: Array<Record<string, unknown>>;
  messages: Array<{ role: "USER" | "ASSISTANT"; content: string }>;
};

function openAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Captain AI is nog niet geactiveerd door WetterWinkel.");
  }
  return new OpenAI({ apiKey });
}

function publicStoreUrl() {
  return (
    process.env.PUBLIC_STORE_URL || "https://www.wetterwinkel.nl"
  ).replace(/\/$/, "");
}

function compact(value: unknown, max = 12_000) {
  const json = JSON.stringify(value, null, 2);
  return json.length > max ? `${json.slice(0, max)}\n[ingekort]` : json;
}

async function searchWetterWinkelProducts(admin: any, rawQuery: unknown) {
  const query = String(rawQuery ?? "")
    .trim()
    .slice(0, 180);
  if (!query) return [];

  const result = await admin.graphql(
    `#graphql
      query CaptainProductSearch($query: String!) {
        products(first: 8, query: $query, sortKey: RELEVANCE) {
          nodes {
            id
            title
            handle
            vendor
            productType
            description
            status
            onlineStoreUrl
            featuredMedia {
              preview { image { url altText } }
            }
            priceRangeV2 {
              minVariantPrice { amount currencyCode }
            }
            variants(first: 5) {
              nodes { availableForSale }
            }
          }
        }
      }
    `,
    { variables: { query: `status:active ${query}` } },
  );
  const json: any = await result.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);

  return (json.data?.products?.nodes ?? []).map(
    (product: any): CaptainProduct => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      vendor: product.vendor || "",
      productType: product.productType || "",
      description: String(product.description || "").slice(0, 500),
      url:
        product.onlineStoreUrl ||
        `${publicStoreUrl()}/products/${product.handle}`,
      imageUrl: product.featuredMedia?.preview?.image?.url || null,
      imageAlt: product.featuredMedia?.preview?.image?.altText || product.title,
      price: product.priceRangeV2?.minVariantPrice?.amount || "",
      currency: product.priceRangeV2?.minVariantPrice?.currencyCode || "EUR",
      available: (product.variants?.nodes ?? []).some(
        (variant: any) => variant.availableForSale,
      ),
    }),
  );
}

function instructions(input: CaptainInput) {
  return `Je bent Captain AI, de persoonlijke Nederlandstalige vaar- en onderhoudsassistent van WetterWinkel.

PRIVECONTEXT
Gebruik uitsluitend het bootprofiel en Digitaal serviceboek hieronder als gegevens van deze klant. Neem nooit gegevens aan van een andere klant. Als essentiële gegevens ontbreken, stel eerst een korte gerichte vraag.
Captain AI is alleen beschikbaar nadat de ingelogde klant een geldig bootprofiel heeft gekozen. Vul ontbrekende gegevens nooit aan alsof de klant ze zelf heeft opgegeven.

BOOTPROFIEL
${compact(input.profile?.data || {})}

DIGITAAL SERVICEBOEK (meest recente regels)
${compact(input.serviceEntries.slice(0, 30))}

WERKWIJZE EN BRONNEN
- Voor actuele of technische feiten mag en moet je web_search gebruiken. Geef controleerbare bronverwijzingen en geef voorkeur aan fabrikanten, officiële handleidingen, normen en gezaghebbende nautische bronnen.
- Als een WetterWinkel-handleidingenbibliotheek beschikbaar is, gebruik file_search voor productspecifieke onderhoudsinformatie.
- Maak duidelijk onderscheid tussen een feit uit een bron, een berekening en jouw inschatting.
- Haal merk, model, lengte en andere bruikbare bootgegevens ook uit de actuele vraag. Vraag gegevens die de klant al in de vraag noemt niet opnieuw uit.
- Geef bij voldoende context meteen een bruikbaar antwoord. Stel maximaal één gerichte vervolgvraag wanneer een ontbrekend gegeven de productmaat of veiligheid echt kan veranderen.
- Voor landvasten en fenders: controleer ten minste bootlengte en waar relevant breedte, gewicht/verplaatsing en gebruik/ligplaats. Gebruik bij maatadvies bij voorkeur een officiële maattabel van een fabrikant. Geef een bruikbaar voorlopig advies wanneer niet alles bekend is, met één duidelijke controlevoorwaarde.
- Voor een vraag zoals "Antaris Fifty5 sloep van 8 meter: welke fenders en touwen?": controleer eerst betrouwbare modelgegevens en een fabrikant-maattabel, leg de gekozen maat en aantallen kort uit en koppel pas daarna passende WetterWinkel-producten. Verzin geen productspecificaties.
- Voor omvormers en elektrische systemen: inventariseer boordspanning, gelijktijdig vermogen, piekvermogen, accutype/-capaciteit, kabellengte en relevante beveiliging voordat je een definitief maatadvies geeft.
- Verzin nooit onderhoudsintervallen, belastingwaarden, kabeldiktes, zekeringen, vloeistoffen, onderdeelnummers of veiligheidsclaims.
- Bij gas, 230V, accubanken, brandstof, hijsen, rompdoorvoeren en andere veiligheidskritische werkzaamheden: geef veilige algemene informatie en adviseer controle door een vakbedrijf wanneer gegevens of expertise ontbreken.

PRODUCTBELEID — ABSOLUUT
- Je mag overal informatie zoeken, maar je mag uitsluitend concrete koop- of productaanbevelingen doen voor actieve producten die door search_wetterwinkel_products zijn teruggegeven.
- Zoek met korte Nederlandse cataloguswoorden. Zoek opnieuw met een synoniem als niets wordt gevonden.
- Selecteer de uiteindelijk passende producten altijd met select_wetterwinkel_products. Alleen die selectie verschijnt als klikbare productkaart.
- Noem geen concurrerende winkel, externe verkooplink of extern koopproduct. Een fabrikant of producttype als technische bron mag wel, maar niet als koopadvies.
- Is er geen geschikt WetterWinkel-product, zeg dan letterlijk dat je in het huidige WetterWinkel-assortiment geen passend product kunt aanbevelen. Geef eventueel neutrale selectiecriteria, zonder externe verkooptip.
- Controleer pasvorm en specificaties tegen de bootgegevens; doe geen stellige compatibiliteitsclaim als informatie ontbreekt.

ANTWOORDSTIJL
Antwoord helder, praktisch en niet langer dan nodig. Gebruik metrische eenheden. Sluit waar nuttig af met één concrete vervolgvraag. Zeg niet dat je een menselijke monteur of gecertificeerd expert bent.`;
}

function responseSources(response: any): CaptainSource[] {
  const sources = new Map<string, CaptainSource>();
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type !== "output_text") continue;
      for (const annotation of content.annotations ?? []) {
        if (annotation.type === "url_citation" && annotation.url) {
          sources.set(annotation.url, {
            title: annotation.title || annotation.url,
            url: annotation.url,
            kind: "web",
          });
        }
        if (annotation.type === "file_citation" && annotation.filename) {
          sources.set(`file:${annotation.file_id}:${annotation.filename}`, {
            title: annotation.filename,
            kind: "manual",
          });
        }
      }
    }
  }
  return [...sources.values()].slice(0, 10);
}

export async function answerCaptainQuestion(input: CaptainInput) {
  const client = openAIClient();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-terra";
  const vectorStoreIds = (process.env.OPENAI_VECTOR_STORE_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const productCandidates = new Map<string, CaptainProduct>();
  let selectedProducts: CaptainProduct[] = [];

  const tools: any[] = [
    {
      type: "web_search",
      search_context_size: "medium",
      user_location: {
        type: "approximate",
        country: "NL",
        timezone: "Europe/Amsterdam",
      },
    },
    ...(vectorStoreIds.length
      ? [
          {
            type: "file_search",
            vector_store_ids: vectorStoreIds,
            max_num_results: 6,
          },
        ]
      : []),
    {
      type: "function",
      name: "search_wetterwinkel_products",
      description:
        "Zoek actieve producten in uitsluitend de WetterWinkel Shopify-catalogus. Gebruik korte Nederlandse cataloguszoekwoorden.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
    {
      type: "function",
      name: "select_wetterwinkel_products",
      description:
        "Selecteer maximaal vier passende producten uit eerdere WetterWinkel-zoekresultaten. Gebruik uitsluitend exact teruggegeven Shopify-product-ID's.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          product_ids: {
            type: "array",
            items: { type: "string" },
            maxItems: 4,
          },
        },
        required: ["product_ids"],
      },
    },
  ];

  let response: any;
  let responseInput: any[] = input.messages.slice(-12).map((message) => ({
    role: message.role === "USER" ? "user" : "assistant",
    content: message.content,
  }));

  const createResponse = () =>
    client.responses.create({
      model,
      instructions: instructions(input),
      input: responseInput as any,
      tools,
      store: false,
      include: [
        "web_search_call.action.sources",
        "reasoning.encrypted_content",
      ] as any,
      max_output_tokens: 1400,
      max_tool_calls: 6,
      parallel_tool_calls: false,
      safety_identifier: createHash("sha256")
        .update(`${input.shop}|${input.customerId}`)
        .digest("hex")
        .slice(0, 64),
    } as any);

  response = await createResponse();
  for (let round = 0; round < 4; round += 1) {
    const calls = (response.output ?? []).filter(
      (item: any) => item.type === "function_call",
    );
    if (!calls.length) break;

    const outputs = [];
    for (const call of calls) {
      let args: any = {};
      try {
        args = JSON.parse(call.arguments || "{}");
      } catch {
        args = {};
      }

      if (call.name === "search_wetterwinkel_products") {
        const products = await searchWetterWinkelProducts(
          input.admin,
          args.query,
        );
        for (const product of products)
          productCandidates.set(product.id, product);
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(products),
        });
        continue;
      }

      if (call.name === "select_wetterwinkel_products") {
        const ids = Array.isArray(args.product_ids)
          ? args.product_ids.slice(0, 4)
          : [];
        selectedProducts = ids.flatMap((id: unknown) => {
          const product = productCandidates.get(String(id));
          return product ? [product] : [];
        });
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({ selected: selectedProducts }),
        });
        continue;
      }

      outputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify({ error: "Onbekende functie" }),
      });
    }

    responseInput = [...responseInput, ...(response.output ?? []), ...outputs];
    response = await createResponse();
  }

  const text = String(response.output_text || "").trim();
  if (!text)
    throw new Error(
      "Captain AI kon nog geen antwoord maken. Probeer de vraag anders te formuleren.",
    );

  return {
    text,
    sources: responseSources(response),
    products: selectedProducts,
    model,
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
  };
}
