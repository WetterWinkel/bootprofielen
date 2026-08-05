/* eslint-disable @typescript-eslint/no-explicit-any */
import {html} from "./boat-marketplace.server";

type Inquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
};

type Listing = {
  customerId: string;
  slug: string;
  title: string;
};

type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey: string;
};

export type InquiryEmailResult = {
  sellerSent: boolean;
  interestedPartySent: boolean;
};

function storefrontUrl() {
  return String(process.env.PUBLIC_STORE_URL || "https://www.wetterwinkel.nl")
    .trim()
    .replace(/\/$/, "");
}

function emailFrom() {
  return String(
    process.env.MARKETPLACE_EMAIL_FROM ||
      "WetterWinkel Bootmarkt <bootmarkt@wetterwinkel.nl>",
  ).trim();
}

async function sendEmail(message: EmailMessage) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    console.warn("Bootmarkt e-mail niet verzonden: RESEND_API_KEY ontbreekt");
    return false;
  }

  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": message.idempotencyKey,
    },
    body: JSON.stringify({
      from: emailFrom(),
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? {reply_to: message.replyTo} : {}),
    }),
  });

  if (!result.ok) {
    const errorText = await result.text().catch(() => "");
    console.error("Bootmarkt e-mailprovider weigerde bericht", {
      status: result.status,
      response: errorText.slice(0, 500),
    });
    return false;
  }
  return true;
}

async function sellerContact(admin: any, customerId: string) {
  const result = await admin.graphql(
    `#graphql
      query BootmarktVerkoperContact($id: ID!) {
        customer(id: $id) {
          displayName
          defaultEmailAddress { emailAddress }
        }
      }
    `,
    {variables: {id: customerId}},
  );
  const json: any = await result.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "Verkoper kon niet worden opgehaald");
  }
  const customer = json.data?.customer;
  return {
    name: String(customer?.displayName || "verkoper"),
    email: String(customer?.defaultEmailAddress?.emailAddress || "").trim(),
  };
}

function emailShell(content: string) {
  return `<div style="margin:0;background:#f5f8fb;padding:32px 16px;font-family:Arial,sans-serif;color:#17324f">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #dce5ec;border-radius:16px;padding:32px">
      <div style="font-size:24px;font-weight:800;color:#073d82;margin-bottom:24px">WetterWinkel Bootmarkt</div>
      ${content}
      <p style="margin-top:28px;color:#60758b;font-size:13px">Dit is een automatisch servicebericht over de WetterWinkel Bootmarkt.</p>
    </div>
  </div>`;
}

export async function sendMarketplaceInquiryEmails(
  admin: any,
  listing: Listing,
  inquiry: Inquiry,
): Promise<InquiryEmailResult> {
  const seller = await sellerContact(admin, listing.customerId);
  const storeUrl = storefrontUrl();
  const portalUrl = `${storeUrl}/account/profile`;
  const listingUrl = `${storeUrl}/apps/bootmarkt/${encodeURIComponent(listing.slug)}`;
  const phoneLine = inquiry.phone ? `Telefoonnummer: ${inquiry.phone}\n` : "";

  const sellerMessage: EmailMessage | null = seller.email ? {
    to: seller.email,
    subject: `Nieuwe reactie op uw bootadvertentie: ${listing.title}`,
    replyTo: inquiry.email,
    idempotencyKey: `bootmarkt-${inquiry.id}-seller`,
    html: emailShell(`
      <h1 style="font-size:24px;margin:0 0 14px">Nieuwe reactie op uw bootadvertentie</h1>
      <p><strong>${html(inquiry.name)}</strong> heeft gereageerd op <strong>${html(listing.title)}</strong>.</p>
      <div style="background:#f4f9fd;border:1px solid #d5e7f3;border-radius:12px;padding:18px;margin:20px 0;line-height:1.55">
        <p style="margin:0 0 8px"><strong>E-mail:</strong> ${html(inquiry.email)}</p>
        ${inquiry.phone ? `<p style="margin:0 0 8px"><strong>Telefoon:</strong> ${html(inquiry.phone)}</p>` : ""}
        <p style="margin:0"><strong>Bericht:</strong><br>${html(inquiry.message).replaceAll("\n", "<br>")}</p>
      </div>
      <p>De reactie staat ook veilig in uw WetterWinkel-portaal. U kunt rechtstreeks op deze e-mail antwoorden om de geïnteresseerde te bereiken.</p>
      <p><a href="${html(portalUrl)}" style="display:inline-block;background:#0671ce;color:#fff;text-decoration:none;padding:13px 20px;border-radius:9px;font-weight:700">Naar mijn bootprofiel</a></p>
    `),
    text: `Nieuwe reactie op uw bootadvertentie: ${listing.title}\n\nNaam: ${inquiry.name}\nE-mail: ${inquiry.email}\n${phoneLine}Bericht: ${inquiry.message}\n\nBekijk de reactie in uw WetterWinkel-portaal: ${portalUrl}\n\nU kunt rechtstreeks op deze e-mail antwoorden om de geïnteresseerde te bereiken.`,
  } : null;

  const interestedPartyMessage: EmailMessage = {
    to: inquiry.email,
    subject: `Uw bericht over ${listing.title} is verstuurd`,
    idempotencyKey: `bootmarkt-${inquiry.id}-interested`,
    html: emailShell(`
      <h1 style="font-size:24px;margin:0 0 14px">Uw bericht is verstuurd</h1>
      <p>Beste ${html(inquiry.name)},</p>
      <p>Uw bericht over <strong>${html(listing.title)}</strong> is geplaatst in het WetterWinkel-portaal van de verkoper.</p>
      <p>De verkoper heeft uw naam, e-mailadres, eventuele telefoonnummer en bericht ontvangen en kan rechtstreeks contact met u opnemen.</p>
      <div style="background:#f4f9fd;border:1px solid #d5e7f3;border-radius:12px;padding:18px;margin:20px 0;line-height:1.55">
        ${html(inquiry.message).replaceAll("\n", "<br>")}
      </div>
      <p><a href="${html(listingUrl)}" style="display:inline-block;background:#0671ce;color:#fff;text-decoration:none;padding:13px 20px;border-radius:9px;font-weight:700">Advertentie bekijken</a></p>
      <p style="color:#60758b">WetterWinkel biedt uitsluitend advertentieruimte en is geen partij bij een mogelijke verkoop. Controleer de boot, verkoper en documenten altijd zelf.</p>
    `),
    text: `Beste ${inquiry.name},\n\nUw bericht over ${listing.title} is geplaatst in het WetterWinkel-portaal van de verkoper. De verkoper kan rechtstreeks contact met u opnemen.\n\nUw bericht:\n${inquiry.message}\n\nAdvertentie: ${listingUrl}\n\nWetterWinkel biedt uitsluitend advertentieruimte en is geen partij bij een mogelijke verkoop.`,
  };

  const [sellerResult, interestedPartyResult] = await Promise.all([
    sellerMessage ? sendEmail(sellerMessage) : Promise.resolve(false),
    sendEmail(interestedPartyMessage),
  ]);

  return {
    sellerSent: sellerResult,
    interestedPartySent: interestedPartyResult,
  };
}
