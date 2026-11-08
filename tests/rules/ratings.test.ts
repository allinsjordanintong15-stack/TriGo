/// <reference types="node" />

// Firestore rules tests for post-trip ratings: ratings/{bookingId} created in the same commit
// as the driver's summary driverRatings/{driverId} (no Cloud Functions).
// Run with `npm run test:rules` (starts the Firestore emulator under a demo project).
// Self-contained on purpose: Node's type stripping does not resolve the "@/..." aliases.

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';

setLogLevel('error');

const PASSENGER = 'passenger1';
const OTHER_PASSENGER = 'passenger2';
const DRIVER = 'driver1';
const OTHER_DRIVER = 'driver2';
const BOOKING = 'booking1';
const OTHER_BOOKING = 'booking2';

const DAY_MS = 24 * 60 * 60 * 1000;

let testEnv: RulesTestEnvironment;

function db(uid: string | null): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) {
      await setDoc(doc(firestore, path), data);
    }
  });
}

function completedBooking(overrides: DocumentData = {}): DocumentData {
  return {
    passengerId: PASSENGER,
    driverId: DRIVER,
    bookingType: 'standard',
    vehicleType: 'tricycle',
    status: 'completed',
    estimatedFare: 45,
    finalFare: 45,
    paymentMethod: 'cash',
    completedAt: Timestamp.fromMillis(Date.now() - 60 * 60 * 1000),
    ...overrides,
  };
}

interface RateOptions {
  uid?: string;
  bookingId?: string;
  stars?: unknown;
  tags?: unknown;
  comment?: unknown;
  rating?: DocumentData;
  /** The summary written with it; null = no summary write. */
  summary?: DocumentData | null;
  summaryDriverId?: string;
}

/** ratingService.submitRating as one commit: the rating + the driver's summary. */
function rate(options: RateOptions = {}) {
  const uid = options.uid ?? PASSENGER;
  const bookingId = options.bookingId ?? BOOKING;
  const stars = options.stars ?? 5;
  const firestore = db(uid);
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, 'ratings', bookingId), {
    bookingId,
    passengerId: uid,
    driverId: DRIVER,
    stars,
    tags: options.tags ?? ['on_time'],
    comment: options.comment === undefined ? 'Great ride' : options.comment,
    createdAt: serverTimestamp(),
    ...options.rating,
  });
  if (options.summary !== null) {
    batch.set(doc(firestore, 'driverRatings', options.summaryDriverId ?? DRIVER), {
      ratingSum: typeof stars === 'number' ? stars : 5,
      ratingCount: 1,
      lastBookingId: bookingId,
      updatedAt: serverTimestamp(),
      ...options.summary,
    });
  }
  return batch.commit();
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed({
    [`users/${PASSENGER}`]: { uid: PASSENGER, role: 'passenger' },
    [`users/${OTHER_PASSENGER}`]: { uid: OTHER_PASSENGER, role: 'passenger' },
    [`users/${DRIVER}`]: { uid: DRIVER, role: 'driver' },
    [`users/${OTHER_DRIVER}`]: { uid: OTHER_DRIVER, role: 'driver' },
    [`drivers/${DRIVER}`]: { isVerified: true, rating: 0, vehicleType: 'tricycle' },
    [`bookings/${BOOKING}`]: completedBooking(),
  });
});

describe('ratings: valid rating', () => {
  it("allows the booking's passenger to rate a completed trip (first rating, summary 5/1)", async () => {
    await assertSucceeds(rate());
  });

  it('allows a rating with no tags and no comment', async () => {
    await assertSucceeds(rate({ tags: [], comment: null, stars: 3 }));
  });

  it('raises an existing summary by exactly this rating', async () => {
    await seed({
      [`driverRatings/${DRIVER}`]: {
        ratingSum: 14,
        ratingCount: 3,
        lastBookingId: 'old',
        updatedAt: Timestamp.now(),
      },
    });
    await assertSucceeds(rate({ stars: 4, summary: { ratingSum: 18, ratingCount: 4 } }));
  });

  it('allows a 300-character comment and the last day of the window', async () => {
    await seed({
      [`bookings/${BOOKING}`]: completedBooking({
        completedAt: Timestamp.fromMillis(Date.now() - 7 * DAY_MS + 60 * 60 * 1000),
      }),
    });
    await assertSucceeds(rate({ comment: 'x'.repeat(300) }));
  });
});

describe('ratings: refused', () => {
  it('refuses a second rating of the same trip', async () => {
    await assertSucceeds(rate());
    await assertFails(rate({ stars: 1, summary: { ratingSum: 6, ratingCount: 2 } }));
  });

  it('refuses another passenger, the driver and signed-out users', async () => {
    await assertFails(rate({ uid: OTHER_PASSENGER }));
    await assertFails(rate({ uid: DRIVER }));
    await assertFails(rate({ uid: OTHER_DRIVER }));
  });

  for (const status of ['pending', 'accepted', 'arrived', 'in_progress', 'cancelled']) {
    it(`refuses rating a ${status} booking`, async () => {
      await seed({ [`bookings/${BOOKING}`]: completedBooking({ status }) });
      await assertFails(rate());
    });
  }

  it('refuses rating a booking that does not exist', async () => {
    await assertFails(rate({ bookingId: 'missing' }));
  });

  it('refuses rating more than 7 days after completion', async () => {
    await seed({
      [`bookings/${BOOKING}`]: completedBooking({
        completedAt: Timestamp.fromMillis(Date.now() - 7 * DAY_MS - 60 * 1000),
      }),
    });
    await assertFails(rate());
  });

  it('refuses a completed booking without completedAt', async () => {
    await seed({ [`bookings/${BOOKING}`]: completedBooking({ completedAt: null }) });
    await assertFails(rate());
  });

  for (const stars of [4.5, 6, 0, -1, '5']) {
    it(`refuses ${JSON.stringify(stars)} stars`, async () => {
      await assertFails(rate({ stars, summary: { ratingSum: 5 } }));
    });
  }

  it('refuses a comment over 300 characters or not text', async () => {
    await assertFails(rate({ comment: 'x'.repeat(301) }));
    await assertFails(rate({ comment: 42 }));
  });

  it('refuses unknown or repeated tags', async () => {
    await assertFails(rate({ tags: ['great_music'] }));
    await assertFails(rate({ tags: ['on_time', 'on_time'] }));
    await assertFails(rate({ tags: 'on_time' }));
  });

  it('refuses a rating naming another driver or passenger, or another booking id', async () => {
    await assertFails(rate({ rating: { driverId: OTHER_DRIVER }, summaryDriverId: OTHER_DRIVER }));
    await assertFails(rate({ rating: { passengerId: OTHER_PASSENGER } }));
    await assertFails(rate({ rating: { bookingId: OTHER_BOOKING } }));
  });

  it('refuses extra fields or a client createdAt', async () => {
    await assertFails(rate({ rating: { driverReply: 'thanks' } }));
    await assertFails(rate({ rating: { createdAt: Timestamp.now() } }));
  });
});

describe('ratings: the summary must match', () => {
  it('refuses a wrong sum or count (first rating)', async () => {
    await assertFails(rate({ stars: 4, summary: { ratingSum: 5 } }));
    await assertFails(rate({ stars: 4, summary: { ratingSum: 4, ratingCount: 2 } }));
  });

  it('refuses a summary computed from stale values', async () => {
    await seed({
      [`driverRatings/${DRIVER}`]: {
        ratingSum: 14,
        ratingCount: 3,
        lastBookingId: 'old',
        updatedAt: Timestamp.now(),
      },
    });
    // As if the summary were still 10 / 2 when the commit was built.
    await assertFails(rate({ stars: 4, summary: { ratingSum: 14, ratingCount: 3 } }));
    await assertFails(rate({ stars: 4, summary: { ratingSum: 18, ratingCount: 3 } }));
  });

  it('refuses a rating without the summary update', async () => {
    await assertFails(rate({ summary: null }));
  });

  it('refuses a summary pointing at another booking', async () => {
    await assertFails(rate({ summary: { lastBookingId: OTHER_BOOKING } }));
  });

  it('refuses a summary update without a new rating', async () => {
    await assertFails(
      setDoc(doc(db(PASSENGER), 'driverRatings', DRIVER), {
        ratingSum: 5,
        ratingCount: 1,
        lastBookingId: BOOKING,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('refuses re-using an existing rating to raise the summary again', async () => {
    await assertSucceeds(rate());
    await assertFails(
      setDoc(doc(db(PASSENGER), 'driverRatings', DRIVER), {
        ratingSum: 10,
        ratingCount: 2,
        lastBookingId: BOOKING,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('refuses the driver writing their own summary', async () => {
    await assertFails(
      setDoc(doc(db(DRIVER), 'driverRatings', DRIVER), {
        ratingSum: 50,
        ratingCount: 10,
        lastBookingId: BOOKING,
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('ratings: drivers.rating stays admin-only', () => {
  it('refuses a passenger or the driver writing drivers.rating', async () => {
    await assertFails(updateDoc(doc(db(PASSENGER), 'drivers', DRIVER), { rating: 5 }));
    await assertFails(updateDoc(doc(db(DRIVER), 'drivers', DRIVER), { rating: 5 }));
  });

  it('refuses writing drivers.rating in the rating commit', async () => {
    const firestore = db(PASSENGER);
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, 'ratings', BOOKING), {
      bookingId: BOOKING,
      passengerId: PASSENGER,
      driverId: DRIVER,
      stars: 5,
      tags: [],
      comment: null,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(firestore, 'driverRatings', DRIVER), {
      ratingSum: 5,
      ratingCount: 1,
      lastBookingId: BOOKING,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(firestore, 'drivers', DRIVER), { rating: 5 });
    await assertFails(batch.commit());
  });
});

describe('ratings: changes and reads', () => {
  it('refuses updating or deleting a rating', async () => {
    await assertSucceeds(rate());
    await assertFails(updateDoc(doc(db(PASSENGER), 'ratings', BOOKING), { stars: 1 }));
    await assertFails(deleteDoc(doc(db(PASSENGER), 'ratings', BOOKING)));
    await assertFails(deleteDoc(doc(db(PASSENGER), 'driverRatings', DRIVER)));
  });

  it('lets the passenger read their own rating and check an unrated trip', async () => {
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'ratings', BOOKING)));
    await assertSucceeds(rate());
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'ratings', BOOKING)));
  });

  it("refuses another passenger or the driver reading someone's rating", async () => {
    await assertSucceeds(rate());
    await assertFails(getDoc(doc(db(OTHER_PASSENGER), 'ratings', BOOKING)));
    await assertFails(getDoc(doc(db(DRIVER), 'ratings', BOOKING)));
  });

  it('lets an admin list driver summaries (Drivers page) and read ratings', async () => {
    await assertSucceeds(rate());
    const admin = testEnv.authenticatedContext('admin1', { admin: true }).firestore() as unknown as Firestore;
    await assertSucceeds(getDocs(collection(admin, 'driverRatings')));
    await assertSucceeds(getDoc(doc(admin, 'ratings', BOOKING)));
    await assertSucceeds(getDocs(collection(admin, 'ratings')));
  });

  it('refuses passengers listing all ratings', async () => {
    await assertFails(getDocs(collection(db(PASSENGER), 'ratings')));
  });

  it('lets signed-in users read a driver summary, not signed-out users', async () => {
    await assertSucceeds(rate());
    await assertSucceeds(getDoc(doc(db(OTHER_PASSENGER), 'driverRatings', DRIVER)));
    await assertSucceeds(getDoc(doc(db(DRIVER), 'driverRatings', DRIVER)));
    await assertFails(getDoc(doc(db(null), 'driverRatings', DRIVER)));
  });
});
