import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { CopyIconButton } from '../components/CopyIconButton';
import { Pagination } from '../components/Pagination';
import { pageSlice } from '../drivers/driverTable';
import { formatCentavos, formatCount, formatDateTime, formatIsoDay, plural } from '../lib/format';
import { CASH_OUT_METHOD_LABELS, type CashOut } from './cashOuts';
import { commissionStatus, STATUS_ORDER, type CommissionStatus, type StatusSummary } from './commissionStatus';
import type { DriverBalance, EarningsTotals } from './earnings';
import {
  BALANCE_CHIP_LABELS,
  dueText,
  EARNINGS_PAGE_SIZES,
  HISTORY_CHIPS,
  HISTORY_PAGE_SIZE,
  matchesBalanceChip,
  visibleBalanceChips,
  type BalanceChip,
  type BalanceFilters,
  type EarningsPageSize,
  type HistoryChip,
} from './earningsView';
import type { PaymentHistoryPage, PendingPayment } from './payments';

// The four tabs of the Earnings page. Data loading, writes and dialogs stay in EarningsPage.

/** Same labels and tones as the driver app's commission chip (commission-label-* styles). */
const COMMISSION_LABELS: Record<CommissionStatus, string> = {
  paid_up: 'Paid up',
  due: 'Due',
  overdue: 'Overdue',
  suspended: 'Suspended (non-payment)',
};

export type BalanceRow = DriverBalance & { summary: StatusSummary | null };

/** Suspended first, then overdue, due, paid up; larger balances first; then A–Z. */
export function balanceRows(balances: DriverBalance[], nowMillis: number): BalanceRow[] {
  return balances
    .map((row) => ({ ...row, summary: row.account ? commissionStatus(row.account, nowMillis) : null }))
    .sort(
      (a, b) =>
        (a.summary ? STATUS_ORDER[a.summary.status] : -1) - (b.summary ? STATUS_ORDER[b.summary.status] : -1) ||
        (b.summary?.balanceCentavos ?? 0) - (a.summary?.balanceCentavos ?? 0) ||
        a.driverName.localeCompare(b.driverName),
    );
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="list-error" role="alert">
      <p>{message}</p>
      <button type="button" className="btn-outline" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function DriverLink({ driverId, name }: { driverId: string; name: string }) {
  const label = name || '(no name)';
  return (
    <div className="driver-cell">
      <Avatar name={name} imageUrl={null} size={28} />
      <Link className="list-name truncate" to={`/drivers/all/${encodeURIComponent(driverId)}`} title={label}>
        {label}
      </Link>
    </div>
  );
}

// ─── 1. Overview ────────────────────────────────────────────────────────────

export function OverviewTab({
  totals,
  pendingCount,
  overdueCount,
  onRecordCashOut,
}: {
  totals: EarningsTotals | null;
  pendingCount: number | null;
  overdueCount: number | null;
  onRecordCashOut: () => void;
}) {
  if (!totals) {
    return (
      <div className="money-flow" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card money-card-skeleton">
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        ))}
      </div>
    );
  }
  const owed = totals.outstandingCentavos;
  return (
    <div className="stack">
      {((pendingCount ?? 0) > 0 || (overdueCount ?? 0) > 0) && (
        <p className="needs-attention" role="status">
          <span className="needs-attention-label">Needs attention:</span>
          {(pendingCount ?? 0) > 0 && (
            <Link to="/earnings/payments">{plural(pendingCount ?? 0, 'payment')} waiting for review</Link>
          )}
          {(overdueCount ?? 0) > 0 && (
            <Link to="/earnings/balances?status=overdue">{plural(overdueCount ?? 0, 'driver')} overdue</Link>
          )}
        </p>
      )}

      <div className="money-flow">
        <FlowCard
          label="Earned"
          value={formatCentavos(totals.earnedCentavos)}
          hint={`Commission recorded on ${plural(totals.commissions, 'completed trip')}`}
        />
        <span className="money-flow-arrow" aria-hidden="true">
          →
        </span>
        <FlowCard label="Collected" value={formatCentavos(totals.collectedCentavos)} hint="Confirmed driver payments" />
        <span className="money-flow-arrow" aria-hidden="true">
          →
        </span>
        <FlowCard
          label="Cashed out"
          value={formatCentavos(totals.cashedOutCentavos)}
          hint="Moved to TriGo's own accounts"
        />
      </div>

      <div className="money-results">
        <section className={`card money-result ${owed > 0 ? 'is-owed' : ''}`} aria-labelledby="owed-title">
          <h3 id="owed-title" className="money-result-label">
            Still owed by drivers
          </h3>
          <div className="money-result-value">{formatCentavos(owed)}</div>
          <p className="muted small">Commission drivers haven&apos;t paid yet.</p>
          <Link to="/earnings/balances">See driver balances →</Link>
        </section>
        <section className="card money-result is-available" aria-labelledby="available-title">
          <h3 id="available-title" className="money-result-label">
            Available to cash out
          </h3>
          <div className="money-result-value">{formatCentavos(totals.availableCentavos)}</div>
          <p className="muted small">Collected but not yet cashed out.</p>
          <div>
            <button
              type="button"
              className="btn-primary"
              onClick={onRecordCashOut}
              disabled={totals.availableCentavos <= 0}
            >
              Record cash-out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function FlowCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card money-flow-card">
      <div className="stat-label">{label}</div>
      <div className="money-flow-value">{value}</div>
      <div className="muted small">{hint}</div>
    </div>
  );
}

// ─── 2. Payments to review ──────────────────────────────────────────────────

export function PaymentsTab({
  payments,
  loadError,
  onRetry,
  onReview,
  history,
  historyError,
  historyFilter,
  onHistoryFilter,
  onRetryHistory,
  driverName,
  onExport,
  exporting,
  exportError,
}: {
  payments: PendingPayment[] | null;
  loadError: string | null;
  onRetry: () => void;
  onReview: (kind: 'confirm' | 'reject', payment: PendingPayment) => void;
  history: PaymentHistoryPage | null;
  historyError: string | null;
  historyFilter: { status: HistoryChip; page: number };
  onHistoryFilter: (status: HistoryChip, page: number) => void;
  onRetryHistory: () => void;
  driverName: (driverId: string) => string;
  onExport: () => void;
  exporting: boolean;
  exportError: string | null;
}) {
  const pageCount = history ? Math.max(1, Math.ceil(history.total / HISTORY_PAGE_SIZE)) : 1;
  const from = (historyFilter.page - 1) * HISTORY_PAGE_SIZE + 1;

  return (
    <div className="stack">
      <section aria-labelledby="pending-title" className="stack-tight">
        <h3 id="pending-title" className="section-title">
          Waiting for review
        </h3>
        {loadError ? (
          <SectionError message={loadError} onRetry={onRetry} />
        ) : !payments ? (
          <div className="card">
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        ) : payments.length === 0 ? (
          <div className="card all-caught-up" role="status">
            <span className="all-caught-up-icon" aria-hidden="true">
              ✓
            </span>
            All caught up — no payments waiting for review.
          </div>
        ) : (
          <div className="payment-cards">
            {payments.map((payment) => (
              <article key={payment.paymentId} className="card payment-card" aria-label={`Payment from ${payment.driverName || 'a driver'}`}>
                <div className="payment-card-main">
                  <DriverLink driverId={payment.driverId} name={payment.driverName} />
                  <div className="payment-amount">{formatCentavos(payment.amountCentavos)}</div>
                </div>
                <dl className="payment-meta">
                  <div>
                    <dt>GCash reference</dt>
                    <dd className="contact-line">
                      <span className="mono">{payment.reference}</span>
                      <CopyIconButton text={payment.reference} label="GCash reference" />
                    </dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{formatDateTime(payment.submittedAt)}</dd>
                  </div>
                  {payment.accruedCentavos !== null && payment.paidCentavos !== null && (
                    <div>
                      <dt>Driver owes</dt>
                      <dd>{formatCentavos(payment.accruedCentavos - payment.paidCentavos)}</dd>
                    </div>
                  )}
                </dl>
                <p className="muted small">Check this reference in TriGo&apos;s GCash before confirming.</p>
                <div className="button-row">
                  <button type="button" className="btn-primary" onClick={() => onReview('confirm', payment)}>
                    Confirm…
                  </button>
                  <button type="button" className="btn-danger-outline" onClick={() => onReview('reject', payment)}>
                    Reject…
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card list-card" aria-labelledby="history-title">
        <div className="card-header">
          <h3 id="history-title">Payment history</h3>
          <button type="button" className="btn-outline" onClick={onExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export all payments (CSV)'}
          </button>
        </div>
        {exportError && (
          <div className="alert-error" role="alert">
            {exportError}
          </div>
        )}
        <div className="status-chips" role="group" aria-label="Payment status">
          {HISTORY_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              className="status-chip"
              aria-pressed={historyFilter.status === chip.value}
              onClick={() => onHistoryFilter(chip.value, 1)}
            >
              {chip.label}
            </button>
          ))}
        </div>
        {historyError ? (
          <SectionError message={historyError} onRetry={onRetryHistory} />
        ) : (
          <>
            <div className="list-table-scroll">
              <table className="list-table history-table">
                <colgroup>
                  <col className="col-h-date" />
                  <col className="col-h-driver" />
                  <col className="col-h-amount" />
                  <col className="col-h-reference" />
                  <col className="col-h-status" />
                  <col className="col-h-by" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Reviewed</th>
                    <th scope="col">Driver</th>
                    <th scope="col" className="num">
                      Amount
                    </th>
                    <th scope="col">Reference</th>
                    <th scope="col">Status</th>
                    <th scope="col">Reviewed by</th>
                  </tr>
                </thead>
                <tbody>
                  {!history ? (
                    <SkeletonRows columns={6} rows={5} />
                  ) : history.payments.length === 0 ? (
                    <tr className="list-empty-row">
                      <td colSpan={6}>
                        <div className="empty-state compact">No reviewed payments yet.</div>
                      </td>
                    </tr>
                  ) : (
                    history.payments.map((payment) => (
                      <tr key={payment.paymentId}>
                        <td className="date-cell">
                          <div>{formatDateTime(payment.reviewedAt)}</div>
                          <div className="muted small">Sent {formatDateTime(payment.submittedAt)}</div>
                        </td>
                        <td>
                          <DriverLink driverId={payment.driverId} name={driverName(payment.driverId)} />
                        </td>
                        <td className="num cell-strong">{formatCentavos(payment.amountCentavos)}</td>
                        <td>
                          <span className="contact-line">
                            <span className="mono truncate" title={payment.reference}>
                              {payment.reference}
                            </span>
                            <CopyIconButton text={payment.reference} label="GCash reference" />
                          </span>
                        </td>
                        <td>
                          <span
                            className={`trip-pill ${payment.status === 'confirmed' ? 'trip-pill-completed' : 'trip-pill-cancelled'}`}
                            title={payment.status === 'rejected' && payment.rejectionReason ? `Reason: ${payment.rejectionReason}` : undefined}
                          >
                            {payment.status === 'confirmed' ? 'Confirmed' : 'Rejected'}
                          </span>
                        </td>
                        <td className="muted small">
                          <span className="truncate" title={history.reviewers.get(payment.reviewedBy) ?? 'An admin'}>
                            {history.reviewers.get(payment.reviewedBy) ?? 'An admin'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {history && history.total > 0 && (
              <div className="list-pager">
                <span className="muted small">
                  Showing {formatCount(from)}–{formatCount(from + history.payments.length - 1)} of {formatCount(history.total)}
                </span>
                <Pagination
                  page={historyFilter.page}
                  pageCount={pageCount}
                  onChange={(page) => onHistoryFilter(historyFilter.status, page)}
                  label="Payment history pages"
                />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

// ─── 3. Driver balances ─────────────────────────────────────────────────────

export function BalancesTab({
  rows,
  loadError,
  onRetry,
  loadedAt,
  filters,
  page,
  onChange,
  onExport,
}: {
  rows: BalanceRow[] | null;
  loadError: string | null;
  onRetry: () => void;
  loadedAt: number;
  filters: BalanceFilters;
  page: number;
  onChange: (filters: BalanceFilters, page: number, replace?: boolean) => void;
  onExport: () => void;
}) {
  const searched = useMemo(() => {
    const words = filters.search.toLowerCase().split(/\s+/).filter(Boolean);
    return (rows ?? []).filter((row) => words.every((word) => row.driverName.toLowerCase().includes(word)));
  }, [rows, filters.search]);
  const counts = useMemo(() => {
    const result: Record<BalanceChip, number> = { all: searched.length, paid_up: 0, due: 0, overdue: 0, suspended: 0, behind: 0 };
    for (const row of searched) {
      if (!row.summary) continue;
      result[row.summary.status] += 1;
      if (row.summary.status === 'overdue' || row.summary.status === 'suspended') result.behind += 1;
    }
    return result;
  }, [searched]);
  const filtered = searched.filter((row) => matchesBalanceChip(row.summary?.status ?? null, filters.status));
  const slice = pageSlice(filtered, page, filters.pageSize);

  return (
    <div className="card list-card">
      <div className="list-toolbar">
        <label className="list-search" htmlFor="balance-search">
          <span className="visually-hidden">Search driver name</span>
          <input
            id="balance-search"
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value }, 1, true)}
            placeholder="Search driver name"
            autoComplete="off"
          />
        </label>
        <label className="list-select" htmlFor="balance-rows">
          <span>Show</span>
          <select
            id="balance-rows"
            value={filters.pageSize}
            onChange={(e) => onChange({ ...filters, pageSize: Number(e.target.value) as EarningsPageSize }, 1)}
          >
            {EARNINGS_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-outline list-count" onClick={onExport} disabled={!rows}>
          Export balances (CSV)
        </button>
      </div>
      <div className="status-chips" role="group" aria-label="Commission status">
        {visibleBalanceChips(filters.status).map((chip) => (
          <button
            key={chip}
            type="button"
            className={`status-chip${rows && counts[chip] === 0 ? ' is-empty' : ''}`}
            aria-pressed={filters.status === chip}
            onClick={() => onChange({ ...filters, status: chip }, 1)}
          >
            {BALANCE_CHIP_LABELS[chip]} <span className="status-chip-count">{rows ? formatCount(counts[chip]) : '–'}</span>
          </button>
        ))}
      </div>
      <p className="muted small">Dates end at midnight, Manila time.</p>

      {loadError ? (
        <SectionError message={loadError} onRetry={onRetry} />
      ) : (
        <>
          <div className="list-table-scroll">
            <table className="list-table balances-table">
              <colgroup>
                <col className="col-bal-driver" />
                <col className="col-bal-status" />
                <col className="col-bal-balance" />
                <col className="col-bal-due" />
                <col className="col-bal-paid" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Driver</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">
                    Balance
                  </th>
                  <th scope="col">Due</th>
                  <th scope="col" className="num">
                    Paid / Earned
                  </th>
                </tr>
              </thead>
              <tbody>
                {!rows ? (
                  <SkeletonRows columns={5} rows={filters.pageSize > 10 ? 10 : filters.pageSize} />
                ) : slice.items.length === 0 ? (
                  <tr className="list-empty-row">
                    <td colSpan={5}>
                      <div className="empty-state compact">
                        {rows.length === 0 ? 'No commission recorded yet.' : 'No drivers match.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  slice.items.map(({ driverId, driverName, account, summary }) => (
                    <tr key={driverId}>
                      <td>
                        <DriverLink driverId={driverId} name={driverName} />
                      </td>
                      {summary && account ? (
                        <>
                          <td>
                            <span className={`commission-label commission-label-${summary.status}`}>
                              {COMMISSION_LABELS[summary.status]}
                            </span>
                          </td>
                          <td className="num cell-strong">{formatCentavos(summary.balanceCentavos)}</td>
                          <td className={summary.status === 'paid_up' ? 'muted' : summary.status === 'due' ? '' : 'due-late'}>
                            <span className="truncate" title={dueText(summary, loadedAt, formatCentavos)}>
                              {dueText(summary, loadedAt, formatCentavos)}
                            </span>
                          </td>
                          <td className="num muted small">
                            {formatCentavos(account.paidCentavos)} of {formatCentavos(account.accruedCentavos)}
                          </td>
                        </>
                      ) : (
                        <td colSpan={4} className="muted small">
                          This account could not be read. Reload the page or update the website.
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {rows && slice.total > 0 && (
            <div className="list-pager">
              <span className="muted small">
                Showing {formatCount(slice.from)}–{formatCount(slice.to)} of {formatCount(slice.total)}
              </span>
              <Pagination
                page={slice.page}
                pageCount={slice.pageCount}
                onChange={(next) => onChange(filters, next)}
                label="Driver balance pages"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── 4. Cash-outs ───────────────────────────────────────────────────────────

export function CashOutsTab({
  cashOuts,
  totals,
  loadError,
  onRetry,
  page,
  onPage,
  onRecord,
  onExport,
  recorderName,
}: {
  cashOuts: CashOut[] | null;
  totals: EarningsTotals | null;
  loadError: string | null;
  onRetry: () => void;
  page: number;
  onPage: (page: number) => void;
  onRecord: () => void;
  onExport: () => void;
  recorderName: (uid: string) => string;
}) {
  const slice = pageSlice(cashOuts ?? [], page, HISTORY_PAGE_SIZE);
  const available = totals?.availableCentavos ?? 0;

  return (
    <div className="stack">
      <div className="card cash-out-bar">
        <div>
          <div className="stat-label">Available to cash out</div>
          <div className="money-result-value">{totals ? formatCentavos(available) : '—'}</div>
        </div>
        <div className="button-row">
          <button type="button" className="btn-primary" onClick={onRecord} disabled={!totals || available <= 0}>
            Record cash-out
          </button>
          <button type="button" className="btn-outline" onClick={onExport} disabled={!cashOuts}>
            Export cash-outs (CSV)
          </button>
        </div>
      </div>
      <p className="info-note">
        Cash-outs are recorded only. Transfer the money in GCash, Maya or your bank first. Records can&apos;t be edited.
      </p>

      <section className="card list-card" aria-labelledby="cash-out-history-title">
        <h3 id="cash-out-history-title">Cash-out history</h3>
        {loadError ? (
          <SectionError message={loadError} onRetry={onRetry} />
        ) : (
          <>
            <div className="list-table-scroll">
              <table className="list-table cash-out-table">
                <colgroup>
                  <col className="col-c-date" />
                  <col className="col-c-method" />
                  <col className="col-c-amount" />
                  <col className="col-c-reference" />
                  <col className="col-c-note" />
                  <col className="col-c-recorded" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Date moved</th>
                    <th scope="col">Method</th>
                    <th scope="col" className="num">
                      Amount
                    </th>
                    <th scope="col">Reference</th>
                    <th scope="col">Note</th>
                    <th scope="col">Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {!cashOuts ? (
                    <SkeletonRows columns={6} rows={4} />
                  ) : slice.items.length === 0 ? (
                    <tr className="list-empty-row">
                      <td colSpan={6}>
                        <div className="empty-state compact">No cash-outs recorded yet.</div>
                      </td>
                    </tr>
                  ) : (
                    slice.items.map((cashOut) => (
                      <tr key={cashOut.cashOutId}>
                        <td className="date-cell">{formatIsoDay(cashOut.cashedOutOn)}</td>
                        <td>{cashOut.method ? CASH_OUT_METHOD_LABELS[cashOut.method] : '—'}</td>
                        <td className="num cell-strong">{formatCentavos(cashOut.amountCentavos)}</td>
                        <td>
                          <span className="contact-line">
                            <span className="mono truncate" title={cashOut.reference}>
                              {cashOut.reference}
                            </span>
                            <CopyIconButton text={cashOut.reference} label="reference" />
                          </span>
                        </td>
                        <td>
                          <span className="truncate small" title={cashOut.note || undefined}>
                            {cashOut.note || <span className="muted">—</span>}
                          </span>
                        </td>
                        <td className="muted small">
                          <div className="truncate">{formatDateTime(cashOut.createdAt)}</div>
                          <div className="truncate" title={recorderName(cashOut.createdBy)}>
                            by {recorderName(cashOut.createdBy)}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {cashOuts && slice.total > 0 && (
              <div className="list-pager">
                <span className="muted small">
                  Showing {formatCount(slice.from)}–{formatCount(slice.to)} of {formatCount(slice.total)}
                </span>
                <Pagination page={slice.page} pageCount={slice.pageCount} onChange={onPage} label="Cash-out pages" />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function SkeletonRows({ columns, rows }: { columns: number; rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, index) => (
        <tr key={index} className="list-skeleton-row" aria-hidden="true">
          {Array.from({ length: columns }, (__, cell) => (
            <td key={cell}>
              <div className="skeleton-line" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
