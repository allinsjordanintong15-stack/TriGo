// Account deletion requests (deletionRequests/{uid}, see firestore.rules). The user asks
// (status pending, optional reason) and may withdraw while pending; the TriGo team
// completes it on the admin website in the same commit that anonymizes the account.

import { getCommissionAccount } from '@/services/commissionService';
import { COLLECTIONS, firestore } from '@/firebase';
import { DeletionRequest, DriverRecord } from '@/types';
import { ACTIVE_TRIP_STATUSES, DeletionContext, normalizeDeletionReason } from '@/utils/accountDeletion';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';

export class DeletionRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeletionRequestError';
  }
}

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

/** Live view of the user's own request; emits null when there is none. */
export function subscribeToDeletionRequest(
  uid: string,
  onUpdate: (request: DeletionRequest | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(firestore, COLLECTIONS.deletionRequests, uid),
    (snapshot) => {
      // 'estimate': the just-written requestedAt shows at once instead of null.
      const data = snapshot.data({ serverTimestamps: 'estimate' });
      if (!data) {
        onUpdate(null);
        return;
      }
      onUpdate({
        status: data.status === 'completed' ? 'completed' : 'pending',
        requestedAt: toDate(data.requestedAt) ?? new Date(),
        reason: typeof data.reason === 'string' ? data.reason : null,
        completedAt: toDate(data.completedAt),
      });
    },
    (error) => onError(error as Error),
  );
}

/** Ask for deletion. The rules allow only uid, status 'pending', requestedAt (now) and reason. */
export async function requestAccountDeletion(uid: string, reasonText: string): Promise<void> {
  const { reason, error } = normalizeDeletionReason(reasonText);
  if (error) throw new DeletionRequestError(error);

  try {
    await setDoc(doc(firestore, COLLECTIONS.deletionRequests, uid), {
      uid,
      status: 'pending',
      requestedAt: serverTimestamp(),
      ...(reason ? { reason } : {}),
    });
  } catch {
    throw new DeletionRequestError(
      'Unable to send your request. Please check your internet connection and try again.',
    );
  }
}

/** Withdraw a pending request (the rules refuse it once completed). */
export async function withdrawDeletionRequest(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(firestore, COLLECTIONS.deletionRequests, uid));
  } catch {
    throw new DeletionRequestError(
      'Unable to withdraw your request. Please check your internet connection and try again.',
    );
  }
}

/**
 * What is still open on the account: an active trip (as passenger or driver), a held
 * out-of-area request, unpaid commission. The driver record comes from AuthProvider (live).
 */
export async function loadDeletionContext(
  uid: string,
  driverRecord: DriverRecord | null,
): Promise<DeletionContext> {
  const activeStatuses: readonly string[] = ACTIVE_TRIP_STATUSES;
  const [bookings, account] = await Promise.all([
    // Same query as Activity (passengerId only); statuses are checked here.
    getDocs(query(collection(firestore, COLLECTIONS.bookings), where('passengerId', '==', uid))),
    driverRecord ? getCommissionAccount(uid) : Promise.resolve(null),
  ]);

  return {
    passengerTripActive: bookings.docs.some((d) => activeStatuses.includes(d.data().status)),
    driverOnTrip: Boolean(driverRecord?.currentBookingId),
    driverHoldsRequest: Boolean(driverRecord?.currentRequestId),
    unpaidCommissionCentavos: account
      ? Math.max(0, account.accruedCentavos - account.paidCentavos)
      : 0,
  };
}
