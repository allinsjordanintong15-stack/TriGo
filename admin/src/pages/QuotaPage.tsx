import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { VEHICLE_TYPE_LABELS } from '../bookings/bookings';
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
import { formatCount, plural } from '../lib/format';
import { diffFields } from '../settings/settingsDiff';
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

const LIMIT_ID = 'daily-limit';
const EFFECT_NOTE = "Applies to every driver at once, including today's counts.";

const isStale = (error: unknown) => error instanceof StaleQuotaError;

function formatLimit(limit: number): string {
  return `${limit} booking${limit === 1 ? '' : 's'} per day`;
}

/** "Each driver can accept up to 20 bookings per day; resets at 12:00 AM (Manila time)." */
function quotaPreview(limit: number): string {
  return `Each driver can accept up to ${formatLimit(limit)}; resets at 12:00 AM (Manila time).`;
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
  const flow = useSaveFlow({
    successMessage: 'Daily limit saved. Drivers see it right away.',
    failMessage: 'Could not save the daily limit. Check your connection and try again.',
    isStale,
  });

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

  const diff = useMemo(() => {
    if (!quota) return { changedIds: [], errors: [], rows: [] };
    const text = input ?? String(quota.limit);
    return diffFields(
      [
        {
          id: LIMIT_ID,
          label: 'Daily limit',
          text,
          initialText: String(quota.limit),
          initial: quota.limit,
          parsed: parseDailyLimit(text),
          format: (value) => formatLimit(value as number),
        },
      ],
      { notSavedYet: quota.saved === null },
    );
  }, [quota, input]);
  const changeCount = diff.changedIds.length;

  const { clearSaveError } = flow;
  const discard = useCallback(() => {
    setInput(null);
    clearSaveError();
  }, [clearSaveError]);
  useUnsavedChanges('quota', 'Quota', changeCount, discard);

  if (quotaError) {
    return (
      <div className="stack page-narrow">
        <SettingsHeader title="Quota" helper="How many bookings each driver may accept per day." />
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
  const notSavedYet = quota.saved === null;
  const canReview = newLimit !== null && (changeCount > 0 || notSavedYet);
  const isChanged = changeCount > 0;
  const atLimit = rows ? rows.filter((row) => row.reached).length : 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canReview) flow.openReview();
  }

  async function handleSave() {
    if (newLimit === null || !admin || !quota || !canReview) return;
    const expected = quota.saved;
    // The live subscription brings the new value and "Last updated"; the field follows it again.
    await flow.save(
      () => saveDailyLimit(newLimit, expected, admin.uid),
      () => setInput(null),
    );
  }

  return (
    <form className="stack settings-page" onSubmit={handleSubmit} noValidate>
      <div className="stack page-narrow">
        <SettingsHeader
          title="Quota"
          helper="How many bookings each driver may accept per day."
          meta={
            notSavedYet ? (
              `${NOT_SAVED_YET_TEXT} (${DEFAULT_DAILY_LIMIT}).`
            ) : (
              <LastUpdated updatedAt={quota.updatedAt} updatedBy={quota.updatedBy} />
            )
          }
        />

        <p className="settings-info">
          The limit applies to each driver separately. A driver at the limit can still finish their current trip; a
          passenger who cancels before the trip starts gives the slot back.
        </p>

        <SettingsSection>
          <div className="settings-grid-3">
            <SettingsField
              id={LIMIT_ID}
              label="Daily limit"
              value={text}
              onChange={(next) => {
                flow.clearSaveError();
                setInput(next);
              }}
              inputMode="numeric"
              suffix="per driver"
              changed={isChanged}
              was={String(quota.limit)}
              error={'error' in parsed ? parsed.error : undefined}
              hint={`A whole number from ${DAILY_LIMIT_RANGE.min} to ${DAILY_LIMIT_RANGE.max}.`}
              disabled={flow.saving}
            />
          </div>
          <div className="settings-example" aria-live="polite">
            <span className="settings-example-label">Preview</span>
            <p>{quotaPreview(newLimit ?? quota.limit)}</p>
            {isChanged && newLimit !== null && <p className="muted small">Now: up to {formatLimit(quota.limit)}.</p>}
          </div>
        </SettingsSection>
      </div>

      <SettingsSection title="Today">
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
                        <Link className="btn-link" to={`/drivers/all/${encodeURIComponent(row.uid)}`}>
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
      </SettingsSection>

      <SaveBar
        changeCount={changeCount}
        notSavedYet={notSavedYet}
        notSavedText={`${NOT_SAVED_YET_TEXT} (${DEFAULT_DAILY_LIMIT})`}
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
