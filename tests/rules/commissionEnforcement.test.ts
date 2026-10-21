/// <reference types="node" />

// Firestore rules tests for commission enforcement (isCommissionSuspended): a driver who
// still owes commission after a grace period cannot accept a standard booking (T1) or
// propose on an out-of-area request, but can still finish a current trip and claim an
// out-of-area booking the passenger already confirmed. A confirmed payment of the overdue
// amount lifts the suspension. Headroom: measureHeadroom.ts.
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
import { doc, setDoc, setLogLevel, type DocumentData, type Firestore } from 'firebase/firestore';

import {
  account,
  accountDoc,
  ADMIN,
  appWrites,
  availableDriverRecord,
  baseDocs,
  BOOKING,
  claimDocs,
  commitAccept,
  commitClaim,
  commitConfirm,
  commitPropose,
  commitWrites,
  confirmWrites,
  DAY_MS,
  DRIVER,
  openBooking,
  openRequest,
  periodDoc,
  REQUEST,
  submittedDocs,
  tripDocs,
  unpaidFrom,
  type Account,
} from './commissionFixtures.ts';

const PROJECT_ID = 'demo-trigo-rules';

// Denied writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

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

// Each account has ₱9.00 recorded, a running period 2 from ₱4.00 and (7 + 3)-day periods.
// Period 1 started 20 days ago: its grace period ended at least 10 days ago.
const LONG_AGO = periodDoc(1, 0, 20 * DAY_MS);
// Period 1 started 8 days ago: ended 1–2 days ago, grace ends 1–2 days from now.
const RECENT = periodDoc(1, 0, 8 * DAY_MS);

const ACCOUNTS: Record<string, Account> = {
  unpaidPastGrace: account(2 * DAY_MS, { unpaid: unpaidFrom(LONG_AGO) }),
  unpaidInGrace: account(2 * DAY_MS, { unpaid: unpaidFrom(RECENT) }),
  // The running period itself ended with no trip since (no roll), still owing.
  currentPastGrace: account(20 * DAY_MS, { paidCentavos: 500 }),
  currentInGrace: account(8 * DAY_MS, { paidCentavos: 500 }),
  currentPastGracePaidUp: account(20 * DAY_MS, { paidCentavos: 900 }),
  running: account(2 * DAY_MS),
};

function withAccount(state: Account | null): Record<string, DocumentData> {
  return state ? { [`commissionAccounts/${DRIVER}`]: accountDoc(state) } : {};
}

async function seedOpenWork(state: Account | null): Promise<void> {
  await seed({
    [`drivers/${DRIVER}`]: availableDriverRecord(),
    [`bookings/${BOOKING}`]: openBooking(),
    [`outOfAreaRequests/${REQUEST}`]: openRequest(),
    ...withAccount(state),
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
});

describe('commission enforcement: suspended driver denied new work', () => {
  for (const name of ['unpaidPastGrace', 'currentPastGrace']) {
    it(`denies T1 accept (${name})`, async () => {
      await seedOpenWork(ACCOUNTS[name]);
      await assertFails(commitAccept(db(DRIVER)));
    });

    it(`denies the out-of-area propose (${name})`, async () => {
      await seedOpenWork(ACCOUNTS[name]);
      await assertFails(commitPropose(db(DRIVER)));
    });
  }
});

describe('commission enforcement: drivers who are not suspended', () => {
  for (const name of ['unpaidInGrace', 'currentInGrace', 'currentPastGracePaidUp', 'running']) {
    it(`allows T1 accept (${name})`, async () => {
      await seedOpenWork(ACCOUNTS[name]);
      await assertSucceeds(commitAccept(db(DRIVER)));
    });

    it(`allows the out-of-area propose (${name})`, async () => {
      await seedOpenWork(ACCOUNTS[name]);
      await assertSucceeds(commitPropose(db(DRIVER)));
    });
  }

  it('allows T1 accept with no commission account', async () => {
    await seedOpenWork(null);
    await assertSucceeds(commitAccept(db(DRIVER)));
  });

  it('allows the out-of-area propose with no commission account', async () => {
    await seedOpenWork(null);
    await assertSucceeds(commitPropose(db(DRIVER)));
  });
});

describe('commission enforcement: lifted by a confirmed payment', () => {
  // Suspended for period 1 (₱0–4); confirming pays the oldest debt first.
  async function seedSuspendedWithPayment(amountCentavos: number): Promise<void> {
    await seedOpenWork(ACCOUNTS.unpaidPastGrace);
    await seed({ [`commissionPeriods/${DRIVER}_1`]: LONG_AGO, ...submittedDocs(amountCentavos) });
  }

  it('lifts the suspension once the overdue amount is confirmed paid', async () => {
    await seedSuspendedWithPayment(400);
    await assertFails(commitAccept(db(DRIVER)));
    await assertSucceeds(
      commitConfirm(
        db(ADMIN, { admin: true }),
        confirmWrites({ amountCentavos: 400, paidAfter: 400, unpaid: null, collectedBefore: null }),
      ),
    );
    await assertSucceeds(commitAccept(db(DRIVER)));
  });

  it('lifts the suspension for the propose too', async () => {
    await seedSuspendedWithPayment(400);
    await assertSucceeds(
      commitConfirm(
        db(ADMIN, { admin: true }),
        confirmWrites({ amountCentavos: 400, paidAfter: 400, unpaid: null, collectedBefore: null }),
      ),
    );
    await assertSucceeds(commitPropose(db(DRIVER)));
  });

  it('keeps the suspension after a partial payment of the overdue amount', async () => {
    await seedSuspendedWithPayment(300);
    await assertSucceeds(
      commitConfirm(
        db(ADMIN, { admin: true }),
        confirmWrites({ amountCentavos: 300, paidAfter: 300, unpaid: unpaidFrom(LONG_AGO), collectedBefore: null }),
      ),
    );
    await assertFails(commitAccept(db(DRIVER)));
    await assertFails(commitPropose(db(DRIVER)));
  });
});

describe('commission enforcement: current work is not blocked', () => {
  it('allows a suspended driver to complete the current trip (commission still recorded)', async () => {
    const before = ACCOUNTS.unpaidPastGrace;
    await seed(tripDocs({ account: before }));
    await assertSucceeds(commitWrites(db(DRIVER), appWrites({ before })));
  });

  it('allows a suspended driver to complete with a period roll', async () => {
    const before = ACCOUNTS.currentPastGrace;
    await seed(tripDocs({ account: before }));
    await assertSucceeds(commitWrites(db(DRIVER), appWrites({ before, openNextPeriod: true })));
  });

  it('allows a suspended driver to claim the out-of-area booking the passenger confirmed', async () => {
    await seed({ ...claimDocs(), ...withAccount(ACCOUNTS.unpaidPastGrace) });
    await assertSucceeds(commitClaim(db(DRIVER)));
  });
});
