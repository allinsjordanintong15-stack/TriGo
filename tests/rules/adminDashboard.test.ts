/// <reference types="node" />

// Firestore rules tests for the admin website's sidebar badges (admin/src/lib/adminCounts.ts):
// count() of pending payments, pending driver applications and open complaints. Admins
// only; the dashboard's queries are added here in a later step. No rule changes: these use
// the existing admin reads. Run with `npm run test:rules`.
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
  doc,
  getCountFromServer,
  query,
  setDoc,
  setLogLevel,
  Timestamp,
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-trigo-rules';
const ADMIN = 'admin1';
const DRIVER = 'driver1';
const PASSENGER = 'passenger1';

// Denied reads are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(firestore, path), data);
  });
}

/** The three badge queries, exactly as loadAdminCounts runs them. */
const BADGES: [string, string][] = [
  ['commissionPayments', 'pending'],
  ['driverApplications', 'pending'],
  ['complaints', 'open'],
];

function badgeCount(firestore: Firestore, [name, status]: [string, string]) {
  return getCountFromServer(query(collection(firestore, name), where('status', '==', status)));
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
  const now = Timestamp.now();
  await seed({
    [`users/${PASSENGER}`]: { uid: PASSENGER, role: 'passenger' },
    [`users/${DRIVER}`]: { uid: DRIVER, role: 'driver' },
    'commissionPayments/p1': { driverId: DRIVER, amountCentavos: 500, reference: '1234567890', status: 'pending', submittedAt: now },
    'commissionPayments/p2': { driverId: DRIVER, amountCentavos: 500, reference: '1234567891', status: 'confirmed', submittedAt: now },
    [`driverApplications/${PASSENGER}`]: { uid: PASSENGER, status: 'pending', submittedAt: now },
    [`complaints/booking1_${PASSENGER}`]: { bookingId: 'booking1', reporterId: PASSENGER, status: 'open', createdAt: now },
    [`complaints/booking2_${PASSENGER}`]: { bookingId: 'booking2', reporterId: PASSENGER, status: 'resolved', createdAt: now },
  });
});

describe('admin sidebar badges', () => {
  it('lets an admin count pending payments, pending applications and open complaints', async () => {
    const admin = db(ADMIN, { admin: true });
    for (const badge of BADGES) {
      const snapshot = await assertSucceeds(badgeCount(admin, badge));
      if (snapshot.data().count !== 1) throw new Error(`${badge[0]}: expected 1, got ${snapshot.data().count}`);
    }
  });

  it('denies the badge counts to drivers, passengers and signed-out users', async () => {
    for (const firestore of [db(DRIVER), db(PASSENGER), db(DRIVER, { admin: false }), db(null)]) {
      for (const badge of BADGES) await assertFails(badgeCount(firestore, badge));
    }
  });
});
