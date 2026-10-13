import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { useAuth } from '../auth/AuthContext';
import {
  calculateCommission,
  commissionEqual,
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
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatPeso, parseAmount } from '../fares/fareSettings';

type Field = keyof CommissionSettings;
type FormValues = Record<Field, string>;
type FormErrors = Partial<Record<Field, string>>;

const DEFAULT_EXAMPLE_FARE = '80';

const FIELDS: { field: Field; label: string; hint: string }[] = [
  { field: 'percentage', label: 'Commission (%)', hint: 'Percentage of the final fare, more than 0 and up to 100.' },
  {
    field: 'paymentPeriodDays',
    label: 'Payment period (days)',
    hint: `Commission for the period is due at its end. ${PAYMENT_PERIOD_RANGE.min}–${PAYMENT_PERIOD_RANGE.max} days.`,
  },
  {
    field: 'gracePeriodDays',
    label: 'Grace period (days)',
    hint: `Days after the due date before an unpaid driver is suspended. ${GRACE_PERIOD_RANGE.min}–${GRACE_PERIOD_RANGE.max} days.`,
  },
];

function toFormValues(settings: CommissionSettings | null): FormValues {
  return {
    percentage: settings ? String(settings.percentage) : '',
    paymentPeriodDays: settings ? String(settings.paymentPeriodDays) : '',
    gracePeriodDays: settings ? String(settings.gracePeriodDays) : '',
  };
}

function parseForm(values: FormValues): { settings: CommissionSettings | null; errors: FormErrors } {
  const percentage = parsePercentage(values.percentage);
  const payment = parseDays(values.paymentPeriodDays, PAYMENT_PERIOD_RANGE);
  const grace = parseDays(values.gracePeriodDays, GRACE_PERIOD_RANGE);
  const errors: FormErrors = {};
  if ('error' in percentage) errors.percentage = percentage.error;
  if ('error' in payment) errors.paymentPeriodDays = payment.error;
  if ('error' in grace) errors.gracePeriodDays = grace.error;
  if ('value' in percentage && 'value' in payment && 'value' in grace) {
    return {
      settings: { percentage: percentage.value, paymentPeriodDays: payment.value, gracePeriodDays: grace.value },
      errors,
    };
  }
  return { settings: null, errors };
}

function formatValue(field: Field, settings: CommissionSettings | null): string {
  if (!settings) return 'Not set';
  const value = settings[field];
  if (field === 'percentage') return `${value}%`;
  return `${value} day${value === 1 ? '' : 's'}`;
}

function fieldLabel(field: Field): string {
  return FIELDS.find((f) => f.field === field)!.label;
}

export function CommissionPage() {
  const { admin } = useAuth();
  const [loaded, setLoaded] = useState<LoadedCommission | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [exampleFare, setExampleFare] = useState(DEFAULT_EXAMPLE_FARE);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

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

  const { settings: parsed, errors } = useMemo(
    () => (values ? parseForm(values) : { settings: null, errors: {} as FormErrors }),
    [values],
  );

  const exampleAmount = useMemo(() => {
    const result = parseAmount(exampleFare, { allowZero: false });
    return 'value' in result ? result.value : null;
  }, [exampleFare]);

  if (loadError) {
    return (
      <div className="card">
        <h2>Commission</h2>
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      </div>
    );
  }

  if (!loaded || !values) {
    return <div className="card muted">Loading commission settings…</div>;
  }

  const current = loaded.saved;
  const hasChanges = parsed !== null && !commissionEqual(parsed, current);
  // With nothing saved yet, hold back "Required." errors until the admin starts typing.
  const touched = current !== null || Object.values(values).some((v) => v.trim() !== '');
  const initialValues = toFormValues(current);
  const isPristine = FIELDS.every(({ field }) => values[field] === initialValues[field]);

  function setField(field: Field, text: string) {
    setSavedMessage(false);
    setSaveError(null);
    setValues((prev) => (prev ? { ...prev, [field]: text } : prev));
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
      await saveCommission(parsed, loaded.saved, admin.uid);
      setConfirming(false);
      setSavedMessage(true);
      await reload();
    } catch (error) {
      setSaveError(
        error instanceof StaleCommissionError
          ? error.message
          : 'Could not save commission settings. Check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  const examplePercentage = parsed?.percentage ?? null;

  return (
    <div className="stack">
      <div className="alert-warning" role="note">
        Stored only — commission is not charged to drivers yet.
      </div>

      <div className="card">
        <h2>Commission</h2>
        <p className="muted">
          TriGo's commission is a percentage of the final fare of every completed trip, standard and out-of-area.
          Drivers pay the total for each payment period at its end.
        </p>
        <div className="formula">Commission = final fare × percentage ÷ 100</div>
        <p className="muted small">
          {current
            ? `Last updated ${loaded.updatedAt ? loaded.updatedAt.toLocaleString() : 'at an unknown time'}.`
            : 'No commission settings are saved yet.'}
        </p>
      </div>

      <form className="card" onSubmit={handleSubmit} noValidate>
        <div className="fare-grid">
          {FIELDS.map(({ field, label, hint }) => {
            const error = touched ? errors[field] : undefined;
            const id = `commission-${field}`;
            return (
              <label key={field} className="field" htmlFor={id}>
                <span>{label}</span>
                <input
                  id={id}
                  inputMode={field === 'percentage' ? 'decimal' : 'numeric'}
                  value={values[field]}
                  onChange={(e) => setField(field, e.target.value)}
                  aria-invalid={error ? true : undefined}
                  disabled={saving}
                />
                <span className="hint">
                  {error ? <span className="field-error">{error}</span> : `${hint} Current: ${formatValue(field, current)}`}
                </span>
              </label>
            );
          })}
        </div>

        <div className="example">
          <label className="field example-distance" htmlFor="example-fare">
            <span>Example fare (₱)</span>
            <input
              id="example-fare"
              inputMode="decimal"
              value={exampleFare}
              onChange={(e) => setExampleFare(e.target.value)}
            />
          </label>
          <p className="example-line">
            {exampleAmount === null ? (
              <span className="muted">Enter a fare with at most 2 decimals to see an example.</span>
            ) : examplePercentage === null ? (
              <span className="muted">Enter a valid percentage to see an example.</span>
            ) : (
              <>
                Fare {formatPeso(exampleAmount)} → commission{' '}
                <strong>{formatPeso(calculateCommission(exampleAmount, examplePercentage))}</strong> at{' '}
                {examplePercentage}%
                {current && current.percentage !== examplePercentage && (
                  <span className="muted">
                    {' '}
                    (now {formatPeso(calculateCommission(exampleAmount, current.percentage))} at {current.percentage}%)
                  </span>
                )}
              </>
            )}
          </p>
        </div>

        {savedMessage && (
          <div className="alert-success" role="status">
            Commission settings saved.
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setSavedMessage(false);
              setValues(initialValues);
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
          title="Save commission settings?"
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
              {FIELDS.map(({ field }) => {
                const changed = !current || current[field] !== parsed[field];
                return (
                  <tr key={field} className={changed ? 'changed' : 'unchanged'}>
                    <td>{fieldLabel(field)}</td>
                    <td>{formatValue(field, current)}</td>
                    <td aria-hidden="true">→</td>
                    <td>{formatValue(field, parsed)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">Stored only — commission is not charged to drivers yet.</p>
          {saveError && (
            <div className="alert-error" role="alert">
              {saveError}
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
