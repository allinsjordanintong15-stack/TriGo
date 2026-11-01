// Ride-request notification permission decisions (no imports, so plain Node tests can
// load this file). The service (src/services/notificationService.ts) reads the real state.

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface NotificationPermissionState {
  status: NotificationPermissionStatus;
  /** False once the system will no longer show its prompt (Android: denied twice). */
  canAskAgain: boolean;
}

/**
 * Show TriGo's own explanation before going online: only while notifications are off, the
 * system can still ask, and this driver has not seen the explanation on this device yet.
 * Going online never waits for an answer beyond this one dialog.
 */
export function shouldExplainBeforeGoingOnline(
  state: NotificationPermissionState,
  promptSeen: boolean,
): boolean {
  return state.status !== 'granted' && state.canAskAgain && !promptSeen;
}

/** What the Profile row offers: nothing when on, the system prompt, or the phone's settings. */
export type NotificationSettingAction = 'none' | 'request' | 'open_settings';

export function notificationSettingAction(
  state: NotificationPermissionState,
): NotificationSettingAction {
  if (state.status === 'granted') return 'none';
  return state.canAskAgain ? 'request' : 'open_settings';
}

/** Maps the library's status string, treating anything unknown as not granted. */
export function toPermissionStatus(status: string): NotificationPermissionStatus {
  return status === 'granted' || status === 'denied' ? status : 'undetermined';
}
