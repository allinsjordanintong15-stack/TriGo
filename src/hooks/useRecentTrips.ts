import { DriverBookingServiceError, fetchDriverTripHistory } from '@/services/driverBookingService';
import { Booking } from '@/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

/** How many completed trips the driver Home screen lists. */
export const RECENT_TRIPS_COUNT = 3;

export interface RecentTrips {
  /** Null while the first load is running. */
  trips: Booking[] | null;
  /** Shown instead of the list when loading failed. */
  error: string;
  /** Loads again (pull-to-refresh); resolves when done, also on failure. */
  reload: () => Promise<void>;
}

/**
 * The driver's last few completed trips, newest first (Home). Uses the Trips tab query
 * with a smaller page; refreshed whenever the screen gains focus and on reload().
 */
export function useRecentTrips(driverId: string | null): RecentTrips {
  const [trips, setTrips] = useState<Booking[] | null>(null);
  const [error, setError] = useState('');
  const latestLoad = useRef(0);

  const load = useCallback(async () => {
    if (!driverId) return;
    const loadId = ++latestLoad.current;
    try {
      const page = await fetchDriverTripHistory(driverId, null, {
        pageSize: RECENT_TRIPS_COUNT,
        statuses: ['completed'],
      });
      if (loadId !== latestLoad.current) return;
      setTrips(page.trips);
      setError('');
    } catch (err) {
      if (loadId !== latestLoad.current) return;
      setTrips((current) => current ?? []);
      setError(
        err instanceof DriverBookingServiceError
          ? err.message
          : 'Unable to load your recent trips. Please try again.',
      );
    }
  }, [driverId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        latestLoad.current += 1;
      };
    }, [load]),
  );

  return { trips, error, reload: load };
}
