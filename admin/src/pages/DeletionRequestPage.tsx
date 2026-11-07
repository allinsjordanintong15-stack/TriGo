import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { useAdminCounts } from '../lib/adminCounts';
import { formatCentavos, formatDateTime } from '../lib/format';
import {
  canAnonymize,
  DECLINE_NOTE_MAX_LENGTH,
  deletionChecks,
  validateDeclineNote,
  type DeletionCheck,
} from '../privacy/deletionPlan';
import {
  anonymizeAndComplete,
  declineDeletionRequest,
  DELETION_STATUS_LABELS,
  DeletionConflictError,
  loadDeletionDetail,
  markAuthDeleted,
  type DeletionDetail,
} from '../privacy/deletionRequests';

const ROLE_LABELS: Record<string, string> = { passenger: 'Passenger', driver: 'Driver' };

const CHECK_ICONS: Record<DeletionCheck['state'], string> = { ok: '✓', warning: '!', blocking: '✕' };

type Dialog = 'anonymize' | 'decline' | 'auth' | null;

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof DeletionConflictError) return error.message;
  if ((error as { code?: string }).code === 'permission-denied') {
    return 'The change was refused. The account may have changed (a trip, a request, or another admin). Reload the page and check again.';
  }
  return fallback;
}

export function DeletionRequestPage() {
  const { uid = '' } = useParams();
  const navigate = useNavigate();
  const { admin } = useAuth();
  const { refreshCounts } = useAdminCounts();
  const [detail, setDetail] = useState<DeletionDetail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [declineNote, setDeclineNote] = useState('');
  const [declineTouched, setDeclineTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      setDetail(await loadDeletionDetail(uid));
    } catch {
      setLoadError('Could not load this request. Check your connection and reload the page.');
    }
  }, [uid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const backLink = (
    <Link to="/account-deletion" className="back-link">
      ← Back to account deletion
    </Link>
  );

  if (loadError || detail === null) {
    return (
      <div className="stack page-narrow">
        {backLink}
        <div className="alert-error" role="alert">
          {loadError ?? 'This deletion request no longer exists (the user may have withdrawn it).'}
        </div>
      </div>
    );
  }

  if (detail === undefined || !admin) {
    return (
      <div className="card">
        <LoadingBlock label="Loading request…" lines={5} />
      </div>
    );
  }

  const { request, account } = detail;
  const checks = deletionChecks(detail.openItems, formatCentavos);
  const ready = canAnonymize(checks);
  const declineError = validateDeclineNote(declineNote);
  const adminUid = admin.uid;

  async function run(action: () => Promise<void>, fallback: string, afterMessage: string | null) {
    setSaving(true);
    setSaveError(null);
    try {
      await action();
      refreshCounts();
      setDialog(null);
      if (afterMessage) {
        navigate('/account-deletion', { state: { message: afterMessage } });
      } else {
        await reload();
      }
    } catch (error) {
      setSaveError(errorMessage(error, fallback));
      setDialog(null);
    } finally {
      setSaving(false);
    }
  }

  async function copyUid() {
    try {
      await navigator.clipboard.writeText(request.uid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const name = account?.fullName || '(no profile)';

  return (
    <div className="stack page-narrow">
      {backLink}
      <PageHeader
        title={name}
        subtitle={`Deletion request · ${DELETION_STATUS_LABELS[request.status]}`}
      />

      {saveError && (
        <div className="alert-error" role="alert">
          {saveError}
        </div>
      )}

      <section className="card">
        <h3>Request</h3>
        <dl className="detail-grid">
          <Detail label="Requested" value={formatDateTime(request.requestedAt)} />
          <Detail label="Reason" value={request.reason ?? ''} />
          <Detail label="Email" value={account?.email ?? ''} />
          <Detail label="Mobile number" value={account?.mobileNumber ?? ''} />
          <Detail label="Role" value={account?.role ? (ROLE_LABELS[account.role] ?? account.role) : ''} />
          <Detail label="User ID" value={request.uid} mono />
        </dl>
        {request.status === 'declined' && (
          <p className="small">
            Declined {formatDateTime(request.declinedAt)}. Note to the user: {request.declineNote}
          </p>
        )}
      </section>

      <section className="card">
        <h3>Checklist</h3>
        <ol className="deletion-checklist">
          <li>
            <h4>1. Check what is still open</h4>
            {request.status === 'pending' ? (
              <ul className="check-list">
                {checks.map((check) => (
                  <li key={check.id} className={`check-${check.state}`}>
                    <span className="check-icon" aria-hidden="true">
                      {CHECK_ICONS[check.state]}
                    </span>
                    <span>
                      <span className="cell-strong">{check.label}: </span>
                      {check.detail}
                      <span className="visually-hidden">
                        {check.state === 'ok' ? ' (fine)' : check.state === 'warning' ? ' (check)' : ' (blocks deletion)'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Done.</p>
            )}
          </li>

          <li>
            <h4>2. Anonymize the account and mark the request completed</h4>
            <p className="small">
              One step removes the name, email, mobile number and photo from the profile, deletes
              the contact card
              {detail.hasDriverRecord ? ', blanks the driver record (name, plate, vehicle; unverified and offline for good)' : ''}
              {detail.hasApplication ? ', blanks the driver application (names, contact, vehicle, documents, remarks)' : ''}{' '}
              and completes the request. Trips, ratings, complaints and commission records stay, without
              the name. This cannot be undone.
            </p>
            {request.status === 'completed' ? (
              <p className="alert-success">Completed {formatDateTime(request.completedAt)}.</p>
            ) : request.status === 'pending' ? (
              <div className="button-row">
                <button
                  type="button"
                  className="btn-danger"
                  disabled={!ready || saving}
                  onClick={() => setDialog('anonymize')}
                >
                  Anonymize and complete
                </button>
                <button type="button" className="btn-outline" disabled={saving} onClick={() => setDialog('decline')}>
                  Decline…
                </button>
                {!ready && <span className="muted small">Resolve the items marked ✕ first, then reload.</span>}
              </div>
            ) : (
              <p className="muted small">Not done: the request was declined.</p>
            )}
          </li>

          <li>
            <h4>3. Delete the sign-in account in the Firebase Console</h4>
            <p className="small">
              The website cannot delete sign-in accounts. In the Firebase Console open{' '}
              <span className="cell-strong">Authentication → Users</span>, search for the user ID below,
              then choose <span className="cell-strong">Delete account</span>. Come back and record it here.
            </p>
            <p className="uid-row">
              <span className="mono">{request.uid}</span>
              <button type="button" className="btn-outline btn-compact" onClick={() => void copyUid()}>
                {copied ? 'Copied' : 'Copy user ID'}
              </button>
              <span className="visually-hidden" aria-live="polite">
                {copied ? 'User ID copied' : ''}
              </span>
            </p>
            {request.status === 'completed' &&
              (request.authDeletedAt ? (
                <p className="alert-success">Sign-in account deleted, recorded {formatDateTime(request.authDeletedAt)}.</p>
              ) : (
                <button type="button" className="btn-primary" disabled={saving} onClick={() => setDialog('auth')}>
                  I deleted the sign-in account
                </button>
              ))}
            {request.status === 'pending' && <p className="muted small">After step 2.</p>}
          </li>
        </ol>
      </section>

      {dialog === 'anonymize' && (
        <ConfirmDialog
          title="Anonymize this account?"
          confirmLabel="Anonymize and complete"
          busyLabel="Anonymizing…"
          danger
          busy={saving}
          onConfirm={() =>
            void run(
              () => anonymizeAndComplete(request.uid, adminUid),
              'Could not anonymize the account. Check your connection and try again.',
              `${name}: account anonymized and request completed. Next: delete the sign-in account in the Firebase Console.`,
            )
          }
          onCancel={() => setDialog(null)}
        >
          <p>
            {name}&apos;s personal details are removed for good and the request is marked completed.
            {detail.openItems.unpaidCentavos ? ` ${formatCentavos(detail.openItems.unpaidCentavos)} commission is still unpaid.` : ''}
          </p>
        </ConfirmDialog>
      )}

      {dialog === 'decline' && (
        <ConfirmDialog
          title="Decline this request?"
          confirmLabel="Decline request"
          busyLabel="Declining…"
          busy={saving}
          onConfirm={() => {
            setDeclineTouched(true);
            if (declineError) return;
            void run(
              () => declineDeletionRequest(request.uid, adminUid, declineNote),
              'Could not decline the request. Check your connection and try again.',
              `${name}: deletion request declined.`,
            );
          }}
          onCancel={() => setDialog(null)}
        >
          <p className="muted small">The user sees this note in the app and can ask again.</p>
          <label className="field" htmlFor="decline-note">
            <span>Note to the user (required)</span>
            <textarea
              id="decline-note"
              rows={4}
              value={declineNote}
              onChange={(e) => {
                setDeclineNote(e.target.value);
                setDeclineTouched(true);
              }}
              aria-invalid={declineTouched && declineError ? true : undefined}
              disabled={saving}
            />
            <span className="hint">
              {declineTouched && declineError ? (
                <span className="field-error">{declineError}</span>
              ) : (
                `${declineNote.trim().length}/${DECLINE_NOTE_MAX_LENGTH}`
              )}
            </span>
          </label>
        </ConfirmDialog>
      )}

      {dialog === 'auth' && (
        <ConfirmDialog
          title="Record the sign-in account as deleted?"
          confirmLabel="Record"
          busy={saving}
          onConfirm={() =>
            void run(
              () => markAuthDeleted(request.uid, adminUid),
              'Could not save. Check your connection and try again.',
              null,
            )
          }
          onCancel={() => setDialog(null)}
        >
          <p>Only confirm after deleting user {request.uid} under Authentication → Users in the Firebase Console.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="detail-item">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value || '—'}</dd>
    </div>
  );
}
