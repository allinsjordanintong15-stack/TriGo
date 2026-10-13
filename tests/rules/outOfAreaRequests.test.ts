/// <reference types="node" />

// Firestore rules tests for out-of-area requests (passenger create, driver read, driver
// propose and withdraw with the drivers/{uid}.currentRequestId reservation, passenger
// accept + bookings/{requestId} create in one batch, driver claim and passenger cancel).
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

/** The locked out-of-area fare: the request's admin per-km fare (standardEstimatedFare). */
const PROPOSED_FARE = 520;

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

  it('allows exactly the per-km fare and stores it as the proposal', async () => {
    await assertSucceeds(proposeBatch(DRIVER, proposalUpdate(DRIVER, 520)));
    const request = await readAsAdmin(`outOfAreaRequests/${REQUEST}`);
    if (request?.fareAgreement?.driverProposedFare !== 520 || request?.suggestedAgreementFare !== 520) {
      throw new Error('proposal does not carry the per-km fare');
    }
  });

  for (const fare of [600, 520.01, 519.99, 0, -5]) {
    it(`denies a fare other than the per-km fare: ${fare}`, async () => {
      await assertFails(proposeBatch(DRIVER, proposalUpdate(DRIVER, fare)));
    });
  }

  it('denies an agreedFare that differs from the per-km proposal', async () => {
    await assertFails(
      proposeBatch(DRIVER, {
        ...proposalUpdate(DRIVER),
        fareAgreement: fareAgreement(PROPOSED_FARE, { agreedFare: 600 }),
      }),
    );
  });

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

});

// ─── Release (Step 4): driver-only update clearing currentRequestId ─────────

/** releaseOutOfAreaRequest: clear the reservation, available again while online. */
function releaseUpdate(uid: string) {
  return updateDoc(doc(db(uid), 'drivers', uid), {
    currentRequestId: null,
    isOnline: true,
    isAvailable: true,
    updatedAt: serverTimestamp(),
  });
}

/** goOffline while reserved: withdraw + go offline in one batch. */
function offlineWithdrawBatch(uid: string) {
  const firestore = db(uid);
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'outOfAreaRequests', REQUEST), {
    ...WITHDRAW_UPDATE,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(firestore, 'drivers', uid), {
    currentRequestId: null,
    isOnline: false,
    isAvailable: false,
    updatedAt: serverTimestamp(),
  });
  return batch.commit();
}

describe('out-of-area request: driver release', () => {
  const releasePaths: [string, DocumentData][] = [
    ['the passenger declined (back to searching)', WITHDRAW_UPDATE],
    ['the passenger cancelled', { status: 'cancelled' }],
    ['the request has status expired', { status: 'expired' }],
    ['the request was rejected', { status: 'rejected' }],
    ['the proposal is still negotiating past expiresAt', { expiresAt: expiresInMinutes(-1) }],
    [
      'driver_interested past expiresAt',
      { status: 'driver_interested', expiresAt: expiresInMinutes(-1) },
    ],
    [
      'another driver now holds the request',
      { driverId: OTHER_DRIVER, fareAgreement: fareAgreement(700), suggestedAgreementFare: 700 },
    ],
  ];

  for (const [label, requestState] of releasePaths) {
    it(`allows release when ${label}`, async () => {
      await seedProposal(requestState);
      await assertSucceeds(releaseUpdate(DRIVER));
      const driver = await readAsAdmin(`drivers/${DRIVER}`);
      if (driver?.currentRequestId !== null || driver?.isAvailable !== true) {
        throw new Error('driver was not released');
      }
    });
  }

  it('denies release while still negotiating and unexpired', async () => {
    await seedProposal();
    await assertFails(releaseUpdate(DRIVER));
  });

  it('denies release after the passenger accepted, even past expiresAt', async () => {
    await seedAcceptedWithBooking({ expiresAt: expiresInMinutes(-1) });
    await assertFails(releaseUpdate(DRIVER));
  });

  it('denies releasing while staying available on a different reservation', async () => {
    await seedProposal({ status: 'cancelled' });
    await assertFails(
      updateDoc(doc(db(DRIVER), 'drivers', DRIVER), {
        currentRequestId: 'other-request',
        isAvailable: true,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('allows going offline while reserved by withdrawing in the same batch', async () => {
    await seedProposal();
    await assertSucceeds(offlineWithdrawBatch(DRIVER));
    const request = await readAsAdmin(`outOfAreaRequests/${REQUEST}`);
    const driver = await readAsAdmin(`drivers/${DRIVER}`);
    if (request?.status !== 'searching' || driver?.currentRequestId !== null) {
      throw new Error('offline withdraw did not release');
    }
    if (driver?.isOnline !== false || driver?.isAvailable !== false) {
      throw new Error('driver is not offline');
    }
  });

  it('allows going offline with a release once the passenger declined', async () => {
    await seedProposal(WITHDRAW_UPDATE);
    await assertSucceeds(
      updateDoc(doc(db(DRIVER), 'drivers', DRIVER), {
        currentRequestId: null,
        isOnline: false,
        isAvailable: false,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('keeps an accepted driver reserved when going offline', async () => {
    await seedAcceptedWithBooking();
    await assertFails(offlineWithdrawBatch(DRIVER));
    await assertSucceeds(
      updateDoc(doc(db(DRIVER), 'drivers', DRIVER), {
        isOnline: false,
        isAvailable: false,
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

// ─── Passenger accepts the fare and books (Step 5) ─────────────────────────

/** The fare agreement acceptProposalAndCreateBooking writes on both documents. */
function acceptedFareAgreement(overrides: DocumentData = {}): DocumentData {
  return fareAgreement(PROPOSED_FARE, {
    agreedByPassenger: true,
    agreedAt: serverTimestamp(),
    ...overrides,
  });
}

/** Request fields acceptProposalAndCreateBooking writes. */
function acceptUpdate(overrides: DocumentData = {}): DocumentData {
  return {
    status: 'accepted',
    agreedFare: PROPOSED_FARE,
    fareAgreement: acceptedFareAgreement(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

/** bookings/{requestId} as acceptProposalAndCreateBooking writes it (copied from the request). */
function outOfAreaBooking(overrides: DocumentData = {}): DocumentData {
  return {
    passengerId: PASSENGER,
    driverId: null,
    vehicleType: 'tricycle',
    bookingType: 'out_of_area',
    pickupLocation: location('Poblacion, Trinidad'),
    destination: location('Tagbilaran City'),
    distanceKm: 48.5,
    estimatedFare: 520,
    driverProposedFare: PROPOSED_FARE,
    agreedFare: PROPOSED_FARE,
    fareAgreement: acceptedFareAgreement(),
    finalFare: null,
    status: 'pending',
    outOfAreaRequestId: REQUEST,
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
    ...overrides,
  };
}

interface AcceptAndBookOptions {
  bookingId?: string;
  booking?: DocumentData | null;
  requestUpdate?: DocumentData | null;
}

/** Accept + create booking in one batch; null leaves that write out. */
function acceptAndBookBatch(uid: string, options: AcceptAndBookOptions = {}) {
  const { bookingId = REQUEST, booking = outOfAreaBooking(), requestUpdate = acceptUpdate() } =
    options;
  const firestore = db(uid);
  const batch = writeBatch(firestore);
  if (requestUpdate) {
    batch.update(doc(firestore, 'outOfAreaRequests', REQUEST), requestUpdate);
  }
  if (booking) {
    batch.set(doc(firestore, 'bookings', bookingId), booking);
  }
  return batch.commit();
}

describe('out-of-area request: passenger accepts and books', () => {
  beforeEach(async () => {
    await seedProposal();
  });

  it('allows accepting the fare and creating the booking in one batch', async () => {
    await assertSucceeds(acceptAndBookBatch(PASSENGER));
    const request = await readAsAdmin(`outOfAreaRequests/${REQUEST}`);
    const booking = await readAsAdmin(`bookings/${REQUEST}`);
    if (request?.status !== 'accepted' || booking?.status !== 'pending') {
      throw new Error('request was not accepted or booking was not created');
    }
    if (booking?.driverId !== null || booking?.agreedFare !== PROPOSED_FARE) {
      throw new Error('booking was not created unassigned with the agreed fare');
    }
  });

  it('keeps the agreed driver reserved after the passenger accepted', async () => {
    await assertSucceeds(acceptAndBookBatch(PASSENGER));
    await assertFails(releaseUpdate(DRIVER));
  });

  it('denies creating the booking without accepting in the same batch', async () => {
    await assertFails(acceptAndBookBatch(PASSENGER, { requestUpdate: null }));
  });

  it('denies accepting without creating the booking', async () => {
    await assertFails(acceptAndBookBatch(PASSENGER, { booking: null }));
  });

  const bookingChanges: [string, DocumentData][] = [
    ['a changed agreedFare', { agreedFare: 700 }],
    ['a changed driverProposedFare', { driverProposedFare: 700 }],
    ['a changed estimatedFare', { estimatedFare: 400 }],
    ['a changed distanceKm', { distanceKm: 10 }],
    ['a changed pickupLocation', { pickupLocation: location('Ubay') }],
    ['a changed destination', { destination: location('Ubay') }],
    ['a changed vehicleType', { vehicleType: 'motorcycle' }],
    ['a driverId set by the passenger', { driverId: DRIVER }],
    ['a status other than pending', { status: 'accepted' }],
    ['bookingType standard', { bookingType: 'standard' }],
    ['a different outOfAreaRequestId', { outOfAreaRequestId: 'other-request' }],
    [
      'a fare agreement that differs from the request',
      { fareAgreement: acceptedFareAgreement({ agreedFare: 700 }) },
    ],
    ['a finalFare', { finalFare: PROPOSED_FARE }],
    ['an extra field', { promoCode: 'FREE' }],
    ['a client-chosen createdAt', { createdAt: Timestamp.now() }],
  ];

  for (const [label, change] of bookingChanges) {
    it(`denies a booking with ${label}`, async () => {
      await assertFails(acceptAndBookBatch(PASSENGER, { booking: outOfAreaBooking(change) }));
    });
  }

  it('denies an agreedFare different from the proposal on both documents', async () => {
    const agreement = acceptedFareAgreement({ agreedFare: 700 });
    await assertFails(
      acceptAndBookBatch(PASSENGER, {
        booking: outOfAreaBooking({ agreedFare: 700, fareAgreement: agreement }),
        requestUpdate: acceptUpdate({ agreedFare: 700, fareAgreement: agreement }),
      }),
    );
  });

  it('denies a client-chosen agreedAt', async () => {
    const agreement = acceptedFareAgreement({ agreedAt: Timestamp.now() });
    await assertFails(
      acceptAndBookBatch(PASSENGER, {
        booking: outOfAreaBooking({ fareAgreement: agreement }),
        requestUpdate: acceptUpdate({ fareAgreement: agreement }),
      }),
    );
  });

  it('denies a booking id other than the request id', async () => {
    await assertFails(acceptAndBookBatch(PASSENGER, { bookingId: 'booking-2' }));
  });

  it('denies a second booking for an already accepted request', async () => {
    await assertSucceeds(acceptAndBookBatch(PASSENGER));
    await assertFails(acceptAndBookBatch(PASSENGER));
    await assertFails(setDoc(doc(db(PASSENGER), 'bookings', 'booking-2'), outOfAreaBooking()));
  });

  it('denies accepting and booking an expired request', async () => {
    await seedProposal({ expiresAt: expiresInMinutes(-1) });
    await assertFails(acceptAndBookBatch(PASSENGER));
  });

  it('denies accepting after expiry even without a booking', async () => {
    await seedProposal({ expiresAt: expiresInMinutes(-1) });
    await assertFails(acceptAndBookBatch(PASSENGER, { booking: null }));
  });

  it('denies a request without an expiry', async () => {
    await seedProposal({ expiresAt: null });
    await assertFails(acceptAndBookBatch(PASSENGER));
  });

  it('denies a request that is back to searching (no offer)', async () => {
    await seedProposal(WITHDRAW_UPDATE);
    await assertFails(acceptAndBookBatch(PASSENGER));
  });

  it('denies a cancelled request', async () => {
    await seedProposal({ status: 'cancelled' });
    await assertFails(acceptAndBookBatch(PASSENGER));
  });

  it("denies accepting and booking another passenger's request", async () => {
    await assertFails(
      acceptAndBookBatch(OTHER_PASSENGER, {
        booking: outOfAreaBooking({ passengerId: OTHER_PASSENGER }),
      }),
    );
  });

  it('denies the agreed driver creating the booking', async () => {
    await assertFails(acceptAndBookBatch(DRIVER));
  });

  it('denies an out-of-area booking created on its own through the standard path', async () => {
    await assertFails(
      setDoc(
        doc(db(PASSENGER), 'bookings', 'booking-2'),
        outOfAreaBooking({ outOfAreaRequestId: null }),
      ),
    );
  });

  it('allows the passenger to cancel the pending out-of-area booking', async () => {
    await assertSucceeds(acceptAndBookBatch(PASSENGER));
    await assertSucceeds(
      updateDoc(doc(db(PASSENGER), 'bookings', REQUEST), {
        status: 'cancelled',
        cancelledBy: 'passenger',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

// ─── Driver claims the booking; passenger cancels (Step 6 + Step 7 cancel) ──

/** REQUEST accepted with DRIVER reserved for it, and its pending booking at bookings/{REQUEST}. */
async function seedAcceptedWithBooking(
  requestOverrides: DocumentData = {},
  bookingOverrides: DocumentData = {},
): Promise<void> {
  await seedProposal({
    status: 'accepted',
    agreedFare: PROPOSED_FARE,
    fareAgreement: fareAgreement(PROPOSED_FARE, {
      agreedByPassenger: true,
      agreedAt: Timestamp.now(),
    }),
    ...requestOverrides,
  });
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    await setDoc(doc(firestore, 'bookings', REQUEST), outOfAreaBooking(bookingOverrides));
  });
}

const CLAIM_BOOKING_UPDATE = {
  status: 'accepted',
  acceptedAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
};

/** claimOutOfAreaBooking: booking claimed + reservation moved to currentBookingId. */
function claimBatch(
  uid: string,
  bookingUpdate: DocumentData = { ...CLAIM_BOOKING_UPDATE, driverId: uid },
  driverUpdate: DocumentData | null = {
    currentBookingId: REQUEST,
    currentRequestId: null,
    isAvailable: false,
  },
) {
  const firestore = db(uid);
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'bookings', REQUEST), bookingUpdate);
  if (driverUpdate) {
    batch.update(doc(firestore, 'drivers', uid), { ...driverUpdate, updatedAt: serverTimestamp() });
  }
  return batch.commit();
}

const PASSENGER_CANCEL_UPDATE = {
  status: 'cancelled',
  cancelledBy: 'passenger',
  cancelledAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
};

/** bookingService.cancelBooking on a pending out-of-area booking: booking + request. */
function passengerCancelBatch(options: { booking?: boolean; request?: boolean } = {}) {
  const { booking = true, request = true } = options;
  const firestore = db(PASSENGER);
  const batch = writeBatch(firestore);
  if (booking) {
    batch.update(doc(firestore, 'bookings', REQUEST), PASSENGER_CANCEL_UPDATE);
  }
  if (request) {
    batch.update(doc(firestore, 'outOfAreaRequests', REQUEST), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
  }
  return batch.commit();
}

/** releaseCancelledBooking: unlink a cancelled booking and become available. */
function releaseBookingUpdate(uid: string) {
  return updateDoc(doc(db(uid), 'drivers', uid), {
    currentBookingId: null,
    isOnline: true,
    isAvailable: true,
    updatedAt: serverTimestamp(),
  });
}

describe('out-of-area booking: agreed driver claims', () => {
  beforeEach(async () => {
    await seedAcceptedWithBooking();
  });

  it('allows the agreed driver to claim with the reservation moved in the same batch', async () => {
    await assertSucceeds(claimBatch(DRIVER));
    const booking = await readAsAdmin(`bookings/${REQUEST}`);
    const driver = await readAsAdmin(`drivers/${DRIVER}`);
    if (booking?.status !== 'accepted' || booking?.driverId !== DRIVER) {
      throw new Error('booking was not claimed');
    }
    if (driver?.currentBookingId !== REQUEST || driver?.currentRequestId !== null) {
      throw new Error('reservation was not moved to the booking');
    }
  });

  it('allows the agreed driver to claim while offline', async () => {
    await seedDriver(DRIVER, { isOnline: false, isAvailable: false, currentRequestId: REQUEST });
    await assertSucceeds(claimBatch(DRIVER));
  });

  it('allows the agreed driver to read the unclaimed booking', async () => {
    await assertSucceeds(getDoc(doc(db(DRIVER), 'bookings', REQUEST)));
  });

  it('denies another driver reading the unclaimed booking', async () => {
    await assertFails(getDoc(doc(db(OTHER_DRIVER), 'bookings', REQUEST)));
  });

  it('denies claiming without the driver record update', async () => {
    await assertFails(claimBatch(DRIVER, undefined, null));
  });

  it('denies claiming while keeping the request reservation', async () => {
    await assertFails(
      claimBatch(DRIVER, undefined, { currentBookingId: REQUEST, isAvailable: false }),
    );
  });

  it('denies claiming without linking the booking', async () => {
    await assertFails(
      claimBatch(DRIVER, undefined, { currentRequestId: null, isAvailable: false }),
    );
  });

  it('denies another driver, even one reserved for this request', async () => {
    await seedDriver(OTHER_DRIVER, { isAvailable: false, currentRequestId: REQUEST });
    await assertFails(claimBatch(OTHER_DRIVER));
  });

  it('denies the agreed driver when not reserved for this request', async () => {
    await seedDriver(DRIVER, { isAvailable: false, currentRequestId: 'other-request' });
    await assertFails(claimBatch(DRIVER));
  });

  it('denies a driver already on a booking', async () => {
    await seedDriver(DRIVER, {
      isAvailable: false,
      currentRequestId: REQUEST,
      currentBookingId: 'booking-x',
    });
    await assertFails(claimBatch(DRIVER));
  });

  it('denies a driver with a different vehicle type', async () => {
    await seedDriver(DRIVER, {
      vehicleType: 'motorcycle',
      isAvailable: false,
      currentRequestId: REQUEST,
    });
    await assertFails(claimBatch(DRIVER));
  });

  it('denies claiming a booking that is not pending', async () => {
    await seedAcceptedWithBooking({}, { status: 'cancelled' });
    await assertFails(claimBatch(DRIVER));
  });

  it('denies claiming when the request is not accepted', async () => {
    await seedAcceptedWithBooking({ status: 'negotiating' });
    await assertFails(claimBatch(DRIVER));
  });

  it('denies changing the fare while claiming', async () => {
    await assertFails(
      claimBatch(DRIVER, { ...CLAIM_BOOKING_UPDATE, driverId: DRIVER, agreedFare: 700 }),
    );
  });

  it('denies a client-chosen acceptedAt', async () => {
    await assertFails(
      claimBatch(DRIVER, { ...CLAIM_BOOKING_UPDATE, driverId: DRIVER, acceptedAt: Timestamp.now() }),
    );
  });

  it('denies claiming on behalf of another driver', async () => {
    await assertFails(claimBatch(DRIVER, { ...CLAIM_BOOKING_UPDATE, driverId: OTHER_DRIVER }));
  });

  it('allows completing the claimed trip only with finalFare equal to the agreed fare', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore() as unknown as Firestore;
      await updateDoc(doc(firestore, 'bookings', REQUEST), {
        status: 'in_progress',
        driverId: DRIVER,
      });
    });
    const complete = (finalFare: number) =>
      updateDoc(doc(db(DRIVER), 'bookings', REQUEST), {
        status: 'completed',
        completedAt: serverTimestamp(),
        finalFare,
        paymentMethod: 'cash',
        updatedAt: serverTimestamp(),
      });
    await assertFails(complete(600));
    await assertSucceeds(complete(PROPOSED_FARE));
  });
});

describe('out-of-area booking: passenger cancels', () => {
  beforeEach(async () => {
    await seedAcceptedWithBooking();
  });

  it('allows cancelling the booking and request together before the claim', async () => {
    await assertSucceeds(passengerCancelBatch());
    const request = await readAsAdmin(`outOfAreaRequests/${REQUEST}`);
    if (request?.status !== 'cancelled') throw new Error('request was not cancelled');
  });

  it('releases the driver after a cancel before the claim', async () => {
    await assertSucceeds(passengerCancelBatch());
    await assertSucceeds(releaseUpdate(DRIVER));
    const driver = await readAsAdmin(`drivers/${DRIVER}`);
    if (driver?.currentRequestId !== null || driver?.isAvailable !== true) {
      throw new Error('driver was not released');
    }
  });

  it('denies the claim after the passenger cancelled', async () => {
    await assertSucceeds(passengerCancelBatch());
    await assertFails(claimBatch(DRIVER));
  });

  it('denies cancelling the accepted request without cancelling the booking', async () => {
    await assertFails(passengerCancelBatch({ booking: false }));
  });

  it('releases the driver even if only the booking was cancelled', async () => {
    await assertSucceeds(passengerCancelBatch({ request: false }));
    await assertSucceeds(releaseUpdate(DRIVER));
  });

  it('allows release of an accepted request that has no booking (older data)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore() as unknown as Firestore;
      await deleteDoc(doc(firestore, 'bookings', REQUEST));
    });
    await assertSucceeds(releaseUpdate(DRIVER));
  });

  it('denies another passenger cancelling the request', async () => {
    const firestore = db(OTHER_PASSENGER);
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'bookings', REQUEST), PASSENGER_CANCEL_UPDATE);
    batch.update(doc(firestore, 'outOfAreaRequests', REQUEST), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('denies closing the request once the driver has claimed the booking', async () => {
    await assertSucceeds(claimBatch(DRIVER));
    await assertFails(passengerCancelBatch());
  });

  it('allows a cancel after the claim and releases the driver via the booking path', async () => {
    await assertSucceeds(claimBatch(DRIVER));
    await assertSucceeds(passengerCancelBatch({ request: false }));
    await assertSucceeds(releaseBookingUpdate(DRIVER));
    const driver = await readAsAdmin(`drivers/${DRIVER}`);
    if (driver?.currentBookingId !== null || driver?.isAvailable !== true) {
      throw new Error('driver was not released from the cancelled booking');
    }
  });

  it('denies releasing the booking link while the claimed trip is active', async () => {
    await assertSucceeds(claimBatch(DRIVER));
    await assertFails(releaseBookingUpdate(DRIVER));
  });
});

// ─── Locked fare: proposal → booking (fare lock step) ──────────────────────

describe('out-of-area fare lock: booking follows the per-km fare', () => {
  beforeEach(async () => {
    await seedRequest(REQUEST);
  });

  it('creates the booking at the per-km fare after a locked proposal', async () => {
    await assertSucceeds(proposeBatch(DRIVER));
    await assertSucceeds(acceptAndBookBatch(PASSENGER));
    const booking = await readAsAdmin(`bookings/${REQUEST}`);
    if (
      booking?.agreedFare !== 520 ||
      booking?.driverProposedFare !== 520 ||
      booking?.estimatedFare !== 520
    ) {
      throw new Error('booking fare is not the per-km fare');
    }
  });

  it('denies a booking at any other fare after a locked proposal', async () => {
    await assertSucceeds(proposeBatch(DRIVER));
    const agreement = acceptedFareAgreement({ driverProposedFare: 600, agreedFare: 600 });
    await assertFails(
      acceptAndBookBatch(PASSENGER, {
        booking: outOfAreaBooking({
          driverProposedFare: 600,
          agreedFare: 600,
          fareAgreement: agreement,
        }),
        requestUpdate: acceptUpdate({ agreedFare: 600, fareAgreement: agreement }),
      }),
    );
  });
});
