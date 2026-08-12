import { OUT_OF_AREA_FARE_SETTINGS } from '@/constants/outOfAreaFareSettings';
import { COLLECTIONS, firestore } from '@/firebase';
import { calculateEstimatedFare } from '@/services/fareService';
import { isOutOfAreaTrip } from '@/services/serviceAreaService';
import {
  Booking,
  BookingType,
  FareAgreement,
  Location,
  OutOfAreaRequest,
  TripQuote,
  VehicleType,
} from '@/types';
import { calculateDistanceKm } from '@/utils/distance';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

export class BookingServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingServiceError';
  }
}

function timestampToDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return value.toDate();
}

export function buildTripQuote(
  pickupLocation: Location,
  destinationLocation: Location,
  vehicleType: VehicleType,
): TripQuote {
  const distanceKm = calculateDistanceKm(pickupLocation, destinationLocation);
  const standardEstimatedFare = calculateEstimatedFare(vehicleType, distanceKm);
  const isOutOfArea = isOutOfAreaTrip(pickupLocation, destinationLocation);

  return {
    pickupLocation,
    destination: destinationLocation,
    vehicleType,
    distanceKm,
    standardEstimatedFare,
    bookingType: isOutOfArea ? 'out_of_area' : 'standard',
    isOutOfArea,
  };
}

export async function createOutOfAreaRequest(
  passengerId: string,
  quote: TripQuote,
): Promise<OutOfAreaRequest> {
  if (!quote.isOutOfArea) {
    throw new BookingServiceError('This trip is not an out-of-area request.');
  }

  if (!OUT_OF_AREA_FARE_SETTINGS.enabled) {
    throw new BookingServiceError('Out-of-area requests are not available at this time.');
  }

  const expiresAt = new Date(
    Date.now() + OUT_OF_AREA_FARE_SETTINGS.requestExpiryMinutes * 60 * 1000,
  );

  const requestData = {
    passengerId,
    pickupLocation: quote.pickupLocation,
    destination: quote.destination,
    vehicleType: quote.vehicleType,
    distanceKm: quote.distanceKm,
    standardEstimatedFare: quote.standardEstimatedFare,
    suggestedAgreementFare: null,
    agreedFare: null,
    status: 'searching' as const,
    driverId: null,
    fareAgreement: null,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  };

  const docRef = await addDoc(collection(firestore, COLLECTIONS.outOfAreaRequests), requestData);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new BookingServiceError('Unable to create your out-of-area request.');
  }

  return docToOutOfAreaRequest(snapshot.id, snapshot.data());
}

export async function cancelOutOfAreaRequest(requestId: string): Promise<void> {
  const requestRef = doc(firestore, COLLECTIONS.outOfAreaRequests, requestId);
  await updateDoc(requestRef, {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToOutOfAreaRequest(
  requestId: string,
  onUpdate: (request: OutOfAreaRequest) => void,
  onError: (error: Error) => void,
): () => void {
  const requestRef = doc(firestore, COLLECTIONS.outOfAreaRequests, requestId);

  return onSnapshot(
    requestRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onError(new BookingServiceError('Out-of-area request not found.'));
        return;
      }

      onUpdate(docToOutOfAreaRequest(snapshot.id, snapshot.data()));
    },
    (error) => onError(error),
  );
}

export function docToOutOfAreaRequest(id: string, data: Record<string, unknown>): OutOfAreaRequest {
  const fareAgreement = data.fareAgreement as Record<string, unknown> | null;

  return {
    requestId: id,
    passengerId: data.passengerId as string,
    pickupLocation: data.pickupLocation as Location,
    destination: data.destination as Location,
    vehicleType: data.vehicleType as VehicleType,
    distanceKm: data.distanceKm as number,
    standardEstimatedFare: data.standardEstimatedFare as number,
    suggestedAgreementFare: (data.suggestedAgreementFare as number | null) ?? null,
    agreedFare: (data.agreedFare as number | null) ?? null,
    status: data.status as OutOfAreaRequest['status'],
    driverId: (data.driverId as string | null) ?? null,
    fareAgreement: fareAgreement ? parseFareAgreement(fareAgreement) : null,
    createdAt: timestampToDate(data.createdAt as Timestamp) ?? new Date(),
    expiresAt: timestampToDate(data.expiresAt as Timestamp | null),
  };
}

function parseFareAgreement(data: Record<string, unknown>): FareAgreement {
  return {
    standardEstimatedFare: data.standardEstimatedFare as number,
    driverProposedFare: data.driverProposedFare as number,
    agreedFare: data.agreedFare as number,
    agreedByPassenger: Boolean(data.agreedByPassenger),
    agreedByDriver: Boolean(data.agreedByDriver),
    agreedAt: timestampToDate(data.agreedAt as Timestamp | null),
  };
}

export function docToBooking(id: string, data: Record<string, unknown>): Booking {
  const fareAgreement = data.fareAgreement as Record<string, unknown> | null;

  return {
    bookingId: id,
    passengerId: data.passengerId as string,
    driverId: (data.driverId as string | null) ?? null,
    vehicleType: data.vehicleType as VehicleType,
    bookingType: (data.bookingType as BookingType) ?? 'standard',
    pickupLocation: data.pickupLocation as Location,
    destination: data.destination as Location,
    distanceKm: data.distanceKm as number,
    estimatedFare: data.estimatedFare as number,
    driverProposedFare: (data.driverProposedFare as number | null) ?? null,
    agreedFare: (data.agreedFare as number | null) ?? null,
    fareAgreement: fareAgreement ? parseFareAgreement(fareAgreement) : null,
    finalFare: (data.finalFare as number | null) ?? null,
    status: data.status as Booking['status'],
    outOfAreaRequestId: (data.outOfAreaRequestId as string | null) ?? null,
    createdAt: timestampToDate(data.createdAt as Timestamp) ?? new Date(),
    updatedAt: timestampToDate(data.updatedAt as Timestamp) ?? new Date(),
    acceptedAt: timestampToDate(data.acceptedAt as Timestamp | null),
    startedAt: timestampToDate(data.startedAt as Timestamp | null),
    completedAt: timestampToDate(data.completedAt as Timestamp | null),
    cancelledAt: timestampToDate(data.cancelledAt as Timestamp | null),
  };
}

// Standard booking creation — completed in Phase 4.
export async function createStandardBooking(
  _passengerId: string,
  _quote: TripQuote,
): Promise<Booking> {
  throw new BookingServiceError('Standard booking confirmation is available in the next step.');
}
