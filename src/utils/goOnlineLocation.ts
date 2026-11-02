// Why a driver could not go online for lack of a position, and what to tell them. Going
// online must record the driver's position (firestore.rules), so each problem gets a clear
// message and one action; the driver stays offline until it is fixed. No imports, so plain
// Node tests can load this file.

export type LocationProblem =
  /** Not allowed yet; the system can still show its permission prompt. */
  | 'permission-denied'
  /** Not allowed, and the system will not ask again: only the phone's settings can change it. */
  | 'permission-blocked'
  /** Location services (GPS) are off for the whole phone. */
  | 'services-off'
  /** Allowed and switched on, but no position came in time (no GPS fix). */
  | 'no-fix';

export type LocationAction =
  /** Show the system permission prompt again, then retry. */
  | 'request-permission'
  /** Open TriGo's page in the phone's settings. */
  | 'open-app-settings'
  /** Android: the system "turn on location" dialog, then retry. iOS: the phone's settings. */
  | 'enable-location-services'
  /** Try to get a position again. */
  | 'retry';

export interface LocationProblemMessage {
  title: string;
  message: string;
  action: LocationAction;
  actionLabel: string;
}

export interface LocationCheck {
  granted: boolean;
  /** From the permission response: false once the system will not prompt again. */
  canAskAgain: boolean;
  /** Location services switched on (hasServicesEnabledAsync). */
  servicesEnabled: boolean;
  /** A usable position was obtained (current, or a recent last-known one). */
  gotPosition: boolean;
}

/** The first thing stopping the driver from going online, or null when nothing does. */
export function classifyLocationProblem(check: LocationCheck): LocationProblem | null {
  if (!check.granted) return check.canAskAgain ? 'permission-denied' : 'permission-blocked';
  if (!check.servicesEnabled) return 'services-off';
  if (!check.gotPosition) return 'no-fix';
  return null;
}

const WHY = 'TriGo needs your location while you are online so nearby passengers can find you.';

export function locationProblemMessage(problem: LocationProblem): LocationProblemMessage {
  switch (problem) {
    case 'permission-denied':
      return {
        title: 'Allow location to go online',
        message: `${WHY} You stay offline until you allow it.`,
        action: 'request-permission',
        actionLabel: 'Allow location',
      };
    case 'permission-blocked':
      return {
        title: 'Turn on location to go online',
        message: `${WHY} Location is turned off for TriGo. Open Settings, allow location, then come back and go online.`,
        action: 'open-app-settings',
        actionLabel: 'Open settings',
      };
    case 'services-off':
      return {
        title: 'Turn on location to go online',
        message: `Your phone's location (GPS) is off. ${WHY}`,
        action: 'enable-location-services',
        actionLabel: 'Turn on location',
      };
    default:
      return {
        title: "Can't find your location",
        message:
          'TriGo could not get your position. Move to an open area or near a window, then try again. You are still offline.',
        action: 'retry',
        actionLabel: 'Try again',
      };
  }
}

/** How long to wait for a GPS fix before falling back to a recent last-known position. */
export const GO_ONLINE_FIX_TIMEOUT_MS = 15_000;

/** A last-known position this recent (and this accurate) is good enough to go online. */
export const LAST_KNOWN_MAX_AGE_MS = 2 * 60 * 1000;
export const LAST_KNOWN_MAX_ACCURACY_M = 500;
