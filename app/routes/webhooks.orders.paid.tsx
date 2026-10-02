/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { applyCaptainOrderLines, applyPaidCaptainPurchase } from "../lib/captain-billing.server";
import { authenticate } from "../shopify.server";

function attributes(payload: any) {
  return Object.fromEntries(
    (payload?.note_attributes ?? []).map((attribute: any) => [
      attribute.name,
      attribute.value,
    ]),
  );
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);
  const order: any = payload;
  const values = attributes(order);
  const listingToken = String(values.ww_bootadvertentie_token ?? "");
  const captainToken = String(values.ww_captain_credit_token ?? "");
  const paidOrderId = String(order?.id ?? "").startsWith("gid://")
    ? String(order.id)
    : `gid://shopify/Order/${order.id}`;

  console.log(`Received ${topic} webhook for ${shop}`, {
    bootadvertentie: Boolean(listingToken),
    captainAiTegoed: Boolean(captainToken),
    orderId: order?.id,
  });

  if (listingToken) {
    const listing = await prisma.boatListing.findUnique({
      where: { paymentToken: listingToken },
    });
    if (!listing || listing.shop !== shop) {
      console.warn("Betaalde bootadvertentie niet gevonden", {
        shop,
        orderId: order?.id,
      });
    } else {
      await prisma.boatListing.updateMany({
        where: {
          id: listing.id,
          shop,
          status: "AWAITING_PAYMENT",
        },
        data: {
          status: "PENDING_REVIEW",
          paidAt: new Date(),
          paidOrderId,
        },
      });
    }
  }

  if (captainToken) {
    const purchase = await prisma.captainCreditPurchase.findUnique({
      where: { paymentToken: captainToken },
    });
    if (!purchase || purchase.shop !== shop) {
      console.warn("Betaald Captain AI-tegoed niet gevonden", {
        shop,
        orderId: order?.id,
      });
    } else {
      await applyPaidCaptainPurchase(purchase, shop, paidOrderId);
    }
  }

  try {
    // Conceptorders met eigen token zijn hierboven al verwerkt.
    if (!captainToken) await applyCaptainOrderLines(shop, order);
  } catch (error) {
    console.error("Captain AI-product verwerken mislukt", error);
  }

  return new Response();
};
