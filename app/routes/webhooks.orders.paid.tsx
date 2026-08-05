/* eslint-disable @typescript-eslint/no-explicit-any */
import type {ActionFunctionArgs} from "react-router";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";

function attributes(payload: any) {
  return Object.fromEntries(
    (payload?.note_attributes ?? []).map((attribute: any) => [attribute.name, attribute.value]),
  );
}

export const action = async ({request}: ActionFunctionArgs) => {
  const {payload, shop, topic} = await authenticate.webhook(request);
  const order: any = payload;
  const values = attributes(order);
  const token = String(values.ww_bootadvertentie_token ?? "");

  console.log(`Received ${topic} webhook for ${shop}`, {
    bootadvertentie: Boolean(token),
    orderId: order?.id,
  });

  if (!token) return new Response();

  const listing = await prisma.boatListing.findUnique({where: {paymentToken: token}});
  if (!listing || listing.shop !== shop) {
    console.warn("Betaalde bootadvertentie niet gevonden", {shop, orderId: order?.id});
    return new Response();
  }

  const paidOrderId = `gid://shopify/Order/${order.id}`;
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

  return new Response();
};
