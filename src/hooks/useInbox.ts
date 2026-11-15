import { useAuth } from '@/hooks/useAuth';
import { subscribeToWarnings } from '@/services/warningService';
import { buildInbox, InboxItem, InboxWarning, unreadCount } from '@/utils/inbox';
import { useEffect, useMemo, useState } from 'react';

export interface InboxState {
  /** Null while loading. */
  items: InboxItem[] | null;
  /** Every warning of the user, withdrawn included (detail screen lookups). */
  warnings: InboxWarning[] | null;
  error: string | null;
  unread: number;
  /** Subscribes again after an error (a failed listener stops). */
  retry: () => void;
}

/**
 * The signed-in user's inbox, live. Several screens may use it at once; Firestore shares
 * one listener for the same query. Announcements (Task B2) join in buildInbox.
 */
export function useInbox(): InboxState {
  const { profile } = useAuth();
  const uid = profile?.uid ?? null;
  const [state, setState] = useState<{
    uid: string;
    warnings: InboxWarning[] | null;
    error: string | null;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) return;
    return subscribeToWarnings(
      uid,
      (warnings) => setState({ uid, warnings, error: null }),
      () =>
        setState({
          uid,
          warnings: null,
          error: 'Could not load your messages. Check your connection and try again.',
        }),
    );
  }, [uid, attempt]);

  const current = state && state.uid === uid ? state : null;
  const warnings = current?.warnings ?? null;
  const items = useMemo(() => (warnings ? buildInbox(warnings) : null), [warnings]);

  return {
    items,
    warnings,
    error: current?.error ?? null,
    unread: items ? unreadCount(items) : 0,
    retry: () => {
      setState(null);
      setAttempt((n) => n + 1);
    },
  };
}
