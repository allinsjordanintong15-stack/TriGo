import { useAuth } from '@/hooks/useAuth';
import { useInbox } from '@/hooks/useInbox';
import {
  dismissInboxNotification,
  setForegroundNotificationHandler,
  showInboxNotification,
} from '@/services/localNotificationService';
import {
  buildInboxNotificationData,
  inboxNotificationContent,
  inboxNotificationId,
  InboxTarget,
  parseInboxNotificationData,
  planInboxNotifications,
} from '@/utils/inbox';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

// Item keys already seen in this app process, per user. Module-level, so switching between
// passenger and driver mode (which remounts the tabs) never notifies the same item twice.
const knownByUser = new Map<string, Set<string>>();
// Items this process posted a notification for, so reading one in the app removes it.
const posted = new Set<string>();
let lastHandledTap: string | null = null;

function openTarget(target: InboxTarget): void {
  switch (target.kind) {
    case 'warning':
      router.push({ pathname: '/inbox/warning/[warningId]', params: { warningId: target.id } });
      return;
    case 'message':
      router.push({ pathname: '/inbox/message/[messageId]', params: { messageId: target.id } });
      return;
    case 'announcement':
      router.push({ pathname: '/inbox/announcement/[announcementId]', params: { announcementId: target.id } });
  }
}

/**
 * Phone notifications for the inbox, while the app is running (open or in the background;
 * nothing once Android stops the app: no push server). A NEW unread item (one that appears
 * after the inbox first loaded) is posted once with its title; reading it in the app removes
 * it; tapping it opens that item. Mounted on the passenger and the driver tabs, so the
 * signed-in account and the router are ready (also for a tap that started the app).
 */
export function useInboxNotifications(): void {
  const { profile } = useAuth();
  const uid = profile?.uid ?? null;
  const { items } = useInbox();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    setForegroundNotificationHandler();
  }, []);

  useEffect(() => {
    if (!uid || !items) return;
    const plan = planInboxNotifications(knownByUser.get(uid) ?? null, items);
    knownByUser.set(uid, plan.known);
    for (const item of plan.post) {
      const identifier = inboxNotificationId(item.key);
      posted.add(identifier);
      void showInboxNotification({
        identifier,
        ...inboxNotificationContent(item),
        data: buildInboxNotificationData(item, uid),
      });
    }
    for (const item of items) {
      const identifier = inboxNotificationId(item.key);
      if (!item.unread && posted.has(identifier)) {
        posted.delete(identifier);
        void dismissInboxNotification(identifier);
      }
    }
  }, [uid, items]);

  useEffect(() => {
    if (!response || !uid) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const target = parseInboxNotificationData(response.notification.request.content.data, uid);
    // Not an inbox notification for this user: left for the ride-request routing.
    if (!target) return;
    const tapKey = `${response.notification.request.identifier}@${response.notification.date}`;
    if (tapKey === lastHandledTap) return;
    lastHandledTap = tapKey;
    Notifications.clearLastNotificationResponse();
    try {
      openTarget(target);
    } catch {
      // Navigation not ready; the user stays on the tabs and finds it in the inbox.
    }
  }, [response, uid]);
}
