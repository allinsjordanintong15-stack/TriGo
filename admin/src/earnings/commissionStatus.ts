// A driver's commission status, the same calculation as the driver app
// (src/utils/commission.ts: periodEndMillis, commissionStatus, formatPeriodEndDay) and
// firestore.rules (periodEndMillis). Change them together. Kept free of Firebase runtime
// imports; money in integer centavos.

const DAY_MS = 24 * 60 * 60 * 1000;
/** Manila is UTC+8 all year (no daylight saving). */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Manila midnight at the end of the `periodDays`-th day, counting the start day as day 1. */
export function periodEndMillis(startAtMillis: number, periodDays: number): number {
  return (Math.floor((startAtMillis + MANILA_OFFSET_MS) / DAY_MS) + periodDays) * DAY_MS - MANILA_OFFSET_MS;
}

export function graceEndMillis(startAtMillis: number, periodDays: number, graceDays: number): number {
  return periodEndMillis(startAtMillis, periodDays) + graceDays * DAY_MS;
}

export type PeriodTimes = { seq: number; startAtMillis: number; periodDays: number; graceDays: number };

/** commissionAccounts/{uid} (firestore.rules, Commission accrual). */
export type AccountTimes = {
  accruedCentavos: number;
  paidCentavos: number;
  current: PeriodTimes & { startCentavos: number };
  /** The oldest closed period that is not fully paid. */
  unpaid: PeriodTimes | null;
};

/**
 * paid_up: nothing owed. due: only the running period is owed, before its end.
 * overdue: a period has ended unpaid, within its grace period.
 * suspended: the grace period of an unpaid period has ended; the driver cannot accept new
 * requests until the overdue amount is confirmed paid (firestore.rules isCommissionSuspended).
 */
export type CommissionStatus = 'paid_up' | 'due' | 'overdue' | 'suspended';

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  paid_up: 'Paid up',
  due: 'Due',
  overdue: 'Overdue',
  suspended: 'Suspended',
};

export const COMMISSION_STATUS_BADGE_CLASS: Record<CommissionStatus, string> = {
  paid_up: 'status-approved',
  due: 'status-pending',
  overdue: 'status-overdue',
  suspended: 'status-rejected',
};

export type StatusSummary = {
  status: CommissionStatus;
  /** accrued − paid. */
  balanceCentavos: number;
  /** The part of the balance from periods that have ended. */
  overdueCentavos: number;
  /** End of the period to pay next: the oldest unpaid one, else the running one. */
  dueAtMillis: number | null;
  graceEndsAtMillis: number | null;
};

/** Where a driver stands at `nowMillis`; a running period that has ended counts as closed. */
export function commissionStatus(account: AccountTimes, nowMillis: number): StatusSummary {
  const balanceCentavos = Math.max(0, account.accruedCentavos - account.paidCentavos);
  if (balanceCentavos === 0) {
    return { status: 'paid_up', balanceCentavos, overdueCentavos: 0, dueAtMillis: null, graceEndsAtMillis: null };
  }
  const { current, unpaid } = account;
  const currentDue = periodEndMillis(current.startAtMillis, current.periodDays);
  const currentEnded = nowMillis >= currentDue;
  const overdueCentavos = currentEnded ? balanceCentavos : Math.max(0, current.startCentavos - account.paidCentavos);
  const dueAtMillis = unpaid ? periodEndMillis(unpaid.startAtMillis, unpaid.periodDays) : currentDue;
  const graceEndsAtMillis = unpaid
    ? graceEndMillis(unpaid.startAtMillis, unpaid.periodDays, unpaid.graceDays)
    : graceEndMillis(current.startAtMillis, current.periodDays, current.graceDays);
  const status: CommissionStatus =
    unpaid || currentEnded ? (nowMillis >= graceEndsAtMillis ? 'suspended' : 'overdue') : 'due';
  return { status, balanceCentavos, overdueCentavos, dueAtMillis, graceEndsAtMillis };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The Manila calendar day a period end (a Manila midnight) closes, e.g. "Oct 25, 2026"
 * for Oct 26 00:00, whatever the browser's time zone.
 */
export function formatPeriodEndDay(endMillis: number | null): string {
  if (endMillis === null) return '—';
  const manila = new Date(endMillis - 1 + MANILA_OFFSET_MS);
  return `${MONTHS[manila.getUTCMonth()]} ${manila.getUTCDate()}, ${manila.getUTCFullYear()}`;
}

/** Status order for sorting: suspended first, paid up last. */
export const STATUS_ORDER: Record<CommissionStatus, number> = { suspended: 0, overdue: 1, due: 2, paid_up: 3 };
