import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { LoadingBlock } from '../components/LoadingBlock';
import {
  ChangedFieldHint,
  LastUpdated,
  ReviewChangesDialog,
  SaveBar,
  SettingsHeader,
  SettingsSection,
  Toast,
} from '../components/settings/SettingsParts';
import { useUnsavedChanges } from '../components/settings/UnsavedChanges';
import { useSaveFlow } from '../components/settings/useSaveFlow';
import { parseAmount, VEHICLE_LABELS } from '../fares/fareSettings';
import { amountInputValue, formatPeso } from '../lib/format';
import { diffFields, NOT_SET_TEXT, switchField, type SettingField } from '../settings/settingsDiff';
import { BARANGAYS, type BarangayId } from '../tariffs/barangays';
import {
  loadTariffs,
  saveTariffs,
  StaleTariffsError,
  tariffsEqual,
  type BarangayTariff,
  type LoadedTariffs,
  type SavedTariffs,
  type TariffChange,
} from '../tariffs/barangayTariffs';

type Vehicle = 'tricycle' | 'motorcycle';
type RowValues = { tricycle: string; motorcycle: string; active: boolean };
type FormValues = Record<BarangayId, RowValues>;

const VEHICLES: Vehicle[] = ['tricycle', 'motorcycle'];

const EFFECT_NOTE =
  'Applies to bookings made after saving; confirmed bookings keep their fare. Only active tariffs are charged.';

const isStale = (error: unknown) => error instanceof StaleTariffsError;

function cellId(id: BarangayId, field: Vehicle | 'active'): string {
  return `tariff-${id}-${field}`;
}

function toFormValues(saved: SavedTariffs): FormValues {
  const values = {} as FormValues;
  for (const { id } of BARANGAYS) {
    const tariff = saved[id];
    values[id] = tariff
      ? {
          tricycle: amountInputValue(tariff.tricycle),
          motorcycle: amountInputValue(tariff.motorcycle),
          active: tariff.active,
        }
      : { tricycle: '', motorcycle: '', active: false };
  }
  return values;
}

/** A never-saved barangay left blank and inactive: nothing to save, it uses the per-km fare. */
function isUnset(row: RowValues, saved: BarangayTariff | null): boolean {
  return !saved && !row.tricycle.trim() && !row.motorcycle.trim() && !row.active;
}

/** The fields of every barangay that is saved or being filled in, in table order. */
function toFields(values: FormValues, saved: SavedTariffs): SettingField[] {
  return BARANGAYS.flatMap(({ id, name }) => {
    const row = values[id];
    const before = saved[id];
    if (isUnset(row, before)) return [];
    const amounts: SettingField[] = VEHICLES.map((vehicle) => ({
      id: cellId(id, vehicle),
      label: `${name} ${vehicle}`,
      text: row[vehicle],
      initialText: before ? amountInputValue(before[vehicle]) : '',
      initial: before ? before[vehicle] : null,
      parsed: parseAmount(row[vehicle], { allowZero: false }),
      format: (value) => formatPeso(value as number),
    }));
    const active = switchField(
      { id: cellId(id, 'active'), label: `${name} status`, initial: before ? before.active : null },
      row.active,
      ['Active', 'Inactive'],
    );
    return [...amounts, active];
  });
}

/** Rows to write: every barangay whose complete, valid row differs from what is saved. */
function toChanges(values: FormValues, saved: SavedTariffs): TariffChange[] {
  const changes: TariffChange[] = [];
  for (const { id, name } of BARANGAYS) {
    const row = values[id];
    if (isUnset(row, saved[id])) continue;
    const tricycle = parseAmount(row.tricycle, { allowZero: false });
    const motorcycle = parseAmount(row.motorcycle, { allowZero: false });
    if (!('value' in tricycle) || !('value' in motorcycle)) continue;
    const after = { tricycle: tricycle.value, motorcycle: motorcycle.value, active: row.active };
    if (!tariffsEqual(after, saved[id])) changes.push({ id, name, before: saved[id], after });
  }
  return changes;
}

function matchesSearch(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || name.toLowerCase().includes(q);
}

export function BarangayTariffsPage() {
  const { admin } = useAuth();
  const [loaded, setLoaded] = useState<LoadedTariffs | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const flow = useSaveFlow({
    successMessage: 'Barangay tariffs saved.',
    failMessage: 'Could not save barangay tariffs. Check your connection and try again.',
    isStale,
  });

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await loadTariffs();
      setLoaded(result);
      setValues(toFormValues(result.saved));
    } catch {
      setLoadError('Could not load barangay tariffs. Check your connection and reload the page.');
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
  useUnsavedChanges('tariffs', 'Barangay tariffs', changeCount, discard);

  if (loadError) {
    return (
      <div className="stack page-narrow">
        <SettingsHeader title="Barangay tariffs" helper="Fixed fare per trip between Poblacion and each barangay." />
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      </div>
    );
  }

  if (!loaded || !values) {
    return (
      <div className="card">
        <LoadingBlock label="Loading barangay tariffs…" lines={4} />
      </div>
    );
  }

  const { saved } = loaded;
  const canReview = diff.errors.length === 0 && changeCount > 0;
  const changed = new Set(diff.changedIds);
  const errorById = new Map(diff.errors.map((e) => [e.id, e.message]));
  const visible = BARANGAYS.filter(({ name }) => matchesSearch(name, search));
  const activeCount = BARANGAYS.filter(({ id }) => saved[id]?.active).length;
  const anySaved = BARANGAYS.some(({ id }) => saved[id]);

  function updateRow(id: BarangayId, patch: Partial<RowValues>) {
    flow.clearSaveError();
    setValues((prev) => (prev ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
  }

  function normalizeCell(id: BarangayId, vehicle: Vehicle) {
    const result = parseAmount(values![id][vehicle], { allowZero: false });
    if ('value' in result) updateRow(id, { [vehicle]: amountInputValue(result.value) });
  }

  /** The invalid cell may be filtered out by the search: clear it first, then focus. */
  function fixError(id: string) {
    setSearch('');
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canReview) flow.openReview();
  }

  async function handleSave() {
    if (!admin || !loaded || !canReview) return;
    const changes = toChanges(values!, loaded.saved);
    if (changes.length === 0) return;
    await flow.save(() => saveTariffs(changes, admin.uid), reload);
  }

  return (
    <form className="stack page-narrow settings-page" onSubmit={handleSubmit} noValidate>
      <SettingsHeader
        title="Barangay tariffs"
        helper="Fixed fare per trip between Poblacion and each barangay, per vehicle type."
        meta={
          anySaved ? (
            <LastUpdated updatedAt={loaded.updatedAt} updatedBy={loaded.updatedBy} />
          ) : (
            'No tariffs saved yet — every trip uses the per-km fare.'
          )
        }
      />

      <p className="settings-info">
        An active tariff is charged for trips between Poblacion and that barangay, in either direction. Blank or
        inactive barangays use the <Link to="/settings/fares">per-km fare</Link>.
      </p>

      <SettingsSection>
        <div className="tariff-toolbar">
          <label className="tariff-search" htmlFor="tariff-search">
            <span className="visually-hidden">Search barangay</span>
            <input
              id="tariff-search"
              type="search"
              placeholder="Search barangay"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <span className="muted small" aria-live="polite">
            {activeCount} of {BARANGAYS.length} barangays have an active tariff
          </span>
        </div>

        <div className="table-scroll">
          <table className="tariff-edit-table">
            <thead>
              <tr>
                <th scope="col">Barangay</th>
                {VEHICLES.map((vehicle) => (
                  <th key={vehicle} scope="col">
                    {VEHICLE_LABELS[vehicle]}
                  </th>
                ))}
                <th scope="col">Active</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No barangay matches “{search.trim()}”.
                  </td>
                </tr>
              )}
              {visible.map(({ id, name }) => {
                const row = values[id];
                const before = saved[id];
                const activeId = cellId(id, 'active');
                return (
                  <tr key={id}>
                    <th scope="row">{name}</th>
                    {VEHICLES.map((vehicle) => {
                      const inputId = cellId(id, vehicle);
                      const error = errorById.get(inputId);
                      const isChanged = changed.has(inputId);
                      return (
                        <td key={vehicle} className={isChanged ? 'is-changed' : undefined}>
                          <div className={`input-affix input-affix-compact${error ? ' is-invalid' : ''}`}>
                            {/* No ₱ in front of the "Uses per-km fare" placeholder. */}
                            {(before || row[vehicle]) && (
                              <span className="affix" aria-hidden="true">
                                ₱
                              </span>
                            )}
                            <input
                              id={inputId}
                              inputMode="decimal"
                              value={row[vehicle]}
                              placeholder={before ? undefined : 'Uses per-km fare'}
                              onChange={(e) => updateRow(id, { [vehicle]: e.target.value })}
                              onBlur={() => normalizeCell(id, vehicle)}
                              aria-label={`${name} ${VEHICLE_LABELS[vehicle].toLowerCase()} tariff`}
                              aria-invalid={error ? true : undefined}
                              aria-describedby={`${inputId}-note`}
                              disabled={flow.saving}
                            />
                          </div>
                          <span className="cell-note" id={`${inputId}-note`}>
                            {error ? (
                              <span className="field-error">{error}</span>
                            ) : isChanged ? (
                              <ChangedFieldHint was={before ? formatPeso(before[vehicle]) : NOT_SET_TEXT.toLowerCase()} />
                            ) : null}
                          </span>
                        </td>
                      );
                    })}
                    <td className={changed.has(activeId) ? 'is-changed' : undefined}>
                      <label className="switch switch-cell">
                        <input
                          id={activeId}
                          type="checkbox"
                          role="switch"
                          checked={row.active}
                          onChange={(e) => updateRow(id, { active: e.target.checked })}
                          aria-label={`${name} tariff active`}
                          disabled={flow.saving}
                        />
                        <span className="switch-track" aria-hidden="true" />
                      </label>
                      <span className="cell-note">
                        {changed.has(activeId) && before && (
                          <ChangedFieldHint was={before.active ? 'active' : 'inactive'} />
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      <SaveBar
        changeCount={changeCount}
        errors={diff.errors}
        busy={flow.saving}
        onDiscard={discard}
        onFix={fixError}
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
