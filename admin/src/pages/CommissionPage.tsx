import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { useAuth } from '../auth/AuthContext';
import { commissionExample } from '../commission/commissionExample';
import {
  GRACE_PERIOD_RANGE,
  loadCommission,
  parseDays,
  parsePercentage,
  PAYMENT_PERIOD_RANGE,
  saveCommission,
  StaleCommissionError,
  type CommissionSettings,
  type LoadedCommission,
} from '../commission/commissionSettings';
import { LoadingBlock } from '../components/LoadingBlock';
import {
  LastUpdated,
  ReviewChangesDialog,
  SaveBar,
  SettingsField,
  SettingsHeader,
  SettingsSection,
  Toast,
} from '../components/settings/SettingsParts';
import { useUnsavedChanges } from '../components/settings/UnsavedChanges';
import { useSaveFlow } from '../components/settings/useSaveFlow';
import { formatPeso } from '../lib/format';
import { diffFields, type SettingField } from '../settings/settingsDiff';

type Field = keyof CommissionSettings;
type FormValues = Record<Field, string>;

const FIELDS: { field: Field; label: string; reviewLabel: string; suffix: string; hint: string }[] = [
  {
    field: 'percentage',
    label: 'Commission',
    reviewLabel: 'Commission percentage',
    suffix: '%',
    hint: 'Of the final fare. More than 0, up to 100.',
  },
  {
    field: 'paymentPeriodDays',
    label: 'Payment period',
    reviewLabel: 'Payment period',
    suffix: 'days',
    hint: `The period's total is due at its end. ${PAYMENT_PERIOD_RANGE.min}–${PAYMENT_PERIOD_RANGE.max} days.`,
  },
  {
    field: 'gracePeriodDays',
    label: 'Grace period',
    reviewLabel: 'Grace period',
    suffix: 'days',
    hint: `Days after the due date before an unpaid driver is suspended. ${GRACE_PERIOD_RANGE.min}–${GRACE_PERIOD_RANGE.max} days.`,
  },
];

const EFFECT_NOTE =
  'The percentage applies to trips completed after saving. Payment and grace periods apply from the next payment period; periods already open keep their dates.';

const isStale = (error: unknown) => error instanceof StaleCommissionError;

function fieldId(field: Field): string {
  return `commission-${field}`;
}

function formatValue(field: Field, value: number): string {
  if (field === 'percentage') return `${value}%`;
  return `${value} day${value === 1 ? '' : 's'}`;
}

function toFormValues(settings: CommissionSettings | null): FormValues {
  return {
    percentage: settings ? String(settings.percentage) : '',
    paymentPeriodDays: settings ? String(settings.paymentPeriodDays) : '',
    gracePeriodDays: settings ? String(settings.gracePeriodDays) : '',
  };
}

function parseField(field: Field, text: string) {
  if (field === 'percentage') return parsePercentage(text);
  return parseDays(text, field === 'paymentPeriodDays' ? PAYMENT_PERIOD_RANGE : GRACE_PERIOD_RANGE);
}

function toFields(values: FormValues, saved: CommissionSettings | null): SettingField[] {
  const initialValues = toFormValues(saved);
  return FIELDS.map(({ field, reviewLabel }) => ({
    id: fieldId(field),
    label: reviewLabel,
    text: values[field],
    initialText: initialValues[field],
    initial: saved ? saved[field] : null,
    parsed: parseField(field, values[field]),
    format: (value) => formatValue(field, value as number),
  }));
}

/** The settings typed in, or null while any field is invalid. */
function draftSettings(fields: SettingField[]): CommissionSettings | null {
  const result = {} as CommissionSettings;
  for (const [i, { field }] of FIELDS.entries()) {
    const parsed = fields[i].parsed;
    if (!('value' in parsed)) return null;
    result[field] = parsed.value as number;
  }
  return result;
}

export function CommissionPage() {
  const { admin } = useAuth();
  const [loaded, setLoaded] = useState<LoadedCommission | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const flow = useSaveFlow({
    successMessage: 'Commission settings saved.',
    failMessage: 'Could not save commission settings. Check your connection and try again.',
    isStale,
  });

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await loadCommission();
      setLoaded(result);
      setValues(toFormValues(result.saved));
    } catch {
      setLoadError('Could not load commission settings. Check your connection and reload the page.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const fields = useMemo(() => (values && loaded ? toFields(values, loaded.saved) : []), [values, loaded]);
  const diff = useMemo(() => diffFields(fields), [fields]);
  const changeCount = diff.changedIds.length;

  const { clearSaveError } = flow;
  const discard = useCallback(() => {
    if (loaded) setValues(toFormValues(loaded.saved));
    clearSaveError();
  }, [loaded, clearSaveError]);
  useUnsavedChanges('commission', 'Commission', changeCount, discard);

  if (loadError) {
    return (
      <div className="stack page-narrow">
        <SettingsHeader title="Commission" helper="What drivers pay TriGo on each completed trip, and when." />
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      </div>
    );
  }

  if (!loaded || !values) {
    return (
      <div className="card">
        <LoadingBlock label="Loading commission settings…" lines={4} />
      </div>
    );
  }

  const saved = loaded.saved;
  const draft = draftSettings(fields);
  const canReview = diff.errors.length === 0 && changeCount > 0 && draft !== null;
  // With nothing saved yet, hold back "Required." until the admin starts typing.
  const showErrors = saved !== null || changeCount > 0;
  const changed = new Set(diff.changedIds);
  const errorById = new Map(diff.errors.map((e) => [e.id, e.message]));

  function setField(field: Field, text: string) {
    flow.clearSaveError();
    setValues((prev) => (prev ? { ...prev, [field]: text } : prev));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canReview) flow.openReview();
  }

  async function handleSave() {
    if (!admin || !loaded || !canReview || !draft) return;
    await flow.save(() => saveCommission(draft, loaded.saved, admin.uid), reload);
  }

  return (
    <form className="stack page-narrow settings-page" onSubmit={handleSubmit} noValidate>
      <SettingsHeader
        title="Commission"
        helper="What drivers pay TriGo on each completed trip, and when."
        meta={
          saved ? (
            <LastUpdated updatedAt={loaded.updatedAt} updatedBy={loaded.updatedBy} />
          ) : (
            'Not saved yet — no commission is charged until you save.'
          )
        }
      />

      <p className="settings-info">
        Commission = final fare × percentage, to the centavo. Drivers who still owe after the grace period can&apos;t
        accept new trips until paid.
      </p>

      <SettingsSection>
        <div className="settings-grid-3">
          {FIELDS.map(({ field, label, suffix, hint }) => {
            const id = fieldId(field);
            return (
              <SettingsField
                key={field}
                id={id}
                label={label}
                value={values[field]}
                onChange={(text) => setField(field, text)}
                inputMode={field === 'percentage' ? 'decimal' : 'numeric'}
                suffix={suffix}
                changed={changed.has(id)}
                was={saved ? formatValue(field, saved[field]) : 'not set'}
                error={showErrors ? errorById.get(id) : undefined}
                hint={hint}
                disabled={flow.saving}
              />
            );
          })}
        </div>

        <div className="settings-example" aria-live="polite">
          <span className="settings-example-label">Example</span>
          {draft ? (
            <>
              <p>{commissionExample(draft, formatPeso)}</p>
              {saved && changeCount > 0 && (
                <p className="muted small">Now: {commissionExample(saved, formatPeso)}</p>
              )}
            </>
          ) : (
            <p className="muted">
              {saved ? 'Fix the highlighted field to see the example.' : 'Enter all three values to see an example.'}
            </p>
          )}
        </div>
      </SettingsSection>

      <SaveBar changeCount={changeCount} errors={showErrors ? diff.errors : []} busy={flow.saving} onDiscard={discard} />

      {flow.reviewing && (
        <ReviewChangesDialog
          rows={diff.rows}
          effectNote={EFFECT_NOTE}
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
