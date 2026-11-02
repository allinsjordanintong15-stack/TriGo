// Ride-request notifications: their text, when to vibrate or notify, and checking the data
// a tapped notification carries. No runtime imports, so plain Node tests can load this file
// (Node resolves neither the "@/..." aliases nor extensionless paths).

// ─── Foreground vs background ──────────────────────────────────────────────

/** React Native AppState values (kept as strings so this file needs no imports). */
export type AppStateName = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

export type NotificationKind = 'none' | 'single' | 'summary';

export interface AlertDecision {
  /** In-app vibration (React Native Vibration). */
  vibrate: boolean;
  /** Local notification; its channel vibrates and plays the sound instead. */
  notify: NotificationKind;
}

/**
 * How to alert for `newCount` new requests: on screen ('active') only the in-app vibration;
 * otherwise only a notification, one detailed for a single request or a summary for
 * several. Never both, so the phone never buzzes twice for the same request.
 */
export function decideAlert(appState: AppStateName, newCount: number): AlertDecision {
  if (newCount <= 0) return { vibrate: false, notify: 'none' };
  if (appState === 'active') return { vibrate: true, notify: 'none' };
  return { vibrate: false, notify: newCount === 1 ? 'single' : 'summary' };
}

// ─── Notification text ───────────────────────────────────────────────────────

export const REQUEST_NOTIFICATION_TITLE = 'New ride request';

/** Longest place label in the body; longer ones end in "…". */
export const MAX_PLACE_LABEL_LENGTH = 28;

/** Shortens text to `max` characters, ending in "…" when cut. */
export function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/**
 * A short place name: the barangay name when known (standard bookings), else the first
 * part of the address before a comma (e.g. "Tagbilaran City" from "Tagbilaran City,
 * Bohol"), shortened. "Unknown place" when both are empty.
 */
export function placeLabel(address: string, barangayName: string | null): string {
  const name = barangayName?.trim();
  if (name) return truncate(name, MAX_PLACE_LABEL_LENGTH);
  const firstPart = address.split(',')[0]?.trim() ?? '';
  return firstPart ? truncate(firstPart, MAX_PLACE_LABEL_LENGTH) : 'Unknown place';
}

export interface RequestNotificationInput {
  /** Fare in pesos: the estimated fare (standard) or the per-km fare (out-of-area). */
  fare: number;
  pickupLabel: string;
  destinationLabel: string;
  /** Straight-line km from the driver to the pickup; null when the location is unknown. */
  distanceToPickupKm: number | null;
}

export interface NotificationText {
  title: string;
  body: string;
}

/** "₱85.44 · Santo Tomas → Poblacion · 2.1 km to pickup" (same peso format as formatPhilippinePeso). */
export function formatRequestNotification(input: RequestNotificationInput): NotificationText {
  const parts = [
    `₱${input.fare.toFixed(2)}`,
    `${input.pickupLabel} → ${input.destinationLabel}`,
  ];
  if (input.distanceToPickupKm !== null && Number.isFinite(input.distanceToPickupKm)) {
    parts.push(`${input.distanceToPickupKm.toFixed(1)} km to pickup`);
  }
  return { title: REQUEST_NOTIFICATION_TITLE, body: parts.join(' · ') };
}

/** "3 new ride requests" for several at once; tapping it opens the Requests list. */
export function formatSummaryNotification(count: number): NotificationText {
  return {
    title: `${count} new ride requests`,
    body: 'Open TriGo to see them in Requests.',
  };
}

// ─── Identifiers ───────────────────────────────────────────────────────────

/** One notification per request: posting again replaces it, and it can be removed by ID. */
export function requestNotificationId(kind: 'standard' | 'out_of_area', id: string): string {
  return `ride-request:${kind}:${id}`;
}

/** The single summary notification, replaced by each new summary. */
export const SUMMARY_NOTIFICATION_ID = 'ride-request:summary';

// ─── Tap data ────────────────────────────────────────────────────────────────

/** Where a tapped notification leads. */
export type NotificationTarget =
  | { kind: 'standard'; bookingId: string }
  | { kind: 'out_of_area'; requestId: string }
  | { kind: 'list' };

/** The data stored on a notification (strings only, as notification data should be). */
export type NotificationData = Record<string, string>;

export function buildNotificationData(target: NotificationTarget, driverId: string): NotificationData {
  switch (target.kind) {
    case 'standard':
      return { type: 'ride-request', kind: 'standard', id: target.bookingId, driverId };
    case 'out_of_area':
      return { type: 'ride-request', kind: 'out_of_area', id: target.requestId, driverId };
    default:
      return { type: 'ride-request', kind: 'list', id: '', driverId };
  }
}

/** Firestore document IDs as TriGo creates them (auto IDs; no slashes or dots). */
const DOCUMENT_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Checks a tapped notification's data before navigating. Null when it is not a TriGo ride
 * request, is malformed, or was posted for a different driver than the one signed in
 * (e.g. after switching accounts on the phone).
 */
export function parseNotificationData(
  data: unknown,
  signedInDriverId: string | null,
): NotificationTarget | null {
  if (typeof data !== 'object' || data === null || signedInDriverId === null) return null;
  const record = data as Record<string, unknown>;
  if (record.type !== 'ride-request' || record.driverId !== signedInDriverId) return null;

  const id = record.id;
  switch (record.kind) {
    case 'standard':
      return typeof id === 'string' && DOCUMENT_ID.test(id) ? { kind: 'standard', bookingId: id } : null;
    case 'out_of_area':
      return typeof id === 'string' && DOCUMENT_ID.test(id)
        ? { kind: 'out_of_area', requestId: id }
        : null;
    case 'list':
      return { kind: 'list' };
    default:
      return null;
  }
}

/** True for every notification ID this file makes (singles and the summary). */
export function isRideRequestNotificationId(identifier: string): boolean {
  return identifier.startsWith('ride-request:');
}

// ─── Which notifications are on screen ───────────────────────────────────────

/** Ride-request notifications this app has posted and not yet removed. */
export interface ShownNotifications {
  /** Notification IDs (requestNotificationId) of the requests notified, oldest first. */
  ids: readonly string[];
  /** True when one summary stands for all of `ids` (their singles were removed). */
  summaryShown: boolean;
}

export const NO_SHOWN_NOTIFICATIONS: ShownNotifications = { ids: [], summaryShown: false };

export type NotificationAction =
  | { type: 'post-single'; id: string }
  | { type: 'post-summary'; count: number }
  | { type: 'dismiss'; id: string };

export interface AlertPlan {
  vibrate: boolean;
  /** Run in order: removals come before the post that replaces them. */
  actions: NotificationAction[];
  next: ShownNotifications;
}

/**
 * New requests arrived (`newIds`, notification IDs). On screen: vibrate only and nothing is
 * remembered. Otherwise the requests join those already notified: one in total gets its
 * own notification; two or more share one summary, which replaces the singles.
 */
export function planNewRequests(
  shown: ShownNotifications,
  newIds: readonly string[],
  appState: AppStateName,
): AlertPlan {
  const fresh = newIds.filter((id, index) => newIds.indexOf(id) === index && !shown.ids.includes(id));
  if (appState === 'active') {
    return { vibrate: decideAlert(appState, fresh.length).vibrate, actions: [], next: shown };
  }

  const ids = [...shown.ids, ...fresh];
  const decision = decideAlert(appState, fresh.length === 0 ? 0 : ids.length);
  if (decision.notify === 'none') return { vibrate: false, actions: [], next: shown };
  if (decision.notify === 'single') {
    return {
      vibrate: false,
      actions: [{ type: 'post-single', id: ids[0] }],
      next: { ids, summaryShown: false },
    };
  }

  const actions: NotificationAction[] = shown.summaryShown
    ? []
    : shown.ids.map((id) => ({ type: 'dismiss', id }));
  actions.push({ type: 'post-summary', count: ids.length });
  return { vibrate: false, actions, next: { ids, summaryShown: true } };
}

/**
 * Requests no longer open (taken, cancelled, expired, hidden): their singles are removed.
 * A summary is removed once none of its requests is open; until then it stays as posted,
 * because posting it again with a lower count would ring the phone again.
 */
export function planGoneRequests(
  shown: ShownNotifications,
  goneIds: readonly string[],
): { actions: NotificationAction[]; next: ShownNotifications } {
  const gone = shown.ids.filter((id) => goneIds.includes(id));
  if (gone.length === 0) return { actions: [], next: shown };

  const ids = shown.ids.filter((id) => !gone.includes(id));
  if (!shown.summaryShown) {
    return {
      actions: gone.map((id) => ({ type: 'dismiss', id })),
      next: { ids, summaryShown: false },
    };
  }
  if (ids.length === 0) {
    return { actions: [{ type: 'dismiss', id: SUMMARY_NOTIFICATION_ID }], next: NO_SHOWN_NOTIFICATIONS };
  }
  return { actions: [], next: { ids, summaryShown: true } };
}
