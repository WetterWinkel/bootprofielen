/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { answerCaptainQuestion } from "../captain-ai.server";
import prisma from "../db.server";
import { authenticate, unauthenticated } from "../shopify.server";

const METAFIELD_NAMESPACE = "$app";
const METAFIELD_KEY = "bootprofielen";
const MAX_MESSAGE_LENGTH = 1500;
const DAY_MS = 24 * 60 * 60 * 1000;
const STOREFRONT_LIMIT = 6;
const TRIAL_PROFILE_ID = "anonymous-trial";
const UNPROFILED_PROFILE_ID = "account-without-profile";
const PROFILE_URL = "/customer_authentication/redirect?locale=nl&region_country=NL";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function customerGid(value: string) {
  return value.startsWith("gid://shopify/Customer/")
    ? value
    : `gid://shopify/Customer/${value}`;
}

function visitorToken(request: Request) {
  const url = new URL(request.url);
  return String(url.searchParams.get("visitor_id") || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 96);
}

function anonymousCustomerId(request: Request, shop: string) {
  const forwardedFor = String(
    request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "",
  )
    .split(",")[0]
    .trim()
    .slice(0, 120);
  const userAgent = String(request.headers.get("user-agent") || "").slice(0, 300);
  const token = visitorToken(request) || "no-browser-token";
  const fingerprint = createHash("sha256")
    .update(`${shop}|${token}|${forwardedFor}|${userAgent}`)
    .digest("hex")
    .slice(0, 48);
  return `anon:${fingerprint}`;
}

function safeContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, any>;
  const product =
    source.product && typeof source.product === "object"
      ? {
          id: String(source.product.id || "").slice(0, 80),
          title: String(source.product.title || "").slice(0, 240),
          handle: String(source.product.handle || "").slice(0, 180),
          url: String(source.product.url || "").slice(0, 500),
          vendor: String(source.product.vendor || "").slice(0, 180),
          type: String(source.product.type || "").slice(0, 180),
          description: String(source.product.description || "").slice(0, 1800),
          price: String(source.product.price || "").slice(0, 80),
          variantId: String(source.product.variantId || "").slice(0, 100),
          variantTitle: String(source.product.variantTitle || "").slice(0, 240),
          sku: String(source.product.sku || "").slice(0, 180),
          image: String(source.product.image || "").slice(0, 600),
          tags: Array.isArray(source.product.tags)
            ? source.product.tags.slice(0, 40).map((tag: unknown) => String(tag).slice(0, 100))
            : [],
        }
      : null;
  const collection =
    source.collection && typeof source.collection === "object"
      ? {
          id: String(source.collection.id || "").slice(0, 80),
          title: String(source.collection.title || "").slice(0, 240),
          handle: String(source.collection.handle || "").slice(0, 180),
          url: String(source.collection.url || "").slice(0, 500),
        }
      : null;
  return {
    pageType: String(source.pageType || "").slice(0, 80),
    url: String(source.url || "").slice(0, 600),
    product,
    collection,
  };
}

async function storefrontContext(request: Request) {
  await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const shop = String(url.searchParams.get("shop") || "").trim();
  const rawCustomerId = String(
    url.searchParams.get("logged_in_customer_id") || "",
  ).trim();

  if (!shop) throw new Error("Shop ontbreekt in de beveiligde aanvraag.");

  const { admin } = await unauthenticated.admin(shop);
  const shopifyCustomerId = rawCustomerId ? customerGid(rawCustomerId) : "";
  const customerId =
    shopifyCustomerId || anonymousCustomerId(request, shop);

  return {
    shop,
    customerId,
    shopifyCustomerId,
    isAnonymous: !shopifyCustomerId,
    admin,
  };
}

async function ownedProfiles(admin: any, customerId: string) {
  if (!customerId) return [];
  const result = await admin.graphql(
    `#graphql
      query StorefrontCaptainBootprofielen($customerId: ID!) {
        customer(id: $customerId) {
          metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
            references(first: 100) {
              nodes {
                ... on Metaobject {
                  id
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
  const payload: any = await result.json();
  if (payload.errors?.length) throw new Error(payload.errors[0].message);

  return (payload.data?.customer?.metafield?.references?.nodes || []).flatMap(
    (node: any) => {
      const fields = Object.fromEntries(
        (node.fields || []).map((field: any) => [field.key, field.value]),
      );
      if (fields.klant_id !== customerId) return [];
      try {
        return [{ id: node.id, data: JSON.parse(fields.data || "{}") }];
      } catch {
        return [{ id: node.id, data: {} }];
      }
    },
  );
}

function profileName(profile: any) {
  return String(
    profile?.data?.naam_schip ||
      profile?.data?.merk_boot ||
      profile?.data?.model_boot ||
      "uw boot",
  );
}

async function usage(
  shop: string,
  customerId: string,
  profileId: string,
  hasProfile: boolean,
) {
  const where: any = {
    role: "USER",
    conversation: {
      shop,
      customerId,
      profileId,
      channel: "STOREFRONT",
    },
  };

  // Zonder profiel zijn de zes vragen de totale proefruimte. Met profiel krijgt
  // de klant iedere 24 uur opnieuw zes persoonlijke adviesvragen.
  if (hasProfile) {
    where.createdAt = { gte: new Date(Date.now() - DAY_MS) };
  }

  const used = await prisma.captainMessage.count({ where });
  return {
    limit: STOREFRONT_LIMIT,
    used,
    remaining: Math.max(0, STOREFRONT_LIMIT - used),
  };
}

function pageContextText(context: Record<string, any>) {
  if (context.product) {
    return `HUIDIGE WEBSHOPPAGINA
De klant bekijkt nu dit WetterWinkel-product:
${JSON.stringify(context.product, null, 2)}
Gebruik dit als verkoop- en toepassingscontext. Verzin geen ontbrekende variant- of productspecificaties.`;
  }
  if (context.collection) {
    return `HUIDIGE WEBSHOPPAGINA
De klant bekijkt nu de WetterWinkel-collectie:
${JSON.stringify(context.collection, null, 2)}
Gebruik dit als verkoop- en toepassingscontext.`;
  }
  return `HUIDIGE WEBSHOPPAGINA
Pagina: ${String(context.url || "WetterWinkel")}`;
}

function detectSalesCategory(message: string, context: Record<string, any>) {
  const haystack = [
    message,
    context.product?.title,
    context.product?.type,
    context.product?.description,
    context.product?.handle,
    context.collection?.title,
    context.collection?.handle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/antifouling|onderwaterschip|aangroei|primer/.test(haystack)) return "antifouling";
  if (/fenderlijn|fendertouw|fender touw/.test(haystack)) return "fenderlijn";
  if (/fender|stootwil|stootkussen/.test(haystack)) return "fender";
  if (/landvast|aanmeerlijn|meertouw|landvastveer|compensator/.test(haystack)) return "landvast";
  if (/navigatieverlichting|boordlicht|heklicht|toplicht|ankerlicht/.test(haystack)) return "navigatieverlichting";
  if (/reddingsvest|zwemvest|dierenzwemvest|hondenzwemvest|kinderzwemvest/.test(haystack)) return "zwemvest";
  if (/koelkast|koelbox|koellade|koelunit/.test(haystack)) return "koeling";
  return "algemeen";
}

function categorySalesRules(category: string) {
  switch (category) {
    case "antifouling":
      return `ANTIFOULING-VERKOOPFLOW
- Vraag eerst welk rompmateriaal het onderwaterschip heeft: staal, polyester, hout of aluminium, tenzij dat al bekend is.
- Vraag daarna alleen indien nodig naar bestaande antifouling/coating en of er al primer aanwezig is.
- Vraag alleen indien relevant naar zoet, zout of brak water en naar de staat van de bestaande laag.
- Zodra de basis past, adviseer direct geschikte WetterWinkel-antifouling en verkoop aanvullend de passende primer, rollers/kwasten, verfbak en eventuele verdunner/reiniger die werkelijk in WetterWinkel beschikbaar zijn.
- Voor hoeveelheid mag je bootlengte, breedte/diepgang of te behandelen oppervlakte uitvragen, maar voorkom een vragenvuur.`;
    case "fender":
      return `FENDER-VERKOOPFLOW
- Vraag eerst naar boottype en bootlengte als die nog ontbreken; vraag daarna alleen indien maatkeuze dit nodig maakt naar gewicht/verplaatsing, vrijboord en ligplaats (box, langssteiger, sluizen of veel passantenhavens).
- Adviseer zo snel mogelijk aantal, type en maat fenders op basis van betrouwbare gegevens.
- Zoek en selecteer naast de fenders ook passende fenderlijnen en, wanneer zinvol, fenderhoezen of andere relevante fendertoebehoren uit WetterWinkel.`;
    case "fenderlijn":
      return `FENDERLIJN-VERKOOPFLOW
- Vraag welke fendermaat/type de klant gebruikt en waar de lijn wordt bevestigd (reling, scepter, kikker/cleat) als dit nog niet bekend is.
- Vraag alleen indien nodig gewenste lengte/kleur/diameter.
- Adviseer direct passende WetterWinkel-fenderlijnen en koppel waar relevant ook de juiste fenders of fendertoebehoren als upsell.`;
    case "landvast":
      return `LANDVASTEN-VERKOOPFLOW
- Vraag eerst bootlengte en daarna alleen indien nodig gewicht/verplaatsing en gebruik: vaste ligplaats, passantenhaven, sluis of reserve-landvast.
- Vraag indien maat/lengte dit bepaalt naar afstand tot de wal/steiger en bevestigingspunten.
- Adviseer direct diameter, lengte en aantal en zoek passende WetterWinkel-landvasten.
- Upsell uitsluitend relevante landvastveren/compensatoren, lijnbescherming of aanlegtoebehoren die werkelijk in WetterWinkel staan.`;
    case "navigatieverlichting":
      return `NAVIGATIEVERLICHTING-VERKOOPFLOW
- Vraag naar boottype/lengte en 12V of 24V wanneer dit voor de keuze relevant is.
- Vraag indien nodig welke positie/lichtfunctie nodig is (bakboord, stuurboord, hek, top, anker of gecombineerd) en hoe het wordt gemonteerd.
- Adviseer daarna passende WetterWinkel-verlichting en relevante lampen, schakelaars, zekeringen of aansluitmaterialen alleen als ze technisch bij de toepassing passen.`;
    case "zwemvest":
      return `ZWEMVEST-VERKOOPFLOW
- Bepaal eerst voor wie het vest is: volwassene, kind of hond/dier. Vraag daarna gewicht en gebruiksomstandigheden als die nog ontbreken.
- Maak duidelijk verschil tussen drijfhulp/zwemvest en reddingsvest wanneer dat relevant is.
- Adviseer passende WetterWinkel-producten en alleen zinvolle aanvullende veiligheidsproducten.`;
    case "koeling":
      return `KOELING-VERKOOPFLOW
- Vraag naar beschikbare inbouwruimte of gewenste inhoud en 12V/24V/230V wanneer dit nog ontbreekt.
- Vraag alleen indien nodig naar inbouw versus losse koelbox en ventilatiemogelijkheden.
- Adviseer passende WetterWinkel-koeling en technisch relevante aansluit-/ventilatieproducten als upsell.`;
    default:
      return `ALGEMENE VERKOOPFLOW
- Achterhaal met maximaal één gerichte vervolgvraag per antwoord waarvoor de klant het product op de boot wil gebruiken.
- Vraag alleen gegevens die de productkeuze echt veranderen: boottype, materiaal, lengte, spanning, maat, montage of gebruiksomstandigheden.
- Geef zodra verantwoord meteen een voorlopig productadvies en zoek passende WetterWinkel-producten.
- Kijk bij ieder hoofdproduct actief naar één of twee logische aanvullende producten (montage, onderhoud, veiligheid of gebruik), maar verkoop niets dat technisch niet relevant is.`;
  }
}

function salesFlowText({
  turn,
  remainingAfter,
  hasProfile,
  category,
}: {
  turn: number;
  remainingAfter: number;
  hasProfile: boolean;
  category: string;
}) {
  return `WETTERWINKEL VERKOOPGESPREK — VERPLICHT
Dit is klantbeurt ${turn} van maximaal ${STOREFRONT_LIMIT}. Na dit antwoord zijn nog ${remainingAfter} AI-beurten over.
${
  hasProfile
    ? "De klant heeft een echt bootprofiel. Gebruik bekende profielgegevens en vraag die niet opnieuw."
    : "De klant gebruikt de proefmodus zonder opgeslagen bootprofiel. Gebruik antwoorden uit dit lopende gesprek, maar beweer nooit dat ze blijvend zijn opgeslagen."
}
- Gedraag je als een behulpzame watersportverkoper die doorvraagt én verkoopt, niet als een passieve helpdesk.
- Stel per antwoord maximaal ÉÉN nieuwe gerichte vraag in follow_up. Nooit drie of vier vragen tegelijk.
- Vraag niets opnieuw wat al uit deze conversatie, het echte bootprofiel of de huidige productpagina blijkt.
- Wacht niet met verkopen tot elk detail bekend is: toon zodra technisch verantwoord alvast 1 tot 4 passende WetterWinkel-producten en benoem in het tekstadvies welke controle nog nodig is.
- Zoek bij een hoofdproduct ook naar relevante upsell/cross-sell, maar selecteer alleen producten die werkelijk uit de WetterWinkel-catalogus komen en technisch logisch passen.
- Laat op beurt 6 follow_up leeg en maak het antwoord afrondend: geef het beste advies en de beste productselectie die met de bekende gegevens mogelijk is. De interface neemt daarna de profieluitnodiging over.

${categorySalesRules(category)}`;
}

function shouldOfferProfile(usedAfter: number, hasProfile: boolean) {
  return !hasProfile && (usedAfter === 2 || usedAfter === 4 || usedAfter >= STOREFRONT_LIMIT);
}

function conversationProfileId(profile: any, isAnonymous: boolean) {
  if (profile?.id) return profile.id;
  return isAnonymous ? TRIAL_PROFILE_ID : UNPROFILED_PROFILE_ID;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { shop, customerId, shopifyCustomerId, isAnonymous, admin } =
      await storefrontContext(request);
    const profiles = shopifyCustomerId
      ? await ownedProfiles(admin, shopifyCustomerId)
      : [];
    const profile = profiles[0] || null;
    const profileId = conversationProfileId(profile, isAnonymous);
    const currentUsage = await usage(
      shop,
      customerId,
      profileId,
      Boolean(profile),
    );

    const conversations = await prisma.captainConversation.findMany({
      where: {
        shop,
        customerId,
        profileId,
        channel: "STOREFRONT",
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true, updatedAt: true },
    });
    const requestedConversationId = new URL(request.url).searchParams.get(
      "conversation_id",
    );
    const activeConversationId = conversations.some(
      (conversation) => conversation.id === requestedConversationId,
    )
      ? requestedConversationId
      : conversations[0]?.id;
    const recentConversation = activeConversationId
      ? await prisma.captainConversation.findFirst({
          where: {
            id: activeConversationId,
            shop,
            customerId,
            profileId,
            channel: "STOREFRONT",
          },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 12,
        },
      },
        })
      : null;
    const history = (recentConversation?.messages || [])
      .slice()
      .reverse()
      .map((message: any) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        products: message.products || [],
      }));

    return json({
      success: true,
      profileId: profile?.id || "",
      profileName: profile ? profileName(profile) : "",
      hasProfile: Boolean(profile),
      isAnonymous,
      limit: currentUsage.limit,
      used: currentUsage.used,
      remaining: currentUsage.remaining,
      limitReached: currentUsage.remaining <= 0,
      profilePrompt: shouldOfferProfile(currentUsage.used, Boolean(profile)),
      profileUrl: PROFILE_URL,
      conversationId: recentConversation?.id || "",
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt.toISOString(),
      })),
      history,
    });
  } catch (error: any) {
    console.error("Captain AI storefront laden mislukt", error);
    return json(
      {
        success: false,
        message: error?.message || "Captain AI kon niet worden verbonden.",
      },
      400,
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { shop, customerId, shopifyCustomerId, isAnonymous, admin } =
      await storefrontContext(request);
    const body = await request.json();
    const profiles = shopifyCustomerId
      ? await ownedProfiles(admin, shopifyCustomerId)
      : [];
    const profile =
      profiles.find((item: any) => item.id === body.profileId) || profiles[0] || null;
    const profileId = conversationProfileId(profile, isAnonymous);

    if (body.intent === "new_conversation") {
      const conversation = await prisma.captainConversation.create({
        data: {
          shop,
          customerId,
          profileId,
          channel: "STOREFRONT",
          boatContext: profile?.data || {},
          title: "Nieuw gesprek",
        },
      });
      return json({
        success: true,
        conversation: {
          id: conversation.id,
          title: conversation.title,
          updatedAt: conversation.updatedAt.toISOString(),
        },
      });
    }

    const rawMessage = String(body.message || "").trim();
    if (!rawMessage || rawMessage.length > MAX_MESSAGE_LENGTH) {
      return json(
        {
          success: false,
          message: `Vul een vraag in van maximaal ${MAX_MESSAGE_LENGTH} tekens.`,
        },
        400,
      );
    }
    const currentUsage = await usage(
      shop,
      customerId,
      profileId,
      Boolean(profile),
    );

    if (currentUsage.remaining <= 0) {
      return json(
        {
          success: false,
          limitReached: true,
          profilePrompt: !profile,
          requiresProfile: !profile,
          profileUrl: PROFILE_URL,
          remaining: 0,
          message: profile
            ? "Uw zes Captain AI-adviesvragen voor vandaag zijn gebruikt. Morgen kunt u weer verder."
            : "U heeft de zes gratis Captain AI-adviesvragen gebruikt. Maak een gratis bootprofiel aan om Captain persoonlijk te maken en verder te kunnen met gerichter advies.",
        },
        429,
      );
    }

    let conversation = await prisma.captainConversation.findFirst({
      where: {
        ...(body.conversationId ? { id: String(body.conversationId) } : {}),
        shop,
        customerId,
        profileId,
        channel: "STOREFRONT",
      },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
    });

    if (!conversation) {
      conversation = await prisma.captainConversation.create({
        data: {
          shop,
          customerId,
          profileId,
          channel: "STOREFRONT",
          boatContext: profile?.data || {},
          title: profile ? "Webshopadvies" : "Webshopadvies proefmodus",
        },
        include: { messages: true },
      });
    }

    const context = safeContext(body.context);
    const category = detectSalesCategory(rawMessage, context);
    const previousMessages = conversation.messages.slice(-10).map((message: any) => ({
      role: message.role,
      content: message.content,
    }));
    const turn = currentUsage.used + 1;
    const remainingAfter = Math.max(0, currentUsage.remaining - 1);
    const aiMessage = `${rawMessage}

${pageContextText(context)}

${salesFlowText({
      turn,
      remainingAfter,
      hasProfile: Boolean(profile),
      category,
    })}`;

    const serviceEntries = profile
      ? await prisma.serviceBookEntry.findMany({
          where: {
            shop,
            customerId: shopifyCustomerId,
            profileId: profile.id,
          },
          orderBy: { serviceDate: "desc" },
          take: 30,
        })
      : [];

    // De AI-functie verwacht technisch een profielobject. In proefmodus geven we
    // uitsluitend een expliciete proefmarkering mee; er worden geen bootgegevens verzonnen.
    const profileForAi =
      profile ||
      ({
        id: profileId,
        data: { proefmodus_zonder_opgeslagen_bootprofiel: true },
      } as any);

    const result = await answerCaptainQuestion({
      admin,
      shop,
      customerId,
      profile: profileForAi,
      serviceEntries,
      messages: [
        ...previousMessages,
        { role: "USER", content: aiMessage },
      ],
    });

    const [, assistantMessage] = await prisma.$transaction([
      prisma.captainMessage.create({
        data: {
          conversationId: conversation.id,
          role: "USER",
          content: rawMessage,
          usageType: "FREE",
        },
      }),
      prisma.captainMessage.create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: result.text,
          sources: result.sources,
          products: result.products,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
      }),
      prisma.captainConversation.update({
        where: { id: conversation.id },
        data: {
          boatContext: profile?.data || {},
          title: rawMessage.slice(0, 80),
        },
      }),
    ]);

    const usedAfter = currentUsage.used + 1;
    return json({
      success: true,
      limit: STOREFRONT_LIMIT,
      used: usedAfter,
      remaining: remainingAfter,
      limitReached: remainingAfter <= 0,
      profilePrompt: shouldOfferProfile(usedAfter, Boolean(profile)),
      profileUrl: PROFILE_URL,
      hasProfile: Boolean(profile),
      conversationId: conversation.id,
      message: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        sources: assistantMessage.sources,
        products: assistantMessage.products,
      },
    });
  } catch (error: any) {
    console.error("Captain AI storefront beantwoorden mislukt", error);
    return json(
      {
        success: false,
        message:
          error?.message ||
          "Captain AI kon deze vraag tijdelijk niet beantwoorden.",
      },
      500,
    );
  }
}
