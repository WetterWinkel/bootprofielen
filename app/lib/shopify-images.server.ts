/* eslint-disable @typescript-eslint/no-explicit-any */
import type {ListingPhoto} from "./boat-marketplace.server";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

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

export async function uploadShopifyImage(admin: any, input: any, alt: string): Promise<ListingPhoto> {
  const rawBase64 = String(input?.data ?? "").replace(/^data:[^;]+;base64,/, "");
  if (!rawBase64) throw new Error("Selecteer eerst een foto");
  const buffer = Buffer.from(rawBase64, "base64");
  if (!buffer.length) throw new Error("De foto kon niet worden gelezen");
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Een foto mag maximaal 20 MB zijn");

  const mimeType = imageMime(buffer);
  if (!mimeType) throw new Error("Gebruik een JPG-, PNG-, WebP-, GIF- of HEIC-foto");
  const filename = safeFilename(input?.filename);

  const stagedResult = await admin.graphql(
    `#graphql
      mutation StageBootmarktFoto($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }
    `,
    {variables: {input: [{filename, mimeType, httpMethod: "POST", resource: "IMAGE"}]}},
  );
  const stagedJson: any = await stagedResult.json();
  const stagedErrors = stagedJson.data?.stagedUploadsCreate?.userErrors ?? stagedJson.errors ?? [];
  const target = stagedJson.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target || stagedErrors.length) {
    throw new Error(stagedErrors[0]?.message || "Foto-upload voorbereiden mislukt");
  }

  const form = new FormData();
  for (const parameter of target.parameters ?? []) form.append(parameter.name, parameter.value);
  form.append("file", new Blob([new Uint8Array(buffer)], {type: mimeType}), filename);
  const uploaded = await fetch(target.url, {method: "POST", body: form});
  if (!uploaded.ok) throw new Error(`Foto uploaden mislukt (${uploaded.status})`);

  const fileResult = await admin.graphql(
    `#graphql
      mutation CreateBootmarktFoto($files: [FileCreateInput!]!) {
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
    {variables: {files: [{originalSource: target.resourceUrl, contentType: "IMAGE", alt}]}},
  );
  const fileJson: any = await fileResult.json();
  const errors = fileJson.data?.fileCreate?.userErrors ?? fileJson.errors ?? [];
  const file = fileJson.data?.fileCreate?.files?.[0];
  if (!file?.id || errors.length) {
    throw new Error(errors[0]?.message || "Foto opslaan in Shopify mislukt");
  }
  return {
    id: file.id,
    url: file.image?.url ?? null,
    alt: file.image?.altText ?? alt,
    source: "listing",
  };
}

export async function refreshShopifyImages(admin: any, photos: ListingPhoto[]) {
  const ids = photos.filter((photo) => photo.id && !photo.url).map((photo) => photo.id);
  if (!ids.length) return photos;
  const result = await admin.graphql(
    `#graphql
      query BootmarktFotos($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on MediaImage { id image { url altText } }
        }
      }
    `,
    {variables: {ids}},
  );
  const json: any = await result.json();
  const resolved = new Map(
    (json.data?.nodes ?? [])
      .filter((node: any) => node?.id && node?.image?.url)
      .map((node: any) => [node.id, node.image]),
  );
  return photos.map((photo) => {
    const image: any = photo.id ? resolved.get(photo.id) : null;
    return image ? {...photo, url: image.url, alt: image.altText || photo.alt} : photo;
  });
}

export async function deleteShopifyImage(admin: any, id: string | null) {
  if (!id) return;
  const result = await admin.graphql(
    `#graphql
      mutation DeleteBootmarktFoto($fileIds: [ID!]!) {
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
}
