/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { answerCaptainQuestion } from "../captain-ai.server";
import prisma from "../db.server";
import { authenticate, unauthenticated } from "../shopify.server";

const PUBLIC_QUESTION_LIMIT = 3;
const MAX_MESSAGE_LENGTH = 1_500;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function visitorCustomerId(value: unknown) {
  const visitorId = String(value ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(visitorId)) {
    throw new Error("Ongeldige Captain AI-sessie");
  }
  return `guest:${createHash("sha256").update(visitorId).digest("hex")}`;
}

function clean(value: unknown, max: number) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function boatContext(body: any) {
  return {
    merk_boot: clean(body.boat?.brand, 100),
    model_boot: clean(body.boat?.model, 100),
    lengte_meter: clean(body.boat?.length, 20),
    bouwjaar_boot: clean(body.boat?.year, 12),
    extra_bootinformatie: clean(body.boat?.details, 500),
    bron: "Handmatig opgegeven door websitebezoeker",
  };
}

async function proxyContext(request: Request) {
  const context = await authenticate.public.appProxy(request);
  const shop =
    context.session?.shop ||
    new URL(request.url).searchParams.get("shop") ||
    "";
  if (!shop) throw new Error("Shop ontbreekt");
  const admin = context.admin || (await unauthenticated.admin(shop)).admin;
  return { admin, shop };
}

async function publicConversation(shop: string, customerId: string) {
  return prisma.captainConversation.findFirst({
    where: { shop, customerId, channel: "PUBLIC", profileId: "manual" },
    orderBy: { updatedAt: "desc" },
  });
}

async function usedQuestions(conversationId?: string) {
  if (!conversationId) return 0;
  return prisma.captainMessage.count({
    where: { conversationId, role: "USER" },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { shop } = await proxyContext(request);
    const visitorId = new URL(request.url).searchParams.get("visitorId");
    const customerId = visitorCustomerId(visitorId);
    const conversation = await publicConversation(shop, customerId);
    const used = await usedQuestions(conversation?.id);
    return json({
      success: true,
      used,
      remaining: Math.max(0, PUBLIC_QUESTION_LIMIT - used),
    });
  } catch (error: any) {
    return json(
      { success: false, message: error?.message || "Sessie ophalen mislukt" },
      400,
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin, shop } = await proxyContext(request);
    const body = await request.json();
    const customerId = visitorCustomerId(body.visitorId);
    const message = clean(body.message, MAX_MESSAGE_LENGTH);
    const profileData = boatContext(body);
    if (!message)
      return json({ success: false, message: "Typ eerst een vraag." }, 400);
    if (
      !profileData.merk_boot &&
      !profileData.model_boot &&
      !profileData.lengte_meter &&
      !profileData.extra_bootinformatie
    ) {
      profileData.extra_bootinformatie = `Bootgegevens uit de vraag halen: ${message}`;
    }

    const publicDailyLimit = Math.max(
      1,
      Number(process.env.CAPTAIN_AI_PUBLIC_DAILY_LIMIT || 150),
    );
    const publicUsedToday = await prisma.captainMessage.count({
      where: {
        role: "USER",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        conversation: { shop, channel: "PUBLIC" },
      },
    });
    if (publicUsedToday >= publicDailyLimit) {
      return json(
        {
          success: false,
          message:
            "Captain AI heeft vandaag veel bezoekers geholpen. Probeer het morgen opnieuw of neem contact op met WetterWinkel.",
        },
        429,
      );
    }

    let conversation = await publicConversation(shop, customerId);
    const used = await usedQuestions(conversation?.id);
    if (used >= PUBLIC_QUESTION_LIMIT) {
      return json(
        {
          success: false,
          gated: true,
          remaining: 0,
          message:
            "Uw drie openbare Captain AI-vragen zijn gebruikt. Met een gratis bootprofiel kan Captain AI nauwkeuriger en met uw eigen bootgegevens verder adviseren.",
        },
        429,
      );
    }

    if (!conversation) {
      conversation = await prisma.captainConversation.create({
        data: {
          shop,
          customerId,
          profileId: "manual",
          channel: "PUBLIC",
          boatContext: profileData,
          title: message.slice(0, 80),
          improvementConsent: Boolean(body.improvementConsent),
        },
      });
    } else {
      conversation = await prisma.captainConversation.update({
        where: { id: conversation.id },
        data: {
          boatContext: profileData,
          improvementConsent:
            conversation.improvementConsent || Boolean(body.improvementConsent),
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
      const answer = await answerCaptainQuestion({
        admin,
        shop,
        customerId,
        profile: { id: "manual", data: profileData },
        serviceEntries: [],
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
      const questionNumber = used + 1;
      return json({
        success: true,
        remaining: Math.max(0, PUBLIC_QUESTION_LIMIT - questionNumber),
        gated: questionNumber >= PUBLIC_QUESTION_LIMIT,
        message: {
          id: saved.id,
          content: saved.content,
          sources: Array.isArray(saved.sources) ? saved.sources : [],
          products: Array.isArray(saved.products) ? saved.products : [],
        },
      });
    } catch (error) {
      await prisma.captainMessage
        .delete({ where: { id: userMessage.id } })
        .catch(() => undefined);
      throw error;
    }
  } catch (error: any) {
    console.error("Openbare Captain AI-vraag mislukt", error);
    const status = error?.status === 429 ? 429 : 500;
    return json(
      {
        success: false,
        message:
          error?.status === 429
            ? "Captain AI is tijdelijk druk. Probeer het over een minuut opnieuw."
            : error?.message || "Captain AI kon de vraag niet beantwoorden.",
      },
      status,
    );
  }
}
