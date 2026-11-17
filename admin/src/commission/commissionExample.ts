// Commission tab example line, e.g. "On a ₱100.00 fare, the driver owes ₱10.00; pay within
// 3 days, then 2 grace days." No Firebase imports (tests/admin/commissionExample.test.ts).

export const EXAMPLE_FARE = 100;

export type CommissionTerms = { percentage: number; paymentPeriodDays: number; gracePeriodDays: number };

/** Commission on a fare, rounded to the nearest centavo (final fare × percentage ÷ 100). */
export function calculateCommission(fare: number, percentage: number): number {
  return Math.round(fare * percentage) / 100;
}

function days(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** The example sentence; `formatPeso` is passed in so this file stays import-free. */
export function commissionExample(terms: CommissionTerms, formatPeso: (amount: number) => string): string {
  const owed = formatPeso(calculateCommission(EXAMPLE_FARE, terms.percentage));
  const grace = terms.gracePeriodDays === 0 ? 'no grace days' : days(terms.gracePeriodDays, 'grace day');
  return `On a ${formatPeso(EXAMPLE_FARE)} fare, the driver owes ${owed}; pay within ${days(
    terms.paymentPeriodDays,
    'day',
  )}, then ${grace}.`;
}
