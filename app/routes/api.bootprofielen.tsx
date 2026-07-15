import type {ActionFunctionArgs, LoaderFunctionArgs} from "react-router";
import {authenticate, unauthenticated} from "../shopify.server";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}

export async function loader({request}: LoaderFunctionArgs) {
  return jsonResponse({
    success: true,
    message: "Bootprofielen API werkt",
  });
}

export async function action({request}: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return jsonResponse({success: true});
  }

  try {
    const {sessionToken, cors} =
      await authenticate.public.customerAccount(request);

    const customerId = (sessionToken as any).sub;
    const shop = new URL((sessionToken as any).dest).hostname;

    if (!customerId) {
      return cors(
        jsonResponse(
          {success: false, message: "Geen klant gevonden"},
          401,
        ),
      );
    }

    const data = await request.json();
    const {admin} = await unauthenticated.admin(shop);

    const createResult = await admin.graphql(
      `#graphql
        mutation CreateBootprofiel($metaobject: MetaobjectCreateInput!) {
          metaobjectCreate(metaobject: $metaobject) {
            metaobject {
              id
              handle
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        variables: {
          metaobject: {
            type: "bootprofiel",
            fields: [
              {key: "naam_schip", value: data.naam_schip || ""},
              {key: "merk_boot", value: data.merk_boot || ""},
              {key: "model_boot", value: data.model_boot || ""},
              {key: "bouwjaar", value: data.bouwjaar || ""},
              {key: "lengte_boot_cm", value: data.lengte_boot_cm || ""},
              {key: "breedte_boot_cm", value: data.breedte_boot_cm || ""},
              {key: "ligplaats", value: data.ligplaats || ""},
              {key: "thuishaven", value: data.thuishaven || ""},
            ],
          },
        },
      },
    );

    const createJson = await createResult.json();
    const created = createJson.data?.metaobjectCreate?.metaobject;
    const createErrors = createJson.data?.metaobjectCreate?.userErrors || [];

    if (!created || createErrors.length) {
      return cors(
        jsonResponse(
          {
            success: false,
            message: "Bootprofiel kon niet worden aangemaakt",
            errors: createErrors,
          },
          400,
        ),
      );
    }

    const linkResult = await admin.graphql(
      `#graphql
        mutation LinkBootprofiel($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              namespace
              key
              value
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        variables: {
          metafields: [
            {
              ownerId: customerId,
              namespace: "custom",
              key: "bootprofiel",
              type: "list.metaobject_reference",
              value: JSON.stringify([created.id]),
            },
          ],
        },
      },
    );

    const linkJson = await linkResult.json();
    const linkErrors = linkJson.data?.metafieldsSet?.userErrors || [];

    if (linkErrors.length) {
      return cors(
        jsonResponse(
          {
            success: false,
            message: "Bootprofiel aangemaakt, maar koppelen aan klant mislukt",
            bootprofielId: created.id,
            errors: linkErrors,
          },
          400,
        ),
      );
    }

    return cors(
      jsonResponse({
        success: true,
        message: "Bootprofiel opgeslagen",
        bootprofielId: created.id,
        link: linkJson.data?.metafieldsSet,
      }),
    );
  } catch (error: any) {
    return jsonResponse(
      {
        success: false,
        message: error?.message || "Onbekende fout",
      },
      500,
    );
  }
}