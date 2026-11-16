import { useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { validateWarningReason, WARNING_REASON_MAX_LENGTH, type WarningRole } from './warningPlan';
import { sendWarning, WarningConflictError } from './warnings';

/**
 * A warning not tied to a complaint (complaintId null), from a list's "⋯" menu: a required
 * reason the user reads (max 500), then Send. Same record and wording as complaint warnings.
 */
export function SendWarningDialog({
  uid,
  name,
  role,
  onClose,
  onDone,
}: {
  uid: string;
  name: string;
  role: WarningRole;
  onClose: () => void;
  /** Called after saving, with a confirmation line for the page. */
  onDone: (message: string) => void;
}) {
  const { admin } = useAuth();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const reasonError = validateWarningReason(reason);
  const label = name || '(no name)';

  async function send() {
    setTouched(true);
    if (reasonError || !admin) return;
    setSaving(true);
    setSaveError(null);
    try {
      await sendWarning({ userId: uid, role, reason }, admin.uid);
      onDone(`Warning sent to ${label}. They see it in the app until they tap “I understand”.`);
    } catch (error) {
      const denied = (error as { code?: string }).code === 'permission-denied';
      setSaveError(
        error instanceof WarningConflictError
          ? error.message
          : denied
            ? 'The warning was refused. Reload the page and try again.'
            : 'Could not send the warning. Check your connection and try again.',
      );
      setSaving(false);
    }
  }

  return (
    <ConfirmDialog
      title={`Warn ${label}?`}
      confirmLabel="Send warning"
      busyLabel="Sending…"
      busy={saving}
      onConfirm={() => void send()}
      onCancel={onClose}
    >
      <p className="dialog-effect">
        {label} ({role}) will see this warning in the app until they tap “I understand”. You can withdraw it later, but
        not edit it.
      </p>
      <label className="field" htmlFor="send-warning-reason">
        <span>Reason (required; they read it)</span>
        <textarea
          id="send-warning-reason"
          rows={3}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setTouched(true);
          }}
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
      {saveError && (
        <div className="alert-error" role="alert">
          {saveError}
        </div>
      )}
    </ConfirmDialog>
  );
}
