import { COLLECTIONS, firestore } from '@/firebase';
import {
  AnnouncementAudience,
  AnnouncementReadState,
  EMPTY_ANNOUNCEMENT_READ_STATE,
  InboxAnnouncement,
  readAnnouncementAudience,
} from '@/utils/inbox';
import {
  collection,
  doc,
  DocumentData,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  WriteBatch,
} from 'firebase/firestore';

// announcements/{id}: one document per announcement, written by an admin (Admin Website →
// Announcements). Signed-in users read the active ones of their audience (firestore.rules,
// Announcements). What the user has read lives in users/{uid}/inboxState/announcements
// ({ lastReadAllAt, readIds, updatedAt }), written only by that user.

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function docToAnnouncement(id: string, data: DocumentData): InboxAnnouncement | null {
  const audience = readAnnouncementAudience(data.audience);
  if (!audience) return null;
  return {
    announcementId: id,
    title: text(data.title),
    body: text(data.body),
    audience,
    showUntil: toDate(data.showUntil),
    createdAt: toDate(data.createdAt),
  };
}

/** The audiences a user belongs to: everyone, passengers (passenger accounts), drivers (driver role). */
export function audiencesFor(isPassengerAccount: boolean, hasDriverRole: boolean): AnnouncementAudience[] {
  const audiences: AnnouncementAudience[] = ['all'];
  if (isPassengerAccount) audiences.push('passengers');
  if (hasDriverRole) audiences.push('drivers');
  return audiences;
}

/**
 * Active announcements for these audiences, live. One equality query per audience (the
 * rules check each audience on its own, and equality filters need no composite index).
 */
export function subscribeToAnnouncements(
  audiences: readonly AnnouncementAudience[],
  onUpdate: (announcements: InboxAnnouncement[]) => void,
  onError: (error: Error) => void,
): () => void {
  const byAudience = new Map<AnnouncementAudience, InboxAnnouncement[]>();
  const emit = () => {
    if (byAudience.size < audiences.length) return;
    onUpdate([...byAudience.values()].flat());
  };
  const stops = audiences.map((audience) =>
    onSnapshot(
      query(
        collection(firestore, COLLECTIONS.announcements),
        where('audience', '==', audience),
        where('status', '==', 'active'),
      ),
      (snapshot) => {
        byAudience.set(
          audience,
          snapshot.docs
            .map((d) => docToAnnouncement(d.id, d.data({ serverTimestamps: 'estimate' })))
            .filter((a): a is InboxAnnouncement => a !== null),
        );
        emit();
      },
      (error) => onError(error as Error),
    ),
  );
  return () => stops.forEach((stop) => stop());
}

function readStateRef(userId: string) {
  return doc(firestore, COLLECTIONS.users, userId, 'inboxState', 'announcements');
}

/** The user's announcement read state, live; empty when the document does not exist yet. */
export function subscribeToAnnouncementReadState(
  userId: string,
  onUpdate: (state: AnnouncementReadState) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    readStateRef(userId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(EMPTY_ANNOUNCEMENT_READ_STATE);
        return;
      }
      const data = snapshot.data({ serverTimestamps: 'estimate' });
      onUpdate({
        lastReadAllAt: toDate(data.lastReadAllAt),
        readIds: Array.isArray(data.readIds) ? data.readIds.filter((id): id is string => typeof id === 'string') : [],
      });
    },
    (error) => onError(error as Error),
  );
}

/** At most this many IDs are stored (firestore.rules allows 200); only announcements still shown are kept. */
const MAX_READ_IDS = 200;

/**
 * Marks one announcement read. `shownIds` are the announcements currently in the inbox: the
 * stored list keeps only those, so it never grows past what is on screen.
 */
export async function markAnnouncementRead(
  userId: string,
  announcementId: string,
  current: AnnouncementReadState,
  shownIds: readonly string[],
): Promise<void> {
  const kept = current.readIds.filter((id) => shownIds.includes(id) && id !== announcementId);
  const readIds = [...kept, announcementId].slice(-MAX_READ_IDS);
  // Merge: lastReadAllAt stays as stored (the rules allow it unchanged or set to now).
  await setDoc(readStateRef(userId), { readIds, updatedAt: serverTimestamp() }, { merge: true });
}

/** "Mark all as read" for announcements, in the caller's batch: everything up to now is read. */
export function addMarkAllAnnouncementsReadToBatch(batch: WriteBatch, userId: string): void {
  batch.set(readStateRef(userId), { lastReadAllAt: serverTimestamp(), readIds: [], updatedAt: serverTimestamp() });
}
