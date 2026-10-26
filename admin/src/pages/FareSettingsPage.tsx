import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import {
  calculateFare,
  faresEqual,
  loadFares,
  parseAmount,
  saveFares,
  StaleFaresError,
  VEHICLE_LABELS,
  VEHICLE_TYPES,
  type Fares,
  type LoadedFares,
  type VehicleType,
} from '../fares/fareSettings';
import { amountInputValue, formatPeso, lastUpdated } from '../lib/format';

type FareField = 'baseFare' | 'perKm';
type FormValues = Record<VehicleType, Record<FareField, string>>;
type FormErrors = Partial<Record<`${VehicleType}.${FareField}`, string>>;

const FIELD_LABELS: Record<FareField, string> = {
  baseFare: 'Base fare (₱)',
  perKm: 'Per-km rate (₱/km)',
};

const DEFAULT_EXAMPLE_KM = '5';

function toFormValues(fares: Fares): FormValues {
  const values = {} as FormValues;
  for (const type of VEHICLE_TYPES) {
    values[type] = {
      baseFare: amountInputValue(fares[type].baseFare),
      perKm: amountInputValue(fares[type].perKm),
    };
  }
  return values;
}

/** Parses every field; returns the complete fares object only when all fields are valid. */
function parseForm(values: FormValues): { fares: Fares | null; errors: FormErrors } {
  const errors: FormErrors = {};
  const fares = {} as Fares;
  for (const type of VEHICLE_TYPES) {
    const base = parseAmount(values[type].baseFare, { allowZero: true });
    const perKm = parseAmount(values[type].perKm, { allowZero: false });
    if ('error' in base) errors[`${type}.baseFare`] = base.error;
    if ('error' in perKm) errors[`${type}.perKm`] = perKm.error;
    if ('value' in base && 'value' in perKm) {
      fares[type] = { baseFare: base.value, perKm: perKm.value };
    }
  }
  return { fares: Object.keys(errors).length === 0 ? fares : null, errors };
}

export function FareSettingsPage() {
  const { admin } = useAuth();
  const [loaded, setLoaded] = useState<LoadedFares | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [exampleKm, setExampleKm] = useState(DEFAULT_EXAMPLE_KM);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await loadFares();
      setLoaded(result);
      setValues(toFormValues(result.fares));
    } catch {
      setLoadError('Could not load fare settings. Check your connection and reload the page.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const { fares: parsed, errors } = useMemo(
    () => (values ? parseForm(values) : { fares: null, errors: {} as FormErrors }),
    [values],
  );

  const exampleDistance = useMemo(() => {
    const km = Number(exampleKm);
    return exampleKm.trim() !== '' && Number.isFinite(km) && km >= 0 ? km : null;
  }, [exampleKm]);

  if (loadError) {
    return (
      <div className="stack page-narrow">
        <PageHeader title="Fare settings" />
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      </div>
    );
  }

  if (!loaded || !values) {
    return (
      <div className="card">
        <LoadingBlock label="Loading fare settings…" lines={4} />
      </div>
    );
  }

  const current = loaded.fares;
  const usingDefaults = loaded.saved === null;
  // With nothing saved yet, saving the defaults unchanged is allowed (it creates the document).
  const hasChanges = parsed !== null && (usingDefaults || !faresEqual(parsed, current));

  function setField(type: VehicleType, field: FareField, text: string) {
    setSaved(false);
    setSaveError(null);
    setValues((prev) => (prev ? { ...prev, [type]: { ...prev[type], [field]: text } } : prev));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (parsed && hasChanges) {
      setSaveError(null);
      setConfirming(true);
    }
  }

  async function handleConfirm() {
    if (!parsed || !admin || !loaded) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveFares(parsed, loaded.saved, admin.uid);
      setConfirming(false);
      setSaved(true);
      await reload();
    } catch (error) {
      setSaveError(
        error instanceof StaleFaresError
          ? error.message
          : 'Could not save fare settings. Check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack page-narrow">
      <PageHeader title="Fare settings" subtitle="Per-km fare per vehicle type. Out-of-area trips use the same rates." />

      <div className="card">
        <div className="formula">
          Fare = base fare + (per-km rate × distance in km), rounded to the nearest centavo
        </div>
        <p className="muted formula-note">
          New fares apply to bookings made after saving; bookings already confirmed keep their fare.
        </p>
        <p className="muted small">
          {usingDefaults
            ? 'No fare settings are saved yet, so the app uses its built-in defaults shown below.'
            : lastUpdated(loaded.updatedAt)}
        </p>
      </div>

      <form className="card" onSubmit={handleSubmit} noValidate>
        <div className="fare-grid">
          {VEHICLE_TYPES.map((type) => (
            <fieldset key={type} className="fare-group">
              <legend>{VEHICLE_LABELS[type]}</legend>
              {(['baseFare', 'perKm'] as const).map((field) => {
                const error = errors[`${type}.${field}`];
                const id = `${type}-${field}`;
                return (
                  <label key={field} className="field" htmlFor={id}>
                    <span>{FIELD_LABELS[field]}</span>
                    <input
                      id={id}
                      inputMode="decimal"
                      value={values[type][field]}
                      onChange={(e) => setField(type, field, e.target.value)}
                      aria-invalid={error ? true : undefined}
                      disabled={saving}
                    />
                    <span className="hint">
                      {error ? (
                        <span className="field-error">{error}</span>
                      ) : (
                        `Current: ${formatPeso(current[type][field])}`
                      )}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>

        <div className="example">
          <label className="field example-distance" htmlFor="example-km">
            <span>Example distance (km)</span>
            <input
              id="example-km"
              inputMode="decimal"
              value={exampleKm}
              onChange={(e) => setExampleKm(e.target.value)}
            />
          </label>
          {exampleDistance === null ? (
            <p className="muted small">Enter a distance to see an example fare.</p>
          ) : (
            <ul className="example-list">
              {VEHICLE_TYPES.map((type) => {
                const fare = parsed?.[type];
                return (
                  <li key={type}>
                    <strong>{VEHICLE_LABELS[type]}:</strong>{' '}
                    {fare ? (
                      <>
                        {formatPeso(fare.baseFare)} + {formatPeso(fare.perKm)} × {exampleDistance} km ={' '}
                        <strong>{formatPeso(calculateFare(fare, exampleDistance))}</strong>
                        {!faresEqual(parsed, current) && (
                          <span className="muted">
                            {' '}
                            (now {formatPeso(calculateFare(current[type], exampleDistance))})
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="muted">fix the errors above</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {saved && (
          <div className="alert-success" role="status">
            Fare settings saved.
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setSaved(false);
              setValues(toFormValues(current));
            }}
            disabled={saving || !values || faresEqual(parsed, current)}
          >
            Reset
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !hasChanges}>
            Save changes…
          </button>
        </div>
      </form>

      {confirming && parsed && (
        <ConfirmDialog
          title="Save new fares?"
          confirmLabel="Save fares"
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
              {VEHICLE_TYPES.flatMap((type) =>
                (['baseFare', 'perKm'] as const).map((field) => {
                  const oldValue = current[type][field];
                  const newValue = parsed[type][field];
                  const changed = oldValue !== newValue;
                  return (
                    <tr key={`${type}-${field}`} className={changed ? 'changed' : 'unchanged'}>
                      <td>
                        {VEHICLE_LABELS[type]} {field === 'baseFare' ? 'base fare' : 'per-km rate'}
                      </td>
                      <td>{formatPeso(oldValue)}</td>
                      <td aria-hidden="true">→</td>
                      <td>{formatPeso(newValue)}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
          {usingDefaults && <p className="muted small">Old = built-in default.</p>}
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
