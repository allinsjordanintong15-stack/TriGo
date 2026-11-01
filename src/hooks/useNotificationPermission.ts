import {
  getNotificationPermission,
  requestNotificationPermission,
} from '@/services/localNotificationService';
import { NotificationPermissionState } from '@/utils/notificationPermission';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

export interface NotificationPermission {
  /** Null until first read. */
  state: NotificationPermissionState | null;
  /** Shows the system prompt (when it still can) and returns the new state. */
  request: () => Promise<NotificationPermissionState>;
}

/**
 * The ride-request notification permission, re-read when the screen gains focus and when
 * the app returns to the foreground (e.g. after the driver changed it in the phone's settings).
 */
export function useNotificationPermission(): NotificationPermission {
  const [state, setState] = useState<NotificationPermissionState | null>(null);

  const refresh = useCallback(() => {
    getNotificationPermission().then(setState);
  }, []);

  useFocusEffect(refresh);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const request = useCallback(async () => {
    const next = await requestNotificationPermission();
    setState(next);
    return next;
  }, []);

  return { state, request };
}
