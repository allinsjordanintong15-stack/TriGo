import { useDriverAccess } from '@/hooks/useDriverAccess';
import { subscribeToBooking } from '@/services/bookingService';
import { subscribeToDriverActiveBookings } from '@/services/driverBookingService';
import {
  releaseCancelledBooking,
  subscribeToDriverActiveRequests,
} from '@/services/driverService';
import { Booking, OutOfAreaRequest } from '@/types';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

  // Passenger cancellations cannot touch drivers/{uid}, so the driver app releases itself:
  // only when currentBookingId points to a booking that is now `cancelled` do we clear it
  // and restore availability. Completion and driver cancellation clear it in their own commit.
  const currentBookingId = driverRecord?.currentBookingId ?? null;
  const driverRecordRef = useRef(driverRecord);
  driverRecordRef.current = driverRecord;
  const releasingFor = useRef<string | null>(null);

  useEffect(() => {
    if (!currentBookingId) {
      releasingFor.current = null;
      return;
    }

    return subscribeToBooking(
      currentBookingId,
      (booking) => {
        const record = driverRecordRef.current;
        if (
          booking.status !== 'cancelled' ||
          !record ||
          record.currentBookingId !== booking.bookingId ||
          releasingFor.current === booking.bookingId
        ) {
          return;
        }

        releasingFor.current = booking.bookingId;
        releaseCancelledBooking(record).catch(() => {
          // Allow a retry on the next snapshot or app start.
          releasingFor.current = null;
        });
      },
      () => {
        // Booking unreadable (e.g. offline); try again when the subscription restarts.
      },
    );
  }, [currentBookingId]);

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
