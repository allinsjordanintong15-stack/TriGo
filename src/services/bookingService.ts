import { DEFAULT_FARE_SETTINGS } from '@/constants';
import {
  MAX_REQUEST_EXPIRY_MINUTES,
  OUT_OF_AREA_FARE_SETTINGS,
} from '@/constants/outOfAreaFareSettings';
import { canPassengerCancelBooking } from '@/utils/booking';
import {
  getPassengerOfferState,
  PASSENGER_OFFER_TEXT,
  UnavailableOfferReason,
} from '@/utils/outOfAreaProposal';
import { COLLECTIONS, firestore } from '@/firebase';
import { declineProposal } from '@/services/fareAgreementService';
import { fetchBarangayTariffs } from '@/services/barangayTariffService';
import { findBarangayAt, isOutOfAreaTrip } from '@/services/serviceAreaService';
import {
  Booking,
  BookingType,
  CancelledBy,
  FareAgreement,
  FareBasis,
  FareSettings,
  Location,
  OutOfAreaFareSettings,
  OutOfAreaRequest,
  PaymentMethod,
  TripQuote,
  VehicleType,
} from '@/types';
import { formatPhilippinePeso } from '@/utils/fare';
import { BarangayTariffs, quoteFare } from '@/utils/fareQuote';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
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

export const ROAD_ROUTE_UNAVAILABLE_MESSAGE =
  "Couldn't get the road route. Check your connection and try again.";

export const NO_ROAD_NEAR_PIN_MESSAGE =
  "We couldn't find a road near your pin. Move the pickup or destination closer to a road.";

export function buildTripQuote(
  pickupLocation: Location,
  destinationLocation: Location,
  vehicleType: VehicleType,
  /** Road distance from routingService. Fares are never quoted on a straight line. */
  roadDistanceKm: number,
  fareSettings: FareSettings = DEFAULT_FARE_SETTINGS,
  /** Saved barangay tariffs; empty (all per-km) while loading or when they could not be read. */
  tariffs: BarangayTariffs = {},
): TripQuote {
  if (typeof roadDistanceKm !== 'number' || !Number.isFinite(roadDistanceKm) || roadDistanceKm < 0) {
    throw new BookingServiceError(ROAD_ROUTE_UNAVAILABLE_MESSAGE);
  }

  const distanceKm = roadDistanceKm;
  const isOutOfArea = isOutOfAreaTrip(pickupLocation, destinationLocation);
  const pickupBarangayId = findBarangayAt(pickupLocation.latitude, pickupLocation.longitude);
  const destinationBarangayId = findBarangayAt(
    destinationLocation.latitude,
    destinationLocation.longitude,
  );
  const fare = quoteFare({
    vehicleType,
    distanceKm,
    fareSettings,
    isOutOfArea,
    pickupBarangayId,
    destinationBarangayId,
    tariffs,
  });

  return {
    pickupLocation,
    destination: destinationLocation,
    vehicleType,
    distanceKm,
    standardEstimatedFare: fare.fare,
    bookingType: isOutOfArea ? 'out_of_area' : 'standard',
    isOutOfArea,
    fareBasis: fare.fareBasis,
    pickupBarangayId,
    destinationBarangayId,
    perKmRate: fare.perKmRate,
  };
}

/** The same trip priced again with the given settings and tariffs. */
function requoteTrip(quote: TripQuote, fareSettings: FareSettings, tariffs: BarangayTariffs): TripQuote {
  return buildTripQuote(
    quote.pickupLocation,
    quote.destination,
    quote.vehicleType,
    quote.distanceKm,
    fareSettings,
    tariffs,
  );
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

  if (!(quote.distanceKm > 0) || !(quote.standardEstimatedFare > 0)) {
    throw new BookingServiceError(ROAD_ROUTE_UNAVAILABLE_MESSAGE);
  }

  // Must stay within the rules' expiry window (see MAX_REQUEST_EXPIRY_MINUTES).
  const expiryMinutes =
    settings.requestExpiryMinutes > 0
      ? Math.min(settings.requestExpiryMinutes, MAX_REQUEST_EXPIRY_MINUTES)
      : MAX_REQUEST_EXPIRY_MINUTES;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

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
    updatedAt: serverTimestamp(),
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
    updatedAt: timestampToDate(data.updatedAt as Timestamp | null),
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
    // Bookings made before barangay tariffs (and all out-of-area bookings) lack these.
    fareBasis: (data.fareBasis as FareBasis | undefined) ?? 'per_km',
    pickupBarangayId: (data.pickupBarangayId as string | null | undefined) ?? null,
    destinationBarangayId: (data.destinationBarangayId as string | null | undefined) ?? null,
    perKmRate: (data.perKmRate as number | null | undefined) ?? null,
    driverProposedFare: (data.driverProposedFare as number | null) ?? null,
    agreedFare: (data.agreedFare as number | null) ?? null,
    fareAgreement: fareAgreement ? parseFareAgreement(fareAgreement) : null,
    finalFare: (data.finalFare as number | null) ?? null,
    status: data.status as Booking['status'],
    outOfAreaRequestId: (data.outOfAreaRequestId as string | null) ?? null,
    createdAt: timestampToDate(data.createdAt as Timestamp) ?? new Date(),
    updatedAt: timestampToDate(data.updatedAt as Timestamp) ?? new Date(),
    acceptedAt: timestampToDate(data.acceptedAt as Timestamp | null),
    arrivedAt: timestampToDate(data.arrivedAt as Timestamp | null),
    startedAt: timestampToDate(data.startedAt as Timestamp | null),
    completedAt: timestampToDate(data.completedAt as Timestamp | null),
    cancelledAt: timestampToDate(data.cancelledAt as Timestamp | null),
    // Older bookings predate these fields.
    paymentMethod: (data.paymentMethod as PaymentMethod | null) ?? null,
    cancelledBy: (data.cancelledBy as CancelledBy | null) ?? null,
    cancellationReason: (data.cancellationReason as string | null) ?? null,
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
    arrivedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    paymentMethod: null,
    cancelledBy: null,
    cancellationReason: null,
    ...overrides,
  };
}

/**
 * The tariff changed after the passenger saw the fare. Carries the trip priced again; the
 * passenger must see the new fare and confirm again (a changed fare is never booked
 * automatically).
 */
export class FareChangedError extends BookingServiceError {
  readonly quote: TripQuote;
  /** The tariffs the new fare was priced with; null when they could not be read (per-km). */
  readonly tariffs: BarangayTariffs | null;

  constructor(quote: TripQuote, tariffs: BarangayTariffs | null) {
    super(
      `The fare changed to ${formatPhilippinePeso(quote.standardEstimatedFare)}. Check it and confirm again.`,
    );
    this.name = 'FareChangedError';
    this.quote = quote;
    this.tariffs = tariffs;
  }
}

/** The rules accept a per-km rate above 0 with at most 2 decimals; anything else is left out. */
function storablePerKmRate(rate: number | null): number | null {
  return rate !== null && rate > 0 && Math.round(rate * 100) / 100 === rate ? rate : null;
}

/** Standard-only fields; the out-of-area booking rule does not allow them. */
function standardFareFields(quote: TripQuote) {
  return {
    fareBasis: quote.fareBasis,
    pickupBarangayId: quote.pickupBarangayId,
    destinationBarangayId: quote.destinationBarangayId,
    perKmRate: quote.fareBasis === 'per_km' ? storablePerKmRate(quote.perKmRate) : null,
  };
}

/**
 * Books a standard trip at the fare the passenger saw. Tariffs are read again first: if
 * the fare is now different, nothing is booked and FareChangedError carries the new fare.
 * When that read fails the quote is booked as shown; if the rules then refuse a tariff
 * fare (tariff changed or turned off meanwhile), the trip is priced again the same way.
 */
export async function createStandardBooking(
  passengerId: string,
  quote: TripQuote,
  fareSettings: FareSettings,
): Promise<Booking> {
  if (quote.isOutOfArea) {
    throw new BookingServiceError(
      'This trip requires an out-of-area request. Please use Request Out-of-Area Ride.',
    );
  }

  let bookedQuote = quote;
  const latestTariffs = await fetchBarangayTariffs();
  if (latestTariffs !== null) {
    const latest = requoteTrip(quote, fareSettings, latestTariffs);
    if (latest.standardEstimatedFare !== quote.standardEstimatedFare) {
      throw new FareChangedError(latest, latestTariffs);
    }
    // Same amount (e.g. a tariff equal to the per-km fare): book it with the current basis.
    bookedQuote = latest;
  }

  try {
    const docRef = await addDoc(
      collection(firestore, COLLECTIONS.bookings),
      buildBookingDocument(passengerId, bookedQuote, {
        bookingType: 'standard',
        status: 'pending',
        ...standardFareFields(bookedQuote),
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

    if (
      (error as { code?: string }).code === 'permission-denied' &&
      bookedQuote.fareBasis === 'barangay_tariff'
    ) {
      // No tariffs (read failed again) prices the trip per-km, which the rules accept.
      const retryTariffs = await fetchBarangayTariffs();
      const latest = requoteTrip(bookedQuote, fareSettings, retryTariffs ?? {});
      if (latest.standardEstimatedFare !== bookedQuote.standardEstimatedFare) {
        throw new FareChangedError(latest, retryTariffs);
      }
    }

    throw new BookingServiceError(
      'Unable to create your booking. Please check your internet connection and try again.',
    );
  }
}

/** The driver's offer was withdrawn, expired or otherwise closed before the passenger confirmed. */
export class ProposalUnavailableError extends BookingServiceError {
  readonly state: UnavailableOfferReason;

  constructor(state: UnavailableOfferReason) {
    super(PASSENGER_OFFER_TEXT[state].message);
    this.name = 'ProposalUnavailableError';
    this.state = state;
  }
}

/**
 * False when an admin revoked the driver. Passengers can read only verified driver
 * records, so a denied read means not verified. Other failures (e.g. offline) count as
 * still verified, so a connection problem never sends the passenger back to searching.
 */
async function isDriverStillVerified(driverId: string): Promise<boolean> {
  try {
    const snapshot = await getDoc(doc(firestore, COLLECTIONS.drivers, driverId));
    return snapshot.exists() && snapshot.data().isVerified === true;
  } catch (error) {
    return (error as { code?: string }).code !== 'permission-denied';
  }
}

/**
 * The passenger accepts the driver's fare and books the trip in one batch: the request
 * becomes accepted and bookings/{requestId} is created unassigned with the trip details
 * and fares copied from the request. Firestore rules require both in the same commit, an
 * open (negotiating) request and an unexpired offer.
 */
export async function acceptProposalAndCreateBooking(
  passengerId: string,
  request: OutOfAreaRequest,
): Promise<string> {
  if (request.passengerId !== passengerId) {
    throw new BookingServiceError('You are not authorized to confirm this booking.');
  }

  const offerState = getPassengerOfferState(request, Date.now());
  const proposal = request.fareAgreement;
  if (offerState === 'accepted') {
    throw new BookingServiceError('This fare has already been accepted.');
  }
  if (offerState !== 'open' || !proposal) {
    throw new ProposalUnavailableError(offerState === 'open' ? 'withdrawn' : offerState);
  }

  // agreedAt resolves to the commit time on both documents, as the rules require.
  const fareAgreement = {
    standardEstimatedFare: proposal.standardEstimatedFare,
    driverProposedFare: proposal.driverProposedFare,
    agreedFare: proposal.driverProposedFare,
    agreedByPassenger: true,
    agreedByDriver: proposal.agreedByDriver,
    agreedAt: serverTimestamp(),
  };

  const batch = writeBatch(firestore);
  batch.update(doc(firestore, COLLECTIONS.outOfAreaRequests, request.requestId), {
    status: 'accepted',
    agreedFare: proposal.driverProposedFare,
    fareAgreement,
    updatedAt: serverTimestamp(),
  });
  batch.set(
    doc(firestore, COLLECTIONS.bookings, request.requestId),
    buildBookingDocument(
      passengerId,
      {
        pickupLocation: request.pickupLocation,
        destination: request.destination,
        vehicleType: request.vehicleType,
        distanceKm: request.distanceKm,
        standardEstimatedFare: request.standardEstimatedFare,
        bookingType: 'out_of_area',
        isOutOfArea: true,
        // Not written: only createStandardBooking adds the fare basis fields.
        fareBasis: 'per_km',
        pickupBarangayId: null,
        destinationBarangayId: null,
        perKmRate: null,
      },
      {
        driverProposedFare: proposal.driverProposedFare,
        agreedFare: proposal.driverProposedFare,
        fareAgreement,
        // The agreed driver claims the booking themselves; the passenger never sets driverId.
        driverId: null,
        outOfAreaRequestId: request.requestId,
      },
    ),
  );

  try {
    await batch.commit();
  } catch (error) {
    if ((error as { code?: string }).code === 'permission-denied') {
      const latest = getPassengerOfferState(request, Date.now());
      // Still open as far as the passenger can tell: the rules also refuse a driver an
      // admin revoked since accepting. Put the request back to searching so the
      // passenger can choose another driver.
      if (latest === 'open' && request.driverId && !(await isDriverStillVerified(request.driverId))) {
        await declineProposal(request.requestId).catch(() => {
          // The request may have changed meanwhile; the search screen shows its state.
        });
        throw new ProposalUnavailableError('driver_not_verified');
      }
      // The driver withdrew, or the request expired or closed since the last snapshot.
      throw new ProposalUnavailableError(latest === 'expired' ? 'expired' : 'withdrawn');
    }
    throw new BookingServiceError(
      'Unable to create your booking. Please check your internet connection and try again.',
    );
  }

  return request.requestId;
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

/**
 * The passenger cancels before the ride starts (T5). A pending out-of-area booking has not
 * been claimed by the agreed driver yet, so its request (same id) is closed in the same
 * commit; that lets the driver release their reservation. The transaction re-reads the
 * booking, so if the driver claims first only the booking is cancelled and the driver is
 * released through releaseCancelledBooking like any assigned trip.
 */
export async function cancelBooking(
  bookingId: string,
  passengerId: string,
): Promise<Booking> {
  const bookingRef = doc(firestore, COLLECTIONS.bookings, bookingId);

  try {
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(bookingRef);
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

      transaction.update(bookingRef, {
        status: 'cancelled',
        cancelledBy: 'passenger',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Older out-of-area bookings were not stored at their request's id.
      if (
        booking.bookingType === 'out_of_area' &&
        booking.status === 'pending' &&
        booking.outOfAreaRequestId === bookingId
      ) {
        transaction.update(doc(firestore, COLLECTIONS.outOfAreaRequests, bookingId), {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    if (error instanceof BookingServiceError) {
      throw error;
    }
    throw new BookingServiceError(
      'Unable to cancel booking. Please check your internet connection and try again.',
    );
  }

  const updated = await getDoc(bookingRef);
  if (!updated.exists()) {
    throw new BookingServiceError('Unable to cancel booking.');
  }

  return docToBooking(updated.id, updated.data());
}
