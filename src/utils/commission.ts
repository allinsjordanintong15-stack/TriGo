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
