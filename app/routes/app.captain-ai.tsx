/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

function jsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function shortId(value: string) {
  const end = value.split("/").pop() || value;
  return end.length > 14 ? `${end.slice(0, 6)}…${end.slice(-6)}` : end;
}

async function customerNames(admin: any, ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  try {
    const result = await admin.graphql(
      `#graphql
        query CaptainCustomerNames($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Customer { id displayName }
          }
        }
      `,
      { variables: { ids: [...new Set(ids)].slice(0, 250) } },
    );
    const json: any = await result.json();
    return new Map(
      (json.data?.nodes ?? [])
        .filter((node: any) => node?.id)
        .map((node: any) => [node.id, node.displayName || shortId(node.id)]),
    );
  } catch (error) {
    console.warn("Captain AI-klantnamen ophalen mislukt", error);
    return new Map<string, string>();
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [
    conversations,
    conversationCount,
    messageCount,
    positiveCount,
    negativeCount,
    tokens,
  ] = await Promise.all([
    prisma.captainConversation.findMany({
      where: { shop: session.shop },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 30 } },
    }),
    prisma.captainConversation.count({ where: { shop: session.shop } }),
    prisma.captainMessage.count({
      where: { conversation: { shop: session.shop } },
    }),
    prisma.captainMessage.count({
      where: { feedback: 1, conversation: { shop: session.shop } },
    }),
    prisma.captainMessage.count({
      where: { feedback: -1, conversation: { shop: session.shop } },
    }),
    prisma.captainMessage.aggregate({
      where: { conversation: { shop: session.shop } },
      _sum: { inputTokens: true, outputTokens: true },
    }),
  ]);
  const names = await customerNames(
    admin,
    conversations
      .map((item) => item.customerId)
      .filter((id) => id.startsWith("gid://shopify/Customer/")),
  );

  return {
    stats: {
      conversations: conversationCount,
      messages: messageCount,
      positive: positiveCount,
      negative: negativeCount,
      inputTokens: tokens._sum.inputTokens || 0,
      outputTokens: tokens._sum.outputTokens || 0,
    },
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      customer: String(
        names.get(conversation.customerId) ||
          `Klant ${shortId(conversation.customerId)}`,
      ),
      customerId: conversation.customerId,
      profileId: conversation.profileId,
      improvementConsent: conversation.improvementConsent,
      channel: conversation.channel,
      boatContext: conversation.boatContext,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: [...conversation.messages].reverse().map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        feedback: message.feedback,
        sources: jsonArray(message.sources),
        products: jsonArray(message.products),
        model: message.model,
        inputTokens: message.inputTokens,
        outputTokens: message.outputTokens,
        createdAt: message.createdAt.toISOString(),
      })),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const id = String(form.get("id") || "");
  if (intent !== "delete" || !id)
    return { success: false, message: "Onbekende actie." };

  const deleted = await prisma.captainConversation.deleteMany({
    where: { id, shop: session.shop },
  });
  return deleted.count
    ? {
        success: true,
        message: "Captain AI-gesprek en gekoppelde berichten verwijderd.",
      }
    : { success: false, message: "Gesprek niet gevonden." };
};

export default function CaptainAiAdmin() {
  const { stats, conversations } = useLoaderData<typeof loader>();
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

  return (
    <s-page heading="Captain AI-beheer">
      <s-section heading="Overzicht">
        <s-stack direction="block" gap="base">
          <s-text>Gesprekken: {stats.conversations}</s-text>
          <s-text>Opgeslagen berichten: {stats.messages}</s-text>
          <s-text>
            Nuttige antwoorden: {stats.positive} · niet goed: {stats.negative}
          </s-text>
          <s-text>
            AI-verbruik: {stats.inputTokens.toLocaleString("nl-NL")}{" "}
            invoertokens · {stats.outputTokens.toLocaleString("nl-NL")}{" "}
            uitvoertokens
          </s-text>
          <s-paragraph>
            Captain AI gebruikt feedback als gecontroleerde verbeterdata. Er
            vindt geen automatische, onbeheerde hertraining plaats. Controleer
            negatieve feedback voordat instructies of bronnen worden aangepast.
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section heading="Recente gesprekken">
        <s-stack direction="block" gap="base">
          {conversations.length === 0 && (
            <s-text>Nog geen Captain AI-gesprekken.</s-text>
          )}
          {conversations.map((conversation) => (
            <s-box
              key={conversation.id}
              padding="base"
              border="base"
              borderRadius="base"
            >
              <s-stack direction="block" gap="small-300">
                <s-heading>{conversation.title}</s-heading>
                <s-text>
                  {conversation.channel === "PUBLIC"
                    ? "Websitebezoeker"
                    : conversation.customer}{" "}
                  ·{" "}
                  {conversation.channel === "PUBLIC"
                    ? "handmatig bootadvies"
                    : `bootprofiel ${shortId(conversation.profileId)}`}
                </s-text>
                <s-text>
                  Bijgewerkt{" "}
                  {new Date(conversation.updatedAt).toLocaleString("nl-NL")} ·
                  toestemming voor gebruik als verbeterdata:{" "}
                  {conversation.improvementConsent ? "ja" : "nee"}
                </s-text>
                {conversation.messages.map((message) => (
                  <s-box
                    key={message.id}
                    padding="base"
                    border="base"
                    borderRadius="base"
                  >
                    <s-stack direction="block" gap="small-300">
                      <s-text>
                        {message.role === "USER" ? "Klant" : "Captain AI"} ·{" "}
                        {new Date(message.createdAt).toLocaleString("nl-NL")}
                      </s-text>
                      <s-paragraph>{message.content}</s-paragraph>
                      {message.feedback === 1 && (
                        <s-text>Feedback: nuttig</s-text>
                      )}
                      {message.feedback === -1 && (
                        <s-text>Feedback: niet goed — controleren</s-text>
                      )}
                      {message.sources.map((source: any, index: number) =>
                        source.url ? (
                          <s-link
                            key={`${source.url}-${index}`}
                            href={source.url}
                            target="_blank"
                          >
                            Bron: {source.title || source.url}
                          </s-link>
                        ) : (
                          <s-text key={`${source.title}-${index}`}>
                            Handleiding: {source.title}
                          </s-text>
                        ),
                      )}
                      {message.products.map((product: any) => (
                        <s-link
                          key={product.id}
                          href={product.url}
                          target="_blank"
                        >
                          Aanbevolen product: {product.title}
                        </s-link>
                      ))}
                      {message.model && (
                        <s-text>
                          Model: {message.model} · tokens:{" "}
                          {message.inputTokens || 0}/{message.outputTokens || 0}
                        </s-text>
                      )}
                    </s-stack>
                  </s-box>
                ))}
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={conversation.id} />
                  <s-button
                    type="submit"
                    tone="critical"
                    disabled={fetcher.state !== "idle"}
                  >
                    Gesprek definitief verwijderen
                  </s-button>
                </fetcher.Form>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      </s-section>

      <s-section heading="Privacy en kwaliteit">
        <s-paragraph>
          Gesprekken zijn per Shopify-klant en bootprofiel gescheiden. Gebruik
          deze gegevens uitsluitend voor de werking en gecontroleerde
          verbetering van Captain AI, stel een bewaartermijn vast en verwerk
          verwijderverzoeken vanuit het klantaccount.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
