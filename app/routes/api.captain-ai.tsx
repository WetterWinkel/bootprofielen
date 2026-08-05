/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { answerCaptainQuestion } from "../captain-ai.server";
import prisma from "../db.server";
import { authenticate, unauthenticated } from "../shopify.server";

const METAFIELD_NAMESPACE = "$app";
const METAFIELD_KEY = "bootprofielen";
const MAX_MESSAGE_LENGTH = 1_500;

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
    return cors(
      response({
        success: true,
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

    if (body.intent !== "ask") {
      return cors(
        response(
          { success: false, message: "Onbekende Captain AI-actie." },
          400,
        ),
      );
    }

    const message = String(body.message ?? "").trim();
    if (!message)
      return cors(
        response({ success: false, message: "Typ eerst een vraag." }, 400),
      );
    if (message.length > MAX_MESSAGE_LENGTH) {
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
    const dailyLimit = Math.max(
      1,
      Number(process.env.CAPTAIN_AI_DAILY_LIMIT || 30),
    );
    const usedToday = await prisma.captainMessage.count({
      where: {
        role: "USER",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        conversation: { shop, customerId },
      },
    });
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

    const userMessage = await prisma.captainMessage.create({
      data: { conversationId: conversation.id, role: "USER", content: message },
    });
    try {
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
        }),
      );
    } catch (error) {
      await prisma.captainMessage
        .delete({ where: { id: userMessage.id } })
        .catch(() => undefined);
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
