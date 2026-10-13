/// <reference types="node" />

// Firestore rules tests for commissionSettings/active: admin-only read and write (custom
// claim `admin: true`), always the complete object { percentage, paymentPeriodDays,
// gracePeriodDays, updatedAt, updatedBy }, with updatedAt = server time and updatedBy = the
// admin's uid. No delete.
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
const PATH = 'commissionSettings/active';

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
    percentage: 10,
    paymentPeriodDays: 7,
    gracePeriodDays: 3,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    ...overrides,
  };
}

function write(firestore: Firestore, data: DocumentData) {
  return setDoc(doc(firestore, PATH), data);
}

async function seedExisting(): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, PATH), {
      percentage: 10,
      paymentPeriodDays: 7,
      gracePeriodDays: 3,
      updatedAt: Timestamp.now(),
      updatedBy: ADMIN,
    });
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
});

describe('commissionSettings: read', () => {
  beforeEach(seedExisting);

  it('lets an admin read', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), PATH)));
  });

  it('denies passengers, drivers, non-claim users and unauthenticated reads', async () => {
    await assertFails(getDoc(doc(db(PASSENGER), PATH)));
    await assertFails(getDoc(doc(db(DRIVER), PATH)));
    await assertFails(getDoc(doc(db(ADMIN, { admin: false }), PATH)));
    await assertFails(getDoc(doc(db(ADMIN, { role: 'admin' }), PATH)));
    await assertFails(getDoc(doc(db(null), PATH)));
  });
});

describe('commissionSettings: create', () => {
  it('lets an admin create the complete object', async () => {
    await assertSucceeds(write(adminDb(), settings()));
  });

  it('allows the boundary values', async () => {
    await assertSucceeds(write(adminDb(), settings({ percentage: 0.01, paymentPeriodDays: 1, gracePeriodDays: 0 })));
    await assertSucceeds(write(adminDb(), settings({ percentage: 100, paymentPeriodDays: 31, gracePeriodDays: 14 })));
    await assertSucceeds(write(adminDb(), settings({ percentage: 12.35 })));
  });

  it('denies passengers, drivers, non-claim users and unauthenticated writes', async () => {
    await assertFails(write(db(PASSENGER), settings({}, PASSENGER)));
    await assertFails(write(db(DRIVER), settings({}, DRIVER)));
    await assertFails(write(db(ADMIN, { admin: false }), settings()));
    await assertFails(write(db(ADMIN, { admin: 'true' }), settings()));
    await assertFails(write(db(null), settings()));
  });

  it('denies other commissionSettings documents', async () => {
    await assertFails(setDoc(doc(adminDb(), 'commissionSettings', 'draft'), settings()));
  });
});

describe('commissionSettings: validation', () => {
  beforeEach(seedExisting);

  it('lets an admin replace the object', async () => {
    await assertSucceeds(write(adminDb(), settings({ percentage: 12.5, paymentPeriodDays: 3, gracePeriodDays: 2 })));
  });

  it('denies percentage 0, below 0, or above 100', async () => {
    await assertFails(write(adminDb(), settings({ percentage: 0 })));
    await assertFails(write(adminDb(), settings({ percentage: -5 })));
    await assertFails(write(adminDb(), settings({ percentage: 100.01 })));
  });

  it('denies a percentage with more than 2 decimals or not a number', async () => {
    await assertFails(write(adminDb(), settings({ percentage: 10.125 })));
    await assertFails(write(adminDb(), settings({ percentage: '10' })));
  });

  it('denies paymentPeriodDays outside 1-31 or not an integer', async () => {
    await assertFails(write(adminDb(), settings({ paymentPeriodDays: 0 })));
    await assertFails(write(adminDb(), settings({ paymentPeriodDays: 32 })));
    await assertFails(write(adminDb(), settings({ paymentPeriodDays: 7.5 })));
    await assertFails(write(adminDb(), settings({ paymentPeriodDays: '7' })));
  });

  it('denies gracePeriodDays outside 0-14 or not an integer', async () => {
    await assertFails(write(adminDb(), settings({ gracePeriodDays: -1 })));
    await assertFails(write(adminDb(), settings({ gracePeriodDays: 15 })));
    await assertFails(write(adminDb(), settings({ gracePeriodDays: 2.5 })));
    await assertFails(write(adminDb(), settings({ gracePeriodDays: null })));
  });

  it('denies a missing or extra field', async () => {
    const missing = settings();
    delete missing.gracePeriodDays;
    await assertFails(write(adminDb(), missing));
    await assertFails(write(adminDb(), settings({ flatFee: 5 })));
    await assertFails(
      updateDoc(doc(adminDb(), PATH), {
        gracePeriodDays: deleteField(),
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN,
      }),
    );
  });

  it('denies a client-chosen updatedAt, another updatedBy, or missing audit fields', async () => {
    await assertFails(write(adminDb(), settings({ updatedAt: Timestamp.now() })));
    await assertFails(write(adminDb(), settings({ updatedBy: 'someoneElse' })));
    await assertFails(updateDoc(doc(adminDb(), PATH), { percentage: 12 }));
  });

  it('denies non-admin updates', async () => {
    await assertFails(write(db(PASSENGER), settings({ percentage: 1 }, PASSENGER)));
    await assertFails(write(db(DRIVER), settings({ percentage: 1 }, DRIVER)));
  });

  it('denies deleting, even for admins', async () => {
    await assertFails(deleteDoc(doc(adminDb(), PATH)));
  });
});
