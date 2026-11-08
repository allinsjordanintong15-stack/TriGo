import { getDeclinedBookingIds, subscribeToOpenBookings } from '@/services/driverBookingService';
import { OpenOutOfAreaRequest, subscribeToOpenOutOfAreaRequests } from '@/services/driverService';
import { fetchFareConfig } from '@/services/fareService';
import { Booking, DriverRecord } from '@/types';
import { countOpenRequests } from '@/utils/openRequests';
import { useCallback, useEffect, useMemo, useState } from 'react';

/** How often the count drops requests that expired (expiry changes no snapshot). */
const COUNT_TICK_MS = 15 * 1000;

/**
 * Open passenger requests for this driver: ONE listener each for standard bookings and
 * out-of-area requests, shared by the Requests tab, the new-request alert and the Home
 * count (DriverActivityContext). Subscribed only while the driver can receive requests:
 * verified, online, available and not on a trip (the Requests tab's conditions).
 */
export interface OpenRequestFeed {
  /** True while the listeners run. */
  active: boolean;
  /** Raw snapshot; null while loading or not subscribed, [] after an error. */
  bookings: Booking[] | null;
  bookingsError: Error | null;
  /** Within the admin search radius; [] when the driver's location is unknown. */
  outOfArea: OpenOutOfAreaRequest[] | null;
  outOfAreaError: Error | null;
  /** Null until the admin radius has been read. */
  searchRadiusKm: number | null;
  /** Standard requests declined on this device. */
  declinedBookingIds: string[];
  /** Re-reads the declined list (e.g. when the Requests tab regains focus). */
  refreshDeclined: () => void;
  /** Requests the Requests tab would list right now; 0 when not subscribed. */
  count: number;
}

interface FeedInputs {
  driverRecord: DriverRecord | null;
  canPerformDriverActions: boolean;
  hasActiveTrip: boolean;
  hiddenRequestIds: string[];
}

export function useOpenRequestFeed({
  driverRecord,
  canPerformDriverActions,
  hasActiveTrip,
  hiddenRequestIds,
}: FeedInputs): OpenRequestFeed {
  const driverId = driverRecord?.driverId ?? null;
  const vehicleType = driverRecord?.vehicleType ?? null;
  const latitude = driverRecord?.currentLocation?.latitude ?? null;
  const longitude = driverRecord?.currentLocation?.longitude ?? null;
  const active =
    canPerformDriverActions &&
    driverRecord?.isOnline === true &&
    driverRecord.isAvailable === true &&
    !hasActiveTrip;

  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [bookingsError, setBookingsError] = useState<Error | null>(null);
  const [outOfArea, setOutOfArea] = useState<OpenOutOfAreaRequest[] | null>(null);
  const [outOfAreaError, setOutOfAreaError] = useState<Error | null>(null);
  const [searchRadiusKm, setSearchRadiusKm] = useState<number | null>(null);
  const [declinedBookingIds, setDeclinedBookingIds] = useState<string[]>([]);

  // Admin-managed radius from fareSettings, merged over the in-code defaults.
  useEffect(() => {
    let alive = true;
    fetchFareConfig().then((config) => {
      if (alive) setSearchRadiusKm(config.outOfArea.driverSearchRadiusKm);
    });
    return () => {
      alive = false;
    };
  }, []);

  const refreshDeclined = useCallback(() => {
    if (!driverId) return;
    getDeclinedBookingIds(driverId).then(setDeclinedBookingIds);
  }, [driverId]);

  useEffect(() => {
    setDeclinedBookingIds([]);
    refreshDeclined();
  }, [refreshDeclined]);

  useEffect(() => {
    setBookings(null);
    setBookingsError(null);
    if (!active || !vehicleType) return;

    return subscribeToOpenBookings(
      vehicleType,
      (open) => {
        setBookings(open);
        setBookingsError(null);
      },
      (error) => {
        setBookings([]);
        setBookingsError(error);
      },
    );
  }, [active, vehicleType]);

  useEffect(() => {
    setOutOfArea(null);
    setOutOfAreaError(null);
    if (!active || !vehicleType || searchRadiusKm === null) return;
    if (latitude === null || longitude === null) {
      setOutOfArea([]);
      return;
    }

    return subscribeToOpenOutOfAreaRequests(
      vehicleType,
      { latitude, longitude },
      searchRadiusKm,
      (open) => {
        setOutOfArea(open);
        setOutOfAreaError(null);
      },
      (error) => {
        setOutOfArea([]);
        setOutOfAreaError(error);
      },
    );
  }, [active, vehicleType, latitude, longitude, searchRadiusKm]);

  // Re-count now and then while anything is listed, so expired requests drop out.
  const [now, setNow] = useState(() => Date.now());
  const hasAny = (bookings?.length ?? 0) + (outOfArea?.length ?? 0) > 0;
  useEffect(() => {
    if (!hasAny) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), COUNT_TICK_MS);
    return () => clearInterval(timer);
  }, [hasAny]);

  const count = useMemo(
    () =>
      active
        ? countOpenRequests({ bookings, declinedBookingIds, outOfArea, hiddenRequestIds }, now)
        : 0,
    [active, bookings, declinedBookingIds, outOfArea, hiddenRequestIds, now],
  );

  return useMemo(
    () => ({
      active,
      bookings,
      bookingsError,
      outOfArea,
      outOfAreaError,
      searchRadiusKm,
      declinedBookingIds,
      refreshDeclined,
      count,
    }),
    [
      active,
      bookings,
      bookingsError,
      outOfArea,
      outOfAreaError,
      searchRadiusKm,
      declinedBookingIds,
      refreshDeclined,
      count,
    ],
  );
}
