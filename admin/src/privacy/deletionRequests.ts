import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';

import { readAccount } from '../earnings/earnings';
import { db } from '../firebase/config';
import {
  ACTIVE_TRIP_STATUSES,
  anonymizedApplicationUpdate,
  anonymizedDriverUpdate,
  anonymizedUserUpdate,
  authDeletedUpdate,
  completedRequestUpdate,
  declinedRequestUpdate,
  validateDeclineNote,
  type OpenItems,
} from './deletionPlan';

// deletionRequests/{uid}, written by the user in the app (pending, optional reason). Admins
// complete a request in the commit that anonymizes the account, decline it with a note, and
// record when the sign-in account was deleted in the Firebase Console. See deletionPlan.ts
// for the exact field values (shared with the Firestore rules tests).

export const DELETION_STATUSES = ['pending', 'completed', 'declined'] as const;
export type DeletionStatus = (typeof DELETION_STATUSES)[number];

export const DELETION_STATUS_LABELS: Record<DeletionStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  declined: 'Declined',
};

export type DeletionRequest = {
  uid: string;
  status: DeletionStatus;
  requestedAt: Date | null;
  reason: string | null;
  completedAt: Date | null;
  authDeletedAt: Date | null;
  declineNote: string | null;
  declinedAt: Date | null;
};

/** The account behind a request, from users/{uid} (blank once anonymized). */
export type DeletionAccount = {
  fullName: string;
  email: string;
  mobileNumber: string;
  role: string | null;
  anonymized: boolean;
};

export type DeletionListEntry = { request: DeletionRequest; account: DeletionAccount | null };

export type DeletionDetail = {
  request: DeletionRequest;
  account: DeletionAccount | null;
  hasDriverRecord: boolean;
  hasApplication: boolean;
  openItems: OpenItems;
};

/** The write was refused because the data changed; the message says what to do. */
export class DeletionConflictError extends Error {}

function toDate(value: unknown): Date | null {
  return (value as Timestamp | undefined)?.toDate?.() ?? null;
}

function readRequest(uid: string, data: DocumentData): DeletionRequest {
  const status = DELETION_STATUSES.includes(data.status) ? (data.status as DeletionStatus) : 'pending';
  return {
    uid,
    status,
    requestedAt: toDate(data.requestedAt),
    reason: typeof data.reason === 'string' && data.reason ? data.reason : null,
    completedAt: toDate(data.completedAt),
    authDeletedAt: toDate(data.authDeletedAt),
    declineNote: typeof data.declineNote === 'string' ? data.declineNote : null,
    declinedAt: toDate(data.declinedAt),
  };
}

function readAccountOf(data: DocumentData | undefined): DeletionAccount | null {
  if (!data) return null;
  return {
    fullName: typeof data.fullName === 'string' ? data.fullName : '',
    email: typeof data.email === 'string' ? data.email : '',
    mobileNumber: typeof data.mobileNumber === 'string' ? data.mobileNumber : '',
    role: typeof data.role === 'string' ? data.role : null,
    anonymized: data.anonymizedAt != null,
  };
}

/** Requests with the given status, oldest first, each with its account. */
export async function loadDeletionRequests(status: DeletionStatus): Promise<DeletionListEntry[]> {
  const snapshot = await getDocs(query(collection(db, 'deletionRequests'), where('status', '==', status)));
  const requests = snapshot.docs
    .map((d) => readRequest(d.id, d.data()))
    .sort((a, b) => (a.requestedAt?.getTime() ?? 0) - (b.requestedAt?.getTime() ?? 0));
  const accounts = await Promise.all(
    requests.map((request) => getDoc(doc(db, 'users', request.uid)).then((snap) => readAccountOf(snap.data()))),
  );
  return requests.map((request, index) => ({ request, account: accounts[index] }));
}

/** One request with its account and what is still open on it; null when it does not exist. */
export async function loadDeletionDetail(uid: string): Promise<DeletionDetail | null> {
  const requestSnap = await getDoc(doc(db, 'deletionRequests', uid));
  if (!requestSnap.exists()) return null;

  const [userSnap, driverSnap, applicationSnap, accountSnap, bookingsSnap] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDoc(doc(db, 'drivers', uid)),
    getDoc(doc(db, 'driverApplications', uid)),
    getDoc(doc(db, 'commissionAccounts', uid)).catch(() => null),
    getDocs(query(collection(db, 'bookings'), where('passengerId', '==', uid))),
  ]);

  const activeStatuses: readonly string[] = ACTIVE_TRIP_STATUSES;
  const driver = driverSnap.data();
  let unpaidCentavos: number | null = 0;
  if (accountSnap === null) {
    unpaidCentavos = null;
  } else if (accountSnap.exists()) {
    const account = readAccount(accountSnap.data());
    unpaidCentavos = account ? Math.max(0, account.accruedCentavos - account.paidCentavos) : null;
  }

  return {
    request: readRequest(uid, requestSnap.data()),
    account: readAccountOf(userSnap.data()),
    hasDriverRecord: driverSnap.exists(),
    hasApplication: applicationSnap.exists(),
    openItems: {
      passengerActiveTrips: bookingsSnap.docs.filter((d) => activeStatuses.includes(d.data().status)).length,
      driverOnTrip: Boolean(driver?.currentBookingId),
      driverHoldsRequest: Boolean(driver?.currentRequestId),
      unpaidCentavos,
    },
  };
}

/**
 * Anonymizes the account and completes the request in one commit. Re-reads everything in
 * the transaction, so a trip or request taken meanwhile stops it with a clear message.
 */
export async function anonymizeAndComplete(uid: string, adminUid: string): Promise<void> {
  const requestRef = doc(db, 'deletionRequests', uid);
  const userRef = doc(db, 'users', uid);
  const driverRef = doc(db, 'drivers', uid);
  const applicationRef = doc(db, 'driverApplications', uid);

  await runTransaction(db, async (transaction) => {
    const [requestSnap, userSnap, driverSnap, applicationSnap] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(userRef),
      transaction.get(driverRef),
      transaction.get(applicationRef),
    ]);
    if (!requestSnap.exists() || requestSnap.data().status !== 'pending') {
      throw new DeletionConflictError('This request is no longer pending. Reload the page to see the latest.');
    }
    if (!userSnap.exists()) {
      throw new DeletionConflictError('This account has no profile. Check it in the Firebase Console.');
    }
    if (userSnap.data().anonymizedAt != null) {
      throw new DeletionConflictError('This account is already anonymized.');
    }
    const driver = driverSnap.data();
    if (driver?.currentBookingId || driver?.currentRequestId) {
      throw new DeletionConflictError(
        'The driver has just taken a trip or an out-of-area request. Wait until it ends, then try again.',
      );
    }

    const now = serverTimestamp();
    transaction.update(userRef, anonymizedUserUpdate(now));
    transaction.delete(doc(db, 'contacts', uid));
    if (driverSnap.exists() && driver?.anonymizedAt == null) {
      transaction.update(driverRef, anonymizedDriverUpdate(now, adminUid));
    }
    if (applicationSnap.exists() && applicationSnap.data().anonymizedAt == null) {
      transaction.update(applicationRef, anonymizedApplicationUpdate(now));
    }
    transaction.update(requestRef, completedRequestUpdate(now, adminUid));
  });
}

/** Declines a pending request with a note the user reads in the app. */
export async function declineDeletionRequest(uid: string, adminUid: string, note: string): Promise<void> {
  const error = validateDeclineNote(note);
  if (error) throw new DeletionConflictError(error);
  const requestRef = doc(db, 'deletionRequests', uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(requestRef);
    if (!snap.exists() || snap.data().status !== 'pending') {
      throw new DeletionConflictError('This request is no longer pending. Reload the page to see the latest.');
    }
    transaction.update(requestRef, declinedRequestUpdate(note, serverTimestamp(), adminUid));
  });
}

/** Records that the sign-in account was deleted in the Firebase Console. */
export async function markAuthDeleted(uid: string, adminUid: string): Promise<void> {
  await updateDoc(doc(db, 'deletionRequests', uid), authDeletedUpdate(serverTimestamp(), adminUid));
}
