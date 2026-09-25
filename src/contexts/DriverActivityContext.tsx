import { useDriverAccess } from '@/hooks/useDriverAccess';
import { subscribeToDriverActiveBookings } from '@/services/driverBookingService';
import { subscribeToDriverActiveRequests } from '@/services/driverService';
import { Booking, OutOfAreaRequest } from '@/types';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export interface DriverActivityContextValue {
  /** Bookings assigned to this driver that are still in progress (accepted → in_progress). */
  activeBookings: Booking[];
  /** Out-of-area requests this driver is handling (fare proposed or accepted). */
  activeRequests: OutOfAreaRequest[];
  /** False until the first active-bookings snapshot arrives for a verified driver. */
  loaded: boolean;
  hasActiveTrip: boolean;
}

const DriverActivityContext = createContext<DriverActivityContextValue | undefined>(undefined);

export function DriverActivityProvider({ children }: { children: ReactNode }) {
  const { driverRecord, canPerformDriverActions } = useDriverAccess();
  const driverId = driverRecord?.driverId ?? null;

  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [activeRequests, setActiveRequests] = useState<OutOfAreaRequest[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Firestore rules only let verified drivers read bookings and requests.
  const subscriptionKey = driverId && canPerformDriverActions ? driverId : null;

  useEffect(() => {
    setActiveBookings([]);
    setActiveRequests([]);
    setLoadedFor(null);

    if (!subscriptionKey) return;

    const unsubscribeBookings = subscribeToDriverActiveBookings(
      subscriptionKey,
      (bookings) => {
        setActiveBookings(bookings);
        setLoadedFor(subscriptionKey);
      },
      () => {
        setActiveBookings([]);
        setLoadedFor(subscriptionKey);
      },
    );
    const unsubscribeRequests = subscribeToDriverActiveRequests(
      subscriptionKey,
      setActiveRequests,
      () => setActiveRequests([]),
    );

    return () => {
      unsubscribeBookings();
      unsubscribeRequests();
    };
  }, [subscriptionKey]);

  const value = useMemo<DriverActivityContextValue>(
    () => ({
      activeBookings,
      activeRequests,
      loaded: subscriptionKey !== null && loadedFor === subscriptionKey,
      hasActiveTrip: activeBookings.length > 0,
    }),
    [activeBookings, activeRequests, loadedFor, subscriptionKey],
  );

  return (
    <DriverActivityContext.Provider value={value}>{children}</DriverActivityContext.Provider>
  );
}

export function useDriverActivity(): DriverActivityContextValue {
  const context = useContext(DriverActivityContext);
  if (!context) {
    throw new Error('useDriverActivity must be used within a DriverActivityProvider.');
  }
  return context;
}
