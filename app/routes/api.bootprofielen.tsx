import type {ActionFunctionArgs, LoaderFunctionArgs} from "react-router";
import {createHmac, randomBytes} from "node:crypto";
import prisma from "../db.server";
import {authenticate, unauthenticated} from "../shopify.server";

const METAOBJECT_TYPE = "$app:bootprofiel";
const METAFIELD_NAMESPACE = "$app";
const METAFIELD_KEY = "bootprofielen";
const OVERVIEW_METAFIELD_NAMESPACE = "custom";
const OVERVIEW_METAFIELD_KEY = "bootprofielen_overzicht";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const TRANSFER_DAYS = 7;
const TRANSFER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

function customerGid(value: unknown) {
  const id = String(value ?? "");
  if (!id) throw new Error("Geen klant gevonden in het sessietoken");
  return id.startsWith("gid://shopify/Customer/")
    ? id
    : `gid://shopify/Customer/${id}`;
}

async function context(request: Request) {
  const {sessionToken, cors} =
    await authenticate.public.customerAccount(request);
  const destination = String((sessionToken as any).dest ?? "");
  if (!destination) throw new Error("Shop ontbreekt in het sessietoken");

  // Customer-account tokens can contain either a full URL or only the
  // myshopify.com hostname in `dest`.
  const shopDomain = new URL(
    destination.includes("://") ? destination : `https://${destination}`,
  ).hostname;
  const {admin} = await unauthenticated.admin(shopDomain);
  return {
    admin,
    cors,
    customerId: customerGid((sessionToken as any).sub),
    shopDomain,
  };
}

function appSecret() {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) throw new Error("SHOPIFY_API_SECRET ontbreekt");
  return secret;
}

function transferCode() {
  const bytes = randomBytes(8);
  const value = Array.from(bytes, (byte) =>
    TRANSFER_ALPHABET[byte % TRANSFER_ALPHABET.length],
  ).join("");
  return `WW-${value.slice(0, 4)}-${value.slice(4)}`;
}

function normalizedTransferCode(value: unknown) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function transferCodeHash(shopDomain: string, code: string) {
  return createHmac("sha256", appSecret())
    .update(`${shopDomain}|${normalizedTransferCode(code)}`)
    .digest("hex");
}

function exportToken(payload: {
  shop: string;
  customerId: string;
  profileId: string;
  exp: number;
}) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", appSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function exportUrl(request: Request, shopDomain: string, customerId: string, profileId: string) {
  const token = exportToken({
    shop: shopDomain,
    customerId,
    profileId,
    exp: Date.now() + 2 * 60 * 60 * 1000,
  });
  // Keep the PDF endpoint independent from the api.bootprofielen resource
  // route. A dotted filename below that resource becomes a nested route and
  // prevents a direct document download in the customer-account iframe.
  const url = new URL("/api/bootdossier-export", request.url);
  url.searchParams.set("token", token);
  return url.toString();
}

async function linkedProfiles(admin: any, customerId: string) {
  const result = await admin.graphql(
    `#graphql
      query CustomerBootprofielen($customerId: ID!) {
        customer(id: $customerId) {
          metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
            references(first: 100) {
              nodes {
                ... on Metaobject {
                  id
                  handle
                  updatedAt
                  fields { key value }
                  photo: field(key: "bootfoto") {
                    value
                    reference {
                      ... on MediaImage {
                        id
                        image { url altText }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    {variables: {customerId}},
  );
  const json: any = await result.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);

  const profiles = (json.data?.customer?.metafield?.references?.nodes ?? []).map(
    (node: any) => {
      const fields = Object.fromEntries(
        (node.fields ?? []).map((field: any) => [field.key, field.value]),
      );
      let data = {};
      try {
        data = JSON.parse(fields.data || "{}");
      } catch {
        data = {};
      }
      return {
        id: node.id,
        handle: node.handle,
        updatedAt: node.updatedAt,
        data,
        customerId: fields.klant_id,
        photoId: node.photo?.reference?.id ?? node.photo?.value ?? null,
        photoUrl: node.photo?.reference?.image?.url ?? null,
        photoAlt: node.photo?.reference?.image?.altText ?? null,
      };
    },
  );

  return profiles
    .filter((profile: any) => profile.customerId === customerId)
    .map((profile: any) => ({
      id: profile.id,
      handle: profile.handle,
      updatedAt: profile.updatedAt,
      data: profile.data,
      photoId: profile.photoId,
      photoUrl: profile.photoUrl,
      photoAlt: profile.photoAlt,
    }));
}

function safeFilename(value: unknown) {
  const filename = String(value ?? "bootfoto")
    .split(/[\\/]/)
    .pop()
    ?.replace(/[^a-zA-Z0-9._ -]/g, "-")
    .slice(0, 120);
  return filename || "bootfoto";
}

function imageMime(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  const firstSix = buffer.subarray(0, 6).toString("ascii");
  if (firstSix === "GIF87a" || firstSix === "GIF89a") return "image/gif";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii").toLowerCase();
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
      return "image/heic";
    }
  }
  return null;
}

async function deleteFile(admin: any, id: string | null | undefined) {
  if (!id) return;
  try {
    const result = await admin.graphql(
      `#graphql
        mutation DeleteBootfoto($fileIds: [ID!]!) {
          fileDelete(fileIds: $fileIds) {
            deletedFileIds
            userErrors { field message code }
          }
        }
      `,
      {variables: {fileIds: [id]}},
    );
    const json: any = await result.json();
    const errors = json.data?.fileDelete?.userErrors ?? json.errors ?? [];
    if (errors.length) throw new Error(errors[0].message);
  } catch (error) {
    console.warn("Oude bootfoto verwijderen mislukt", error);
  }
}

async function uploadPhoto(admin: any, profile: any, input: any) {
  const rawBase64 = String(input.data ?? "").replace(/^data:[^;]+;base64,/, "");
  if (!rawBase64) throw new Error("Selecteer eerst een foto");

  const buffer = Buffer.from(rawBase64, "base64");
  if (!buffer.length) throw new Error("De foto kon niet worden gelezen");
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("De bootfoto mag maximaal 20 MB zijn");
  }

  const mimeType = imageMime(buffer);
  if (!mimeType) {
    throw new Error("Gebruik een JPG-, PNG-, WebP-, GIF- of HEIC-foto");
  }

  const filename = safeFilename(input.filename);
  const stagedResult = await admin.graphql(
    `#graphql
      mutation StageBootfoto($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters { name value }
          }
          userErrors { field message }
        }
      }
    `,
    {
      variables: {
        input: [{
          filename,
          mimeType,
          httpMethod: "POST",
          resource: "IMAGE",
        }],
      },
    },
  );
  const stagedJson: any = await stagedResult.json();
  const stagedErrors = stagedJson.data?.stagedUploadsCreate?.userErrors ?? stagedJson.errors ?? [];
  const target = stagedJson.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target || stagedErrors.length) {
    throw new Error(stagedErrors[0]?.message || "Foto-upload voorbereiden mislukt");
  }

  const form = new FormData();
  for (const parameter of target.parameters ?? []) {
    form.append(parameter.name, parameter.value);
  }
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], {type: mimeType}),
    filename,
  );
  const uploaded = await fetch(target.url, {method: "POST", body: form});
  if (!uploaded.ok) {
    throw new Error(`Foto uploaden mislukt (${uploaded.status})`);
  }

  const alt = String(profile.data?.naam_schip || profile.data?.model_boot || "Bootfoto");
  const fileResult = await admin.graphql(
    `#graphql
      mutation CreateBootfoto($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            fileStatus
            alt
            ... on MediaImage { image { url altText } }
          }
          userErrors { field message code }
        }
      }
    `,
    {
      variables: {
        files: [{
          originalSource: target.resourceUrl,
          contentType: "IMAGE",
          alt,
        }],
      },
    },
  );
  const fileJson: any = await fileResult.json();
  const fileErrors = fileJson.data?.fileCreate?.userErrors ?? fileJson.errors ?? [];
  const file = fileJson.data?.fileCreate?.files?.[0];
  if (!file?.id || fileErrors.length) {
    throw new Error(fileErrors[0]?.message || "Foto opslaan in Shopify mislukt");
  }

  const updateResult = await admin.graphql(
    `#graphql
      mutation LinkBootfoto($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject { id updatedAt }
          userErrors { field message code }
        }
      }
    `,
    {
      variables: {
        id: profile.id,
        metaobject: {fields: [{key: "bootfoto", value: file.id}]},
      },
    },
  );
  const updateJson: any = await updateResult.json();
  const updateErrors = updateJson.data?.metaobjectUpdate?.userErrors ?? updateJson.errors ?? [];
  if (updateErrors.length) {
    await deleteFile(admin, file.id);
    throw new Error(updateErrors[0].message);
  }

  if (profile.photoId && profile.photoId !== file.id) {
    await deleteFile(admin, profile.photoId);
  }

  return {
    ...profile,
    photoId: file.id,
    photoUrl: file.image?.url ?? null,
    photoAlt: file.image?.altText ?? alt,
  };
}

async function setLinkedIds(admin: any, customerId: string, ids: string[]) {
  const setMetafield = async (namespace: string, key: string) => {
    const result = await admin.graphql(
      `#graphql
        mutation LinkBootprofielen($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors { field message code }
          }
        }
      `,
      {
        variables: {
          metafields: [{
            ownerId: customerId,
            namespace,
            key,
            type: "list.metaobject_reference",
            value: JSON.stringify(ids),
          }],
        },
      },
    );
    const json: any = await result.json();
    const errors = json.data?.metafieldsSet?.userErrors ?? json.errors ?? [];
    if (errors.length) throw new Error(errors[0].message);
  };

  // Het appveld blijft de beveiligde bron die de klantaccount-API gebruikt.
  await setMetafield(METAFIELD_NAMESPACE, METAFIELD_KEY);

  // Deze merchant-owned spiegel is alleen voor een vast overzicht in Shopify
  // Admin. Opslaan voor de klant mag nooit stuklopen als dit overzicht nog
  // niet eenmalig door de winkelier is ingesteld.
  try {
    await setMetafield(OVERVIEW_METAFIELD_NAMESPACE, OVERVIEW_METAFIELD_KEY);
  } catch (error) {
    console.warn("Bootprofielen-klantoverzicht synchroniseren mislukt", error);
  }
}

async function setProfileCustomer(admin: any, profileId: string, customerId: string) {
  const result = await admin.graphql(
    `#graphql
      mutation TransferBootprofiel($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message code }
        }
      }
    `,
    {
      variables: {
        id: profileId,
        metaobject: {fields: [{key: "klant_id", value: customerId}]},
      },
    },
  );
  const json: any = await result.json();
  const errors = json.data?.metaobjectUpdate?.userErrors ?? json.errors ?? [];
  if (errors.length) throw new Error(errors[0].message);
}

function cleanProfile(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Ongeldige bootprofielgegevens");
  }
  const profile = Object.fromEntries(
    Object.entries(input).filter(([, value]) =>
      value !== undefined && value !== null && value !== ""),
  );
  if (!profile.naam_schip && !profile.merk_boot && !profile.model_boot) {
    throw new Error("Vul minimaal de naam, het merk of het model van de boot in");
  }
  return profile;
}

export async function loader({request}: LoaderFunctionArgs) {
  // React Router can route a CORS preflight to the loader. It must succeed
  // without authentication so customer-account extensions may call this API.
  if (request.method === "OPTIONS") {
    return response({success: true});
  }

  try {
    const {admin, cors, customerId} = await context(request);
    const profiles = await linkedProfiles(admin, customerId);
    return cors(response({success: true, profiles}));
  } catch (error: any) {
    console.error("Bootprofielen ophalen mislukt", error);
    return response({success: false, message: error?.message ?? "Ophalen mislukt"}, 500);
  }
}

export async function action({request}: ActionFunctionArgs) {
  if (request.method === "OPTIONS") return response({success: true});

  try {
    const {admin, cors, customerId, shopDomain} = await context(request);
    const profiles = await linkedProfiles(admin, customerId);
    const ownedIds = profiles.map((profile: any) => profile.id);
    const body = await request.json();

    if (request.method === "POST") {
      if (body.intent === "upload_photo") {
        const profileId = String(body.id ?? "");
        const profile = profiles.find((item: any) => item.id === profileId);
        if (!profile) {
          return cors(response({success: false, message: "Bootprofiel niet gevonden"}, 404));
        }
        const updated = await uploadPhoto(admin, profile, body.photo);
        return cors(response({
          success: true,
          message: updated.photoUrl
            ? "Bootfoto opgeslagen"
            : "Bootfoto opgeslagen en wordt door WetterWinkel verwerkt in uw profiel.",
          profile: updated,
        }));
      }

      if (body.intent === "create_export") {
        const profileId = String(body.id ?? "");
        if (!profiles.some((item: any) => item.id === profileId)) {
          return cors(response({success: false, message: "Bootprofiel niet gevonden"}, 404));
        }
        return cors(response({
          success: true,
          message: "De PDF staat klaar.",
          url: exportUrl(request, shopDomain, customerId, profileId),
        }));
      }

      if (body.intent === "create_transfer") {
        const profileId = String(body.id ?? "");
        if (!profiles.some((item: any) => item.id === profileId)) {
          return cors(response({success: false, message: "Bootprofiel niet gevonden"}, 404));
        }

        const code = transferCode();
        const expiresAt = new Date(Date.now() + TRANSFER_DAYS * 24 * 60 * 60 * 1000);
        await prisma.boatTransfer.upsert({
          where: {shop_profileId: {shop: shopDomain, profileId}},
          create: {
            shop: shopDomain,
            profileId,
            fromCustomerId: customerId,
            codeHash: transferCodeHash(shopDomain, code),
            expiresAt,
          },
          update: {
            fromCustomerId: customerId,
            codeHash: transferCodeHash(shopDomain, code),
            expiresAt,
            createdAt: new Date(),
          },
        });
        return cors(response({
          success: true,
          message: "Overdrachtscode aangemaakt. De boot blijft van u totdat de koper de code accepteert.",
          code,
          expiresAt: expiresAt.toISOString(),
        }));
      }

      if (body.intent === "cancel_transfer") {
        const profileId = String(body.id ?? "");
        await prisma.boatTransfer.deleteMany({
          where: {shop: shopDomain, profileId, fromCustomerId: customerId},
        });
        return cors(response({success: true, message: "De overdrachtscode is ingetrokken."}));
      }

      if (body.intent === "claim_transfer") {
        const code = normalizedTransferCode(body.code);
        if (!/^WW[A-Z2-9]{8}$/.test(code)) {
          return cors(response({success: false, message: "Vul een geldige WetterWinkel-overdrachtscode in."}, 400));
        }

        const transfer = await prisma.boatTransfer.findUnique({
          where: {codeHash: transferCodeHash(shopDomain, code)},
        });
        if (!transfer || transfer.shop !== shopDomain) {
          return cors(response({success: false, message: "Deze overdrachtscode bestaat niet."}, 404));
        }
        if (transfer.expiresAt.getTime() <= Date.now()) {
          await prisma.boatTransfer.delete({where: {id: transfer.id}});
          return cors(response({success: false, message: "Deze overdrachtscode is verlopen."}, 410));
        }
        if (transfer.fromCustomerId === customerId) {
          return cors(response({success: false, message: "U kunt uw eigen boot niet ontvangen."}, 400));
        }

        const sourceProfiles = await linkedProfiles(admin, transfer.fromCustomerId);
        const sourceProfile = sourceProfiles.find((item: any) => item.id === transfer.profileId);
        if (!sourceProfile) {
          await prisma.boatTransfer.delete({where: {id: transfer.id}});
          return cors(response({success: false, message: "Dit bootprofiel is niet meer overdraagbaar."}, 409));
        }

        const sourceIds = sourceProfiles.map((item: any) => item.id);
        const targetIds = [...new Set([...ownedIds, transfer.profileId])];
        const claimed = await prisma.boatTransfer.deleteMany({where: {id: transfer.id}});
        if (claimed.count !== 1) {
          return cors(response({success: false, message: "Deze overdrachtscode is al gebruikt."}, 409));
        }

        try {
          await setProfileCustomer(admin, transfer.profileId, customerId);
          await setLinkedIds(admin, customerId, targetIds);
          await setLinkedIds(
            admin,
            transfer.fromCustomerId,
            sourceIds.filter((id: string) => id !== transfer.profileId),
          );
        } catch (transferError) {
          try {
            await setProfileCustomer(admin, transfer.profileId, transfer.fromCustomerId);
            await setLinkedIds(admin, transfer.fromCustomerId, sourceIds);
            await setLinkedIds(admin, customerId, ownedIds);
          } catch (rollbackError) {
            console.error("Bootprofieloverdracht terugdraaien mislukt", rollbackError);
          }
          if (transfer.expiresAt.getTime() > Date.now()) {
            try {
              await prisma.boatTransfer.create({
                data: {
                  id: transfer.id,
                  shop: transfer.shop,
                  profileId: transfer.profileId,
                  fromCustomerId: transfer.fromCustomerId,
                  codeHash: transfer.codeHash,
                  expiresAt: transfer.expiresAt,
                  createdAt: transfer.createdAt,
                },
              });
            } catch (restoreError) {
              console.error("Overdrachtscode herstellen mislukt", restoreError);
            }
          }
          throw transferError;
        }

        const updatedProfiles = await linkedProfiles(admin, customerId);
        return cors(response({
          success: true,
          message: "Het bootprofiel is veilig aan uw klantaccount gekoppeld.",
          profile: updatedProfiles.find((item: any) => item.id === transfer.profileId),
          profiles: updatedProfiles,
        }));
      }

      const data = cleanProfile(body);
      const result = await admin.graphql(
        `#graphql
          mutation CreateBootprofiel($metaobject: MetaobjectCreateInput!) {
            metaobjectCreate(metaobject: $metaobject) {
              metaobject { id handle }
              userErrors { field message code }
            }
          }
        `,
        {
          variables: {
            metaobject: {
              type: METAOBJECT_TYPE,
              fields: [
                {key: "naam", value: String((data as any).naam_schip || (data as any).model_boot || "Boot")},
                {key: "data", value: JSON.stringify(data)},
                {key: "klant_id", value: customerId},
              ],
            },
          },
        },
      );
      const json: any = await result.json();
      const created = json.data?.metaobjectCreate?.metaobject;
      const errors = json.data?.metaobjectCreate?.userErrors ?? json.errors ?? [];
      if (!created || errors.length) throw new Error(errors[0]?.message || "Aanmaken mislukt");

      await setLinkedIds(admin, customerId, [...new Set([...ownedIds, created.id])]);
      return cors(response({
        success: true,
        message: "Bootprofiel opgeslagen",
        profile: {id: created.id, data, photoId: null, photoUrl: null, photoAlt: null},
      }));
    }

    const profileId = String(body.id ?? "");
    if (!profileId || !ownedIds.includes(profileId)) {
      return cors(response({success: false, message: "Bootprofiel niet gevonden"}, 404));
    }

    if (request.method === "PATCH") {
      const data = cleanProfile(body.data);
      const current = profiles.find((profile: any) => profile.id === profileId);
      const result = await admin.graphql(
        `#graphql
          mutation UpdateBootprofiel($id: ID!, $metaobject: MetaobjectUpdateInput!) {
            metaobjectUpdate(id: $id, metaobject: $metaobject) {
              metaobject { id handle }
              userErrors { field message code }
            }
          }
        `,
        {
          variables: {
            id: profileId,
            metaobject: {fields: [
              {key: "naam", value: String((data as any).naam_schip || (data as any).model_boot || "Boot")},
              {key: "data", value: JSON.stringify(data)},
            ]},
          },
        },
      );
      const json: any = await result.json();
      const errors = json.data?.metaobjectUpdate?.userErrors ?? json.errors ?? [];
      if (errors.length) throw new Error(errors[0].message);
      return cors(response({
        success: true,
        message: "Bootprofiel bijgewerkt",
        profile: {...current, id: profileId, data},
      }));
    }

    if (request.method === "DELETE") {
      await prisma.boatTransfer.deleteMany({
        where: {shop: shopDomain, profileId, fromCustomerId: customerId},
      });
      await setLinkedIds(admin, customerId, ownedIds.filter((id: string) => id !== profileId));
      const result = await admin.graphql(
        `#graphql
          mutation DeleteBootprofiel($id: ID!) {
            metaobjectDelete(id: $id) { deletedId userErrors { field message code } }
          }
        `,
        {variables: {id: profileId}},
      );
      const json: any = await result.json();
      const errors = json.data?.metaobjectDelete?.userErrors ?? json.errors ?? [];
      if (errors.length) throw new Error(errors[0].message);
      const deleted = profiles.find((profile: any) => profile.id === profileId);
      await deleteFile(admin, deleted?.photoId);
      return cors(response({success: true, message: "Bootprofiel verwijderd"}));
    }

    return cors(response({success: false, message: "Methode niet toegestaan"}, 405));
  } catch (error: any) {
    console.error("========== BOOTPROFIEL ERROR ==========", error);
    return response({success: false, message: error?.message ?? "Onbekende fout"}, 500);
  }
}
