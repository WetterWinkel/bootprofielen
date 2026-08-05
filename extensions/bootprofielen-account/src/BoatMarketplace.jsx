/* global globalThis */
import {useEffect, useState} from 'preact/hooks';

const API_URL = 'https://bootprofielen.onrender.com/api/bootadvertenties';

const EMPTY_FORM = {
  title: '', description: '', price: '', sellerType: 'PARTICULIER',
  vatStatus: 'PARTICULIER_GEEN_BTW', location: '', condition: '',
  knownDefects: '', includedEquipment: '', ceStatus: 'ONBEKEND',
  ceCategory: '', vatProofAvailable: false, kadasterRegistered: false,
  rdwRegistered: false, ownershipConfirmed: false, termsAccepted: false,
};

const STATUS_LABELS = {
  DRAFT: 'Concept', AWAITING_PAYMENT: 'Wacht op betaling',
  PENDING_REVIEW: 'Betaald – controle door WetterWinkel', ACTIVE: 'Online',
  REJECTED: 'Aanpassen en opnieuw indienen', SOLD: 'Verkocht', EXPIRED: 'Verlopen',
};

function fromListing(listing) {
  const data = listing?.publicData || {};
  return {
    ...EMPTY_FORM,
    title: listing?.title || '', description: listing?.description || '',
    price: listing?.price || '', sellerType: listing?.sellerType || 'PARTICULIER',
    vatStatus: listing?.vatStatus || 'PARTICULIER_GEEN_BTW',
    location: listing?.location || '', condition: data.condition || '',
    knownDefects: data.knownDefects || '', includedEquipment: data.includedEquipment || '',
    ceStatus: data.ceStatus || 'ONBEKEND', ceCategory: data.ceCategory || '',
    vatProofAvailable: Boolean(data.vatProofAvailable),
    kadasterRegistered: Boolean(data.kadasterRegistered),
    rdwRegistered: Boolean(data.rdwRegistered),
    ownershipConfirmed: Boolean(data.ownershipConfirmed),
    termsAccepted: Boolean(data.termsAccepted),
  };
}

export function BoatMarketplace() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [listings, setListings] = useState([]);
  const [profileId, setProfileId] = useState('');
  const [listingId, setListingId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [checkoutUrl, setCheckoutUrl] = useState('');

  const listing = listings.find((item) => item.id === listingId);
  const locked = ['PENDING_REVIEW', 'ACTIVE'].includes(listing?.status);
  const photos = listing?.photos || [];

  async function api(method, body) {
    const token = await globalThis.shopify.sessionToken.get();
    const result = await fetch(API_URL, {
      method,
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      ...(body ? {body: JSON.stringify(body)} : {}),
    });
    const json = await result.json().catch(() => ({}));
    if (!result.ok || !json.success) throw new Error(json.message || 'De server kon de aanvraag niet verwerken.');
    return json;
  }

  function replaceListing(updated) {
    setListings((old) => old.some((item) => item.id === updated.id)
      ? old.map((item) => item.id === updated.id ? updated : item)
      : [updated, ...old]);
    setListingId(updated.id);
  }

  useEffect(() => {
    api('GET').then((json) => {
      const profileItems = json.profiles || [];
      const listingItems = json.listings || [];
      setProfiles(profileItems);
      setListings(listingItems);
      setProfileId(listingItems[0]?.profileId || profileItems[0]?.id || '');
      setListingId(listingItems[0]?.id || '');
      if (listingItems[0]) setForm(fromListing(listingItems[0]));
    }).catch((error) => setMessage(error.message)).finally(() => setLoading(false));
  }, []);

  function update(key, value) {
    setForm((old) => ({...old, [key]: value}));
  }

  function selectListing(id) {
    const selected = listings.find((item) => item.id === id);
    setListingId(id);
    setProfileId(selected?.profileId || profiles[0]?.id || '');
    setForm(fromListing(selected));
    setPhotoFiles([]);
    setPhotoInputKey((value) => value + 1);
    setCheckoutUrl('');
    setMessage('');
  }

  function newListing() {
    const profile = profiles.find((item) => item.id === profileId) || profiles[0];
    setListingId('');
    setProfileId(profile?.id || '');
    setForm({...EMPTY_FORM, title: [profile?.data?.merk_boot, profile?.data?.model_boot, profile?.data?.naam_schip].filter(Boolean).join(' – ')});
    setPhotoFiles([]);
    setPhotoInputKey((value) => value + 1);
    setCheckoutUrl('');
    setMessage('Nieuwe advertentie geopend.');
  }

  async function saveDraft(showMessage = true) {
    if (!profileId) throw new Error('Kies eerst een bootprofiel.');
    const json = await api('POST', {intent: 'save_draft', id: listingId || undefined, profileId, listing: form});
    replaceListing(json.listing);
    if (showMessage) setMessage(json.message);
    return json.listing;
  }

  async function fileBase64(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  }

  function selectPhotos(event) {
    const selected = Array.from(event.currentTarget.files || []);
    const allowed = selected.filter((file) => file.type.startsWith('image/') && file.size <= 20 * 1024 * 1024);
    if (photos.length + allowed.length > 20) {
      setMessage(`U kunt nog maximaal ${20 - photos.length} foto's toevoegen.`);
      return;
    }
    if (allowed.length !== selected.length) setMessage('Gebruik alleen afbeeldingen van maximaal 20 MB per foto.');
    setPhotoFiles(allowed);
  }

  async function saveAndUploadPhotos() {
    if (!photoFiles.length || busy) return;
    setBusy(true);
    setMessage('Foto’s uploaden...');
    try {
      let current = listing || await saveDraft(false);
      for (let index = 0; index < photoFiles.length; index += 1) {
        const file = photoFiles[index];
        const json = await api('POST', {
          intent: 'upload_photo', id: current.id,
          photo: {filename: file.name, mimeType: file.type, data: await fileBase64(file)},
        });
        current = json.listing;
        replaceListing(current);
        setMessage(`Foto ${index + 1} van ${photoFiles.length} verwerkt.`);
      }
      setPhotoFiles([]);
      setPhotoInputKey((value) => value + 1);
      setMessage('Alle advertentiefoto’s zijn opgeslagen.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function photoAction(intent, extra) {
    if (!listingId || busy) return;
    setBusy(true);
    try {
      const json = await api('POST', {intent, id: listingId, ...extra});
      replaceListing(json.listing);
      setMessage(json.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function run(action) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (action === 'save') {
        await saveDraft();
      } else if (action === 'checkout') {
        const saved = await saveDraft(false);
        const json = await api('POST', {intent: 'prepare_checkout', id: saved.id});
        if (json.listing) replaceListing(json.listing);
        setMessage(json.message);
        setCheckoutUrl(json.checkoutUrl || '');
      } else if (action === 'sold') {
        const json = await api('POST', {intent: 'mark_sold', id: listingId});
        replaceListing(json.listing);
        setMessage(json.message);
      } else if (action === 'delete') {
        const json = await api('POST', {intent: 'delete_listing', id: listingId});
        const remaining = listings.filter((item) => item.id !== listingId);
        setListings(remaining);
        setListingId(remaining[0]?.id || '');
        setProfileId(remaining[0]?.profileId || profiles[0]?.id || '');
        setForm(fromListing(remaining[0]));
        setMessage(json.message);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <s-stack gap="base">
      <s-button onClick={() => setOpen(!open)}>{open ? '▼ Boot te koop aanbieden sluiten' : '▶ Boot te koop aanbieden'}</s-button>
      {open && (
        <s-stack gap="base">
          <s-heading>Boot te koop aanbieden</s-heading>
          <s-text>€ 14,95 inclusief btw. Na betaling en goedkeuring staat de advertentie 30 kalenderdagen online. WetterWinkel verkoopt alleen advertentieruimte en is geen partij bij de verkoop.</s-text>
          {loading && <s-text>Advertenties laden...</s-text>}
          {listings.length > 0 && (
            <s-select label="Mijn advertenties" value={listingId} onChange={(event) => selectListing(event.currentTarget.value)}>
              <s-option value="">Nieuwe advertentie</s-option>
              {listings.map((item) => <s-option key={item.id} value={item.id}>{item.title} – {STATUS_LABELS[item.status] || item.status}</s-option>)}
            </s-select>
          )}
          <s-button onClick={newListing}>Nieuwe advertentie maken</s-button>
          <s-select label="Bootprofiel" value={profileId} disabled={Boolean(listingId)} onChange={(event) => setProfileId(event.currentTarget.value)}>
            {profiles.map((profile) => <s-option key={profile.id} value={profile.id}>{profile.data?.naam_schip || profile.data?.model_boot || 'Bootprofiel'}</s-option>)}
          </s-select>
          {listing && <s-stack gap="small-300">
            <s-text>Status: {STATUS_LABELS[listing.status] || listing.status}</s-text>
            {listing.expiresAt && <s-text>Online tot {new Date(listing.expiresAt).toLocaleString('nl-NL')}.</s-text>}
            {listing.rejectionReason && <s-text>Aanpassen: {listing.rejectionReason}</s-text>}
          </s-stack>}

          <s-text-field label="Advertentietitel" value={form.title} disabled={locked} onInput={(event) => update('title', event.currentTarget.value)} />
          <s-text-area label="Omschrijving" value={form.description} disabled={locked} onInput={(event) => update('description', event.currentTarget.value)} />
          <s-text-field label="Vraagprijs in euro" value={form.price} disabled={locked} onInput={(event) => update('price', event.currentTarget.value)} />
          <s-text-field label="Plaats of regio van de boot" value={form.location} disabled={locked} onInput={(event) => update('location', event.currentTarget.value)} />
          <s-select label="Verkoper" value={form.sellerType} disabled={locked} onChange={(event) => update('sellerType', event.currentTarget.value)}><s-option value="PARTICULIER">Particulier</s-option><s-option value="ZAKELIJK">Zakelijk</s-option></s-select>
          <s-select label="Btw-status van de vraagprijs" value={form.vatStatus} disabled={locked} onChange={(event) => update('vatStatus', event.currentTarget.value)}>
            <s-option value="PARTICULIER_GEEN_BTW">Particuliere verkoop – geen btw</s-option><s-option value="INCLUSIEF_BTW">Prijs inclusief btw</s-option><s-option value="EXCLUSIEF_BTW">Prijs exclusief btw</s-option><s-option value="MARGEREGELING">Margeregeling</s-option><s-option value="ONBEKEND">Nog vast te stellen</s-option>
          </s-select>
          <s-text-field label="Staat van de boot" value={form.condition} disabled={locked} onInput={(event) => update('condition', event.currentTarget.value)} />
          <s-text-area label="Inbegrepen uitrusting" value={form.includedEquipment} disabled={locked} onInput={(event) => update('includedEquipment', event.currentTarget.value)} />
          <s-text-area label="Bekende gebreken en aandachtspunten" value={form.knownDefects} disabled={locked} onInput={(event) => update('knownDefects', event.currentTarget.value)} />
          <s-select label="CE-status" value={form.ceStatus} disabled={locked} onChange={(event) => update('ceStatus', event.currentTarget.value)}><s-option value="AANWEZIG">CE-markering aanwezig</s-option><s-option value="NIET_VAN_TOEPASSING">Niet van toepassing</s-option><s-option value="ONBEKEND">Onbekend</s-option></s-select>
          <s-text-field label="CE-categorie (optioneel)" value={form.ceCategory} disabled={locked} onInput={(event) => update('ceCategory', event.currentTarget.value)} />
          <s-checkbox label="Btw-aankoopbewijs beschikbaar" checked={form.vatProofAvailable} disabled={locked} onChange={(event) => update('vatProofAvailable', event.currentTarget.checked)} />
          <s-checkbox label="Boot is teboekgesteld bij het Kadaster" checked={form.kadasterRegistered} disabled={locked} onChange={(event) => update('kadasterRegistered', event.currentTarget.checked)} />
          <s-checkbox label="Boot is geregistreerd bij de RDW" checked={form.rdwRegistered} disabled={locked} onChange={(event) => update('rdwRegistered', event.currentTarget.checked)} />

          {!locked && <s-stack gap="base">
            <s-button onClick={() => run('save')} disabled={busy}>{busy ? 'Even geduld...' : 'Advertentieconcept opslaan'}</s-button>
            <s-heading>Advertentiefoto’s ({photos.length}/20)</s-heading>
            <s-drop-zone key={photoInputKey} multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" label="Maximaal 20 foto’s, 20 MB per foto" onInput={selectPhotos} onChange={selectPhotos} disabled={busy} />
            {photoFiles.length > 0 && <s-text>{photoFiles.length} foto’s geselecteerd.</s-text>}
            <s-button onClick={saveAndUploadPhotos} disabled={!photoFiles.length || busy}>Foto’s uploaden</s-button>
          </s-stack>}

          {photos.map((photo, index) => <s-stack key={`${photo.url}-${index}`} gap="small-300">
            {photo.url && <s-image src={photo.url} alt={photo.alt || 'Advertentiefoto'} aspectRatio="16/9" />}
            {!locked && photo.url && listing?.coverPhotoUrl !== photo.url && <s-button onClick={() => photoAction('set_cover', {url: photo.url})} disabled={busy}>Als omslagfoto instellen</s-button>}
            {!locked && <s-button onClick={() => photoAction('delete_photo', {index})} disabled={busy}>Foto verwijderen</s-button>}
          </s-stack>)}

          {!locked && <s-stack gap="base">
            <s-checkbox label="Ik ben eigenaar of bevoegd om deze boot aan te bieden" checked={form.ownershipConfirmed} onChange={(event) => update('ownershipConfirmed', event.currentTarget.checked)} />
            <s-checkbox label="Ik accepteer de advertentievoorwaarden en verklaar dat de gegevens juist zijn" checked={form.termsAccepted} onChange={(event) => update('termsAccepted', event.currentTarget.checked)} />
            <s-link href="https://www.wetterwinkel.nl/apps/bootmarkt/voorwaarden" target="_blank">Advertentievoorwaarden bekijken</s-link>
            <s-button variant="primary" onClick={() => run('checkout')} disabled={busy || !listingId || photos.length === 0}>{listing?.paidAt ? 'Opnieuw ter controle indienen' : 'Betalen en ter controle indienen – € 14,95'}</s-button>
            {checkoutUrl && <s-button href={checkoutUrl} target="_blank">Veilige Shopify-betaling openen</s-button>}
          </s-stack>}

          {listing?.status === 'ACTIVE' && <s-button onClick={() => run('sold')} disabled={busy}>Markeren als verkocht</s-button>}
          {listing && ['DRAFT', 'REJECTED', 'EXPIRED', 'SOLD', 'AWAITING_PAYMENT'].includes(listing.status) && <s-button onClick={() => run('delete')} disabled={busy}>Advertentie verwijderen</s-button>}
          {listing?.inquiries?.length > 0 && <s-stack gap="base"><s-heading>Reacties op deze advertentie</s-heading>{listing.inquiries.map((inquiry) => <s-stack key={inquiry.id} gap="small-300"><s-text>{inquiry.name} · {inquiry.email}{inquiry.phone ? ` · ${inquiry.phone}` : ''}</s-text><s-text>{inquiry.message}</s-text></s-stack>)}</s-stack>}
          {message && <s-text>{message}</s-text>}
        </s-stack>
      )}
    </s-stack>
  );
}
