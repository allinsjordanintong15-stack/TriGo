/// <reference types="node" />

// Edges of the trip limits added in security batch A (2026-11-19, firestore.rules "Trip
// limits", shared/bookings/limits.ts): the per-km fare recomputed to the centavo with the
// default and the saved admin fares, the barangay tariff, distance plausibility at both ends,
// the maximum fare and distance, and the one-open-request pointer freed by cancel or expiry.
// Run with `npm run test:rules`. Self-contained (no "@/..." aliases).

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { perKmFare } from '../../../shared/fares/index.ts';
import { MAX_DISTANCE_KM, MAX_FARE_PESOS, straightLineKm } from '../../../shared/bookings/limits.ts';

setLogLevel('error');

const PASSENGER = 'passenger1';
const DEFAULT_TRICYCLE = { baseFare: 15, perKm: 8 };
const DEFAULT_MOTORCYCLE = { baseFare: 10, perKm: 6 };

let testEnv: RulesTestEnvironment;

function db(uid: string): Firestore {
  return testEnv.authenticatedContext(uid).firestore() as unknown as Firestore;
}

async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(firestore, path), data);
  });
}

// Due north by 0.1° inside Trinidad: a straight line of 11.06 km.
const A = { latitude: 10.0, longitude: 124.3, address: 'Point A' };
const B = { latitude: 10.1, longitude: 124.3, address: 'Point B' };
const STRAIGHT = straightLineKm(A, B);

function booking(distanceKm: number, overrides: DocumentData = {}): DocumentData {
  return {
    passengerId: PASSENGER,
    driverId: null,
    vehicleType: 'tricycle',
    bookingType: 'standard',
    pickupLocation: A,
    destination: B,
    distanceKm,
    estimatedFare: perKmFare(DEFAULT_TRICYCLE, distanceKm),
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
    expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
    fareBasis: 'per_km',
    pickupBarangayId: null,
    destinationBarangayId: null,
    perKmRate: DEFAULT_TRICYCLE.perKm,
    ...overrides,
  };
}

function book(id: string, data: DocumentData): Promise<void> {
  const firestore = db(PASSENGER);
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, 'bookings', id), data);
  batch.set(doc(firestore, 'passengerOpenRequest', PASSENGER), { kind: 'booking', id, updatedAt: serverTimestamp() });
  return batch.commit();
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-trigo-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed({ [`users/${PASSENGER}`]: { uid: PASSENGER, role: 'passenger' } });
});

describe('per-km fare, recomputed to the centavo', () => {
  it('accepts the exact fare and refuses ±1 centavo (default fares)', async () => {
    const fare = perKmFare(DEFAULT_TRICYCLE, 12.3456);
    await assertSucceeds(book('exact', booking(12.3456, { estimatedFare: fare })));
    await testEnv.clearFirestore();
    await seed({ [`users/${PASSENGER}`]: { uid: PASSENGER, role: 'passenger' } });
    await assertFails(book('plus', booking(12.3456, { estimatedFare: Math.round((fare + 0.01) * 100) / 100 })));
    await assertFails(book('minus', booking(12.3456, { estimatedFare: Math.round((fare - 0.01) * 100) / 100 })));
  });

  it('uses the vehicle type\'s rate', async () => {
    await assertSucceeds(
      book('moto', booking(15, { vehicleType: 'motorcycle', estimatedFare: perKmFare(DEFAULT_MOTORCYCLE, 15), perKmRate: 6 })),
    );
  });

  it('uses the saved admin fares when they exist', async () => {
    const saved = { baseFare: 20.5, perKm: 9.25 };
    await seed({
      'fareSettings/active': {
        fares: { tricycle: saved, motorcycle: DEFAULT_MOTORCYCLE },
        updatedAt: Timestamp.now(),
        updatedBy: 'admin1',
      },
    });
    await assertFails(book('old', booking(15)));
    await assertSucceeds(book('new', booking(15, { estimatedFare: perKmFare(saved, 15), perKmRate: saved.perKm })));
  });

  it('refuses a perKmRate that is not the admin rate, and fractions of a centavo', async () => {
    await assertFails(book('rate', booking(15, { perKmRate: 1 })));
    await assertFails(book('frac', booking(15, { estimatedFare: perKmFare(DEFAULT_TRICYCLE, 15) + 0.001 })));
  });

  it('accepts a missing perKmRate (older app versions)', async () => {
    await assertSucceeds(book('noRate', booking(15, { perKmRate: null })));
  });
});

describe('barangay tariff', () => {
  it('accepts the tariff exactly and refuses ±1 centavo', async () => {
    await seed({
      'barangayTariffs/bongbong': { name: 'Bongbong', tricycle: 40.5, motorcycle: 30.25, active: true, updatedAt: Timestamp.now(), updatedBy: 'admin1' },
    });
    const tariff = (fare: number) =>
      booking(15, { fareBasis: 'barangay_tariff', pickupBarangayId: 'poblacion', destinationBarangayId: 'bongbong', perKmRate: null, estimatedFare: fare });
    await assertFails(book('t1', tariff(40.51)));
    await assertFails(book('t2', tariff(40.49)));
    await assertSucceeds(book('t3', tariff(40.5)));
  });
});

describe('distance plausibility (0.9 × to 4 × + 2 km of the straight line)', () => {
  it('lower edge', async () => {
    await assertFails(book('low', booking(Math.floor(0.9 * STRAIGHT * 100 - 1) / 100)));
    await assertSucceeds(book('lowOk', booking(Math.ceil(0.9 * STRAIGHT * 100 + 1) / 100)));
  });

  it('upper edge', async () => {
    await assertFails(book('high', booking(Math.ceil((4 * STRAIGHT + 2) * 100 + 1) / 100)));
    await assertSucceeds(book('highOk', booking(Math.floor((4 * STRAIGHT + 2) * 100 - 1) / 100)));
  });

  it('same pickup and destination: up to 2 km, never 0', async () => {
    await assertSucceeds(book('same', booking(2, { destination: A })));
    await testEnv.clearFirestore();
    await seed({ [`users/${PASSENGER}`]: { uid: PASSENGER, role: 'passenger' } });
    await assertFails(book('same2', booking(2.01, { destination: A })));
    await assertFails(book('same0', booking(0, { destination: A, estimatedFare: 15 })));
  });

  it('maximum distance and fare', () => {
    // Both maxima are far above any plausible in-Bohol trip; documented for the record.
    if (!(MAX_DISTANCE_KM === 300 && MAX_FARE_PESOS === 20000)) throw new Error('limits changed');
  });

  it('refuses a fare above the maximum', async () => {
    await seed({
      'barangayTariffs/bongbong': { name: 'Bongbong', tricycle: 20000.01, motorcycle: 30.25, active: true, updatedAt: Timestamp.now(), updatedBy: 'admin1' },
    });
    await assertFails(
      book('max', booking(15, { fareBasis: 'barangay_tariff', pickupBarangayId: 'poblacion', destinationBarangayId: 'bongbong', perKmRate: null, estimatedFare: 20000.01 })),
    );
  });
});

describe('one open request: freed by cancel and by expiry', () => {
  it('cancel the pending booking, then a new one is allowed', async () => {
    await assertSucceeds(book('first', booking(15)));
    await assertFails(book('second', booking(15)));
    await assertSucceeds(
      updateDoc(doc(db(PASSENGER), 'bookings', 'first'), {
        status: 'cancelled',
        cancelledBy: 'passenger',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(book('second', booking(15)));
  });

  it('an expired pending booking no longer holds the pointer', async () => {
    await seed({
      'bookings/old': booking(15, { createdAt: Timestamp.now(), updatedAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() - 1000) }),
      [`passengerOpenRequest/${PASSENGER}`]: { kind: 'booking', id: 'old', updatedAt: Timestamp.now() },
    });
    await assertSucceeds(book('fresh', booking(15)));
  });

  it('an accepted booking no longer holds the pointer', async () => {
    await seed({
      'bookings/taken': booking(15, { status: 'accepted', driverId: 'driver1', createdAt: Timestamp.now(), updatedAt: Timestamp.now() }),
      [`passengerOpenRequest/${PASSENGER}`]: { kind: 'booking', id: 'taken', updatedAt: Timestamp.now() },
    });
    await assertSucceeds(book('next', booking(15)));
  });

  it('the pointer cannot be deleted, and only the passenger reads it', async () => {
    await assertSucceeds(book('first', booking(15)));
    const other = db('passenger2');
    await assertFails(
      setDoc(doc(other, 'passengerOpenRequest', PASSENGER), { kind: 'booking', id: 'x', updatedAt: serverTimestamp() }),
    );
    const { deleteDoc, getDoc } = await import('firebase/firestore');
    await assertFails(deleteDoc(doc(db(PASSENGER), 'passengerOpenRequest', PASSENGER)));
    await assertFails(getDoc(doc(other, 'passengerOpenRequest', PASSENGER)));
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'passengerOpenRequest', PASSENGER)));
  });
});
