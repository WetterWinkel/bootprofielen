import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useState} from 'preact/hooks';

const API_URL =
  'https://bootprofielen.onrender.com/api/bootprofielen';

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({});

  const update = (key, value) =>
    setForm((old) => ({...old, [key]: value}));

  async function saveBootprofiel() {
    setSaving(true);
    setMessage('');

    try {
      setMessage('Stap 1: sessietoken ophalen...');

      if (!globalThis.shopify?.sessionToken?.get) {
        throw new Error('Shopify sessionToken API is niet beschikbaar');
      }

      const token = await globalThis.shopify.sessionToken.get();

      if (!token) {
        throw new Error('Shopify gaf geen sessietoken terug');
      }

      setMessage('Stap 2: gegevens naar server sturen...');

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const responseText = await response.text();

      let json;
      try {
        json = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Server gaf geen geldige JSON terug (${response.status}): ${responseText.slice(0, 200)}`
        );
      }

      setMessage(
        json.success
          ? 'Bootprofiel opgeslagen.'
          : `Opslaan mislukt: ${json.message || 'Onbekende fout'}${
              json.errors?.length
                ? ' — ' + json.errors.map((error) => error.message).join(', ')
                : ''
            }`,
      );
    } catch (error) {
      setMessage(`Opslaan mislukt vóór de server: ${error?.message || String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <s-stack gap="base">
      <s-heading>Mijn bootdossier</s-heading>

      <s-button onClick={() => setOpen(!open)}>
        {open ? '▼ Bootprofiel verbergen' : '▶ Bootprofiel openen'}
      </s-button>

      {open && (
        <s-stack gap="base">
          <s-heading>1. Basisgegevens</s-heading>
          <Field label="Naam schip" name="naam_schip" update={update} />
          <Field label="Merk boot" name="merk_boot" update={update} />
          <Field label="Model boot" name="model_boot" update={update} />
          <Field label="Bouwjaar boot" name="bouwjaar_boot" update={update} />
          <Field label="HIN / CIN nummer" name="hin_cin" update={update} />
          <Field label="Registratienummer" name="registratienummer" update={update} />

          <Select label="Boottype" name="boottype" update={update} options={[
            'Motorjacht','Zeiljacht','Sloep','Tender','Consoleboot','Speedboot',
            'Sportcruiser','Kajuitboot','Visboot','RIB','Kruiser','Trawler',
            'Kotter','Salonboot','Platbodem','Aak','Skûtsje','Vlet','Opduwer',
            'Houseboat / woonboot','Catamaran','Trimaran','Rubberboot','Anders',
          ]} />

          <s-heading>2. Romp</s-heading>
          <Select label="Materiaal romp" name="materiaal_romp" update={update} options={[
            'Staal','Polyester','Aluminium','Hout','Carbon','Rubber','Hypalon','Anders',
          ]} />

          <s-heading>3. Afmetingen</s-heading>
          <Field label="Lengte in cm" name="lengte" update={update} />
          <Field label="Breedte in cm" name="breedte" update={update} />
          <Field label="Diepgang in cm" name="diepgang" update={update} />
          <Field label="Doorvaarthoogte in cm" name="doorvaarthoogte" update={update} />
          <Field label="Waterverplaatsing in kg" name="waterverplaatsing" update={update} />

          <s-heading>4. Brandstof</s-heading>
          <Select label="Brandstof" name="brandstof" update={update} options={[
            'Diesel','Benzine','Elektrisch','Hybride',
          ]} />

          <s-heading>5. Motor</s-heading>
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

          <s-heading>6. Vaargebied & ligplaats</s-heading>
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

          <s-heading>7. Navigatie</s-heading>
          {[
            'Plotter / kaartplotter','Radar','AIS','Marifoon','Autopilot',
            'Dieptemeter','Log / snelheidsmeter','Kompas','Fishfinder','GPS',
          ].map((item) => <Check key={item} label={item} update={update} />)}

          <s-heading>8. Comfort</s-heading>
          {[
            'Airco','Heteluchtverwarming','Vloerverwarming','Boiler','Douche',
            'Toilet elektrisch','Toilet handmatig / pomptoilet','Koelkast',
            'Vriezer','Magnetron','Oven','Koken gas','Koken elektrisch','TV',
            'Audio-installatie','Wifi','Bluetooth boordsysteem',
          ].map((item) => <Check key={item} label={item} update={update} />)}

          <s-heading>9. Elektrisch</s-heading>
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

          <s-heading>10. Dek</s-heading>
          {[
            'Boegschroef','Hekschroef','Ankerlier','Davits','Deckwash','Trimtabs',
            'Spudpalen','Zwemplatform','Zwemtrap','Bimini','Cabriokap','Buiskap',
            'Kuiptent','Teakdek',
          ].map((item) => <Check key={item} label={item} update={update} />)}

          <s-heading>11. Veiligheid</s-heading>
          {[
            'Bilgepomp automatisch','Bilgepomp handmatig','Brandblussysteem','EPIRB',
            'Reddingsvlot','Reddingsvesten','Gasdetector','Koolmonoxidemelder','Rookmelder',
          ].map((item) => <Check key={item} label={item} update={update} />)}

          <s-button onClick={saveBootprofiel} disabled={saving}>
            {saving ? 'Opslaan...' : 'Bootprofiel opslaan'}
          </s-button>

          {message && <s-text>{message}</s-text>}
        </s-stack>
      )}

      <s-button disabled>▶ Serviceboek komt later</s-button>
      <s-button disabled>▶ Captain AI komt later</s-button>
    </s-stack>
  );
}

function Field({label, name, update}) {
  return (
    <s-text-field
      label={label}
      onInput={(event) => update(name, event.currentTarget.value)}
      onChange={(event) => update(name, event.currentTarget.value)}
    />
  );
}

function Select({label, name, options, update}) {
  return (
    <s-select
      label={label}
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
  const key = label.toLowerCase().replaceAll(' ', '_').replaceAll('/', '_');

  return (
    <s-checkbox
      label={label}
      onChange={(event) => update(key, event.currentTarget.checked)}
    />
  );
}