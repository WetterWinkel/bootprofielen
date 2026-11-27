/* eslint-disable @typescript-eslint/no-explicit-any */
// Wat levert Captain AI op? Kosten (OpenAI) tegenover omzet uit bestellingen.
//
// Een bestelregel telt als "Captain-omzet" als:
//  1. het product via de Captain-knop in de app in de winkelwagen kwam (regelkenmerk _bron = "Captain AI"), of
//  2. Captain precies dat product aan dezelfde ingelogde klant aanraadde, binnen 14 dagen vóór de bestelling.
// Kosten zijn een schatting op basis van de opgeslagen tokens en webzoekopdrachten,
// met de prijzen hieronder (aanpasbaar via omgevingsvariabelen).
import prisma from "../db.server";

const PRICE_IN = Number(process.env.CAPTAIN_PRICE_INPUT_PER_M || 2); // USD per 1M invoertokens (GPT-5.6 Terra)
const PRICE_OUT = Number(process.env.CAPTAIN_PRICE_OUTPUT_PER_M || 12); // USD per 1M uitvoertokens
const PRICE_SEARCH = Number(process.env.CAPTAIN_PRICE_PER_SEARCH || 0.01); // USD per webzoekopdracht
const WINDOW_DAYS = 14;

const numericId = (gid: string) => String(gid || "").split("/").pop() || "";

export async function captainRoi(admin: any, shop: string, days = 30) {
  const since = new Date(Date.now() - days * 86400000);

  // ---- Kosten ----
  const usage = await prisma.captainMessage.aggregate({
    where: { role: "ASSISTANT", createdAt: { gte: since }, conversation: { shop } },
    _sum: { inputTokens: true, outputTokens: true, webSearches: true },
    _count: { _all: true },
  });
  const questions = await prisma.captainMessage.count({
    where: { role: "USER", createdAt: { gte: since }, conversation: { shop } },
  });
  const inTok = usage._sum.inputTokens || 0;
  const outTok = usage._sum.outputTokens || 0;
  const searches = usage._sum.webSearches || 0;
  const costUsd = (inTok / 1e6) * PRICE_IN + (outTok / 1e6) * PRICE_OUT + searches * PRICE_SEARCH;

  // ---- Aanbevelingen per klant (product + moment) ----
  const recMessages = await prisma.captainMessage.findMany({
    where: {
      role: "ASSISTANT",
      createdAt: { gte: new Date(since.getTime() - WINDOW_DAYS * 86400000) },
      conversation: { shop, customerId: { startsWith: "gid://shopify/Customer/" } },
    },
    select: { products: true, createdAt: true, conversation: { select: { customerId: true } } },
  });
  const recs = new Map<string, number[]>(); // `${customer}|${product}` -> tijdstippen
  for (const m of recMessages) {
    for (const p of (Array.isArray(m.products) ? (m.products as any[]) : [])) {
      const pid = numericId(p?.id || "");
      if (!pid) continue;
      const key = `${numericId(m.conversation.customerId)}|${pid}`;
      if (!recs.has(key)) recs.set(key, []);
      recs.get(key)!.push(m.createdAt.getTime());
    }
  }

  // ---- Bestellingen ----
  let revenue = 0;
  let currency = "EUR";
  let orders = 0;
  let viaButton = 0;
  let viaAdvice = 0;
  const topProducts = new Map<string, { title: string; amount: number; qty: number }>();
  let cursor: string | null = null;
  const query = `created_at:>=${since.toISOString().slice(0, 10)} -status:cancelled`;
  for (let page = 0; page < 20; page++) {
    const res: any = await (await admin.graphql(
      `#graphql
        query CaptainRoiOrders($q: String!, $after: String) {
          orders(first: 100, after: $after, query: $q, sortKey: CREATED_AT) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id createdAt
              customer { id }
              lineItems(first: 50) {
                nodes {
                  title quantity
                  product { id }
                  customAttributes { key value }
                  discountedTotalSet { shopMoney { amount currencyCode } }
                }
              }
            }
          }
        }`,
      { variables: { q: query, after: cursor } },
    )).json();
    if (res.errors?.length) throw new Error(res.errors[0].message);
    const conn = res.data?.orders;
    for (const order of conn?.nodes || []) {
      const customer = numericId(order.customer?.id || "");
      const at = Date.parse(order.createdAt);
      let counted = false;
      for (const li of order.lineItems?.nodes || []) {
        const pid = numericId(li.product?.id || "");
        const button = (li.customAttributes || []).some((a: any) => a.key === "_bron" && a.value === "Captain AI");
        const times = customer && pid ? recs.get(`${customer}|${pid}`) || [] : [];
        const advised = times.some((t) => t <= at && at - t <= WINDOW_DAYS * 86400000);
        if (!button && !advised) continue;
        const amount = Number(li.discountedTotalSet?.shopMoney?.amount || 0);
        currency = li.discountedTotalSet?.shopMoney?.currencyCode || currency;
        revenue += amount;
        if (button) viaButton++;
        else viaAdvice++;
        counted = true;
        const t = topProducts.get(li.title) || { title: li.title, amount: 0, qty: 0 };
        t.amount += amount;
        t.qty += Number(li.quantity) || 0;
        topProducts.set(li.title, t);
      }
      if (counted) orders++;
    }
    if (!conn?.pageInfo?.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }

  return {
    days,
    questions,
    answers: usage._count._all,
    inputTokens: inTok,
    outputTokens: outTok,
    webSearches: searches,
    costUsd: Math.round(costUsd * 100) / 100,
    costPerQuestionUsd: questions ? Math.round((costUsd / questions) * 1000) / 1000 : 0,
    revenue: Math.round(revenue * 100) / 100,
    currency,
    orders,
    lineItemsViaButton: viaButton,
    lineItemsViaAdvice: viaAdvice,
    revenuePerUsd: costUsd > 0 ? Math.round((revenue / costUsd) * 10) / 10 : null,
    topProducts: [...topProducts.values()].sort((a, b) => b.amount - a.amount).slice(0, 5),
    prices: { input: PRICE_IN, output: PRICE_OUT, search: PRICE_SEARCH },
  };
}
