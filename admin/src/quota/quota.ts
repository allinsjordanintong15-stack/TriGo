import type { DocumentData } from 'firebase/firestore';

// Driver daily acceptance quota, as the admin Quota page and Dashboard see it. One limit
// (quotaSettings/active.dailyLimit) applies to each driver's own count (drivers/{uid}.
// acceptedCount on acceptedDay, a Manila day number). Kept free of Firebase runtime
// imports so plain Node tests can load it.

/**
 * Copies of the app's src/utils/dailyQuota.ts and firestore.rules defaultDailyLimit();
 * tests/booking/dailyQuotaSync.test.ts keeps the three equal.
 */
export const DEFAULT_DAILY_LIMIT = 20;
export const DAILY_LIMIT_RANGE = { min: 1, max: 100 } as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Days since 1 Jan 1970 in Manila time (UTC+8, no daylight saving), as the app and rules count. */
export function manilaDay(epochMs: number): number {
  return Math.floor((epochMs + MANILA_OFFSET_MS) / DAY_MS);
}

export function isValidDailyLimit(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= DAILY_LIMIT_RANGE.min &&
    value <= DAILY_LIMIT_RANGE.max
  );
}

/** The saved limit, or null when quotaSettings/active is missing or holds no valid limit. */
export function readSavedLimit(data: DocumentData | undefined): number | null {
  const value: unknown = data?.dailyLimit;
  return isValidDailyLimit(value) ? value : null;
}

/** What the form accepts: a whole number in range, typed with optional spaces. */
export function parseDailyLimit(text: string): { value: number } | { error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { error: 'Required.' };
  if (!/^\d+$/.test(trimmed)) return { error: 'Enter a whole number.' };
  const value = Number(trimmed);
  if (!isValidDailyLimit(value)) {
    return { error: `Enter a number from ${DAILY_LIMIT_RANGE.min} to ${DAILY_LIMIT_RANGE.max}.` };
  }
  return { value };
}

/** Trips the driver accepted on `today`; a count stored for another day counts as 0. */
export function acceptedOn(data: DocumentData, today: number): number {
  const count: unknown = data.acceptedCount;
  return data.acceptedDay === today && typeof count === 'number' && Number.isInteger(count) && count > 0
    ? count
    : 0;
}

export type QuotaRow = {
  uid: string;
  fullName: string;
  vehiclePlate: string;
  vehicleType: string;
  acceptedToday: number;
  /** Never below 0 (a lowered limit can be under today's count). */
  remaining: number;
  reached: boolean;
};

/**
 * One row per verified driver (only they can accept), fewest slots left first; ties by
 * most accepted, then by name.
 */
export function buildQuotaRows(
  drivers: { uid: string; data: DocumentData }[],
  limit: number,
  today: number,
): QuotaRow[] {
  return drivers
    .filter(({ data }) => data.isVerified === true)
    .map(({ uid, data }) => {
      const acceptedToday = acceptedOn(data, today);
      return {
        uid,
        fullName: typeof data.fullName === 'string' ? data.fullName : '',
        vehiclePlate: typeof data.vehiclePlate === 'string' ? data.vehiclePlate : '',
        vehicleType: typeof data.vehicleType === 'string' ? data.vehicleType : '',
        acceptedToday,
        remaining: Math.max(0, limit - acceptedToday),
        reached: acceptedToday >= limit,
      };
    })
    .sort(
      (a, b) =>
        a.remaining - b.remaining ||
        b.acceptedToday - a.acceptedToday ||
        a.fullName.localeCompare(b.fullName),
    );
}
