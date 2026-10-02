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
  const passCredits = envInt("CAPTAIN_PASS_CREDITS", 35);
  const packCredits = envInt("CAPTAIN_PACK_CREDITS", 15);
  const packPrice = envInt("CAPTAIN_PACK_PRICE_CENTS", 500);
  return [
    {
      id: "pass",
      title: `Captain AI-maandpas – ${passCredits} vragen in ${passDays} dagen`,
      label: `Maandpas · ${passCredits} vragen`,
      description: `${passCredits} adviesvragen, ${passDays} dagen geldig. Stopt vanzelf, geen abonnement.`,
      priceCents: passPrice,
      credits: passCredits,
      passDays,
      sku: "WW-CAPTAIN-PAS-35",
      variantId: process.env.CAPTAIN_PASS_VARIANT_ID || "57391483912532",
    },
    {
      id: "pack",
      title: `Captain AI-tegoed – ${packCredits} vragen`,
      label: `${packCredits} vragen`,
      description: `${packCredits} extra adviesvragen, geldig tot ze op zijn.`,
      priceCents: packPrice,
      credits: packCredits,
      passDays: 0,
      sku: "WW-CAPTAIN-15",
      variantId: process.env.CAPTAIN_PACK_VARIANT_ID || "57391484567892",
    },
  ];
}

export function euro(cents: number) {
  return `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export async function captainBalance(shop: string, customerId: string) {
  if (!customerId || customerId.startsWith("anon:")) {
    return { credits: 0, passCredits: 0, passUntil: null as Date | null, passActive: false, anonymous: false };
  }
  const row = await prisma.captainCreditBalance.findUnique({
    where: { shop_customerId: { shop, customerId } },
  });
  const passUntil = row?.passUntil ?? null;
  const passValid = Boolean(passUntil && passUntil.getTime() > Date.now());
  const passCredits = passValid ? row?.passCredits ?? 0 : 0;
  return {
    credits: row?.credits ?? 0,
    passCredits,
    passUntil,
    passActive: passValid && passCredits > 0,
    anonymous: row?.anonymous ?? false,
  };
}

/** Haalt één maandpasvraag af (alleen binnen de geldigheid). */
export async function spendPassCredit(shop: string, customerId: string) {
  const res = await prisma.captainCreditBalance.updateMany({
    where: { shop, customerId, passCredits: { gt: 0 }, passUntil: { gt: new Date() } },
    data: { passCredits: { decrement: 1 } },
  });
  return res.count > 0;
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
      // Maandpas: vragen gelden 30 dagen; een nieuwe pas tijdens een lopende pas telt op en verlengt.
      const active = passUntil && passUntil.getTime() > Date.now();
      const base = active ? passUntil!.getTime() : Date.now();
      passUntil = new Date(base + purchase.passDays * 24 * 60 * 60 * 1000);
      const passCredits = (active ? current?.passCredits ?? 0 : 0) + purchase.credits;
      await tx.captainCreditBalance.upsert({
        where: key,
        create: { shop, customerId: purchase.customerId, credits: 0, passCredits, passUntil },
        update: { passCredits, passUntil },
      });
      return;
    }
    await tx.captainCreditBalance.upsert({
      where: key,
      create: { shop, customerId: purchase.customerId, credits: purchase.credits },
      update: { credits: { increment: purchase.credits } },
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


export async function setCaptainAnonymous(shop: string, customerId: string, anonymous: boolean) {
  await prisma.captainCreditBalance.upsert({
    where: { shop_customerId: { shop, customerId } },
    create: { shop, customerId, anonymous },
    update: { anonymous },
  });
}

/**
 * Verwerkt Captain AI-producten die gewoon via de winkelwagen/kassa zijn gekocht.
 * Het tegoed komt op het klantaccount van de bestelling (Shopify koppelt bestellingen op e-mailadres).
 */
export async function applyCaptainOrderLines(shop: string, order: any) {
  const packs = captainPacks();
  const rawCustomer = order?.customer?.id ?? order?.customer?.admin_graphql_api_id;
  const lines = (order?.line_items ?? []).flatMap((line: any) => {
    const pack = packs.find(
      (p) => String(line.sku || "") === p.sku || String(line.variant_id || "") === p.variantId,
    );
    return pack ? [{ line, pack }] : [];
  });
  if (!lines.length) return;
  if (!rawCustomer) {
    console.warn("Captain AI-product besteld zonder klantaccount", { shop, orderId: order?.id });
    return;
  }
  const customerId = String(rawCustomer).startsWith("gid://")
    ? String(rawCustomer)
    : `gid://shopify/Customer/${rawCustomer}`;
  const paidOrderId = String(order.id).startsWith("gid://") ? String(order.id) : `gid://shopify/Order/${order.id}`;
  for (const { line, pack } of lines) {
    const quantity = Math.max(1, Number(line.quantity) || 1);
    const paymentToken = `order:${order.id}:${line.id}`;
    const existing = await prisma.captainCreditPurchase.findUnique({ where: { paymentToken } });
    if (existing?.paidAt) continue;
    const purchase =
      existing ??
      (await prisma.captainCreditPurchase.create({
        data: {
          shop,
          customerId,
          credits: pack.credits * quantity,
          passDays: pack.passDays,
          priceCents: pack.priceCents * quantity,
          paymentToken,
        },
      }));
    // paidOrderId is uniek per aankoop; bij meerdere regels alleen de eerste koppelen.
    await applyPaidCaptainPurchase(purchase, shop, lines[0].line === line ? paidOrderId : `${paidOrderId}#${line.id}`);
  }
}
