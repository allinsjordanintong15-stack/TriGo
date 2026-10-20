import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { formatDateTime } from '../bookings/bookings';
import { ConfirmDialog } from '../components/ConfirmDialog';
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

export function EarningsPage() {
  const { admin } = useAuth();
  const [payments, setPayments] = useState<PendingPayment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      setPayments(await loadPendingPayments());
    } catch {
      setLoadError('Could not load payments. Check your connection and reload the page.');
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
          <h2>Pending commission payments</h2>
          <button type="button" className="btn-outline" onClick={() => void reload()}>
            Refresh
          </button>
        </div>
        <p className="muted">
          Drivers pay commission to TriGo&apos;s GCash account and report the amount and GCash reference number in
          the app. Check each one in GCash before confirming. Confirming lowers the driver&apos;s balance; rejecting
          frees the reference number so the driver can submit the right one.
        </p>

        {loadError ? (
          <div className="alert-error" role="alert">
            {loadError}
          </div>
        ) : !payments ? (
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
