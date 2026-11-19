import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RemarkChips } from '../components/RemarkChips';
import { PAYMENT_REJECT_REASONS } from '../inbox/noticePlan';
import { PageHeader } from '../components/PageHeader';
import { PageTabs, type PageTab } from '../components/PageTabs';
import {
  CASH_OUT_METHOD_LABELS,
  CASH_OUT_METHODS,
  CashOutConflictError,
  isCalendarDate,
  loadCashOuts,
  MAX_CASH_OUT_NOTE_LENGTH,
  MAX_CASH_OUT_REFERENCE_LENGTH,
  parsePesoAmount,
  recordCashOut,
  type CashOut,
  type CashOutInput,
  type CashOutMethod,
} from '../earnings/cashOuts';
import { COMMISSION_STATUS_LABELS, formatPeriodEndDay } from '../earnings/commissionStatus';
import { loadDriverBalances, loadEarningsTotals, type DriverBalance, type EarningsTotals } from '../earnings/earnings';
import { BalancesTab, balanceRows, CashOutsTab, OverviewTab, PaymentsTab } from '../earnings/EarningsTabs';
import {
  balanceParams,
  EARNINGS_TABS,
  earningsTab,
  HISTORY_PAGE_SIZE,
  historyParams,
  readBalanceFilters,
  readHistoryFilter,
  readPageParam,
  type BalanceFilters,
  type EarningsTab,
  type HistoryChip,
} from '../earnings/earningsView';
import {
  confirmPayment,
  loadAllPayments,
  loadPaymentHistory,
  loadPendingPayments,
  MAX_REJECTION_REASON_LENGTH,
  PaymentConflictError,
  rejectPayment,
  type PaymentHistoryPage,
  type PendingPayment,
} from '../earnings/payments';
import { db } from '../firebase/config';
import { useAdminCounts } from '../lib/adminCounts';
import { downloadCsv } from '../lib/csv';
import { toDateInputValue } from '../lib/dateRange';
import { formatCentavos, formatIsoDay } from '../lib/format';
import { listLoadErrorMessage } from '../lib/loadError';

type Review = { kind: 'confirm' | 'reject'; payment: PendingPayment };

type CashOutForm = { method: CashOutMethod; amount: string; reference: string; cashedOutOn: string; note: string };

const emptyCashOutForm = (): CashOutForm => ({
  method: 'gcash',
  amount: '',
  reference: '',
  cashedOutOn: toDateInputValue(new Date()),
  note: '',
});

/** Centavos as a plain CSV number, e.g. 70050 → "700.50". */
function csvPeso(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

function csvDateTime(date: Date | null): string {
  return date ? date.toISOString() : '';
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
};

const TABS: PageTab[] = EARNINGS_TABS.map(({ tab, label }) =>
  tab === 'payments'
    ? { to: `/earnings/${tab}`, label, badge: { count: 'pendingPayments', noun: ['pending payment', 'pending payments'] } }
    : { to: `/earnings/${tab}`, label },
);

/**
 * /earnings: older links (Dashboard bookmarks) used one long page with #pending-payments,
 * #balances and ?balances=…; they land on the matching tab.
 */
export function EarningsIndexRedirect() {
  const { hash, search } = useLocation();
  const balances = new URLSearchParams(search).get('balances');
  if (hash === '#pending-payments') return <Navigate to="/earnings/payments" replace />;
  if (hash === '#balances' || balances) {
    const status = balances === 'behind' || balances === 'overdue' || balances === 'suspended' ? `?status=${balances}` : '';
    return <Navigate to={`/earnings/balances${status}`} replace />;
  }
  return <Navigate to="/earnings/overview" replace />;
}

/** /earnings/:tab — Overview · Payments to review · Driver balances · Cash-outs. */
export function EarningsPage() {
  const tab = earningsTab(useParams().tab);
  if (!tab) return <Navigate to="/earnings/overview" replace />;
  return <Earnings tab={tab} />;
}

function Earnings({ tab }: { tab: EarningsTab }) {
  const { admin } = useAuth();
  const { refreshCounts } = useAdminCounts();
  const [searchParams, setSearchParams] = useSearchParams();
  const [totals, setTotals] = useState<EarningsTotals | null>(null);
  const [balances, setBalances] = useState<DriverBalance[] | null>(null);
  const [payments, setPayments] = useState<PendingPayment[] | null>(null);
  const [cashOuts, setCashOuts] = useState<CashOut[] | null>(null);
  /** Email (or name) of each admin who recorded a cash-out, when they have a profile. */
  const [recorders, setRecorders] = useState<Map<string, string>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  // Statuses depend on the time; fixed per load so the table does not change while read.
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [review, setReview] = useState<Review | null>(null);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cashOutStep, setCashOutStep] = useState<'form' | 'confirm' | null>(null);
  const [cashOutForm, setCashOutForm] = useState<CashOutForm>(emptyCashOutForm);
  const [cashOutTouched, setCashOutTouched] = useState(false);
  const [pendingCashOut, setPendingCashOut] = useState<CashOutInput | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<PaymentHistoryPage | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const [nextTotals, nextBalances, nextPayments, nextCashOuts] = await Promise.all([
        loadEarningsTotals(),
        loadDriverBalances(),
        loadPendingPayments(),
        loadCashOuts(),
      ]);
      setTotals(nextTotals);
      setBalances(nextBalances);
      setPayments(nextPayments);
      setCashOuts(nextCashOuts);
      setLoadedAt(Date.now());
      // Admin accounts may have no users/{uid} profile; those show as "an admin".
      const uids = [...new Set(nextCashOuts.map((c) => c.createdBy).filter(Boolean))];
      const profiles = await Promise.all(uids.map((uid) => getDoc(doc(db, 'users', uid)).catch(() => null)));
      const labels = new Map<string, string>();
      uids.forEach((uid, i) => {
        const email = profiles[i]?.data()?.email;
        if (typeof email === 'string' && email) labels.set(uid, email);
      });
      setRecorders(labels);
    } catch (error) {
      setLoadError(listLoadErrorMessage(error, 'Could not load earnings. Check your connection and try again.'));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Payment history: one page of reviewed payments, only on its tab.
  const historyFilter = readHistoryFilter(searchParams);
  const historyKey = `${historyFilter.status}:${historyFilter.page}`;
  const [historyReload, setHistoryReload] = useState(0);
  useEffect(() => {
    if (tab !== 'payments') return;
    let cancelled = false;
    const [status, page] = historyKey.split(':');
    setHistory(null);
    setHistoryError(null);
    loadPaymentHistory(status as HistoryChip, Number(page), HISTORY_PAGE_SIZE)
      .then((result) => !cancelled && setHistory(result))
      .catch(
        (error: unknown) =>
          !cancelled &&
          setHistoryError(listLoadErrorMessage(error, 'Could not load the payment history. Check your connection and try again.')),
      );
    return () => {
      cancelled = true;
    };
  }, [tab, historyKey, historyReload]);

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
      refreshCounts();
      setHistoryReload((n) => n + 1);
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

  const available = totals?.availableCentavos ?? 0;
  const cashOutAmount = parsePesoAmount(cashOutForm.amount);
  const today = toDateInputValue(new Date());
  const cashOutErrors: Partial<Record<keyof CashOutForm, string>> = {};
  if (cashOutAmount === null) cashOutErrors.amount = 'Enter an amount in pesos, e.g. 1500 or 1500.50.';
  else if (cashOutAmount > available) cashOutErrors.amount = `At most the available ${formatCentavos(available)}.`;
  if (!cashOutForm.reference.trim()) cashOutErrors.reference = 'Enter the reference from the GCash, Maya or bank app.';
  else if (cashOutForm.reference.trim().length > MAX_CASH_OUT_REFERENCE_LENGTH) {
    cashOutErrors.reference = `At most ${MAX_CASH_OUT_REFERENCE_LENGTH} characters.`;
  }
  if (!isCalendarDate(cashOutForm.cashedOutOn)) cashOutErrors.cashedOutOn = 'Choose the day the money was moved.';
  else if (cashOutForm.cashedOutOn > today) cashOutErrors.cashedOutOn = 'The date cannot be in the future.';
  if (cashOutForm.note.trim().length > MAX_CASH_OUT_NOTE_LENGTH) {
    cashOutErrors.note = `At most ${MAX_CASH_OUT_NOTE_LENGTH} characters.`;
  }

  function setCashOutField<K extends keyof CashOutForm>(field: K, value: CashOutForm[K]) {
    setCashOutForm((current) => ({ ...current, [field]: value }));
  }

  function openCashOut() {
    setMessage(null);
    setSaveError(null);
    setCashOutStep('form');
  }

  /** Step 1 → 2: the same checks as before, then a summary to confirm. */
  function reviewCashOut() {
    setCashOutTouched(true);
    if (Object.keys(cashOutErrors).length > 0 || cashOutAmount === null) return;
    setSaveError(null);
    setPendingCashOut({
      method: cashOutForm.method,
      amountCentavos: cashOutAmount,
      reference: cashOutForm.reference.trim(),
      cashedOutOn: cashOutForm.cashedOutOn,
      note: cashOutForm.note.trim(),
    });
    setCashOutStep('confirm');
  }

  async function handleRecordCashOut() {
    if (!pendingCashOut || !admin) return;
    setSaving(true);
    setSaveError(null);
    try {
      const availableAfter = await recordCashOut(pendingCashOut, admin.uid);
      setMessage(
        `Recorded a ${CASH_OUT_METHOD_LABELS[pendingCashOut.method]} cash-out of ${formatCentavos(pendingCashOut.amountCentavos)}. Available is now ${formatCentavos(availableAfter)}.`,
      );
      setPendingCashOut(null);
      setCashOutStep(null);
      setCashOutForm(emptyCashOutForm());
      setCashOutTouched(false);
      setSaving(false);
      await reload();
    } catch (error) {
      const denied = (error as { code?: string }).code === 'permission-denied';
      setSaveError(
        error instanceof CashOutConflictError
          ? error.message
          : denied
            ? 'The cash-out was refused. Reload the page and try again.'
            : 'Could not save the cash-out. Check your connection and try again.',
      );
      setSaving(false);
    }
  }

  const rows = useMemo(() => (balances ? balanceRows(balances, loadedAt) : null), [balances, loadedAt]);
  const overdueCount = rows ? rows.filter((row) => row.summary?.status === 'overdue').length : null;

  const stamp = toDateInputValue(new Date());
  const nameOf = (driverId: string) => balances?.find((row) => row.driverId === driverId)?.driverName ?? '';

  function exportBalances() {
    downloadCsv(`trigo-driver-balances-${stamp}.csv`, [
      ['Driver ID', 'Driver', 'Status', 'Balance (PHP)', 'Overdue (PHP)', 'Due by end of', 'Grace ends', 'Paid (PHP)', 'Recorded (PHP)'],
      ...(rows ?? []).map(({ driverId, driverName, account, summary }) =>
        summary && account
          ? [
              driverId,
              driverName,
              COMMISSION_STATUS_LABELS[summary.status],
              csvPeso(summary.balanceCentavos),
              csvPeso(summary.overdueCentavos),
              formatPeriodEndDay(summary.dueAtMillis),
              formatPeriodEndDay(summary.graceEndsAtMillis),
              csvPeso(account.paidCentavos),
              csvPeso(account.accruedCentavos),
            ]
          : [driverId, driverName, 'Unreadable', '', '', '', '', '', ''],
      ),
    ]);
  }

  async function exportPayments() {
    setExportError(null);
    setExporting(true);
    try {
      const all = await loadAllPayments();
      downloadCsv(`trigo-commission-payments-${stamp}.csv`, [
        ['Payment ID', 'Submitted', 'Driver ID', 'Driver', 'Amount (PHP)', 'GCash reference', 'Status', 'Reviewed', 'Rejection reason'],
        ...all.map((payment) => [
          payment.paymentId,
          csvDateTime(payment.submittedAt),
          payment.driverId,
          nameOf(payment.driverId),
          csvPeso(payment.amountCentavos),
          payment.reference,
          PAYMENT_STATUS_LABELS[payment.status] ?? payment.status,
          csvDateTime(payment.reviewedAt),
          payment.rejectionReason,
        ]),
      ]);
    } catch {
      setExportError('Could not load the payments. Check your connection and try again.');
    }
    setExporting(false);
  }

  function exportCashOuts() {
    downloadCsv(`trigo-cash-outs-${stamp}.csv`, [
      ['Cash-out ID', 'Date moved', 'Method', 'Amount (PHP)', 'Reference', 'Note', 'Recorded', 'Recorded by'],
      ...(cashOuts ?? []).map((cashOut) => [
        cashOut.cashOutId,
        cashOut.cashedOutOn,
        cashOut.method ? CASH_OUT_METHOD_LABELS[cashOut.method] : '',
        csvPeso(cashOut.amountCentavos),
        cashOut.reference,
        cashOut.note,
        csvDateTime(cashOut.createdAt),
        cashOut.createdBy,
      ]),
    ]);
  }

  const balance = (payment: PendingPayment) =>
    payment.accruedCentavos !== null && payment.paidCentavos !== null
      ? payment.accruedCentavos - payment.paidCentavos
      : null;

  const balanceFilters = readBalanceFilters(searchParams);
  const page = readPageParam(searchParams);

  return (
    <div className="stack">
      <PageTabs label="Earnings" tabs={TABS} />
      <PageHeader
        title="Earnings"
        subtitle="Commission from completed trips. Confirm driver GCash payments and record cash-outs."
        actions={
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              void reload();
              setHistoryReload((n) => n + 1);
            }}
          >
            Refresh
          </button>
        }
      />
      {message && (
        <div className="alert-success" role="status">
          {message}
        </div>
      )}

      {tab === 'overview' &&
        (loadError ? (
          <div className="list-error" role="alert">
            <p>{loadError}</p>
            <button type="button" className="btn-outline" onClick={() => void reload()}>
              Retry
            </button>
          </div>
        ) : (
          <OverviewTab
            totals={totals}
            pendingCount={payments?.length ?? null}
            overdueCount={overdueCount}
            onRecordCashOut={openCashOut}
          />
        ))}

      {tab === 'payments' && (
        <PaymentsTab
          payments={payments}
          loadError={loadError}
          onRetry={() => void reload()}
          onReview={open}
          history={history}
          historyError={historyError}
          historyFilter={historyFilter}
          onHistoryFilter={(status, nextPage) => setSearchParams(historyParams(status, nextPage))}
          onRetryHistory={() => setHistoryReload((n) => n + 1)}
          driverName={nameOf}
          onExport={() => void exportPayments()}
          exporting={exporting}
          exportError={exportError}
        />
      )}

      {tab === 'balances' && (
        <BalancesTab
          rows={rows}
          loadError={loadError}
          onRetry={() => void reload()}
          loadedAt={loadedAt}
          filters={balanceFilters}
          page={page}
          onChange={(next: BalanceFilters, nextPage: number, replace = false) =>
            setSearchParams(balanceParams(next, nextPage), { replace })
          }
          onExport={exportBalances}
        />
      )}

      {tab === 'cash-outs' && (
        <CashOutsTab
          cashOuts={cashOuts}
          totals={totals}
          loadError={loadError}
          onRetry={() => void reload()}
          page={page}
          onPage={(nextPage) => setSearchParams(nextPage > 1 ? { page: String(nextPage) } : {})}
          onRecord={openCashOut}
          onExport={exportCashOuts}
          recorderName={(uid) => recorders.get(uid) ?? 'an admin'}
        />
      )}

      {cashOutStep === 'form' && (
        <ConfirmDialog
          title="Record a cash-out"
          confirmLabel="Review…"
          onConfirm={reviewCashOut}
          onCancel={() => setCashOutStep(null)}
        >
          <p className="small muted">Record only after the money has been moved. Records can&apos;t be edited.</p>
          <div className="cash-out-form">
            <label className="field" htmlFor="cash-out-method">
              <span>Method</span>
              <select
                id="cash-out-method"
                value={cashOutForm.method}
                onChange={(e) => setCashOutField('method', e.target.value as CashOutMethod)}
              >
                {CASH_OUT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {CASH_OUT_METHOD_LABELS[method]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="cash-out-amount">
              <span>Amount (₱)</span>
              <input
                id="cash-out-amount"
                inputMode="decimal"
                value={cashOutForm.amount}
                onChange={(e) => setCashOutField('amount', e.target.value)}
                aria-invalid={cashOutTouched && cashOutErrors.amount ? true : undefined}
              />
              <span className="hint">
                {cashOutTouched && cashOutErrors.amount ? (
                  <span className="field-error">{cashOutErrors.amount}</span>
                ) : (
                  `At most ${formatCentavos(available)}`
                )}
              </span>
            </label>
            <label className="field" htmlFor="cash-out-reference">
              <span>Reference</span>
              <input
                id="cash-out-reference"
                value={cashOutForm.reference}
                onChange={(e) => setCashOutField('reference', e.target.value)}
                aria-invalid={cashOutTouched && cashOutErrors.reference ? true : undefined}
              />
              <span className="hint">
                {cashOutTouched && cashOutErrors.reference ? (
                  <span className="field-error">{cashOutErrors.reference}</span>
                ) : (
                  `${cashOutForm.reference.trim().length}/${MAX_CASH_OUT_REFERENCE_LENGTH}`
                )}
              </span>
            </label>
            <label className="field" htmlFor="cash-out-date">
              <span>Date moved</span>
              <input
                id="cash-out-date"
                type="date"
                max={today}
                value={cashOutForm.cashedOutOn}
                onChange={(e) => setCashOutField('cashedOutOn', e.target.value)}
                aria-invalid={cashOutTouched && cashOutErrors.cashedOutOn ? true : undefined}
              />
              <span className="hint">
                {cashOutTouched && cashOutErrors.cashedOutOn && (
                  <span className="field-error">{cashOutErrors.cashedOutOn}</span>
                )}
              </span>
            </label>
          </div>
          <label className="field" htmlFor="cash-out-note">
            <span>Note (optional)</span>
            <textarea
              id="cash-out-note"
              rows={2}
              value={cashOutForm.note}
              onChange={(e) => setCashOutField('note', e.target.value)}
              aria-invalid={cashOutTouched && cashOutErrors.note ? true : undefined}
            />
            <span className="hint">
              {cashOutTouched && cashOutErrors.note ? (
                <span className="field-error">{cashOutErrors.note}</span>
              ) : (
                `${cashOutForm.note.trim().length}/${MAX_CASH_OUT_NOTE_LENGTH}`
              )}
            </span>
          </label>
        </ConfirmDialog>
      )}

      {cashOutStep === 'confirm' && pendingCashOut && (
        <ConfirmDialog
          title={`Record a ${CASH_OUT_METHOD_LABELS[pendingCashOut.method]} cash-out of ${formatCentavos(pendingCashOut.amountCentavos)}?`}
          confirmLabel="Record cash-out"
          busy={saving}
          onConfirm={() => void handleRecordCashOut()}
          onCancel={() => setCashOutStep('form')}
        >
          <p>
            Record only after the transfer is done in {CASH_OUT_METHOD_LABELS[pendingCashOut.method]}. This can&apos;t
            be edited.
          </p>
          <table className="change-table">
            <tbody>
              <tr className="unchanged">
                <td>Date moved</td>
                <td>{formatIsoDay(pendingCashOut.cashedOutOn)}</td>
              </tr>
              <tr className="unchanged">
                <td>Reference</td>
                <td className="mono">{pendingCashOut.reference}</td>
              </tr>
              {pendingCashOut.note && (
                <tr className="unchanged">
                  <td>Note</td>
                  <td>{pendingCashOut.note}</td>
                </tr>
              )}
              {totals && (
                <>
                  <tr className="changed">
                    <td>Cashed out</td>
                    <td>
                      {formatCentavos(totals.cashedOutCentavos)} →{' '}
                      {formatCentavos(totals.cashedOutCentavos + pendingCashOut.amountCentavos)}
                    </td>
                  </tr>
                  <tr className="changed">
                    <td>Available</td>
                    <td>
                      {formatCentavos(available)} → {formatCentavos(available - pendingCashOut.amountCentavos)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          <p className="small muted">Cancel goes back to the form.</p>
          {saveError && (
            <div className="alert-error" role="alert">
              {saveError}
            </div>
          )}
        </ConfirmDialog>
      )}

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
          <RemarkChips
            label="Common reasons"
            chips={PAYMENT_REJECT_REASONS}
            value={reason}
            onChange={(next) => {
              setReason(next);
              setReasonTouched(true);
            }}
            disabled={saving}
          />
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
                `Shown to the driver in the app and in their inbox. ${reasonTrimmed.length}/${MAX_REJECTION_REASON_LENGTH}`
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
