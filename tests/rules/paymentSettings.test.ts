/// <reference types="node" />

// Firestore rules tests for paymentSettings/active: TriGo's GCash account that drivers pay
// commission to. Admin-only write (custom claim `admin: true`), always the complete object
// { gcashName, gcashNumber, updatedAt, updatedBy } with updatedAt = server time and
// updatedBy = the admin's uid. Read by admins and anyone with a drivers/{uid} record
// (including a revoked driver); passengers cannot read it. No delete.
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
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';

// Denied reads and writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

const ADMIN = 'admin1';
const PASSENGER = 'passenger1';
const DRIVER = 'driver1';
const REVOKED_DRIVER = 'driver2';
const PATH = 'paymentSettings/active';

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

/** The complete object the admin website writes. */
function settings(overrides: DocumentData = {}, uid = ADMIN): DocumentData {
  return {
    gcashName: 'TriGo Transport Services',
    gcashNumber: '09171234567',
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    ...overrides,
  };
}

function write(firestore: Firestore, data: DocumentData) {
  return setDoc(doc(firestore, PATH), data);
}

async function seed(apply: (firestore: Firestore) => Promise<void>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await apply(context.firestore() as unknown as Firestore);
  });
}

async function seedExisting(): Promise<void> {
  await seed((firestore) =>
    setDoc(doc(firestore, PATH), {
      gcashName: 'TriGo Transport Services',
      gcashNumber: '09171234567',
      updatedAt: Timestamp.now(),
      updatedBy: ADMIN,
    }),
  );
}

async function seedDriverRecord(uid: string, isVerified: boolean): Promise<void> {
  await seed((firestore) =>
    setDoc(doc(firestore, 'drivers', uid), {
      fullName: 'Test Driver',
      vehicleType: 'tricycle',
      isVerified,
      isOnline: false,
      isAvailable: false,
    }),
  );
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
});

describe('paymentSettings: read', () => {
  beforeEach(seedExisting);

  it('lets an admin read', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), PATH)));
  });

  it('lets anyone with a driver record read, including a revoked driver', async () => {
    await seedDriverRecord(DRIVER, true);
    await seedDriverRecord(REVOKED_DRIVER, false);
    await assertSucceeds(getDoc(doc(db(DRIVER), PATH)));
    await assertSucceeds(getDoc(doc(db(REVOKED_DRIVER), PATH)));
  });

  it('lets a driver check for settings that are not saved yet', async () => {
    await seedDriverRecord(DRIVER, true);
    await seed((firestore) => deleteDoc(doc(firestore, PATH)));
    await assertSucceeds(getDoc(doc(db(DRIVER), PATH)));
  });

  it('denies passengers, users without a driver record, non-claim users and unauthenticated reads', async () => {
    await assertFails(getDoc(doc(db(PASSENGER), PATH)));
    await assertFails(getDoc(doc(db(DRIVER), PATH)));
    await assertFails(getDoc(doc(db(ADMIN, { admin: false }), PATH)));
    await assertFails(getDoc(doc(db(null), PATH)));
  });
});

describe('paymentSettings: create', () => {
  it('lets an admin create the complete object', async () => {
    await assertSucceeds(write(adminDb(), settings()));
  });

  it('allows a 60-character name', async () => {
    await assertSucceeds(write(adminDb(), settings({ gcashName: 'x'.repeat(60) })));
  });

  it('denies passengers, drivers, non-claim users and unauthenticated writes', async () => {
    await seedDriverRecord(DRIVER, true);
    await assertFails(write(db(PASSENGER), settings({}, PASSENGER)));
    await assertFails(write(db(DRIVER), settings({}, DRIVER)));
    await assertFails(write(db(ADMIN, { admin: false }), settings()));
    await assertFails(write(db(null), settings()));
  });

  it('denies other paymentSettings documents', async () => {
    await assertFails(setDoc(doc(adminDb(), 'paymentSettings/other'), settings()));
  });
});

describe('paymentSettings: validation', () => {
  beforeEach(seedExisting);

  it('lets an admin replace the object', async () => {
    await assertSucceeds(write(adminDb(), settings({ gcashName: 'TriGo Office', gcashNumber: '09987654321' })));
  });

  const invalid: [string, DocumentData][] = [
    ['an empty name', { gcashName: '' }],
    ['a name over 60 characters', { gcashName: 'x'.repeat(61) }],
    ['a name with leading or trailing spaces', { gcashName: ' TriGo ' }],
    ['a non-string name', { gcashName: 123 }],
    ['a number with spaces', { gcashNumber: '0917 123 4567' }],
    ['a +63 number', { gcashNumber: '+639171234567' }],
    ['a number not starting with 09', { gcashNumber: '08171234567' }],
    ['a 10-digit number', { gcashNumber: '0917123456' }],
    ['a 12-digit number', { gcashNumber: '091712345678' }],
    ['a numeric number', { gcashNumber: 9171234567 }],
    ['a client-chosen updatedAt', { updatedAt: Timestamp.now() }],
    ['another updatedBy', { updatedBy: 'someoneElse' }],
    ['an extra field', { accountType: 'personal' }],
  ];

  for (const [label, change] of invalid) {
    it(`denies ${label}`, async () => {
      await assertFails(write(adminDb(), settings(change)));
    });
  }

  it('denies a missing field', async () => {
    await assertFails(updateDoc(doc(adminDb(), PATH), { gcashName: deleteField(), updatedAt: serverTimestamp(), updatedBy: ADMIN }));
  });

  it('denies deleting, even for admins', async () => {
    await assertFails(deleteDoc(doc(adminDb(), PATH)));
  });
});
