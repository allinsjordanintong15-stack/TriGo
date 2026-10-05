/// <reference types="node" />

// Firestore rules tests for out-of-area requests (passenger create, driver read).
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
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  type DocumentData,
  where,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';

// Denied writes are expected; keep the SDK's PERMISSION_DENIED warnings out of the output.
setLogLevel('error');

const PASSENGER = 'passenger1';
const OTHER_PASSENGER = 'passenger2';
const DRIVER = 'driver1';
const OTHER_DRIVER = 'driver2';
const MOTORCYCLE_DRIVER = 'driver3';
const UNVERIFIED_DRIVER = 'driver4';
const REQUEST = 'request1';

const MINUTE_MS = 60 * 1000;

let testEnv: RulesTestEnvironment;

function db(uid: string | null): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function location(address: string) {
  return { latitude: 9.97, longitude: 124.48, address };
}

function expiresInMinutes(minutes: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + minutes * MINUTE_MS);
}

/** The request as bookingService.createOutOfAreaRequest writes it. */
function newRequest(overrides: DocumentData = {}): DocumentData {
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt: expiresInMinutes(30),
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

/** A stored request (rules disabled), as it looks after a valid create. */
async function seedRequest(id: string, overrides: DocumentData = {}): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    await setDoc(
      doc(firestore, 'outOfAreaRequests', id),
      newRequest({ createdAt: Timestamp.now(), updatedAt: Timestamp.now(), ...overrides }),
    );
  });
}

/** The query driverService.subscribeToOpenOutOfAreaRequests runs. */
function openRequestsQuery(uid: string, vehicleType: string) {
  return query(
    collection(db(uid), 'outOfAreaRequests'),
    where('status', '==', 'searching'),
    where('vehicleType', '==', vehicleType),
    where('expiresAt', '>', Timestamp.now()),
  );
}

function createRequest(uid: string | null, data: DocumentData) {
  return setDoc(doc(db(uid), 'outOfAreaRequests', REQUEST), data);
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
    for (const uid of [DRIVER, OTHER_DRIVER, MOTORCYCLE_DRIVER, UNVERIFIED_DRIVER]) {
      await setDoc(doc(firestore, 'users', uid), { uid, role: 'driver' });
    }
    await setDoc(doc(firestore, 'drivers', DRIVER), driverRecord());
    await setDoc(doc(firestore, 'drivers', OTHER_DRIVER), driverRecord());
    await setDoc(doc(firestore, 'drivers', MOTORCYCLE_DRIVER), driverRecord({ vehicleType: 'motorcycle' }));
    await setDoc(
      doc(firestore, 'drivers', UNVERIFIED_DRIVER),
      driverRecord({ isVerified: false, isOnline: false, isAvailable: false }),
    );
  });
});

describe('out-of-area request: create', () => {
  it('allows a passenger to create a valid searching request', async () => {
    await assertSucceeds(createRequest(PASSENGER, newRequest()));
  });

  it('allows an expiry just under the 35-minute cap', async () => {
    await assertSucceeds(createRequest(PASSENGER, newRequest({ expiresAt: expiresInMinutes(34) })));
  });

  it('denies a signed-out user', async () => {
    await assertFails(createRequest(null, newRequest()));
  });

  it('denies a null expiresAt', async () => {
    await assertFails(createRequest(PASSENGER, newRequest({ expiresAt: null })));
  });

  it('denies a missing expiresAt', async () => {
    const data = newRequest();
    delete data.expiresAt;
    await assertFails(createRequest(PASSENGER, data));
  });

  it('denies an expiresAt in the past', async () => {
    await assertFails(createRequest(PASSENGER, newRequest({ expiresAt: expiresInMinutes(-1) })));
  });

  it('denies an expiresAt more than 35 minutes ahead', async () => {
    await assertFails(createRequest(PASSENGER, newRequest({ expiresAt: expiresInMinutes(40) })));
  });

  it('denies an extra field', async () => {
    await assertFails(createRequest(PASSENGER, newRequest({ isPriority: true })));
  });

  it('denies a client-chosen createdAt', async () => {
    await assertFails(createRequest(PASSENGER, newRequest({ createdAt: Timestamp.now() })));
  });

  for (const fare of [0, -10]) {
    it(`denies a standardEstimatedFare of ${fare}`, async () => {
      await assertFails(createRequest(PASSENGER, newRequest({ standardEstimatedFare: fare })));
    });
  }

  it('denies a distanceKm of 0', async () => {
    await assertFails(createRequest(PASSENGER, newRequest({ distanceKm: 0 })));
  });

  it('denies creating a request for another passenger', async () => {
    await assertFails(createRequest(PASSENGER, newRequest({ passengerId: OTHER_PASSENGER })));
  });

  it('denies a request with a driver already set', async () => {
    await assertFails(createRequest(PASSENGER, newRequest({ driverId: DRIVER })));
  });

  it('denies a pre-filled fare agreement', async () => {
    await assertFails(
      createRequest(
        PASSENGER,
        newRequest({
          agreedFare: 100,
          fareAgreement: {
            standardEstimatedFare: 520,
            driverProposedFare: 100,
            agreedFare: 100,
            agreedByDriver: true,
            agreedByPassenger: true,
          },
        }),
      ),
    );
  });

  for (const status of ['negotiating', 'accepted']) {
    it(`denies creating with status ${status}`, async () => {
      await assertFails(createRequest(PASSENGER, newRequest({ status })));
    });
  }

  it('denies a driver-role account', async () => {
    await assertFails(createRequest(DRIVER, newRequest({ passengerId: DRIVER })));
  });
});

describe('out-of-area request: read', () => {
  beforeEach(async () => {
    await seedRequest(REQUEST);
  });

  it('allows a verified driver with a matching vehicle to list open requests', async () => {
    await assertSucceeds(getDocs(openRequestsQuery(DRIVER, 'tricycle')));
  });

  it('allows a verified driver with a matching vehicle to read an open request', async () => {
    await assertSucceeds(getDoc(doc(db(DRIVER), 'outOfAreaRequests', REQUEST)));
  });

  it('denies listing open requests for a different vehicle type', async () => {
    await assertFails(getDocs(openRequestsQuery(MOTORCYCLE_DRIVER, 'tricycle')));
  });

  it('denies reading an open request for a different vehicle type', async () => {
    await assertFails(getDoc(doc(db(MOTORCYCLE_DRIVER), 'outOfAreaRequests', REQUEST)));
  });

  it('denies an unverified driver listing open requests', async () => {
    await assertFails(getDocs(openRequestsQuery(UNVERIFIED_DRIVER, 'tricycle')));
  });

  it('allows the passenger to read their own request', async () => {
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'outOfAreaRequests', REQUEST)));
  });

  it("denies a passenger reading someone else's request", async () => {
    await assertFails(getDoc(doc(db(OTHER_PASSENGER), 'outOfAreaRequests', REQUEST)));
  });

  it('denies a driver listing without the status filter', async () => {
    await assertFails(
      getDocs(query(collection(db(DRIVER), 'outOfAreaRequests'), where('vehicleType', '==', 'tricycle'))),
    );
  });

  it('denies a driver listing without the vehicleType filter', async () => {
    await assertFails(
      getDocs(query(collection(db(DRIVER), 'outOfAreaRequests'), where('status', '==', 'searching'))),
    );
  });

  it('allows the driver handling a request to read it', async () => {
    await seedRequest(REQUEST, { status: 'negotiating', driverId: DRIVER });
    await assertSucceeds(getDoc(doc(db(DRIVER), 'outOfAreaRequests', REQUEST)));
  });

  it("denies another driver reading a request they aren't handling", async () => {
    await seedRequest(REQUEST, { status: 'negotiating', driverId: DRIVER });
    await assertFails(getDoc(doc(db(OTHER_DRIVER), 'outOfAreaRequests', REQUEST)));
  });
});
