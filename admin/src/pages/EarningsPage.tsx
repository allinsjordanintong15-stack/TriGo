import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { formatDateTime } from '../bookings/bookings';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  COMMISSION_STATUS_BADGE_CLASS,
  COMMISSION_STATUS_LABELS,
  commissionStatus,
  formatPeriodEndDay,
  STATUS_ORDER,
  type CommissionStatus,
} from '../earnings/commissionStatus';
import { loadDriverBalances, loadEarningsTotals, type DriverBalance, type EarningsTotals } from '../earnings/earnings';
import {
  confirmPayment,
  formatCentavos,
  loadPendingPayments,
  MAX_REJECTION_REASON_LENGTH,
  PaymentConflictError,
  rejectPayment,
  type PendingPayment,
} from '../earnings/payments';

type Review = { kind: 'confirm' | 'reject'; payment: PendingPayment };

type BalanceFilter = 'all' | 'owing' | 'overdue' | 'suspended';

export function EarningsPage() {
  const { admin } = useAuth();
  const [totals, setTotals] = useState<EarningsTotals | null>(null);
  const [balances, setBalances] = useState<DriverBalance[] | null>(null);
  const [payments, setPayments] = useState<PendingPayment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BalanceFilter>('all');
  // Statuses depend on the time; fixed per load so the table does not change while read.
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [review, setReview] = useState<Review | null>(null);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const [nextTotals, nextBalances, nextPayments] = await Promise.all([
        loadEarningsTotals(),
        loadDriverBalances(),
        loadPendingPayments(),
      ]);
      setTotals(nextTotals);
      setBalances(nextBalances);
      setPayments(nextPayments);
      setLoadedAt(Date.now());
    } catch {
      setLoadError('Could not load earnings. Check your connection and reload the page.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function open(kind: Review['kind'], payment: PendingPayment) {
    setReview({ kind, payment });
    setReason('');
    setReasonTouched(false);
    setSaveError(null);
    setMessage(null);
  }

  const reasonTrimmed = reason.trim();
  const reasonError = !reasonTrimmed
    ? 'A reason is required. The driver sees it in the app.'
    : reasonTrimmed.length > MAX_REJECTION_REASON_LENGTH
      ? `At most ${MAX_REJECTION_REASON_LENGTH} characters.`
      : null;

  async function handleConfirm() {
    if (!review || !admin) return;
    if (review.kind === 'reject') {
      setReasonTouched(true);
      if (reasonError) return;
    }
    const { payment } = review;
    setSaving(true);
    setSaveError(null);
    try {
      if (review.kind === 'confirm') {
        const result = await confirmPayment(payment.paymentId, admin.uid);
        setMessage(
          `Confirmed ${formatCentavos(payment.amountCentavos)} from ${payment.driverName || 'the driver'}. Their balance is now ${formatCentavos(result.accrued - result.paidAfter)}.`,
        );
      } else {
        await rejectPayment(payment.paymentId, admin.uid, reason);
        setMessage(
          `Rejected ${formatCentavos(payment.amountCentavos)} from ${payment.driverName || 'the driver'}. The reference number can be submitted again.`,
        );
      }
      setReview(null);
      setSaving(false);
      await reload();
    } catch (error) {
      const denied = (error as { code?: string }).code === 'permission-denied';
      setSaveError(
        error instanceof PaymentConflictError
          ? error.message
          : denied
            ? 'The change was refused. Reload the page and try again.'
            : 'Could not save the change. Check your connection and try again.',
      );
      setSaving(false);
    }
  }

  const balanceRows = useMemo(
    () =>
      (balances ?? [])
        .map((row) => ({ ...row, summary: row.account ? commissionStatus(row.account, loadedAt) : null }))
        .sort(
          (a, b) =>
            (a.summary ? STATUS_ORDER[a.summary.status] : -1) - (b.summary ? STATUS_ORDER[b.summary.status] : -1) ||
            (b.summary?.balanceCentavos ?? 0) - (a.summary?.balanceCentavos ?? 0) ||
            a.driverName.localeCompare(b.driverName),
        ),
    [balances, loadedAt],
  );

  const statusCounts = useMemo(() => {
    const result: Record<CommissionStatus, number> = { paid_up: 0, due: 0, overdue: 0, suspended: 0 };
    for (const row of balanceRows) if (row.summary) result[row.summary.status] += 1;
    return result;
  }, [balanceRows]);

  const shownRows = balanceRows.filter(({ summary }) => {
    if (filter === 'all' || !summary) return true;
    if (filter === 'owing') return summary.status !== 'paid_up';
    return summary.status === filter;
  });

  const balance = (payment: PendingPayment) =>
    payment.accruedCentavos !== null && payment.paidCentavos !== null
      ? payment.accruedCentavos - payment.paidCentavos
      : null;

  return (
    <div className="stack">
      {message && (
        <div className="alert-success" role="status">
          {message}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>Earnings</h2>
          <button type="button" className="btn-outline" onClick={() => void reload()}>
            Refresh
          </button>
        </div>
        <p className="muted">
          TriGo&apos;s commission on completed trips. TriGo moves no money: drivers pay by GCash and you confirm each
          payment below.
        </p>
        {loadError && (
          <div className="alert-error" role="alert">
            {loadError}
          </div>
        )}
      </div>

      {totals && (
        <div className="stat-grid">
          <Stat
            label="Earned"
            value={formatCentavos(totals.earnedCentavos)}
            hint={`Commission on ${totals.commissions} completed trip${totals.commissions === 1 ? '' : 's'}`}
          />
          <Stat label="Collected" value={formatCentavos(totals.collectedCentavos)} hint="Confirmed driver payments" />
          <Stat label="Outstanding" value={formatCentavos(totals.outstandingCentavos)} hint="Earned − collected" />
          <Stat label="Cashed out" value={formatCentavos(totals.cashedOutCentavos)} hint="Recorded cash-outs" />
          <Stat label="Available" value={formatCentavos(totals.availableCentavos)} hint="Collected − cashed out" />
        </div>
      )}

      <div className="card">
        <h3>Pending commission payments</h3>
        <p className="muted">
          Drivers pay commission to TriGo&apos;s GCash account and report the amount and GCash reference number in
          the app. Check each one in GCash before confirming. Confirming lowers the driver&apos;s balance; rejecting
          frees the reference number so the driver can submit the right one.
        </p>

        {loadError ? null : !payments ? (
          <p className="muted">Loading payments…</p>
        ) : payments.length === 0 ? (
          <p className="muted">No payments are waiting for review.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Submitted</th>
                  <th scope="col">Driver</th>
                  <th scope="col">Amount</th>
                  <th scope="col">GCash reference</th>
                  <th scope="col">Driver balance</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.paymentId}>
                    <td>{formatDateTime(payment.submittedAt)}</td>
                    <td>
                      <Link className="btn-link" to={`/driver-accounts/${payment.driverId}`}>
                        {payment.driverName || '(no name)'}
                      </Link>
                    </td>
                    <td className="cell-strong">{formatCentavos(payment.amountCentavos)}</td>
                    <td className="mono">{payment.reference}</td>
                    <td>{formatCentavos(balance(payment))}</td>
                    <td className="cell-action">
                      <button type="button" className="btn-primary" onClick={() => open('confirm', payment)}>
                        Confirm…
                      </button>{' '}
                      <button type="button" className="btn-outline" onClick={() => open('reject', payment)}>
                        Reject…
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Driver balances</h3>
          <label className="field filter-field" htmlFor="balance-filter">
            <span>Show</span>
            <select id="balance-filter" value={filter} onChange={(e) => setFilter(e.target.value as BalanceFilter)}>
              <option value="all">All drivers ({balanceRows.length})</option>
              <option value="owing">Owing ({balanceRows.length - statusCounts.paid_up})</option>
              <option value="overdue">Overdue ({statusCounts.overdue})</option>
              <option value="suspended">Suspended ({statusCounts.suspended})</option>
            </select>
          </label>
        </div>
        <p className="muted small">
          Drivers with recorded commission. Due dates and grace ends are the end of that day, Manila time. Overdue =
          from periods that have ended.
        </p>
        {loadError ? null : !balances ? (
          <p className="muted">Loading balances…</p>
        ) : shownRows.length === 0 ? (
          <p className="muted">{balanceRows.length === 0 ? 'No commission recorded yet.' : 'No drivers match.'}</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Driver</th>
                  <th scope="col">Status</th>
                  <th scope="col">Balance</th>
                  <th scope="col">Overdue</th>
                  <th scope="col">Due by end of</th>
                  <th scope="col">Grace ends</th>
                  <th scope="col">Paid / recorded</th>
                </tr>
              </thead>
              <tbody>
                {shownRows.map(({ driverId, driverName, account, summary }) => (
                  <tr key={driverId}>
                    <td>
                      <Link className="btn-link" to={`/driver-accounts/${driverId}`}>
                        {driverName || '(no name)'}
                      </Link>
                    </td>
                    {summary && account ? (
                      <>
                        <td>
                          <span className={`status-badge ${COMMISSION_STATUS_BADGE_CLASS[summary.status]}`}>
                            {COMMISSION_STATUS_LABELS[summary.status]}
                          </span>
                        </td>
                        <td className="cell-strong">{formatCentavos(summary.balanceCentavos)}</td>
                        <td>{summary.overdueCentavos > 0 ? formatCentavos(summary.overdueCentavos) : '—'}</td>
                        <td>{formatPeriodEndDay(summary.dueAtMillis)}</td>
                        <td>{formatPeriodEndDay(summary.graceEndsAtMillis)}</td>
                        <td className="muted small">
                          {formatCentavos(account.paidCentavos)} / {formatCentavos(account.accruedCentavos)}
                        </td>
                      </>
                    ) : (
                      <td colSpan={6} className="muted">
                        This account could not be read. Reload the page or update the website.
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {review?.kind === 'confirm' && (
        <ConfirmDialog
          title={`Confirm ${formatCentavos(review.payment.amountCentavos)} from ${review.payment.driverName || 'this driver'}?`}
          confirmLabel="Confirm payment"
          busy={saving}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setReview(null)}
        >
          <p>
            Confirm only if TriGo&apos;s GCash received {formatCentavos(review.payment.amountCentavos)} with reference{' '}
            <span className="mono">{review.payment.reference}</span>.
          </p>
          <table className="change-table">
            <tbody>
              <tr className="changed">
                <td>Payment</td>
                <td>Pending → Confirmed</td>
              </tr>
              {review.payment.paidCentavos !== null && review.payment.accruedCentavos !== null && (
                <>
                  <tr className="changed">
                    <td>Paid by driver</td>
                    <td>
                      {formatCentavos(review.payment.paidCentavos)} →{' '}
                      {formatCentavos(review.payment.paidCentavos + review.payment.amountCentavos)}
                    </td>
                  </tr>
                  <tr className="changed">
                    <td>Driver balance</td>
                    <td>
                      {formatCentavos(balance(review.payment))} →{' '}
                      {formatCentavos((balance(review.payment) ?? 0) - review.payment.amountCentavos)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          {saveError && (
            <div className="alert-error" role="alert">
              {saveError}
            </div>
          )}
        </ConfirmDialog>
      )}

      {review?.kind === 'reject' && (
        <ConfirmDialog
          title={`Reject ${formatCentavos(review.payment.amountCentavos)} from ${review.payment.driverName || 'this driver'}?`}
          confirmLabel="Reject payment"
          danger
          busy={saving}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setReview(null)}
        >
          <table className="change-table">
            <tbody>
              <tr className="changed">
                <td>Payment</td>
                <td>Pending → Rejected</td>
              </tr>
              <tr className="unchanged">
                <td>Driver balance</td>
                <td>{formatCentavos(balance(review.payment))} (unchanged)</td>
              </tr>
            </tbody>
          </table>
          <label className="field" htmlFor="reject-reason">
            <span>Reason (the driver sees it)</span>
            <textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonTouched(true);
              }}
              aria-invalid={reasonTouched && reasonError ? true : undefined}
              disabled={saving}
            />
            <span className="hint">
              {reasonTouched && reasonError ? (
                <span className="field-error">{reasonError}</span>
              ) : (
                `${reasonTrimmed.length}/${MAX_REJECTION_REASON_LENGTH}`
              )}
            </span>
          </label>
          <p className="small">
            Reference <span className="mono">{review.payment.reference}</span> is freed so the driver can submit it
            again.
          </p>
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

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="muted small">{hint}</div>
    </div>
  );
}
