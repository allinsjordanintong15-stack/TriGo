import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  EXPIRY_RANGE,
  loadOutOfArea,
  outOfAreaEqual,
  parseWholeNumber,
  RADIUS_RANGE,
  saveOutOfArea,
  StaleOutOfAreaError,
  type LoadedOutOfArea,
  type OutOfAreaSettings,
} from '../settings/outOfAreaSettings';
import {
  formatGcashNumber,
  GCASH_NAME_MAX_LENGTH,
  loadPaymentSettings,
  parseGcashName,
  parseGcashNumber,
  paymentSettingsEqual,
  savePaymentSettings,
  StalePaymentSettingsError,
  type LoadedPaymentSettings,
  type PaymentSettings,
} from '../settings/paymentSettings';
import {
  deleteSupportContact,
  LABEL_MAX_LENGTH,
  loadSupportContacts,
  parseLabel,
  parsePhone,
  parseSortOrder,
  saveSupportContact,
  SORT_ORDER_RANGE,
  type SupportContact,
  type SupportContactInput,
} from '../settings/supportContacts';

export function SystemSettingsPage() {
  return (
    <div className="stack">
      <OutOfAreaSettingsCard />
      <PaymentAccountCard />
      <SupportContactsCard />
    </div>
  );
}

// ─── TriGo GCash account ───────────────────────────────────────────────────

type PaymentValues = { gcashName: string; gcashNumber: string };
type PaymentErrors = Partial<Record<keyof PaymentValues, string>>;

function toPaymentValues(saved: PaymentSettings | null): PaymentValues {
  return {
    gcashName: saved?.gcashName ?? '',
    gcashNumber: saved ? formatGcashNumber(saved.gcashNumber) : '',
  };
}

function parsePayment(values: PaymentValues): { settings: PaymentSettings | null; errors: PaymentErrors } {
  const name = parseGcashName(values.gcashName);
  const number = parseGcashNumber(values.gcashNumber);
  const errors: PaymentErrors = {};
  if ('error' in name) errors.gcashName = name.error;
  if ('error' in number) errors.gcashNumber = number.error;
  if ('value' in name && 'value' in number) {
    return { settings: { gcashName: name.value, gcashNumber: number.value }, errors };
  }
  return { settings: null, errors };
}

function PaymentAccountCard() {
  const { admin } = useAuth();
  const [loaded, setLoaded] = useState<LoadedPaymentSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<PaymentValues>(() => toPaymentValues(null));
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await loadPaymentSettings();
      setLoaded(result);
      setValues(toPaymentValues(result.saved));
      setTouched(false);
    } catch {
      setLoadError('Could not load the GCash account. Check your connection and reload the page.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const { settings: parsed, errors } = useMemo(() => parsePayment(values), [values]);

  if (loadError) {
    return (
      <div className="card">
        <h2>TriGo GCash account</h2>
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      </div>
    );
  }

  if (!loaded) {
    return <div className="card muted">Loading the GCash account…</div>;
  }

  const saved = loaded.saved;
  const hasChanges = parsed !== null && !paymentSettingsEqual(parsed, saved);
  const isPristine = values.gcashName === toPaymentValues(saved).gcashName
    && values.gcashNumber === toPaymentValues(saved).gcashNumber;

  function setField(field: keyof PaymentValues, value: string) {
    setSavedMessage(false);
    setSaveError(null);
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (hasChanges) {
      setSaveError(null);
      setConfirming(true);
    }
  }

  async function handleConfirm() {
    if (!parsed || !admin || !loaded) return;
    setSaving(true);
    setSaveError(null);
    try {
      await savePaymentSettings(parsed, loaded.saved, admin.uid);
      setConfirming(false);
      await reload();
      setSavedMessage(true);
    } catch (error) {
      setSaveError(
        error instanceof StalePaymentSettingsError
          ? error.message
          : 'Could not save the GCash account. Check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  const rows = parsed
    ? [
        { label: 'Account name', old: saved?.gcashName ?? '(not set)', next: parsed.gcashName },
        {
          label: 'GCash number',
          old: saved ? formatGcashNumber(saved.gcashNumber) : '(not set)',
          next: formatGcashNumber(parsed.gcashNumber),
        },
      ]
    : [];

  return (
    <>
      <form className="card" onSubmit={handleSubmit} noValidate>
        <h2>TriGo GCash account</h2>
        <p className="muted">
          Drivers pay their commission to this GCash account and enter the GCash reference number in the app. TriGo
          does not move money: an admin checks each payment in this GCash account before confirming it.
        </p>
        <p className="muted small">
          {saved
            ? `Last updated ${loaded.updatedAt ? loaded.updatedAt.toLocaleString() : 'at an unknown time'}.`
            : 'No GCash account is saved yet, so drivers have no payment instructions.'}{' '}
          Only admins and drivers can see it.
        </p>

        <div className="fare-grid">
          <label className="field" htmlFor="gcash-name">
            <span>Account name</span>
            <input
              id="gcash-name"
              value={values.gcashName}
              onChange={(e) => setField('gcashName', e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && errors.gcashName ? true : undefined}
              disabled={saving}
            />
            <span className="hint">
              {touched && errors.gcashName ? (
                <span className="field-error">{errors.gcashName}</span>
              ) : (
                `The name GCash shows when sending, so drivers can check it is TriGo. At most ${GCASH_NAME_MAX_LENGTH} characters.`
              )}
            </span>
          </label>

          <label className="field" htmlFor="gcash-number">
            <span>GCash number</span>
            <input
              id="gcash-number"
              inputMode="tel"
              value={values.gcashNumber}
              onChange={(e) => setField('gcashNumber', e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && errors.gcashNumber ? true : undefined}
              disabled={saving}
            />
            <span className="hint">
              {touched && errors.gcashNumber ? (
                <span className="field-error">{errors.gcashNumber}</span>
              ) : (
                'Mobile number of the GCash account, e.g. 0917 123 4567.'
              )}
            </span>
          </label>
        </div>

        {savedMessage && (
          <div className="alert-success" role="status">
            GCash account saved.
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setSavedMessage(false);
              setTouched(false);
              setValues(toPaymentValues(saved));
            }}
            disabled={saving || isPristine}
          >
            Reset
          </button>
          <button type="submit" className="btn-primary" disabled={saving || isPristine}>
            Save changes
          </button>
        </div>
      </form>

      {confirming && parsed && (
        <ConfirmDialog
          title="Save the GCash account?"
          confirmLabel="Save account"
          busy={saving}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setConfirming(false)}
        >
          <table className="change-table">
            <thead>
              <tr>
                <th>Setting</th>
                <th>Old</th>
                <th />
                <th>New</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className={row.old !== row.next ? 'changed' : 'unchanged'}>
                  <td>{row.label}</td>
                  <td>{row.old}</td>
                  <td aria-hidden="true">→</td>
                  <td>{row.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small">Drivers see the new account the next time they open their payment instructions.</p>
          {saveError && (
            <div className="alert-error" role="alert">
              {saveError}
            </div>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}

// ─── Out-of-area settings ──────────────────────────────────────────────────

type OutOfAreaValues = { enabled: boolean; requestExpiryMinutes: string; driverSearchRadiusKm: string };
type OutOfAreaErrors = Partial<Record<'requestExpiryMinutes' | 'driverSearchRadiusKm', string>>;

function toOutOfAreaValues(settings: OutOfAreaSettings): OutOfAreaValues {
  return {
    enabled: settings.enabled,
    requestExpiryMinutes: String(settings.requestExpiryMinutes),
    driverSearchRadiusKm: String(settings.driverSearchRadiusKm),
  };
}

function parseOutOfArea(values: OutOfAreaValues): { settings: OutOfAreaSettings | null; errors: OutOfAreaErrors } {
  const expiry = parseWholeNumber(values.requestExpiryMinutes, EXPIRY_RANGE, 'minutes');
  const radius = parseWholeNumber(values.driverSearchRadiusKm, RADIUS_RANGE, 'km');
  const errors: OutOfAreaErrors = {};
  if ('error' in expiry) errors.requestExpiryMinutes = expiry.error;
  if ('error' in radius) errors.driverSearchRadiusKm = radius.error;
  if ('value' in expiry && 'value' in radius) {
    return {
      settings: { enabled: values.enabled, requestExpiryMinutes: expiry.value, driverSearchRadiusKm: radius.value },
      errors,
    };
  }
  return { settings: null, errors };
}

const OUT_OF_AREA_ROWS: { field: keyof OutOfAreaSettings; label: string; format: (s: OutOfAreaSettings) => string }[] = [
  { field: 'enabled', label: 'Out-of-area requests', format: (s) => (s.enabled ? 'Accepted' : 'Turned off') },
  { field: 'requestExpiryMinutes', label: 'Request expiry', format: (s) => `${s.requestExpiryMinutes} min` },
  { field: 'driverSearchRadiusKm', label: 'Driver search radius', format: (s) => `${s.driverSearchRadiusKm} km` },
];

function OutOfAreaSettingsCard() {
  const { admin } = useAuth();
  const [loaded, setLoaded] = useState<LoadedOutOfArea | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<OutOfAreaValues | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await loadOutOfArea();
      setLoaded(result);
      setValues(toOutOfAreaValues(result.settings));
    } catch {
      setLoadError('Could not load out-of-area settings. Check your connection and reload the page.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const { settings: parsed, errors } = useMemo(
    () => (values ? parseOutOfArea(values) : { settings: null, errors: {} as OutOfAreaErrors }),
    [values],
  );

  if (loadError) {
    return (
      <div className="card">
        <h2>Out-of-area trips</h2>
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      </div>
    );
  }

  if (!loaded || !values) {
    return <div className="card muted">Loading out-of-area settings…</div>;
  }

  const current = loaded.settings;
  const usingDefaults = loaded.saved === null;
  // With nothing saved yet, saving the defaults unchanged is allowed (it stores them).
  const hasChanges = parsed !== null && (usingDefaults || !outOfAreaEqual(parsed, current));
  const isPristine = outOfAreaEqual(parsed, current);

  function setField<K extends keyof OutOfAreaValues>(field: K, value: OutOfAreaValues[K]) {
    setSavedMessage(false);
    setSaveError(null);
    setValues((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (hasChanges) {
      setSaveError(null);
      setConfirming(true);
    }
  }

  async function handleConfirm() {
    if (!parsed || !admin || !loaded) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveOutOfArea(parsed, loaded.saved, admin.uid);
      setConfirming(false);
      setSavedMessage(true);
      await reload();
    } catch (error) {
      setSaveError(
        error instanceof StaleOutOfAreaError
          ? error.message
          : 'Could not save out-of-area settings. Check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form className="card" onSubmit={handleSubmit} noValidate>
        <h2>Out-of-area trips</h2>
        <p className="muted">
          Trips with a pickup or destination outside Trinidad. The fare is the per-km fare from Fare settings.
        </p>
        <p className="muted small">
          {usingDefaults
            ? 'No out-of-area settings are saved yet, so the app uses its built-in defaults shown below.'
            : `Last updated ${loaded.updatedAt ? loaded.updatedAt.toLocaleString() : 'at an unknown time'}.`}{' '}
          The app picks up changes the next time it loads its settings. Requests already sent keep their expiry.
        </p>

        <label className="field" htmlFor="out-of-area-enabled">
          <span>Accept out-of-area requests</span>
          <span className="switch">
            <input
              id="out-of-area-enabled"
              type="checkbox"
              role="switch"
              checked={values.enabled}
              onChange={(e) => setField('enabled', e.target.checked)}
              disabled={saving}
            />
            <span className="switch-track" aria-hidden="true" />
          </span>
          <span className="hint">
            {values.enabled
              ? 'Passengers can send out-of-area requests.'
              : 'Passengers see "Out-of-area requests are not available at this time."'}
          </span>
        </label>

        <div className="fare-grid">
          <label className="field" htmlFor="out-of-area-expiry">
            <span>Request expiry (minutes)</span>
            <input
              id="out-of-area-expiry"
              inputMode="numeric"
              value={values.requestExpiryMinutes}
              onChange={(e) => setField('requestExpiryMinutes', e.target.value)}
              aria-invalid={errors.requestExpiryMinutes ? true : undefined}
              disabled={saving}
            />
            <span className="hint">
              {errors.requestExpiryMinutes ? (
                <span className="field-error">{errors.requestExpiryMinutes}</span>
              ) : (
                `How long a request stays open for drivers. ${EXPIRY_RANGE.min}–${EXPIRY_RANGE.max} minutes. Current: ${current.requestExpiryMinutes} min`
              )}
            </span>
          </label>

          <label className="field" htmlFor="out-of-area-radius">
            <span>Driver search radius (km)</span>
            <input
              id="out-of-area-radius"
              inputMode="numeric"
              value={values.driverSearchRadiusKm}
              onChange={(e) => setField('driverSearchRadiusKm', e.target.value)}
              aria-invalid={errors.driverSearchRadiusKm ? true : undefined}
              disabled={saving}
            />
            <span className="hint">
              {errors.driverSearchRadiusKm ? (
                <span className="field-error">{errors.driverSearchRadiusKm}</span>
              ) : (
                `Drivers this close to the pickup see the request. ${RADIUS_RANGE.min}–${RADIUS_RANGE.max} km. Current: ${current.driverSearchRadiusKm} km`
              )}
            </span>
          </label>
        </div>

        {savedMessage && (
          <div className="alert-success" role="status">
            Out-of-area settings saved.
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setSavedMessage(false);
              setValues(toOutOfAreaValues(current));
            }}
            disabled={saving || isPristine}
          >
            Reset
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !hasChanges}>
            Save changes
          </button>
        </div>
      </form>

      {confirming && parsed && (
        <ConfirmDialog
          title="Save out-of-area settings?"
          confirmLabel="Save settings"
          busy={saving}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setConfirming(false)}
        >
          <table className="change-table">
            <thead>
              <tr>
                <th>Setting</th>
                <th>Old</th>
                <th />
                <th>New</th>
              </tr>
            </thead>
            <tbody>
              {OUT_OF_AREA_ROWS.map(({ field, label, format }) => (
                <tr key={field} className={current[field] !== parsed[field] ? 'changed' : 'unchanged'}>
                  <td>{label}</td>
                  <td>{format(current)}</td>
                  <td aria-hidden="true">→</td>
                  <td>{format(parsed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {usingDefaults && <p className="muted small">"Old" values are the app's built-in defaults.</p>}
          {saveError && (
            <div className="alert-error" role="alert">
              {saveError}
            </div>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}

// ─── Support contacts ──────────────────────────────────────────────────────

type ContactValues = { label: string; phone: string; active: boolean; sortOrder: string };
type ContactErrors = Partial<Record<'label' | 'phone' | 'sortOrder', string>>;

const EMPTY_CONTACT: ContactValues = { label: '', phone: '', active: true, sortOrder: '1' };

function toContactValues(contact: SupportContact): ContactValues {
  return { label: contact.label, phone: contact.phone, active: contact.active, sortOrder: String(contact.sortOrder) };
}

function parseContact(values: ContactValues): { contact: SupportContactInput | null; errors: ContactErrors } {
  const label = parseLabel(values.label);
  const phone = parsePhone(values.phone);
  const sortOrder = parseSortOrder(values.sortOrder);
  const errors: ContactErrors = {};
  if ('error' in label) errors.label = label.error;
  if ('error' in phone) errors.phone = phone.error;
  if ('error' in sortOrder) errors.sortOrder = sortOrder.error;
  if ('value' in label && 'value' in phone && 'value' in sortOrder) {
    return {
      contact: { label: label.value, phone: phone.value, active: values.active, sortOrder: sortOrder.value },
      errors,
    };
  }
  return { contact: null, errors };
}

/** `null` id = adding a new contact. */
type Editing = { id: string | null; values: ContactValues; submitted: boolean };

function SupportContactsCard() {
  const { admin } = useAuth();
  const [contacts, setContacts] = useState<SupportContact[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<SupportContact | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      setContacts(await loadSupportContacts());
    } catch {
      setLoadError('Could not load support contacts. Check your connection and reload the page.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const parsed = useMemo(() => (editing ? parseContact(editing.values) : null), [editing]);

  function startEditing(contact: SupportContact | null) {
    setMessage(null);
    setActionError(null);
    setEditing({ id: contact?.id ?? null, values: contact ? toContactValues(contact) : EMPTY_CONTACT, submitted: false });
  }

  function setField<K extends keyof ContactValues>(field: K, value: ContactValues[K]) {
    setEditing((prev) => (prev ? { ...prev, values: { ...prev.values, [field]: value } } : prev));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!editing || !admin) return;
    setEditing({ ...editing, submitted: true });
    if (!parsed?.contact) return;
    setBusy(true);
    setActionError(null);
    try {
      await saveSupportContact(editing.id, parsed.contact, admin.uid);
      setMessage(editing.id ? 'Contact updated.' : 'Contact added.');
      setEditing(null);
      await reload();
    } catch {
      setActionError('Could not save the contact. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteSupportContact(deleting.id);
      setMessage(`Deleted "${deleting.label}".`);
      if (editing?.id === deleting.id) setEditing(null);
      setDeleting(null);
      await reload();
    } catch {
      setActionError('Could not delete the contact. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const activeCount = contacts?.filter((c) => c.active).length ?? 0;
  const errors = editing?.submitted ? (parsed?.errors ?? {}) : {};

  return (
    <div className="card">
      <div className="card-header">
        <h2>Support contacts</h2>
        <button type="button" className="btn-primary" onClick={() => startEditing(null)} disabled={busy || !contacts}>
          Add contact
        </button>
      </div>
      <p className="muted">
        Shown on the app's Help &amp; Support screen, lowest order first. Passengers tap a contact to call it. Only
        active contacts are shown.
      </p>

      {message && (
        <div className="alert-success" role="status">
          {message}
        </div>
      )}
      {actionError && !deleting && (
        <div className="alert-error" role="alert">
          {actionError}
        </div>
      )}

      {editing && (
        <form className="contact-form" onSubmit={(e) => void handleSave(e)} noValidate>
          <h3>{editing.id ? 'Edit contact' : 'New contact'}</h3>
          <div className="fare-grid">
            <label className="field" htmlFor="contact-label">
              <span>Label</span>
              <input
                id="contact-label"
                value={editing.values.label}
                onChange={(e) => setField('label', e.target.value)}
                maxLength={LABEL_MAX_LENGTH + 10}
                placeholder="e.g. TriGo Hotline (8 AM–5 PM)"
                aria-invalid={errors.label ? true : undefined}
                disabled={busy}
              />
              <span className="hint">
                {errors.label ? (
                  <span className="field-error">{errors.label}</span>
                ) : (
                  `Up to ${LABEL_MAX_LENGTH} characters.`
                )}
              </span>
            </label>
            <label className="field" htmlFor="contact-phone">
              <span>Phone number</span>
              <input
                id="contact-phone"
                type="tel"
                value={editing.values.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="e.g. 0917 123 4567"
                aria-invalid={errors.phone ? true : undefined}
                disabled={busy}
              />
              <span className="hint">
                {errors.phone ? <span className="field-error">{errors.phone}</span> : 'Mobile or landline.'}
              </span>
            </label>
            <label className="field" htmlFor="contact-order">
              <span>Order</span>
              <input
                id="contact-order"
                inputMode="numeric"
                value={editing.values.sortOrder}
                onChange={(e) => setField('sortOrder', e.target.value)}
                aria-invalid={errors.sortOrder ? true : undefined}
                disabled={busy}
              />
              <span className="hint">
                {errors.sortOrder ? (
                  <span className="field-error">{errors.sortOrder}</span>
                ) : (
                  `${SORT_ORDER_RANGE.min}–${SORT_ORDER_RANGE.max}, lowest first.`
                )}
              </span>
            </label>
            <label className="field" htmlFor="contact-active">
              <span>Shown in the app</span>
              <span className="switch">
                <input
                  id="contact-active"
                  type="checkbox"
                  role="switch"
                  checked={editing.values.active}
                  onChange={(e) => setField('active', e.target.checked)}
                  disabled={busy}
                />
                <span className="switch-track" aria-hidden="true" />
              </span>
              <span className="hint">{editing.values.active ? 'Active' : 'Hidden'}</span>
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-outline" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editing.id ? 'Save contact' : 'Add contact'}
            </button>
          </div>
        </form>
      )}

      {loadError ? (
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      ) : !contacts ? (
        <p className="muted">Loading support contacts…</p>
      ) : contacts.length === 0 ? (
        <p className="muted">No support contacts yet. The app's Help screen says support contacts are not available.</p>
      ) : (
        <>
          <p className="muted small">
            {contacts.length} contact{contacts.length === 1 ? '' : 's'}, {activeCount} shown in the app.
          </p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Label</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>{contact.sortOrder}</td>
                    <td className="cell-strong">{contact.label}</td>
                    <td className="mono">{contact.phone}</td>
                    <td>
                      <span className={`status-badge ${contact.active ? 'status-approved' : 'status-rejected'}`}>
                        {contact.active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="cell-action">
                      <div className="button-row">
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => startEditing(contact)}
                          disabled={busy}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => {
                            setMessage(null);
                            setActionError(null);
                            setDeleting(contact);
                          }}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this contact?"
          confirmLabel="Delete contact"
          busyLabel="Deleting…"
          danger
          busy={busy}
          onConfirm={() => void handleDelete()}
          onCancel={() => {
            setDeleting(null);
            setActionError(null);
          }}
        >
          <p>
            <strong>{deleting.label}</strong> <span className="mono">{deleting.phone}</span>
          </p>
          <p className="muted small">
            It is removed from the app's Help screen. This cannot be undone; to hide it temporarily, edit it and
            turn off "Shown in the app" instead.
          </p>
          {actionError && (
            <div className="alert-error" role="alert">
              {actionError}
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
