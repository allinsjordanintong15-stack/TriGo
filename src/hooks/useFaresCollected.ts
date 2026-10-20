import { FaresCollected, getDriverFaresCollectedSince } from '@/services/driverBookingService';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

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

/**
 * Fares collected today and this week (Home and Earnings). Refreshed whenever the screen
 * gains focus, so just-finished trips count.
 */
export function useFaresCollected(driverId: string | null): FaresSummary {
  const [fares, setFares] = useState<FaresSummary>({ today: null, thisWeek: null, error: false });

  useFocusEffect(
    useCallback(() => {
      if (!driverId) return;
      let active = true;

      Promise.all([
        getDriverFaresCollectedSince(driverId, getStartOfToday()),
        getDriverFaresCollectedSince(driverId, getStartOfWeek()),
      ])
        .then(([today, thisWeek]) => {
          if (active) setFares({ today, thisWeek, error: false });
        })
        .catch(() => {
          if (active) setFares((current) => ({ ...current, error: true }));
        });

      return () => {
        active = false;
      };
    }, [driverId]),
  );

  return fares;
}
