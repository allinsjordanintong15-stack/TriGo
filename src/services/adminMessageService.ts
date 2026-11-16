import { COLLECTIONS, firestore } from '@/firebase';
import { InboxMessage, readMessageKind } from '@/utils/inbox';
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

// adminMessages/{messageId}: messages from TriGo, created by an admin (firestore.rules, Admin
// messages): suspension and verification notices today. The user reads their own and sets
// readAt once; nothing else.

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function docToMessage(id: string, data: DocumentData): InboxMessage {
  return {
    messageId: id,
    userId: text(data.userId),
    kind: readMessageKind(data.kind),
    title: text(data.title),
    body: text(data.body),
    reason: text(data.reason),
    until: toDate(data.until),
    createdAt: toDate(data.createdAt),
    readAt: toDate(data.readAt),
  };
}

/** The user's messages, live. Equality filter only: no composite index. */
export function subscribeToAdminMessages(
  userId: string,
  onUpdate: (messages: InboxMessage[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(firestore, COLLECTIONS.adminMessages), where('userId', '==', userId)),
    (snapshot) =>
      onUpdate(snapshot.docs.map((d) => docToMessage(d.id, d.data({ serverTimestamps: 'estimate' })))),
    (error) => onError(error as Error),
  );
}

/** Marks the message read: the only field the user may write, once. */
export async function markAdminMessageRead(messageId: string): Promise<void> {
  await updateDoc(doc(firestore, COLLECTIONS.adminMessages, messageId), {
    readAt: serverTimestamp(),
  });
}
