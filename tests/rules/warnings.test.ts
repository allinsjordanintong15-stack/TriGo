/// <reference types="node" />

// Firestore rules tests for warnings/{warningId}: admins create (ID = complaint ID when tied
// to a complaint, so one per complaint) and may only withdraw; the warned user reads their own
// and sets acknowledgedAt once; the reason is cleared only in the commit that anonymizes the
// user; nobody deletes. Uses the admin website's exact payloads (warningPlan.ts).
// Run with `npm run test:rules` (starts the Firestore emulator under a demo project).
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
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { anonymizedUserUpdate } from '../../admin/src/privacy/deletionPlan.ts';
import {
  clearedReasonUpdate,
  newWarningDoc,
  withdrawnWarningUpdate,
  type NewWarningInput,
} from '../../admin/src/warnings/warningPlan.ts';

const PROJECT_ID = 'demo-trigo-rules';

// Denied reads and writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

const ADMIN = 'admin1';
const PASSENGER = 'passenger1';
const DRIVER = 'driver1';
const OTHER = 'passenger2';
const BOOKING = 'booking1';
/** Filed by the passenger about the driver. */
const COMPLAINT = `${BOOKING}_${PASSENGER}`;
/** Filed by the driver about the passenger. */
const DRIVER_COMPLAINT = `${BOOKING}_${DRIVER}`;
/** Older complaint without reportedUserId. */
const OLD_COMPLAINT = `booking0_${PASSENGER}`;

let testEnv: RulesTestEnvironment;

function db(uid: string, claims: Record<string, unknown> = {}): Firestore {
  return testEnv.authenticatedContext(uid, claims).firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

function profile(uid: string, role: string, fullName: string): DocumentData {
  return {
    uid,
    role,
    fullName,
    mobileNumber: '+639171234567',
    email: `${uid}@example.com`,
    profileImage: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

function complaint(reporterId: string, reporterRole: string, reportedUserId: string | undefined): DocumentData {
  return {
    bookingId: reporterId === PASSENGER && reportedUserId === undefined ? 'booking0' : BOOKING,
    reporterId,
    reporterRole,
    ...(reportedUserId === undefined ? {} : { reportedUserId }),
    category: 'other',
    message: 'Something went wrong.',
    status: 'open',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) {
      await setDoc(doc(firestore, path), data);
    }
  });
}

/** The driver warned about the passenger's complaint. */
function driverWarning(overrides: Partial<NewWarningInput> = {}): NewWarningInput {
  return {
    userId: DRIVER,
    role: 'driver',
    complaintId: COMPLAINT,
    bookingId: BOOKING,
    reason: 'Please do not ask passengers for more than the agreed fare.',
    ...overrides,
  };
}

function createWarning(
  id: string,
  input: NewWarningInput,
  firestore: Firestore = adminDb(),
  extra: DocumentData = {},
): Promise<void> {
  return setDoc(doc(firestore, 'warnings', id), {
    ...newWarningDoc(input, ADMIN, serverTimestamp()),
    ...extra,
  });
}

/** An existing active warning on the driver (rules disabled). */
async function seedWarning(overrides: DocumentData = {}): Promise<void> {
  await seed({
    [`warnings/${COMPLAINT}`]: {
      ...newWarningDoc(driverWarning(), ADMIN, Timestamp.now()),
      ...overrides,
    },
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
  await seed({
    [`users/${PASSENGER}`]: profile(PASSENGER, 'passenger', 'Maria Santos'),
    [`users/${DRIVER}`]: profile(DRIVER, 'driver', 'Pedro Reyes'),
    [`users/${OTHER}`]: profile(OTHER, 'passenger', 'Jose Cruz'),
    [`complaints/${COMPLAINT}`]: complaint(PASSENGER, 'passenger', DRIVER),
    [`complaints/${DRIVER_COMPLAINT}`]: complaint(DRIVER, 'driver', PASSENGER),
    [`complaints/${OLD_COMPLAINT}`]: complaint(PASSENGER, 'passenger', undefined),
  });
});

describe('warnings: create', () => {
  it('lets an admin warn the driver a passenger complained about', async () => {
    await assertSucceeds(createWarning(COMPLAINT, driverWarning()));
  });

  it('lets an admin warn the passenger a driver complained about', async () => {
    await assertSucceeds(
      createWarning(
        DRIVER_COMPLAINT,
        driverWarning({ userId: PASSENGER, role: 'passenger', complaintId: DRIVER_COMPLAINT }),
      ),
    );
  });

  it('lets an admin warn without a complaint (no booking either)', async () => {
    await assertSucceeds(
      createWarning('manual1', driverWarning({ complaintId: null, bookingId: null })),
    );
  });

  it('denies anyone but an admin (the reporter and the warned user included)', async () => {
    await assertFails(createWarning(COMPLAINT, driverWarning(), db(PASSENGER)));
    await assertFails(createWarning(COMPLAINT, driverWarning(), db(DRIVER)));
    await assertFails(createWarning(COMPLAINT, driverWarning(), db(ADMIN)));
  });

  it('denies a second warning for the same complaint', async () => {
    await assertSucceeds(createWarning(COMPLAINT, driverWarning()));
    await assertFails(createWarning(COMPLAINT, driverWarning({ reason: 'Another reason.' })));
  });

  it('denies an ID other than the complaint ID', async () => {
    await assertFails(createWarning('other-id', driverWarning()));
  });

  it('denies warning someone the complaint is not about', async () => {
    await assertFails(createWarning(COMPLAINT, driverWarning({ userId: PASSENGER })));
    await assertFails(createWarning(COMPLAINT, driverWarning({ userId: OTHER })));
  });

  it('denies the wrong role or booking', async () => {
    await assertFails(createWarning(COMPLAINT, driverWarning({ role: 'passenger' })));
    await assertFails(createWarning(COMPLAINT, driverWarning({ bookingId: 'booking9' })));
  });

  it('denies a missing complaint or one without reportedUserId', async () => {
    await assertFails(createWarning('nope_x', driverWarning({ complaintId: 'nope_x' })));
    await assertFails(
      createWarning(OLD_COMPLAINT, driverWarning({ complaintId: OLD_COMPLAINT, bookingId: 'booking0' })),
    );
  });

  it('denies a booking without a complaint', async () => {
    await assertFails(createWarning('manual1', { ...driverWarning(), complaintId: null }, adminDb(), { bookingId: BOOKING }));
  });

  it('denies an empty or too long reason', async () => {
    await assertFails(createWarning(COMPLAINT, driverWarning({ reason: '   ' })));
    await assertFails(createWarning(COMPLAINT, driverWarning({ reason: 'x'.repeat(501) })));
    await assertSucceeds(createWarning(COMPLAINT, driverWarning({ reason: 'x'.repeat(500) })));
  });

  it('denies a different admin id, client time, status, acknowledgement or extra field', async () => {
    await assertFails(createWarning(COMPLAINT, driverWarning(), adminDb(), { adminId: 'admin2' }));
    await assertFails(createWarning(COMPLAINT, driverWarning(), adminDb(), { createdAt: Timestamp.now() }));
    await assertFails(createWarning(COMPLAINT, driverWarning(), adminDb(), { status: 'withdrawn' }));
    await assertFails(createWarning(COMPLAINT, driverWarning(), adminDb(), { acknowledgedAt: Timestamp.now() }));
    await assertFails(createWarning(COMPLAINT, driverWarning(), adminDb(), { suspended: true }));
  });
});

describe('warnings: read', () => {
  beforeEach(() => seedWarning());

  it('lets the warned user read and list their own', async () => {
    await assertSucceeds(getDoc(doc(db(DRIVER), 'warnings', COMPLAINT)));
    await assertSucceeds(getDocs(query(collection(db(DRIVER), 'warnings'), where('userId', '==', DRIVER))));
  });

  it("denies other users, the reporter included, and lists without the user's filter", async () => {
    await assertFails(getDoc(doc(db(PASSENGER), 'warnings', COMPLAINT)));
    await assertFails(getDoc(doc(db(OTHER), 'warnings', COMPLAINT)));
    await assertFails(getDocs(query(collection(db(PASSENGER), 'warnings'), where('userId', '==', DRIVER))));
    await assertFails(getDocs(collection(db(DRIVER), 'warnings')));
  });

  it('lets an admin read and list all warnings', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'warnings', COMPLAINT)));
    await assertSucceeds(getDocs(collection(adminDb(), 'warnings')));
  });
});

describe('warnings: acknowledge', () => {
  beforeEach(() => seedWarning());

  const acknowledge = (firestore: Firestore, data: DocumentData = { acknowledgedAt: serverTimestamp() }) =>
    updateDoc(doc(firestore, 'warnings', COMPLAINT), data);

  it('lets the warned user acknowledge once', async () => {
    await assertSucceeds(acknowledge(db(DRIVER)));
    await assertFails(acknowledge(db(DRIVER)));
  });

  it('denies a client time or another field', async () => {
    await assertFails(acknowledge(db(DRIVER), { acknowledgedAt: Timestamp.now() }));
    await assertFails(acknowledge(db(DRIVER), { acknowledgedAt: serverTimestamp(), reason: '' }));
    await assertFails(acknowledge(db(DRIVER), { status: 'withdrawn' }));
  });

  it('denies other users and admins acknowledging for the user', async () => {
    await assertFails(acknowledge(db(PASSENGER)));
    await assertFails(acknowledge(adminDb()));
  });

  it('denies acknowledging a withdrawn warning', async () => {
    await seedWarning({ status: 'withdrawn', withdrawnAt: Timestamp.now(), withdrawnBy: ADMIN });
    await assertFails(acknowledge(db(DRIVER)));
  });
});

describe('warnings: withdraw', () => {
  beforeEach(() => seedWarning());

  const withdraw = (firestore: Firestore, data: DocumentData = withdrawnWarningUpdate(serverTimestamp(), ADMIN)) =>
    updateDoc(doc(firestore, 'warnings', COMPLAINT), data);

  it('lets an admin withdraw an active warning, once', async () => {
    await assertSucceeds(withdraw(adminDb()));
    await assertFails(withdraw(adminDb()));
  });

  it('lets an admin withdraw an acknowledged warning', async () => {
    await seedWarning({ acknowledgedAt: Timestamp.now() });
    await assertSucceeds(withdraw(adminDb()));
  });

  it('denies withdrawing by anyone but an admin', async () => {
    await assertFails(withdraw(db(DRIVER), withdrawnWarningUpdate(serverTimestamp(), DRIVER)));
    await assertFails(withdraw(db(PASSENGER), withdrawnWarningUpdate(serverTimestamp(), PASSENGER)));
  });

  it('denies a client time, another admin id, or other changes', async () => {
    await assertFails(withdraw(adminDb(), withdrawnWarningUpdate(Timestamp.now(), ADMIN)));
    await assertFails(withdraw(adminDb(), withdrawnWarningUpdate(serverTimestamp(), 'admin2')));
    await assertFails(withdraw(adminDb(), { ...withdrawnWarningUpdate(serverTimestamp(), ADMIN), reason: 'Edited.' }));
  });

  it('denies admins editing a warning otherwise', async () => {
    await assertFails(withdraw(adminDb(), { reason: 'Edited reason.' }));
    await assertFails(withdraw(adminDb(), { userId: OTHER }));
    await assertFails(withdraw(adminDb(), { status: 'active' }));
  });
});

describe('warnings: account deletion', () => {
  beforeEach(() => seedWarning());

  function anonymizeWithWarning(warningUpdate: DocumentData, withUser = true): Promise<void> {
    const firestore = adminDb();
    const batch = writeBatch(firestore);
    if (withUser) batch.update(doc(firestore, 'users', DRIVER), anonymizedUserUpdate(serverTimestamp()));
    batch.update(doc(firestore, 'warnings', COMPLAINT), warningUpdate);
    return batch.commit();
  }

  it('lets an admin clear the reason in the commit that anonymizes the user', async () => {
    await assertSucceeds(anonymizeWithWarning(clearedReasonUpdate(serverTimestamp())));
    // The record stays, without its reason.
    const snap = await getDoc(doc(adminDb(), 'warnings', COMPLAINT));
    assert.equal(snap.data()?.reason, '');
    assert.equal(snap.data()?.status, 'active');
  });

  it('denies clearing the reason without anonymizing the user', async () => {
    await assertFails(anonymizeWithWarning(clearedReasonUpdate(serverTimestamp()), false));
  });

  it('denies other changes in the anonymizing commit', async () => {
    await assertFails(anonymizeWithWarning({ reason: 'Changed.', reasonClearedAt: serverTimestamp() }));
    await assertFails(anonymizeWithWarning({ ...clearedReasonUpdate(serverTimestamp()), status: 'withdrawn' }));
    await assertFails(anonymizeWithWarning(clearedReasonUpdate(Timestamp.now())));
  });
});

describe('warnings: delete', () => {
  beforeEach(() => seedWarning());

  it('denies deleting, for admins and the warned user', async () => {
    await assertFails(deleteDoc(doc(adminDb(), 'warnings', COMPLAINT)));
    await assertFails(deleteDoc(doc(db(DRIVER), 'warnings', COMPLAINT)));
  });
});
