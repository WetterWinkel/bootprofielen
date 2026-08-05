import type {ActionFunctionArgs, LoaderFunctionArgs} from "react-router";
import {authenticate, unauthenticated} from "../shopify.server";

const METAOBJECT_TYPE = "$app:bootprofiel";
const METAFIELD_NAMESPACE = "$app";
const METAFIELD_KEY = "bootprofielen";
const OVERVIEW_METAFIELD_NAMESPACE = "custom";
const OVERVIEW_METAFIELD_KEY = "bootprofielen_overzicht";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

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
  };
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
    const {admin, cors, customerId} = await context(request);
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
