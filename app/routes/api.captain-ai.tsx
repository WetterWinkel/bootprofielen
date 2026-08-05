/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomBytes } from "node:crypto";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { answerCaptainQuestion, type CaptainImage } from "../captain-ai.server";
import prisma from "../db.server";
import { authenticate, unauthenticated } from "../shopify.server";

const METAFIELD_NAMESPACE = "$app";
const METAFIELD_KEY = "bootprofielen";
const MAX_MESSAGE_LENGTH = 1_500;
const MAX_CAPTAIN_IMAGES = 3;
const MAX_CAPTAIN_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_CAPTAIN_TOTAL_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_CAPTAIN_REQUEST_BYTES = 18 * 1024 * 1024;
const CAPTAIN_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DAY_MS = 24 * 60 * 60 * 1_000;

function imageSignatureMatches(
  mimeType: CaptainImage["mimeType"],
  data: Buffer,
) {
  if (mimeType === "image/jpeg") {
    return (
      data.length >= 3 &&
      data[0] === 0xff &&
      data[1] === 0xd8 &&
      data[2] === 0xff
    );
  }
  if (mimeType === "image/png") {
    return (
      data.length >= 8 &&
      data
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  return (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function captainImages(value: unknown): CaptainImage[] {
  if (value == null) return [];
  if (!Array.isArray(value))
    throw new Error("De meegestuurde foto's zijn ongeldig.");
  if (value.length > MAX_CAPTAIN_IMAGES) {
    throw new Error(
      `U kunt maximaal ${MAX_CAPTAIN_IMAGES} foto's per vraag meesturen.`,
    );
  }

  let totalBytes = 0;
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object") {
      throw new Error(`Foto ${index + 1} is ongeldig.`);
    }
    const record = raw as Record<string, unknown>;
    const mimeType = String(record.mimeType || "").toLowerCase();
    if (!CAPTAIN_IMAGE_TYPES.has(mimeType)) {
      throw new Error("Gebruik alleen JPEG-, PNG- of WebP-foto's.");
    }
    const encoded = String(record.data || "").replace(/\s+/g, "");
    if (
      !encoded ||
      encoded.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
    ) {
      throw new Error(`Foto ${index + 1} bevat geen geldige afbeeldingsdata.`);
    }
    const bytes = Buffer.from(encoded, "base64");
    if (!bytes.length || bytes.length > MAX_CAPTAIN_IMAGE_BYTES) {
      throw new Error(
        `Iedere foto mag maximaal ${MAX_CAPTAIN_IMAGE_BYTES / 1024 / 1024} MB zijn.`,
      );
    }
    totalBytes += bytes.length;
    if (totalBytes > MAX_CAPTAIN_TOTAL_IMAGE_BYTES) {
      throw new Error("De foto's samen mogen maximaal 12 MB zijn.");
    }
    if (!imageSignatureMatches(mimeType as CaptainImage["mimeType"], bytes)) {
      throw new Error(
        `Foto ${index + 1} komt niet overeen met het opgegeven bestandstype.`,
      );
    }
    return {
      name: String(record.name || `foto-${index + 1}`).slice(0, 120),
      mimeType: mimeType as CaptainImage["mimeType"],
      data: encoded,
    };
  });
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function captainOffer() {
  return {
    freeMonthlyLimit: positiveInt(process.env.CAPTAIN_AI_FREE_MONTHLY_LIMIT, 3),
    creditPackSize: positiveInt(process.env.CAPTAIN_AI_CREDIT_PACK_SIZE, 25),
    creditPackPriceCents: positiveInt(
      process.env.CAPTAIN_AI_CREDIT_PACK_PRICE_CENTS,
      995,
    ),
  };
}

async function usageSummary(shop: string, customerId: string) {
  const offer = captainOffer();
  const [freeUsed, balance] = await Promise.all([
    prisma.captainMessage.count({
      where: {
        role: "USER",
        usageType: "FREE",
        createdAt: { gte: monthStart() },
        conversation: { shop, customerId, channel: "ACCOUNT" },
      },
    }),
    prisma.captainCreditBalance.findUnique({
      where: { shop_customerId: { shop, customerId } },
    }),
  ]);
  return {
    freeRemaining: Math.max(0, offer.freeMonthlyLimit - freeUsed),
    creditBalance: balance?.credits ?? 0,
    ...offer,
  };
}

async function creditPurchase(purchase: any, paidOrderId: string) {
  await prisma.$transaction(async (tx) => {
    const credited = await tx.captainCreditPurchase.updateMany({
      where: { id: purchase.id, shop: purchase.shop, paidAt: null },
      data: { paidAt: new Date(), paidOrderId },
    });
    if (!credited.count) return;
    await tx.captainCreditBalance.upsert({
      where: {
        shop_customerId: {
          shop: purchase.shop,
          customerId: purchase.customerId,
        },
      },
      create: {
        shop: purchase.shop,
        customerId: purchase.customerId,
        credits: purchase.credits,
      },
      update: { credits: { increment: purchase.credits } },
    });
  });
}

async function reconcileCreditPurchases(
  admin: any,
  shop: string,
  customerId: string,
) {
  const purchases = await prisma.captainCreditPurchase.findMany({
    where: { shop, customerId, paidAt: null, draftOrderId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (!purchases.length) return;
  try {
    const ids = purchases.flatMap((purchase) =>
      purchase.draftOrderId ? [purchase.draftOrderId] : [],
    );
    const result = await admin.graphql(
      `#graphql
        query ControleerCaptainAiBetalingen($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on DraftOrder { id status order { id } }
          }
        }
      `,
      { variables: { ids } },
    );
    const json: any = await result.json();
    for (const draft of json.data?.nodes ?? []) {
      if (draft?.status !== "COMPLETED" || !draft?.order?.id) continue;
      const purchase = purchases.find((item) => item.draftOrderId === draft.id);
      if (purchase) await creditPurchase(purchase, draft.order.id);
    }
  } catch (error) {
    console.warn("Captain AI-betaling controleren mislukt", error);
  }
}

async function createCreditCheckout(
  admin: any,
  shop: string,
  customerId: string,
) {
  const offer = captainOffer();
  const paymentToken = randomBytes(24).toString("hex");
  const purchase = await prisma.captainCreditPurchase.create({
    data: {
      shop,
      customerId,
      credits: offer.creditPackSize,
      priceCents: offer.creditPackPriceCents,
      paymentToken,
    },
  });
  try {
    const result = await admin.graphql(
      `#graphql
        mutation MaakCaptainAiTegoedBetaling($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder { id invoiceUrl status }
            userErrors { field message }
          }
        }
      `,
      {
        variables: {
          input: {
            purchasingEntity: { customerId },
            presentmentCurrencyCode: "EUR",
            taxExempt: false,
            useCustomerDefaultAddress: true,
            visibleToCustomer: true,
            allowDiscountCodesInCheckout: false,
            tags: ["captain-ai", "ai-tegoed"],
            note: `WetterWinkel Captain AI – ${offer.creditPackSize} extra antwoorden`,
            customAttributes: [
              { key: "ww_captain_credit_token", value: paymentToken },
              {
                key: "ww_captain_credit_count",
                value: String(offer.creditPackSize),
              },
            ],
            lineItems: [
              {
                title: `Captain AI-tegoed – ${offer.creditPackSize} antwoorden`,
                quantity: 1,
                originalUnitPriceWithCurrency: {
                  amount: (offer.creditPackPriceCents / 100).toFixed(2),
                  currencyCode: "EUR",
                },
                requiresShipping: false,
                taxable: true,
                sku: `WW-CAPTAIN-${offer.creditPackSize}`,
              },
            ],
          },
        },
      },
    );
    const json: any = await result.json();
    const payload = json.data?.draftOrderCreate;
    const errors = payload?.userErrors ?? json.errors ?? [];
    if (errors.length || !payload?.draftOrder?.invoiceUrl) {
      throw new Error(
        errors[0]?.message || "Shopify kon de betaling niet voorbereiden",
      );
    }
    await prisma.captainCreditPurchase.update({
      where: { id: purchase.id },
      data: { draftOrderId: payload.draftOrder.id },
    });
    return payload.draftOrder.invoiceUrl as string;
  } catch (error) {
    await prisma.captainCreditPurchase
      .delete({ where: { id: purchase.id } })
      .catch(() => undefined);
    throw error;
  }
}

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

function customerGid(value: unknown) {
  const id = String(value ?? "");
  if (!id) throw new Error("Geen klant gevonden in het sessietoken");
  return id.startsWith("gid://shopify/Customer/")
    ? id
    : `gid://shopify/Customer/${id}`;
}

async function customerContext(request: Request) {
  const { sessionToken, cors } =
    await authenticate.public.customerAccount(request);
  const destination = String((sessionToken as any).dest ?? "");
  if (!destination) throw new Error("Shop ontbreekt in het sessietoken");
  const shop = new URL(
    destination.includes("://") ? destination : `https://${destination}`,
  ).hostname;
  const { admin } = await unauthenticated.admin(shop);
  return {
    admin,
    cors,
    shop,
    customerId: customerGid((sessionToken as any).sub),
  };
}

async function ownedProfiles(admin: any, customerId: string) {
  const result = await admin.graphql(
    `#graphql
      query CaptainBootprofielen($customerId: ID!) {
        customer(id: $customerId) {
          metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
            references(first: 100) {
              nodes {
                ... on Metaobject {
                  id
                  type
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
  const json: any = await result.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return (json.data?.customer?.metafield?.references?.nodes ?? []).flatMap(
    (node: any) => {
      const fields = Object.fromEntries(
        (node.fields ?? []).map((field: any) => [field.key, field.value]),
      );
      if (fields.klant_id !== customerId) return [];
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(fields.data || "{}");
      } catch {
        data = {};
      }
      return [{ id: node.id, data }];
    },
  );
}

function serializedMessage(message: any) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    sources: Array.isArray(message.sources) ? message.sources : [],
    products: Array.isArray(message.products) ? message.products : [],
    feedback: message.feedback,
    createdAt: message.createdAt.toISOString(),
  };
}

async function ownedConversation(
  id: unknown,
  shop: string,
  customerId: string,
  profileId: string,
) {
  if (!id) return null;
  return prisma.captainConversation.findFirst({
    where: { id: String(id), shop, customerId, profileId },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") return response({ success: true });
  try {
    const { admin, cors, shop, customerId } = await customerContext(request);
    const profileId = new URL(request.url).searchParams.get("profileId") || "";
    const profiles = await ownedProfiles(admin, customerId);
    if (!profiles.some((profile: any) => profile.id === profileId)) {
      return cors(
        response(
          { success: false, message: "Selecteer eerst een bootprofiel." },
          404,
        ),
      );
    }

    const conversation = await prisma.captainConversation.findFirst({
      where: { shop, customerId, profileId },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 50 } },
    });
    await reconcileCreditPurchases(admin, shop, customerId);
    return cors(
      response({
        success: true,
        usage: await usageSummary(shop, customerId),
        conversation: conversation
          ? {
              id: conversation.id,
              title: conversation.title,
              improvementConsent: conversation.improvementConsent,
              messages: conversation.messages.map(serializedMessage),
            }
          : null,
      }),
    );
  } catch (error: any) {
    console.error("Captain AI-gesprek ophalen mislukt", error);
    return response(
      { success: false, message: error?.message || "Gesprek ophalen mislukt" },
      500,
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") return response({ success: true });
  try {
    const { admin, cors, shop, customerId } = await customerContext(request);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_CAPTAIN_REQUEST_BYTES) {
      return cors(
        response(
          {
            success: false,
            message: "De meegestuurde foto's zijn samen te groot.",
          },
          413,
        ),
      );
    }
    const body = await request.json();
    const profileId = String(body.profileId ?? "");
    const profiles = await ownedProfiles(admin, customerId);
    const profile = profiles.find((item: any) => item.id === profileId);
    if (!profile) {
      return cors(
        response(
          {
            success: false,
            message: "Selecteer eerst een geldig bootprofiel.",
          },
          404,
        ),
      );
    }

    if (body.intent === "new_conversation") {
      const conversation = await prisma.captainConversation.create({
        data: {
          shop,
          customerId,
          profileId,
          channel: "ACCOUNT",
          boatContext: profile.data || {},
          title: "Nieuw gesprek",
          improvementConsent: Boolean(body.improvementConsent),
        },
      });
      return cors(
        response({
          success: true,
          conversation: { ...conversation, messages: [] },
        }),
      );
    }

    if (body.intent === "delete_conversation") {
      const conversation = await ownedConversation(
        body.conversationId,
        shop,
        customerId,
        profileId,
      );
      if (!conversation)
        return cors(
          response({ success: false, message: "Gesprek niet gevonden." }, 404),
        );
      await prisma.captainConversation.delete({
        where: { id: conversation.id },
      });
      return cors(
        response({ success: true, message: "Captain AI-gesprek verwijderd." }),
      );
    }

    if (body.intent === "feedback") {
      const conversation = await ownedConversation(
        body.conversationId,
        shop,
        customerId,
        profileId,
      );
      if (!conversation)
        return cors(
          response({ success: false, message: "Gesprek niet gevonden." }, 404),
        );
      const feedback = Number(body.feedback);
      if (![1, -1, 0].includes(feedback)) {
        return cors(
          response({ success: false, message: "Ongeldige feedback." }, 400),
        );
      }
      const updated = await prisma.captainMessage.updateMany({
        where: {
          id: String(body.messageId ?? ""),
          conversationId: conversation.id,
          role: "ASSISTANT",
        },
        data: { feedback: feedback || null },
      });
      if (!updated.count)
        return cors(
          response({ success: false, message: "Antwoord niet gevonden." }, 404),
        );
      return cors(
        response({
          success: true,
          message: "Bedankt, hiermee verbeteren we Captain AI gecontroleerd.",
        }),
      );
    }

    if (body.intent === "create_credit_checkout") {
      const checkoutUrl = await createCreditCheckout(admin, shop, customerId);
      return cors(
        response({
          success: true,
          checkoutUrl,
          usage: await usageSummary(shop, customerId),
        }),
      );
    }

    if (body.intent !== "ask") {
      return cors(
        response(
          { success: false, message: "Onbekende Captain AI-actie." },
          400,
        ),
      );
    }

    const rawMessage = String(body.message ?? "").trim();
    let images: CaptainImage[];
    try {
      images = captainImages(body.images);
    } catch (error: any) {
      return cors(
        response(
          {
            success: false,
            message: error?.message || "De foto's zijn ongeldig.",
          },
          400,
        ),
      );
    }
    if (!rawMessage && !images.length)
      return cors(
        response(
          { success: false, message: "Typ een vraag of voeg een foto toe." },
          400,
        ),
      );
    if (rawMessage.length > MAX_MESSAGE_LENGTH) {
      return cors(
        response(
          {
            success: false,
            message: `Een vraag mag maximaal ${MAX_MESSAGE_LENGTH} tekens bevatten.`,
          },
          400,
        ),
      );
    }
    const message =
      rawMessage ||
      "Kunt u deze foto beoordelen in de context van mijn bootprofiel?";
    const storedMessage = images.length
      ? `${message}\n\n[${images.length} ${images.length === 1 ? "foto" : "foto's"} meegestuurd; afbeeldingen niet opgeslagen.]`
      : message;
    const since = new Date(Date.now() - DAY_MS);
    const dailyLimit = positiveInt(process.env.CAPTAIN_AI_DAILY_LIMIT, 10);
    const globalDailyLimit = positiveInt(
      process.env.CAPTAIN_AI_GLOBAL_DAILY_LIMIT,
      100,
    );
    const [usedToday, globalUsedToday] = await Promise.all([
      prisma.captainMessage.count({
        where: {
          role: "USER",
          createdAt: { gte: since },
          conversation: { shop, customerId, channel: "ACCOUNT" },
        },
      }),
      prisma.captainMessage.count({
        where: {
          role: "USER",
          createdAt: { gte: since },
          conversation: { shop, channel: "ACCOUNT" },
        },
      }),
    ]);
    if (usedToday >= dailyLimit) {
      return cors(
        response(
          {
            success: false,
            message:
              "Uw Captain AI-daglimiet is bereikt. Probeer het morgen opnieuw.",
          },
          429,
        ),
      );
    }
    if (globalUsedToday >= globalDailyLimit) {
      return cors(
        response(
          {
            success: false,
            message:
              "Captain AI heeft het gezamenlijke dagbudget bereikt. Uw tegoed blijft bewaard; probeer het morgen opnieuw.",
          },
          429,
        ),
      );
    }

    const usage = await usageSummary(shop, customerId);
    const usageType = usage.freeRemaining > 0 ? "FREE" : "CREDIT";
    if (usageType === "CREDIT" && usage.creditBalance <= 0) {
      return cors(
        response(
          {
            success: false,
            paymentRequired: true,
            message:
              "Uw gratis Captain AI-antwoorden voor deze maand zijn gebruikt. Koop extra tegoed om verder te vragen.",
            usage,
          },
          402,
        ),
      );
    }

    let conversation = await ownedConversation(
      body.conversationId,
      shop,
      customerId,
      profileId,
    );
    if (!conversation) {
      conversation = await prisma.captainConversation.create({
        data: {
          shop,
          customerId,
          profileId,
          channel: "ACCOUNT",
          boatContext: profile.data || {},
          title: message.slice(0, 80),
          improvementConsent: Boolean(body.improvementConsent),
        },
      });
    } else {
      conversation = await prisma.captainConversation.update({
        where: { id: conversation.id },
        data: {
          improvementConsent:
            conversation.improvementConsent || Boolean(body.improvementConsent),
          boatContext: profile.data || {},
          ...(conversation.title === "Nieuw gesprek"
            ? { title: message.slice(0, 80) }
            : {}),
        },
      });
    }

    let creditReserved = false;
    if (usageType === "CREDIT") {
      const reservation = await prisma.captainCreditBalance.updateMany({
        where: { shop, customerId, credits: { gt: 0 } },
        data: { credits: { decrement: 1 } },
      });
      if (!reservation.count) {
        return cors(
          response(
            {
              success: false,
              paymentRequired: true,
              message: "Uw Captain AI-tegoed is op.",
              usage: await usageSummary(shop, customerId),
            },
            402,
          ),
        );
      }
      creditReserved = true;
    }

    let userMessage: any;
    try {
      userMessage = await prisma.captainMessage.create({
        data: {
          conversationId: conversation.id,
          role: "USER",
          content: storedMessage,
          usageType,
        },
      });
      const history = await prisma.captainMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        take: 12,
      });
      const serviceEntries = await prisma.serviceBookEntry.findMany({
        where: { shop, customerId, profileId },
        orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }],
        take: 30,
        select: {
          status: true,
          serviceDate: true,
          category: true,
          component: true,
          title: true,
          description: true,
          engineHours: true,
          performedBy: true,
          partsMaterials: true,
          reference: true,
          nextServiceHours: true,
          nextServiceDate: true,
        },
      });

      const answer = await answerCaptainQuestion({
        admin,
        shop,
        customerId,
        profile,
        serviceEntries: serviceEntries.map((entry) => ({
          ...entry,
          serviceDate: entry.serviceDate.toISOString().slice(0, 10),
          nextServiceDate:
            entry.nextServiceDate?.toISOString().slice(0, 10) || null,
        })),
        messages: history
          .reverse()
          .map((item) => ({ role: item.role, content: item.content })),
        images,
      });
      const saved = await prisma.captainMessage.create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: answer.text,
          sources: answer.sources,
          products: answer.products,
          model: answer.model,
          inputTokens: answer.inputTokens,
          outputTokens: answer.outputTokens,
        },
      });

      return cors(
        response({
          success: true,
          conversationId: conversation.id,
          message: serializedMessage(saved),
          usage: await usageSummary(shop, customerId),
        }),
      );
    } catch (error) {
      if (userMessage?.id) {
        await prisma.captainMessage
          .delete({ where: { id: userMessage.id } })
          .catch(() => undefined);
      }
      if (creditReserved) {
        await prisma.captainCreditBalance.upsert({
          where: { shop_customerId: { shop, customerId } },
          create: { shop, customerId, credits: 1 },
          update: { credits: { increment: 1 } },
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error("========== CAPTAIN AI ERROR ==========", error);
    const status = error?.status === 429 ? 429 : 500;
    const message =
      error?.status === 429
        ? "Captain AI is tijdelijk druk. Probeer het over een minuut opnieuw."
        : error?.message || "Captain AI kon de vraag niet verwerken.";
    return response({ success: false, message }, status);
  }
}
