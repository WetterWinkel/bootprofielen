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

export async function loader(_args: LoaderFunctionArgs) {
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
    const destination = (sessionToken as any).dest;

    if (!customerId) {
      return cors(
        jsonResponse(
          {
            success: false,
            message: "Geen klant gevonden",
          },
          401,
        ),
      );
    }

    if (!destination) {
      return cors(
        jsonResponse(
          {
            success: false,
            message: "Geen Shopify-winkel gevonden in het sessietoken",
          },
          401,
        ),
      );
    }

    const shop = new URL(destination).hostname;
    const data = await request.json();

    console.log("========== BOOTPROFIEL REQUEST ==========");
    console.log("SHOP:", shop);
    console.log("CUSTOMER:", customerId);

    const {admin} = await unauthenticated.admin(shop);

    console.log("Admin-client opgehaald. Testquery wordt uitgevoerd.");

    const testResult = await admin.graphql(
      `#graphql
        query TestAdminConnection {
          shop {
            name
            myshopifyDomain
          }
        }
      `,
    );

    console.log("ADMIN STATUS:", testResult.status);

    const testJson = await testResult.json();

    console.log("ADMIN RESPONSE:");
    console.log(JSON.stringify(testJson, null, 2));

    if (testJson.errors?.length) {
      return cors(
        jsonResponse(
          {
            success: false,
            message: "De verbinding met de Shopify Admin API is mislukt",
            graphqlErrors: testJson.errors,
          },
          502,
        ),
      );
    }

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
              code
            }
          }
        }
      `,
      {
        variables: {
          metaobject: {
            type: "bootprofiel",
            fields: [
              {key: "naam_schip", value: String(data.naam_schip || "")},
              {key: "merk_boot", value: String(data.merk_boot || "")},
              {key: "model_boot", value: String(data.model_boot || "")},
              {
                key: "bouwjaar",
                value: String(
                  data.bouwjaar_boot ??
                    data.bouwjaar ??
                    "",
                ),
              },
              {
                key: "lengte_boot_cm",
                value: String(
                  data.lengte ??
                    data.lengte_boot_cm ??
                    "",
                ),
              },
              {
                key: "breedte_boot_cm",
                value: String(
                  data.breedte ??
                    data.breedte_boot_cm ??
                    "",
                ),
              },
              {key: "ligplaats", value: String(data.ligplaats || "")},
              {key: "thuishaven", value: String(data.thuishaven || "")},
            ],
          },
        },
      },
    );

    console.log("METAOBJECT CREATE STATUS:", createResult.status);

    const createJson = await createResult.json();

    console.log("METAOBJECT CREATE RESPONSE:");
    console.log(JSON.stringify(createJson, null, 2));

    const created = createJson.data?.metaobjectCreate?.metaobject;
    const createErrors =
      createJson.data?.metaobjectCreate?.userErrors || [];

    if (!created || createErrors.length > 0) {
      return cors(
        jsonResponse(
          {
            success: false,
            message: "Bootprofiel kon niet worden aangemaakt",
            errors: createErrors,
            graphqlErrors: createJson.errors || [],
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
              code
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

    console.log("METAFIELD LINK STATUS:", linkResult.status);

    const linkJson = await linkResult.json();

    console.log("METAFIELD LINK RESPONSE:");
    console.log(JSON.stringify(linkJson, null, 2));

    const linkErrors =
      linkJson.data?.metafieldsSet?.userErrors || [];

    if (linkErrors.length > 0) {
      return cors(
        jsonResponse(
          {
            success: false,
            message:
              "Bootprofiel is aangemaakt, maar koppelen aan de klant is mislukt",
            bootprofielId: created.id,
            errors: linkErrors,
            graphqlErrors: linkJson.errors || [],
          },
          400,
        ),
      );
    }

    console.log("BOOTPROFIEL SUCCESVOL OPGESLAGEN:", created.id);
    console.log("========================================");

    return cors(
      jsonResponse({
        success: true,
        message: "Bootprofiel opgeslagen",
        bootprofielId: created.id,
        link: linkJson.data?.metafieldsSet,
      }),
    );
  } catch (error: any) {
    console.error("========== BOOTPROFIEL ERROR ==========");
    console.error(error);

    if (error?.stack) {
      console.error(error.stack);
    }

    return jsonResponse(
      {
        success: false,
        message: error?.message || String(error) || "Onbekende fout",
      },
      500,
    );
  }
}
