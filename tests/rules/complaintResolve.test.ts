/// <reference types="node" />

// Firestore rules tests for resolving a complaint with an outcome (complaints: isValidOutcome):
// admins resolve with 'no_action', 'warned' (warnings/{complaintId} exists after the commit) or
// 'suspended' (the reported driver's admin suspension is set in the same commit), recording
// resolvedAt/resolvedBy; reopening clears the outcome; a note can still be saved on a resolved
// complaint. Uses the admin website's exact payloads (complaintResolve.ts, warningPlan.ts,
// driverActionPlan.ts), each combination in one batch as admin/src/complaints/complaints.ts writes it.
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
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import {
  reopenedComplaintUpdate,
  resolvedComplaintUpdate,
  type ComplaintOutcome,
} from '../../admin/src/complaints/complaintResolve.ts';
import { newAdminMessageDoc, suspensionUpdate } from '../../admin/src/drivers/driverActionPlan.ts';
import { newWarningDoc } from '../../admin/src/warnings/warningPlan.ts';

const PROJECT_ID = 'demo-trigo-rules';

// Denied writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

const ADMIN = 'admin1';
const PASSENGER = 'passenger1';
const DRIVER = 'driver1';
const BOOKING = 'booking1';
/** Filed by the passenger about the driver. */
const ABOUT_DRIVER = `${BOOKING}_${PASSENGER}`;
/** Filed by the driver about the passenger. */
const ABOUT_PASSENGER = `${BOOKING}_${DRIVER}`;
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

function complaint(reporterId: string, reporterRole: string, reportedUserId: string | undefined, status = 'in_review'): DocumentData {
  return {
    bookingId: BOOKING,
    reporterId,
    reporterRole,
    ...(reportedUserId === undefined ? {} : { reportedUserId }),
    category: 'other',
    message: 'Something went wrong.',
    status,
    adminNotes: '',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

function resolve(firestore: Firestore, id: string, outcome: ComplaintOutcome, overrides: DocumentData = {}) {
  return updateDoc(doc(firestore, 'complaints', id), {
    ...resolvedComplaintUpdate(outcome, 'Reviewed.', ADMIN, serverTimestamp()),
    ...overrides,
  });
}

/** Resolve + warning in one batch (complaints.ts resolveComplaint, outcome 'warned'). */
function resolveWithWarning(id: string, userId: string, role: 'driver' | 'passenger', withWarning = true) {
  const firestore = adminDb();
  const batch = writeBatch(firestore);
  const now = serverTimestamp();
  if (withWarning) {
    batch.set(
      doc(firestore, 'warnings', id),
      newWarningDoc({ userId, role, complaintId: id, bookingId: BOOKING, reason: REASON }, ADMIN, now),
    );
  }
  batch.update(doc(firestore, 'complaints', id), resolvedComplaintUpdate('warned', '', ADMIN, now));
  return batch.commit();
}

/** Resolve + suspension + message in one batch (outcome 'suspended'). */
function resolveWithSuspension(id: string, driverId: string, withSuspension = true) {
  const firestore = adminDb();
  const batch = writeBatch(firestore);
  const now = serverTimestamp();
  const until = Timestamp.fromMillis(Date.now() + 3 * 86_400_000);
  if (withSuspension) {
    batch.update(doc(firestore, 'drivers', driverId), suspensionUpdate(REASON, until, ADMIN, now));
    batch.set(
      doc(firestore, 'adminMessages', `msg-${id}`),
      newAdminMessageDoc({ userId: driverId, kind: 'suspended', reason: REASON, until, untilLabel: 'Nov 20, 2026' }, ADMIN, now),
    );
  }
  batch.update(doc(firestore, 'complaints', id), resolvedComplaintUpdate('suspended', 'Repeated behavior', ADMIN, now));
  return batch.commit();
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
  await seed({
    [`users/${PASSENGER}`]: { uid: PASSENGER, role: 'passenger', fullName: 'Ana Santos' },
    [`users/${DRIVER}`]: { uid: DRIVER, role: 'driver', fullName: 'Carlo Bautista' },
    [`bookings/${BOOKING}`]: { passengerId: PASSENGER, driverId: DRIVER, status: 'completed' },
    [`drivers/${DRIVER}`]: {
      fullName: 'Carlo Bautista',
      isVerified: true,
      isOnline: false,
      isAvailable: false,
      vehicleType: 'tricycle',
      currentBookingId: null,
      currentRequestId: null,
    },
    [`complaints/${ABOUT_DRIVER}`]: complaint(PASSENGER, 'passenger', DRIVER),
    [`complaints/${ABOUT_PASSENGER}`]: complaint(DRIVER, 'driver', PASSENGER),
  });
});

describe('complaint resolve: no action', () => {
  it('lets an admin resolve with an outcome, now, by them', async () => {
    await assertSucceeds(resolve(adminDb(), ABOUT_DRIVER, 'no_action'));
  });

  it('denies non-admins, unknown outcomes and wrong who/when', async () => {
    await assertFails(resolve(db(PASSENGER), ABOUT_DRIVER, 'no_action', { updatedBy: PASSENGER, resolvedBy: PASSENGER }));
    await assertFails(resolve(adminDb(), ABOUT_DRIVER, 'no_action', { outcome: 'banned' }));
    await assertFails(resolve(adminDb(), ABOUT_DRIVER, 'no_action', { resolvedAt: Timestamp.now() }));
    await assertFails(resolve(adminDb(), ABOUT_DRIVER, 'no_action', { resolvedBy: 'someoneElse' }));
  });

  it('denies an outcome on a complaint that is not resolved', async () => {
    await assertFails(resolve(adminDb(), ABOUT_DRIVER, 'no_action', { status: 'in_review' }));
  });
});

describe('complaint resolve: warned', () => {
  it('allows resolve + warning in one commit (driver or passenger)', async () => {
    await assertSucceeds(resolveWithWarning(ABOUT_DRIVER, DRIVER, 'driver'));
    await assertSucceeds(resolveWithWarning(ABOUT_PASSENGER, PASSENGER, 'passenger'));
  });

  it('allows "warned" when the warning was sent earlier', async () => {
    await seed({
      [`warnings/${ABOUT_DRIVER}`]: newWarningDoc(
        { userId: DRIVER, role: 'driver', complaintId: ABOUT_DRIVER, bookingId: BOOKING, reason: REASON },
        ADMIN,
        Timestamp.now(),
      ),
    });
    await assertSucceeds(resolve(adminDb(), ABOUT_DRIVER, 'warned'));
  });

  it('denies "warned" without a warning', async () => {
    await assertFails(resolveWithWarning(ABOUT_DRIVER, DRIVER, 'driver', false));
  });
});

describe('complaint resolve: suspended', () => {
  it('allows resolve + suspension + message in one commit', async () => {
    await assertSucceeds(resolveWithSuspension(ABOUT_DRIVER, DRIVER));
  });

  it('denies "suspended" without suspending the driver in the same commit', async () => {
    await assertFails(resolveWithSuspension(ABOUT_DRIVER, DRIVER, false));
    // An earlier suspension does not count: suspendedAt must be this commit's time.
    await seed({
      [`drivers/${DRIVER}`]: {
        isVerified: true,
        isOnline: false,
        isAvailable: false,
        vehicleType: 'tricycle',
        currentBookingId: null,
        currentRequestId: null,
        suspendedAt: Timestamp.fromMillis(Date.now() - 86_400_000),
        suspendedUntil: null,
        suspensionReason: REASON,
        suspendedBy: ADMIN,
        suspensionLiftedAt: null,
        suspensionLiftedBy: null,
      },
    });
    await assertFails(resolve(adminDb(), ABOUT_DRIVER, 'suspended'));
  });

  it('denies "suspended" for a complaint about a passenger', async () => {
    await assertFails(resolveWithSuspension(ABOUT_PASSENGER, DRIVER));
  });

  it('denies "suspended" for an older complaint without reportedUserId', async () => {
    await seed({ [`complaints/${ABOUT_DRIVER}`]: complaint(PASSENGER, 'passenger', undefined) });
    await assertFails(resolveWithSuspension(ABOUT_DRIVER, DRIVER));
  });
});

describe('complaint resolve: after resolving', () => {
  beforeEach(() => resolve(adminDb(), ABOUT_DRIVER, 'no_action'));

  it('lets an admin save a note and keep the outcome', async () => {
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'complaints', ABOUT_DRIVER), {
        adminNotes: 'Called the passenger back.',
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN,
      }),
    );
  });

  it('denies changing the outcome without resolving again now', async () => {
    await assertFails(
      updateDoc(doc(adminDb(), 'complaints', ABOUT_DRIVER), {
        outcome: 'warned',
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN,
      }),
    );
  });

  it('reopens (In review) only with the outcome cleared', async () => {
    await assertFails(
      updateDoc(doc(adminDb(), 'complaints', ABOUT_DRIVER), {
        status: 'in_review',
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN,
      }),
    );
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'complaints', ABOUT_DRIVER), reopenedComplaintUpdate('Reviewed.', ADMIN, serverTimestamp())),
    );
  });

  it('keeps notes editable on a complaint resolved before outcomes existed', async () => {
    await seed({ [`complaints/${ABOUT_PASSENGER}`]: complaint(DRIVER, 'driver', PASSENGER, 'resolved') });
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'complaints', ABOUT_PASSENGER), {
        adminNotes: 'Old complaint, noted.',
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN,
      }),
    );
  });
});
