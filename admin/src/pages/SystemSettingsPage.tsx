import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { LoadingBlock } from '../components/LoadingBlock';
import { CardLockNote, CardLockProvider, useCardLock } from '../components/settings/CardLock';
import {
  LastUpdated,
  NOT_SAVED_YET_TEXT,
  ReviewChangesDialog,
  SaveBar,
  SettingsField,
  SettingsHeader,
  SettingsSection,
  SettingsSwitch,
  Toast,
} from '../components/settings/SettingsParts';
import { useUnsavedChanges } from '../components/settings/UnsavedChanges';
import { useSaveFlow } from '../components/settings/useSaveFlow';
import {
  BOOKING_EXPIRY_RANGE,
  loadBookingSettings,
  saveBookingSettings,
  StaleBookingSettingsError,
  type LoadedBookingSettings,
} from '../settings/bookingSettings';
import {
  EXPIRY_RANGE,
  loadOutOfArea,
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
  savePaymentSettings,
  StalePaymentSettingsError,
  type LoadedPaymentSettings,
  type PaymentSettings,
} from '../settings/paymentSettings';
import { diffFields, NOT_SET_TEXT, switchField, type ChangeRow, type SettingField } from '../settings/settingsDiff';
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

// System tab: four independent cards, each saved to its own place with its own save bar and
// review. Only one card can be edited at a time (CardLock).

export function SystemSettingsPage() {
  return (
    <CardLockProvider>
      <div className="stack page-narrow settings-page">
        <SettingsHeader
          title="System"
          helper="Booking requests, out-of-area trips, TriGo's GCash account and support contacts. Each card saves on its own."
        />
        <BookingSettingsCard />
        <OutOfAreaSettingsCard />
        <PaymentAccountCard />
        <SupportContactsCard />
      </div>
    </CardLockProvider>
  );
}

function minutes(value: number): string {
  return `${value} min`;
}

function LoadErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <SettingsSection title={title}>
      <div className="alert-error" role="alert">
        {message}
      </div>
    </SettingsSection>
  );
}

// ─── Booking requests ──────────────────────────────────────────────────────

const BOOKING_LABEL = 'Booking requests';
const BOOKING_EXPIRY_ID = 'booking-expiry';
const isStaleBooking = (error: unknown) => error instanceof StaleBookingSettingsError;

function BookingSettingsCard() {
  const { admin } = useAuth();
  const [loaded, setLoaded] = useState<LoadedBookingSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(null);
  const flow = useSaveFlow({
    successMessage: 'Booking settings saved.',
    failMessage: 'Could not save booking settings. Check your connection and try again.',
    isStale: isStaleBooking,
  });

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await loadBookingSettings();
      setLoaded(result);
      setValue(String(result.settings.requestExpiryMinutes));
    } catch {
      setLoadError('Could not load booking settings. Check your connection and reload the page.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const notSavedYet = loaded !== null && loaded.saved === null;
  const diff = useMemo(() => {
    if (!loaded || value === null) return { changedIds: [], errors: [], rows: [] };
    const initial = loaded.settings.requestExpiryMinutes;
    return diffFields(
      [
        {
          id: BOOKING_EXPIRY_ID,
          label: 'Booking request expiry',
          text: value,
          initialText: String(initial),
          initial,
          parsed: parseWholeNumber(value, BOOKING_EXPIRY_RANGE, 'minutes'),
          format: (v) => minutes(v as number),
        },
      ],
      { notSavedYet },
    );
  }, [loaded, value, notSavedYet]);
  const changeCount = diff.changedIds.length;

  const { clearSaveError } = flow;
  const discard = useCallback(() => {
    if (loaded) setValue(String(loaded.settings.requestExpiryMinutes));
    clearSaveError();
  }, [loaded, clearSaveError]);
  useUnsavedChanges('system-booking', BOOKING_LABEL, changeCount, discard);
  const lockedBy = useCardLock('booking', BOOKING_LABEL, changeCount > 0);

  if (loadError) return <LoadErrorCard title={BOOKING_LABEL} message={loadError} />;
  if (!loaded || value === null) {
    return (
      <div className="card">
        <LoadingBlock label="Loading booking settings…" lines={2} />
      </div>
    );
  }

  const parsed = parseWholeNumber(value, BOOKING_EXPIRY_RANGE, 'minutes');
  const canReview = 'value' in parsed && (changeCount > 0 || notSavedYet);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canReview && !lockedBy) flow.openReview();
  }

  async function handleSave() {
    if (!admin || !loaded || !('value' in parsed)) return;
    const settings = { requestExpiryMinutes: parsed.value };
    await flow.save(() => saveBookingSettings(settings, loaded.saved, admin.uid), reload);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <SettingsSection
        title={BOOKING_LABEL}
        meta={notSavedYet ? `${NOT_SAVED_YET_TEXT}.` : <LastUpdated updatedAt={loaded.updatedAt} updatedBy={loaded.updatedBy} />}
        description="Standard bookings inside Trinidad. A booking no driver accepts in time expires; the passenger can try again or cancel."
      >
        <CardLockNote lockedBy={lockedBy} />
        <fieldset className="settings-fieldset" disabled={lockedBy !== null || flow.saving}>
          <div className="settings-grid-3">
            <SettingsField
              id={BOOKING_EXPIRY_ID}
              label="Request expiry"
              value={value}
              onChange={(next) => {
                flow.clearSaveError();
                setValue(next);
              }}
              inputMode="numeric"
              suffix="min"
              changed={changeCount > 0}
              was={minutes(loaded.settings.requestExpiryMinutes)}
              error={'error' in parsed ? parsed.error : undefined}
              hint={`How long drivers see a booking. ${BOOKING_EXPIRY_RANGE.min}–${BOOKING_EXPIRY_RANGE.max} minutes.`}
            />
          </div>
          <SaveBar
            changeCount={changeCount}
            notSavedYet={notSavedYet}
            errors={diff.errors}
            busy={flow.saving}
            onDiscard={discard}
          />
        </fieldset>
      </SettingsSection>

      {flow.reviewing && (
        <ReviewChangesDialog
          rows={diff.rows}
          effectNote="The app picks up the change the next time it loads its settings. Bookings already sent keep their expiry."
          saving={flow.saving}
          error={flow.saveError}
          onBack={flow.closeReview}
          onSave={() => void handleSave()}
        />
      )}
      {flow.toast && <Toast message={flow.toast} onDone={flow.hideToast} />}
    </form>
  );
}

// ─── Out-of-area trips ─────────────────────────────────────────────────────

const OUT_OF_AREA_LABEL = 'Out-of-area trips';
const isStaleOutOfArea = (error: unknown) => error instanceof StaleOutOfAreaError;

type OutOfAreaValues = { enabled: boolean; requestExpiryMinutes: string; driverSearchRadiusKm: string };

function toOutOfAreaValues(settings: OutOfAreaSettings): OutOfAreaValues {
  return {
    enabled: settings.enabled,
    requestExpiryMinutes: String(settings.requestExpiryMinutes),
    driverSearchRadiusKm: String(settings.driverSearchRadiusKm),
  };
}

function outOfAreaFields(values: OutOfAreaValues, initial: OutOfAreaSettings): SettingField[] {
  return [
    switchField({ id: 'out-of-area-enabled', label: 'Out-of-area requests', initial: initial.enabled }, values.enabled, [
      'Accepted',
      'Turned off',
    ]),
    {
      id: 'out-of-area-expiry',
      label: 'Request expiry',
      text: values.requestExpiryMinutes,
      initialText: String(initial.requestExpiryMinutes),
      initial: initial.requestExpiryMinutes,
      parsed: parseWholeNumber(values.requestExpiryMinutes, EXPIRY_RANGE, 'minutes'),
      format: (v) => minutes(v as number),
    },
    {
      id: 'out-of-area-radius',
      label: 'Driver search radius',
      text: values.driverSearchRadiusKm,
      initialText: String(initial.driverSearchRadiusKm),
      initial: initial.driverSearchRadiusKm,
      parsed: parseWholeNumber(values.driverSearchRadiusKm, RADIUS_RANGE, 'km'),
      format: (v) => `${v} km`,
    },
  ];
}

function OutOfAreaSettingsCard() {
  const { admin } = useAuth();
  const [loaded, setLoaded] = useState<LoadedOutOfArea | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<OutOfAreaValues | null>(null);
  const flow = useSaveFlow({
    successMessage: 'Out-of-area settings saved.',
    failMessage: 'Could not save out-of-area settings. Check your connection and try again.',
    isStale: isStaleOutOfArea,
  });

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

  const notSavedYet = loaded !== null && loaded.saved === null;
  const fields = useMemo(() => (loaded && values ? outOfAreaFields(values, loaded.settings) : []), [loaded, values]);
  const diff = useMemo(() => diffFields(fields, { notSavedYet }), [fields, notSavedYet]);
  const changeCount = diff.changedIds.length;

  const { clearSaveError } = flow;
  const discard = useCallback(() => {
    if (loaded) setValues(toOutOfAreaValues(loaded.settings));
    clearSaveError();
  }, [loaded, clearSaveError]);
  useUnsavedChanges('system-out-of-area', OUT_OF_AREA_LABEL, changeCount, discard);
  const lockedBy = useCardLock('out-of-area', OUT_OF_AREA_LABEL, changeCount > 0);

  if (loadError) return <LoadErrorCard title={OUT_OF_AREA_LABEL} message={loadError} />;
  if (!loaded || !values) {
    return (
      <div className="card">
        <LoadingBlock label="Loading out-of-area settings…" lines={4} />
      </div>
    );
  }

  const current = loaded.settings;
  const changed = new Set(diff.changedIds);
  const errorById = new Map(diff.errors.map((e) => [e.id, e.message]));
  const canReview = diff.errors.length === 0 && (changeCount > 0 || notSavedYet);

  function setField<K extends keyof OutOfAreaValues>(field: K, value: OutOfAreaValues[K]) {
    flow.clearSaveError();
    setValues((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canReview && !lockedBy) flow.openReview();
  }

  async function handleSave() {
    if (!admin || !loaded || !values || !canReview) return;
    const settings: OutOfAreaSettings = {
      enabled: values.enabled,
      requestExpiryMinutes: Number(values.requestExpiryMinutes.trim()),
      driverSearchRadiusKm: Number(values.driverSearchRadiusKm.trim()),
    };
    await flow.save(() => saveOutOfArea(settings, loaded.saved, admin.uid), reload);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <SettingsSection
        title={OUT_OF_AREA_LABEL}
        meta={notSavedYet ? `${NOT_SAVED_YET_TEXT}.` : <LastUpdated updatedAt={loaded.updatedAt} updatedBy={loaded.updatedBy} />}
        description="Trips with a pickup or destination outside Trinidad. The fare is the per-km fare from the Fares tab."
      >
        <CardLockNote lockedBy={lockedBy} />
        <fieldset className="settings-fieldset" disabled={lockedBy !== null || flow.saving}>
          <SettingsSwitch
            id="out-of-area-enabled"
            label="Accept out-of-area requests"
            checked={values.enabled}
            onChange={(checked) => setField('enabled', checked)}
            changed={changed.has('out-of-area-enabled')}
            was={current.enabled ? 'on' : 'off'}
            hint={
              values.enabled
                ? 'Passengers can send out-of-area requests.'
                : 'Passengers see "Out-of-area requests are not available at this time."'
            }
          />
          <div className="settings-grid-3">
            <SettingsField
              id="out-of-area-expiry"
              label="Request expiry"
              value={values.requestExpiryMinutes}
              onChange={(text) => setField('requestExpiryMinutes', text)}
              inputMode="numeric"
              suffix="min"
              changed={changed.has('out-of-area-expiry')}
              was={minutes(current.requestExpiryMinutes)}
              error={errorById.get('out-of-area-expiry')}
              hint={`How long drivers see a request. ${EXPIRY_RANGE.min}–${EXPIRY_RANGE.max} minutes.`}
            />
            <SettingsField
              id="out-of-area-radius"
              label="Driver search radius"
              value={values.driverSearchRadiusKm}
              onChange={(text) => setField('driverSearchRadiusKm', text)}
              inputMode="numeric"
              suffix="km"
              changed={changed.has('out-of-area-radius')}
              was={`${current.driverSearchRadiusKm} km`}
              error={errorById.get('out-of-area-radius')}
              hint={`Drivers this close to the pickup see it. ${RADIUS_RANGE.min}–${RADIUS_RANGE.max} km.`}
            />
          </div>
          <SaveBar
            changeCount={changeCount}
            notSavedYet={notSavedYet}
            errors={diff.errors}
            busy={flow.saving}
            onDiscard={discard}
          />
        </fieldset>
      </SettingsSection>

      {flow.reviewing && (
        <ReviewChangesDialog
          rows={diff.rows}
          effectNote="The app picks up changes the next time it loads its settings. Requests already sent keep their expiry."
          saving={flow.saving}
          error={flow.saveError}
          onBack={flow.closeReview}
          onSave={() => void handleSave()}
        />
      )}
      {flow.toast && <Toast message={flow.toast} onDone={flow.hideToast} />}
    </form>
  );
}

// ─── TriGo GCash account ───────────────────────────────────────────────────

const PAYMENT_LABEL = 'TriGo GCash account';
const isStalePayment = (error: unknown) => error instanceof StalePaymentSettingsError;

type PaymentValues = { gcashName: string; gcashNumber: string };

function toPaymentValues(saved: PaymentSettings | null): PaymentValues {
  return {
    gcashName: saved?.gcashName ?? '',
    gcashNumber: saved ? formatGcashNumber(saved.gcashNumber) : '',
  };
}

function paymentFields(values: PaymentValues, saved: PaymentSettings | null): SettingField[] {
  const initial = toPaymentValues(saved);
  return [
    {
      id: 'gcash-name',
      label: 'Account name',
      text: values.gcashName,
      initialText: initial.gcashName,
      initial: saved ? saved.gcashName : null,
      parsed: parseGcashName(values.gcashName),
      format: (v) => String(v),
    },
    {
      id: 'gcash-number',
      label: 'GCash number',
      text: values.gcashNumber,
      initialText: initial.gcashNumber,
      initial: saved ? saved.gcashNumber : null,
      parsed: parseGcashNumber(values.gcashNumber),
      format: (v) => formatGcashNumber(String(v)),
    },
  ];
}

function PaymentAccountCard() {
  const { admin } = useAuth();
  const [loaded, setLoaded] = useState<LoadedPaymentSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<PaymentValues>(() => toPaymentValues(null));
  const flow = useSaveFlow({
    successMessage: 'GCash account saved.',
    failMessage: 'Could not save the GCash account. Check your connection and try again.',
    isStale: isStalePayment,
  });

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await loadPaymentSettings();
      setLoaded(result);
      setValues(toPaymentValues(result.saved));
    } catch {
      setLoadError('Could not load the GCash account. Check your connection and reload the page.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const fields = useMemo(() => (loaded ? paymentFields(values, loaded.saved) : []), [loaded, values]);
  const diff = useMemo(() => diffFields(fields), [fields]);
  const changeCount = diff.changedIds.length;

  const { clearSaveError } = flow;
  const discard = useCallback(() => {
    if (loaded) setValues(toPaymentValues(loaded.saved));
    clearSaveError();
  }, [loaded, clearSaveError]);
  useUnsavedChanges('system-payment', PAYMENT_LABEL, changeCount, discard);
  const lockedBy = useCardLock('payment', PAYMENT_LABEL, changeCount > 0);

  if (loadError) return <LoadErrorCard title={PAYMENT_LABEL} message={loadError} />;
  if (!loaded) {
    return (
      <div className="card">
        <LoadingBlock label="Loading the GCash account…" lines={4} />
      </div>
    );
  }

  const saved = loaded.saved;
  const changed = new Set(diff.changedIds);
  // With nothing saved yet, hold back "Required." until the admin starts typing.
  const showErrors = saved !== null || changeCount > 0;
  const errorById = new Map(diff.errors.map((e) => [e.id, e.message]));
  const canReview = diff.errors.length === 0 && changeCount > 0;

  function setField(field: keyof PaymentValues, text: string) {
    flow.clearSaveError();
    setValues((prev) => ({ ...prev, [field]: text }));
  }

  /** "09171234567" → "0917 123 4567" once the admin leaves the field. */
  function normalizeNumber() {
    const result = parseGcashNumber(values.gcashNumber);
    if ('value' in result) setField('gcashNumber', formatGcashNumber(result.value));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canReview && !lockedBy) flow.openReview();
  }

  async function handleSave() {
    if (!admin || !loaded || !canReview) return;
    const name = parseGcashName(values.gcashName);
    const number = parseGcashNumber(values.gcashNumber);
    if (!('value' in name) || !('value' in number)) return;
    const settings = { gcashName: name.value, gcashNumber: number.value };
    await flow.save(() => savePaymentSettings(settings, loaded.saved, admin.uid), reload);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <SettingsSection
        title={PAYMENT_LABEL}
        meta={
          saved ? (
            <LastUpdated updatedAt={loaded.updatedAt} updatedBy={loaded.updatedBy} />
          ) : (
            'Not saved yet — drivers have no payment instructions.'
          )
        }
        description="Drivers pay commission to this account; you check each payment in GCash. Only admins and drivers see it."
      >
        <CardLockNote lockedBy={lockedBy} />
        <fieldset className="settings-fieldset" disabled={lockedBy !== null || flow.saving}>
          <div className="settings-grid-2">
            <SettingsField
              id="gcash-name"
              label="Account name"
              value={values.gcashName}
              onChange={(text) => setField('gcashName', text)}
              inputMode="text"
              maxLength={GCASH_NAME_MAX_LENGTH + 10}
              changed={changed.has('gcash-name')}
              was={saved ? saved.gcashName : 'not set'}
              error={showErrors ? errorById.get('gcash-name') : undefined}
              hint={`The name GCash shows when sending. At most ${GCASH_NAME_MAX_LENGTH} characters.`}
            />
            <SettingsField
              id="gcash-number"
              label="GCash number"
              value={values.gcashNumber}
              onChange={(text) => setField('gcashNumber', text)}
              onBlur={normalizeNumber}
              type="tel"
              inputMode="tel"
              changed={changed.has('gcash-number')}
              was={saved ? formatGcashNumber(saved.gcashNumber) : 'not set'}
              error={showErrors ? errorById.get('gcash-number') : undefined}
              hint="Mobile number of the account, e.g. 0917 123 4567."
            />
          </div>
          <SaveBar changeCount={changeCount} errors={diff.errors} busy={flow.saving} onDiscard={discard} />
        </fieldset>
      </SettingsSection>

      {flow.reviewing && (
        <ReviewChangesDialog
          rows={diff.rows}
          effectNote="Drivers see the new account the next time they open their payment instructions."
          saving={flow.saving}
          error={flow.saveError}
          onBack={flow.closeReview}
          onSave={() => void handleSave()}
        />
      )}
      {flow.toast && <Toast message={flow.toast} onDone={flow.hideToast} />}
    </form>
  );
}

// ─── Support contacts ──────────────────────────────────────────────────────

const CONTACTS_LABEL = 'Support contacts';

type ContactValues = { label: string; phone: string; active: boolean; sortOrder: string };

const NEW_CONTACT: SupportContactInput = { label: '', phone: '', active: true, sortOrder: 1 };

function toContactValues(contact: SupportContactInput): ContactValues {
  return { label: contact.label, phone: contact.phone, active: contact.active, sortOrder: String(contact.sortOrder) };
}

/**
 * The form's fields. A new contact starts from NEW_CONTACT: its empty label and phone have no
 * initial value, while order 1 and "shown" only count as changes when edited.
 */
function contactFields(values: ContactValues, start: SupportContactInput, isNew: boolean): SettingField[] {
  return [
    {
      id: 'contact-label',
      label: 'Label',
      text: values.label,
      initialText: start.label,
      initial: isNew ? null : start.label,
      parsed: parseLabel(values.label),
      format: (v) => String(v),
    },
    {
      id: 'contact-phone',
      label: 'Phone number',
      text: values.phone,
      initialText: start.phone,
      initial: isNew ? null : start.phone,
      parsed: parsePhone(values.phone),
      format: (v) => String(v),
    },
    {
      id: 'contact-order',
      label: 'Order',
      text: values.sortOrder,
      initialText: String(start.sortOrder),
      initial: start.sortOrder,
      parsed: parseSortOrder(values.sortOrder),
      format: (v) => String(v),
    },
    switchField({ id: 'contact-active', label: 'Shown in the app', initial: start.active }, values.active, [
      'Shown',
      'Hidden',
    ]),
  ];
}

/** `null` id = adding a new contact. */
type Editing = { id: string | null; start: SupportContactInput; values: ContactValues };

function SupportContactsCard() {
  const { admin } = useAuth();
  const [contacts, setContacts] = useState<SupportContact[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<SupportContact | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletedToast, setDeletedToast] = useState<string | null>(null);
  const flow = useSaveFlow({
    successMessage: 'Contact saved.',
    failMessage: 'Could not save the contact. Check your connection and try again.',
    isStale: () => false,
  });

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

  const isNew = editing !== null && editing.id === null;
  const fields = useMemo(
    () => (editing ? contactFields(editing.values, editing.start, editing.id === null) : []),
    [editing],
  );
  const diff = useMemo(() => diffFields(fields), [fields]);
  const changeCount = diff.changedIds.length;

  const { clearSaveError } = flow;
  const closeForm = useCallback(() => {
    setEditing(null);
    clearSaveError();
  }, [clearSaveError]);
  useUnsavedChanges('system-contacts', CONTACTS_LABEL, changeCount, closeForm);
  // An open form holds the lock even before anything is typed.
  const lockedBy = useCardLock('contacts', CONTACTS_LABEL, editing !== null);
  const hideDeletedToast = useCallback(() => setDeletedToast(null), []);

  function startEditing(contact: SupportContact | null) {
    flow.clearSaveError();
    const start = contact
      ? { label: contact.label, phone: contact.phone, active: contact.active, sortOrder: contact.sortOrder }
      : NEW_CONTACT;
    setEditing({ id: contact?.id ?? null, start, values: toContactValues(start) });
  }

  function setField<K extends keyof ContactValues>(field: K, value: ContactValues[K]) {
    flow.clearSaveError();
    setEditing((prev) => (prev ? { ...prev, values: { ...prev.values, [field]: value } } : prev));
  }

  const canReview = editing !== null && diff.errors.length === 0 && changeCount > 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canReview) flow.openReview();
  }

  async function handleSave() {
    if (!editing || !admin || !canReview) return;
    const label = parseLabel(editing.values.label);
    const phone = parsePhone(editing.values.phone);
    const sortOrder = parseSortOrder(editing.values.sortOrder);
    if (!('value' in label) || !('value' in phone) || !('value' in sortOrder)) return;
    const contact = { label: label.value, phone: phone.value, active: editing.values.active, sortOrder: sortOrder.value };
    const { id } = editing;
    await flow.save(
      () => saveSupportContact(id, contact, admin.uid),
      async () => {
        setEditing(null);
        await reload();
      },
    );
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteSupportContact(deleting.id);
      setDeletedToast(`Deleted "${deleting.label}".`);
      if (editing?.id === deleting.id) setEditing(null);
      setDeleting(null);
      await reload();
    } catch {
      setDeleteError('Could not delete the contact. Check your connection and try again.');
    } finally {
      setDeleteBusy(false);
    }
  }

  // A new contact lists every value (Old = "Not set"); an edit lists only what changed.
  const reviewRows: ChangeRow[] =
    isNew && editing
      ? fields.flatMap((field) =>
          'value' in field.parsed
            ? [{ id: field.id, label: field.label, oldText: NOT_SET_TEXT, newText: field.format(field.parsed.value), warning: null }]
            : [],
        )
      : diff.rows;
  const changed = new Set(diff.changedIds);
  const errorById = new Map(diff.errors.map((e) => [e.id, e.message]));
  // A new contact's empty fields stay quiet until something is typed.
  const showErrors = !isNew || changeCount > 0;
  const activeCount = contacts?.filter((c) => c.active).length ?? 0;
  const latest = contacts?.reduce<SupportContact | null>(
    (best, c) => (c.updatedAt && (!best?.updatedAt || c.updatedAt > best.updatedAt) ? c : best),
    null,
  );
  const busy = flow.saving || deleteBusy;

  return (
    <SettingsSection
      title={CONTACTS_LABEL}
      meta={latest ? <LastUpdated updatedAt={latest.updatedAt} updatedBy={latest.updatedBy} /> : undefined}
      description="Active contacts appear on the app's Help screen and to drivers, lowest order first."
      actions={
        <button
          type="button"
          className="btn-primary"
          onClick={() => startEditing(null)}
          disabled={busy || !contacts || editing !== null || lockedBy !== null}
        >
          Add contact
        </button>
      }
    >
      <CardLockNote lockedBy={lockedBy} />

      {editing && (
        <form className="contact-form" onSubmit={handleSubmit} noValidate>
          <div className="contact-form-head">
            <h4>{isNew ? 'New contact' : 'Edit contact'}</h4>
            <button type="button" className="btn-link" onClick={closeForm} disabled={busy}>
              Cancel
            </button>
          </div>
          <fieldset className="settings-fieldset" disabled={busy}>
            <div className="settings-grid-2">
              <SettingsField
                id="contact-label"
                label="Label"
                value={editing.values.label}
                onChange={(text) => setField('label', text)}
                inputMode="text"
                maxLength={LABEL_MAX_LENGTH + 10}
                placeholder="e.g. TriGo Hotline (8 AM–5 PM)"
                changed={!isNew && changed.has('contact-label')}
                was={editing.start.label}
                error={showErrors ? errorById.get('contact-label') : undefined}
                hint={`Up to ${LABEL_MAX_LENGTH} characters.`}
              />
              <SettingsField
                id="contact-phone"
                label="Phone number"
                value={editing.values.phone}
                onChange={(text) => setField('phone', text)}
                type="tel"
                inputMode="tel"
                placeholder="e.g. 0917 123 4567"
                changed={!isNew && changed.has('contact-phone')}
                was={editing.start.phone}
                error={showErrors ? errorById.get('contact-phone') : undefined}
                hint="Mobile or landline."
              />
              <SettingsField
                id="contact-order"
                label="Order"
                value={editing.values.sortOrder}
                onChange={(text) => setField('sortOrder', text)}
                inputMode="numeric"
                changed={!isNew && changed.has('contact-order')}
                was={String(editing.start.sortOrder)}
                error={errorById.get('contact-order')}
                hint={`${SORT_ORDER_RANGE.min}–${SORT_ORDER_RANGE.max}, lowest first.`}
              />
              <SettingsSwitch
                id="contact-active"
                label="Shown in the app"
                checked={editing.values.active}
                onChange={(checked) => setField('active', checked)}
                changed={!isNew && changed.has('contact-active')}
                was={editing.start.active ? 'shown' : 'hidden'}
                hint={editing.values.active ? 'Shown' : 'Hidden'}
              />
            </div>
            <SaveBar
              changeCount={changeCount}
              errors={showErrors ? diff.errors : []}
              busy={flow.saving}
              onDiscard={closeForm}
            />
          </fieldset>
        </form>
      )}

      {loadError ? (
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      ) : !contacts ? (
        <LoadingBlock label="Loading support contacts…" />
      ) : contacts.length === 0 ? (
        <EmptyState>No support contacts yet.</EmptyState>
      ) : (
        <>
          <p className="muted small">
            {contacts.length} contact{contacts.length === 1 ? '' : 's'}, {activeCount} shown in the app.
          </p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" className="num">
                    Order
                  </th>
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
                  <tr key={contact.id} className={editing?.id === contact.id ? 'row-editing' : undefined}>
                    <td className="num">{contact.sortOrder}</td>
                    <td className="cell-strong">{contact.label}</td>
                    <td className="mono">{contact.phone}</td>
                    <td>
                      <span className={`status-badge ${contact.active ? 'status-approved' : 'status-rejected'}`}>
                        {contact.active ? 'Shown' : 'Hidden'}
                      </span>
                    </td>
                    <td className="cell-action">
                      <div className="button-row">
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => startEditing(contact)}
                          disabled={busy || editing !== null || lockedBy !== null}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(contact);
                          }}
                          disabled={busy || editing !== null || lockedBy !== null}
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

      {flow.reviewing && editing && (
        <ReviewChangesDialog
          rows={reviewRows}
          effectNote="Shown contacts appear in the app the next time the Help screen or driver profile loads them."
          saving={flow.saving}
          error={flow.saveError}
          onBack={flow.closeReview}
          onSave={() => void handleSave()}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this contact?"
          confirmLabel="Delete contact"
          busyLabel="Deleting…"
          danger
          busy={deleteBusy}
          onConfirm={() => void handleDelete()}
          onCancel={() => {
            setDeleting(null);
            setDeleteError(null);
          }}
        >
          <p>
            <strong>{deleting.label}</strong> <span className="mono">{deleting.phone}</span>
          </p>
          <p className="muted small">
            This can&apos;t be undone. To hide it, edit it and turn off &quot;Shown in the app&quot; instead.
          </p>
          {deleteError && (
            <div className="alert-error" role="alert">
              {deleteError}
            </div>
          )}
        </ConfirmDialog>
      )}

      {flow.toast && <Toast message={flow.toast} onDone={flow.hideToast} />}
      {deletedToast && <Toast message={deletedToast} onDone={hideDeletedToast} />}
    </SettingsSection>
  );
}
