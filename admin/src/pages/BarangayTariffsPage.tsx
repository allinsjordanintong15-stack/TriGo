import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingBlock } from '../components/LoadingBlock';
import { Notice } from '../components/Notice';
import { PageHeader } from '../components/PageHeader';
import { parseAmount } from '../fares/fareSettings';
import { amountInputValue, formatPeso } from '../lib/format';
import { BARANGAYS, type BarangayId } from '../tariffs/barangays';
import {
  loadTariffs,
  saveTariffs,
  StaleTariffsError,
  tariffsEqual,
  type BarangayTariff,
  type SavedTariffs,
  type TariffChange,
} from '../tariffs/barangayTariffs';

type RowValues = { tricycle: string; motorcycle: string; active: boolean };
type FormValues = Record<BarangayId, RowValues>;
type RowErrors = Partial<Record<'tricycle' | 'motorcycle', string>>;

type ParsedRow =
  /** Never saved and left blank: nothing to save for this barangay yet. */
  | { kind: 'unset' }
  | { kind: 'invalid'; errors: RowErrors }
  | { kind: 'valid'; tariff: BarangayTariff };

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

function parseRow(row: RowValues, saved: BarangayTariff | null): ParsedRow {
  if (!saved && !row.tricycle.trim() && !row.motorcycle.trim() && !row.active) {
    return { kind: 'unset' };
  }
  const tricycle = parseAmount(row.tricycle, { allowZero: false });
  const motorcycle = parseAmount(row.motorcycle, { allowZero: false });
  if ('error' in tricycle || 'error' in motorcycle) {
    return {
      kind: 'invalid',
      errors: {
        tricycle: 'error' in tricycle ? tricycle.error : undefined,
        motorcycle: 'error' in motorcycle ? motorcycle.error : undefined,
      },
    };
  }
  return { kind: 'valid', tariff: { tricycle: tricycle.value, motorcycle: motorcycle.value, active: row.active } };
}

function formatOptionalPeso(tariff: BarangayTariff | null, field: 'tricycle' | 'motorcycle'): string {
  return tariff ? formatPeso(tariff[field]) : 'Not set';
}

function formatActive(tariff: BarangayTariff | null): string {
  if (!tariff) return 'Not set';
  return tariff.active ? 'Active' : 'Inactive';
}

export function BarangayTariffsPage() {
  const { admin } = useAuth();
  const [saved, setSaved] = useState<SavedTariffs | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await loadTariffs();
      setSaved(result);
      setValues(toFormValues(result));
    } catch {
      setLoadError('Could not load barangay tariffs. Check your connection and reload the page.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const parsed = useMemo(() => {
    if (!values || !saved) return null;
    const rows = {} as Record<BarangayId, ParsedRow>;
    for (const { id } of BARANGAYS) {
      rows[id] = parseRow(values[id], saved[id]);
    }
    return rows;
  }, [values, saved]);

  const { changes, hasErrors } = useMemo(() => {
    const result: TariffChange[] = [];
    let errors = false;
    if (parsed && saved) {
      for (const { id, name } of BARANGAYS) {
        const row = parsed[id];
        if (row.kind === 'invalid') errors = true;
        if (row.kind === 'valid' && !tariffsEqual(row.tariff, saved[id])) {
          result.push({ id, name, before: saved[id], after: row.tariff });
        }
      }
    }
    return { changes: result, hasErrors: errors };
  }, [parsed, saved]);

  if (loadError) {
    return (
      <div className="stack">
        <PageHeader title="Barangay tariffs" />
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      </div>
    );
  }

  if (!saved || !values || !parsed) {
    return (
      <div className="card">
        <LoadingBlock label="Loading barangay tariffs…" lines={4} />
      </div>
    );
  }

  const savedCount = BARANGAYS.filter(({ id }) => saved[id]).length;

  function updateRow(id: BarangayId, patch: Partial<RowValues>) {
    setSavedMessage(false);
    setSaveError(null);
    setValues((prev) => (prev ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!hasErrors && changes.length > 0) {
      setSaveError(null);
      setConfirming(true);
    }
  }

  async function handleConfirm() {
    if (!admin || changes.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveTariffs(changes, admin.uid);
      setConfirming(false);
      setSavedMessage(true);
      await reload();
    } catch (error) {
      setSaveError(
        error instanceof StaleTariffsError
          ? error.message
          : 'Could not save barangay tariffs. Check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title="Barangay tariffs"
        subtitle="Fixed fare between Poblacion and each barangay, per vehicle. Blank or inactive barangays use the per-km fare."
      />
      <Notice>Tariffs are saved but not yet applied in the app.</Notice>

      <div className="card">
        <p className="muted small">
          {savedCount} of {BARANGAYS.length} barangays saved. A barangay left blank is not saved; to set one,
          enter both tariffs.
        </p>
      </div>

      <form className="card" onSubmit={handleSubmit} noValidate>
        <div className="table-scroll">
          <table className="tariff-table">
            <thead>
              <tr>
                <th scope="col">Barangay</th>
                <th scope="col">Tricycle (₱)</th>
                <th scope="col">Motorcycle (₱)</th>
                <th scope="col">Active</th>
              </tr>
            </thead>
            <tbody>
              {BARANGAYS.map(({ id, name }) => {
                const row = values[id];
                const result = parsed[id];
                const errors = result.kind === 'invalid' ? result.errors : {};
                const changed = result.kind === 'valid' && !tariffsEqual(result.tariff, saved[id]);
                return (
                  <tr key={id} className={changed ? 'row-changed' : undefined}>
                    <th scope="row">
                      {name}
                      {!saved[id] && <span className="tag">Not set</span>}
                    </th>
                    {(['tricycle', 'motorcycle'] as const).map((field) => (
                      <td key={field}>
                        <input
                          className="cell-input"
                          inputMode="decimal"
                          value={row[field]}
                          onChange={(e) => updateRow(id, { [field]: e.target.value })}
                          aria-label={`${name} ${field} tariff`}
                          aria-invalid={errors[field] ? true : undefined}
                          disabled={saving}
                        />
                        {errors[field] && <div className="field-error cell-error">{errors[field]}</div>}
                      </td>
                    ))}
                    <td>
                      <label className="switch">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={row.active}
                          onChange={(e) => updateRow(id, { active: e.target.checked })}
                          aria-label={`${name} tariff active`}
                          disabled={saving}
                        />
                        <span className="switch-track" aria-hidden="true" />
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {savedMessage && (
          <div className="alert-success" role="status">
            Barangay tariffs saved.
          </div>
        )}

        <div className="form-actions">
          <span className="muted small form-actions-note">
            {hasErrors
              ? 'Fix the highlighted fields to save.'
              : changes.length > 0
                ? `${changes.length} barangay${changes.length === 1 ? '' : 's'} changed.`
                : 'No changes.'}
          </span>
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setSavedMessage(false);
              setValues(toFormValues(saved));
            }}
            disabled={saving || (changes.length === 0 && !hasErrors)}
          >
            Reset
          </button>
          <button type="submit" className="btn-primary" disabled={saving || hasErrors || changes.length === 0}>
            Save changes…
          </button>
        </div>
      </form>

      {confirming && (
        <ConfirmDialog
          title="Save barangay tariffs?"
          confirmLabel="Save tariffs"
          busy={saving}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setConfirming(false)}
        >
          <div className="table-scroll">
            <table className="change-table">
              <thead>
                <tr>
                  <th>Barangay</th>
                  <th>Tricycle</th>
                  <th>Motorcycle</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {changes.map(({ id, name, before, after }) => (
                  <tr key={id} className="changed">
                    <td>{name}</td>
                    <td>
                      <ChangeCell from={formatOptionalPeso(before, 'tricycle')} to={formatPeso(after.tricycle)} />
                    </td>
                    <td>
                      <ChangeCell from={formatOptionalPeso(before, 'motorcycle')} to={formatPeso(after.motorcycle)} />
                    </td>
                    <td>
                      <ChangeCell from={formatActive(before)} to={formatActive(after)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

function ChangeCell({ from, to }: { from: string; to: string }) {
  if (from === to) {
    return <span className="unchanged-value">{to}</span>;
  }
  return (
    <span>
      <span className="old-value">{from}</span> → <span className="new-value">{to}</span>
    </span>
  );
}
