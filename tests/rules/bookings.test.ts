/// <reference types="node" />

// Firestore rules tests for standard bookings (create, read, T1-T6, final states).
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
  query,
  serverTimestamp,
  setDoc,
  setLogLevel,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';

// Denied writes are expected; keep the SDK's PERMISSION_DENIED warnings out of the output.
setLogLevel('error');

const PASSENGER = 'passenger1';
const OTHER_PASSENGER = 'passenger2';
const DRIVER = 'driver1';
const OTHER_DRIVER = 'driver2';
const UNVERIFIED_DRIVER = 'driver3';
const BOOKING = 'booking1';

const ESTIMATED_FARE = 45;

let testEnv: RulesTestEnvironment;

function db(uid: string | null): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function location(address: string) {
  return { latitude: 9.97, longitude: 124.48, address };
}

function newBooking(overrides: DocumentData = {}): DocumentData {
  return {
    passengerId: PASSENGER,
    driverId: null,
    bookingType: 'standard',
    vehicleType: 'tricycle',
    pickupLocation: location('Poblacion, Trinidad'),
    destination: location('Kinan-oan, Trinidad'),
    distanceKm: 3.2,
    estimatedFare: ESTIMATED_FARE,
    driverProposedFare: null,
    agreedFare: null,
    finalFare: null,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function driverRecord(overrides: DocumentData = {}): DocumentData {
  return {
    isVerified: true,
    isOnline: true,
    isAvailable: true,
    vehicleType: 'tricycle',
    currentBookingId: null,
    ...overrides,
  };
}

/** Writes documents with rules disabled (test fixtures). */
async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) {
      await setDoc(doc(firestore, path), data);
    }
  });
}

/** A booking assigned to DRIVER in the given status, with DRIVER linked to it. */
async function seedAssignedBooking(status: string, extra: DocumentData = {}): Promise<void> {
  await seed({
    [`bookings/${BOOKING}`]: newBooking({ status, driverId: DRIVER, ...extra }),
    [`drivers/${DRIVER}`]: driverRecord({ isAvailable: false, currentBookingId: BOOKING }),
  });
}

/** T1 as driverBookingService.acceptBooking writes it: booking + driver in one commit. */
function acceptBatch(uid: string, bookingId = BOOKING) {
  const firestore = db(uid);
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'bookings', bookingId), {
    driverId: uid,
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(firestore, 'drivers', uid), {
    isAvailable: false,
    currentBookingId: bookingId,
    updatedAt: serverTimestamp(),
  });
  return batch.commit();
}

/** T4 / T6 driver record update: unlink the booking and become available again. */
function tripEndBatch(bookingUpdate: DocumentData) {
  const firestore = db(DRIVER);
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'bookings', BOOKING), bookingUpdate);
  batch.update(doc(firestore, 'drivers', DRIVER), {
    currentBookingId: null,
    isOnline: true,
    isAvailable: true,
    updatedAt: serverTimestamp(),
  });
  return batch.commit();
}

function completeUpdate(overrides: DocumentData = {}): DocumentData {
  return {
    status: 'completed',
    completedAt: serverTimestamp(),
    finalFare: ESTIMATED_FARE,
    paymentMethod: 'cash',
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function cancelUpdate(cancelledBy: string, overrides: DocumentData = {}): DocumentData {
  return {
    status: 'cancelled',
    cancelledBy,
    cancellationReason: 'Changed plans',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed({
    [`users/${PASSENGER}`]: { uid: PASSENGER, role: 'passenger' },
    [`users/${OTHER_PASSENGER}`]: { uid: OTHER_PASSENGER, role: 'passenger' },
    [`users/${DRIVER}`]: { uid: DRIVER, role: 'driver' },
    [`users/${OTHER_DRIVER}`]: { uid: OTHER_DRIVER, role: 'driver' },
    [`users/${UNVERIFIED_DRIVER}`]: { uid: UNVERIFIED_DRIVER, role: 'driver' },
    [`drivers/${DRIVER}`]: driverRecord(),
    [`drivers/${OTHER_DRIVER}`]: driverRecord(),
    [`drivers/${UNVERIFIED_DRIVER}`]: driverRecord({ isVerified: false, isOnline: false, isAvailable: false }),
  });
});

describe('standard booking: create', () => {
  it('allows a passenger to create an unassigned pending booking', async () => {
    await assertSucceeds(setDoc(doc(db(PASSENGER), 'bookings', BOOKING), newBooking()));
  });

  it('denies a signed-out user', async () => {
    await assertFails(setDoc(doc(db(null), 'bookings', BOOKING), newBooking()));
  });

  it('denies creating a booking for another passenger', async () => {
    await assertFails(
      setDoc(doc(db(PASSENGER), 'bookings', BOOKING), newBooking({ passengerId: OTHER_PASSENGER })),
    );
  });

  it('denies a passenger assigning a driver', async () => {
    await assertFails(setDoc(doc(db(PASSENGER), 'bookings', BOOKING), newBooking({ driverId: DRIVER })));
  });

  it('denies a status other than pending', async () => {
    await assertFails(setDoc(doc(db(PASSENGER), 'bookings', BOOKING), newBooking({ status: 'accepted' })));
  });

  it('denies an unknown vehicle type', async () => {
    await assertFails(setDoc(doc(db(PASSENGER), 'bookings', BOOKING), newBooking({ vehicleType: 'van' })));
  });

  it('denies an invalid pickup location', async () => {
    await assertFails(
      setDoc(doc(db(PASSENGER), 'bookings', BOOKING), newBooking({ pickupLocation: { address: 'x' } })),
    );
  });

  it('denies a non-numeric estimated fare', async () => {
    await assertFails(setDoc(doc(db(PASSENGER), 'bookings', BOOKING), newBooking({ estimatedFare: '45' })));
  });

  it('denies a driver-role account', async () => {
    await assertFails(
      setDoc(doc(db(DRIVER), 'bookings', BOOKING), newBooking({ passengerId: DRIVER })),
    );
  });
});

// Barangay tariffs (2026-10-28): new bookings store fareBasis, the pickup and destination
// barangay IDs, and perKmRate on per-km bookings. A missing fareBasis (older app versions)
// is per-km. A barangay_tariff booking is Poblacion <-> X with X's tariff active and the fare
// equal to it for the vehicle type.
describe('standard booking: fare basis', () => {
  const TARIFFS = {
    bongbong: { name: 'Bongbong', tricycle: 40.5, motorcycle: 30.25, active: true },
    soom: { name: 'Soom', tricycle: 50, motorcycle: 45, active: false },
  };

  beforeEach(async () => {
    await seed(
      Object.fromEntries(
        Object.entries(TARIFFS).map(([id, row]) => [
          `barangayTariffs/${id}`,
          { ...row, updatedAt: new Date(), updatedBy: 'admin1' },
        ]),
      ),
    );
  });

  function create(overrides: DocumentData) {
    return setDoc(doc(db(PASSENGER), 'bookings', BOOKING), newBooking(overrides));
  }

  function tariffBooking(overrides: DocumentData = {}): DocumentData {
    return {
      fareBasis: 'barangay_tariff',
      pickupBarangayId: 'poblacion',
      destinationBarangayId: 'bongbong',
      estimatedFare: 40.5,
      ...overrides,
    };
  }

  function perKmBooking(overrides: DocumentData = {}): DocumentData {
    return {
      fareBasis: 'per_km',
      pickupBarangayId: 'bongbong',
      destinationBarangayId: 'soom',
      perKmRate: 8.5,
      ...overrides,
    };
  }

  it('allows the older shape without fareBasis (per-km)', async () => {
    await assertSucceeds(create({}));
  });

  it('allows a per-km booking with barangay IDs and the per-km rate', async () => {
    await assertSucceeds(create(perKmBooking()));
  });

  it('allows a per-km booking with no barangay (null IDs) and no rate', async () => {
    await assertSucceeds(
      create(perKmBooking({ pickupBarangayId: null, destinationBarangayId: null, perKmRate: null })),
    );
  });

  it('allows a per-km booking from Poblacion to a barangay with a tariff (not checked; known limit)', async () => {
    await assertSucceeds(create(perKmBooking({ pickupBarangayId: 'poblacion', destinationBarangayId: 'bongbong' })));
  });

  it('allows Poblacion -> Bongbong at the tricycle tariff', async () => {
    await assertSucceeds(create(tariffBooking()));
  });

  it('allows Bongbong -> Poblacion at the motorcycle tariff', async () => {
    await assertSucceeds(
      create(
        tariffBooking({
          vehicleType: 'motorcycle',
          pickupBarangayId: 'bongbong',
          destinationBarangayId: 'poblacion',
          estimatedFare: 30.25,
        }),
      ),
    );
  });

  it('lets a driver accept and complete a tariff booking at the tariff', async () => {
    await assertSucceeds(create(tariffBooking()));
    await assertSucceeds(acceptBatch(DRIVER));
    await assertSucceeds(
      updateDoc(doc(db(DRIVER), 'bookings', BOOKING), {
        status: 'arrived',
        arrivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(db(DRIVER), 'bookings', BOOKING), {
        status: 'in_progress',
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(tripEndBatch(completeUpdate({ finalFare: 40.5 })));
  });

  it('denies a tariff booking whose fare is not the tariff', async () => {
    await assertFails(create(tariffBooking({ estimatedFare: 40 })));
  });

  it("denies a tariff booking at the other vehicle type's tariff", async () => {
    await assertFails(create(tariffBooking({ estimatedFare: 30.25 })));
  });

  it('denies a tariff booking for a barangay whose tariff is inactive', async () => {
    await assertFails(create(tariffBooking({ destinationBarangayId: 'soom', estimatedFare: 50 })));
  });

  it('denies a tariff booking for a barangay with no tariff saved', async () => {
    await assertFails(create(tariffBooking({ destinationBarangayId: 'guinobatan', estimatedFare: 40.5 })));
  });

  it('denies a tariff booking between two barangays (neither end Poblacion)', async () => {
    await assertFails(create(tariffBooking({ pickupBarangayId: 'soom' })));
  });

  it('denies a tariff booking within Poblacion', async () => {
    await assertFails(create(tariffBooking({ destinationBarangayId: 'poblacion' })));
  });

  it('denies a tariff booking with a missing barangay', async () => {
    await assertFails(create(tariffBooking({ destinationBarangayId: null })));
  });

  it('denies a tariff booking that also stores a per-km rate', async () => {
    await assertFails(create(tariffBooking({ perKmRate: 8.5 })));
  });

  it('denies an unknown fare basis', async () => {
    await assertFails(create(perKmBooking({ fareBasis: 'flat' })));
  });

  for (const [label, perKmRate] of [
    ['zero', 0],
    ['negative', -8],
    ['more than 2 decimals', 8.125],
    ['non-numeric', '8.5'],
  ] as const) {
    it(`denies a per-km rate that is ${label}`, async () => {
      await assertFails(create(perKmBooking({ perKmRate })));
    });
  }

  it('allows a valid per-km rate without a fare basis (counts as per-km)', async () => {
    await assertSucceeds(create({ perKmRate: 8.5 }));
  });

  it('denies an invalid per-km rate without a fare basis', async () => {
    await assertFails(create({ perKmRate: 0 }));
  });

  it('denies a non-string or overlong barangay ID', async () => {
    await assertFails(create(perKmBooking({ pickupBarangayId: 7 })));
    await assertFails(create(perKmBooking({ destinationBarangayId: 'x'.repeat(41) })));
    await assertFails(create(perKmBooking({ pickupBarangayId: '' })));
  });
});

describe('standard booking: read', () => {
  beforeEach(async () => {
    await seed({ [`bookings/${BOOKING}`]: newBooking() });
  });

  it('allows the passenger to read their own booking', async () => {
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'bookings', BOOKING)));
  });

  it('denies another passenger', async () => {
    await assertFails(getDoc(doc(db(OTHER_PASSENGER), 'bookings', BOOKING)));
  });

  it('allows a verified driver to read an open standard booking', async () => {
    await assertSucceeds(getDoc(doc(db(DRIVER), 'bookings', BOOKING)));
  });

  it('allows a verified driver to list open standard bookings', async () => {
    const openRequests = query(
      collection(db(DRIVER), 'bookings'),
      where('status', '==', 'pending'),
      where('driverId', '==', null),
      where('bookingType', '==', 'standard'),
    );
    await assertSucceeds(getDocs(openRequests));
  });

  it('denies an unverified driver reading an open booking', async () => {
    await assertFails(getDoc(doc(db(UNVERIFIED_DRIVER), 'bookings', BOOKING)));
  });

  it('denies a driver listing bookings without the open-request filters', async () => {
    await assertFails(getDocs(query(collection(db(DRIVER), 'bookings'), where('status', '==', 'pending'))));
  });

  it('denies a verified driver reading an open out-of-area booking', async () => {
    await seed({ [`bookings/${BOOKING}`]: newBooking({ bookingType: 'out_of_area' }) });
    await assertFails(getDoc(doc(db(DRIVER), 'bookings', BOOKING)));
  });

  it('allows the assigned driver to read an accepted booking', async () => {
    await seedAssignedBooking('accepted');
    await assertSucceeds(getDoc(doc(db(DRIVER), 'bookings', BOOKING)));
  });

  it('denies another driver reading an accepted booking', async () => {
    await seedAssignedBooking('accepted');
    await assertFails(getDoc(doc(db(OTHER_DRIVER), 'bookings', BOOKING)));
  });
});

describe('standard booking: T1 accept', () => {
  beforeEach(async () => {
    await seed({ [`bookings/${BOOKING}`]: newBooking() });
  });

  it('allows a verified, online, available driver to accept with the driver link', async () => {
    await assertSucceeds(acceptBatch(DRIVER));
  });

  it('denies accepting without updating the driver record in the same commit', async () => {
    await assertFails(
      updateDoc(doc(db(DRIVER), 'bookings', BOOKING), {
        driverId: DRIVER,
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies an offline driver', async () => {
    await seed({ [`drivers/${DRIVER}`]: driverRecord({ isOnline: false, isAvailable: false }) });
    await assertFails(acceptBatch(DRIVER));
  });

  it('denies an unverified driver', async () => {
    await assertFails(acceptBatch(UNVERIFIED_DRIVER));
  });

  it('denies a driver with a different vehicle type', async () => {
    await seed({ [`drivers/${DRIVER}`]: driverRecord({ vehicleType: 'motorcycle' }) });
    await assertFails(acceptBatch(DRIVER));
  });

  it('denies a driver already linked to another booking', async () => {
    await seed({ [`drivers/${DRIVER}`]: driverRecord({ currentBookingId: 'other-booking' }) });
    await assertFails(acceptBatch(DRIVER));
  });

  it('denies a driver reserved by an out-of-area proposal, even if marked available', async () => {
    // isAvailable is left true so only the currentRequestId check can deny it.
    await seed({ [`drivers/${DRIVER}`]: driverRecord({ currentRequestId: 'request1' }) });
    await assertFails(acceptBatch(DRIVER));
  });

  it('denies accepting a booking another driver already accepted', async () => {
    await seed({ [`bookings/${BOOKING}`]: newBooking({ status: 'accepted', driverId: OTHER_DRIVER }) });
    await assertFails(acceptBatch(DRIVER));
  });

  it('denies accepting an out-of-area booking', async () => {
    await seed({ [`bookings/${BOOKING}`]: newBooking({ bookingType: 'out_of_area' }) });
    await assertFails(acceptBatch(DRIVER));
  });

  it('denies accepting for another driver', async () => {
    const firestore = db(DRIVER);
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'bookings', BOOKING), {
      driverId: OTHER_DRIVER,
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(firestore, 'drivers', DRIVER), {
      isAvailable: false,
      currentBookingId: BOOKING,
      updatedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('denies changing the fare while accepting', async () => {
    const firestore = db(DRIVER);
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'bookings', BOOKING), {
      driverId: DRIVER,
      status: 'accepted',
      estimatedFare: 999,
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(firestore, 'drivers', DRIVER), {
      isAvailable: false,
      currentBookingId: BOOKING,
      updatedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('denies a passenger accepting a booking', async () => {
    await assertFails(
      updateDoc(doc(db(PASSENGER), 'bookings', BOOKING), {
        driverId: DRIVER,
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('standard booking: T2-T4 trip progress', () => {
  it('allows the assigned driver to mark arrived', async () => {
    await seedAssignedBooking('accepted');
    await assertSucceeds(
      updateDoc(doc(db(DRIVER), 'bookings', BOOKING), {
        status: 'arrived',
        arrivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies another driver marking arrived', async () => {
    await seedAssignedBooking('accepted');
    await assertFails(
      updateDoc(doc(db(OTHER_DRIVER), 'bookings', BOOKING), {
        status: 'arrived',
        arrivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies skipping from accepted to in_progress', async () => {
    await seedAssignedBooking('accepted');
    await assertFails(
      updateDoc(doc(db(DRIVER), 'bookings', BOOKING), {
        status: 'in_progress',
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('allows the assigned driver to start the trip after arriving', async () => {
    await seedAssignedBooking('arrived');
    await assertSucceeds(
      updateDoc(doc(db(DRIVER), 'bookings', BOOKING), {
        status: 'in_progress',
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies the passenger moving the trip forward', async () => {
    await seedAssignedBooking('arrived');
    await assertFails(
      updateDoc(doc(db(PASSENGER), 'bookings', BOOKING), {
        status: 'in_progress',
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('allows completing with finalFare equal to estimatedFare and unlinking the driver', async () => {
    await seedAssignedBooking('in_progress');
    await assertSucceeds(tripEndBatch(completeUpdate()));
  });

  it('denies completing with a different finalFare', async () => {
    await seedAssignedBooking('in_progress');
    await assertFails(tripEndBatch(completeUpdate({ finalFare: ESTIMATED_FARE + 10 })));
  });

  it('denies an unknown payment method', async () => {
    await seedAssignedBooking('in_progress');
    await assertFails(tripEndBatch(completeUpdate({ paymentMethod: 'card' })));
  });

  it('denies completing before the trip starts', async () => {
    await seedAssignedBooking('arrived');
    await assertFails(tripEndBatch(completeUpdate()));
  });

  it('denies unlinking the driver while the booking is still active', async () => {
    await seedAssignedBooking('in_progress');
    await assertFails(
      updateDoc(doc(db(DRIVER), 'drivers', DRIVER), {
        currentBookingId: null,
        isAvailable: true,
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('standard booking: T5 passenger cancel', () => {
  for (const status of ['pending', 'accepted', 'arrived']) {
    it(`allows the passenger to cancel a ${status} booking`, async () => {
      await seed({
        [`bookings/${BOOKING}`]: newBooking(status === 'pending' ? {} : { status, driverId: DRIVER }),
      });
      await assertSucceeds(updateDoc(doc(db(PASSENGER), 'bookings', BOOKING), cancelUpdate('passenger')));
    });
  }

  it('denies cancelling once the trip is in progress', async () => {
    await seedAssignedBooking('in_progress');
    await assertFails(updateDoc(doc(db(PASSENGER), 'bookings', BOOKING), cancelUpdate('passenger')));
  });

  it('denies another passenger cancelling', async () => {
    await seed({ [`bookings/${BOOKING}`]: newBooking() });
    await assertFails(updateDoc(doc(db(OTHER_PASSENGER), 'bookings', BOOKING), cancelUpdate('passenger')));
  });

  it('denies cancelling as the driver from the passenger side', async () => {
    await seed({ [`bookings/${BOOKING}`]: newBooking() });
    await assertFails(updateDoc(doc(db(PASSENGER), 'bookings', BOOKING), cancelUpdate('driver')));
  });

  it('denies a cancellation reason longer than 200 characters', async () => {
    await seed({ [`bookings/${BOOKING}`]: newBooking() });
    await assertFails(
      updateDoc(
        doc(db(PASSENGER), 'bookings', BOOKING),
        cancelUpdate('passenger', { cancellationReason: 'x'.repeat(201) }),
      ),
    );
  });

  it('denies changing the fare while cancelling', async () => {
    await seed({ [`bookings/${BOOKING}`]: newBooking() });
    await assertFails(
      updateDoc(doc(db(PASSENGER), 'bookings', BOOKING), cancelUpdate('passenger', { estimatedFare: 1 })),
    );
  });
});

describe('standard booking: T6 driver cancel', () => {
  for (const status of ['accepted', 'arrived']) {
    it(`allows the assigned driver to cancel an ${status} booking and unlink`, async () => {
      await seedAssignedBooking(status);
      await assertSucceeds(tripEndBatch(cancelUpdate('driver')));
    });
  }

  it('denies cancelling once the trip is in progress', async () => {
    await seedAssignedBooking('in_progress');
    await assertFails(tripEndBatch(cancelUpdate('driver')));
  });

  it('denies another driver cancelling', async () => {
    await seedAssignedBooking('accepted');
    await assertFails(updateDoc(doc(db(OTHER_DRIVER), 'bookings', BOOKING), cancelUpdate('driver')));
  });
});

describe('standard booking: final states and delete', () => {
  for (const status of ['completed', 'cancelled']) {
    it(`denies the passenger changing a ${status} booking`, async () => {
      await seed({ [`bookings/${BOOKING}`]: newBooking({ status, driverId: DRIVER }) });
      await assertFails(updateDoc(doc(db(PASSENGER), 'bookings', BOOKING), cancelUpdate('passenger')));
    });

    it(`denies the driver changing a ${status} booking`, async () => {
      await seed({ [`bookings/${BOOKING}`]: newBooking({ status, driverId: DRIVER }) });
      await assertFails(
        updateDoc(doc(db(DRIVER), 'bookings', BOOKING), {
          status: 'in_progress',
          startedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
    });
  }

  it('denies the passenger deleting a booking', async () => {
    await seed({ [`bookings/${BOOKING}`]: newBooking() });
    await assertFails(deleteDoc(doc(db(PASSENGER), 'bookings', BOOKING)));
  });

  it('denies the assigned driver deleting a booking', async () => {
    await seedAssignedBooking('accepted');
    await assertFails(deleteDoc(doc(db(DRIVER), 'bookings', BOOKING)));
  });
});
