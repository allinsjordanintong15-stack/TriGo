/// <reference types="node" />

// Firestore rules tests for supportContacts/{contactId}: admins (custom claim `admin: true`)
// read, create, update (always the complete document) and delete; signed-in users read only
// active contacts (the app's Help screen queries active == true).
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
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';

// Denied reads and writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

const ADMIN = 'admin1';
const PASSENGER = 'passenger1';
const DRIVER = 'driver1';
const ACTIVE = 'hotline';
const INACTIVE = 'old-office';

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

/** The write the admin website sends: the complete contact plus audit fields. */
function contactWrite(overrides: DocumentData = {}, uid = ADMIN): DocumentData {
  return {
    label: 'TriGo Support',
    phone: '0917 123 4567',
    active: true,
    sortOrder: 1,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    ...overrides,
  };
}

async function seedContacts(): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    const base = { sortOrder: 1, updatedAt: Timestamp.now(), updatedBy: ADMIN };
    await setDoc(doc(firestore, 'supportContacts', ACTIVE), {
      ...base,
      label: 'TriGo Hotline',
      phone: '+63 917 123 4567',
      active: true,
    });
    await setDoc(doc(firestore, 'supportContacts', INACTIVE), {
      ...base,
      label: 'Old office',
      phone: '(038) 123-4567',
      active: false,
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
  await seedContacts();
});

describe('supportContacts: read', () => {
  it('lets signed-in users read active contacts', async () => {
    await assertSucceeds(getDoc(doc(db(PASSENGER), 'supportContacts', ACTIVE)));
    await assertSucceeds(getDoc(doc(db(DRIVER), 'supportContacts', ACTIVE)));
  });

  it('lets signed-in users query active contacts (the Help screen query)', async () => {
    const snapshot = await assertSucceeds(
      getDocs(query(collection(db(PASSENGER), 'supportContacts'), where('active', '==', true))),
    );
    if (snapshot.size !== 1) throw new Error(`expected 1 active contact, got ${snapshot.size}`);
  });

  it('lets a driver, including a revoked one, run the same query (driver Profile and revoked card)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore() as unknown as Firestore, 'drivers', DRIVER), {
        uid: DRIVER,
        isVerified: false,
        isOnline: false,
        isAvailable: false,
        verificationNote: 'Revoked by admin',
      });
    });
    const snapshot = await assertSucceeds(
      getDocs(query(collection(db(DRIVER), 'supportContacts'), where('active', '==', true))),
    );
    if (snapshot.size !== 1) throw new Error(`expected 1 active contact, got ${snapshot.size}`);
    await assertFails(getDoc(doc(db(DRIVER), 'supportContacts', INACTIVE)));
  });

  it('denies non-admins inactive contacts and unfiltered queries', async () => {
    await assertFails(getDoc(doc(db(PASSENGER), 'supportContacts', INACTIVE)));
    await assertFails(getDocs(collection(db(PASSENGER), 'supportContacts')));
  });

  it('denies unauthenticated reads', async () => {
    await assertFails(getDoc(doc(db(null), 'supportContacts', ACTIVE)));
  });

  it('lets an admin read every contact', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'supportContacts', INACTIVE)));
    const snapshot = await assertSucceeds(getDocs(collection(adminDb(), 'supportContacts')));
    if (snapshot.size !== 2) throw new Error(`expected 2 contacts, got ${snapshot.size}`);
  });
});

describe('supportContacts: create and update', () => {
  it('lets an admin create a contact', async () => {
    await assertSucceeds(setDoc(doc(adminDb(), 'supportContacts', 'new'), contactWrite()));
  });

  it('lets an admin replace a contact, e.g. to deactivate it', async () => {
    await assertSucceeds(setDoc(doc(adminDb(), 'supportContacts', ACTIVE), contactWrite({ active: false })));
    await assertSucceeds(updateDoc(doc(adminDb(), 'supportContacts', ACTIVE), contactWrite({ sortOrder: 5 })));
  });

  it('accepts common phone formats', async () => {
    for (const phone of ['09171234567', '+639171234567', '+63 917 123 4567', '(038) 123-4567', '0917-123-4567']) {
      await assertSucceeds(setDoc(doc(adminDb(), 'supportContacts', 'new'), contactWrite({ phone })));
    }
  });

  it('denies non-admins', async () => {
    await assertFails(setDoc(doc(db(PASSENGER), 'supportContacts', 'new'), contactWrite({}, PASSENGER)));
    await assertFails(setDoc(doc(db(DRIVER), 'supportContacts', 'new'), contactWrite({}, DRIVER)));
    await assertFails(setDoc(doc(db(ADMIN, { admin: false }), 'supportContacts', 'new'), contactWrite()));
    await assertFails(updateDoc(doc(db(PASSENGER), 'supportContacts', ACTIVE), contactWrite({}, PASSENGER)));
  });

  const invalid: [string, DocumentData][] = [
    ['an empty label', { label: '' }],
    ['a blank label', { label: '   ' }],
    ['a label over 60 characters', { label: 'x'.repeat(61) }],
    ['a non-string label', { label: 7 }],
    ['a phone with letters', { phone: 'call 0917 123 4567' }],
    ['a too-short phone', { phone: '12345' }],
    ['a phone ending in a symbol', { phone: '0917-123-4567-' }],
    ['a numeric phone', { phone: 9171234567 }],
    ['a non-boolean active', { active: 'yes' }],
    ['a negative sortOrder', { sortOrder: -1 }],
    ['a sortOrder over 99', { sortOrder: 100 }],
    ['a fractional sortOrder', { sortOrder: 1.5 }],
    ['an extra field', { email: 'help@trigo.test' }],
    ['a client-chosen updatedAt', { updatedAt: Timestamp.now() }],
    ['another updatedBy', { updatedBy: 'someoneElse' }],
  ];

  for (const [label, change] of invalid) {
    it(`denies ${label}`, async () => {
      await assertFails(setDoc(doc(adminDb(), 'supportContacts', 'new'), contactWrite(change)));
    });
  }

  it('denies an update that leaves the stored document invalid', async () => {
    await assertFails(
      updateDoc(doc(adminDb(), 'supportContacts', ACTIVE), {
        phone: 'none',
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN,
      }),
    );
  });
});

describe('supportContacts: delete', () => {
  it('lets an admin delete a contact', async () => {
    await assertSucceeds(deleteDoc(doc(adminDb(), 'supportContacts', ACTIVE)));
  });

  it('denies non-admins', async () => {
    await assertFails(deleteDoc(doc(db(PASSENGER), 'supportContacts', ACTIVE)));
    await assertFails(deleteDoc(doc(db(DRIVER), 'supportContacts', ACTIVE)));
    await assertFails(deleteDoc(doc(db(null), 'supportContacts', ACTIVE)));
  });
});
