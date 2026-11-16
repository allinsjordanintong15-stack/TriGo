/// <reference types="node" />

// Firestore rules tests for the admin suspension of a driver (drivers/{uid}: suspendedAt,
// suspendedUntil, suspensionReason, suspendedBy, suspensionLiftedAt, suspensionLiftedBy).
// Only admins write these fields: suspendedAt is the server time, suspendedUntil null (until
// lifted) or later than now. While a suspension is active (set, not lifted, not past
// suspendedUntil) the driver cannot accept a standard booking (T1) or propose on an
// out-of-area request; claiming a confirmed out-of-area booking, finishing a trip and duty
// changes stay allowed. Uses the admin website's exact payloads (driverActionPlan.ts).
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
  updateDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { liftSuspensionUpdate, suspensionUpdate } from '../../admin/src/drivers/driverActionPlan.ts';
import {
  ADMIN,
  appWrites,
  availableDriverRecord,
  baseDocs,
  BOOKING,
  claimDocs,
  commitAccept,
  commitClaim,
  commitPropose,
  commitWrites,
  DAY_MS,
  DRIVER,
  openBooking,
  openRequest,
  REQUEST,
  tripDocs,
} from './commissionFixtures.ts';

const PROJECT_ID = 'demo-trigo-rules';

// Denied writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

const REASON = 'Repeated late pickups reported by passengers.';

let testEnv: RulesTestEnvironment;

function db(uid: string, claims: Record<string, unknown> = {}): Firestore {
  return testEnv.authenticatedContext(uid, claims).firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(firestore, path), data);
  });
}

/** Adds suspension fields to the seeded driver record (rules disabled). */
async function seedSuspension(fields: DocumentData): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore() as unknown as Firestore, 'drivers', DRIVER), fields);
  });
}

/** A suspension an admin set an hour ago; `untilMs` from now (null = until lifted). */
function storedSuspension(untilMs: number | null, lifted = false): DocumentData {
  return {
    suspendedAt: Timestamp.fromMillis(Date.now() - 60 * 60 * 1000),
    suspendedUntil: untilMs === null ? null : Timestamp.fromMillis(Date.now() + untilMs),
    suspensionReason: REASON,
    suspendedBy: ADMIN,
    suspensionLiftedAt: lifted ? Timestamp.fromMillis(Date.now() - 1000) : null,
    suspensionLiftedBy: lifted ? ADMIN : null,
  };
}

function suspend(firestore: Firestore, until: Timestamp | null, overrides: DocumentData = {}): Promise<void> {
  return updateDoc(doc(firestore, 'drivers', DRIVER), {
    ...suspensionUpdate(REASON, until, ADMIN, serverTimestamp()),
    ...overrides,
  });
}

function inDays(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + days * DAY_MS);
}

async function seedOpenWork(): Promise<void> {
  await seed({
    [`drivers/${DRIVER}`]: availableDriverRecord(),
    [`bookings/${BOOKING}`]: openBooking(),
    [`outOfAreaRequests/${REQUEST}`]: openRequest(),
  });
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
  await seed(baseDocs());
  await seedOpenWork();
});

describe('admin suspension: suspend', () => {
  it('lets an admin suspend for a number of days or until lifted', async () => {
    await assertSucceeds(suspend(adminDb(), inDays(3)));
    await assertSucceeds(suspend(adminDb(), null));
  });

  it('lets an admin replace an earlier (lifted or expired) suspension', async () => {
    await seedSuspension(storedSuspension(null, true));
    await assertSucceeds(suspend(adminDb(), inDays(1)));
    await seedSuspension(storedSuspension(-DAY_MS));
    await assertSucceeds(suspend(adminDb(), inDays(7)));
  });

  it('requires the server time, this admin and an end after now', async () => {
    await assertFails(suspend(adminDb(), inDays(1), { suspendedAt: Timestamp.now() }));
    await assertFails(suspend(adminDb(), inDays(1), { suspendedBy: 'someoneElse' }));
    await assertFails(suspend(adminDb(), Timestamp.fromMillis(Date.now() - 60 * 1000)));
    await assertFails(suspend(adminDb(), inDays(1), { suspendedUntil: '2026-12-01' }));
  });

  it('requires a reason of 1–500 characters', async () => {
    await assertFails(suspend(adminDb(), inDays(1), { suspensionReason: '   ' }));
    await assertFails(suspend(adminDb(), inDays(1), { suspensionReason: 'x'.repeat(501) }));
    await assertSucceeds(suspend(adminDb(), inDays(1), { suspensionReason: 'x'.repeat(500) }));
  });

  it('must clear an earlier lift and change nothing else', async () => {
    await assertFails(suspend(adminDb(), inDays(1), { suspensionLiftedAt: serverTimestamp(), suspensionLiftedBy: ADMIN }));
    await assertFails(suspend(adminDb(), inDays(1), { isOnline: false, isAvailable: false }));
  });

  it('denies drivers and other users', async () => {
    await assertFails(suspend(db(DRIVER), inDays(1), { suspendedBy: DRIVER }));
    await assertFails(suspend(db('passenger1'), inDays(1), { suspendedBy: 'passenger1' }));
  });

  it('denies suspending an anonymized driver', async () => {
    await seedSuspension({ anonymizedAt: Timestamp.now() });
    await assertFails(suspend(adminDb(), inDays(1)));
  });
});

describe('admin suspension: lift', () => {
  function lift(firestore: Firestore, overrides: DocumentData = {}): Promise<void> {
    return updateDoc(doc(firestore, 'drivers', DRIVER), {
      ...liftSuspensionUpdate(ADMIN, serverTimestamp()),
      ...overrides,
    });
  }

  it('lets an admin lift a suspension once', async () => {
    await seedSuspension(storedSuspension(null));
    await assertSucceeds(lift(adminDb()));
    await assertFails(lift(adminDb()));
  });

  it('denies lifting when there is no suspension', async () => {
    await assertFails(lift(adminDb()));
  });

  it('requires the server time and this admin, and nothing else changed', async () => {
    await seedSuspension(storedSuspension(null));
    await assertFails(lift(adminDb(), { suspensionLiftedAt: Timestamp.now() }));
    await assertFails(lift(adminDb(), { suspensionLiftedBy: 'someoneElse' }));
    await assertFails(lift(adminDb(), { suspensionReason: 'Changed.' }));
  });

  it('denies the driver lifting or clearing their own suspension', async () => {
    await seedSuspension(storedSuspension(null));
    await assertFails(lift(db(DRIVER), { suspensionLiftedBy: DRIVER }));
    await assertFails(updateDoc(doc(db(DRIVER), 'drivers', DRIVER), { suspendedAt: null }));
    await assertFails(updateDoc(doc(db(DRIVER), 'drivers', DRIVER), { suspendedUntil: Timestamp.now() }));
    await assertFails(
      updateDoc(doc(db(DRIVER), 'drivers', DRIVER), { suspensionReason: '', isAvailable: false, updatedAt: serverTimestamp() }),
    );
  });
});

describe('admin suspension: new work blocked while active', () => {
  for (const [label, untilMs] of [
    ['until lifted', null],
    ['ends tomorrow', DAY_MS],
  ] as const) {
    it(`denies T1 accept (${label})`, async () => {
      await seedSuspension(storedSuspension(untilMs));
      await assertFails(commitAccept(db(DRIVER)));
    });

    it(`denies the out-of-area propose (${label})`, async () => {
      await seedSuspension(storedSuspension(untilMs));
      await assertFails(commitPropose(db(DRIVER)));
    });
  }
});

describe('admin suspension: allowed after it ends', () => {
  it('allows T1 accept and propose once suspendedUntil has passed', async () => {
    await seedSuspension(storedSuspension(-60 * 1000));
    await assertSucceeds(commitPropose(db(DRIVER)));
    await seedOpenWork();
    await seedSuspension(storedSuspension(-60 * 1000));
    await assertSucceeds(commitAccept(db(DRIVER)));
  });

  it('allows T1 accept and propose after an admin lifted it', async () => {
    await seedSuspension(storedSuspension(null, true));
    await assertSucceeds(commitAccept(db(DRIVER)));
    await seedOpenWork();
    await seedSuspension(storedSuspension(null, true));
    await assertSucceeds(commitPropose(db(DRIVER)));
  });

  it('lifting in the rules lets the next accept through', async () => {
    await seedSuspension(storedSuspension(null));
    await assertFails(commitAccept(db(DRIVER)));
    await assertSucceeds(updateDoc(doc(adminDb(), 'drivers', DRIVER), liftSuspensionUpdate(ADMIN, serverTimestamp())));
    await assertSucceeds(commitAccept(db(DRIVER)));
  });
});

describe('admin suspension: current work is not blocked', () => {
  it('allows claiming an out-of-area booking the passenger already confirmed', async () => {
    await seed(claimDocs());
    await seedSuspension(storedSuspension(null));
    await assertSucceeds(commitClaim(db(DRIVER)));
  });

  it('allows completing the current trip', async () => {
    await seed(tripDocs({}));
    await seedSuspension(storedSuspension(null));
    await assertSucceeds(commitWrites(db(DRIVER), appWrites({})));
  });

  it('allows staying online and changing availability', async () => {
    await seedSuspension(storedSuspension(null));
    await assertSucceeds(
      updateDoc(doc(db(DRIVER), 'drivers', DRIVER), { isAvailable: false, updatedAt: serverTimestamp() }),
    );
  });
});
