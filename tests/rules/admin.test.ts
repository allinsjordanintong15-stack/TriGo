/// <reference types="node" />

// Firestore rules tests for isAdmin(): the `admin: true` custom claim on the ID token
// (set by scripts/setAdminClaim.mjs), here for reading users/{uid}. Fare writes are
// covered in fareSettings.test.ts.
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
  doc,
  getDoc,
  setDoc,
  setLogLevel,
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

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

function user(uid: string, role: string): DocumentData {
  return { uid, role, fullName: `User ${uid}`, mobileNumber: '+639171234567', email: `${uid}@example.com` };
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
    await setDoc(doc(firestore, 'users', PASSENGER), user(PASSENGER, 'passenger'));
    await setDoc(doc(firestore, 'users', DRIVER), user(DRIVER, 'driver'));
  });
});

describe('isAdmin: users read', () => {
  it('lets a user with admin: true read any profile', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'users', PASSENGER)));
    await assertSucceeds(getDoc(doc(adminDb(), 'users', DRIVER)));
  });

  it('works without a users/{uid} document for the admin', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'users', 'missing-user')));
  });

  it('denies a signed-in user without the claim', async () => {
    await assertFails(getDoc(doc(db(PASSENGER), 'users', DRIVER)));
  });

  it('denies admin: false', async () => {
    await assertFails(getDoc(doc(db(ADMIN, { admin: false }), 'users', PASSENGER)));
  });

  it('denies a non-boolean admin claim', async () => {
    await assertFails(getDoc(doc(db(ADMIN, { admin: 'true' }), 'users', PASSENGER)));
    await assertFails(getDoc(doc(db(ADMIN, { admin: 1 }), 'users', PASSENGER)));
  });

  it('denies other claims that look like admin', async () => {
    await assertFails(getDoc(doc(db(ADMIN, { role: 'admin' }), 'users', PASSENGER)));
  });

  it('does not treat role "admin" in users/{uid} as the claim', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore() as unknown as Firestore;
      await setDoc(doc(firestore, 'users', ADMIN), user(ADMIN, 'admin'));
    });
    await assertFails(getDoc(doc(db(ADMIN), 'users', PASSENGER)));
  });

  it('denies unauthenticated reads', async () => {
    await assertFails(getDoc(doc(db(null), 'users', PASSENGER)));
  });

  it('still lets owners read their own profile', async () => {
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'users', PASSENGER)));
  });
});

describe('isAdmin: no new write access', () => {
  it('denies an admin updating another user', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'users', PASSENGER), { fullName: 'Changed' }));
  });

  it('denies an admin creating a user document', async () => {
    await assertFails(setDoc(doc(adminDb(), 'users', 'newUser'), user('newUser', 'passenger')));
  });

  it('denies an admin deleting a user', async () => {
    await assertFails(deleteDoc(doc(adminDb(), 'users', PASSENGER)));
  });

  it('denies an admin writing a fareSettings document other than active', async () => {
    await assertFails(setDoc(doc(adminDb(), 'fareSettings', 'current'), { baseFare: 20 }));
  });
});
