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

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

    async function getReferenceId(type: string, label: unknown) {
      if (!hasValue(label)) return null;

      const handle = slugify(String(label));

      const result = await admin.graphql(
        `#graphql
          query GetMetaobjectReference($handle: MetaobjectHandleInput!) {
            metaobjectByHandle(handle: $handle) {
              id
            }
          }
        `,
        {
          variables: {
            handle: {
              type,
              handle,
            },
          },
        },
      );

      const resultJson = await result.json();
      return resultJson.data?.metaobjectByHandle?.id ?? null;
    }

    const [
      boottypeId,
      materiaalRompId,
      brandstofId,
      vaargebiedId,
      winterstallingId,
    ] = await Promise.all([
      getReferenceId("boottype_optie", data.boottype),
      getReferenceId("materiaal_romp_optie", data.materiaal_romp),
      getReferenceId("brandstof_optie", data.brandstof),
      getReferenceId("vaargebied_optie", data.vaargebied),
      getReferenceId("winterstalling_optie", data.winterstalling),
    ]);

    const fields = [
      hasValue(data.naam_schip)
        ? {key: "naam_schip", value: String(data.naam_schip)}
        : null,

      hasValue(data.merk_boot)
        ? {key: "merk_boot", value: String(data.merk_boot)}
        : null,

      hasValue(data.model_boot)
        ? {key: "model_boot", value: String(data.model_boot)}
        : null,

      hasValue(data.bouwjaar_boot)
        ? {key: "bouwjaar", value: String(data.bouwjaar_boot)}
        : null,

      hasValue(data.lengte)
        ? {key: "lengte_boot_cm", value: String(data.lengte)}
        : null,

      hasValue(data.breedte)
        ? {key: "breedte_boot_cm", value: String(data.breedte)}
        : null,

      hasValue(data.diepgang)
        ? {key: "diepgang_cm", value: String(data.diepgang)}
        : null,

      hasValue(data.doorvaarthoogte)
        ? {
            key: "doorvaarthoogte_cm",
            value: String(data.doorvaarthoogte),
          }
        : null,

      hasValue(data.waterverplaatsing)
        ? {
            key: "waterverplaatsing_kg",
            value: String(data.waterverplaatsing),
          }
        : null,

      hasValue(data.aantal_motoren)
        ? {key: "aantal_motoren", value: String(data.aantal_motoren)}
        : null,

      hasValue(data.soort_motor)
        ? {key: "motortype", value: String(data.soort_motor)}
        : null,

      hasValue(data.bouwjaar_motor)
        ? {key: "bouwjaar_motor", value: String(data.bouwjaar_motor)}
        : null,

      hasValue(data.motorvermogen)
        ? {
            key: "motorvermogen_totaal_pk",
            value: String(data.motorvermogen),
          }
        : null,

      hasValue(data.ligplaats)
        ? {key: "ligplaats", value: String(data.ligplaats)}
        : null,

      hasValue(data.vaardagen_per_jaar)
        ? {
            key: "aantal_vaardagen_per_jaar",
            value: String(data.vaardagen_per_jaar),
          }
        : null,

      hasValue(data.thuishaven)
        ? {key: "thuishaven", value: String(data.thuishaven)}
        : null,

      hasValue(data.boegschroef)
        ? {
            key: "boegschroef_aanwezig",
            value: String(Boolean(data.boegschroef)),
          }
        : null,

      hasValue(data.hekschroef)
        ? {
            key: "hekschroef_aanwezig",
            value: String(Boolean(data.hekschroef)),
          }
        : null,

      hasValue(data.zonnepanelen)
        ? {
            key: "zonnepanelen_aanwezig",
            value: String(Boolean(data.zonnepanelen)),
          }
        : null,

      hasValue(data.omvormer)
        ? {
            key: "omvormer_aanwezig",
            value: String(Boolean(data.omvormer)),
          }
        : null,

      hasValue(data.marifoon)
        ? {
            key: "marifoon_aanwezig",
            value: String(Boolean(data.marifoon)),
          }
        : null,

      hasValue(data.motormerk)
        ? {key: "motormerk", value: String(data.motormerk)}
        : null,

      boottypeId
        ? {key: "boottype", value: boottypeId}
        : null,

      materiaalRompId
        ? {key: "materiaal_romp", value: materiaalRompId}
        : null,

      brandstofId
        ? {key: "brandstof", value: brandstofId}
        : null,

      vaargebiedId
        ? {key: "vaargebied", value: vaargebiedId}
        : null,

      winterstallingId
        ? {key: "winterstalling", value: winterstallingId}
        : null,
    ].filter(Boolean);

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
            fields,
          },
        },
      },
    );

    const createJson = await createResult.json();
    const created = createJson.data?.metaobjectCreate?.metaobject;
    const createErrors =
      createJson.data?.metaobjectCreate?.userErrors || [];

    if (!created || createErrors.length) {
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

    const linkJson = await linkResult.json();
    const linkErrors =
      linkJson.data?.metafieldsSet?.userErrors || [];

    if (linkErrors.length) {
      return cors(
        jsonResponse(
          {
            success: false,
            message:
              "Bootprofiel aangemaakt, maar koppelen aan klant mislukt",
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
      }),
    );
  } catch (error: any) {
    console.error("Bootprofiel API-fout:", error);

    return jsonResponse(
      {
        success: false,
        message: error?.message || "Onbekende fout",
      },
      500,
    );
  }
}
