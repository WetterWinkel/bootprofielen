import type {ActionFunctionArgs, LoaderFunctionArgs} from "react-router";
import {authenticate, unauthenticated} from "../shopify.server";

const METAOBJECT_TYPE = "$app:bootprofiel";
const METAFIELD_NAMESPACE = "$app";
const METAFIELD_KEY = "bootprofielen";

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
    }));
}

async function setLinkedIds(admin: any, customerId: string, ids: string[]) {
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
          namespace: METAFIELD_NAMESPACE,
          key: METAFIELD_KEY,
          type: "list.metaobject_reference",
          value: JSON.stringify(ids),
        }],
      },
    },
  );
  const json: any = await result.json();
  const errors = json.data?.metafieldsSet?.userErrors ?? json.errors ?? [];
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
    const {admin, cors, customerId} = await context(request);
    const profiles = await linkedProfiles(admin, customerId);
    const ownedIds = profiles.map((profile: any) => profile.id);
    const body = await request.json();

    if (request.method === "POST") {
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
      return cors(response({success: true, message: "Bootprofiel opgeslagen", profile: {id: created.id, data}}));
    }

    const profileId = String(body.id ?? "");
    if (!profileId || !ownedIds.includes(profileId)) {
      return cors(response({success: false, message: "Bootprofiel niet gevonden"}, 404));
    }

    if (request.method === "PATCH") {
      const data = cleanProfile(body.data);
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
      return cors(response({success: true, message: "Bootprofiel bijgewerkt", profile: {id: profileId, data}}));
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
      return cors(response({success: true, message: "Bootprofiel verwijderd"}));
    }

    return cors(response({success: false, message: "Methode niet toegestaan"}, 405));
  } catch (error: any) {
    console.error("========== BOOTPROFIEL ERROR ==========", error);
    return response({success: false, message: error?.message ?? "Onbekende fout"}, 500);
  }
}
