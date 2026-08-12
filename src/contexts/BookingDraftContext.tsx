import { Location, TripQuote, VehicleType } from '@/types';
import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export type LocationSelectionMode = 'pickup' | 'destination' | null;

export interface BookingDraftContextValue {
  pickupLocation: Location | null;
  destination: Location | null;
  vehicleType: VehicleType | null;
  tripQuote: TripQuote | null;
  activeOutOfAreaRequestId: string | null;
  selectionMode: LocationSelectionMode;
  setPickupLocation: (location: Location | null) => void;
  setDestination: (location: Location | null) => void;
  setVehicleType: (vehicleType: VehicleType | null) => void;
  setTripQuote: (quote: TripQuote | null) => void;
  setActiveOutOfAreaRequestId: (requestId: string | null) => void;
  setSelectionMode: (mode: LocationSelectionMode) => void;
  clearDraft: () => void;
}

export const BookingDraftContext = createContext<BookingDraftContextValue | undefined>(
  undefined,
);

export function BookingDraftProvider({ children }: { children: ReactNode }) {
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [tripQuote, setTripQuote] = useState<TripQuote | null>(null);
  const [activeOutOfAreaRequestId, setActiveOutOfAreaRequestId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<LocationSelectionMode>(null);

  const value = useMemo<BookingDraftContextValue>(
    () => ({
      pickupLocation,
      destination,
      vehicleType,
      tripQuote,
      activeOutOfAreaRequestId,
      selectionMode,
      setPickupLocation,
      setDestination,
      setVehicleType,
      setTripQuote,
      setActiveOutOfAreaRequestId,
      setSelectionMode,
      clearDraft: () => {
        setPickupLocation(null);
        setDestination(null);
        setVehicleType(null);
        setTripQuote(null);
        setActiveOutOfAreaRequestId(null);
        setSelectionMode(null);
      },
    }),
    [pickupLocation, destination, vehicleType, tripQuote, activeOutOfAreaRequestId, selectionMode],
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
