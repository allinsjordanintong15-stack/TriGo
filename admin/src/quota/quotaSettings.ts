import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';

import { db } from '../firebase/config';
import { DEFAULT_DAILY_LIMIT, manilaDay, readSavedLimit } from './quota';

// quotaSettings/active: { dailyLimit, updatedAt, updatedBy }, written here (Quota page) and
// read live by the app. firestore.rules accepts only the complete object with a whole
// number 1-100. While it is missing, the app and the rules use DEFAULT_DAILY_LIMIT.
const QUOTA_DOC = doc(db, 'quotaSettings', 'active');

export type LoadedQuota = {
  /** The limit in force: the saved one, or the default. */
  limit: number;
  /** Exactly what is saved, or null when nothing is (the default applies). */
  saved: number | null;
  updatedAt: Date | null;
};

/** Live quota settings, so the page always shows the limit drivers see. */
export function subscribeToQuota(
  onUpdate: (quota: LoadedQuota) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    QUOTA_DOC,
    (snapshot) => {
      const data = snapshot.data();
      const saved = readSavedLimit(data);
      onUpdate({
        limit: saved ?? DEFAULT_DAILY_LIMIT,
        saved,
        updatedAt: data?.updatedAt?.toDate?.() ?? null,
      });
    },
    (error) => onError(error),
  );
}

export class StaleQuotaError extends Error {
  constructor() {
    super('The daily limit was changed by someone else. Check the new value and try again.');
  }
}

/**
 * Saves the daily limit. Fails with StaleQuotaError when the saved value is no longer the
 * one the admin confirmed against (`expectedSaved`, null when nothing was saved).
 */
export async function saveDailyLimit(dailyLimit: number, expectedSaved: number | null, uid: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(QUOTA_DOC);
    if (readSavedLimit(snapshot.data()) !== expectedSaved) throw new StaleQuotaError();
    transaction.set(QUOTA_DOC, { dailyLimit, updatedAt: serverTimestamp(), updatedBy: uid });
  });
}

/** Every driver record, live (the Quota page table). */
export function subscribeToDrivers(
  onUpdate: (drivers: { uid: string; data: Record<string, unknown> }[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, 'drivers'),
    (snapshot) => onUpdate(snapshot.docs.map((d) => ({ uid: d.id, data: d.data() }))),
    (error) => onError(error),
  );
}

/**
 * Verified drivers whose count today (Manila) is at or above the limit (Dashboard), the
 * same drivers the Quota page lists as "At limit". Index: drivers (isVerified,
 * acceptedDay, acceptedCount) in firestore.indexes.json.
 */
export async function countDriversAtLimit(now = Date.now()): Promise<number> {
  const limit = readSavedLimit((await getDoc(QUOTA_DOC)).data()) ?? DEFAULT_DAILY_LIMIT;
  const snapshot = await getCountFromServer(
    query(
      collection(db, 'drivers'),
      where('isVerified', '==', true),
      where('acceptedDay', '==', manilaDay(now)),
      where('acceptedCount', '>=', limit),
    ),
  );
  return snapshot.data().count;
}
