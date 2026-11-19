import { firestore } from '@/firebase';
import { useAuth } from '@/hooks/useAuth';
import { addMarkMessagesReadToBatch, subscribeToAdminMessages } from '@/services/adminMessageService';
import {
  addMarkAllAnnouncementsReadToBatch,
  audiencesFor,
  subscribeToAnnouncementReadState,
  subscribeToAnnouncements,
} from '@/services/announcementService';
import { subscribeToWarnings } from '@/services/warningService';
import {
  AnnouncementReadState,
  buildInbox,
  InboxAnnouncement,
  InboxItem,
  InboxMessage,
  InboxWarning,
  unreadCount,
} from '@/utils/inbox';
import { writeBatch } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface InboxState {
  /** Null while loading. */
  items: InboxItem[] | null;
  /** Every warning of the user, withdrawn included (detail screen lookups). */
  warnings: InboxWarning[] | null;
  /** Every message from TriGo of the user (detail screen lookups). */
  messages: InboxMessage[] | null;
  /** Active announcements of the user's audiences (detail screen lookups). */
  announcements: InboxAnnouncement[] | null;
  announcementRead: AnnouncementReadState | null;
  error: string | null;
  unread: number;
  /** Subscribes again after an error (a failed listener stops). */
  retry: () => void;
  /**
   * Marks every unread message and announcement read in one commit. Warnings stay unread
   * until the user confirms each one ("I understand").
   */
  markAllRead: () => Promise<void>;
}

const LOAD_ERROR = 'Could not load your messages. Check your connection and try again.';

type Loaded = {
  key: string;
  warnings: InboxWarning[] | null;
  messages: InboxMessage[] | null;
  announcements: InboxAnnouncement[] | null;
  announcementRead: AnnouncementReadState | null;
  error: string | null;
};

const EMPTY = { warnings: null, messages: null, announcements: null, announcementRead: null, error: null };

/**
 * The signed-in user's inbox (warnings, messages from TriGo and announcements), live.
 * Several screens may use it at once; Firestore shares one listener for the same query.
 */
export function useInbox(): InboxState {
  const { profile, role, hasDriverRole } = useAuth();
  const uid = profile?.uid ?? null;
  const audiences = useMemo(() => audiencesFor(role === 'passenger', hasDriverRole), [role, hasDriverRole]);
  // A change of audience (e.g. an application approved) subscribes again.
  const key = uid ? `${uid}|${audiences.join(',')}` : null;
  const [state, setState] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid || !key) return;
    const update = (change: Partial<Loaded>) =>
      setState((previous) => ({
        ...(previous && previous.key === key ? previous : { key, ...EMPTY }),
        ...change,
      }));
    const fail = () => update({ error: LOAD_ERROR });
    const stops = [
      subscribeToWarnings(uid, (warnings) => update({ warnings }), fail),
      subscribeToAdminMessages(uid, (messages) => update({ messages }), fail),
      // Announcements never block personal messages: a failed read shows none.
      subscribeToAnnouncements(
        audiences,
        (announcements) => update({ announcements }),
        () => update({ announcements: [] }),
      ),
      subscribeToAnnouncementReadState(
        uid,
        (announcementRead) => update({ announcementRead }),
        () => update({ announcementRead: { lastReadAllAt: null, readIds: [] } }),
      ),
    ];
    return () => stops.forEach((stop) => stop());
    // uid and audiences are both part of key.
  }, [key, attempt]);

  const current = state && state.key === key ? state : null;
  const error = current?.error ?? null;
  const warnings = current?.warnings ?? null;
  const messages = current?.messages ?? null;
  const announcements = current?.announcements ?? null;
  const announcementRead = current?.announcementRead ?? null;
  // Everything must be loaded, so the unread count never jumps while one list is loading.
  const items = useMemo(
    () =>
      warnings && messages && announcements && announcementRead && !error
        ? buildInbox(warnings, messages, announcements, announcementRead, Date.now())
        : null,
    [warnings, messages, announcements, announcementRead, error],
  );

  const markAllRead = useCallback(async () => {
    if (!uid || !items) return;
    const unreadMessages = items.flatMap((i) => (i.kind === 'message' && i.unread ? [i.message.messageId] : []));
    const unreadAnnouncements = items.some((i) => i.kind === 'announcement' && i.unread);
    if (unreadMessages.length === 0 && !unreadAnnouncements) return;
    const batch = writeBatch(firestore);
    // A batch holds at most 500 writes; older unread messages wait for the next tap.
    addMarkMessagesReadToBatch(batch, unreadMessages.slice(0, 450));
    if (unreadAnnouncements) addMarkAllAnnouncementsReadToBatch(batch, uid);
    await batch.commit();
  }, [uid, items]);

  return {
    items,
    warnings: error ? null : warnings,
    messages: error ? null : messages,
    announcements: error ? null : announcements,
    announcementRead: error ? null : announcementRead,
    error,
    unread: items ? unreadCount(items) : 0,
    retry: () => {
      setState(null);
      setAttempt((n) => n + 1);
    },
    markAllRead,
  };
}
