import { useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { SUSPENSION_DURATIONS, type SuspensionDuration } from '../drivers/driverActionPlan';
import { useAdminCounts } from '../lib/adminCounts';
import { formatDateTime } from '../lib/format';
import { WARNING_REASON_MAX_LENGTH, validateWarningReason } from '../warnings/warningPlan';
import {
  addQuickNote,
  offersSuspend,
  OUTCOME_LABELS,
  QUICK_NOTES,
  RESOLVE_NOTE_MAX_LENGTH,
  suspendBlockReason,
  validateResolveNote,
  warnBlockReason,
  type ComplaintOutcome,
} from './complaintResolve';
import { ComplaintConflictError, resolveComplaint, reviewComplaint, type ComplaintDetail } from './complaints';

/**
 * "Resolve": No action / Warn <name> / Suspend driver, a reason the reported person reads
 * (warn, suspend), an admin-only note with quick-fill chips, then one transaction. A resolved
 * complaint shows its outcome, note and who resolved it, with Reopen.
 */
export function ResolvePanel({
  detail,
  warningExists,
  onChanged,
}: {
  detail: ComplaintDetail;
  warningExists: boolean;
  /** After a save: a confirmation line; the caller reloads. */
  onChanged: (message: string) => void;
}) {
  const { admin } = useAuth();
  const { refreshCounts } = useAdminCounts();
  const { complaint, reported } = detail;
  const [outcome, setOutcome] = useState<ComplaintOutcome | null>(null);
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<SuspensionDuration>('3d');
  const [note, setNote] = useState(complaint.adminNotes);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const name = reported?.name || 'them';
  const ctx = { reportedUserId: complaint.reportedUserId, reporterRole: complaint.reporterRole, warningExists };
  const warnBlocked = warnBlockReason(ctx);
  const suspendBlocked = suspendBlockReason(ctx);
  const needsReason = outcome === 'warned' || outcome === 'suspended';
  const reasonError = needsReason ? validateWarningReason(reason) : null;
  const noteError = validateResolveNote(note);

  function fail(error: unknown) {
    const denied = (error as { code?: string }).code === 'permission-denied';
    setSaveError(
      error instanceof ComplaintConflictError
        ? error.message
        : denied
          ? 'The change was refused. Reload and try again.'
          : 'Could not save. Check your connection and try again.',
    );
    setSaving(false);
  }

  async function resolve() {
    setTouched(true);
    if (!admin || !outcome || reasonError || noteError) return;
    setSaving(true);
    setSaveError(null);
    try {
      await resolveComplaint(
        complaint.complaintId,
        admin.uid,
        complaint.status,
        note,
        outcome === 'no_action'
          ? { outcome }
          : outcome === 'warned'
            ? { outcome, reason }
            : { outcome, reason, duration },
      );
      refreshCounts();
      onChanged(
        outcome === 'no_action'
          ? 'Resolved with no action.'
          : outcome === 'warned'
            ? `Resolved. ${name} was warned and will see it in the app.`
            : `Resolved. ${name} is suspended and was notified in the app.`,
      );
    } catch (error) {
      fail(error);
    }
  }

  async function reopen() {
    if (!admin) return;
    setSaving(true);
    setSaveError(null);
    try {
      await reviewComplaint(
        complaint.complaintId,
        admin.uid,
        { status: complaint.status, adminNotes: complaint.adminNotes },
        { status: 'in_review', adminNotes: complaint.adminNotes },
      );
      refreshCounts();
      onChanged('Reopened: back to In review.');
    } catch (error) {
      fail(error);
    }
  }

  if (complaint.status === 'resolved') {
    const by = !complaint.resolvedBy
      ? null
      : complaint.resolvedBy === admin?.uid
        ? 'you'
        : complaint.resolvedBy === complaint.updatedBy
          ? (detail.updatedByName ?? detail.updatedByEmail ?? 'another admin')
          : 'another admin';
    return (
      <section className="resolve-panel" aria-labelledby="resolve-title">
        <h3 id="resolve-title">Resolved</h3>
        <p className="resolve-summary">
          <strong>{complaint.outcome ? OUTCOME_LABELS[complaint.outcome] : 'Resolved'}</strong>
          {complaint.resolvedAt && (
            <span className="muted small">
              {' '}
              · {formatDateTime(complaint.resolvedAt)}
              {by ? ` by ${by}` : ''}
            </span>
          )}
        </p>
        {complaint.adminNotes ? (
          <blockquote className="remarks-quote">{complaint.adminNotes}</blockquote>
        ) : (
          <p className="muted small">No admin note.</p>
        )}
        {saveError && (
          <div className="alert-error" role="alert">
            {saveError}
          </div>
        )}
        <button type="button" className="btn-outline" onClick={() => void reopen()} disabled={saving}>
          {saving ? 'Reopening…' : 'Reopen'}
        </button>
      </section>
    );
  }

  const options: { value: ComplaintOutcome; label: string; blocked: string | null; danger?: boolean }[] = [
    { value: 'no_action', label: 'No action needed', blocked: null },
    { value: 'warned', label: `Warn ${name}`, blocked: warnBlocked },
    ...(offersSuspend(complaint.reporterRole)
      ? [{ value: 'suspended' as const, label: 'Suspend driver', blocked: suspendBlocked, danger: true }]
      : []),
  ];

  return (
    <section className="resolve-panel" aria-labelledby="resolve-title">
      <h3 id="resolve-title">Resolve</h3>
      <div className="outcome-options" role="radiogroup" aria-label="Outcome">
        {options.map((option) => (
          <div key={option.value} className="outcome-option-wrap">
            <button
              type="button"
              role="radio"
              aria-checked={outcome === option.value}
              className={`outcome-option${option.danger ? ' danger' : ''}`}
              onClick={() => {
                setOutcome(option.value);
                setSaveError(null);
              }}
              disabled={option.blocked !== null || saving}
            >
              {option.label}
            </button>
            {option.blocked && <span className="muted small outcome-blocked">{option.blocked}</span>}
          </div>
        ))}
      </div>

      {outcome === 'suspended' && (
        <fieldset className="field duration-field" disabled={saving}>
          <legend>How long</legend>
          <div className="duration-options">
            {SUSPENSION_DURATIONS.map((option) => (
              <label key={option.value} className="duration-option">
                <input
                  type="radio"
                  name="resolve-duration"
                  value={option.value}
                  checked={duration === option.value}
                  onChange={() => setDuration(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {needsReason && (
        <label className="field" htmlFor="resolve-reason">
          <span>Reason ({name} reads this)</span>
          <textarea
            id="resolve-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={touched && reasonError ? true : undefined}
            disabled={saving}
          />
          <span className="hint">
            {touched && reasonError ? (
              <span className="field-error">{reasonError}</span>
            ) : (
              `${reason.trim().length}/${WARNING_REASON_MAX_LENGTH}`
            )}
          </span>
        </label>
      )}

      <label className="field" htmlFor="resolve-note">
        <span>Admin note (optional; only admins see it)</span>
        <textarea
          id="resolve-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={noteError ? true : undefined}
          disabled={saving}
        />
        <span className="hint">
          {noteError ? <span className="field-error">{noteError}</span> : `${note.trim().length}/${RESOLVE_NOTE_MAX_LENGTH}`}
        </span>
      </label>
      <div className="quick-notes" role="group" aria-label="Quick notes">
        {QUICK_NOTES.map((quick) => (
          <button key={quick} type="button" className="quick-note" onClick={() => setNote((n) => addQuickNote(n, quick))} disabled={saving}>
            + {quick}
          </button>
        ))}
      </div>

      {saveError && (
        <div className="alert-error" role="alert">
          {saveError}
        </div>
      )}
      <button
        type="button"
        className={outcome === 'suspended' ? 'btn-danger' : 'btn-primary'}
        onClick={() => void resolve()}
        disabled={!outcome || saving}
      >
        {saving
          ? 'Saving…'
          : outcome === 'warned'
            ? 'Resolve and warn'
            : outcome === 'suspended'
              ? 'Resolve and suspend'
              : 'Resolve'}
      </button>
      {!outcome && <p className="muted small">Choose an outcome to resolve this complaint.</p>}
    </section>
  );
}
