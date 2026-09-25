import { DEFAULT_FARE_SETTINGS } from '@/constants';
import { OUT_OF_AREA_FARE_SETTINGS } from '@/constants/outOfAreaFareSettings';
import { canPassengerCancelBooking } from '@/utils/booking';
import { COLLECTIONS, firestore } from '@/firebase';
import { calculateEstimatedFare } from '@/services/fareService';
import { isOutOfAreaTrip } from '@/services/serviceAreaService';
import {
  Booking,
  BookingType,
  FareAgreement,
  FareSettings,
  Location,
  OutOfAreaFareSettings,
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
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
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
  fareSettings: FareSettings = DEFAULT_FARE_SETTINGS,
): TripQuote {
  const distanceKm = calculateDistanceKm(pickupLocation, destinationLocation);
  const standardEstimatedFare = calculateEstimatedFare(vehicleType, distanceKm, fareSettings);
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
  settings: OutOfAreaFareSettings = OUT_OF_AREA_FARE_SETTINGS,
): Promise<OutOfAreaRequest> {
  if (!quote.isOutOfArea) {
    throw new BookingServiceError('This trip is not an out-of-area request.');
  }

  if (!settings.enabled) {
    throw new BookingServiceError('Out-of-area requests are not available at this time.');
  }

  const expiresAt = new Date(
    Date.now() + settings.requestExpiryMinutes * 60 * 1000,
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

function buildBookingDocument(
  passengerId: string,
  quote: TripQuote,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    passengerId,
    driverId: null,
    vehicleType: quote.vehicleType,
    bookingType: quote.bookingType,
    pickupLocation: quote.pickupLocation,
    destination: quote.destination,
    distanceKm: quote.distanceKm,
    estimatedFare: quote.standardEstimatedFare,
    driverProposedFare: null,
    agreedFare: null,
    fareAgreement: null,
    finalFare: null,
    status: 'pending',
    outOfAreaRequestId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    acceptedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

export async function createStandardBooking(
  passengerId: string,
  quote: TripQuote,
): Promise<Booking> {
  if (quote.isOutOfArea) {
    throw new BookingServiceError(
      'This trip requires an out-of-area request. Please use Request Out-of-Area Ride.',
    );
  }

  try {
    const docRef = await addDoc(
      collection(firestore, COLLECTIONS.bookings),
      buildBookingDocument(passengerId, quote, {
        bookingType: 'standard',
        status: 'pending',
      }),
    );

    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      throw new BookingServiceError('Unable to create your booking. Please try again.');
    }

    return docToBooking(snapshot.id, snapshot.data());
  } catch (error) {
    if (error instanceof BookingServiceError) {
      throw error;
    }

    throw new BookingServiceError(
      'Unable to create your booking. Please check your internet connection and try again.',
    );
  }
}

export async function createOutOfAreaBooking(
  passengerId: string,
  quote: TripQuote,
  request: OutOfAreaRequest,
): Promise<Booking> {
  if (!request.agreedFare || !request.fareAgreement?.agreedByPassenger) {
    throw new BookingServiceError(
      'The agreed fare must be confirmed before creating your booking.',
    );
  }

  if (request.passengerId !== passengerId) {
    throw new BookingServiceError('You are not authorized to confirm this booking.');
  }

  try {
    const docRef = await addDoc(
      collection(firestore, COLLECTIONS.bookings),
      buildBookingDocument(passengerId, quote, {
        bookingType: 'out_of_area',
        status: 'pending',
        estimatedFare: request.standardEstimatedFare,
        driverProposedFare: request.fareAgreement.driverProposedFare,
        agreedFare: request.agreedFare,
        fareAgreement: {
          ...request.fareAgreement,
          agreedAt: request.fareAgreement.agreedAt ?? new Date(),
        },
        // Driver assignment happens through an authorized flow (driver app / Cloud
        // Function). The passenger must not set driverId.
        driverId: null,
        outOfAreaRequestId: request.requestId,
      }),
    );

    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      throw new BookingServiceError('Unable to create your booking. Please try again.');
    }

    return docToBooking(snapshot.id, snapshot.data());
  } catch (error) {
    if (error instanceof BookingServiceError) {
      throw error;
    }

    throw new BookingServiceError(
      'Unable to create your booking. Please check your internet connection and try again.',
    );
  }
}

export async function getBooking(bookingId: string): Promise<Booking | null> {
  const snapshot = await getDoc(doc(firestore, COLLECTIONS.bookings, bookingId));
  if (!snapshot.exists()) {
    return null;
  }

  return docToBooking(snapshot.id, snapshot.data());
}

export function subscribeToPassengerBookings(
  passengerId: string,
  onUpdate: (bookings: Booking[]) => void,
  onError: (error: Error) => void,
): () => void {
  const bookingsQuery = query(
    collection(firestore, COLLECTIONS.bookings),
    where('passengerId', '==', passengerId),
  );

  return onSnapshot(
    bookingsQuery,
    (snapshot) => {
      const bookings = snapshot.docs
        .map((d) => docToBooking(d.id, d.data()))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      onUpdate(bookings);
    },
    (error) => onError(error as Error),
  );
}

export function subscribeToBooking(
  bookingId: string,
  onUpdate: (booking: Booking) => void,
  onError: (error: Error) => void,
): () => void {
  const bookingRef = doc(firestore, COLLECTIONS.bookings, bookingId);

  return onSnapshot(
    bookingRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onError(new BookingServiceError('Booking not found.'));
        return;
      }

      onUpdate(docToBooking(snapshot.id, snapshot.data()));
    },
    (error) => onError(error),
  );
}

export async function cancelBooking(
  bookingId: string,
  passengerId: string,
): Promise<Booking> {
  const bookingRef = doc(firestore, COLLECTIONS.bookings, bookingId);
  const snapshot = await getDoc(bookingRef);

  if (!snapshot.exists()) {
    throw new BookingServiceError('Booking not found.');
  }

  const booking = docToBooking(snapshot.id, snapshot.data());

  if (booking.passengerId !== passengerId) {
    throw new BookingServiceError('You are not authorized to cancel this booking.');
  }

  if (!canPassengerCancelBooking(booking)) {
    throw new BookingServiceError('This booking can no longer be cancelled.');
  }

  await updateDoc(bookingRef, {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const updated = await getDoc(bookingRef);
  if (!updated.exists()) {
    throw new BookingServiceError('Unable to cancel booking.');
  }

  return docToBooking(updated.id, updated.data());
}
