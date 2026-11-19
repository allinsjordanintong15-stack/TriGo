// A driver application's status as read from Firestore, and the app's Profile "Driver" card
// content for it. Shared by the app (src/utils/driverApplicationStatus.ts) and the admin
// website. No imports, so plain Node tests, Metro and Vite can all load it
// (tests/drivers/driverApplicationStatus.test.ts).
//
// Firestore data is not trusted to match the types: the rules only let clients write
// pending/approved/rejected, but a record edited in the Firebase console (or by any future
// tool) may hold anything. An unexpected or missing status becomes 'unknown' and every
// screen shows a neutral state for it instead of crashing.

export const APPLICATION_STATUSES = ['pending', 'approved', 'rejected'] as const;

export type KnownApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** A stored status, or 'unknown' for a missing or unexpected value. */
export type ApplicationStatusValue = KnownApplicationStatus | 'unknown';

export function parseApplicationStatus(value: unknown): ApplicationStatusValue {
  return typeof value === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(value)
    ? (value as KnownApplicationStatus)
    : 'unknown';
}

/** Shown wherever an application's status cannot be read. */
export const UNKNOWN_STATUS_MESSAGE = 'Application status unavailable — contact TriGo support.';

export interface ApplicationCardContent {
  /** An Ionicons name, or an emoji (e.g. the vehicle icon) to show as text. */
  icon: string | { emoji: string };
  heading: string;
  badge: string | null;
  badgeTone: 'pending' | 'approved' | 'rejected' | null;
  message: string;
  action: 'apply' | 'view' | 'open-driver-mode' | 'none';
}

/**
 * The Profile "Driver" card for an application status (null: no application). Always returns
 * content, whatever the stored value.
 */
export function applicationCardContent(
  status: ApplicationStatusValue | null,
  driverModeReady: boolean,
  applyEmoji: string,
): ApplicationCardContent {
  switch (status) {
    case null:
      return {
        icon: { emoji: applyEmoji },
        heading: 'Become a TriGo Driver',
        badge: null,
        badgeTone: null,
        message: 'Want to provide transportation services through TriGo?',
        action: 'apply',
      };
    case 'pending':
      return {
        icon: 'time-outline',
        heading: 'Driver Application',
        badge: 'Pending Verification',
        badgeTone: 'pending',
        message: 'Your application has been submitted and is waiting for administrator verification.',
        action: 'view',
      };
    case 'approved':
      return {
        icon: 'shield-checkmark-outline',
        heading: 'TriGo Driver',
        badge: 'Verified Driver',
        badgeTone: 'approved',
        message: driverModeReady
          ? 'Your Driver application has been approved.'
          : 'Your Driver application has been approved. Your driver account is being set up by the TriGo administrator.',
        action: driverModeReady ? 'open-driver-mode' : 'view',
      };
    case 'rejected':
      return {
        icon: 'close-circle-outline',
        heading: 'Driver Application',
        badge: 'Rejected',
        badgeTone: 'rejected',
        message: 'Your application was not approved.',
        action: 'view',
      };
    default:
      return {
        icon: 'help-circle-outline',
        heading: 'Driver Application',
        badge: null,
        badgeTone: null,
        message: UNKNOWN_STATUS_MESSAGE,
        action: 'none',
      };
  }
}
