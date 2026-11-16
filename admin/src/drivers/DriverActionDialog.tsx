import { useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { sendWarning, WarningConflictError } from '../warnings/warnings';
import {
  ACTION_REASON_MAX_LENGTH,
  SUSPENSION_DURATIONS,
  validateActionReason,
  type SuspensionDuration,
} from './driverActionPlan';
import { dutyStatus, type AdminDriver } from './driverRecords';
import {
  liftDriverSuspension,
  restoreDriver,
  revokeDriver,
  suspendDriver,
  SuspensionConflictError,
  VerificationConflictError,
} from './drivers';

export type DriverAction = 'warning' | 'suspend' | 'lift' | 'revoke' | 'restore';

const ACTION_TEXT: Record<
  DriverAction,
  { title: string; confirm: string; busy: string; effect: string; done: string; danger: boolean }
> = {
  warning: {
    title: 'Send a warning',
    confirm: 'Send warning',
    busy: 'Sending…',
    effect: 'The driver gets a warning in Messages from TriGo and on Home. It counts in their warning history.',
    done: 'Warning sent to',
    danger: false,
  },
  suspend: {
    title: 'Suspend driver',
    confirm: 'Suspend driver',
    busy: 'Suspending…',
    effect:
      'The driver cannot accept new requests until the suspension ends. They can stay online and finish a current trip.',
    done: 'Suspended',
    danger: true,
  },
  lift: {
    title: 'Lift suspension',
    confirm: 'Lift suspension',
    busy: 'Lifting…',
    effect: 'The driver can accept new requests again right away.',
    done: 'Lifted the suspension of',
    danger: false,
  },
  revoke: {
    title: 'Revoke verification',
    confirm: 'Revoke verification',
    busy: 'Revoking…',
    effect: 'The driver is taken offline and cannot go online or accept requests until you restore them.',
    done: 'Revoked the verification of',
    danger: true,
  },
  restore: {
    title: 'Restore verification',
    confirm: 'Restore verification',
    busy: 'Restoring…',
    effect: 'The driver can go online and accept requests again. They stay offline until they go online in the app.',
    done: 'Restored the verification of',
    danger: false,
  },
};

/**
 * One admin action on a driver: the driver's name, a required reason the driver reads (max
 * 500), what it does, and (Suspend) how long. Every action also messages the driver.
 */
export function DriverActionDialog({
  driver,
  action,
  onClose,
  onDone,
}: {
  driver: AdminDriver;
  action: DriverAction;
  onClose: () => void;
  /** Called after a successful save with a confirmation line for the page. */
  onDone: (message: string) => void;
}) {
  const { admin } = useAuth();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [duration, setDuration] = useState<SuspensionDuration>('1d');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const text = ACTION_TEXT[action];
  const name = driver.fullName || '(no name)';
  const reasonError = validateActionReason(reason);
  const duty = dutyStatus(driver);

  async function confirm() {
    setTouched(true);
    if (reasonError || !admin) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (action === 'warning') await sendWarning({ userId: driver.uid, role: 'driver', reason }, admin.uid);
      else if (action === 'suspend') await suspendDriver(driver.uid, admin.uid, reason, duration);
      else if (action === 'lift') await liftDriverSuspension(driver.uid, admin.uid, reason);
      else if (action === 'revoke') await revokeDriver(driver.uid, admin.uid, reason);
      else await restoreDriver(driver.uid, admin.uid, reason);
      onDone(`${text.done} ${name}. They were notified in the app.`);
    } catch (error) {
      const known =
        error instanceof VerificationConflictError ||
        error instanceof SuspensionConflictError ||
        error instanceof WarningConflictError;
      const denied = (error as { code?: string }).code === 'permission-denied';
      setSaveError(
        known
          ? (error as Error).message
          : denied
            ? 'The change was refused. Reload the page and try again.'
            : 'Could not save the change. Check your connection and try again.',
      );
      setSaving(false);
    }
  }

  return (
    <ConfirmDialog
      title={`${text.title}: ${name}`}
      confirmLabel={text.confirm}
      busyLabel={text.busy}
      danger={text.danger}
      busy={saving}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    >
      <p className="dialog-effect">{text.effect}</p>
      {action === 'revoke' && duty === 'on_trip' && <p className="small">They are on a trip and can still finish it.</p>}
      {action === 'revoke' && duty === 'holding_request' && (
        <p className="small">They hold an out-of-area request; the passenger is sent back to searching.</p>
      )}
      {action === 'suspend' && (
        <fieldset className="field duration-field" disabled={saving}>
          <legend>How long</legend>
          <div className="duration-options">
            {SUSPENSION_DURATIONS.map((option) => (
              <label key={option.value} className="duration-option">
                <input
                  type="radio"
                  name="suspension-duration"
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
      <label className="field" htmlFor="driver-action-reason">
        <span>Reason (required; the driver reads it)</span>
        <textarea
          id="driver-action-reason"
          rows={3}
          value={reason}
          maxLength={ACTION_REASON_MAX_LENGTH + 50}
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
            `${reason.trim().length}/${ACTION_REASON_MAX_LENGTH}`
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
