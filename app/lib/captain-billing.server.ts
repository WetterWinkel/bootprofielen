/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomBytes } from "node:crypto";
import prisma from "../db.server";

// Betaalopties voor Captain AI in de webshop, na de 6 gratis vragen per dag.
// Bedragen in centen, inclusief btw (zoals de winkelprijzen).
function envInt(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function captainPacks() {
  const passDays = envInt("CAPTAIN_PASS_DAYS", 30);
  const passPrice = envInt("CAPTAIN_PASS_PRICE_CENTS", 1000);
  const packCredits = envInt("CAPTAIN_PACK_CREDITS", 15);
  const packPrice = envInt("CAPTAIN_PACK_PRICE_CENTS", 500);
  return [
    {
      id: "pass",
      title: `Maandpas – ${passDays} dagen onbeperkt`,
      label: "Maandpas",
      description: `${passDays} dagen onbeperkt vragen. Stopt vanzelf, geen abonnement.`,
      priceCents: passPrice,
      credits: 0,
      passDays,
      sku: `WW-CAPTAIN-PAS-${passDays}`,
    },
    {
      id: "pack",
      title: `Captain AI-tegoed – ${packCredits} vragen`,
      label: `${packCredits} vragen`,
      description: `${packCredits} extra adviesvragen, 12 maanden geldig.`,
      priceCents: packPrice,
      credits: packCredits,
      passDays: 0,
      sku: `WW-CAPTAIN-${packCredits}`,
    },
  ];
}

export function passDailyLimit() {
  // Redelijk gebruik binnen de maandpas, beschermt tegen misbruik.
  return envInt("CAPTAIN_PASS_DAILY_LIMIT", 40);
}

export function euro(cents: number) {
  return `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export async function captainBalance(shop: string, customerId: string) {
  if (!customerId || customerId.startsWith("anon:")) {
    return { credits: 0, passUntil: null as Date | null, passActive: false };
  }
  const row = await prisma.captainCreditBalance.findUnique({
    where: { shop_customerId: { shop, customerId } },
  });
  const passUntil = row?.passUntil ?? null;
  return {
    credits: row?.credits ?? 0,
    passUntil,
    passActive: Boolean(passUntil && passUntil.getTime() > Date.now()),
  };
}

/** Haalt één tegoedvraag af. Geeft false als er geen tegoed meer is. */
export async function spendCredit(shop: string, customerId: string) {
  const res = await prisma.captainCreditBalance.updateMany({
    where: { shop, customerId, credits: { gt: 0 } },
    data: { credits: { decrement: 1 } },
  });
  return res.count > 0;
}

export async function createCaptainCheckout(
  admin: any,
  shop: string,
  customerId: string,
  packId: string,
) {
  const pack = captainPacks().find((p) => p.id === packId);
  if (!pack) throw new Error("Onbekende Captain AI-optie.");
  const paymentToken = randomBytes(24).toString("hex");
  const purchase = await prisma.captainCreditPurchase.create({
    data: {
      shop,
      customerId,
      credits: pack.credits,
      passDays: pack.passDays,
      priceCents: pack.priceCents,
      paymentToken,
    },
  });
  try {
    const result = await admin.graphql(
      `#graphql
        mutation CaptainAiBetaling($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder { id invoiceUrl }
            userErrors { field message }
          }
        }`,
      {
        variables: {
          input: {
            purchasingEntity: { customerId },
            presentmentCurrencyCode: "EUR",
            useCustomerDefaultAddress: true,
            visibleToCustomer: true,
            allowDiscountCodesInCheckout: false,
            tags: ["captain-ai", pack.passDays ? "ai-maandpas" : "ai-tegoed"],
            note: `WetterWinkel Captain AI – ${pack.title}`,
            customAttributes: [
              { key: "ww_captain_credit_token", value: paymentToken },
              { key: "ww_captain_option", value: pack.id },
            ],
            lineItems: [
              {
                title: pack.title,
                quantity: 1,
                originalUnitPriceWithCurrency: {
                  amount: (pack.priceCents / 100).toFixed(2),
                  currencyCode: "EUR",
                },
                requiresShipping: false,
                taxable: true,
                sku: pack.sku,
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
      throw new Error(errors[0]?.message || "Shopify kon de betaling niet voorbereiden.");
    }
    await prisma.captainCreditPurchase.update({
      where: { id: purchase.id },
      data: { draftOrderId: payload.draftOrder.id },
    });
    return payload.draftOrder.invoiceUrl as string;
  } catch (error) {
    await prisma.captainCreditPurchase.delete({ where: { id: purchase.id } }).catch(() => undefined);
    throw error;
  }
}

/** Verwerkt een betaalde aankoop precies één keer (tegoed of maandpas). */
export async function applyPaidCaptainPurchase(purchase: any, shop: string, paidOrderId: string) {
  await prisma.$transaction(async (tx) => {
    const marked = await tx.captainCreditPurchase.updateMany({
      where: { id: purchase.id, shop, paidAt: null },
      data: { paidAt: new Date(), paidOrderId },
    });
    if (!marked.count) return;
    const key = { shop_customerId: { shop, customerId: purchase.customerId } };
    const current = await tx.captainCreditBalance.findUnique({ where: key });
    let passUntil = current?.passUntil ?? null;
    if (purchase.passDays > 0) {
      const base = passUntil && passUntil.getTime() > Date.now() ? passUntil.getTime() : Date.now();
      passUntil = new Date(base + purchase.passDays * 24 * 60 * 60 * 1000);
    }
    await tx.captainCreditBalance.upsert({
      where: key,
      create: { shop, customerId: purchase.customerId, credits: purchase.credits, passUntil },
      update: { credits: { increment: purchase.credits }, passUntil },
    });
  });
}

/** Vangnet als de orders/paid-webhook (nog) niet binnen is: controleer open conceptorders. */
export async function reconcileCaptainPurchases(admin: any, shop: string, customerId: string) {
  if (!customerId || customerId.startsWith("anon:")) return;
  const purchases = await prisma.captainCreditPurchase.findMany({
    where: { shop, customerId, paidAt: null, draftOrderId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (!purchases.length) return;
  try {
    const ids = purchases.flatMap((p) => (p.draftOrderId ? [p.draftOrderId] : []));
    const result = await admin.graphql(
      `#graphql
        query CaptainBetalingenControleren($ids: [ID!]!) {
          nodes(ids: $ids) { ... on DraftOrder { id status order { id } } }
        }`,
      { variables: { ids } },
    );
    const json: any = await result.json();
    for (const draft of json.data?.nodes ?? []) {
      if (draft?.status !== "COMPLETED" || !draft?.order?.id) continue;
      const purchase = purchases.find((p) => p.draftOrderId === draft.id);
      if (purchase) await applyPaidCaptainPurchase(purchase, shop, draft.order.id);
    }
  } catch (error) {
    console.warn("Captain AI-betaling controleren mislukt", error);
  }
}
