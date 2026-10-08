/// <reference types="node" />

// Firestore rules tests for out-of-area requests (passenger create, driver read, driver
// propose and withdraw with the drivers/{uid}.currentRequestId reservation).
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
  updateDoc,
  type DocumentData,
  where,
  writeBatch,
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

// ─── Propose / withdraw ──────────────────────────────────────────────────────

const PROPOSED_FARE = 600;

function fareAgreement(fare: number, overrides: DocumentData = {}): DocumentData {
  return {
    standardEstimatedFare: 520,
    driverProposedFare: fare,
    agreedFare: fare,
    agreedByPassenger: false,
    agreedByDriver: true,
    agreedAt: null,
    ...overrides,
  };
}

/** Request fields fareAgreementService.createProposal writes. */
function proposalUpdate(uid: string, fare = PROPOSED_FARE): DocumentData {
  return {
    status: 'negotiating',
    driverId: uid,
    suggestedAgreementFare: fare,
    fareAgreement: fareAgreement(fare),
    updatedAt: serverTimestamp(),
  };
}

/** Propose as createProposal writes it: request claim + driver reservation in one batch. */
function proposeBatch(
  uid: string,
  requestUpdate: DocumentData = proposalUpdate(uid),
  driverUpdate: DocumentData = { currentRequestId: REQUEST, isAvailable: false },
) {
  const firestore = db(uid);
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'outOfAreaRequests', REQUEST), requestUpdate);
  batch.update(doc(firestore, 'drivers', uid), { ...driverUpdate, updatedAt: serverTimestamp() });
  return batch.commit();
}

const WITHDRAW_UPDATE = {
  status: 'searching',
  driverId: null,
  suggestedAgreementFare: null,
  fareAgreement: null,
};

/** Withdraw as withdrawProposal writes it: request reopened + driver released in one batch. */
function withdrawBatch(uid: string) {
  const firestore = db(uid);
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'outOfAreaRequests', REQUEST), {
    ...WITHDRAW_UPDATE,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(firestore, 'drivers', uid), {
    currentRequestId: null,
    isOnline: true,
    isAvailable: true,
    updatedAt: serverTimestamp(),
  });
  return batch.commit();
}

/** DRIVER holding REQUEST with a proposal, as after a successful propose. */
async function seedProposal(requestOverrides: DocumentData = {}): Promise<void> {
  await seedRequest(REQUEST, {
    status: 'negotiating',
    driverId: DRIVER,
    suggestedAgreementFare: PROPOSED_FARE,
    fareAgreement: fareAgreement(PROPOSED_FARE),
    ...requestOverrides,
  });
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    await setDoc(
      doc(firestore, 'drivers', DRIVER),
      driverRecord({ isAvailable: false, currentRequestId: REQUEST }),
    );
  });
}

async function seedDriver(uid: string, overrides: DocumentData): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    await setDoc(doc(firestore, 'drivers', uid), driverRecord(overrides));
  });
}

async function readAsAdmin(path: string): Promise<DocumentData | undefined> {
  let data: DocumentData | undefined;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    data = (await getDoc(doc(firestore, path))).data();
  });
  return data;
}

describe('out-of-area request: driver proposes a fare', () => {
  beforeEach(async () => {
    await seedRequest(REQUEST);
  });

  it('allows a matching, online, available, unreserved driver with the reservation', async () => {
    await assertSucceeds(proposeBatch(DRIVER));
  });

  it('allows a driver record that has no currentRequestId field yet', async () => {
    // driverRecord() has no currentRequestId, like drivers created before this step.
    await assertSucceeds(proposeBatch(DRIVER));
    const driver = await readAsAdmin(`drivers/${DRIVER}`);
    if (driver?.currentRequestId !== REQUEST || driver?.isAvailable !== false) {
      throw new Error('driver was not reserved');
    }
  });

  it('denies proposing without the driver reservation in the same commit', async () => {
    await assertFails(
      updateDoc(doc(db(DRIVER), 'outOfAreaRequests', REQUEST), proposalUpdate(DRIVER)),
    );
  });

  it('denies a reservation that leaves the driver available', async () => {
    await assertFails(
      proposeBatch(DRIVER, proposalUpdate(DRIVER), { currentRequestId: REQUEST, isAvailable: true }),
    );
  });

  it('denies reserving a different request than the one proposed on', async () => {
    await assertFails(
      proposeBatch(DRIVER, proposalUpdate(DRIVER), {
        currentRequestId: 'other-request',
        isAvailable: false,
      }),
    );
  });

  it('denies an offline driver', async () => {
    await seedDriver(DRIVER, { isOnline: false, isAvailable: false });
    await assertFails(proposeBatch(DRIVER));
  });

  it('denies an online but unavailable driver', async () => {
    await seedDriver(DRIVER, { isAvailable: false });
    await assertFails(proposeBatch(DRIVER));
  });

  it('denies a driver already reserved by another request', async () => {
    // isAvailable is left true so only the currentRequestId check can deny it.
    await seedDriver(DRIVER, { currentRequestId: 'other-request' });
    await assertFails(proposeBatch(DRIVER));
  });

  it('denies a driver on an active booking', async () => {
    // isAvailable is left true so only the currentBookingId check can deny it.
    await seedDriver(DRIVER, { currentBookingId: 'booking1' });
    await assertFails(proposeBatch(DRIVER));
  });

  it('denies a driver with a different vehicle type', async () => {
    await assertFails(proposeBatch(MOTORCYCLE_DRIVER));
  });

  it('denies an unverified driver', async () => {
    await assertFails(proposeBatch(UNVERIFIED_DRIVER));
  });

  it('denies an expired request', async () => {
    await seedRequest(REQUEST, { expiresAt: expiresInMinutes(-1) });
    await assertFails(proposeBatch(DRIVER));
  });

  it('denies a request without an expiry', async () => {
    await seedRequest(REQUEST, { expiresAt: null });
    await assertFails(proposeBatch(DRIVER));
  });

  it('denies a request another driver has already taken', async () => {
    await seedRequest(REQUEST, {
      status: 'negotiating',
      driverId: OTHER_DRIVER,
      suggestedAgreementFare: 700,
      fareAgreement: fareAgreement(700),
    });
    await assertFails(proposeBatch(DRIVER));
  });

  it('denies a cancelled request', async () => {
    await seedRequest(REQUEST, { status: 'cancelled' });
    await assertFails(proposeBatch(DRIVER));
  });

  for (const fare of [0, -5]) {
    it(`denies a proposed fare of ${fare}`, async () => {
      await assertFails(proposeBatch(DRIVER, proposalUpdate(DRIVER, fare)));
    });
  }

  it('denies an extra field on the request', async () => {
    await assertFails(proposeBatch(DRIVER, { ...proposalUpdate(DRIVER), agreedFare: PROPOSED_FARE }));
  });

  it('denies an extra field in the fare agreement', async () => {
    await assertFails(
      proposeBatch(DRIVER, {
        ...proposalUpdate(DRIVER),
        fareAgreement: fareAgreement(PROPOSED_FARE, { bonus: 50 }),
      }),
    );
  });

  it('denies pre-agreeing for the passenger', async () => {
    await assertFails(
      proposeBatch(DRIVER, {
        ...proposalUpdate(DRIVER),
        fareAgreement: fareAgreement(PROPOSED_FARE, { agreedByPassenger: true }),
      }),
    );
  });

  it('denies a changed reference fare', async () => {
    await assertFails(
      proposeBatch(DRIVER, {
        ...proposalUpdate(DRIVER),
        fareAgreement: fareAgreement(PROPOSED_FARE, { standardEstimatedFare: 1 }),
      }),
    );
  });

  it('denies proposing on behalf of another driver', async () => {
    await assertFails(proposeBatch(DRIVER, proposalUpdate(OTHER_DRIVER)));
  });

  it('denies a driver reserving a request without proposing on it', async () => {
    await assertFails(
      updateDoc(doc(db(DRIVER), 'drivers', DRIVER), {
        currentRequestId: REQUEST,
        isAvailable: false,
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('out-of-area request: driver withdraws a proposal', () => {
  beforeEach(async () => {
    await seedProposal();
  });

  it('allows withdrawing and releases the driver', async () => {
    await assertSucceeds(withdrawBatch(DRIVER));
    const request = await readAsAdmin(`outOfAreaRequests/${REQUEST}`);
    const driver = await readAsAdmin(`drivers/${DRIVER}`);
    if (request?.status !== 'searching' || request?.driverId !== null) {
      throw new Error('request was not reopened');
    }
    if (driver?.currentRequestId !== null || driver?.isAvailable !== true) {
      throw new Error('driver was not released');
    }
  });

  it('allows withdrawing after the request expired', async () => {
    await seedProposal({ expiresAt: expiresInMinutes(-1) });
    await assertSucceeds(withdrawBatch(DRIVER));
  });

  it('denies withdrawing without releasing the driver in the same commit', async () => {
    await assertFails(
      updateDoc(doc(db(DRIVER), 'outOfAreaRequests', REQUEST), {
        ...WITHDRAW_UPDATE,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies another driver withdrawing', async () => {
    await assertFails(withdrawBatch(OTHER_DRIVER));
  });

  it('denies withdrawing after the passenger accepted', async () => {
    await seedProposal({ status: 'accepted', agreedFare: PROPOSED_FARE });
    await assertFails(withdrawBatch(DRIVER));
  });

  it('denies the driver releasing themselves while still holding the request', async () => {
    await assertFails(
      updateDoc(doc(db(DRIVER), 'drivers', DRIVER), {
        currentRequestId: null,
        isAvailable: true,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies a reserved driver becoming available', async () => {
    await assertFails(
      updateDoc(doc(db(DRIVER), 'drivers', DRIVER), {
        isAvailable: true,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('allows a reserved driver to go offline', async () => {
    await assertSucceeds(
      updateDoc(doc(db(DRIVER), 'drivers', DRIVER), {
        isOnline: false,
        isAvailable: false,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  for (const outcome of ['declined', 'cancelled'] as const) {
    it(`allows the driver to release themselves once the passenger ${outcome}`, async () => {
      await seedProposal(
        outcome === 'declined' ? WITHDRAW_UPDATE : { status: 'cancelled' },
      );
      await assertSucceeds(
        updateDoc(doc(db(DRIVER), 'drivers', DRIVER), {
          currentRequestId: null,
          isAvailable: true,
          updatedAt: serverTimestamp(),
        }),
      );
    });
  }
});
