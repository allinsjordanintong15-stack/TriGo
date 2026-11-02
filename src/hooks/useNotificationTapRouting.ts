import { useDriverAccess } from '@/hooks/useDriverAccess';
import { NotificationTarget, parseNotificationData } from '@/utils/requestNotification';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

/** The last tap handled in this app process, so a remount (e.g. after switching modes)
 * never opens the same request again. */
let lastHandledTap: string | null = null;

function openTarget(target: NotificationTarget): void {
  switch (target.kind) {
    case 'standard':
      router.push({ pathname: '/driver/requests/[bookingId]', params: { bookingId: target.bookingId } });
      return;
    case 'out_of_area':
      router.push({
        pathname: '/driver/requests/out-of-area/[requestId]',
        params: { requestId: target.requestId },
      });
      return;
    default:
      router.navigate('/driver/requests');
  }
}

/**
 * Opens what a tapped ride-request notification points to: the standard or out-of-area
 * request detail, or the Requests list for a summary. Mounted on the driver tabs, so it
 * runs only once the signed-in driver's account has loaded; a tap that started the app
 * (cold start) is handled then. The data is checked first (parseNotificationData): taps on
 * notifications that are malformed, not ride requests, or posted for another driver are
 * ignored. The detail screens themselves show whether the request is still open.
 */
export function useNotificationTapRouting(): void {
  const { driverRecord } = useDriverAccess();
  const driverId = driverRecord?.driverId ?? null;
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!response || !driverId) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const { request, date } = response.notification;
    const tapKey = `${request.identifier}@${date}`;
    if (tapKey === lastHandledTap) return;
    lastHandledTap = tapKey;
    Notifications.clearLastNotificationResponse();

    const target = parseNotificationData(request.content.data, driverId);
    if (!target) return;
    try {
      openTarget(target);
    } catch {
      // Navigation not ready; the driver stays on the driver tabs.
    }
  }, [response, driverId]);
}
