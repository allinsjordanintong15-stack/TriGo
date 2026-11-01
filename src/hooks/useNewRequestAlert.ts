import { useDriverActivity } from '@/contexts/DriverActivityContext';
import { useDriverAccess } from '@/hooks/useDriverAccess';
import { getDeclinedBookingIds, subscribeToOpenBookings } from '@/services/driverBookingService';
import { subscribeToOpenOutOfAreaRequests } from '@/services/driverService';
import { fetchFareConfig } from '@/services/fareService';
import { isBookingExpired } from '@/utils/bookingExpiry';
import {
  findNewRequestKeys,
  isUnexpired,
  MIN_VIBRATION_GAP_MS,
  NEW_REQUEST_VIBRATION_PATTERN,
  outOfAreaRequestKey,
  standardRequestKey,
} from '@/utils/newRequestAlert';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';

/**
 * Vibrates once for each new open request while the driver app is open (driver tabs), so
 * a driver who is not looking at the Requests tab still notices it. Only while the driver
 * can take requests: verified, online, available, no active trip and no out-of-area offer
 * waiting for the passenger (drivers/{uid}.currentRequestId). Covers unexpired standard
 * bookings and out-of-area requests within the admin search radius. Requests already open
 * when the driver became able to take requests (the first snapshot) never vibrate, and
 * declined requests (standard: declined on this device; out-of-area: the passenger
 * declined this driver's fare) are skipped. Uses React Native's built-in Vibration API.
 */
export function useNewRequestAlert(): void {
  const { driverRecord, canPerformDriverActions } = useDriverAccess();
  const { hasActiveTrip, hiddenRequestIds } = useDriverActivity();

  const driverId = driverRecord?.driverId ?? null;
  const vehicleType = driverRecord?.vehicleType ?? null;
  const latitude = driverRecord?.currentLocation?.latitude ?? null;
  const longitude = driverRecord?.currentLocation?.longitude ?? null;
  const enabled =
    canPerformDriverActions &&
    driverRecord?.isOnline === true &&
    driverRecord.isAvailable &&
    !hasActiveTrip &&
    (driverRecord.currentRequestId ?? null) === null;

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

  // Every request key seen while able to take requests; a key vibrates at most once.
  const seen = useRef(new Set<string>());
  // Baseline flags: the first snapshot of each source after becoming able to take requests.
  const standardBaselined = useRef(false);
  const outOfAreaBaselined = useRef(false);
  const lastVibratedAt = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const hiddenRef = useRef(hiddenRequestIds);
  hiddenRef.current = hiddenRequestIds;

  useEffect(() => {
    if (enabled) return;
    // Going offline, busy or onto a trip: the next time requests open, start a new baseline.
    standardBaselined.current = false;
    outOfAreaBaselined.current = false;
  }, [enabled]);

  useEffect(() => {
    seen.current = new Set();
  }, [driverId]);

  const vibrate = useCallback(() => {
    // State may have changed while the declined list was being read.
    if (!enabledRef.current) return;
    const now = Date.now();
    if (now - lastVibratedAt.current < MIN_VIBRATION_GAP_MS) return;
    lastVibratedAt.current = now;
    Vibration.vibrate(NEW_REQUEST_VIBRATION_PATTERN);
  }, []);

  // Standard bookings.
  useEffect(() => {
    if (!enabled || !vehicleType || !driverId) return;
    let active = true;

    const unsubscribe = subscribeToOpenBookings(
      vehicleType,
      (bookings) => {
        const now = Date.now();
        const open = bookings.filter((booking) => !isBookingExpired(booking, now));
        const keys = open.map((booking) => standardRequestKey(booking.bookingId));
        const fresh = findNewRequestKeys(seen.current, keys, !standardBaselined.current);
        standardBaselined.current = true;
        keys.forEach((key) => seen.current.add(key));
        if (fresh.length === 0) return;

        getDeclinedBookingIds(driverId).then((declinedIds) => {
          const declined = new Set(declinedIds.map(standardRequestKey));
          if (active && fresh.some((key) => !declined.has(key))) vibrate();
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
  }, [enabled, vehicleType, driverId, vibrate]);

  // Out-of-area requests near the driver.
  useEffect(() => {
    if (!enabled || !vehicleType || searchRadiusKm === null) return;
    if (latitude === null || longitude === null) return;

    return subscribeToOpenOutOfAreaRequests(
      vehicleType,
      { latitude, longitude },
      searchRadiusKm,
      (requests) => {
        const now = Date.now();
        const hidden = new Set(hiddenRef.current);
        const keys = requests
          .filter(({ request }) => isUnexpired(request.expiresAt, now) && !hidden.has(request.requestId))
          .map(({ request }) => outOfAreaRequestKey(request.requestId));
        const fresh = findNewRequestKeys(seen.current, keys, !outOfAreaBaselined.current);
        outOfAreaBaselined.current = true;
        keys.forEach((key) => seen.current.add(key));
        if (fresh.length > 0) vibrate();
      },
      () => {
        // The Requests tab shows load errors; the alert just stays quiet.
      },
    );
  }, [enabled, vehicleType, latitude, longitude, searchRadiusKm, vibrate]);
}
