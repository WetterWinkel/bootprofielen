/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

// Aan/uit-knop voor de automatische korting "Gratis verzending".
// De korting gebruikt de Shopify Function in extensions/gratis-verzending:
// zit er een product met tag "gratis-verzending" in de bestelling, dan is
// de verzending naar NL/BE gratis voor de hele bestelling.

const TITEL = "Gratis verzending (product met gratis verzending)";
const FUNCTION_HANDLE = "gratis-verzending";

async function zoekKorting(admin: any) {
  const res = await admin.graphql(
    `#graphql
      query GratisVerzendingKorting {
        automaticDiscountNodes(first: 100) {
          nodes {
            id
            automaticDiscount {
              ... on DiscountAutomaticApp { title status startsAt }
            }
          }
        }
      }`,
  );
  const json: any = await res.json();
  return (json.data?.automaticDiscountNodes?.nodes ?? []).find(
    (n: any) => n.automaticDiscount?.title === TITEL,
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const korting = await zoekKorting(admin);
  return {
    id: korting?.id ?? null,
    status: korting?.automaticDiscount?.status ?? "NIET_AANGEMAAKT",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const korting = await zoekKorting(admin);

  let mutation = "";
  let variables: Record<string, unknown> = {};

  if (intent === "aan" && !korting) {
    mutation = `#graphql
      mutation GratisVerzendingAan($d: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $d) {
          automaticAppDiscount { discountId status }
          userErrors { field message }
        }
      }`;
    variables = {
      d: {
        title: TITEL,
        functionHandle: FUNCTION_HANDLE,
        discountClasses: ["SHIPPING"],
        startsAt: new Date().toISOString(),
        combinesWith: {
          orderDiscounts: true,
          productDiscounts: true,
          shippingDiscounts: false,
        },
      },
    };
  } else if (intent === "aan" && korting) {
    mutation = `#graphql
      mutation GratisVerzendingActiveren($id: ID!) {
        discountAutomaticActivate(id: $id) {
          userErrors { field message }
        }
      }`;
    variables = { id: korting.id };
  } else if (intent === "uit" && korting) {
    mutation = `#graphql
      mutation GratisVerzendingUit($id: ID!) {
        discountAutomaticDeactivate(id: $id) {
          userErrors { field message }
        }
      }`;
    variables = { id: korting.id };
  } else {
    return { ok: true, errors: [] };
  }

  const res = await admin.graphql(mutation, { variables });
  const json: any = await res.json();
  const payload: any = Object.values(json.data ?? {})[0] ?? {};
  const errors = [
    ...(json.errors ?? []).map((e: any) => e.message),
    ...(payload.userErrors ?? []).map((e: any) => e.message),
  ];
  return { ok: errors.length === 0, errors };
};

export default function GratisVerzending() {
  const { status } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const bezig = fetcher.state !== "idle";
  const actief = status === "ACTIVE";

  return (
    <s-page heading="Gratis verzending">
      <s-section heading="Status">
        <s-paragraph>
          Zit er minstens één product met de tag <b>gratis-verzending</b> in
          de bestelling, dan is de verzending naar Nederland en België gratis
          voor de hele bestelling. Duitsland en de Alu-RIB-bezorging blijven
          betaald.
        </s-paragraph>
        <s-paragraph>
          Huidige status:{" "}
          <b>
            {actief
              ? "AAN"
              : status === "NIET_AANGEMAAKT"
                ? "nog niet aangemaakt"
                : "UIT"}
          </b>
        </s-paragraph>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value={actief ? "uit" : "aan"} />
          <s-button
            type="submit"
            variant={actief ? "secondary" : "primary"}
            loading={bezig || undefined}
          >
            {actief ? "Zet gratis verzending UIT" : "Zet gratis verzending AAN"}
          </s-button>
        </fetcher.Form>
        {fetcher.data?.errors?.length ? (
          <s-banner tone="critical">{fetcher.data.errors.join(" · ")}</s-banner>
        ) : null}
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

