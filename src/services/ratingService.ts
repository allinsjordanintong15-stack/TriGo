import { RATING_TAG_IDS, type RatingTagId } from '@/constants/rating';
import { COLLECTIONS, firestore } from '@/firebase';
import { Booking, Rating } from '@/types';
import {
  DriverRatingSummary,
  isWithinRatingWindow,
  normalizeRatingComment,
  readRatingSummary,
  summaryAfterRating,
  validateRating,
} from '@/utils/rating';
import {
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

// Post-trip ratings without Cloud Functions: the passenger's app creates
// ratings/{bookingId} and updates driverRatings/{driverId} in one transaction, and
// firestore.rules checks both (one rating per completed trip, within the window, the sum
// and count raised by exactly this rating). The average shown is ratingSum / ratingCount.

export class RatingServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RatingServiceError';
  }
}

export const ALREADY_RATED_MESSAGE = 'You have already rated this trip. Thank you!';
export const RATING_CLOSED_MESSAGE = 'This trip can no longer be rated.';

function ratingRef(bookingId: string) {
  return doc(firestore, COLLECTIONS.ratings, bookingId);
}

function summaryRef(driverId: string) {
  return doc(firestore, COLLECTIONS.driverRatings, driverId);
}

function docToRating(data: DocumentData): Rating {
  return {
    bookingId: String(data.bookingId ?? ''),
    passengerId: String(data.passengerId ?? ''),
    driverId: String(data.driverId ?? ''),
    stars: typeof data.stars === 'number' ? data.stars : 0,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    comment: typeof data.comment === 'string' ? data.comment : null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
  };
}

/** The passenger's own rating of this trip, or null when not rated yet. */
export async function getOwnRating(bookingId: string): Promise<Rating | null> {
  try {
    const snapshot = await getDoc(ratingRef(bookingId));
    return snapshot.exists() ? docToRating(snapshot.data()) : null;
  } catch {
    throw new RatingServiceError(
      'Unable to load your rating. Please check your internet connection and try again.',
    );
  }
}

/** True when this trip has been rated. */
export async function hasRated(bookingId: string): Promise<boolean> {
  return (await getOwnRating(bookingId)) !== null;
}

/** The driver's rating sum and count, or null when nobody has rated them yet. */
export async function getDriverRatingSummary(driverId: string): Promise<DriverRatingSummary | null> {
  try {
    return readRatingSummary((await getDoc(summaryRef(driverId))).data());
  } catch {
    throw new RatingServiceError('Unable to load the driver rating.');
  }
}

/** Live summary (driver Home, driver card); null while missing or unreadable. */
export function subscribeToDriverRatingSummary(
  driverId: string,
  onUpdate: (summary: DriverRatingSummary | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    summaryRef(driverId),
    (snapshot) => onUpdate(readRatingSummary(snapshot.data())),
    (error) => onError(error),
  );
}

export interface RatingInput {
  stars: number;
  tags: RatingTagId[];
  comment: string;
}

/**
 * Rates the driver of a completed trip: creates ratings/{bookingId} and raises the driver's
 * summary in one transaction. Firestore retries the transaction if another passenger
 * rates the same driver at the same moment (the summary changed under it).
 */
export async function submitRating(
  booking: Booking,
  passengerId: string,
  input: RatingInput,
): Promise<Rating> {
  const invalid = validateRating(input.stars, input.comment);
  if (invalid) throw new RatingServiceError(invalid);
  const driverId = booking.driverId;
  if (booking.passengerId !== passengerId || !driverId) {
    throw new RatingServiceError(RATING_CLOSED_MESSAGE);
  }
  if (!isWithinRatingWindow(booking, Date.now())) {
    throw new RatingServiceError(RATING_CLOSED_MESSAGE);
  }

  const tags = input.tags.filter((tag, index, all) =>
    RATING_TAG_IDS.includes(tag) && all.indexOf(tag) === index,
  );
  const rating = {
    bookingId: booking.bookingId,
    passengerId,
    driverId,
    stars: input.stars,
    tags,
    comment: normalizeRatingComment(input.comment),
  };

  try {
    await runTransaction(firestore, async (transaction) => {
      const [existing, summarySnapshot] = await Promise.all([
        transaction.get(ratingRef(booking.bookingId)),
        transaction.get(summaryRef(driverId)),
      ]);
      if (existing.exists()) throw new RatingServiceError(ALREADY_RATED_MESSAGE);

      const next = summaryAfterRating(readRatingSummary(summarySnapshot.data()), rating.stars);
      transaction.set(ratingRef(booking.bookingId), { ...rating, createdAt: serverTimestamp() });
      transaction.set(summaryRef(driverId), {
        ...next,
        lastBookingId: booking.bookingId,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof RatingServiceError) throw error;
    const code = (error as { code?: string }).code;
    if (code === 'permission-denied') {
      // Refused by the rules: rated meanwhile, the window closed (the phone's clock may be
      // behind the server's), or the trip is not completed.
      throw new RatingServiceError(
        "We couldn't save your rating. This trip may already be rated or can no longer be rated.",
      );
    }
    throw new RatingServiceError(
      'Unable to send your rating. Please check your internet connection and try again.',
    );
  }

  return { ...rating, createdAt: new Date() };
}
