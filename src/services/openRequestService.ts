import { COLLECTIONS, firestore } from '@/firebase';
import { doc, getDoc, serverTimestamp, Timestamp, WriteBatch } from 'firebase/firestore';

// passengerOpenRequest/{uid} = { kind: 'booking' | 'out_of_area', id, updatedAt }: points at
// the passenger's newest standard booking or out-of-area request. firestore.rules lets a
// passenger create a new one only in the same batch that moves this pointer to it, and only
// while the one it points at is no longer open (a pending booking or a searching /
// negotiating request that has not expired). Nothing clears it: cancelling, accepting and
// expiry close the target, which frees the pointer (security batch A, SEC-03).

export type OpenRequestKind = 'booking' | 'out_of_area';

export const OPEN_REQUEST_EXISTS_MESSAGE =
  'You already have a pending request. Cancel it or wait for it to end before booking another ride.';

function lockRef(passengerId: string) {
  return doc(firestore, COLLECTIONS.passengerOpenRequest, passengerId);
}

function isFuture(value: unknown): boolean {
  return value instanceof Timestamp && value.toMillis() > Date.now();
}

/**
 * The passenger's request that is still open, or null. A failed read counts as none: the
 * rules still refuse a second open request, this only gives the clear message first.
 */
export async function findOpenRequest(passengerId: string): Promise<{ kind: OpenRequestKind; id: string } | null> {
  try {
    const lock = await getDoc(lockRef(passengerId));
    if (!lock.exists()) return null;
    const { kind, id } = lock.data() as { kind?: unknown; id?: unknown };
    if ((kind !== 'booking' && kind !== 'out_of_area') || typeof id !== 'string') return null;
    const target = await getDoc(
      doc(firestore, kind === 'booking' ? COLLECTIONS.bookings : COLLECTIONS.outOfAreaRequests, id),
    );
    if (!target.exists()) return null;
    const data = target.data();
    const open =
      kind === 'booking'
        ? data.status === 'pending' && isFuture(data.expiresAt)
        : ['searching', 'driver_interested', 'negotiating'].includes(data.status) && isFuture(data.expiresAt);
    return open ? { kind, id } : null;
  } catch {
    return null;
  }
}

/** Moves the pointer to the booking or request created in the same batch. */
export function addOpenRequestToBatch(
  batch: WriteBatch,
  passengerId: string,
  kind: OpenRequestKind,
  id: string,
): void {
  batch.set(lockRef(passengerId), { kind, id, updatedAt: serverTimestamp() });
}
