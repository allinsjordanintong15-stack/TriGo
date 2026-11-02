import { colors } from '@/constants/theme';
import { NEW_REQUEST_VIBRATION_PATTERN } from '@/utils/newRequestAlert';
import {
  NotificationPermissionState,
  toPermissionStatus,
} from '@/utils/notificationPermission';
import { isRideRequestNotificationId } from '@/utils/requestNotification';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Local notifications only (no push, no server): the app posts them itself from its own
// Firestore listeners, so they appear only while the app is running (docs/STATUS.md).

/** Android channel for new ride requests. Its settings are fixed once created on a phone:
 * to change sound, vibration or importance later, use a new channel ID. */
export const RIDE_REQUEST_CHANNEL_ID = 'ride-requests';

/** Creates (or keeps) the ride-request channel. Android 13+ shows the permission prompt
 * only once a channel exists, so this runs before every permission request. */
export async function ensureRideRequestChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(RIDE_REQUEST_CHANNEL_ID, {
    name: 'Ride requests',
    description: 'New ride requests while you are online and available.',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: NEW_REQUEST_VIBRATION_PATTERN,
    lightColor: colors.primary,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
  });
}

function toState(result: Notifications.NotificationPermissionsStatus): NotificationPermissionState {
  return { status: toPermissionStatus(result.status), canAskAgain: result.canAskAgain };
}

/** The current permission without prompting. Android 12 and older report granted. */
export async function getNotificationPermission(): Promise<NotificationPermissionState> {
  try {
    return toState(await Notifications.getPermissionsAsync());
  } catch {
    return { status: 'undetermined', canAskAgain: false };
  }
}

/** Shows the system prompt when it still can (creating the channel first). */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  try {
    await ensureRideRequestChannel();
    return toState(
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      }),
    );
  } catch {
    return getNotificationPermission();
  }
}

// ─── "Explained once" flag (per driver, this device) ────────────────────────

const promptSeenKey = (driverId: string) => `trigo.driver.${driverId}.notificationPromptSeen`;

export async function hasSeenNotificationPrompt(driverId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(promptSeenKey(driverId))) === '1';
  } catch {
    return false;
  }
}

export async function markNotificationPromptSeen(driverId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(promptSeenKey(driverId), '1');
  } catch {
    // Worst case the explanation is shown once more.
  }
}

// ─── Posting and removing (used by the new-request alert) ───────────────────

export interface LocalNotificationInput {
  /** Stable ID, so the same request replaces rather than repeats its notification. */
  identifier: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

/** Posts a ride-request notification now. Failures are ignored (the in-app list still works). */
export async function showRideRequestNotification(input: LocalNotificationInput): Promise<void> {
  try {
    await ensureRideRequestChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: input.identifier,
      content: { title: input.title, body: input.body, data: input.data, sound: 'default' },
      trigger: Platform.OS === 'android' ? { channelId: RIDE_REQUEST_CHANNEL_ID } : null,
    });
  } catch {
    // Permission off or the OS refused; nothing else to do.
  }
}

export async function dismissRideRequestNotification(identifier: string): Promise<void> {
  await Notifications.dismissNotificationAsync(identifier).catch(() => undefined);
}

/** Removes every ride-request notification on the phone, including ones posted before
 * the app was restarted (found by their "ride-request:" IDs). */
export async function dismissAllRideRequestNotifications(): Promise<void> {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .map((notification) => notification.request.identifier)
        .filter(isRideRequestNotificationId)
        .map(dismissRideRequestNotification),
    );
  } catch {
    // Nothing more to do; stale ones leave when tapped or swiped away.
  }
}
