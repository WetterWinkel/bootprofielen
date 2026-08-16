/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { answerCaptainQuestion } from "../captain-ai.server";
import prisma from "../db.server";
import { authenticate, unauthenticated } from "../shopify.server";

const METAFIELD_NAMESPACE = "$app";
const METAFIELD_KEY = "bootprofielen";
const MAX_MESSAGE_LENGTH = 1500;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function safeContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, any>;
  const product =
    source.product && typeof source.product === "object"
      ? {
          id: String(source.product.id || "").slice(0, 80),
          title: String(source.product.title || "").slice(0, 240),
          handle: String(source.product.handle || "").slice(0, 180),
          url: String(source.product.url || "").slice(0, 500),
          vendor: String(source.product.vendor || "").slice(0, 180),
          type: String(source.product.type || "").slice(0, 180),
          description: String(source.product.description || "").slice(0, 1800),
          price: String(source.product.price || "").slice(0, 80),
          variantId: String(source.product.variantId || "").slice(0, 100),
          variantTitle: String(source.product.variantTitle || "").slice(0, 240),
          sku: String(source.product.sku || "").slice(0, 180),
          image: String(source.product.image || "").slice(0, 600),
        }
      : null;
  const collection =
    source.collection && typeof source.collection === "object"
      ? {
          id: String(source.collection.id || "").slice(0, 80),
          title: String(source.collection.title || "").slice(0, 240),
          handle: String(source.collection.handle || "").slice(0, 180),
          url: String(source.collection.url || "").slice(0, 500),
        }
      : null;
  return {
    pageType: String(source.pageType || "").slice(0, 80),
    url: String(source.url || "").slice(0, 600),
    product,
    collection,
  };
}

async function storefrontContext(request: Request) {
  await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const shop = String(url.searchParams.get("shop") || "").trim();
  const rawCustomerId = String(
    url.searchParams.get("logged_in_customer_id") || "",
  ).trim();

  if (!shop) throw new Error("Shop ontbreekt in de beveiligde aanvraag.");
  if (!rawCustomerId) {
    return { shop, customerId: "", admin: null };
  }

  const { admin } = await unauthenticated.admin(shop);
  return { shop, customerId: customerGid(rawCustomerId), admin };
}

async function ownedProfiles(admin: any, customerId: string) {
  const result = await admin.graphql(
    `#graphql
      query StorefrontCaptainBootprofielen($customerId: ID!) {
        customer(id: $customerId) {
          metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
            references(first: 100) {
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

function profileName(profile: any) {
  return String(
    profile?.data?.naam_schip ||
      profile?.data?.merk_boot ||
      profile?.data?.model_boot ||
      "uw boot",
  );
}

async function usage(shop: string, customerId: string) {
  const limit = Math.max(
    1,
    Number(process.env.CAPTAIN_AI_STOREFRONT_DAILY_LIMIT || 10),
  );
  const used = await prisma.captainMessage.count({
    where: {
      role: "USER",
      createdAt: { gte: new Date(Date.now() - DAY_MS) },
      conversation: { shop, customerId, channel: "STOREFRONT" },
    },
  });
  return { limit, used, remaining: Math.max(0, limit - used) };
}

function pageContextText(context: Record<string, any>) {
  if (context.product) {
    return `HUIDIGE WEBSHOPPAGINA
De klant bekijkt nu dit WetterWinkel-product:
${JSON.stringify(context.product, null, 2)}
Gebruik dit uitsluitend als context voor de actuele vraag. Controleer pasvorm tegen het bootprofiel. Verzin geen ontbrekende variant- of productspecificaties.`;
  }
  if (context.collection) {
    return `HUIDIGE WEBSHOPPAGINA
De klant bekijkt nu de WetterWinkel-collectie:
${JSON.stringify(context.collection, null, 2)}
Gebruik dit uitsluitend als context voor de actuele vraag.`;
  }
  return `HUIDIGE WEBSHOPPAGINA
Pagina: ${String(context.url || "WetterWinkel")}`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { shop, customerId, admin } = await storefrontContext(request);
    if (!customerId || !admin) {
      return json(
        {
          success: false,
          requiresLogin: true,
          message:
            "Log in en maak gratis uw bootprofiel om Captain AI persoonlijk te gebruiken.",
        },
        401,
      );
    }

    const profiles = await ownedProfiles(admin, customerId);
    if (!profiles.length) {
      return json(
        {
          success: false,
          requiresProfile: true,
          message:
            "Maak eerst gratis een bootprofiel. Daarna kan Captain AI rekening houden met uw boot.",
        },
        404,
      );
    }

    const currentUsage = await usage(shop, customerId);
    return json({
      success: true,
      profileId: profiles[0].id,
      profileName: profileName(profiles[0]),
      remaining: currentUsage.remaining,
    });
  } catch (error: any) {
    console.error("Captain AI storefront laden mislukt", error);
    return json(
      {
        success: false,
        message: error?.message || "Captain AI kon niet worden verbonden.",
      },
      400,
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { shop, customerId, admin } = await storefrontContext(request);
    if (!customerId || !admin) {
      return json(
        {
          success: false,
          requiresLogin: true,
          message:
            "Log in en maak gratis uw bootprofiel om Captain AI persoonlijk te gebruiken.",
        },
        401,
      );
    }

    const body = await request.json();
    const rawMessage = String(body.message || "").trim();
    if (!rawMessage || rawMessage.length > MAX_MESSAGE_LENGTH) {
      return json(
        {
          success: false,
          message: `Vul een vraag in van maximaal ${MAX_MESSAGE_LENGTH} tekens.`,
        },
        400,
      );
    }

    const profiles = await ownedProfiles(admin, customerId);
    const profile = profiles.find((item: any) => item.id === body.profileId) || profiles[0];
    if (!profile) {
      return json(
        {
          success: false,
          requiresProfile: true,
          message:
            "Maak eerst gratis een bootprofiel om Captain AI te gebruiken.",
        },
        404,
      );
    }

    const currentUsage = await usage(shop, customerId);
    if (currentUsage.remaining <= 0) {
      return json(
        {
          success: false,
          message:
            "Uw Captain AI-daglimiet voor de webshop is bereikt. Probeer het morgen opnieuw.",
        },
        429,
      );
    }

    let conversation = await prisma.captainConversation.findFirst({
      where: {
        shop,
        customerId,
        profileId: profile.id,
        channel: "STOREFRONT",
      },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
    });

    if (!conversation) {
      conversation = await prisma.captainConversation.create({
        data: {
          shop,
          customerId,
          profileId: profile.id,
          channel: "STOREFRONT",
          boatContext: profile.data || {},
          title: "Webshopadvies",
        },
        include: { messages: true },
      });
    }

    const context = safeContext(body.context);
    const previousMessages = conversation.messages.slice(-10).map((message: any) => ({
      role: message.role,
      content: message.content,
    }));
    const aiMessage = `${rawMessage}

${pageContextText(context)}`;

    const serviceEntries = await prisma.serviceBookEntry.findMany({
      where: { shop, customerId, profileId: profile.id },
      orderBy: { serviceDate: "desc" },
      take: 30,
    });

    const result = await answerCaptainQuestion({
      admin,
      shop,
      customerId,
      profile,
      serviceEntries,
      messages: [
        ...previousMessages,
        { role: "USER", content: aiMessage },
      ],
    });

    const [, assistantMessage] = await prisma.$transaction([
      prisma.captainMessage.create({
        data: {
          conversationId: conversation.id,
          role: "USER",
          content: rawMessage,
          usageType: "FREE",
        },
      }),
      prisma.captainMessage.create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: result.text,
          sources: result.sources,
          products: result.products,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
      }),
      prisma.captainConversation.update({
        where: { id: conversation.id },
        data: {
          boatContext: profile.data || {},
          title: rawMessage.slice(0, 80),
        },
      }),
    ]);

    return json({
      success: true,
      remaining: Math.max(0, currentUsage.remaining - 1),
      message: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        sources: assistantMessage.sources,
        products: assistantMessage.products,
      },
    });
  } catch (error: any) {
    console.error("Captain AI storefront beantwoorden mislukt", error);
    return json(
      {
        success: false,
        message:
          error?.message ||
          "Captain AI kon deze vraag tijdelijk niet beantwoorden.",
      },
      500,
    );
  }
}
