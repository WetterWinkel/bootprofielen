import '@shopify/ui-extensions/preact';
import {createContext, render} from 'preact';
import {useContext, useEffect, useState} from 'preact/hooks';
import {BoatMarketplace} from './BoatMarketplace.jsx';
import {CaptainAi} from './CaptainAi.jsx';
import {DigitalServiceBook} from './DigitalServiceBook.jsx';

const API_URL =
  'https://bootprofielen.onrender.com/api/bootprofielen';

const FormContext = createContext({form: {}, update: () => {}});

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [dossierBusy, setDossierBusy] = useState(false);
  const [exportUrl, setExportUrl] = useState('');
  const [transferCode, setTransferCode] = useState('');
  const [transferExpiresAt, setTransferExpiresAt] = useState('');
  const [claimCode, setClaimCode] = useState('');

  const update = (key, value) =>
    setForm((old) => {
      const next = {...old, [key]: value};
      // Masthoogte is bij een staande mast ook de doorvaarthoogte.
      if (key === 'masthoogte' && (!old.doorvaarthoogte || old.doorvaarthoogte === old.masthoogte)) {
        next.doorvaarthoogte = value;
      }
      return next;
    });

  // Kies het hoofdtype; vul logische standaardwaarden alleen in als ze nog leeg zijn.
  const chooseType = (type) =>
    setForm((old) => {
      const next = {...old, boottype: type};
      const standaard = STANDAARD[type] || {};
      for (const [key, value] of Object.entries(standaard)) {
        if (!next[key]) next[key] = value;
      }
      return next;
    });

  async function api(method, body) {
    const token = await globalThis.shopify.sessionToken.get();
    const result = await fetch(API_URL, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      ...(body ? {body: JSON.stringify(body)} : {}),
    });
    const raw = await result.text();
    let json = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      json = {};
    }
    if (!result.ok || !json.success) {
      throw new Error(
        json.message ||
        (raw && raw.length < 300 ? raw : '') ||
        `De server kon de aanvraag niet verwerken (status ${result.status}).`,
      );
    }
    return json;
  }

  async function loadProfiles() {
    setLoading(true);
    try {
      const json = await api('GET');
      const items = json.profiles || [];
      const selected =
        items.find((profile) => profile.id === activeId) || items[0] || null;
      setProfiles(items);
      setActiveId(selected?.id || '');
      setForm(selected?.data || {});
      if (selected) {
        setMessage('');
      } else {
        setMessage(
          'Captain AI heeft een opgeslagen bootprofiel nodig. Open Bootprofiel en sla uw boot eerst op.',
        );
      }
      return selected?.id || '';
    } catch (error) {
      setMessage(
        `Bootprofielen laden mislukt: ${error.message}. Probeer de koppeling opnieuw.`,
      );
      return '';
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfiles();
    // Alleen bij het openen van de klantaccount-extension laden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectProfile(id) {
    const selected = profiles.find((profile) => profile.id === id);
    setActiveId(id);
    setForm(selected?.data || {});
    setPhotoFile(null);
    setPhotoError('');
    setPhotoInputKey((value) => value + 1);
    setExportUrl('');
    setTransferCode('');
    setTransferExpiresAt('');
    setMessage('');
  }

  function newProfile() {
    setActiveId('');
    setForm({});
    setPhotoFile(null);
    setPhotoError('');
    setPhotoInputKey((value) => value + 1);
    setExportUrl('');
    setTransferCode('');
    setTransferExpiresAt('');
    setMessage('Nieuw bootprofiel geopend.');
  }

  function selectPhoto(event) {
    const file = event.currentTarget.files?.[0];
    setPhotoError('');
    if (!file) {
      setPhotoFile(null);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setPhotoFile(null);
      setPhotoError('De bootfoto mag maximaal 20 MB zijn.');
      return;
    }
    setPhotoFile(file);
  }

  async function fileBase64(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  async function saveBootprofiel() {
    setSaving(true);
    setMessage('');

    try {
      const json = activeId
        ? await api('PATCH', {id: activeId, data: form})
        : await api('POST', form);
      let saved = json.profile;
      let savedMessage = json.message || 'Bootprofiel opgeslagen.';

      if (photoFile) {
        try {
          const photoJson = await api('POST', {
            intent: 'upload_photo',
            id: saved.id,
            photo: {
              filename: photoFile.name,
              mimeType: photoFile.type,
              data: await fileBase64(photoFile),
            },
          });
          saved = photoJson.profile;
          savedMessage = photoJson.message || 'Bootprofiel en foto opgeslagen.';
          setPhotoFile(null);
          setPhotoInputKey((value) => value + 1);
        } catch (photoUploadError) {
          savedMessage = `Bootprofiel is opgeslagen, maar de foto niet: ${photoUploadError.message}`;
        }
      }

      setActiveId(saved.id);
      setProfiles((old) => {
        const exists = old.some((profile) => profile.id === saved.id);
        return exists
          ? old.map((profile) => profile.id === saved.id ? saved : profile)
          : [...old, saved];
      });
      setMessage(savedMessage);
    } catch (error) {
      console.error('Bootprofiel opslaan mislukt', error);
      setMessage('Opslaan mislukt. De verbinding met de server werkt niet.');
    } finally {
      setSaving(false);
    }
  }

  const activeProfile = profiles.find((profile) => profile.id === activeId);

  async function deleteProfile() {
    if (!activeId || saving) return;
    setSaving(true);
    setMessage('');
    try {
      const json = await api('DELETE', {id: activeId});
      const remaining = profiles.filter((profile) => profile.id !== activeId);
      setProfiles(remaining);
      setActiveId(remaining[0]?.id || '');
      setForm(remaining[0]?.data || {});
      setMessage(json.message || 'Bootprofiel verwijderd.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function prepareExport() {
    if (!activeId || dossierBusy) return;
    setDossierBusy(true);
    setExportUrl('');
    setMessage('');
    try {
      const json = await api('POST', {intent: 'create_export', id: activeId});
      setExportUrl(json.url || '');
      setMessage(json.message || 'De PDF staat klaar.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setDossierBusy(false);
    }
  }

  async function createTransfer() {
    if (!activeId || dossierBusy) return;
    setDossierBusy(true);
    setTransferCode('');
    setTransferExpiresAt('');
    setMessage('');
    try {
      const json = await api('POST', {intent: 'create_transfer', id: activeId});
      setTransferCode(json.code || '');
      setTransferExpiresAt(json.expiresAt || '');
      setMessage(json.message || 'Overdrachtscode aangemaakt.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setDossierBusy(false);
    }
  }

  async function cancelTransfer() {
    if (!activeId || dossierBusy) return;
    setDossierBusy(true);
    setMessage('');
    try {
      const json = await api('POST', {intent: 'cancel_transfer', id: activeId});
      setTransferCode('');
      setTransferExpiresAt('');
      setMessage(json.message || 'Overdracht ingetrokken.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setDossierBusy(false);
    }
  }

  async function claimTransfer() {
    if (!claimCode.trim() || dossierBusy) return;
    setDossierBusy(true);
    setMessage('');
    try {
      const json = await api('POST', {intent: 'claim_transfer', code: claimCode});
      const items = json.profiles || [];
      const received = json.profile;
      setProfiles(items);
      setActiveId(received?.id || items[0]?.id || '');
      setForm(received?.data || items[0]?.data || {});
      setClaimCode('');
      setExportUrl('');
      setTransferCode('');
      setTransferExpiresAt('');
      setMessage(json.message || 'Bootprofiel ontvangen.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setDossierBusy(false);
    }
  }

  return (
    <s-stack gap="base">
      <s-heading>Mijn bootdossier</s-heading>

      <s-button onClick={() => setOpen(!open)}>
        {open ? '▼ Bootprofiel verbergen' : '▶ Bootprofiel openen'}
      </s-button>

      {open && (
        <FormContext.Provider value={{form, update}}>
        <s-stack gap="base">
          {loading && <s-text>Bootprofielen laden...</s-text>}

          {profiles.length > 0 && (
            <s-select label="Mijn boten" value={activeId} onChange={(event) => selectProfile(event.currentTarget.value)}>
              {profiles.map((profile) => (
                <s-option key={profile.id} value={profile.id}>
                  {profile.data?.naam_schip || profile.data?.model_boot || 'Bootprofiel'}
                </s-option>
              ))}
            </s-select>
          )}

          <s-button onClick={newProfile}>Nieuwe boot toevoegen</s-button>
          <s-heading>1. Wat voor boot heeft u?</s-heading>
          <s-stack direction="inline" gap="small-200">
            {HOOFDTYPES.map((type) => (
              <s-button
                key={type}
                variant={form.boottype === type ? 'primary' : 'secondary'}
                onClick={() => chooseType(type)}
              >
                {type}
              </s-button>
            ))}
            <s-button
              variant={form.boottype && !HOOFDTYPES.includes(form.boottype) ? 'primary' : 'secondary'}
              onClick={() => chooseType(form.boottype && !HOOFDTYPES.includes(form.boottype) ? form.boottype : 'Sloep')}
            >
              Ander type
            </s-button>
          </s-stack>

          {form.boottype && !HOOFDTYPES.includes(form.boottype) && (
            <Select label="Boottype" name="boottype" update={update} options={ALLE_TYPES} />
          )}

          {form.boottype && <TypeFields type={form.boottype} update={update} />}

          <s-heading>2. Basisgegevens</s-heading>
          {activeProfile?.photoUrl && (
            <s-image
              src={activeProfile.photoUrl}
              alt={activeProfile.photoAlt || activeProfile.data?.naam_schip || 'Bootfoto'}
              aspectRatio="16/9"
            />
          )}
          <s-drop-zone
            key={photoInputKey}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif"
            label={activeProfile?.photoUrl ? 'Bootfoto vervangen' : 'Bootfoto toevoegen'}
            error={photoError || undefined}
            disabled={saving}
            onInput={selectPhoto}
            onChange={selectPhoto}
          />
          {photoFile && <s-text>Geselecteerd: {photoFile.name}</s-text>}
          <Field label="Naam schip" name="naam_schip" update={update} />
          <Field label="Merk boot" name="merk_boot" update={update} />
          <Field label="Model boot" name="model_boot" update={update} />
          <Field label="Bouwjaar boot" name="bouwjaar_boot" update={update} />
          <Field label="HIN / CIN nummer" name="hin_cin" update={update} />
          <Field label="Registratienummer" name="registratienummer" update={update} />

          <s-heading>3. Romp</s-heading>
          <Select label="Materiaal romp" name="materiaal_romp" update={update} options={rompOpties(form.boottype)} />

          <s-heading>4. Afmetingen</s-heading>
          <Field label="Lengte in cm" name="lengte" update={update} />
          <Field label="Breedte in cm" name="breedte" update={update} />
          <Field label="Diepgang in cm" name="diepgang" update={update} />
          <Field label="Doorvaarthoogte in cm" name="doorvaarthoogte" update={update} />
          <Field label="Waterverplaatsing in kg" name="waterverplaatsing" update={update} />

          <s-heading>5. Brandstof</s-heading>
          <Select label="Brandstof" name="brandstof" update={update} options={[
            'Diesel','Benzine','Elektrisch','Hybride',
          ]} />

          <s-heading>6. Motor</s-heading>
          <Select label="Soort motor" name="soort_motor" update={update} options={[
            'Binnenboord diesel','Binnenboord benzine','Buitenboord benzine',
            'Buitenboord elektrisch','Binnenboord elektrisch','Hybride','Anders',
          ]} />

          <Select label="Motormerk" name="motormerk" update={update} options={[
            'Volvo Penta','Yanmar','Vetus','Perkins','Cummins','DAF','Mercedes',
            'Mercedes-Benz','John Deere','Nanni','Beta Marine','Craftsman Marine',
            'MAN','Caterpillar','Scania','Ford Lehman','Bukh','Lister Petter',
            'Mitsubishi','Kubota','Deutz','Baudouin','MTU','Steyr Motors',
            'Iveco Aifo','Hyundai SeasAll','Solé Diesel','Isuzu',
            'Lombardini Marine','Detroit Diesel','VM Motori','FPT Industrial',
            'MerCruiser','Indmar','PCM','Crusader','Yamaha','Mercury','Honda',
            'Suzuki','Tohatsu','Evinrude','Johnson','Mariner','Selva','Parsun',
            'Hidea','Torqeedo','ePropulsion','Minn Kota','Haswing','Rhino',
            'Elco','Aquamot','Mercury Avator','Yamaha HARMO','Anders / Overig',
          ]} />

          <Field label="Model" name="motormodel" update={update} />
          <Field label="Bouwjaar motor" name="bouwjaar_motor" update={update} />
          <Field label="Aantal motoren" name="aantal_motoren" update={update} />
          <Field label="Totaal vermogen in pk" name="motorvermogen" update={update} />

          <s-heading>7. Vaargebied & ligplaats</s-heading>
          <Select label="Vaargebied" name="vaargebied" update={update} options={[
            'Binnenwater','Friesland','IJsselmeer','Markermeer','Randmeren',
            'Waddenzee','Delta','Zeeland','Kustwater','Noordzee','Oostzee',
            'Middellandse Zee','Rivieren','Kanalen','Wereldwijd','Anders',
          ]} />

          <Field label="Ligplaats" name="ligplaats" update={update} />
          <Field label="Thuishaven" name="thuishaven" update={update} />
          <Field label="Aantal vaardagen per jaar" name="vaardagen_per_jaar" update={update} />

          <Select label="Winterstalling" name="winterstalling" update={update} options={[
            'In het water','Op de wal','Binnenstalling','Buitenstalling','Geen winterstalling',
          ]} />

          <s-heading>8. Navigatie</s-heading>
          {[
            'Plotter / kaartplotter','Radar','AIS','Marifoon','Autopilot',
            'Dieptemeter','Log / snelheidsmeter','Kompas','Fishfinder','GPS',
          ].map((item) => <Check key={item} label={item} update={update} />)}

          <s-heading>9. Comfort</s-heading>
          {[
            'Airco','Heteluchtverwarming','Vloerverwarming','Boiler','Douche',
            'Toilet elektrisch','Toilet handmatig / pomptoilet','Koelkast',
            'Vriezer','Magnetron','Oven','Koken gas','Koken elektrisch','TV',
            'Audio-installatie','Wifi','Bluetooth boordsysteem',
          ].map((item) => <Check key={item} label={item} update={update} />)}

          <s-heading>10. Elektrisch</s-heading>
          {[
            'Walstroom','Omvormer','Acculader','Zonnepanelen',
            'Scheidingstransformator','Generator',
          ].map((item) => <Check key={item} label={item} update={update} />)}

          <Field label="Aantal loodzuuraccu's" name="aantal_loodzuuraccus" update={update} />
          <Field label="Aantal lithiumaccu's" name="aantal_lithiumaccus" update={update} />

          <Select label="Merk generator" name="merk_generator" update={update} options={[
            'Geen generator','Fischer Panda','WhisperPower','Vetus','Honda','Yamaha',
            'Northern Lights','Kohler','Cummins Onan','Westerbeke','Solé Diesel',
            'Coelmo','Paguro','Mastervolt','Anders / Overig',
          ]} />

          <s-heading>11. Dek</s-heading>
          {[
            'Boegschroef','Hekschroef','Ankerlier','Davits','Deckwash','Trimtabs',
            'Spudpalen','Zwemplatform','Zwemtrap','Bimini','Cabriokap','Buiskap',
            'Kuiptent','Teakdek',
          ].map((item) => <Check key={item} label={item} update={update} />)}

          <s-heading>12. Veiligheid</s-heading>
          {[
            'Bilgepomp automatisch','Bilgepomp handmatig','Brandblussysteem','EPIRB',
            'Reddingsvlot','Reddingsvesten','Gasdetector','Koolmonoxidemelder','Rookmelder',
          ].map((item) => <Check key={item} label={item} update={update} />)}

          <s-button onClick={saveBootprofiel} disabled={saving}>
            {saving ? 'Opslaan...' : activeId ? 'Wijzigingen opslaan' : 'Bootprofiel opslaan'}
          </s-button>

          {activeId && <s-button onClick={deleteProfile} disabled={saving}>Bootprofiel verwijderen</s-button>}

          {message && <s-text>{message}</s-text>}
        </s-stack>
        </FormContext.Provider>
      )}

      <DigitalServiceBook
        key={activeId || 'nieuw'}
        api={api}
        profileId={activeId}
        profile={activeProfile}
        fileBase64={fileBase64}
      />
      <CaptainAi
        profileId={activeId}
        profile={activeProfile}
        profileLoading={loading}
        reloadProfiles={loadProfiles}
      />

      <s-button onClick={() => setDossierOpen(!dossierOpen)}>
        {dossierOpen
          ? '▼ Bootdossier exporteren / Bootprofiel overdragen sluiten'
          : '▶ Bootdossier exporteren / Bootprofiel overdragen'}
      </s-button>

      {dossierOpen && (
        <s-stack gap="base">
          <s-heading>Bootdossier exporteren</s-heading>
          <s-text>De PDF bevat het gekozen bootprofiel en alle regels uit het bijbehorende Digitaal serviceboek.</s-text>
          <s-button onClick={prepareExport} disabled={!activeId || dossierBusy}>
            {dossierBusy ? 'Even geduld...' : 'PDF voorbereiden'}
          </s-button>
          {exportUrl && (
            <s-button href={exportUrl} target="_blank">PDF downloaden</s-button>
          )}

          <s-heading>Boot verkopen of overdragen</s-heading>
          <s-text>Maak een tijdelijke code en geef deze alleen aan de koper. De boot blijft in uw profiel totdat de koper de code in zijn eigen WetterWinkel-account accepteert.</s-text>
          <s-button onClick={createTransfer} disabled={!activeId || dossierBusy}>
            Overdrachtscode maken
          </s-button>
          {transferCode && (
            <s-stack gap="small-300">
              <s-text-field label="Overdrachtscode" value={transferCode} readOnly />
              {transferExpiresAt && <s-text>Geldig tot {new Date(transferExpiresAt).toLocaleString('nl-NL')}.</s-text>}
              <s-button onClick={cancelTransfer} disabled={dossierBusy}>Code intrekken</s-button>
            </s-stack>
          )}

          <s-heading>Een boot ontvangen</s-heading>
          <s-text-field
            label="Code van de verkoper"
            value={claimCode}
            onInput={(event) => setClaimCode(event.currentTarget.value)}
            onChange={(event) => setClaimCode(event.currentTarget.value)}
          />
          <s-button onClick={claimTransfer} disabled={!claimCode.trim() || dossierBusy}>
            Boot aan mijn profiel koppelen
          </s-button>
        </s-stack>
      )}

      <BoatMarketplace />

    </s-stack>
  );
}

function Field({label, name, update}) {
  const {form} = useContext(FormContext);
  return (
    <s-text-field
      label={label}
      value={form[name] ?? ''}
      onInput={(event) => update(name, event.currentTarget.value)}
      onChange={(event) => update(name, event.currentTarget.value)}
    />
  );
}

function Select({label, name, options, update}) {
  const {form} = useContext(FormContext);
  return (
    <s-select
      label={label}
      value={form[name] ?? options[0]}
      onInput={(event) => update(name, event.currentTarget.value)}
      onChange={(event) => update(name, event.currentTarget.value)}
    >
      {options.map((option) => (
        <s-option key={option} value={option}>
          {option}
        </s-option>
      ))}
    </s-select>
  );
}

function Check({label, update}) {
  const {form} = useContext(FormContext);
  const key = label.toLowerCase().replaceAll(' ', '_').replaceAll('/', '_');

  return (
    <s-checkbox
      label={label}
      checked={Boolean(form[key])}
      onChange={(event) => update(key, event.currentTarget.checked)}
    />
  );
}

const HOOFDTYPES = ['Rubberboot', 'RIB', 'Motorjacht', 'Zeiljacht', 'Speedboot'];

const ALLE_TYPES = [
  'Motorboot','Motorjacht','Zeiljacht','Sloep','Tender','Consoleboot','Speedboot',
  'Sportcruiser','Kajuitboot','Visboot','RIB','Kruiser','Trawler',
  'Kotter','Salonboot','Platbodem','Aak','Skûtsje','Vlet','Opduwer',
  'Houseboat / woonboot','Catamaran','Trimaran','Rubberboot','Anders',
];

const STANDAARD = {
  Rubberboot: {materiaal_romp: 'Rubber', soort_motor: 'Buitenboord benzine'},
  RIB: {materiaal_romp: 'Polyester', soort_motor: 'Buitenboord benzine'},
  Speedboot: {materiaal_romp: 'Polyester', brandstof: 'Benzine'},
  Zeiljacht: {materiaal_romp: 'Polyester', brandstof: 'Diesel', soort_motor: 'Binnenboord diesel'},
  Motorjacht: {brandstof: 'Diesel', soort_motor: 'Binnenboord diesel'},
};

function rompOpties(type) {
  if (type === 'Rubberboot') return ['Rubber','PVC','Hypalon','Anders'];
  return ['Staal','Polyester','Aluminium','Hout','Carbon','Rubber','Hypalon','Anders'];
}

const TUBE = ['PVC','Hypalon / CSM','Hypalon-Neopreen','ORCA (Hypalon)','Polyurethaan (PU)','Weet ik niet'];

function TypeFields({type, update}) {
  if (type === 'Zeiljacht' || type === 'Catamaran' || type === 'Trimaran' || type === 'Platbodem' || type === 'Skûtsje') {
    return (
      <s-stack gap="base">
        <s-heading>Zeilgegevens</s-heading>
        <Select label="Aantal masten" name="aantal_masten" update={update} options={['1','2','3 of meer']} />
        <Field label="Masthoogte boven de waterlijn in cm" name="masthoogte" update={update} />
        <s-text>Tip: de masthoogte boven water is ook uw doorvaarthoogte met staande mast. Wij vullen die automatisch in bij Afmetingen.</s-text>
        <Select label="Tuigage" name="tuigage" update={update} options={[
          'Sloep (1 mast)','Kotter','Kits','Yawl','Schoener','Catboot','Gaffeltuig','Spriettuig','Anders',
        ]} />
        <Select label="Kiel" name="kieltype" update={update} options={[
          'Vaste kiel (fin)','Langkiel','Kimkiel','Kielmidzwaard','Midzwaard','Zijzwaarden','Hefkiel','Anders',
        ]} />
        <Select label="Mast strijkbaar" name="mast_strijkbaar" update={update} options={['Nee','Ja, staande mast strijkbaar','Ja, met mastkraan']} />
        <Select label="Rolfok / rolgrootzeil" name="rolsysteem" update={update} options={[
          'Geen','Rolfok','Rolfok en rolgrootzeil','Lazy bag / lazy jacks',
        ]} />
      </s-stack>
    );
  }
  if (type === 'Rubberboot') {
    return (
      <s-stack gap="base">
        <s-heading>Rubberboot</s-heading>
        <Select label="Soort bodem" name="soort_bodem" update={update} options={[
          'Lattenbodem','Airdeck / luchtbodem','Aluminium bodem','Houten vloer (multiplex)','Rolbodem','Weet ik niet',
        ]} />
        <Select label="Soort tube" name="soort_tube" update={update} options={TUBE} />
        <Field label="Aantal luchtkamers" name="luchtkamers" update={update} />
        <Field label="Maximaal toegestaan motorvermogen in pk" name="max_pk" update={update} />
        <Field label="Maximaal aantal personen" name="max_personen" update={update} />
      </s-stack>
    );
  }
  if (type === 'RIB') {
    return (
      <s-stack gap="base">
        <s-heading>RIB</s-heading>
        <Select label="Bodem (romp)" name="soort_bodem" update={update} options={[
          'Polyester V-bodem','Aluminium V-bodem','Diepe V-bodem','Weet ik niet',
        ]} />
        <Select label="Soort tube" name="soort_tube" update={update} options={TUBE} />
        <Field label="Tubediameter in cm" name="tube_diameter" update={update} />
        <Select label="Stuurconsole" name="console" update={update} options={['Middenconsole','Zijconsole','Geen (helmstok)']} />
        <Field label="Maximaal toegestaan motorvermogen in pk" name="max_pk" update={update} />
        <Field label="Maximaal aantal personen" name="max_personen" update={update} />
      </s-stack>
    );
  }
  if (type === 'Motorjacht' || type === 'Kruiser' || type === 'Trawler' || type === 'Sportcruiser') {
    return (
      <s-stack gap="base">
        <s-heading>Motorjacht</s-heading>
        <Select label="Rompvorm" name="rompvorm" update={update} options={[
          'Verdringer','Halfplanerend','Planerend','Weet ik niet',
        ]} />
        <Select label="Stuurstand" name="stuurstand" update={update} options={[
          'Binnenstuurstand','Buitenstuurstand','Binnen en buiten','Flybridge',
        ]} />
        <Field label="Aantal hutten" name="aantal_hutten" update={update} />
        <Field label="Aantal slaapplaatsen" name="slaapplaatsen" update={update} />
        <Field label="Inhoud brandstoftank in liters" name="tank_brandstof" update={update} />
        <Field label="Inhoud watertank in liters" name="tank_water" update={update} />
      </s-stack>
    );
  }
  if (type === 'Speedboot' || type === 'Consoleboot') {
    return (
      <s-stack gap="base">
        <s-heading>Speedboot</s-heading>
        <Select label="Rompvorm" name="rompvorm" update={update} options={['V-bodem','Diepe V-bodem','Vlakke bodem','Catamaranbodem','Weet ik niet']} />
        <Field label="Maximaal toegestaan motorvermogen in pk" name="max_pk" update={update} />
        <Field label="Maximaal aantal personen" name="max_personen" update={update} />
        <Select label="Trailer" name="trailer" update={update} options={['Geen trailer','Geremde trailer','Ongeremde trailer']} />
        <Select label="Vaarbewijs nodig" name="vaarbewijs" update={update} options={['Weet ik niet','Ja (sneller dan 20 km/u)','Nee']} />
      </s-stack>
    );
  }
  return null;
}
