import { COLLECTIONS, firestore } from '@/firebase';
import { InboxWarning } from '@/utils/inbox';
import {
  collection,
  doc,
  DocumentData,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

// warnings/{warningId}, created by an admin (firestore.rules, Warnings). The warned user
// reads their own and sets acknowledgedAt once ("I understand"); nothing else.

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

export function docToWarning(id: string, data: DocumentData): InboxWarning {
  return {
    warningId: id,
    userId: typeof data.userId === 'string' ? data.userId : '',
    role: data.role === 'driver' || data.role === 'passenger' ? data.role : null,
    complaintId: text(data.complaintId),
    bookingId: text(data.bookingId),
    reason: typeof data.reason === 'string' ? data.reason : '',
    createdAt: toDate(data.createdAt),
    status: data.status === 'withdrawn' ? 'withdrawn' : 'active',
    acknowledgedAt: toDate(data.acknowledgedAt),
  };
}

/** The user's warnings (any status), live. Equality filter only: no composite index. */
export function subscribeToWarnings(
  userId: string,
  onUpdate: (warnings: InboxWarning[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(firestore, COLLECTIONS.warnings), where('userId', '==', userId)),
    (snapshot) =>
      onUpdate(snapshot.docs.map((d) => docToWarning(d.id, d.data({ serverTimestamps: 'estimate' })))),
    (error) => onError(error as Error),
  );
}

/** "I understand": the only field the user may write, once. */
export async function acknowledgeWarning(warningId: string): Promise<void> {
  await updateDoc(doc(firestore, COLLECTIONS.warnings, warningId), {
    acknowledgedAt: serverTimestamp(),
  });
}
