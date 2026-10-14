/// <reference types="node" />

// Firestore rules tests for admin out-of-area request access (Admin Website, Out-of-Area
// Trips page): admins (custom claim `admin: true`) read and list every request, read-only.
// Passenger and driver request access is unchanged.
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
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';

// Denied reads and writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

const ADMIN = 'admin1';
const PASSENGER = 'passenger1';
const OTHER_PASSENGER = 'passenger2';
const DRIVER = 'driver1';
const OTHER_DRIVER = 'driver2';

const MINUTE_MS = 60 * 1000;

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

function location(address: string) {
  return { latitude: 9.97, longitude: 124.48, address };
}

function request(overrides: DocumentData = {}): DocumentData {
  return {
    passengerId: PASSENGER,
    pickupLocation: location('Poblacion, Trinidad'),
    destination: location('Tagbilaran City'),
    vehicleType: 'tricycle',
    distanceKm: 48.5,
    standardEstimatedFare: 520,
    suggestedAgreementFare: null,
    agreedFare: null,
    status: 'searching',
    driverId: null,
    fareAgreement: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + 30 * MINUTE_MS),
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
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    await setDoc(doc(firestore, 'users', PASSENGER), { uid: PASSENGER, role: 'passenger' });
    await setDoc(doc(firestore, 'users', OTHER_PASSENGER), { uid: OTHER_PASSENGER, role: 'passenger' });
    await setDoc(doc(firestore, 'users', DRIVER), { uid: DRIVER, role: 'driver' });
    await setDoc(doc(firestore, 'users', OTHER_DRIVER), { uid: OTHER_DRIVER, role: 'driver' });
    await setDoc(doc(firestore, 'drivers', DRIVER), { isVerified: true, vehicleType: 'tricycle', currentBookingId: null });
    await setDoc(doc(firestore, 'drivers', OTHER_DRIVER), { isVerified: true, vehicleType: 'motorcycle', currentBookingId: null });
    // r1 open, r2 accepted by DRIVER, r3 another passenger's cancelled request.
    await setDoc(doc(firestore, 'outOfAreaRequests', 'r1'), request());
    await setDoc(doc(firestore, 'outOfAreaRequests', 'r2'), request({ status: 'accepted', driverId: DRIVER, agreedFare: 520 }));
    await setDoc(doc(firestore, 'outOfAreaRequests', 'r3'), request({ passengerId: OTHER_PASSENGER, status: 'cancelled' }));
  });
});

describe('admin out-of-area requests: read', () => {
  it('lets an admin read any request', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'outOfAreaRequests', 'r1')));
    await assertSucceeds(getDoc(doc(adminDb(), 'outOfAreaRequests', 'r2')));
    await assertSucceeds(getDoc(doc(adminDb(), 'outOfAreaRequests', 'r3')));
  });

  it('lets an admin list every request', async () => {
    const all = await assertSucceeds(getDocs(collection(adminDb(), 'outOfAreaRequests')));
    if (all.size !== 3) throw new Error(`expected 3 requests, got ${all.size}`);
  });

  it('lets an admin list out-of-area bookings (linked trip status)', async () => {
    await assertSucceeds(getDocs(query(collection(adminDb(), 'bookings'), where('bookingType', '==', 'out_of_area'))));
  });

  it('denies non-claim accounts listing every request', async () => {
    await assertFails(getDocs(collection(db(ADMIN), 'outOfAreaRequests')));
    await assertFails(getDocs(collection(db(ADMIN, { admin: false }), 'outOfAreaRequests')));
    await assertFails(getDocs(collection(db(ADMIN, { role: 'admin' }), 'outOfAreaRequests')));
    await assertFails(getDocs(collection(db(null), 'outOfAreaRequests')));
    await assertFails(getDocs(collection(db(PASSENGER), 'outOfAreaRequests')));
    await assertFails(getDocs(collection(db(DRIVER), 'outOfAreaRequests')));
  });

  it("denies a non-claim account reading another passenger's request", async () => {
    await assertFails(getDoc(doc(db(ADMIN), 'outOfAreaRequests', 'r3')));
  });
});

describe('admin out-of-area requests: passenger and driver access unchanged', () => {
  it('still lets passengers read only their own requests', async () => {
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'outOfAreaRequests', 'r1')));
    await assertFails(getDoc(doc(db(PASSENGER), 'outOfAreaRequests', 'r3')));
    await assertSucceeds(
      getDocs(query(collection(db(PASSENGER), 'outOfAreaRequests'), where('passengerId', '==', PASSENGER))),
    );
    await assertFails(
      getDocs(query(collection(db(PASSENGER), 'outOfAreaRequests'), where('passengerId', '==', OTHER_PASSENGER))),
    );
  });

  it('still lets drivers read open requests for their vehicle type and their own', async () => {
    await assertSucceeds(getDoc(doc(db(DRIVER), 'outOfAreaRequests', 'r1')));
    await assertSucceeds(getDoc(doc(db(DRIVER), 'outOfAreaRequests', 'r2')));
    await assertFails(getDoc(doc(db(DRIVER), 'outOfAreaRequests', 'r3')));
    await assertFails(getDoc(doc(db(OTHER_DRIVER), 'outOfAreaRequests', 'r1')));
    await assertFails(getDoc(doc(db(OTHER_DRIVER), 'outOfAreaRequests', 'r2')));
  });
});

describe('admin out-of-area requests: read-only', () => {
  it('denies an admin updating, creating or deleting requests', async () => {
    await assertFails(
      updateDoc(doc(adminDb(), 'outOfAreaRequests', 'r1'), { status: 'cancelled', updatedAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(adminDb(), 'outOfAreaRequests', 'r9'), request({
        passengerId: ADMIN,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })),
    );
    await assertFails(deleteDoc(doc(adminDb(), 'outOfAreaRequests', 'r1')));
  });
});
