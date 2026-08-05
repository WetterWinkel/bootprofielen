import '@shopify/ui-extensions/preact';
import {useEffect, useState} from 'preact/hooks';

const CATEGORIES = [
  'Motoronderhoud',
  'Aandrijving & keerkoppeling',
  'Brandstofsysteem',
  'Koeling & impeller',
  'Elektrisch & accu',
  'Schroef & schroefas',
  'Romp & anodes',
  'Stuurinrichting',
  'Navigatie & elektronica',
  'Veiligheid',
  'Comfort & sanitair',
  'Winterklaar / voorjaarsbeurt',
  'Inspectie / keuring',
  'Reparatie',
  'Upgrade / verbouwing',
  'Overige werkzaamheden',
];

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function motorName(profile) {
  return [profile?.data?.motormerk, profile?.data?.motormodel]
    .filter(Boolean)
    .join(' ');
}

function emptyForm(profile) {
  return {
    status: 'COMPLETED',
    serviceDate: today(),
    category: CATEGORIES[0],
    component: motorName(profile),
    title: '',
    description: '',
    engineHours: '',
    performedBy: '',
    partsMaterials: '',
    reference: '',
    cost: '',
    nextServiceHours: '',
    nextServiceDate: '',
    reminderEnabled: true,
  };
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('nl-NL', {dateStyle: 'long'})
      .format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function fieldValue(event) {
  return event.currentTarget?.value ?? '';
}

function fieldChecked(event) {
  return Boolean(event.currentTarget?.checked);
}

function validateForm(form) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(form.serviceDate || ''))) {
    return 'Kies een geldige datum.';
  }
  if (!String(form.category || '').trim()) return 'Kies een categorie.';
  if (!String(form.description || '').trim()) {
    return 'Beschrijf de uitgevoerde of geplande werkzaamheden.';
  }
  if (form.status === 'COMPLETED' && !String(form.performedBy || '').trim()) {
    return 'Vul in wie de werkzaamheden heeft uitgevoerd.';
  }
  return '';
}

function sortEntries(items) {
  return [...items].sort((left, right) =>
    right.serviceDate.localeCompare(left.serviceDate) ||
    right.createdAt.localeCompare(left.createdAt),
  );
}

export function DigitalServiceBook({api, profileId, profile, fileBase64}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [entries, setEntries] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(() => emptyForm(profile));
  const [attachment, setAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState('');
  const [attachmentKey, setAttachmentKey] = useState(0);

  useEffect(() => {
    setOpen(false);
    setEntries([]);
    setEditingId('');
    setFormOpen(false);
    setForm(emptyForm(profile));
    setAttachment(null);
    setAttachmentError('');
    setMessage('');
  }, [profileId]);

  function update(key, value) {
    setForm((current) => ({...current, [key]: value}));
  }

  async function loadEntries() {
    if (!profileId) return;
    setLoading(true);
    setMessage('');
    try {
      const json = await api('POST', {intent: 'service_list', profileId});
      setEntries(json.entries || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && profileId) await loadEntries();
  }

  function startNew() {
    setEditingId('');
    setForm(emptyForm(profile));
    setAttachment(null);
    setAttachmentError('');
    setAttachmentKey((value) => value + 1);
    setFormOpen(true);
    setMessage('');
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setForm({
      status: entry.status,
      serviceDate: entry.serviceDate,
      category: entry.category,
      component: entry.component,
      title: entry.title,
      description: entry.description,
      engineHours: entry.engineHours,
      performedBy: entry.performedBy,
      partsMaterials: entry.partsMaterials,
      reference: entry.reference,
      cost: entry.cost,
      nextServiceHours: entry.nextServiceHours,
      nextServiceDate: entry.nextServiceDate,
      reminderEnabled: entry.reminderEnabled,
    });
    setAttachment(null);
    setAttachmentError('');
    setAttachmentKey((value) => value + 1);
    setFormOpen(true);
    setMessage('');
  }

  function cancelEdit() {
    setEditingId('');
    setFormOpen(false);
    setAttachment(null);
    setAttachmentError('');
    setForm(emptyForm(profile));
  }

  function selectAttachment(event) {
    const file = event.currentTarget.files?.[0];
    setAttachmentError('');
    if (!file) {
      setAttachment(null);
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setAttachment(null);
      setAttachmentError('Een bewijsstuk mag maximaal 15 MB zijn.');
      return;
    }
    setAttachment(file);
  }

  async function saveEntry() {
    if (!profileId || saving) return;
    const validationError = validateForm(form);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setSaving(true);
    setMessage('');
    const selectedAttachment = attachment;
    try {
      const intent = editingId ? 'service_update' : 'service_create';
      const json = await api('POST', {
        intent,
        profileId,
        ...(editingId ? {entryId: editingId} : {}),
        entry: form,
      });
      let saved = json.entry;
      let savedMessage = json.message;

      // Prefer the list that the backend has just read back from Prisma. This
      // is stronger than an optimistic local update: the item shown below is
      // demonstrably persisted and is the same source used by the PDF.
      if (Array.isArray(json.entries)) {
        setEntries(sortEntries(json.entries));
      } else {
        setEntries((current) => {
          const exists = current.some((item) => item.id === saved.id);
          return sortEntries(exists
            ? current.map((item) => item.id === saved.id ? saved : item)
            : [saved, ...current]);
        });
      }

      setEditingId('');
      setFormOpen(false);
      setForm(emptyForm(profile));
      setAttachment(null);
      setAttachmentError('');
      setAttachmentKey((value) => value + 1);
      setMessage(savedMessage || 'Onderhoudsregel opgeslagen.');

      if (selectedAttachment) {
        try {
          const uploaded = await api('POST', {
            intent: 'service_upload_attachment',
            profileId,
            entryId: saved.id,
            attachment: {
              filename: selectedAttachment.name,
              mimeType: selectedAttachment.type,
              data: await fileBase64(selectedAttachment),
            },
          });
          saved = uploaded.entry;
          savedMessage = uploaded.message;
          setEntries(Array.isArray(uploaded.entries)
            ? sortEntries(uploaded.entries)
            : (current) => sortEntries(current.map((item) =>
                item.id === saved.id ? saved : item,
              )));
          setMessage(savedMessage || 'Onderhoudsregel en bewijsstuk opgeslagen.');
        } catch (uploadError) {
          // The maintenance row is already safely stored. A file problem must
          // never make that successful save look like it failed.
          setMessage(
            `De onderhoudsregel is opgeslagen en staat hieronder. Alleen het bewijsstuk is niet toegevoegd: ${uploadError.message}`,
          );
        }
      }
    } catch (error) {
      setMessage(`Opslaan mislukt: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entry) {
    if (saving) return;
    setSaving(true);
    setMessage('');
    try {
      const json = await api('POST', {
        intent: 'service_delete',
        profileId,
        entryId: entry.id,
      });
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      if (editingId === entry.id) cancelEdit();
      setMessage(json.message || 'Onderhoudsregel verwijderd.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAttachment(entry, file) {
    if (saving) return;
    setSaving(true);
    setMessage('');
    try {
      const json = await api('POST', {
        intent: 'service_delete_attachment',
        profileId,
        entryId: entry.id,
        attachmentId: file.id,
      });
      setEntries((current) => current.map((item) =>
        item.id === entry.id ? json.entry : item,
      ));
      setMessage(json.message || 'Bijlage verwijderd.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  const boatName = profile?.data?.naam_schip || profile?.data?.model_boot || 'de gekozen boot';

  return (
    <s-stack gap="base">
      <s-button onClick={toggle}>
        {open ? '▼ Digitaal serviceboek sluiten' : '▶ Digitaal serviceboek'}
      </s-button>

      {open && (
        <s-stack gap="base">
          {!profileId && (
            <s-text>Sla eerst een bootprofiel op. Daarna kunt u onderhoud aan die boot toevoegen.</s-text>
          )}

          {profileId && (
            <>
              <s-heading>Digitaal serviceboek · {boatName}</s-heading>
              <s-text>Opgeslagen regels voor deze boot: {entries.length}</s-text>
              <s-text>
                Leg onderhoud, reparaties, onderdelen en volgende beurten vast. Iedere regel is privé en blijft aan deze boot gekoppeld, ook bij een veilige bootoverdracht.
              </s-text>
              <s-text>
                De gestructureerde motor- en onderhoudsgegevens kunnen later door Captain AI worden gebruikt voor adviezen op basis van het juiste motorhandboek.
              </s-text>

              {!formOpen && (
                <s-button onClick={startNew}>Onderhoud of werkzaamheden toevoegen</s-button>
              )}

              {formOpen && (
                <s-stack gap="base">
                  <s-heading>{editingId ? 'Onderhoudsregel wijzigen' : 'Nieuwe onderhoudsregel'}</s-heading>
                  {message && <s-text>{message}</s-text>}
                  <s-select
                    label="Status *"
                    value={form.status}
                    onChange={(event) => update('status', fieldValue(event))}
                  >
                    <s-option value="COMPLETED">Uitgevoerd</s-option>
                    <s-option value="PLANNED">Gepland</s-option>
                  </s-select>
                  <ServiceDateField label="Datum *" name="serviceDate" form={form} update={update} />
                  <s-select
                    label="Categorie *"
                    value={form.category}
                    onChange={(event) => update('category', fieldValue(event))}
                  >
                    {CATEGORIES.map((category) => (
                      <s-option key={category} value={category}>{category}</s-option>
                    ))}
                  </s-select>
                  <ServiceField
                    label="Betreffende motor, installatie of onderdeel"
                    name="component"
                    form={form}
                    update={update}
                  />
                  <ServiceField label="Korte titel" name="title" form={form} update={update} />
                  <s-text-area
                    label="Omschrijving werkzaamheden *"
                    value={form.description}
                    rows={5}
                    onInput={(event) => update('description', fieldValue(event))}
                    onChange={(event) => update('description', fieldValue(event))}
                  />
                  <ServiceField label="Motoruren" name="engineHours" form={form} update={update} />
                  <ServiceField
                    label={form.status === 'COMPLETED' ? 'Uitgevoerd door *' : 'Uit te voeren door'}
                    name="performedBy"
                    form={form}
                    update={update}
                  />
                  <s-text-area
                    label="Gebruikte onderdelen en materialen"
                    value={form.partsMaterials}
                    rows={3}
                    onInput={(event) => update('partsMaterials', fieldValue(event))}
                    onChange={(event) => update('partsMaterials', fieldValue(event))}
                  />
                  <ServiceField
                    label="Factuurnummer, werkbon of eigen referentie"
                    name="reference"
                    form={form}
                    update={update}
                  />
                  <ServiceField label="Kosten in euro" name="cost" form={form} update={update} />
                  <ServiceField
                    label="Volgende beurt bij motoruren"
                    name="nextServiceHours"
                    form={form}
                    update={update}
                  />
                  <ServiceDateField
                    label="Volgende beurt op datum"
                    name="nextServiceDate"
                    form={form}
                    update={update}
                  />
                  <s-checkbox
                    label="Volgende beurt als aandachtspunt bewaren"
                    checked={Boolean(form.reminderEnabled)}
                    onChange={(event) => update('reminderEnabled', fieldChecked(event))}
                  />
                  <s-drop-zone
                    key={attachmentKey}
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif,application/pdf"
                    label="Foto, factuur of werkbon toevoegen (optioneel)"
                    error={attachmentError || undefined}
                    disabled={saving}
                    onInput={selectAttachment}
                    onChange={selectAttachment}
                  />
                  {attachment && <s-text>Geselecteerd: {attachment.name}</s-text>}
                  <s-button onClick={saveEntry} disabled={saving}>
                    {saving ? 'Opslaan...' : 'Opslaan in Digitaal serviceboek'}
                  </s-button>
                  <s-button onClick={cancelEdit} disabled={saving}>Annuleren</s-button>
                </s-stack>
              )}

              {loading && <s-text>Digitaal serviceboek laden...</s-text>}
              {!loading && entries.length === 0 && (
                <s-text>Nog geen onderhoudsregels voor deze boot.</s-text>
              )}

              {!formOpen && message && <s-text>{message}</s-text>}

              {entries.map((entry) => (
                <s-stack key={entry.id} gap="small-300">
                  <s-heading>{formatDate(entry.serviceDate)} · {entry.title}</s-heading>
                  <s-text>{entry.status === 'PLANNED' ? 'Gepland' : 'Uitgevoerd'} · {entry.category}</s-text>
                  {entry.component && <s-text>Onderdeel/installatie: {entry.component}</s-text>}
                  {entry.engineHours !== '' && <s-text>Motoruren: {entry.engineHours}</s-text>}
                  <s-text>{entry.description}</s-text>
                  {entry.performedBy && <s-text>Uitgevoerd door: {entry.performedBy}</s-text>}
                  {entry.partsMaterials && <s-text>Onderdelen/materialen: {entry.partsMaterials}</s-text>}
                  {entry.reference && <s-text>Referentie: {entry.reference}</s-text>}
                  {entry.cost && <s-text>Kosten: € {entry.cost}</s-text>}
                  {entry.nextServiceHours !== '' && (
                    <s-text>Volgende beurt bij {entry.nextServiceHours} motoruren.</s-text>
                  )}
                  {entry.nextServiceDate && (
                    <s-text>Volgende beurt op {formatDate(entry.nextServiceDate)}.</s-text>
                  )}
                  {(entry.attachments || []).map((file) => (
                    <s-stack key={file.id} gap="small-300">
                      {file.url
                        ? <s-button href={file.url} target="_blank">Bijlage openen: {file.filename}</s-button>
                        : <s-text>Bijlage wordt verwerkt: {file.filename}</s-text>}
                      <s-button onClick={() => deleteAttachment(entry, file)} disabled={saving}>
                        Bijlage verwijderen
                      </s-button>
                    </s-stack>
                  ))}
                  <s-button onClick={() => startEdit(entry)} disabled={saving}>Wijzigen</s-button>
                  <s-button onClick={() => deleteEntry(entry)} disabled={saving}>Onderhoudsregel verwijderen</s-button>
                </s-stack>
              ))}
            </>
          )}

        </s-stack>
      )}
    </s-stack>
  );
}

function ServiceField({label, name, form, update}) {
  return (
    <s-text-field
      label={label}
      value={String(form[name] ?? '')}
      onInput={(event) => update(name, fieldValue(event))}
      onChange={(event) => update(name, fieldValue(event))}
    />
  );
}

function ServiceDateField({label, name, form, update}) {
  return (
    <s-date-field
      label={label}
      value={String(form[name] ?? '')}
      onInput={(event) => update(name, fieldValue(event))}
      onChange={(event) => update(name, fieldValue(event))}
    />
  );
}
