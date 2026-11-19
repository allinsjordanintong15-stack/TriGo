import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';

import { db } from '../firebase/config';
import {
  endOfManilaDayMillis,
  newAnnouncementDoc,
  withdrawnAnnouncementUpdate,
  type AnnouncementAudience,
  type AnnouncementDraft,
} from './announcementPlan';

// announcements/{id} (firestore.rules, Announcements): admins create and withdraw; the app
// shows active ones in each user's inbox (audience all / passengers / drivers).

export type Announcement = {
  announcementId: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  showUntil: Date | null;
  status: 'active' | 'withdrawn';
  createdBy: string;
  createdAt: Date | null;
  withdrawnAt: Date | null;
};

function toDate(value: unknown): Date | null {
  return (value as Timestamp | undefined)?.toDate?.() ?? null;
}

function readAnnouncement(id: string, data: DocumentData): Announcement {
  const audience = data.audience === 'passengers' || data.audience === 'drivers' ? data.audience : 'all';
  return {
    announcementId: id,
    title: typeof data.title === 'string' ? data.title : '',
    body: typeof data.body === 'string' ? data.body : '',
    audience,
    showUntil: toDate(data.showUntil),
    status: data.status === 'withdrawn' ? 'withdrawn' : 'active',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    createdAt: toDate(data.createdAt),
    withdrawnAt: toDate(data.withdrawnAt),
  };
}

/** Every announcement, newest first (single-field index on createdAt). */
export async function loadAnnouncements(): Promise<Announcement[]> {
  const snapshot = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((d) => readAnnouncement(d.id, d.data()));
}

export async function sendAnnouncement(draft: AnnouncementDraft, adminUid: string): Promise<void> {
  const endMillis = draft.showUntilDate ? endOfManilaDayMillis(draft.showUntilDate) : null;
  const showUntil = endMillis === null ? null : Timestamp.fromMillis(endMillis);
  await addDoc(collection(db, 'announcements'), newAnnouncementDoc(draft, showUntil, adminUid, serverTimestamp()));
}

export class AnnouncementConflictError extends Error {}

/** Withdraws an active announcement (re-read first, so a second admin's withdraw is reported). */
export async function withdrawAnnouncement(announcementId: string, adminUid: string): Promise<void> {
  const ref = doc(db, 'announcements', announcementId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists() || snap.data().status !== 'active') {
      throw new AnnouncementConflictError('This announcement was already withdrawn. Reload the page to see the latest.');
    }
    transaction.update(ref, withdrawnAnnouncementUpdate(adminUid, serverTimestamp()));
  });
}
