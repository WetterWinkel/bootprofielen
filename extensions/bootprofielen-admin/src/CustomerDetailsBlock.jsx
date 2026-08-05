import '@shopify/ui-extensions/preact';
import {Fragment, render} from 'preact';
import {useEffect, useState} from 'preact/hooks';

const FIELD_LABELS = {
  naam_schip: 'Naam schip',
  merk_boot: 'Merk boot',
  model_boot: 'Model boot',
  bouwjaar_boot: 'Bouwjaar boot',
  hin_cin: 'HIN / CIN nummer',
  registratienummer: 'Registratienummer',
  boottype: 'Boottype',
  materiaal_romp: 'Materiaal romp',
  lengte: 'Lengte (cm)',
  breedte: 'Breedte (cm)',
  diepgang: 'Diepgang (cm)',
  doorvaarthoogte: 'Doorvaarthoogte (cm)',
  waterverplaatsing: 'Waterverplaatsing (kg)',
  brandstof: 'Brandstof',
  soort_motor: 'Soort motor',
  motormerk: 'Motormerk',
  motormodel: 'Motormodel',
  bouwjaar_motor: 'Bouwjaar motor',
  aantal_motoren: 'Aantal motoren',
  motorvermogen: 'Totaal vermogen (pk)',
  vaargebied: 'Vaargebied',
  ligplaats: 'Ligplaats',
  thuishaven: 'Thuishaven',
  vaardagen_per_jaar: 'Vaardagen per jaar',
  winterstalling: 'Winterstalling',
  aantal_loodzuuraccus: "Aantal loodzuuraccu's",
  aantal_lithiumaccus: "Aantal lithiumaccu's",
  merk_generator: 'Merk generator',
};

export default async function extension() {
  render(<Extension />, document.body);
}

function readableLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function readableValue(value) {
  if (value === true) return 'Ja';
  if (value === false) return 'Nee';
  return String(value ?? '');
}

function visibleFields(data) {
  return Object.entries(data || {})
    .filter(([, value]) => value !== '' && value !== null && value !== undefined && value !== false)
    .sort(([left], [right]) => {
      const order = Object.keys(FIELD_LABELS);
      const leftIndex = order.indexOf(left);
      const rightIndex = order.indexOf(right);
      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function exportDossier(profiles) {
  const profileHtml = profiles.map((profile, index) => {
    const name = profile.data?.naam_schip || profile.data?.model_boot || `Boot ${index + 1}`;
    const rows = visibleFields(profile.data)
      .map(([key, value]) => `<tr><th>${escapeHtml(readableLabel(key))}</th><td>${escapeHtml(readableValue(value))}</td></tr>`)
      .join('');
    const image = profile.photoUrl
      ? `<img src="${escapeHtml(profile.photoUrl)}" alt="${escapeHtml(name)}">`
      : '';
    return `<section><h2>${escapeHtml(name)}</h2>${image}<table>${rows}</table><h3>Serviceboek</h3><p>Nog niet beschikbaar.</p></section>`;
  }).join('');

  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Bootdossier</title><style>
    body{font-family:Arial,sans-serif;color:#17202a;max-width:900px;margin:32px auto;padding:0 20px}h1{color:#07549b}section{page-break-after:always;margin:28px 0}img{display:block;max-width:100%;max-height:420px;margin:16px 0;border-radius:10px}table{border-collapse:collapse;width:100%}th,td{text-align:left;border-bottom:1px solid #ddd;padding:8px;vertical-align:top}th{width:38%;color:#555}@media print{button{display:none}body{margin:0;max-width:none}}
  </style></head><body><button onclick="window.print()">Printen / opslaan als PDF</button><h1>Bootdossier</h1>${profileHtml}</body></html>`;

  const url = URL.createObjectURL(new Blob([html], {type: 'text/html;charset=utf-8'}));
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function Extension() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const customerId = shopify.data.selected[0]?.id;
      if (!customerId) throw new Error('Geen klant geselecteerd');

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          query: `
            query BootprofielenKlantblok($customerId: ID!) {
              customer(id: $customerId) {
                metafield(namespace: "$app", key: "bootprofielen") {
                  references(first: 100) {
                    nodes {
                      ... on Metaobject {
                        id
                        displayName
                        data: field(key: "data") { value }
                        photo: field(key: "bootfoto") {
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
          variables: {customerId},
        }),
      });
      const json = await response.json();
      if (!response.ok || json.errors?.length) {
        throw new Error(json.errors?.[0]?.message || 'Bootprofielen laden mislukt');
      }
      const items = json.data?.customer?.metafield?.references?.nodes || [];
      setProfiles(items.map((item) => {
        let data = {};
        try {
          data = JSON.parse(item.data?.value || '{}');
        } catch {
          data = {};
        }
        return {
          id: item.id,
          displayName: item.displayName,
          data,
          photoUrl: item.photo?.reference?.image?.url || null,
          photoAlt: item.photo?.reference?.image?.altText || null,
        };
      }));
    }

    load()
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <s-admin-block heading="Bootprofielen"><s-spinner accessibilityLabel="Bootprofielen laden" /></s-admin-block>;
  }

  if (error) {
    return <s-admin-block heading="Bootprofielen"><s-banner tone="critical">{error}</s-banner></s-admin-block>;
  }

  if (!profiles.length) {
    return <s-admin-block heading="Bootprofielen"><s-text>Deze klant heeft nog geen bootprofiel.</s-text></s-admin-block>;
  }

  return (
    <s-admin-block heading="Bootprofielen" collapsedSummary={`${profiles.length} boot${profiles.length === 1 ? '' : 'en'}`}>
      <s-stack gap="base">
        {profiles.map((profile, index) => {
          const name = profile.data?.naam_schip || profile.data?.model_boot || profile.displayName || `Boot ${index + 1}`;
          return (
            <s-section key={profile.id} heading={name}>
              <s-stack gap="base">
                {profile.photoUrl && (
                  <s-thumbnail
                    src={profile.photoUrl}
                    alt={profile.photoAlt || name}
                    size="large"
                  />
                )}
                <s-grid gridTemplateColumns="minmax(140px, 1fr) 2fr" gap="small-300">
                  {visibleFields(profile.data).map(([key, value]) => (
                    <Fragment key={key}>
                      <s-text type="strong">{readableLabel(key)}</s-text>
                      <s-text>{readableValue(value)}</s-text>
                    </Fragment>
                  ))}
                </s-grid>
                <s-stack direction="inline" gap="small-300">
                  <s-button onClick={() => exportDossier([profile])}>Boot exporteren</s-button>
                  <s-button disabled>Boot overdragen (later)</s-button>
                </s-stack>
              </s-stack>
            </s-section>
          );
        })}
      </s-stack>
    </s-admin-block>
  );
}
