import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { countComplaintsAgainst } from '../complaints/complaints';
import { complaintCountLabel } from '../complaints/reportedParty';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDateTime } from '../lib/format';
import { warningSummaryLabel, type WarningRole } from './warningPlan';
import { loadWarningsFor, WarningConflictError, withdrawWarning, type AdminWarning } from './warnings';

type Loaded = { key: string; warnings: AdminWarning[] | null; complaints: number | null };

/**
 * Driver or passenger page: "N warnings · N complaints" in this role and the warning history,
 * newest first, with Withdraw on active warnings. Warnings are counted only; the admin
 * decides any suspension.
 */
export function WarningsCard({ uid, role }: { uid: string; role: WarningRole }) {
  const { admin } = useAuth();
  const key = `${uid}:${role}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [withdrawing, setWithdrawing] = useState<AdminWarning | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [warnings, complaints] = await Promise.all([
      loadWarningsFor(uid, role).catch(() => null),
      countComplaintsAgainst(uid, role).catch(() => null),
    ]);
    return { key, warnings, complaints };
  }, [uid, role, key]);

  useEffect(() => {
    let cancelled = false;
    void load().then((result) => !cancelled && setLoaded(result));
    return () => {
      cancelled = true;
    };
  }, [load]);

  const current = loaded?.key === key ? loaded : null;

  async function handleWithdraw() {
    if (!admin || !withdrawing) return;
    setBusy(true);
    setActionError(null);
    try {
      await withdrawWarning(withdrawing.warningId, admin.uid);
      setWithdrawing(null);
      setMessage('Warning withdrawn. The user no longer sees it.');
      setLoaded(await load());
    } catch (error) {
      const denied = (error as { code?: string }).code === 'permission-denied';
      setActionError(
        error instanceof WarningConflictError
          ? error.message
          : denied
            ? 'The change was refused. Reload the page and try again.'
            : 'Could not withdraw the warning. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const complaintText = current?.complaints == null ? 'complaints could not be loaded' : complaintCountLabel(current.complaints);

  return (
    <section className="card" aria-labelledby={`warnings-${role}`}>
      <h3 id={`warnings-${role}`}>Warnings ({role === 'driver' ? 'as driver' : 'as passenger'})</h3>
      {!current ? (
        <p className="muted">Loading…</p>
      ) : current.warnings === null ? (
        <div className="alert-error" role="alert">
          Could not load warnings. Check your connection and reload the page.
        </div>
      ) : (
        <>
          <p>
            <strong>{warningSummaryLabel(current.warnings, complaintText)}</strong>
          </p>
          <p className="muted small">
            Warnings are counted only. Suspending an account is your decision. Complaints are counted from 10 Nov 2026.
          </p>
          {message && (
            <div className="alert-success" role="status">
              {message}
            </div>
          )}
          {current.warnings.length > 0 && (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Status</th>
                    <th scope="col">Complaint</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {current.warnings.map((warning) => (
                    <tr key={warning.warningId}>
                      <td>{formatDateTime(warning.createdAt)}</td>
                      <td>{warning.reason || <span className="muted">(cleared)</span>}</td>
                      <td>
                        {warning.status === 'withdrawn' ? (
                          <span className="status-badge status-rejected">Withdrawn {formatDateTime(warning.withdrawnAt)}</span>
                        ) : warning.acknowledgedAt ? (
                          <span className="status-badge status-approved">
                            Acknowledged {formatDateTime(warning.acknowledgedAt)}
                          </span>
                        ) : (
                          <span className="status-badge status-pending">Not yet read</span>
                        )}
                      </td>
                      <td>
                        {warning.complaintId ? (
                          <Link className="btn-link" to={`/complaints/against-${role}s/${encodeURIComponent(warning.complaintId)}`}>
                            View
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {warning.status === 'active' && (
                          <button
                            type="button"
                            className="btn-outline"
                            onClick={() => {
                              setActionError(null);
                              setMessage(null);
                              setWithdrawing(warning);
                            }}
                          >
                            Withdraw…
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {withdrawing && (
        <ConfirmDialog
          title="Withdraw this warning?"
          confirmLabel="Withdraw"
          busyLabel="Withdrawing…"
          busy={busy}
          danger
          onConfirm={() => void handleWithdraw()}
          onCancel={() => setWithdrawing(null)}
        >
          <p>The user will no longer see it, and it stops counting. This can't be undone.</p>
          {withdrawing.reason && <blockquote className="remarks-quote">{withdrawing.reason}</blockquote>}
          {actionError && (
            <div className="alert-error" role="alert">
              {actionError}
            </div>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}
