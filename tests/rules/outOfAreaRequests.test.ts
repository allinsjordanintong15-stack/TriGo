/// <reference types="node" />

// Firestore rules tests for out-of-area requests (passenger create).
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
  doc,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';

// Denied writes are expected; keep the SDK's PERMISSION_DENIED warnings out of the output.
setLogLevel('error');

const PASSENGER = 'passenger1';
const OTHER_PASSENGER = 'passenger2';
const DRIVER = 'driver1';
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
    await setDoc(doc(firestore, 'users', DRIVER), { uid: DRIVER, role: 'driver' });
    await setDoc(doc(firestore, 'drivers', DRIVER), {
      isVerified: true,
      isOnline: true,
      isAvailable: true,
      vehicleType: 'tricycle',
      currentBookingId: null,
    });
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
