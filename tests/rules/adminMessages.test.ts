/// <reference types="node" />

// Firestore rules tests for adminMessages/{messageId}: "messages from TriGo" (suspension and
// verification notices). Admins create with the exact field set; the user reads only their
// own and sets readAt once; in the commit that anonymizes the user an admin clears reason and
// body (the record stays); nobody deletes. Uses the admin website's exact payloads
// (driverActionPlan.ts), including revoke + message and suspend + message in one commit.
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

import {
  clearedAdminMessageUpdate,
  newAdminMessageDoc,
  suspensionUpdate,
  type AdminMessageKind,
} from '../../admin/src/drivers/driverActionPlan.ts';
import { anonymizedUserUpdate } from '../../admin/src/privacy/deletionPlan.ts';

const PROJECT_ID = 'demo-trigo-rules';

// Denied reads and writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

const ADMIN = 'admin1';
const DRIVER = 'driver1';
const OTHER = 'passenger2';
const MESSAGE = 'message1';
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

function message(kind: AdminMessageKind, now: unknown, until: unknown = null): DocumentData {
  return newAdminMessageDoc(
    { userId: DRIVER, kind, reason: REASON, until, untilLabel: until ? 'Nov 20, 2026' : null },
    ADMIN,
    now,
  );
}

function create(data: DocumentData, firestore: Firestore = adminDb(), id = MESSAGE): Promise<void> {
  return setDoc(doc(firestore, 'adminMessages', id), data);
}

async function seedMessage(overrides: DocumentData = {}): Promise<void> {
  await seed({ [`adminMessages/${MESSAGE}`]: { ...message('suspended', Timestamp.now()), ...overrides } });
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
    [`users/${DRIVER}`]: { uid: DRIVER, role: 'driver', fullName: 'Pedro Reyes', email: 'd@example.com', mobileNumber: '+639171234567' },
    [`users/${OTHER}`]: { uid: OTHER, role: 'passenger', fullName: 'Jose Cruz', email: 'p@example.com', mobileNumber: '+639171234568' },
    [`drivers/${DRIVER}`]: {
      fullName: 'Pedro Reyes',
      isVerified: true,
      isOnline: true,
      isAvailable: true,
      vehicleType: 'tricycle',
      currentBookingId: null,
      currentRequestId: null,
    },
  });
});

describe('adminMessages: create', () => {
  it('lets an admin create every kind', async () => {
    await assertSucceeds(create(message('suspended', serverTimestamp(), Timestamp.fromMillis(Date.now() + 86400000)), adminDb(), 'a'));
    await assertSucceeds(create(message('suspended', serverTimestamp()), adminDb(), 'b'));
    await assertSucceeds(create(message('suspension_lifted', serverTimestamp()), adminDb(), 'c'));
    await assertSucceeds(create(message('revoked', serverTimestamp()), adminDb(), 'd'));
    await assertSucceeds(create(message('restored', serverTimestamp()), adminDb(), 'e'));
  });

  it('denies non-admins, including the user', async () => {
    await assertFails(create({ ...message('restored', serverTimestamp()), createdBy: DRIVER }, db(DRIVER)));
    await assertFails(create({ ...message('restored', serverTimestamp()), createdBy: OTHER }, db(OTHER)));
  });

  it('requires the server time, this admin and an unread message', async () => {
    await assertFails(create(message('revoked', Timestamp.now())));
    await assertFails(create({ ...message('revoked', serverTimestamp()), createdBy: 'someoneElse' }));
    await assertFails(create({ ...message('revoked', serverTimestamp()), readAt: serverTimestamp() }));
  });

  it('checks kind, texts and until', async () => {
    const valid = message('revoked', serverTimestamp());
    await assertFails(create({ ...valid, kind: 'announcement' }));
    await assertFails(create({ ...valid, reason: '  ' }));
    await assertFails(create({ ...valid, reason: 'x'.repeat(501) }));
    await assertFails(create({ ...valid, title: '' }));
    await assertFails(create({ ...valid, title: 'x'.repeat(121) }));
    await assertFails(create({ ...valid, body: 'x'.repeat(1001) }));
    await assertFails(create({ ...valid, until: 'tomorrow' }));
    await assertFails(create({ ...valid, userId: '' }));
  });

  it('requires exactly the known fields', async () => {
    const valid = message('revoked', serverTimestamp());
    await assertFails(create({ ...valid, extra: true }));
    const { readAt: _readAt, ...missing } = valid;
    await assertFails(create(missing));
  });

  it('accepts suspend + message in one commit (admin website)', async () => {
    const firestore = adminDb();
    const until = Timestamp.fromMillis(Date.now() + 3 * 86400000);
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'drivers', DRIVER), suspensionUpdate(REASON, until, ADMIN, serverTimestamp()));
    batch.set(doc(firestore, 'adminMessages', MESSAGE), message('suspended', serverTimestamp(), until));
    await assertSucceeds(batch.commit());
  });

  it('accepts revoke + message in one commit (admin website)', async () => {
    const firestore = adminDb();
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'drivers', DRIVER), {
      isVerified: false,
      isOnline: false,
      isAvailable: false,
      verificationNote: REASON,
      verificationUpdatedAt: serverTimestamp(),
      verificationUpdatedBy: ADMIN,
    });
    batch.set(doc(firestore, 'adminMessages', MESSAGE), message('revoked', serverTimestamp()));
    await assertSucceeds(batch.commit());
  });
});

describe('adminMessages: read', () => {
  beforeEach(() => seedMessage());

  it('lets the user read and list their own', async () => {
    await assertSucceeds(getDoc(doc(db(DRIVER), 'adminMessages', MESSAGE)));
    await assertSucceeds(getDocs(query(collection(db(DRIVER), 'adminMessages'), where('userId', '==', DRIVER))));
  });

  it("denies reading someone else's or listing everything", async () => {
    await assertFails(getDoc(doc(db(OTHER), 'adminMessages', MESSAGE)));
    await assertFails(getDocs(query(collection(db(OTHER), 'adminMessages'), where('userId', '==', DRIVER))));
    await assertFails(getDocs(collection(db(DRIVER), 'adminMessages')));
  });

  it('lets admins read and list', async () => {
    await assertSucceeds(getDocs(query(collection(adminDb(), 'adminMessages'), where('userId', '==', DRIVER))));
  });
});

describe('adminMessages: mark read', () => {
  beforeEach(() => seedMessage());

  it('lets the user set readAt once, to the server time', async () => {
    await assertFails(updateDoc(doc(db(DRIVER), 'adminMessages', MESSAGE), { readAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(doc(db(DRIVER), 'adminMessages', MESSAGE), { readAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(DRIVER), 'adminMessages', MESSAGE), { readAt: serverTimestamp() }));
  });

  it('denies other users, other fields and admins editing', async () => {
    await assertFails(updateDoc(doc(db(OTHER), 'adminMessages', MESSAGE), { readAt: serverTimestamp() }));
    await assertFails(
      updateDoc(doc(db(DRIVER), 'adminMessages', MESSAGE), { readAt: serverTimestamp(), reason: '' }),
    );
    await assertFails(updateDoc(doc(adminDb(), 'adminMessages', MESSAGE), { reason: 'Changed.' }));
  });
});

describe('adminMessages: account deletion', () => {
  beforeEach(() => seedMessage());

  function anonymizeWithMessage(update: DocumentData, withUser = true): Promise<void> {
    const firestore = adminDb();
    const batch = writeBatch(firestore);
    if (withUser) batch.update(doc(firestore, 'users', OTHER), anonymizedUserUpdate(serverTimestamp()));
    batch.update(doc(firestore, 'adminMessages', MESSAGE), update);
    return batch.commit();
  }

  it('lets an admin clear reason and body in the commit that anonymizes the user', async () => {
    // The message belongs to OTHER here: a passenger account with no driver record.
    await seedMessage({ userId: OTHER });
    await assertSucceeds(anonymizeWithMessage(clearedAdminMessageUpdate(serverTimestamp())));
    const snap = await getDoc(doc(adminDb(), 'adminMessages', MESSAGE));
    assert.equal(snap.data()?.reason, '');
    assert.equal(snap.data()?.body, '');
    assert.equal(snap.data()?.kind, 'suspended');
  });

  it('denies clearing without anonymizing the user, or changing anything else', async () => {
    await seedMessage({ userId: OTHER });
    await assertFails(anonymizeWithMessage(clearedAdminMessageUpdate(serverTimestamp()), false));
    await assertFails(anonymizeWithMessage({ ...clearedAdminMessageUpdate(serverTimestamp()), title: '' }));
    await assertFails(anonymizeWithMessage(clearedAdminMessageUpdate(Timestamp.now())));
  });
});

describe('adminMessages: delete', () => {
  beforeEach(() => seedMessage());

  it('denies deleting, for admins and the user', async () => {
    await assertFails(deleteDoc(doc(adminDb(), 'adminMessages', MESSAGE)));
    await assertFails(deleteDoc(doc(db(DRIVER), 'adminMessages', MESSAGE)));
  });
});
