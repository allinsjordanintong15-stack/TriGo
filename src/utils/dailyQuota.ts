// Driver daily acceptance quota: each driver may accept at most `dailyLimit` passengers per
// Manila day (resets at 12:00 AM Asia/Manila). No imports, so plain Node tests can load
// this file. firestore.rules enforces the same numbers; keep the constants in sync.

// ─── The limit ───────────────────────────────────────────────────────────────

/**
 * Used when quotaSettings/active is missing or holds no valid limit. Keep in sync with
 * defaultDailyLimit() in firestore.rules and the admin website's copy (admin/src/settings).
 */
export const DEFAULT_DAILY_LIMIT = 20;

/** Whole numbers the admin may save (same range as firestore.rules). */
export const DAILY_LIMIT_RANGE = { min: 1, max: 100 } as const;

export function isValidDailyLimit(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= DAILY_LIMIT_RANGE.min &&
    value <= DAILY_LIMIT_RANGE.max
  );
}

/** The limit in force: quotaSettings/active.dailyLimit when valid, else the default. */
export function dailyLimitFrom(settings: unknown): number {
  const value =
    typeof settings === 'object' && settings !== null
      ? (settings as { dailyLimit?: unknown }).dailyLimit
      : undefined;
  return isValidDailyLimit(value) ? value : DEFAULT_DAILY_LIMIT;
}

// ─── Manila days ─────────────────────────────────────────────────────────────

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Manila is UTC+8 all year (no daylight saving), so the day is plain arithmetic. */
export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Days since 1 Jan 1970 in Manila time: what drivers/{uid}.acceptedDay stores. The rules
 * compute the same from request.time: floor((millis + 8 h) / 24 h).
 */
export function manilaDay(epochMs: number): number {
  return Math.floor((epochMs + MANILA_OFFSET_MS) / DAY_MS);
}

/** The instant the next Manila day starts (12:00 AM Manila = 16:00 UTC). */
export function nextManilaMidnight(epochMs: number): number {
  return (manilaDay(epochMs) + 1) * DAY_MS - MANILA_OFFSET_MS;
}

export function msUntilManilaMidnight(epochMs: number): number {
  return nextManilaMidnight(epochMs) - epochMs;
}

/** How close to midnight a denied accept is retried once with the recomputed day. */
export const MIDNIGHT_RETRY_WINDOW_MS = 2 * 60 * 1000;

/** True within `windowMs` either side of a Manila midnight. */
export function isNearManilaMidnight(
  epochMs: number,
  windowMs: number = MIDNIGHT_RETRY_WINDOW_MS,
): boolean {
  const sinceMidnight = epochMs - (nextManilaMidnight(epochMs) - DAY_MS);
  return sinceMidnight <= windowMs || msUntilManilaMidnight(epochMs) <= windowMs;
}

/**
 * The day to try once more when a write carrying `manilaDay(epochMs)` was refused near
 * midnight: the server may already be on the next day (or still on the previous one).
 * Null away from midnight, where the day cannot be the reason.
 */
export function alternateDayNearMidnight(
  epochMs: number,
  windowMs: number = MIDNIGHT_RETRY_WINDOW_MS,
): number | null {
  if (msUntilManilaMidnight(epochMs) <= windowMs) return manilaDay(epochMs) + 1;
  const sinceMidnight = epochMs - (nextManilaMidnight(epochMs) - DAY_MS);
  return sinceMidnight <= windowMs ? manilaDay(epochMs) - 1 : null;
}

// ─── Server clock ────────────────────────────────────────────────────────────

/**
 * How far the server clock is ahead of this phone (negative when behind), from a server
 * timestamp the app just wrote (e.g. drivers/{uid}.updatedAt) and the phone times just
 * before the write and when the confirmed value arrived. The server time is taken to be
 * the midpoint, so the error is at most half the round trip.
 */
export function clockOffsetMs(serverMs: number, sentAtMs: number, receivedAtMs: number): number {
  return serverMs - (sentAtMs + receivedAtMs) / 2;
}

/** The server's current time as estimated on this phone. */
export function serverNow(localNowMs: number, offsetMs: number): number {
  return localNowMs + offsetMs;
}

// ─── Today's count ───────────────────────────────────────────────────────────

/** The quota fields on drivers/{uid}; missing on drivers who never accepted since the quota. */
export interface QuotaFields {
  acceptedCount?: unknown;
  acceptedDay?: unknown;
}

function storedCount(fields: QuotaFields): number {
  const count = fields.acceptedCount;
  return typeof count === 'number' && Number.isInteger(count) && count > 0 ? count : 0;
}

/** Trips accepted on `today` (a manilaDay). A count stored for another day counts as 0. */
export function acceptedOn(fields: QuotaFields, today: number): number {
  return fields.acceptedDay === today ? storedCount(fields) : 0;
}

export interface QuotaStatus {
  acceptedToday: number;
  limit: number;
  /** Never below 0, also when a lowered limit is under today's count. */
  remaining: number;
  reached: boolean;
}

export function quotaStatus(acceptedToday: number, limit: number): QuotaStatus {
  return {
    acceptedToday,
    limit,
    remaining: Math.max(0, limit - acceptedToday),
    reached: acceptedToday >= limit,
  };
}

/** True when the driver may not accept or propose any more today. */
export function isAtDailyLimit(fields: QuotaFields, limit: number, today: number): boolean {
  return quotaStatus(acceptedOn(fields, today), limit).reached;
}

/** The fields an accept (T1) or out-of-area claim writes: today's count + 1. */
export function fieldsAfterAccept(
  fields: QuotaFields,
  today: number,
): { acceptedCount: number; acceptedDay: number } {
  return { acceptedCount: acceptedOn(fields, today) + 1, acceptedDay: today };
}

// ─── Giving a slot back ──────────────────────────────────────────────────────

/** The booking fields the refund depends on. */
export interface RefundBookingFields {
  status: string;
  cancelledBy: string | null;
  startedAt: Date | null;
  acceptedAt: Date | null;
}

/**
 * True when releasing this booking may give the slot back (mirrors firestore.rules): the
 * passenger cancelled it before the trip started, it was accepted today (Manila), and
 * today's count includes it.
 */
export function canRefundSlot(
  booking: RefundBookingFields,
  fields: QuotaFields,
  today: number,
): boolean {
  return (
    booking.status === 'cancelled' &&
    booking.cancelledBy === 'passenger' &&
    booking.startedAt === null &&
    booking.acceptedAt !== null &&
    manilaDay(booking.acceptedAt.getTime()) === today &&
    acceptedOn(fields, today) > 0
  );
}

/** The fields the refunding release writes: today's count − 1. */
export function fieldsAfterRefund(
  fields: QuotaFields,
  today: number,
): { acceptedCount: number; acceptedDay: number } {
  return { acceptedCount: Math.max(0, acceptedOn(fields, today) - 1), acceptedDay: today };
}

// ─── Text ────────────────────────────────────────────────────────────────────

/** "Accepted today: 3 of 20" (Home). */
export function acceptedTodayText(status: QuotaStatus): string {
  return `Accepted today: ${status.acceptedToday} of ${status.limit}`;
}

export const DAILY_LIMIT_REACHED_MESSAGE =
  'Daily limit reached. You can accept again after 12:00 AM.';
