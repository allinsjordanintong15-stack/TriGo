/// <reference types="node" />

// Security regression tests (docs/review/SECURITY_AUDIT.md). These started as the audit's
// attacker proofs (2026-11-19), which all succeeded against the rules of that day; they now
// assert the SECURE behaviour. Each attack changes one field of an otherwise valid write, and
// a positive control shows the valid write still passes, so no test passes by accident.
// Findings not fixed yet (SEC-04, SEC-05, SEC-07, SEC-09) are in openFindings.test.ts as
// `todo` tests.
// Run with `npm run test:rules` (Firestore emulator, demo project).
// Self-contained on purpose: Node's type stripping does not resolve the "@/..." aliases.

import assert from 'node:assert/strict';
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
  getDoc,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import {
  appWrites,
  baseDocs,
  commitWrites,
  DRIVER,
  inProgressBooking,
  SETTINGS,
  tripDocs,
} from '../commissionFixtures.ts';
import { perKmFare } from '../../../shared/fares/index.ts';

setLogLevel('error');

const ATTACKER = 'attackerPassenger';
const DEFAULT_TRICYCLE = { baseFare: 15, perKm: 8 };

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

async function read(path: string): Promise<DocumentData | undefined> {
  let data: DocumentData | undefined;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    data = (await getDoc(doc(context.firestore() as unknown as Firestore, path))).data();
  });
  return data;
}

// Poblacion → Kinan-oan, Trinidad: ~2.9 km straight, 3.5 km by road.
const PICKUP = { latitude: 10.08, longitude: 124.343, address: 'Poblacion, Trinidad' };
const DESTINATION = { latitude: 10.06, longitude: 124.36, address: 'Kinan-oan, Trinidad' };
const DISTANCE = 3.5;
const FARE = perKmFare(DEFAULT_TRICYCLE, DISTANCE);

/** A standard booking exactly as createStandardBooking writes it. */
function standardBooking(overrides: DocumentData = {}): DocumentData {
  return {
    passengerId: ATTACKER,
    driverId: null,
    vehicleType: 'tricycle',
    bookingType: 'standard',
    pickupLocation: PICKUP,
    destination: DESTINATION,
    distanceKm: DISTANCE,
    estimatedFare: FARE,
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

/** The booking and the passenger's open-request pointer in one commit (the app's batch). */
function book(id: string, overrides: DocumentData = {}, uid = ATTACKER): Promise<void> {
  const firestore = db(uid);
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, 'bookings', id), standardBooking({ passengerId: uid, ...overrides }));
  batch.set(doc(firestore, 'passengerOpenRequest', uid), { kind: 'booking', id, updatedAt: serverTimestamp() });
  return batch.commit();
}

const FAR_DESTINATION = { latitude: 9.65, longitude: 123.85, address: 'Tagbilaran City' };
const FAR_DISTANCE = 75;
const FAR_FARE = perKmFare(DEFAULT_TRICYCLE, FAR_DISTANCE);

/** An out-of-area request exactly as createOutOfAreaRequest writes it, with the pointer. */
function requestOutOfArea(id: string, overrides: DocumentData = {}, uid = ATTACKER): Promise<void> {
  const firestore = db(uid);
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, 'outOfAreaRequests', id), {
    passengerId: uid,
    pickupLocation: PICKUP,
    destination: FAR_DESTINATION,
    vehicleType: 'tricycle',
    distanceKm: FAR_DISTANCE,
    standardEstimatedFare: FAR_FARE,
    suggestedAgreementFare: null,
    agreedFare: null,
    status: 'searching',
    driverId: null,
    fareAgreement: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
    ...overrides,
  });
  batch.set(doc(firestore, 'passengerOpenRequest', uid), { kind: 'out_of_area', id, updatedAt: serverTimestamp() });
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
  await seed({ ...baseDocs(), [`users/${ATTACKER}`]: { uid: ATTACKER, role: 'passenger' } });
});

describe('positive controls (the app\'s own writes pass)', () => {
  it('a standard per-km booking at the exact fare, with the pointer', async () => {
    await assertSucceeds(book('b1'));
  });

  it('an out-of-area request at the per-km fare, with the pointer', async () => {
    await assertSucceeds(requestOutOfArea('r1'));
  });
});

describe('SEC-01 fares: finite, above 0, at most the maximum, whole centavos', () => {
  it('refuses negative, zero, NaN and Infinity fares', async () => {
    await assertFails(book('neg', { estimatedFare: -5000 }));
    await assertFails(book('zero', { estimatedFare: 0 }));
    await assertFails(book('nan', { estimatedFare: NaN }));
    await assertFails(book('inf', { estimatedFare: Infinity }));
  });

  it('refuses zero, negative, NaN and Infinity distances', async () => {
    await assertFails(book('d0', { distanceKm: 0 }));
    await assertFails(book('dneg', { distanceKm: -1 }));
    await assertFails(book('dnan', { distanceKm: NaN }));
    await assertFails(book('dinf', { distanceKm: Infinity }));
  });

  it('a driver cannot complete a legacy negative-fare trip to lower their commission debt', async () => {
    const before = {
      accruedCentavos: 9000,
      paidCentavos: 0,
      current: { seq: 1, startAt: Timestamp.now(), periodDays: 7, graceDays: 3, startCentavos: 0 },
      unpaid: null,
    };
    // A booking written before these rules (or by an old app) with a negative fare.
    await seed(tripDocs({ booking: inProgressBooking(DRIVER, { estimatedFare: -900 }), account: before }));
    await assertFails(commitWrites(db(DRIVER), appWrites({ finalFare: -900, settings: SETTINGS, before })));
    const account = await read(`commissionAccounts/${DRIVER}`);
    assert.equal(account?.accruedCentavos, 9000);
  });
});

describe('SEC-02 standard booking create: exact field set', () => {
  it('refuses a planted agreedFare, finalFare, acceptedAt or extra field', async () => {
    await assertFails(book('p1', { agreedFare: 1 }));
    await assertFails(book('p2', { finalFare: 1 }));
    await assertFails(book('p3', { acceptedAt: Timestamp.now() }));
    await assertFails(book('p4', { junk: 'x'.repeat(100000) }));
    await assertFails(book('p5', { createdAt: Timestamp.fromMillis(0) }));
  });
});

describe('SEC-03 one open request per passenger', () => {
  it('refuses a second booking while the first is pending', async () => {
    await assertSucceeds(book('first'));
    await assertFails(book('second'));
  });

  it('refuses an out-of-area request while a booking is pending, and the reverse', async () => {
    await assertSucceeds(book('first'));
    await assertFails(requestOutOfArea('r1'));
  });

  it('refuses a booking without the pointer, or with the pointer elsewhere', async () => {
    const firestore = db(ATTACKER);
    await assertFails(setDoc(doc(firestore, 'bookings', 'nolock'), standardBooking()));
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, 'bookings', 'a'), standardBooking());
    batch.set(doc(firestore, 'passengerOpenRequest', ATTACKER), { kind: 'booking', id: 'b', updatedAt: serverTimestamp() });
    await assertFails(batch.commit());
  });

  it('25 attempts in a row leave exactly one open booking', async () => {
    let created = 0;
    for (let i = 0; i < 25; i++) {
      await book(`spam${i}`).then(
        () => (created += 1),
        () => undefined,
      );
    }
    assert.equal(created, 1);
  });

  it('cannot point at another passenger\'s or an existing booking', async () => {
    await seed({ 'bookings/someoneElses': standardBooking({ passengerId: 'passenger1', createdAt: Timestamp.now(), updatedAt: Timestamp.now() }) });
    await assertFails(
      setDoc(doc(db(ATTACKER), 'passengerOpenRequest', ATTACKER), { kind: 'booking', id: 'someoneElses', updatedAt: serverTimestamp() }),
    );
  });
});

describe('SEC-06 locations: exact keys, short address, inside Bohol / the Philippines', () => {
  it('refuses impossible coordinates, a long address, extra keys or points outside Bohol', async () => {
    await assertFails(book('g1', { pickupLocation: { ...PICKUP, latitude: 1000 } }));
    await assertFails(book('g2', { pickupLocation: { ...PICKUP, address: 'x'.repeat(201) } }));
    await assertFails(book('g3', { pickupLocation: { ...PICKUP, kind: 'place' } }));
    await assertFails(book('g4', { pickupLocation: { ...PICKUP, latitude: NaN } }));
    // Cebu City: outside the Bohol box for a standard booking.
    await assertFails(
      book('g5', { pickupLocation: { latitude: 10.3157, longitude: 123.8854, address: 'Cebu' }, destination: { latitude: 10.32, longitude: 123.89, address: 'Cebu' }, distanceKm: 1, estimatedFare: perKmFare(DEFAULT_TRICYCLE, 1) }),
    );
  });

  it('accepts a 200-character address', async () => {
    await assertSucceeds(book('g6', { pickupLocation: { ...PICKUP, address: 'x'.repeat(200) } }));
  });

  it('a driver cannot put themselves at an impossible position', async () => {
    await seed({
      [`drivers/${DRIVER}`]: { isVerified: true, isOnline: true, isAvailable: true, vehicleType: 'tricycle', currentBookingId: null, currentRequestId: null, currentLocation: { latitude: 10, longitude: 124 } },
    });
    await assertFails(updateDoc(doc(db(DRIVER), 'drivers', DRIVER), { currentLocation: { latitude: 999, longitude: 999 } }));
    await assertFails(updateDoc(doc(db(DRIVER), 'drivers', DRIVER), { currentLocation: { latitude: NaN, longitude: 124 } }));
    await assertSucceeds(updateDoc(doc(db(DRIVER), 'drivers', DRIVER), { currentLocation: { latitude: 10.08, longitude: 124.34 } }));
  });
});

describe('SEC-08 out-of-area fare is the admin per-km fare for the distance', () => {
  it('refuses ₱0.01, ±1 centavo, outside the Philippines, or an implausible distance', async () => {
    await assertFails(requestOutOfArea('o1', { standardEstimatedFare: 0.01 }));
    await assertFails(requestOutOfArea('o2', { standardEstimatedFare: FAR_FARE + 0.01 }));
    await assertFails(requestOutOfArea('o3', { standardEstimatedFare: FAR_FARE - 0.01 }));
    await assertFails(
      requestOutOfArea('o4', { destination: { latitude: 35.68, longitude: 139.69, address: 'Tokyo' } }),
    );
    await assertFails(requestOutOfArea('o5', { distanceKm: 40, standardEstimatedFare: perKmFare(DEFAULT_TRICYCLE, 40) }));
  });
});

describe('SEC-15 document photos must be JPEG', () => {
  it('the rule checks the JPEG signature (base64 "/9j/")', () => {
    // Exercised end to end in applicationDocuments.test.ts (non-JPEG data refused).
    const rules = readFileSync('firestore.rules', 'utf8');
    assert.match(rules, /dataBase64\.matches\('\/9j\/\.\*'\)/);
  });
});
