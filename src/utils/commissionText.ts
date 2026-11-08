// Driver-facing commission deadline and overdue text for the Earnings tab. Relative
// imports of alias-free files only, so plain Node tests can load this file
// (tests/booking/commissionText.test.ts). Dates are Manila calendar days, whatever the
// phone's time zone (formatPeriodEndDay).

import { centavosToPesos, type CommissionStatusSummary, formatPeriodEndDay } from './commission.ts';
import { formatTimeLeft } from './dateTime.ts';
import { formatPhilippinePeso } from './fare.ts';

function peso(centavos: number): string {
  return formatPhilippinePeso(centavosToPesos(centavos));
}

/**
 * "Pay by the end of Nov 9, 2026 · 1 day 2 hr left": the running period's due time while
 * due, the grace period's end while overdue. The day is the last Manila day before that
 * midnight, the same day the period details show as the period end. Null when paid up or
 * suspended (nothing left to count down).
 */
export function formatPayBy(summary: CommissionStatusSummary, nowMillis: number): string | null {
  const deadline =
    summary.status === 'due'
      ? summary.dueAtMillis
      : summary.status === 'overdue'
        ? summary.graceEndsAtMillis
        : null;
  if (deadline === null) return null;
  const left = deadline > nowMillis ? ` · ${formatTimeLeft(deadline - nowMillis)} left` : '';
  return `Pay by the end of ${formatPeriodEndDay(deadline)}${left}`;
}

export interface OverdueNotice {
  title: string;
  message: string;
}

/**
 * The overdue or suspended box. Names the overdue amount (closed periods still owed),
 * which is what must be confirmed paid: paying it clears the unpaid period and, once the
 * running period's grace has passed too, the whole balance (firestore.rules
 * isSuspendedAccount; commissionStatus decides the same). Only confirmed payments count.
 */
export function overdueNotice(summary: CommissionStatusSummary): OverdueNotice | null {
  const amount = peso(summary.overdueCentavos);
  const due = summary.dueAtMillis !== null ? formatPeriodEndDay(summary.dueAtMillis) : '';
  const graceEnd =
    summary.graceEndsAtMillis !== null ? formatPeriodEndDay(summary.graceEndsAtMillis) : '';

  if (summary.status === 'overdue') {
    return {
      title: `${amount} overdue`,
      message: `It was due by the end of ${due}. Pay ${amount} by the end of ${graceEnd} (grace period) to keep accepting new requests. Only payments TriGo has confirmed count, so pay early.`,
    };
  }
  if (summary.status === 'suspended') {
    return {
      title: `Suspended: ${amount} overdue`,
      message: `Your grace period ended on ${graceEnd}. Pay ${amount} to accept new requests again; you can accept again once TriGo confirms your payment. You can still finish your current trip.`,
    };
  }
  return null;
}
