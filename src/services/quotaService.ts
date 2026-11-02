import { COLLECTIONS, firestore } from '@/firebase';
import {
  alternateDayNearMidnight,
  clockOffsetMs,
  dailyLimitFrom,
  isAtDailyLimit,
  manilaDay,
  serverNow as estimateServerNow,
} from '@/utils/dailyQuota';
import {
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  Timestamp,
  Transaction,
} from 'firebase/firestore';

// Driver daily acceptance quota: one admin-set limit (quotaSettings/active.dailyLimit,
// default DEFAULT_DAILY_LIMIT while missing) applies to each driver's own count
// (drivers/{uid}.acceptedCount on acceptedDay). firestore.rules enforces it.

function quotaSettingsRef() {
  return doc(firestore, COLLECTIONS.quotaSettings, 'active');
}

/**
 * Live daily limit, so an admin change applies at once. A missing document or an invalid
 * value gives the default. On a read error `onError` runs and no limit is reported.
 */
export function subscribeToDailyLimit(
  onUpdate: (dailyLimit: number) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    quotaSettingsRef(),
    (snapshot) => onUpdate(dailyLimitFrom(snapshot.data())),
    (error) => onError(error),
  );
}

/** The limit read inside a transaction (accept), so the check uses the current value. */
export async function readDailyLimit(transaction: Transaction): Promise<number> {
  const snapshot = await transaction.get(quotaSettingsRef());
  return dailyLimitFrom(snapshot.data());
}

/**
 * True when the driver is at today's limit, from a fresh read of their record and the
 * limit. False when either cannot be read: the rules still refuse an accept at the limit.
 */
export async function isDriverAtDailyLimit(driverId: string): Promise<boolean> {
  try {
    const [driver, settings] = await Promise.all([
      getDoc(doc(firestore, COLLECTIONS.drivers, driverId)),
      getDoc(quotaSettingsRef()),
    ]);
    const data = driver.data();
    if (!data) return false;
    return isAtDailyLimit(data, dailyLimitFrom(settings.data()), manilaDay(serverNow()));
  } catch {
    return false;
  }
}

// ─── Server clock ────────────────────────────────────────────────────────────
// The day written with an accept must be the server's Manila day. A phone whose clock is
// off would write the wrong day near midnight (or all day, if its date is wrong), so the
// app estimates the server clock from a write it just made.

/** Rounds trips longer than this give too rough an estimate and are ignored. */
const MAX_CALIBRATION_ROUND_TRIP_MS = 10_000;

let serverOffsetMs = 0;

/** The server's current time as estimated on this phone (the phone's time until calibrated). */
export function serverNow(): number {
  return estimateServerNow(Date.now(), serverOffsetMs);
}

/**
 * Estimates the server clock from a write to drivers/{driverId} that set
 * `updatedAt: serverTimestamp()`, sent at `sentAtMs` and confirmed at `confirmedAtMs`
 * (phone times). Reads the stored updatedAt from the server; failures keep the last
 * estimate. Used after going online.
 */
export async function calibrateServerClock(
  driverId: string,
  sentAtMs: number,
  confirmedAtMs: number,
): Promise<void> {
  if (confirmedAtMs - sentAtMs > MAX_CALIBRATION_ROUND_TRIP_MS) return;
  try {
    const snapshot = await getDocFromServer(doc(firestore, COLLECTIONS.drivers, driverId));
    const updatedAt: unknown = snapshot.data()?.updatedAt;
    if (updatedAt instanceof Timestamp) {
      serverOffsetMs = clockOffsetMs(updatedAt.toMillis(), sentAtMs, confirmedAtMs);
    }
  } catch {
    // Keep the last estimate.
  }
}

// ─── Writing the day ─────────────────────────────────────────────────────────

function isPermissionDenied(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'permission-denied';
}

/**
 * Runs a write that carries today's Manila day (accept, claim). If the rules refuse it
 * near midnight, the server may be on the other side of midnight from this phone, so it
 * is tried once more with the neighbouring day. Any other failure is passed on.
 */
export async function withMidnightRetry(attempt: (day: number) => Promise<void>): Promise<void> {
  const now = serverNow();
  try {
    await attempt(manilaDay(now));
  } catch (error) {
    const otherDay = alternateDayNearMidnight(now);
    if (otherDay === null || !isPermissionDenied(error)) throw error;
    await attempt(otherDay);
  }
}
