import { DEFAULT_FARE_SETTINGS } from '@/constants';
import { OUT_OF_AREA_FARE_SETTINGS } from '@/constants/outOfAreaFareSettings';
import { fetchBarangayTariffs, TariffsStatus } from '@/services/barangayTariffService';
import { fetchFareConfig, TriGoFareConfig } from '@/services/fareService';
import { RoadRoute } from '@/services/routingService';
import { Location, TripQuote, VehicleType } from '@/types';
import { BarangayTariffs } from '@/utils/fareQuote';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type LocationSelectionMode = 'pickup' | 'destination' | null;

export interface BookingDraftContextValue {
  pickupLocation: Location | null;
  destination: Location | null;
  vehicleType: VehicleType | null;
  tripQuote: TripQuote | null;
  /** Road route behind `tripQuote`, kept in memory for the confirmation preview only. */
  tripRoute: RoadRoute | null;
  activeOutOfAreaRequestId: string | null;
  activeBookingId: string | null;
  selectionMode: LocationSelectionMode;
  fareConfig: TriGoFareConfig;
  /** Saved barangay tariffs; empty while loading or unavailable, so fares are per-km. */
  barangayTariffs: BarangayTariffs;
  tariffsStatus: TariffsStatus;
  /** Tariffs read again on Confirm (the fare changed); keeps later quotes in step. */
  setBarangayTariffs: (tariffs: BarangayTariffs) => void;
  setPickupLocation: (location: Location | null) => void;
  setDestination: (location: Location | null) => void;
  setVehicleType: (vehicleType: VehicleType | null) => void;
  setTripQuote: (quote: TripQuote | null) => void;
  setTripRoute: (route: RoadRoute | null) => void;
  setActiveOutOfAreaRequestId: (requestId: string | null) => void;
  setActiveBookingId: (bookingId: string | null) => void;
  setSelectionMode: (mode: LocationSelectionMode) => void;
  clearDraft: () => void;
}

const DEFAULT_FARE_CONFIG: TriGoFareConfig = {
  fares: DEFAULT_FARE_SETTINGS,
  outOfArea: OUT_OF_AREA_FARE_SETTINGS,
};

export const BookingDraftContext = createContext<BookingDraftContextValue | undefined>(
  undefined,
);

export function BookingDraftProvider({ children }: { children: ReactNode }) {
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [tripQuote, setTripQuote] = useState<TripQuote | null>(null);
  const [tripRoute, setTripRoute] = useState<RoadRoute | null>(null);
  const [activeOutOfAreaRequestId, setActiveOutOfAreaRequestId] = useState<string | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<LocationSelectionMode>(null);

  const [fareConfig, setFareConfig] = useState<TriGoFareConfig>(DEFAULT_FARE_CONFIG);
  const [tariffState, setTariffState] = useState<{
    tariffs: BarangayTariffs;
    status: TariffsStatus;
  }>({ tariffs: {}, status: 'loading' });

  // Times out after ~5 s; a failed or slow read leaves every fare per-km.
  useEffect(() => {
    let active = true;
    fetchBarangayTariffs().then((tariffs) => {
      if (!active) return;
      setTariffState(
        tariffs === null ? { tariffs: {}, status: 'unavailable' } : { tariffs, status: 'ready' },
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const setBarangayTariffs = useCallback((tariffs: BarangayTariffs) => {
    setTariffState({ tariffs, status: 'ready' });
  }, []);

  useEffect(() => {
    let active = true;
    fetchFareConfig()
      .then((config) => {
        if (active) setFareConfig(config);
      })
      .catch(() => {
        if (active) setFareConfig(DEFAULT_FARE_CONFIG);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<BookingDraftContextValue>(
    () => ({
      pickupLocation,
      destination,
      vehicleType,
      tripQuote,
      tripRoute,
      activeOutOfAreaRequestId,
      activeBookingId,
      selectionMode,
      fareConfig,
      barangayTariffs: tariffState.tariffs,
      tariffsStatus: tariffState.status,
      setBarangayTariffs,
      setPickupLocation,
      setDestination,
      setVehicleType,
      setTripQuote,
      setTripRoute,
      setActiveOutOfAreaRequestId,
      setActiveBookingId,
      setSelectionMode,
      clearDraft: () => {
        setPickupLocation(null);
        setDestination(null);
        setVehicleType(null);
        setTripQuote(null);
        setTripRoute(null);
        setActiveOutOfAreaRequestId(null);
        setActiveBookingId(null);
        setSelectionMode(null);
      },
    }),
    [
      pickupLocation,
      destination,
      vehicleType,
      tripQuote,
      tripRoute,
      activeOutOfAreaRequestId,
      activeBookingId,
      selectionMode,
      fareConfig,
      tariffState,
      setBarangayTariffs,
    ],
  );

  return (
    <BookingDraftContext.Provider value={value}>{children}</BookingDraftContext.Provider>
  );
}

export function useBookingDraft(): BookingDraftContextValue {
  const context = useContext(BookingDraftContext);
  if (!context) {
    throw new Error('useBookingDraft must be used within a BookingDraftProvider.');
  }
  return context;
}
