import { subscribeToDriverRatingSummary } from '@/services/ratingService';
import { DriverRatingSummary } from '@/utils/rating';
import { useEffect, useState } from 'react';

export interface DriverRatingState {
  /** Null when the driver has no ratings yet, or while loading. */
  summary: DriverRatingSummary | null;
  loaded: boolean;
}

/** driverRatings/{driverId}, live. Shown as "New" until the first rating. */
export function useDriverRatingSummary(driverId: string | null): DriverRatingState {
  const [state, setState] = useState<DriverRatingState & { driverId: string | null }>({
    summary: null,
    loaded: false,
    driverId: null,
  });

  useEffect(() => {
    if (!driverId) return;
    return subscribeToDriverRatingSummary(
      driverId,
      (summary) => setState({ summary, loaded: true, driverId }),
      () => setState({ summary: null, loaded: true, driverId }),
    );
  }, [driverId]);

  // Ignores a previous driver's summary until this driver's arrives.
  return state.driverId === driverId
    ? { summary: state.summary, loaded: state.loaded }
    : { summary: null, loaded: false };
}
