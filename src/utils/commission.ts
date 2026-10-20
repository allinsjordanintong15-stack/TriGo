// Commission arithmetic shared by the driver app. firestore.rules checks the same values
// (commissions, commissionAccounts, periodEndMillis), so change both together.
// Money is kept in integer centavos so running totals never drift.

const DAY_MS = 24 * 60 * 60 * 1000;
/** Manila is UTC+8 all year (no daylight saving). */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Commission on one trip in centavos: finalFare × percentage / 100 pesos, rounded to the
 * centavo. Equal to Math.round(finalFare × percentage), the exact product the rules round.
 */
export function commissionCentavos(finalFare: number, percentage: number): number {
  return Math.round(finalFare * percentage);
}

/**
 * When a commission period that started at `startAtMillis` ends: Manila midnight at the
 * end of the `periodDays`-th calendar day, counting the start day as day 1. E.g. 7 days
 * from Monday 10:00 ends Monday 00:00 a week later (the end of Sunday).
 */
export function periodEndMillis(startAtMillis: number, periodDays: number): number {
  return (Math.floor((startAtMillis + MANILA_OFFSET_MS) / DAY_MS) + periodDays) * DAY_MS - MANILA_OFFSET_MS;
}

/** When the grace period after that period ends (a driver still owing is then suspended). */
export function graceEndMillis(startAtMillis: number, periodDays: number, graceDays: number): number {
  return periodEndMillis(startAtMillis, periodDays) + graceDays * DAY_MS;
}

/** 4210 → 42.1 (pesos), for display with the existing peso formatting. */
export function centavosToPesos(centavos: number): number {
  return centavos / 100;
}

// ─── Account status (driver Earnings tab) ───────────────────────────────────

/** A commission period as the status helper needs it (epoch ms instead of Timestamps). */
export interface PeriodTimes {
  startAtMillis: number;
  periodDays: number;
  graceDays: number;
}

/** commissionAccounts/{uid}, see firestore.rules (Commission accrual). */
export interface CommissionAccountTimes {
  accruedCentavos: number;
  paidCentavos: number;
  current: PeriodTimes & { seq: number; startCentavos: number };
  /** The oldest closed period that is not fully paid. */
  unpaid: (PeriodTimes & { seq: number }) | null;
}

/**
 * paid_up: nothing owed. due: only the running period is owed, before its end.
 * overdue: a period has ended unpaid, still within its grace period.
 * suspended: the grace period of an unpaid period has ended.
 */
export type CommissionStatus = 'paid_up' | 'due' | 'overdue' | 'suspended';

export interface CommissionStatusSummary {
  status: CommissionStatus;
  /** Everything owed: accrued − paid. */
  balanceCentavos: number;
  /** The part of the balance from periods that have ended. */
  overdueCentavos: number;
  /** The period the driver should pay next: the oldest unpaid one, or the running one. */
  dueAtMillis: number | null;
  graceEndsAtMillis: number | null;
}

/**
 * Where the driver stands at `nowMillis`. A running period that has ended counts as
 * closed even before the next trip opens a new one (the rules see it the same way).
 */
export function commissionStatus(
  account: CommissionAccountTimes,
  nowMillis: number,
): CommissionStatusSummary {
  const balanceCentavos = Math.max(0, account.accruedCentavos - account.paidCentavos);
  const { current, unpaid } = account;
  const currentDue = periodEndMillis(current.startAtMillis, current.periodDays);
  const currentGraceEnd = graceEndMillis(current.startAtMillis, current.periodDays, current.graceDays);

  if (balanceCentavos === 0) {
    return {
      status: 'paid_up',
      balanceCentavos,
      overdueCentavos: 0,
      dueAtMillis: null,
      graceEndsAtMillis: null,
    };
  }

  const currentEnded = nowMillis >= currentDue;
  const overdueCentavos = currentEnded
    ? balanceCentavos
    : Math.max(0, current.startCentavos - account.paidCentavos);
  // The oldest unpaid period sets the deadline; else the running period does.
  const dueAtMillis = unpaid ? periodEndMillis(unpaid.startAtMillis, unpaid.periodDays) : currentDue;
  const graceEndsAtMillis = unpaid
    ? graceEndMillis(unpaid.startAtMillis, unpaid.periodDays, unpaid.graceDays)
    : currentGraceEnd;

  const status: CommissionStatus =
    unpaid || currentEnded
      ? nowMillis >= graceEndsAtMillis
        ? 'suspended'
        : 'overdue'
      : 'due';
  return { status, balanceCentavos, overdueCentavos, dueAtMillis, graceEndsAtMillis };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The Manila calendar day that a period end (a Manila midnight) closes, e.g. "Oct 26,
 * 2026" for Oct 27 00:00. Computed by hand so it never depends on the phone's time zone.
 */
export function formatPeriodEndDay(endMillis: number): string {
  const manila = new Date(endMillis - 1 + MANILA_OFFSET_MS);
  return `${MONTHS[manila.getUTCMonth()]} ${manila.getUTCDate()}, ${manila.getUTCFullYear()}`;
}

/** The Manila calendar day of an instant, e.g. a period start. */
export function formatManilaDay(millis: number): string {
  return formatPeriodEndDay(millis + 1);
}
