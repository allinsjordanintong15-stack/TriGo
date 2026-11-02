import { BARANGAYS, POBLACION_ID } from '@/constants/barangays';
import { useDriverActivity } from '@/contexts/DriverActivityContext';
import { useDriverAccess } from '@/hooks/useDriverAccess';
import { getDeclinedBookingIds, subscribeToOpenBookings } from '@/services/driverBookingService';
import { OpenOutOfAreaRequest, subscribeToOpenOutOfAreaRequests } from '@/services/driverService';
import { fetchFareConfig } from '@/services/fareService';
import {
  dismissAllRideRequestNotifications,
  dismissRideRequestNotification,
  showRideRequestNotification,
} from '@/services/localNotificationService';
import { Booking } from '@/types';
import { isBookingExpired } from '@/utils/bookingExpiry';
import { calculateDistanceKmFromCoords } from '@/utils/distance';
import {
  findNewRequestKeys,
  isUnexpired,
  MIN_VIBRATION_GAP_MS,
  NEW_REQUEST_VIBRATION_PATTERN,
  outOfAreaRequestKey,
  standardRequestKey,
} from '@/utils/newRequestAlert';
import {
  AppStateName,
  buildNotificationData,
  formatRequestNotification,
  formatSummaryNotification,
  NO_SHOWN_NOTIFICATIONS,
  NotificationAction,
  NotificationData,
  NotificationText,
  placeLabel,
  planGoneRequests,
  planNewRequests,
  requestNotificationId,
  ShownNotifications,
  SUMMARY_NOTIFICATION_ID,
} from '@/utils/requestNotification';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Vibration } from 'react-native';

/** New requests arriving this close together (e.g. a standard and an out-of-area one) are
 * alerted once: one vibration, or one summary instead of a single then a summary. */
const ALERT_BATCH_MS = 1000;

/** How often notifications of expired requests are looked for (expiry changes no snapshot). */
const EXPIRY_CHECK_MS = 15_000;

const STANDARD_PREFIX = requestNotificationId('standard', '');
const OUT_OF_AREA_PREFIX = requestNotificationId('out_of_area', '');

const BARANGAY_NAMES = new Map<string, string>([
  [POBLACION_ID, 'Poblacion'],
  ...BARANGAYS.map(({ id, name }): [string, string] => [id, name]),
]);

function barangayName(id: string | null): string | null {
  return id ? (BARANGAY_NAMES.get(id) ?? null) : null;
}

/** What a request's notification says and carries, kept while the request is open. */
interface RequestDetails {
  text: NotificationText;
  data: NotificationData;
  expiresAtMs: number;
}

interface Coords {
  latitude: number;
  longitude: number;
}

function standardDetails(booking: Booking, driver: Coords | null, driverId: string): RequestDetails {
  return {
    text: formatRequestNotification({
      fare: booking.estimatedFare,
      pickupLabel: placeLabel(booking.pickupLocation.address, barangayName(booking.pickupBarangayId)),
      destinationLabel: placeLabel(
        booking.destination.address,
        barangayName(booking.destinationBarangayId),
      ),
      distanceToPickupKm: driver
        ? calculateDistanceKmFromCoords(
            driver.latitude,
            driver.longitude,
            booking.pickupLocation.latitude,
            booking.pickupLocation.longitude,
          )
        : null,
    }),
    data: buildNotificationData({ kind: 'standard', bookingId: booking.bookingId }, driverId),
    expiresAtMs: booking.expiresAt?.getTime() ?? 0,
  };
}

function outOfAreaDetails(
  { request, distanceToPickupKm }: OpenOutOfAreaRequest,
  driverId: string,
): RequestDetails {
  return {
    text: formatRequestNotification({
      fare: request.standardEstimatedFare,
      pickupLabel: placeLabel(request.pickupLocation.address, null),
      destinationLabel: placeLabel(request.destination.address, null),
      distanceToPickupKm,
    }),
    data: buildNotificationData({ kind: 'out_of_area', requestId: request.requestId }, driverId),
    expiresAtMs: request.expiresAt?.getTime() ?? 0,
  };
}

/**
 * Alerts the driver to each new open request (mounted on the driver tabs). With TriGo on
 * screen it vibrates once; with TriGo in the background it posts a local notification
 * instead (decideAlert): one for a single request, one summary for several. A request's
 * notification is removed when it is taken, cancelled, expires or is hidden, and all
 * ride-request notifications are removed when the driver can no longer take requests
 * (offline, unavailable, on a trip, an out-of-area offer waiting, or at the daily
 * acceptance limit) or signs out.
 *
 * Only while the driver can take requests: verified, online, available, no active trip and
 * no out-of-area offer waiting for the passenger (drivers/{uid}.currentRequestId). Covers
 * unexpired standard bookings and out-of-area requests within the admin search radius.
 * Requests already open when the driver became able to take requests (the first snapshot)
 * are never alerted, and declined requests (standard: declined on this device; out-of-area:
 * the passenger declined this driver's fare) are skipped. Notifications only appear while
 * the app process is running (docs/STATUS.md).
 */
export function useNewRequestAlert(): void {
  const { driverRecord, canPerformDriverActions } = useDriverAccess();
  const { hasActiveTrip, hiddenRequestIds, dailyQuota } = useDriverActivity();

  const driverId = driverRecord?.driverId ?? null;
  const vehicleType = driverRecord?.vehicleType ?? null;
  const latitude = driverRecord?.currentLocation?.latitude ?? null;
  const longitude = driverRecord?.currentLocation?.longitude ?? null;
  const enabled =
    canPerformDriverActions &&
    driverRecord?.isOnline === true &&
    driverRecord.isAvailable &&
    !hasActiveTrip &&
    (driverRecord.currentRequestId ?? null) === null &&
    // At the daily acceptance limit nothing can be accepted, so nothing alerts (and the
    // "not enabled" path below removes the ride-request notifications).
    dailyQuota?.reached !== true;

  const [searchRadiusKm, setSearchRadiusKm] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    fetchFareConfig().then((config) => {
      if (active) setSearchRadiusKm(config.outOfArea.driverSearchRadiusKm);
    });
    return () => {
      active = false;
    };
  }, []);

  // Every request key seen while able to take requests; a key alerts at most once.
  const seen = useRef(new Set<string>());
  // Baseline flags: the first snapshot of each source after becoming able to take requests.
  const standardBaselined = useRef(false);
  const outOfAreaBaselined = useRef(false);
  const lastVibratedAt = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const driverIdRef = useRef(driverId);
  driverIdRef.current = driverId;
  const hiddenRef = useRef(hiddenRequestIds);
  hiddenRef.current = hiddenRequestIds;
  const locationRef = useRef<Coords | null>(null);
  locationRef.current = latitude !== null && longitude !== null ? { latitude, longitude } : null;

  const appStateRef = useRef<AppStateName>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      appStateRef.current = state;
    });
    return () => subscription.remove();
  }, []);

  // Notification bookkeeping, keyed by notification ID (requestNotificationId).
  const details = useRef(new Map<string, RequestDetails>());
  const shown = useRef<ShownNotifications>(NO_SHOWN_NOTIFICATIONS);
  const pending = useRef(new Set<string>());
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Notification calls run one after another, so a removal never overtakes its post.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const enqueue = useCallback((task: () => Promise<void>) => {
    queue.current = queue.current.then(task).catch(() => undefined);
  }, []);

  const runActions = useCallback(
    (actions: NotificationAction[]) => {
      if (actions.length === 0) return;
      // Read now: the request may be gone by the time the queue gets here.
      const owner = driverIdRef.current;
      const posts = actions.map((action) => {
        if (action.type === 'post-single') return { action, entry: details.current.get(action.id) };
        return { action, entry: undefined };
      });
      enqueue(async () => {
        for (const { action, entry } of posts) {
          if (action.type === 'dismiss') {
            await dismissRideRequestNotification(action.id);
          } else if (action.type === 'post-single') {
            if (entry) {
              await showRideRequestNotification({ identifier: action.id, ...entry.text, data: entry.data });
            }
          } else if (owner) {
            await showRideRequestNotification({
              identifier: SUMMARY_NOTIFICATION_ID,
              ...formatSummaryNotification(action.count),
              data: buildNotificationData({ kind: 'list' }, owner),
            });
          }
        }
      });
    },
    [enqueue],
  );

  const vibrate = useCallback(() => {
    const now = Date.now();
    if (now - lastVibratedAt.current < MIN_VIBRATION_GAP_MS) return;
    lastVibratedAt.current = now;
    Vibration.vibrate(NEW_REQUEST_VIBRATION_PATTERN);
  }, []);

  const flush = useCallback(() => {
    batchTimer.current = null;
    // State may have changed while waiting (or while the declined list was being read).
    const ids = [...pending.current].filter((id) => details.current.has(id));
    pending.current.clear();
    if (!enabledRef.current || ids.length === 0) return;

    const plan = planNewRequests(shown.current, ids, appStateRef.current);
    shown.current = plan.next;
    if (plan.vibrate) vibrate();
    runActions(plan.actions);
  }, [runActions, vibrate]);

  const alertNew = useCallback(
    (ids: string[]) => {
      if (ids.length === 0 || !enabledRef.current) return;
      ids.forEach((id) => pending.current.add(id));
      if (batchTimer.current === null) batchTimer.current = setTimeout(flush, ALERT_BATCH_MS);
    },
    [flush],
  );

  /** Forgets requests that are no longer open and removes their notifications. */
  const removeGone = useCallback(
    (goneIds: string[]) => {
      if (goneIds.length === 0) return;
      goneIds.forEach((id) => {
        details.current.delete(id);
        pending.current.delete(id);
      });
      const plan = planGoneRequests(shown.current, goneIds);
      shown.current = plan.next;
      runActions(plan.actions);
    },
    [runActions],
  );

  /** Keeps the details of one source's open requests; everything else of it is gone. */
  const syncSource = useCallback(
    (prefix: string, open: Map<string, RequestDetails>) => {
      open.forEach((entry, id) => details.current.set(id, entry));
      const known = new Set([...details.current.keys(), ...shown.current.ids]);
      removeGone([...known].filter((id) => id.startsWith(prefix) && !open.has(id)));
    },
    [removeGone],
  );

  const clearAll = useCallback(() => {
    if (batchTimer.current !== null) clearTimeout(batchTimer.current);
    batchTimer.current = null;
    pending.current.clear();
    details.current.clear();
    shown.current = NO_SHOWN_NOTIFICATIONS;
    enqueue(dismissAllRideRequestNotifications);
  }, [enqueue]);

  useEffect(() => {
    if (enabled) return;
    // Offline, unavailable, on a trip or waiting on an offer: no request can be taken, so
    // remove every ride-request notification, and start a new baseline next time.
    standardBaselined.current = false;
    outOfAreaBaselined.current = false;
    clearAll();
  }, [enabled, clearAll]);

  // Signing out or leaving the driver tabs.
  useEffect(() => clearAll, [clearAll]);

  useEffect(() => {
    seen.current = new Set();
  }, [driverId]);

  // Out-of-area requests whose fare the passenger declined are hidden at once.
  useEffect(() => {
    removeGone(hiddenRequestIds.map((id) => requestNotificationId('out_of_area', id)));
  }, [hiddenRequestIds, removeGone]);

  // Expiry changes no snapshot, so look for expired requests now and then.
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      const now = Date.now();
      const expired = [...details.current]
        .filter(([, entry]) => entry.expiresAtMs <= now)
        .map(([id]) => id);
      removeGone(expired);
    }, EXPIRY_CHECK_MS);
    return () => clearInterval(timer);
  }, [enabled, removeGone]);

  // Standard bookings.
  useEffect(() => {
    if (!enabled || !vehicleType || !driverId) return;
    let active = true;

    const unsubscribe = subscribeToOpenBookings(
      vehicleType,
      (bookings) => {
        const now = Date.now();
        const open = bookings.filter((booking) => !isBookingExpired(booking, now));
        syncSource(
          STANDARD_PREFIX,
          new Map(
            open.map((booking) => [
              requestNotificationId('standard', booking.bookingId),
              standardDetails(booking, locationRef.current, driverId),
            ]),
          ),
        );

        const keys = open.map((booking) => standardRequestKey(booking.bookingId));
        const fresh = findNewRequestKeys(seen.current, keys, !standardBaselined.current);
        standardBaselined.current = true;
        keys.forEach((key) => seen.current.add(key));
        if (fresh.length === 0) return;
        const freshKeys = new Set(fresh);
        const freshIds = open
          .map((booking) => booking.bookingId)
          .filter((id) => freshKeys.has(standardRequestKey(id)));

        getDeclinedBookingIds(driverId).then((declinedIds) => {
          if (!active) return;
          const declined = new Set(declinedIds);
          alertNew(
            freshIds
              .filter((id) => !declined.has(id))
              .map((id) => requestNotificationId('standard', id)),
          );
        });
      },
      () => {
        // The Requests tab shows load errors; the alert just stays quiet.
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [enabled, vehicleType, driverId, syncSource, alertNew]);

  // Out-of-area requests near the driver.
  useEffect(() => {
    if (!enabled || !vehicleType || !driverId || searchRadiusKm === null) return;
    if (latitude === null || longitude === null) return;

    return subscribeToOpenOutOfAreaRequests(
      vehicleType,
      { latitude, longitude },
      searchRadiusKm,
      (requests) => {
        const now = Date.now();
        const hidden = new Set(hiddenRef.current);
        const open = requests.filter(
          ({ request }) => isUnexpired(request.expiresAt, now) && !hidden.has(request.requestId),
        );
        syncSource(
          OUT_OF_AREA_PREFIX,
          new Map(
            open.map((entry) => [
              requestNotificationId('out_of_area', entry.request.requestId),
              outOfAreaDetails(entry, driverId),
            ]),
          ),
        );

        const keys = open.map(({ request }) => outOfAreaRequestKey(request.requestId));
        const fresh = new Set(findNewRequestKeys(seen.current, keys, !outOfAreaBaselined.current));
        outOfAreaBaselined.current = true;
        keys.forEach((key) => seen.current.add(key));
        alertNew(
          open
            .filter(({ request }) => fresh.has(outOfAreaRequestKey(request.requestId)))
            .map(({ request }) => requestNotificationId('out_of_area', request.requestId)),
        );
      },
      () => {
        // The Requests tab shows load errors; the alert just stays quiet.
      },
    );
  }, [enabled, vehicleType, driverId, latitude, longitude, searchRadiusKm, syncSource, alertNew]);
}
