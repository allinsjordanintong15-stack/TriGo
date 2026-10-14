/// <reference types="node" />

// Firestore rules tests for admin booking access (Admin Website, Passengers page): admins
// (custom claim `admin: true`) read and list every booking, read-only. Passenger and
// driver booking access is unchanged.
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

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

function booking(overrides: DocumentData = {}): DocumentData {
  return {
    passengerId: PASSENGER,
    driverId: DRIVER,
    bookingType: 'standard',
    vehicleType: 'tricycle',
    status: 'completed',
    estimatedFare: 55,
    finalFare: 55,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
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
    await setDoc(doc(firestore, 'drivers', DRIVER), { isVerified: true, vehicleType: 'tricycle', currentBookingId: null });
    await setDoc(doc(firestore, 'bookings', 'b1'), booking());
    await setDoc(doc(firestore, 'bookings', 'b2'), booking({ status: 'cancelled', driverId: null }));
    await setDoc(doc(firestore, 'bookings', 'b3'), booking({ passengerId: OTHER_PASSENGER, bookingType: 'out_of_area' }));
  });
});

describe('admin bookings: read', () => {
  it('lets an admin read any booking', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'bookings', 'b1')));
    await assertSucceeds(getDoc(doc(adminDb(), 'bookings', 'b3')));
  });

  it("lets an admin list a passenger's booking history and all bookings", async () => {
    const history = await assertSucceeds(
      getDocs(query(collection(adminDb(), 'bookings'), where('passengerId', '==', PASSENGER))),
    );
    if (history.size !== 2) throw new Error(`expected 2 bookings, got ${history.size}`);
    await assertSucceeds(getDocs(collection(adminDb(), 'bookings')));
  });

  it('denies non-claim accounts listing all bookings', async () => {
    await assertFails(getDocs(collection(db(ADMIN), 'bookings')));
    await assertFails(getDocs(collection(db(ADMIN, { admin: false }), 'bookings')));
    await assertFails(getDocs(collection(db(ADMIN, { role: 'admin' }), 'bookings')));
    await assertFails(getDocs(collection(db(null), 'bookings')));
  });
});

describe('admin bookings: passenger and driver access unchanged', () => {
  it('still lets passengers read only their own bookings', async () => {
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'bookings', 'b1')));
    await assertFails(getDoc(doc(db(PASSENGER), 'bookings', 'b3')));
    await assertFails(getDocs(query(collection(db(PASSENGER), 'bookings'), where('passengerId', '==', OTHER_PASSENGER))));
    await assertSucceeds(getDocs(query(collection(db(PASSENGER), 'bookings'), where('passengerId', '==', PASSENGER))));
  });

  it('still keeps other passengers out', async () => {
    await assertFails(getDoc(doc(db(OTHER_PASSENGER), 'bookings', 'b1')));
  });

  it("still lets a driver read their own trip but not another passenger's", async () => {
    await assertSucceeds(getDoc(doc(db(DRIVER), 'bookings', 'b1')));
    await assertFails(getDoc(doc(db(DRIVER), 'bookings', 'b2')));
  });
});

describe('admin bookings: read-only', () => {
  it('denies an admin updating, creating or deleting bookings', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'bookings', 'b1'), { status: 'cancelled', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(adminDb(), 'bookings', 'b9'), booking()));
    await assertFails(deleteDoc(doc(adminDb(), 'bookings', 'b1')));
  });
});
