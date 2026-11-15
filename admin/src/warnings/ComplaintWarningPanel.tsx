import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import type { AdminComplaint } from '../complaints/complaints';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDateTime } from '../lib/format';
import { validateWarningReason, WARNING_REASON_MAX_LENGTH, type WarningRole } from './warningPlan';
import { loadComplaintWarning, WarningConflictError, warnFromComplaint, type AdminWarning } from './warnings';

type Props = {
  complaint: AdminComplaint;
  /** The reported person; null when there is nobody (no driver on the booking). */
  reported: { uid: string; role: WarningRole; name: string } | null;
};

/**
 * Complaint detail: "Warn <name>" with a required reason and a confirmation, or the existing
 * warning when this complaint already has one (one per complaint). Only complaints that
 * store who was reported (from 10 Nov 2026) can lead to a warning; the rules check it.
 */
export function ComplaintWarningPanel({ complaint, reported }: Props) {
  const { admin } = useAuth();
  const [warning, setWarning] = useState<AdminWarning | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadFailed(false);
    try {
      setWarning(await loadComplaintWarning(complaint.complaintId));
    } catch {
      setLoadFailed(true);
    }
  }, [complaint.complaintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const name = reported?.name || '(no name)';
  const reasonError = validateWarningReason(reason);
  const canWarn = Boolean(reported) && typeof complaint.reportedUserId === 'string' && complaint.reportedUserId !== '';

  async function handleConfirm() {
    if (!admin || !reported) return;
    setSaving(true);
    setSaveError(null);
    try {
      await warnFromComplaint(
        {
          userId: reported.uid,
          role: reported.role,
          complaintId: complaint.complaintId,
          bookingId: complaint.bookingId,
          reason,
        },
        admin.uid,
      );
      setConfirming(false);
      setReason('');
      setTouched(false);
      setMessage(`${name} has been warned. They will see it in the app.`);
      await reload();
    } catch (error) {
      const denied = (error as { code?: string }).code === 'permission-denied';
      setSaveError(
        error instanceof WarningConflictError
          ? error.message
          : denied
            ? 'The warning was refused. Reload the page and try again.'
            : 'Could not save the warning. Check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card review-panel" aria-labelledby="complaint-warning-title">
      <h3 id="complaint-warning-title">Warning</h3>
      {message && (
        <div className="alert-success" role="status">
          {message}
        </div>
      )}
      {loadFailed ? (
        <div className="alert-error" role="alert">
          Could not check for a warning. Check your connection and reload the page.
        </div>
      ) : warning === undefined ? (
        <p className="muted">Loading…</p>
      ) : warning ? (
        <>
          <p>
            {warning.status === 'withdrawn' ? (
              <span className="status-badge status-rejected">Withdrawn {formatDateTime(warning.withdrawnAt)}</span>
            ) : warning.acknowledgedAt ? (
              <span className="status-badge status-approved">Acknowledged {formatDateTime(warning.acknowledgedAt)}</span>
            ) : (
              <span className="status-badge status-pending">Not yet read</span>
            )}
          </p>
          <p className="small">
            {name} was warned on {formatDateTime(warning.createdAt)}. One warning per complaint; withdraw it from their
            page.
          </p>
          {warning.reason ? (
            <blockquote className="remarks-quote">{warning.reason}</blockquote>
          ) : (
            <p className="muted small">The reason was cleared when the account was deleted.</p>
          )}
        </>
      ) : !canWarn ? (
        <p className="muted small">
          {reported
            ? 'This complaint is from before 10 Nov 2026 and does not record who was reported, so a warning cannot be tied to it.'
            : 'Nobody to warn: this booking had no driver.'}
        </p>
      ) : (
        <>
          <label className="field" htmlFor="warning-reason">
            <span>Reason ({name} reads this in the app)</span>
            <textarea
              id="warning-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
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
          <p className="muted small">Warnings are counted. Suspending an account is your decision; nothing happens automatically.</p>
          <div className="button-row">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setTouched(true);
                if (reasonError) return;
                setSaveError(null);
                setMessage(null);
                setConfirming(true);
              }}
              disabled={saving}
            >
              Warn {name}…
            </button>
          </div>
        </>
      )}

      {confirming && reported && (
        <ConfirmDialog
          title={`Warn ${name}?`}
          confirmLabel="Send warning"
          busyLabel="Sending…"
          busy={saving}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setConfirming(false)}
        >
          <p>
            {name} ({reported.role}) will see this warning in the app until they tap “I understand”. You can withdraw it
            later, but not edit it.
          </p>
          <blockquote className="remarks-quote">{reason.trim()}</blockquote>
          {saveError && (
            <div className="alert-error" role="alert">
              {saveError}
            </div>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}
