import type {LoaderFunctionArgs} from "react-router";
import {createHmac, timingSafeEqual} from "node:crypto";
import PDFDocument from "pdfkit";
import {unauthenticated} from "../shopify.server";

const FIELD_LABELS: Record<string, string> = {
  naam_schip: "Naam schip",
  merk_boot: "Merk boot",
  model_boot: "Model boot",
  bouwjaar_boot: "Bouwjaar boot",
  hin_cin: "HIN / CIN nummer",
  registratienummer: "Registratienummer",
  boottype: "Boottype",
  materiaal_romp: "Materiaal romp",
  lengte: "Lengte (cm)",
  breedte: "Breedte (cm)",
  diepgang: "Diepgang (cm)",
  doorvaarthoogte: "Doorvaarthoogte (cm)",
  waterverplaatsing: "Waterverplaatsing (kg)",
  brandstof: "Brandstof",
  soort_motor: "Soort motor",
  motormerk: "Motormerk",
  motormodel: "Motormodel",
  bouwjaar_motor: "Bouwjaar motor",
  aantal_motoren: "Aantal motoren",
  motorvermogen: "Totaal vermogen (pk)",
  vaargebied: "Vaargebied",
  ligplaats: "Ligplaats",
  thuishaven: "Thuishaven",
  vaardagen_per_jaar: "Vaardagen per jaar",
  winterstalling: "Winterstalling",
  aantal_loodzuuraccus: "Aantal loodzuuraccu's",
  aantal_lithiumaccus: "Aantal lithiumaccu's",
  merk_generator: "Merk generator",
};

type ExportPayload = {
  shop: string;
  customerId: string;
  profileId: string;
  exp: number;
};

type ExportProfile = {
  name: string;
  data: Record<string, unknown>;
};

type MetaobjectField = {
  key: string;
  value: string;
};

type ExportQuery = {
  data?: {
    metaobject?: {
      displayName?: string;
      fields?: MetaobjectField[];
      photo?: {reference?: {image?: {url?: string}}};
    } | null;
  };
  errors?: Array<{message?: string}>;
};

function appSecret() {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) throw new Error("SHOPIFY_API_SECRET ontbreekt");
  return secret;
}

function verifyToken(token: string): ExportPayload {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) throw new Error("Ongeldige downloadlink");
  const expected = createHmac("sha256", appSecret()).update(encoded).digest();
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error("Ongeldige downloadlink");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (!payload.shop || !payload.customerId || !payload.profileId || payload.exp <= Date.now()) {
    throw new Error("De downloadlink is verlopen");
  }
  return payload;
}

function readableLabel(key: string) {
  return FIELD_LABELS[key] || key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function readableValue(value: unknown) {
  if (value === true) return "Ja";
  if (value === false) return "Nee";
  return String(value ?? "");
}

function visibleFields(data: Record<string, unknown>) {
  const order = Object.keys(FIELD_LABELS);
  return Object.entries(data)
    .filter(([, value]) => value !== "" && value !== null && value !== undefined && value !== false)
    .sort(([left], [right]) => {
      const leftIndex = order.indexOf(left);
      const rightIndex = order.indexOf(right);
      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    });
}

async function imageBuffer(url: string | null) {
  if (!url) return null;
  try {
    const result = await fetch(url);
    if (!result.ok) return null;
    const contentType = result.headers.get("content-type") || "";
    if (!contentType.includes("jpeg") && !contentType.includes("jpg") && !contentType.includes("png")) {
      return null;
    }
    const buffer = Buffer.from(await result.arrayBuffer());
    return buffer.length <= 20 * 1024 * 1024 ? buffer : null;
  } catch {
    return null;
  }
}

async function createPdf(profile: ExportProfile, photo: Buffer | null) {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({
    size: "A4",
    margins: {top: 52, right: 52, bottom: 58, left: 52},
    bufferPages: true,
    info: {
      Title: `Bootdossier ${profile.name}`,
      Author: "WetterWinkel",
      Subject: "Bootprofiel en serviceboek",
    },
  });
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fillColor("#07549b").fontSize(24).font("Helvetica-Bold")
    .text("WetterWinkel bootdossier");
  doc.moveDown(0.25).fillColor("#5b6770").fontSize(9).font("Helvetica")
    .text(`Geëxporteerd op ${new Intl.DateTimeFormat("nl-NL", {dateStyle: "long", timeStyle: "short"}).format(new Date())}`);
  doc.moveDown(1.3).fillColor("#17202a").fontSize(18).font("Helvetica-Bold")
    .text(profile.name);

  if (photo) {
    try {
      const y = doc.y + 10;
      doc.image(photo, doc.page.margins.left, y, {
        fit: [doc.page.width - doc.page.margins.left - doc.page.margins.right, 260],
        align: "center",
        valign: "center",
      });
      doc.y = y + 270;
    } catch {
      // Het dossier blijft bruikbaar als Shopify tijdelijk geen ondersteund
      // JPG- of PNG-bestand levert.
    }
  }

  doc.moveDown(0.6).fillColor("#07549b").fontSize(14).font("Helvetica-Bold")
    .text("Bootprofiel");
  doc.moveDown(0.5);

  const labelWidth = 175;
  const valueWidth = 300;
  for (const [key, rawValue] of visibleFields(profile.data)) {
    const label = readableLabel(key);
    const value = readableValue(rawValue);
    doc.fontSize(9);
    const rowHeight = Math.max(
      doc.font("Helvetica-Bold").heightOfString(label, {width: labelWidth}),
      doc.font("Helvetica").heightOfString(value, {width: valueWidth}),
    ) + 10;
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom - 10) {
      doc.addPage();
    }
    const rowY = doc.y;
    doc.fillColor("#f3f6f8").rect(doc.page.margins.left, rowY - 3, 491, rowHeight).fill();
    doc.fillColor("#34495e").font("Helvetica-Bold")
      .text(label, doc.page.margins.left + 6, rowY + 2, {width: labelWidth});
    doc.fillColor("#17202a").font("Helvetica")
      .text(value, doc.page.margins.left + labelWidth + 10, rowY + 2, {width: valueWidth});
    doc.y = rowY + rowHeight + 2;
  }

  if (doc.y > doc.page.height - 180) doc.addPage();
  doc.moveDown(1.2).fillColor("#07549b").fontSize(14).font("Helvetica-Bold")
    .text("Serviceboek");
  doc.moveDown(0.5).fillColor("#34495e").fontSize(10).font("Helvetica")
    .text("Er zijn nog geen serviceboekregels aan dit bootdossier toegevoegd. Zodra het WetterWinkel-serviceboek beschikbaar is, worden deze regels automatisch in deze export opgenomen.");

  const pages = doc.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index += 1) {
    doc.switchToPage(index);
    doc.fillColor("#7f8c8d").fontSize(8).font("Helvetica")
      .text(
        `WetterWinkel · pagina ${index - pages.start + 1} van ${pages.count}`,
        doc.page.margins.left,
        doc.page.height - 38,
        {width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: "center", lineBreak: false},
      );
  }

  doc.end();
  return finished;
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9 -]/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "bootdossier";
}

export async function loader({request}: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const payload = verifyToken(url.searchParams.get("token") || "");
    const {admin} = await unauthenticated.admin(payload.shop);
    const result = await admin.graphql(
      `#graphql
        query ExportBootprofiel($id: ID!) {
          metaobject(id: $id) {
            id
            displayName
            fields { key value }
            photo: field(key: "bootfoto") {
              reference {
                ... on MediaImage { image { url altText } }
              }
            }
          }
        }
      `,
      {variables: {id: payload.profileId}},
    );
    const json = await result.json() as ExportQuery;
    const node = json.data?.metaobject;
    if (!node || json.errors?.length) throw new Error("Bootprofiel niet gevonden");
    const fields: Record<string, string> = Object.fromEntries(
      (node.fields ?? []).map((field) => [field.key, field.value]),
    );
    if (fields.klant_id !== payload.customerId) {
      throw new Error("Dit bootprofiel hoort niet meer bij uw klantaccount");
    }
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(fields.data || "{}");
    } catch {
      data = {};
    }
    const name = String(data.naam_schip || data.model_boot || node.displayName || "Bootdossier");
    const photoUrl = node.photo?.reference?.image?.url ?? null;
    const pdf = await createPdf({name, data}, await imageBuffer(photoUrl));
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename(name)}-bootdossier.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    console.error("Bootdossier exporteren mislukt", error);
    return new Response(error instanceof Error ? error.message : "Exporteren mislukt", {
      status: 401,
      headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"},
    });
  }
}
