import { COLLECTIONS, firestore } from '@/firebase';
import { AppNotification } from '@/types';
import {
  collection,
  doc,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

function timestampToDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return value.toDate();
}

function docToNotification(id: string, data: Record<string, unknown>): AppNotification {
  return {
    notificationId: id,
    userId: data.userId as string,
    bookingId: (data.bookingId as string | null) ?? null,
    type: data.type as AppNotification['type'],
    title: data.title as string,
    body: data.body as string,
    read: Boolean(data.read),
    createdAt: timestampToDate(data.createdAt as Timestamp) ?? new Date(),
  };
}

export function subscribeToNotifications(
  userId: string,
  onUpdate: (notifications: AppNotification[]) => void,
  onError: (error: Error) => void,
): () => void {
  const q = query(
    collection(firestore, COLLECTIONS.notifications),
    where('userId', '==', userId),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => docToNotification(d.id, d.data()))
        .sort((a, b) => (b.createdAt.getTime() - a.createdAt.getTime()));
      onUpdate(items);
    },
    (error) => onError(error as Error),
  );
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(firestore, COLLECTIONS.notifications, notificationId), {
    read: true,
  });
}
