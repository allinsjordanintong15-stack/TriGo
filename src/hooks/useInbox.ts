import { useAuth } from '@/hooks/useAuth';
import { subscribeToAdminMessages } from '@/services/adminMessageService';
import { subscribeToWarnings } from '@/services/warningService';
import { buildInbox, InboxItem, InboxMessage, InboxWarning, unreadCount } from '@/utils/inbox';
import { useEffect, useMemo, useState } from 'react';

export interface InboxState {
  /** Null while loading. */
  items: InboxItem[] | null;
  /** Every warning of the user, withdrawn included (detail screen lookups). */
  warnings: InboxWarning[] | null;
  /** Every message from TriGo of the user (detail screen lookups). */
  messages: InboxMessage[] | null;
  error: string | null;
  unread: number;
  /** Subscribes again after an error (a failed listener stops). */
  retry: () => void;
}

const LOAD_ERROR = 'Could not load your messages. Check your connection and try again.';

type Loaded = {
  uid: string;
  warnings: InboxWarning[] | null;
  messages: InboxMessage[] | null;
  error: string | null;
};

/**
 * The signed-in user's inbox (warnings and messages from TriGo), live. Several screens may
 * use it at once; Firestore shares one listener for the same query.
 */
export function useInbox(): InboxState {
  const { profile } = useAuth();
  const uid = profile?.uid ?? null;
  const [state, setState] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) return;
    const update = (change: Partial<Loaded>) =>
      setState((previous) => ({
        ...(previous && previous.uid === uid
          ? previous
          : { uid, warnings: null, messages: null, error: null }),
        ...change,
      }));
    const stopWarnings = subscribeToWarnings(
      uid,
      (warnings) => update({ warnings }),
      () => update({ error: LOAD_ERROR }),
    );
    const stopMessages = subscribeToAdminMessages(
      uid,
      (messages) => update({ messages }),
      () => update({ error: LOAD_ERROR }),
    );
    return () => {
      stopWarnings();
      stopMessages();
    };
  }, [uid, attempt]);

  const current = state && state.uid === uid ? state : null;
  const warnings = current?.warnings ?? null;
  const messages = current?.messages ?? null;
  const error = current?.error ?? null;
  // Both lists must be loaded, so the unread count never jumps while one is still loading.
  const items = useMemo(
    () => (warnings && messages && !error ? buildInbox(warnings, messages) : null),
    [warnings, messages, error],
  );

  return {
    items,
    warnings: error ? null : warnings,
    messages: error ? null : messages,
    error,
    unread: items ? unreadCount(items) : 0,
    retry: () => {
      setState(null);
      setAttempt((n) => n + 1);
    },
  };
}
