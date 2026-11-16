import { collection, getDocs, query, where, type DocumentData, type Timestamp } from 'firebase/firestore';

import { db } from '../firebase/config';
import { ADMIN_MESSAGE_KINDS, type AdminMessageKind } from './driverActionPlan';

// adminMessages/{id}: messages from TriGo to one user (driverActionPlan.ts has the payloads).
// The driver detail page shows them as the suspension and verification history; account
// deletion clears their reason and body. Equality filter only, so no composite index.

export type AdminMessage = {
  messageId: string;
  userId: string;
  /** null for a kind this website does not know (added later). */
  kind: AdminMessageKind | null;
  title: string;
  /** Empty once cleared on account deletion. */
  reason: string;
  until: Date | null;
  createdBy: string;
  createdAt: Date | null;
  readAt: Date | null;
};

function toDate(value: unknown): Date | null {
  return (value as Timestamp | undefined)?.toDate?.() ?? null;
}

export function readAdminMessage(messageId: string, data: DocumentData): AdminMessage {
  return {
    messageId,
    userId: typeof data.userId === 'string' ? data.userId : '',
    kind: ADMIN_MESSAGE_KINDS.includes(data.kind) ? (data.kind as AdminMessageKind) : null,
    title: typeof data.title === 'string' ? data.title : '',
    reason: typeof data.reason === 'string' ? data.reason : '',
    until: toDate(data.until),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    createdAt: toDate(data.createdAt),
    readAt: toDate(data.readAt),
  };
}

/** One user's messages, newest first. */
export async function loadAdminMessagesFor(uid: string): Promise<AdminMessage[]> {
  const snapshot = await getDocs(query(collection(db, 'adminMessages'), where('userId', '==', uid)));
  return snapshot.docs
    .map((d) => readAdminMessage(d.id, d.data()))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

/** IDs of the user's messages that still have a reason or body, for the account-deletion commit. */
export async function adminMessageIdsWithText(uid: string): Promise<string[]> {
  const snapshot = await getDocs(query(collection(db, 'adminMessages'), where('userId', '==', uid)));
  return snapshot.docs.filter((d) => d.data().reason !== '' || d.data().body !== '').map((d) => d.id);
}
