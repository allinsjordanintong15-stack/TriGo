import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';

import { db } from '../firebase/config';
import {
  newWarningDoc,
  validateWarningReason,
  withdrawnWarningUpdate,
  type NewWarningInput,
  type WarningRole,
  type WarningStatus,
} from './warningPlan';

// warnings/{warningId}: see warningPlan.ts for the exact field values (shared with the
// Firestore rules tests). Equality filters only, so no composite index is needed.

export type AdminWarning = {
  warningId: string;
  userId: string;
  role: WarningRole | null;
  complaintId: string | null;
  bookingId: string | null;
  /** Empty once cleared on account deletion. */
  reason: string;
  adminId: string;
  createdAt: Date | null;
  status: WarningStatus;
  acknowledgedAt: Date | null;
  withdrawnAt: Date | null;
};

/** The write was refused because the data changed; the message says what to do. */
export class WarningConflictError extends Error {}

function toDate(value: unknown): Date | null {
  return (value as Timestamp | undefined)?.toDate?.() ?? null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

export function readWarning(warningId: string, data: DocumentData): AdminWarning {
  return {
    warningId,
    userId: typeof data.userId === 'string' ? data.userId : '',
    role: data.role === 'driver' || data.role === 'passenger' ? data.role : null,
    complaintId: text(data.complaintId),
    bookingId: text(data.bookingId),
    reason: typeof data.reason === 'string' ? data.reason : '',
    adminId: typeof data.adminId === 'string' ? data.adminId : '',
    createdAt: toDate(data.createdAt),
    status: data.status === 'withdrawn' ? 'withdrawn' : 'active',
    acknowledgedAt: toDate(data.acknowledgedAt),
    withdrawnAt: toDate(data.withdrawnAt),
  };
}

/** The warning tied to a complaint (its ID is the complaint's ID), or null. */
export async function loadComplaintWarning(complaintId: string): Promise<AdminWarning | null> {
  const snap = await getDoc(doc(db, 'warnings', complaintId));
  return snap.exists() ? readWarning(snap.id, snap.data()) : null;
}

/** One person's warnings in one role, newest first. */
export async function loadWarningsFor(uid: string, role: WarningRole): Promise<AdminWarning[]> {
  const snapshot = await getDocs(
    query(collection(db, 'warnings'), where('userId', '==', uid), where('role', '==', role)),
  );
  return snapshot.docs
    .map((d) => readWarning(d.id, d.data()))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

/**
 * Warns the reported person of a complaint. The transaction checks no warning exists for it
 * yet (the rules refuse a second one too: the ID is the complaint's ID).
 */
export async function warnFromComplaint(
  input: NewWarningInput & { complaintId: string },
  adminUid: string,
): Promise<void> {
  const error = validateWarningReason(input.reason);
  if (error) throw new WarningConflictError(error);
  const ref = doc(db, 'warnings', input.complaintId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (snap.exists()) {
      throw new WarningConflictError('This complaint already has a warning. Reload the page to see it.');
    }
    transaction.set(ref, newWarningDoc(input, adminUid, serverTimestamp()));
  });
}

/**
 * A warning not tied to a complaint (Drivers → All drivers "Send warning"): complaintId and
 * bookingId null, a new random ID. It reaches the user's inbox like any warning.
 */
export async function sendWarning(
  input: { userId: string; role: WarningRole; reason: string },
  adminUid: string,
): Promise<void> {
  const error = validateWarningReason(input.reason);
  if (error) throw new WarningConflictError(error);
  await setDoc(
    doc(collection(db, 'warnings')),
    newWarningDoc({ ...input, complaintId: null, bookingId: null }, adminUid, serverTimestamp()),
  );
}

/** Withdraws an active warning (the only change admins may make). */
export async function withdrawWarning(warningId: string, adminUid: string): Promise<void> {
  const ref = doc(db, 'warnings', warningId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists() || snap.data().status !== 'active') {
      throw new WarningConflictError('This warning is no longer active. Reload the page to see the latest.');
    }
    transaction.update(ref, withdrawnWarningUpdate(serverTimestamp(), adminUid));
  });
}

/** IDs of the user's warnings that still have a reason, for the account-deletion commit. */
export async function warningIdsWithReason(uid: string): Promise<string[]> {
  const snapshot = await getDocs(query(collection(db, 'warnings'), where('userId', '==', uid)));
  return snapshot.docs.filter((d) => d.data().reason !== '').map((d) => d.id);
}
