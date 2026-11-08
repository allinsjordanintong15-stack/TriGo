import { FaresCollected, getDriverFaresCollectedSince } from '@/services/driverBookingService';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

function getStartOfToday(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Monday 00:00 of the current week, device time. */
function getStartOfWeek(): Date {
  const start = getStartOfToday();
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

export interface FaresSummary {
  /** Null while loading. */
  today: FaresCollected | null;
  thisWeek: FaresCollected | null;
  error: boolean;
}

export interface FaresCollectedState extends FaresSummary {
  /** Loads again (pull-to-refresh); resolves when done, also on failure. */
  reload: () => Promise<void>;
}

/**
 * Fares collected today and this week (Home and Earnings). Refreshed whenever the screen
 * gains focus, so just-finished trips count, and on reload().
 */
export function useFaresCollected(driverId: string | null): FaresCollectedState {
  const [fares, setFares] = useState<FaresSummary>({ today: null, thisWeek: null, error: false });
  // Ignores a load that finishes after the screen lost focus or a newer load started.
  const latestLoad = useRef(0);

  const load = useCallback(async () => {
    if (!driverId) return;
    const loadId = ++latestLoad.current;
    try {
      const [today, thisWeek] = await Promise.all([
        getDriverFaresCollectedSince(driverId, getStartOfToday()),
        getDriverFaresCollectedSince(driverId, getStartOfWeek()),
      ]);
      if (loadId === latestLoad.current) setFares({ today, thisWeek, error: false });
    } catch {
      if (loadId === latestLoad.current) setFares((current) => ({ ...current, error: true }));
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

  return { ...fares, reload: load };
}
