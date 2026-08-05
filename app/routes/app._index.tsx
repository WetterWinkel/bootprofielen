import { useEffect, useRef } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

const METAOBJECT_TYPE = "$app:bootprofiel";
const NEW_METAFIELD_NAMESPACE = "$app";
const NEW_METAFIELD_KEY = "bootprofielen";
const OVERVIEW_METAFIELD_NAMESPACE = "custom";
const OVERVIEW_METAFIELD_KEY = "bootprofielen_overzicht";
const LEGACY_METAFIELD_NAMESPACE = "custom";
const LEGACY_METAFIELD_KEY = "bootprofiel";
const MIGRATION_BATCH_SIZE = 20;
const METAFIELDS_SET_BATCH_SIZE = 25;

const LEGACY_PROFILE_TYPES: Record<
  string,
  { label: string; data: Record<string, string> }
> = {
  motorboot: {
    label: "Motorboot",
    data: { model_boot: "Motorboot", boottype: "Motorboot" },
  },
  sloep: {
    label: "Sloep",
    data: { model_boot: "Sloep", boottype: "Sloep" },
  },
  zeiljacht: {
    label: "Zeiljacht",
    data: { model_boot: "Zeiljacht", boottype: "Zeiljacht" },
  },
  motorjacht: {
    label: "Motorjacht",
    data: { model_boot: "Motorjacht", boottype: "Motorjacht" },
  },
  kajuitboot: {
    label: "Kajuitboot",
    data: { model_boot: "Kajuitboot", boottype: "Kajuitboot" },
  },
  visboot: {
    label: "Visboot",
    data: { model_boot: "Visboot", boottype: "Visboot" },
  },
  speedboot: {
    label: "Speedboot",
    data: { model_boot: "Speedboot", boottype: "Speedboot" },
  },
  "rib-rubberboot": {
    label: "RIB / Rubberboot",
    data: { model_boot: "RIB / Rubberboot", boottype: "RIB" },
  },
};

type CustomerMigrationState = {
  id: string;
  name: string;
  legacyHandle: string;
  hasNewProfile: boolean;
  profileIds: string[];
  profileDefinitionId: string;
};

type MigrationSummary = {
  customers: number;
  legacyProfiles: number;
  migratedProfiles: number;
  remainingProfiles: number;
  unknownProfiles: number;
};

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type GraphQLJson<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type CustomersQueryData = {
  customers: {
    nodes: Array<{
      id: string;
      displayName?: string;
      legacyProfile?: { reference?: { handle?: string } };
      newProfiles?: {
        references?: {
          nodes?: Array<{
            id: string;
            definition?: { id: string };
            ownerCustomer?: { value?: string };
          }>;
        };
      };
    }>;
    pageInfo: { hasNextPage: boolean; endCursor?: string };
  };
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "onbekende fout";
}

function migrationSummary(
  customers: CustomerMigrationState[],
): MigrationSummary {
  const legacy = customers.filter((customer) => customer.legacyHandle);
  const migrated = legacy.filter((customer) => customer.hasNewProfile);
  const remaining = legacy.filter(
    (customer) =>
      !customer.hasNewProfile && LEGACY_PROFILE_TYPES[customer.legacyHandle],
  );
  const unknown = legacy.filter(
    (customer) =>
      !customer.hasNewProfile && !LEGACY_PROFILE_TYPES[customer.legacyHandle],
  );

  return {
    customers: customers.length,
    legacyProfiles: legacy.length,
    migratedProfiles: migrated.length,
    remainingProfiles: remaining.length,
    unknownProfiles: unknown.length,
  };
}

async function graphQLJson<T>(
  admin: AdminClient,
  query: string,
  variables: Record<string, unknown> = {},
) {
  const result = await admin.graphql(query, { variables });
  const json = (await result.json()) as GraphQLJson<T>;
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json;
}

async function scanCustomers(
  admin: AdminClient,
): Promise<CustomerMigrationState[]> {
  const customers: CustomerMigrationState[] = [];
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const json: GraphQLJson<CustomersQueryData> =
      await graphQLJson<CustomersQueryData>(
        admin,
        `#graphql
        query BootprofielMigratieKlanten($after: String) {
          customers(first: 100, after: $after, sortKey: ID) {
            nodes {
              id
              displayName
              legacyProfile: metafield(
                namespace: "${LEGACY_METAFIELD_NAMESPACE}"
                key: "${LEGACY_METAFIELD_KEY}"
              ) {
                reference {
                  ... on Metaobject { handle }
                }
              }
              newProfiles: metafield(
                namespace: "${NEW_METAFIELD_NAMESPACE}"
                key: "${NEW_METAFIELD_KEY}"
              ) {
                references(first: 100) {
                  nodes {
                    ... on Metaobject {
                      id
                      definition { id }
                      ownerCustomer: field(key: "klant_id") { value }
                    }
                  }
                }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
        { after },
      );

    const connection: CustomersQueryData["customers"] | undefined =
      json.data?.customers;
    for (const customer of connection?.nodes ?? []) {
      const ownedProfiles = (
        customer.newProfiles?.references?.nodes ?? []
      ).filter((profile) => profile.ownerCustomer?.value === customer.id);
      customers.push({
        id: customer.id,
        name: customer.displayName || "Onbekende klant",
        legacyHandle: customer.legacyProfile?.reference?.handle || "",
        hasNewProfile: ownedProfiles.length > 0,
        profileIds: ownedProfiles.map((profile) => profile.id),
        profileDefinitionId: ownedProfiles[0]?.definition?.id || "",
      });
    }

    hasNextPage = Boolean(connection?.pageInfo?.hasNextPage);
    after = connection?.pageInfo?.endCursor ?? null;
  }

  return customers;
}

function migrationHandle(customerId: string) {
  const numericId = customerId.split("/").pop();
  if (!numericId || !/^\d+$/.test(numericId)) {
    throw new Error("Ongeldig Shopify klant-ID");
  }
  return `migratie-klant-${numericId}`;
}

async function upsertProfile(
  admin: AdminClient,
  customer: CustomerMigrationState,
) {
  const profileType = LEGACY_PROFILE_TYPES[customer.legacyHandle];
  if (!profileType) throw new Error("Onbekend oud boottype");

  const json = await graphQLJson<{
    metaobjectUpsert?: {
      metaobject?: { id: string };
      userErrors?: Array<{ message: string }>;
    };
  }>(
    admin,
    `#graphql
      mutation MigreerBootprofiel(
        $handle: MetaobjectHandleInput!
        $metaobject: MetaobjectUpsertInput!
      ) {
        metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message code }
        }
      }
    `,
    {
      handle: {
        type: METAOBJECT_TYPE,
        handle: migrationHandle(customer.id),
      },
      metaobject: {
        fields: [
          { key: "naam", value: profileType.label },
          { key: "data", value: JSON.stringify(profileType.data) },
          { key: "klant_id", value: customer.id },
        ],
      },
    },
  );

  const payload = json.data?.metaobjectUpsert;
  if (payload?.userErrors?.length || !payload?.metaobject?.id) {
    throw new Error(payload?.userErrors?.[0]?.message || "Aanmaken mislukt");
  }
  return payload.metaobject.id as string;
}

async function linkProfiles(
  admin: AdminClient,
  profiles: Array<{ customerId: string; profileId: string }>,
) {
  if (!profiles.length) return;
  const json = await graphQLJson<{
    metafieldsSet?: { userErrors?: Array<{ message: string }> };
  }>(
    admin,
    `#graphql
      mutation KoppelGemigreerdeBootprofielen(
        $metafields: [MetafieldsSetInput!]!
      ) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message code }
        }
      }
    `,
    {
      metafields: profiles.map(({ customerId, profileId }) => ({
        ownerId: customerId,
        namespace: NEW_METAFIELD_NAMESPACE,
        key: NEW_METAFIELD_KEY,
        type: "list.metaobject_reference",
        value: JSON.stringify([profileId]),
      })),
    },
  );
  const errors = json.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length) throw new Error(errors[0].message);
}

async function customerOverviewDefinition(
  admin: AdminClient,
  customers: CustomerMigrationState[],
) {
  const identifier = {
    ownerType: "CUSTOMER",
    namespace: OVERVIEW_METAFIELD_NAMESPACE,
    key: OVERVIEW_METAFIELD_KEY,
  };
  const existing = await graphQLJson<{
    metafieldDefinition?: { id: string; pinnedPosition?: number | null };
  }>(
    admin,
    `#graphql
      query BootprofielKlantoverzichtDefinitie(
        $identifier: MetafieldDefinitionIdentifierInput!
      ) {
        metafieldDefinition(identifier: $identifier) {
          id
          pinnedPosition
        }
      }
    `,
    { identifier },
  );

  let definition = existing.data?.metafieldDefinition;
  if (!definition) {
    const profileDefinitionId = customers.find(
      (customer) => customer.profileDefinitionId,
    )?.profileDefinitionId;
    if (!profileDefinitionId) {
      throw new Error("Er is nog geen Bootprofiel gevonden om te koppelen");
    }

    const created = await graphQLJson<{
      metafieldDefinitionCreate?: {
        createdDefinition?: { id: string; pinnedPosition?: number | null };
        userErrors?: Array<{ message: string }>;
      };
    }>(
      admin,
      `#graphql
        mutation MaakBootprofielKlantoverzicht(
          $definition: MetafieldDefinitionInput!
        ) {
          metafieldDefinitionCreate(definition: $definition) {
            createdDefinition { id pinnedPosition }
            userErrors { field message code }
          }
        }
      `,
      {
        definition: {
          name: "Bootprofielen",
          description:
            "Automatisch overzicht van de bootprofielen die bij deze klant horen",
          namespace: OVERVIEW_METAFIELD_NAMESPACE,
          key: OVERVIEW_METAFIELD_KEY,
          ownerType: "CUSTOMER",
          type: "list.metaobject_reference",
          validations: [
            {
              name: "metaobject_definition_id",
              value: profileDefinitionId,
            },
          ],
        },
      },
    );
    const payload = created.data?.metafieldDefinitionCreate;
    if (payload?.userErrors?.length || !payload?.createdDefinition) {
      throw new Error(
        payload?.userErrors?.[0]?.message ||
          "Het klantoverzicht kon niet worden aangemaakt",
      );
    }
    definition = payload.createdDefinition;
  }

  if (definition.pinnedPosition == null) {
    const pinned = await graphQLJson<{
      metafieldDefinitionPin?: { userErrors?: Array<{ message: string }> };
    }>(
      admin,
      `#graphql
        mutation PinBootprofielKlantoverzicht($definitionId: ID!) {
          metafieldDefinitionPin(definitionId: $definitionId) {
            pinnedDefinition { id }
            userErrors { field message code }
          }
        }
      `,
      { definitionId: definition.id },
    );
    const errors = pinned.data?.metafieldDefinitionPin?.userErrors ?? [];
    if (errors.length) throw new Error(errors[0].message);
  }
}

async function syncCustomerOverview(
  admin: AdminClient,
  customers: CustomerMigrationState[],
) {
  const customersWithProfiles = customers.filter(
    (customer) => customer.profileIds.length > 0,
  );

  for (
    let start = 0;
    start < customersWithProfiles.length;
    start += METAFIELDS_SET_BATCH_SIZE
  ) {
    const batch = customersWithProfiles.slice(
      start,
      start + METAFIELDS_SET_BATCH_SIZE,
    );
    const json = await graphQLJson<{
      metafieldsSet?: { userErrors?: Array<{ message: string }> };
    }>(
      admin,
      `#graphql
        mutation VulBootprofielKlantoverzicht(
          $metafields: [MetafieldsSetInput!]!
        ) {
          metafieldsSet(metafields: $metafields) {
            userErrors { field message code }
          }
        }
      `,
      {
        metafields: batch.map((customer) => ({
          ownerId: customer.id,
          namespace: OVERVIEW_METAFIELD_NAMESPACE,
          key: OVERVIEW_METAFIELD_KEY,
          type: "list.metaobject_reference",
          value: JSON.stringify(customer.profileIds),
        })),
      },
    );
    const errors = json.data?.metafieldsSet?.userErrors ?? [];
    if (errors.length) throw new Error(errors[0].message);
  }

  return customersWithProfiles.length;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const customers = await scanCustomers(admin);
  return { summary: migrationSummary(customers) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "setup_customer_overview") {
    try {
      const customers = await scanCustomers(admin);
      await customerOverviewDefinition(admin, customers);
      const synced = await syncCustomerOverview(admin, customers);
      return {
        success: true,
        migrated: 0,
        synced,
        message: `Bootprofielen staan nu bij ${synced} klanten in het vaste overzicht.`,
      };
    } catch (error: unknown) {
      return {
        success: false,
        migrated: 0,
        synced: 0,
        message: `Klantoverzicht instellen mislukt: ${errorMessage(error)}`,
      };
    }
  }

  if (intent !== "migrate") {
    return { success: false, message: "Onbekende actie", migrated: 0 };
  }

  const customers = await scanCustomers(admin);
  const targets = customers
    .filter(
      (customer) =>
        customer.legacyHandle &&
        !customer.hasNewProfile &&
        LEGACY_PROFILE_TYPES[customer.legacyHandle],
    )
    .slice(0, MIGRATION_BATCH_SIZE);

  const created: Array<{ customerId: string; profileId: string }> = [];
  const failures: string[] = [];

  for (const customer of targets) {
    try {
      created.push({
        customerId: customer.id,
        profileId: await upsertProfile(admin, customer),
      });
    } catch (error: unknown) {
      failures.push(`${customer.name}: ${errorMessage(error)}`);
    }
  }

  try {
    await linkProfiles(admin, created);
  } catch (error: unknown) {
    return {
      success: false,
      migrated: 0,
      message: `De profielen zijn veilig aangemaakt maar nog niet gekoppeld: ${errorMessage(
        error,
      )}. Druk opnieuw op de knop om het te herstellen.`,
    };
  }

  return {
    success: failures.length === 0,
    migrated: created.length,
    message: failures.length
      ? `${created.length} klanten overgezet. ${failures.length} klanten konden nog niet worden overgezet.`
      : `${created.length} klanten veilig overgezet.`,
  };
};

export default function Index() {
  const { summary } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const handledMessage = useRef("");
  const isWorking = fetcher.state !== "idle";

  useEffect(() => {
    const message = fetcher.data?.message || "";
    if (
      fetcher.state === "idle" &&
      fetcher.data?.message &&
      message !== handledMessage.current
    ) {
      handledMessage.current = message;
      if (fetcher.data.success) revalidator.revalidate();
      shopify.toast.show(message);
    }
  }, [fetcher.data, fetcher.state, revalidator, shopify]);

  const migrate = () =>
    fetcher.submit({ intent: "migrate" }, { method: "POST" });
  const setupCustomerOverview = () =>
    fetcher.submit(
      { intent: "setup_customer_overview" },
      { method: "POST" },
    );

  return (
    <s-page heading="Bootprofielenbeheer">
      <s-section heading="Veilige klantmigratie">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Ieder bootprofiel wordt aan precies één Shopify-klant-ID gekoppeld.
            Klanten kunnen uitsluitend hun eigen profiel ophalen, wijzigen en
            verwijderen.
          </s-paragraph>
          <s-text>Klanten gecontroleerd: {summary.customers}</s-text>
          <s-text>Oude bootkeuze gevonden: {summary.legacyProfiles}</s-text>
          <s-text>Al overgezet: {summary.migratedProfiles}</s-text>
          <s-text>Nog over te zetten: {summary.remainingProfiles}</s-text>
          {summary.unknownProfiles > 0 && (
            <s-text>Handmatig controleren: {summary.unknownProfiles}</s-text>
          )}
          {summary.remainingProfiles > 0 ? (
            <s-button onClick={migrate} disabled={isWorking}>
              {isWorking
                ? "Veilig overzetten..."
                : `Volgende ${Math.min(MIGRATION_BATCH_SIZE, summary.remainingProfiles)} klanten overzetten`}
            </s-button>
          ) : (
            <s-text>Alle bekende oude bootkeuzes zijn overgezet.</s-text>
          )}
          {fetcher.data?.message && <s-text>{fetcher.data.message}</s-text>}
        </s-stack>
      </s-section>

      <s-section heading="Bootprofielen op de klantkaart">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Shopify kan het beveiligde appveld niet vastpinnen. Maak daarom
            een vast klantoverzicht dat automatisch dezelfde bootprofielen
            toont. De beveiligde koppeling per klant blijft de bron.
          </s-paragraph>
          <s-button onClick={setupCustomerOverview} disabled={isWorking}>
            {isWorking
              ? "Klantoverzicht bijwerken..."
              : "Klantoverzicht instellen en bijwerken"}
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="Wat wordt overgezet?">
        <s-paragraph>
          Alleen het oude algemene boottype wordt als startprofiel ingevuld.
          Bestaande nieuwe profielen worden overgeslagen. De oude velden blijven
          voorlopig bestaan als controle en worden niet verwijderd.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
