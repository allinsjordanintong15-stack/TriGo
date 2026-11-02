import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { VEHICLE_TYPE_LABELS } from '../bookings/bookings';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingBlock } from '../components/LoadingBlock';
import { Notice } from '../components/Notice';
import { PageHeader } from '../components/PageHeader';
import { formatCount, lastUpdated, plural } from '../lib/format';
import {
  buildQuotaRows,
  DAILY_LIMIT_RANGE,
  DEFAULT_DAILY_LIMIT,
  manilaDay,
  parseDailyLimit,
  type QuotaRow,
} from '../quota/quota';
import {
  saveDailyLimit,
  StaleQuotaError,
  subscribeToDrivers,
  subscribeToQuota,
  type LoadedQuota,
} from '../quota/quotaSettings';

/** How often the Manila day is re-checked, so the counts reset at 12:00 AM. */
const DAY_CHECK_MS = 60 * 1000;

function limitLabel(quota: LoadedQuota): string {
  return quota.saved === null ? `${quota.limit} (default)` : String(quota.limit);
}

function vehicleLabel(type: string): string {
  return type in VEHICLE_TYPE_LABELS ? VEHICLE_TYPE_LABELS[type as keyof typeof VEHICLE_TYPE_LABELS] : '';
}

export function QuotaPage() {
  const { admin } = useAuth();
  const [quota, setQuota] = useState<LoadedQuota | null>(null);
  const [quotaError, setQuotaError] = useState(false);
  const [drivers, setDrivers] = useState<{ uid: string; data: Record<string, unknown> }[] | null>(null);
  const [driversError, setDriversError] = useState(false);
  const [today, setToday] = useState(() => manilaDay(Date.now()));
  // null until the admin types; the field then shows their text, else the live limit.
  const [input, setInput] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(
    () =>
      subscribeToQuota(
        (loaded) => {
          setQuota(loaded);
          setQuotaError(false);
        },
        () => setQuotaError(true),
      ),
    [],
  );

  useEffect(
    () =>
      subscribeToDrivers(
        (loaded) => {
          setDrivers(loaded);
          setDriversError(false);
        },
        () => setDriversError(true),
      ),
    [],
  );

  useEffect(() => {
    const timer = setInterval(() => setToday(manilaDay(Date.now())), DAY_CHECK_MS);
    return () => clearInterval(timer);
  }, []);

  const rows: QuotaRow[] | null = useMemo(
    () => (drivers && quota ? buildQuotaRows(drivers, quota.limit, today) : null),
    [drivers, quota, today],
  );

  if (quotaError) {
    return (
      <div className="stack page-narrow">
        <PageHeader title="Quota" />
        <div className="alert-error" role="alert">
          Could not load the daily limit. Check your connection and reload the page.
        </div>
      </div>
    );
  }

  if (!quota) {
    return (
      <div className="card">
        <LoadingBlock label="Loading the daily limit…" lines={3} />
      </div>
    );
  }

  const text = input ?? String(quota.limit);
  const parsed = parseDailyLimit(text);
  const newLimit = 'value' in parsed ? parsed.value : null;
  const hasChanges = newLimit !== null && (quota.saved === null || newLimit !== quota.saved);
  const atLimit = rows ? rows.filter((row) => row.reached).length : 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (hasChanges) {
      setSaveError(null);
      setConfirming(true);
    }
  }

  async function handleConfirm() {
    if (newLimit === null || !admin || !quota) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveDailyLimit(newLimit, quota.saved, admin.uid);
      setConfirming(false);
      setSavedMessage(true);
      setInput(null);
    } catch (error) {
      setSaveError(
        error instanceof StaleQuotaError
          ? error.message
          : 'Could not save the daily limit. Check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title="Quota"
        subtitle="How many passengers each driver may accept per day. Counts reset at 12:00 AM (Manila time)."
      />
      <Notice>
        The limit applies to every driver separately and takes effect at once. A driver at the limit can still
        finish their current trip; a passenger who cancels before the trip starts gives the slot back.
      </Notice>

      <form className="card page-narrow" onSubmit={handleSubmit} noValidate>
        <p className="muted small">
          {quota.saved === null
            ? `No limit has been saved yet, so drivers use the default of ${DEFAULT_DAILY_LIMIT}.`
            : lastUpdated(quota.updatedAt)}
        </p>
        <label className="field" htmlFor="daily-limit">
          <span>Daily limit (passengers per driver)</span>
          <input
            id="daily-limit"
            inputMode="numeric"
            value={text}
            onChange={(event) => {
              setSavedMessage(false);
              setSaveError(null);
              setInput(event.target.value);
            }}
            aria-invalid={'error' in parsed ? true : undefined}
            disabled={saving}
          />
          <span className="hint">
            {'error' in parsed ? (
              <span className="field-error">{parsed.error}</span>
            ) : (
              `A whole number from ${DAILY_LIMIT_RANGE.min} to ${DAILY_LIMIT_RANGE.max}. Current: ${limitLabel(quota)}`
            )}
          </span>
        </label>

        {savedMessage && (
          <div className="alert-success" role="status">
            Daily limit saved. Drivers see it right away.
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setSavedMessage(false);
              setInput(null);
            }}
            disabled={saving || input === null}
          >
            Reset
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !hasChanges}>
            Save changes…
          </button>
        </div>
      </form>

      <div className="card">
        <h3>Today</h3>
        {driversError ? (
          <div className="alert-error" role="alert">
            Could not load drivers. Check your connection and reload the page.
          </div>
        ) : !rows ? (
          <LoadingBlock label="Loading drivers…" lines={4} />
        ) : rows.length === 0 ? (
          <p className="muted">No verified drivers yet.</p>
        ) : (
          <>
            <p className="muted small" aria-live="polite">
              {formatCount(atLimit)} of {plural(rows.length, 'verified driver')} at the limit of {quota.limit}.
            </p>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Vehicle</th>
                    <th scope="col">Accepted today</th>
                    <th scope="col">Slots left</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.uid}>
                      <td className="cell-strong">{row.fullName || '(no name)'}</td>
                      <td>
                        <div className="mono">{row.vehiclePlate || '—'}</div>
                        <div className="muted small">{vehicleLabel(row.vehicleType)}</div>
                      </td>
                      <td>
                        {formatCount(row.acceptedToday)} of {formatCount(quota.limit)}
                      </td>
                      <td>
                        {row.reached ? (
                          <span className="status-badge status-rejected">At limit</span>
                        ) : (
                          formatCount(row.remaining)
                        )}
                      </td>
                      <td className="cell-action">
                        <Link className="btn-link" to={`/driver-accounts/${encodeURIComponent(row.uid)}`}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {confirming && newLimit !== null && (
        <ConfirmDialog
          title="Save the daily limit?"
          confirmLabel="Save limit"
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
              <tr className="changed">
                <td>Daily limit</td>
                <td>{limitLabel(quota)}</td>
                <td aria-hidden="true">→</td>
                <td>{newLimit}</td>
              </tr>
            </tbody>
          </table>
          <p className="muted small">It applies to every driver at once, including today's counts.</p>
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
