/// <reference types="node" />

// Firestore rules tests for the driver daily acceptance quota: quotaSettings/active (admin
// writes one dailyLimit 1-100; default 20 while missing) and each driver's own count on
// drivers/{uid} (acceptedCount on acceptedDay, a Manila day): T1 accept counts and is
// refused at the limit, the out-of-area propose is refused at the limit but not counted,
// the claim counts and is never refused, and the release may give the slot back for a
// booking the passenger cancelled before it started, accepted today.
// Headroom: measureHeadroom.ts. Run with `npm run test:rules`.
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
  getCountFromServer,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { manilaDay } from '../../src/utils/dailyQuota.ts';
import {
  ADMIN,
  availableDriverRecord,
  baseDocs,
  BOOKING,
  claimDocs,
  DAY_MS,
  DRIVER,
  driverRecord,
  inProgressBooking,
  openBooking,
  openRequest,
  PASSENGER,
  REQUEST,
} from './commissionFixtures.ts';

const PROJECT_ID = 'demo-trigo-rules';

// Denied writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

let testEnv: RulesTestEnvironment;

function db(uid: string, claims: Record<string, unknown> = {}): Firestore {
  return testEnv.authenticatedContext(uid, claims).firestore() as unknown as Firestore;
}

const adminDb = () => db(ADMIN, { admin: true });

async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(firestore, path), data);
  });
}

// The day the emulator sees (same machine clock). A run across 12:00 AM Manila could flake.
const TODAY = manilaDay(Date.now());
const DEFAULT_LIMIT = 20;

type Quota = { acceptedCount?: number; acceptedDay?: number };
const today = (count: number): Quota => ({ acceptedCount: count, acceptedDay: TODAY });
const yesterday = (count: number): Quota => ({ acceptedCount: count, acceptedDay: TODAY - 1 });

function limitDoc(dailyLimit: number): Record<string, DocumentData> {
  return {
    'quotaSettings/active': { dailyLimit, updatedAt: Timestamp.now(), updatedBy: ADMIN },
  };
}

/** An available driver with open work: a standard booking and an out-of-area request. */
async function seedOpenWork(stored: Quota, extra: Record<string, DocumentData> = {}): Promise<void> {
  await seed({
    [`drivers/${DRIVER}`]: { ...availableDriverRecord(), ...stored },
    [`bookings/${BOOKING}`]: openBooking(),
    [`outOfAreaRequests/${REQUEST}`]: openRequest(),
    ...extra,
  });
}

/** T1 as acceptBooking writes it, with the given quota fields on the driver record. */
function accept(quota: Quota): Promise<void> {
  const firestore = db(DRIVER);
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'bookings', BOOKING), {
    driverId: DRIVER,
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(firestore, 'drivers', DRIVER), {
    isAvailable: false,
    currentBookingId: BOOKING,
    ...quota,
    updatedAt: serverTimestamp(),
  });
  return batch.commit();
}

/** The out-of-area propose (createProposal), with extra driver fields. */
function propose(quota: Quota = {}): Promise<void> {
  const firestore = db(DRIVER);
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'outOfAreaRequests', REQUEST), {
    status: 'negotiating',
    driverId: DRIVER,
    suggestedAgreementFare: 520,
    fareAgreement: {
      standardEstimatedFare: 520,
      driverProposedFare: 520,
      agreedFare: 520,
      agreedByPassenger: false,
      agreedByDriver: true,
      agreedAt: null,
    },
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(firestore, 'drivers', DRIVER), {
    currentRequestId: REQUEST,
    isAvailable: false,
    ...quota,
    updatedAt: serverTimestamp(),
  });
  return batch.commit();
}

/** claimOutOfAreaBooking, with the given quota fields. */
function claim(quota: Quota): Promise<void> {
  const firestore = db(DRIVER);
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'bookings', REQUEST), {
    driverId: DRIVER,
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(firestore, 'drivers', DRIVER), {
    currentBookingId: REQUEST,
    currentRequestId: null,
    isAvailable: false,
    ...quota,
    updatedAt: serverTimestamp(),
  });
  return batch.commit();
}

/** releaseCancelledBooking: unlink the cancelled booking, optionally giving the slot back. */
function release(quota: Quota = {}): Promise<void> {
  return updateDoc(doc(db(DRIVER), 'drivers', DRIVER), {
    currentBookingId: null,
    isOnline: true,
    isAvailable: true,
    ...quota,
    updatedAt: serverTimestamp(),
  });
}

/** DRIVER linked to BOOKING, which has ended as described. */
async function seedEndedBooking(stored: Quota, booking: DocumentData): Promise<void> {
  await seed({
    [`drivers/${DRIVER}`]: { ...driverRecord(BOOKING), ...stored },
    [`bookings/${BOOKING}`]: inProgressBooking(DRIVER, booking),
  });
}

const PASSENGER_CANCELLED = {
  status: 'cancelled',
  cancelledBy: 'passenger',
  cancellationReason: 'Changed plans',
  cancelledAt: Timestamp.now(),
  acceptedAt: Timestamp.now(),
};

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
  await seed(baseDocs());
});

// ─── quotaSettings/active ──────────────────────────────────────────────────

describe('quota settings', () => {
  const write = (data: DocumentData, firestore = adminDb()) =>
    setDoc(doc(firestore, 'quotaSettings', 'active'), data);
  const valid = (dailyLimit: unknown): DocumentData => ({
    dailyLimit,
    updatedAt: serverTimestamp(),
    updatedBy: ADMIN,
  });

  it('allows an admin to save whole numbers from 1 to 100', async () => {
    for (const limit of [20, 1, 100]) await assertSucceeds(write(valid(limit)));
  });

  it('denies limits outside 1-100 or not whole numbers', async () => {
    for (const limit of [0, 101, -5, 2.5, '20', null]) await assertFails(write(valid(limit)));
  });

  it('denies missing or extra fields, a client time or another updatedBy', async () => {
    await assertFails(write({ dailyLimit: 20, updatedAt: serverTimestamp() }));
    await assertFails(write({ ...valid(20), enabled: true }));
    await assertFails(write({ ...valid(20), updatedAt: Timestamp.now() }));
    await assertFails(write({ ...valid(20), updatedBy: 'someone-else' }));
  });

  it('denies drivers and passengers writing, and anyone deleting', async () => {
    await assertFails(write({ ...valid(50), updatedBy: DRIVER }, db(DRIVER)));
    await assertFails(write({ ...valid(50), updatedBy: PASSENGER }, db(PASSENGER)));
    await seed(limitDoc(20));
    await assertFails(deleteDoc(doc(adminDb(), 'quotaSettings', 'active')));
  });

  it('every signed-in user can read it; signed-out users cannot', async () => {
    await seed(limitDoc(20));
    await assertSucceeds(getDoc(doc(db(DRIVER), 'quotaSettings', 'active')));
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'quotaSettings', 'active')));
    await assertSucceeds(getDoc(doc(adminDb(), 'quotaSettings', 'active')));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore() as unknown as Firestore, 'quotaSettings', 'active')));
  });
});

// ─── T1 accept ─────────────────────────────────────────────────────────────

describe('quota: standard accept (T1)', () => {
  it('counts the first accept of a driver without the fields as 1', async () => {
    await seedOpenWork({});
    await assertSucceeds(accept(today(1)));
  });

  it('adds one to today’s count', async () => {
    await seedOpenWork(today(3));
    await assertSucceeds(accept(today(4)));
  });

  it('denies any other count: unchanged, +2, a reset to 1, or no quota fields', async () => {
    for (const quota of [today(3), today(5), today(1), {}]) {
      await seedOpenWork(today(3));
      await assertFails(accept(quota));
    }
  });

  it('starts a new day at 1, whatever yesterday’s count was', async () => {
    await seedOpenWork(yesterday(DEFAULT_LIMIT));
    await assertSucceeds(accept(today(1)));
  });

  it('denies carrying yesterday’s count over, or writing another day', async () => {
    await seedOpenWork(yesterday(4));
    await assertFails(accept(today(5)));
    await seedOpenWork(yesterday(4));
    await assertFails(accept(yesterday(5)));
    await seedOpenWork({});
    await assertFails(accept({ acceptedCount: 1, acceptedDay: TODAY + 1 }));
  });

  it('without quotaSettings uses the default limit of 20', async () => {
    await seedOpenWork(today(DEFAULT_LIMIT - 1));
    await assertSucceeds(accept(today(DEFAULT_LIMIT)));
    await seedOpenWork(today(DEFAULT_LIMIT));
    await assertFails(accept(today(DEFAULT_LIMIT + 1)));
  });

  it('uses the saved limit', async () => {
    await seedOpenWork(today(4), limitDoc(5));
    await assertSucceeds(accept(today(5)));
    await seedOpenWork(today(5), limitDoc(5));
    await assertFails(accept(today(6)));
  });

  it('a raised limit allows accepting again the same day', async () => {
    await seedOpenWork(today(DEFAULT_LIMIT), limitDoc(25));
    await assertSucceeds(accept(today(DEFAULT_LIMIT + 1)));
  });

  it('a limit lowered below today’s count blocks at once', async () => {
    await seedOpenWork(today(5), limitDoc(3));
    await assertFails(accept(today(6)));
  });

  it('each driver has their own count: another driver at the limit does not matter', async () => {
    await seedOpenWork(today(0), {
      ...limitDoc(1),
      'drivers/driver2': { ...availableDriverRecord(), ...today(1) },
    });
    await assertSucceeds(accept(today(1)));
  });
});

// ─── Out-of-area propose and claim ─────────────────────────────────────────

describe('quota: out-of-area propose', () => {
  it('allows proposing below the limit without counting', async () => {
    await seedOpenWork(today(DEFAULT_LIMIT - 1));
    await assertSucceeds(propose());
  });

  it('denies proposing at the limit', async () => {
    await seedOpenWork(today(DEFAULT_LIMIT));
    await assertFails(propose());
    await seedOpenWork(today(2), limitDoc(2));
    await assertFails(propose());
  });

  it('a count at the limit from yesterday does not block', async () => {
    await seedOpenWork(yesterday(DEFAULT_LIMIT));
    await assertSucceeds(propose());
  });

  it('denies counting the propose', async () => {
    await seedOpenWork(today(3));
    await assertFails(propose(today(4)));
  });
});

describe('quota: out-of-area claim', () => {
  async function seedClaim(stored: Quota, extra: Record<string, DocumentData> = {}): Promise<void> {
    const docs = claimDocs();
    await seed({
      ...docs,
      [`drivers/${DRIVER}`]: { ...docs[`drivers/${DRIVER}`], ...stored },
      ...extra,
    });
  }

  it('counts the claim', async () => {
    await seedClaim(today(3));
    await assertSucceeds(claim(today(4)));
  });

  it('is never refused for the quota (the passenger already confirmed this driver)', async () => {
    await seedClaim(today(DEFAULT_LIMIT));
    await assertSucceeds(claim(today(DEFAULT_LIMIT + 1)));
    // The limit was lowered while the driver held the proposal.
    await seedClaim(today(5), limitDoc(2));
    await assertSucceeds(claim(today(6)));
  });

  it('a claim after midnight counts 1 for the new day', async () => {
    await seedClaim(yesterday(DEFAULT_LIMIT));
    await assertSucceeds(claim(today(1)));
  });

  it('denies a claim that does not count, or counts wrongly', async () => {
    for (const quota of [{}, today(3), today(5)]) {
      await seedClaim(today(3));
      await assertFails(claim(quota));
    }
  });
});

// ─── Release: giving the slot back ─────────────────────────────────────────

describe('quota: release after a cancellation', () => {
  it('gives the slot back when the passenger cancelled before the trip started, today', async () => {
    await seedEndedBooking(today(2), PASSENGER_CANCELLED);
    await assertSucceeds(release(today(1)));
  });

  it('allows the release without giving the slot back', async () => {
    await seedEndedBooking(today(2), PASSENGER_CANCELLED);
    await assertSucceeds(release());
  });

  it('denies giving back more than one slot', async () => {
    await seedEndedBooking(today(2), PASSENGER_CANCELLED);
    await assertFails(release(today(0)));
  });

  it('denies a refund for a driver cancel', async () => {
    await seedEndedBooking(today(2), { ...PASSENGER_CANCELLED, cancelledBy: 'driver' });
    await assertFails(release(today(1)));
    await assertSucceeds(release());
  });

  it('denies a refund for a completed trip', async () => {
    await seedEndedBooking(today(2), {
      status: 'completed',
      acceptedAt: Timestamp.now(),
      startedAt: Timestamp.now(),
      completedAt: Timestamp.now(),
      finalFare: 45,
      paymentMethod: 'cash',
    });
    await assertFails(release(today(1)));
  });

  it('denies a refund once the trip had started', async () => {
    await seedEndedBooking(today(2), { ...PASSENGER_CANCELLED, startedAt: Timestamp.now() });
    await assertFails(release(today(1)));
  });

  it('denies a refund for a booking accepted on another day', async () => {
    await seedEndedBooking(today(2), {
      ...PASSENGER_CANCELLED,
      acceptedAt: Timestamp.fromMillis(Date.now() - DAY_MS),
    });
    await assertFails(release(today(1)));
  });

  it('denies a refund for a booking without acceptedAt', async () => {
    const { acceptedAt: _omitted, ...withoutAcceptedAt } = PASSENGER_CANCELLED;
    await seedEndedBooking(today(2), withoutAcceptedAt);
    await assertFails(release(today(1)));
  });

  it('denies a refund when today’s count is 0 or from another day', async () => {
    await seedEndedBooking(today(0), PASSENGER_CANCELLED);
    await assertFails(release(today(-1)));
    await seedEndedBooking(yesterday(3), PASSENGER_CANCELLED);
    await assertFails(release(today(2)));
    await seedEndedBooking(yesterday(3), PASSENGER_CANCELLED);
    await assertFails(release(yesterday(2)));
  });
});

// ─── Other writes cannot touch the count ───────────────────────────────────

describe('quota: the count changes only through accept, claim and release', () => {
  it('denies changing the count while going online, offline or moving', async () => {
    await seed({ [`drivers/${DRIVER}`]: { ...availableDriverRecord(), ...today(5) } });
    const ref = doc(db(DRIVER), 'drivers', DRIVER);
    await assertFails(updateDoc(ref, { ...today(0), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { isOnline: false, isAvailable: false, ...yesterday(5), updatedAt: serverTimestamp() }));
    await assertFails(
      updateDoc(ref, { currentLocation: { latitude: 9.9, longitude: 124.5 }, acceptedCount: 4, updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(updateDoc(ref, { isOnline: false, isAvailable: false, updatedAt: serverTimestamp() }));
  });

  it('denies an admin changing a driver’s count', async () => {
    await seed({ [`drivers/${DRIVER}`]: { ...availableDriverRecord(), ...today(5) } });
    await assertFails(
      updateDoc(doc(adminDb(), 'drivers', DRIVER), { acceptedCount: 0, updatedAt: serverTimestamp() }),
    );
  });

  it('denies a passenger or another driver changing a driver’s count', async () => {
    await seed({ [`drivers/${DRIVER}`]: { ...availableDriverRecord(), ...today(5) } });
    await assertFails(updateDoc(doc(db(PASSENGER), 'drivers', DRIVER), { acceptedCount: 0 }));
    await assertFails(updateDoc(doc(db('driver2'), 'drivers', DRIVER), { acceptedCount: 0 }));
  });
});

// ─── Admin reads (Quota page and Dashboard) ────────────────────────────────

describe('quota: admin reads', () => {
  it('an admin can count verified drivers at the limit today (Dashboard)', async () => {
    await seed({
      [`drivers/${DRIVER}`]: { ...availableDriverRecord(), ...today(DEFAULT_LIMIT) },
      'drivers/driver2': { ...availableDriverRecord(), ...today(3) },
    });
    const atLimit = query(
      collection(adminDb(), 'drivers'),
      where('isVerified', '==', true),
      where('acceptedDay', '==', TODAY),
      where('acceptedCount', '>=', DEFAULT_LIMIT),
    );
    const snapshot = await assertSucceeds(getCountFromServer(atLimit));
    if (snapshot.data().count !== 1) throw new Error(`expected 1 driver at the limit, got ${snapshot.data().count}`);
  });

  it('a driver cannot run that query over all drivers', async () => {
    const atLimit = query(
      collection(db(DRIVER), 'drivers'),
      where('acceptedDay', '==', TODAY),
      where('acceptedCount', '>=', DEFAULT_LIMIT),
    );
    await assertFails(getCountFromServer(atLimit));
  });
});
