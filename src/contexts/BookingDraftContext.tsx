import { DEFAULT_FARE_SETTINGS } from '@/constants';
import { OUT_OF_AREA_FARE_SETTINGS } from '@/constants/outOfAreaFareSettings';
import { fetchFareConfig, TriGoFareConfig } from '@/services/fareService';
import { Location, TripQuote, VehicleType } from '@/types';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type LocationSelectionMode = 'pickup' | 'destination' | null;

export interface BookingDraftContextValue {
  pickupLocation: Location | null;
  destination: Location | null;
  vehicleType: VehicleType | null;
  tripQuote: TripQuote | null;
  activeOutOfAreaRequestId: string | null;
  activeBookingId: string | null;
  selectionMode: LocationSelectionMode;
  fareConfig: TriGoFareConfig;
  setPickupLocation: (location: Location | null) => void;
  setDestination: (location: Location | null) => void;
  setVehicleType: (vehicleType: VehicleType | null) => void;
  setTripQuote: (quote: TripQuote | null) => void;
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
  const [activeOutOfAreaRequestId, setActiveOutOfAreaRequestId] = useState<string | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<LocationSelectionMode>(null);

  const [fareConfig, setFareConfig] = useState<TriGoFareConfig>(DEFAULT_FARE_CONFIG);

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
      activeOutOfAreaRequestId,
      activeBookingId,
      selectionMode,
      fareConfig,
      setPickupLocation,
      setDestination,
      setVehicleType,
      setTripQuote,
      setActiveOutOfAreaRequestId,
      setActiveBookingId,
      setSelectionMode,
      clearDraft: () => {
        setPickupLocation(null);
        setDestination(null);
        setVehicleType(null);
        setTripQuote(null);
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
      activeOutOfAreaRequestId,
      activeBookingId,
      selectionMode,
      fareConfig,
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
