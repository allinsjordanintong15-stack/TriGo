import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { LoadingBlock } from '../components/LoadingBlock';
import {
  LastUpdated,
  NOT_SAVED_YET_TEXT,
  ReviewChangesDialog,
  SaveBar,
  SettingsField,
  SettingsHeader,
  SettingsSection,
  Toast,
} from '../components/settings/SettingsParts';
import { useUnsavedChanges } from '../components/settings/UnsavedChanges';
import { useSaveFlow } from '../components/settings/useSaveFlow';
import { VehicleIcon } from '../components/settings/VehicleIcon';
import { PREVIEW_DISTANCES_KM, previewCell } from '../fares/farePreview';
import {
  loadFares,
  parseAmount,
  saveFares,
  StaleFaresError,
  VEHICLE_LABELS,
  VEHICLE_TYPES,
  type Fares,
  type LoadedFares,
  type VehicleFare,
  type VehicleType,
} from '../fares/fareSettings';
import { amountInputValue, formatPeso } from '../lib/format';
import { diffFields, type SettingField } from '../settings/settingsDiff';

type FareField = 'baseFare' | 'perKm';
type FormValues = Record<VehicleType, Record<FareField, string>>;

const FARE_FIELDS: FareField[] = ['baseFare', 'perKm'];

const FIELD_LABELS: Record<FareField, string> = {
  baseFare: 'Base fare (₱)',
  perKm: 'Per-km rate (₱/km)',
};

/** Label in the review table and error links, e.g. "Tricycle base fare". */
const SETTING_LABELS: Record<FareField, string> = {
  baseFare: 'base fare',
  perKm: 'per-km rate',
};

const EFFECT_NOTE = 'Applies to bookings made after saving; confirmed bookings keep their fare.';

const isStale = (error: unknown) => error instanceof StaleFaresError;

function fieldId(type: VehicleType, field: FareField): string {
  return `fare-${type}-${field}`;
}

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

/** One field per input, in form order (Tricycle base, Tricycle per-km, Motorcycle …). */
function toFields(values: FormValues, initial: Fares): SettingField[] {
  return VEHICLE_TYPES.flatMap((type) =>
    FARE_FIELDS.map((field) => ({
      id: fieldId(type, field),
      label: `${VEHICLE_LABELS[type]} ${SETTING_LABELS[field]}`,
      text: values[type][field],
      initialText: amountInputValue(initial[type][field]),
      initial: initial[type][field],
      parsed: parseAmount(values[type][field], { allowZero: field === 'baseFare' }),
      format: (value) => (field === 'perKm' ? `${formatPeso(value as number)}/km` : formatPeso(value as number)),
    })),
  );
}

/** The edited rates for one vehicle, or null while either is invalid. */
function draftFare(fields: SettingField[], type: VehicleType): VehicleFare | null {
  const base = fields.find((f) => f.id === fieldId(type, 'baseFare'))!.parsed;
  const perKm = fields.find((f) => f.id === fieldId(type, 'perKm'))!.parsed;
  return 'value' in base && 'value' in perKm ? { baseFare: base.value as number, perKm: perKm.value as number } : null;
}

export function FareSettingsPage() {
  const { admin } = useAuth();
  const [loaded, setLoaded] = useState<LoadedFares | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const flow = useSaveFlow({
    successMessage: 'Fare settings saved.',
    failMessage: 'Could not save fare settings. Check your connection and try again.',
    isStale,
  });

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

  const fields = useMemo(() => (values && loaded ? toFields(values, loaded.fares) : []), [values, loaded]);
  const notSavedYet = loaded !== null && loaded.saved === null;
  const diff = useMemo(() => diffFields(fields, { notSavedYet }), [fields, notSavedYet]);
  const changeCount = diff.changedIds.length;

  const { clearSaveError } = flow;
  const discard = useCallback(() => {
    if (loaded) setValues(toFormValues(loaded.fares));
    clearSaveError();
  }, [loaded, clearSaveError]);
  useUnsavedChanges('fares', 'Fares', changeCount, discard);

  if (loadError) {
    return (
      <div className="stack page-narrow">
        <SettingsHeader title="Fares" helper="Base fare and per-km rate for each vehicle type." />
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

  const canReview = diff.errors.length === 0 && (changeCount > 0 || notSavedYet);

  function setField(type: VehicleType, field: FareField, text: string) {
    flow.clearSaveError();
    setValues((prev) => (prev ? { ...prev, [type]: { ...prev[type], [field]: text } } : prev));
  }

  /** Shows a valid amount with 2 decimals once the admin leaves the field ("8" → "8.00"). */
  function normalizeField(type: VehicleType, field: FareField) {
    const result = parseAmount(values![type][field], { allowZero: field === 'baseFare' });
    if ('value' in result) setField(type, field, amountInputValue(result.value));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canReview) flow.openReview();
  }

  async function handleSave() {
    if (!admin || !loaded || !canReview) return;
    const fares = {} as Fares;
    for (const type of VEHICLE_TYPES) {
      const fare = draftFare(fields, type);
      if (!fare) return;
      fares[type] = fare;
    }
    await flow.save(() => saveFares(fares, loaded.saved, admin.uid), reload);
  }

  const changed = new Set(diff.changedIds);
  const errorById = new Map(diff.errors.map((e) => [e.id, e.message]));
  const drafts = Object.fromEntries(VEHICLE_TYPES.map((type) => [type, draftFare(fields, type)])) as Record<
    VehicleType,
    VehicleFare | null
  >;

  return (
    <form className="stack page-narrow settings-page" onSubmit={handleSubmit} noValidate>
      <SettingsHeader
        title="Fares"
        helper="Base fare and per-km rate for each vehicle type."
        meta={notSavedYet ? `${NOT_SAVED_YET_TEXT}.` : <LastUpdated updatedAt={loaded.updatedAt} updatedBy={loaded.updatedBy} />}
      />

      <p className="settings-info">
        Fare = base fare + per-km rate × distance (to the centavo). Used when no barangay tariff applies; out-of-area
        trips use the same rate.
      </p>

      <div className="vehicle-cards">
        {VEHICLE_TYPES.map((type) => (
          <SettingsSection key={type} title={VEHICLE_LABELS[type]} icon={<VehicleIcon type={type} />}>
            <div className="settings-fields">
              {FARE_FIELDS.map((field) => {
                const id = fieldId(type, field);
                return (
                  <SettingsField
                    key={field}
                    id={id}
                    label={FIELD_LABELS[field]}
                    value={values[type][field]}
                    onChange={(text) => setField(type, field, text)}
                    onBlur={() => normalizeField(type, field)}
                    prefix="₱"
                    suffix={field === 'perKm' ? '/km' : undefined}
                    changed={changed.has(id)}
                    was={formatPeso(loaded.fares[type][field])}
                    error={errorById.get(id)}
                    disabled={flow.saving}
                  />
                );
              })}
            </div>
          </SettingsSection>
        ))}
      </div>

      <SettingsSection title="Fare preview">
        <div className="table-scroll">
          <table className="preview-table">
            <thead>
              <tr>
                <th scope="col">Distance</th>
                {VEHICLE_TYPES.map((type) => (
                  <th key={type} scope="col" className="num">
                    {VEHICLE_LABELS[type]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PREVIEW_DISTANCES_KM.map((km) => (
                <tr key={km}>
                  <th scope="row">{km} km</th>
                  {VEHICLE_TYPES.map((type) => {
                    const cell = previewCell(loaded.fares[type], drafts[type], km);
                    return (
                      <td key={type} className="num">
                        {cell.next === null ? (
                          <span className="muted" title="Fix the highlighted field to see this fare">
                            —
                          </span>
                        ) : cell.changed ? (
                          <span className="preview-change">
                            <span className="preview-old">{formatPeso(cell.current)}</span>
                            <span aria-hidden="true"> → </span>
                            <span className="visually-hidden"> becomes </span>
                            <strong>{formatPeso(cell.next)}</strong>
                          </span>
                        ) : (
                          formatPeso(cell.current)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      <p className="settings-link">
        <Link to="/settings/tariffs" className="btn-link">
          Barangay tariffs override this for trips between Poblacion and a barangay →
        </Link>
      </p>

      <SaveBar
        changeCount={changeCount}
        notSavedYet={notSavedYet}
        errors={diff.errors}
        busy={flow.saving}
        onDiscard={discard}
      />

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
