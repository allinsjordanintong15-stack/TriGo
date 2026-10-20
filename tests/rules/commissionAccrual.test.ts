/// <reference types="node" />

// Firestore rules tests for commission accrual: completing a trip (T4) records its
// commission in the same commit when commissionSettings/active exists —
// commissions/{bookingId}, the driver's commissionAccounts/{uid} running totals and, when
// a period opens, commissionPeriods/{uid}_{seq} (firestore.rules, Commission accrual;
// app: driverBookingService.completeTrip + commissionService.writeCommission).
// Headroom against the rules expression limit: measureHeadroom.ts.
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
  account,
  ADMIN,
  APPLICANT_DRIVER,
  appWrites,
  baseDocs,
  BOOKING,
  commitWrites,
  DAY_MS,
  DRIVER,
  GRACE_DAYS,
  HOUR_MS,
  inProgressBooking,
  OTHER_DRIVER,
  outOfAreaInProgressBooking,
  PASSENGER,
  PERIOD_DAYS,
  periodEndMillis,
  SETTINGS,
  tripDocs,
  type Account,
  type Period,
  type Settings,
  type Writes,
} from './commissionFixtures.ts';

const PROJECT_ID = 'demo-trigo-rules';

// Denied writes are expected; keep the SDK's PERMISSION_DENIED warnings quiet.
setLogLevel('error');

let testEnv: RulesTestEnvironment;

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context = uid ? testEnv.authenticatedContext(uid, claims) : testEnv.unauthenticatedContext();
  return context.firestore() as unknown as Firestore;
}

function adminDb(): Firestore {
  return db(ADMIN, { admin: true });
}

async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) {
      await setDoc(doc(firestore, path), data);
    }
  });
}

async function seedTrip(
  options: { driverId?: string; settings?: Settings | null; account?: Account | null; booking?: DocumentData } = {},
): Promise<void> {
  await seed(tripDocs(options));
}

function commit(writes: Writes, driverId = DRIVER) {
  return commitWrites(db(driverId), writes, driverId);
}

async function readAsAdmin(path: string): Promise<DocumentData | undefined> {
  return (await getDoc(doc(adminDb(), path))).data();
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

// ─── Valid completions ──────────────────────────────────────────────────────

describe('commission accrual: valid completions', () => {
  it('records the first commission: account created, period 1 opened', async () => {
    await seedTrip();
    await assertSucceeds(commit(appWrites()));
    const created = await readAsAdmin(`commissionAccounts/${DRIVER}`);
    const commission = await readAsAdmin(`commissions/${BOOKING}`);
    if (created?.accruedCentavos !== 450 || created?.current.seq !== 1 || commission?.amountCentavos !== 450) {
      throw new Error('first commission was not recorded as expected');
    }
    if (!(await readAsAdmin(`commissionPeriods/${DRIVER}_1`))) throw new Error('period 1 was not created');
  });

  it('records the first commission for an approved-applicant driver (longest driver check)', async () => {
    await seedTrip({ driverId: APPLICANT_DRIVER });
    await assertSucceeds(
      commit(appWrites({ driverId: APPLICANT_DRIVER }), APPLICANT_DRIVER),
    );
  });

  it('adds to the current period before it ends', async () => {
    const before = account(HOUR_MS);
    await seedTrip({ account: before });
    await assertSucceeds(commit(appWrites({ before })));
    const after = await readAsAdmin(`commissionAccounts/${DRIVER}`);
    if (after?.accruedCentavos !== 1350 || after?.current.seq !== 2) throw new Error('not added to the period');
  });

  it('opens the next period once the current one has ended (nothing owed: no unpaid period)', async () => {
    const before = account(10 * DAY_MS, { paidCentavos: 900 });
    await seedTrip({ account: before });
    await assertSucceeds(commit(appWrites({ before, openNextPeriod: true })));
    const after = await readAsAdmin(`commissionAccounts/${DRIVER}`);
    if (after?.current.seq !== 3 || after?.current.startCentavos !== 900 || after?.unpaid !== null) {
      throw new Error('next period not opened as expected');
    }
  });

  it('marks the closing period unpaid when something is still owed', async () => {
    const before = account(10 * DAY_MS, { paidCentavos: 500 });
    await seedTrip({ account: before });
    await assertSucceeds(commit(appWrites({ before, openNextPeriod: true })));
    const after = await readAsAdmin(`commissionAccounts/${DRIVER}`);
    if (after?.unpaid?.seq !== 2) throw new Error('closing period not marked unpaid');
  });

  it('keeps an older unpaid period when the next period opens', async () => {
    const older: Period = {
      seq: 1,
      startAt: Timestamp.fromMillis(Date.now() - 20 * DAY_MS),
      periodDays: PERIOD_DAYS,
      graceDays: GRACE_DAYS,
    };
    const before = account(10 * DAY_MS, { paidCentavos: 100, unpaid: older });
    await seedTrip({ account: before });
    await assertSucceeds(commit(appWrites({ before, openNextPeriod: true })));
    const after = await readAsAdmin(`commissionAccounts/${DRIVER}`);
    if (after?.unpaid?.seq !== 1) throw new Error('older unpaid period not kept');
  });

  it('rolls a 1-day period that ended at the last Manila midnight', async () => {
    const before = account(DAY_MS, { current: { ...account(DAY_MS).current, periodDays: 1 } });
    if (Date.now() < periodEndMillis(before.current.startAt.toMillis(), 1)) throw new Error('fixture: period not ended');
    await seedTrip({ account: before });
    await assertSucceeds(commit(appWrites({ before, openNextPeriod: true })));
  });

  it('records out-of-area trips on the agreed fare', async () => {
    const before = account(HOUR_MS);
    await seedTrip({
      account: before,
      booking: outOfAreaInProgressBooking(DRIVER, 520),
    });
    await assertSucceeds(
      commit(appWrites({ before, finalFare: 520, bookingType: 'out_of_area' })),
    );
    if ((await readAsAdmin(`commissions/${BOOKING}`))?.amountCentavos !== 5200) throw new Error('wrong amount');
  });

  it('records out-of-area trips that open the next period', async () => {
    const before = account(10 * DAY_MS, { paidCentavos: 500 });
    await seedTrip({
      account: before,
      booking: outOfAreaInProgressBooking(DRIVER, 520),
    });
    await assertSucceeds(
      commit(appWrites({ before, finalFare: 520, bookingType: 'out_of_area', openNextPeriod: true }),
      ),
    );
  });

  it('rounds to the centavo with decimal fares and percentages', async () => {
    const settings = { ...SETTINGS, percentage: 7.5 };
    await seedTrip({ settings, booking: inProgressBooking(DRIVER, { estimatedFare: 40.92 }) });
    await assertSucceeds(commit(appWrites({ settings, finalFare: 40.92 })));
    if ((await readAsAdmin(`commissions/${BOOKING}`))?.amountCentavos !== 307) throw new Error('not rounded to 307');
  });

  it('completes with no commission when the admin has not set one', async () => {
    await seedTrip({ settings: null });
    await assertSucceeds(commit(appWrites({ settings: null })));
    if (await readAsAdmin(`commissionAccounts/${DRIVER}`)) throw new Error('an account was created');
  });
});

// ─── Denied ─────────────────────────────────────────────────────────────────

describe('commission accrual: denied', () => {
  it('denies completing without the commission once settings exist', async () => {
    await seedTrip();
    await assertFails(commit(appWrites({ settings: null })));
  });

  it('denies a commission when no settings exist', async () => {
    await seedTrip({ settings: null });
    await assertFails(commit(appWrites()));
  });

  it('denies a wrong amount or percentage', async () => {
    await seedTrip();
    const tooLow = appWrites();
    tooLow.commission = { ...tooLow.commission, amountCentavos: 449 };
    tooLow.account = { kind: 'set', data: { ...tooLow.account?.data, accruedCentavos: 449 } };
    await assertFails(commit(tooLow));
    await assertFails(commit(appWrites({ settings: { ...SETTINGS, percentage: 5 } })));
  });

  it('denies an account total that does not add the commission', async () => {
    const before = account(HOUR_MS);
    await seedTrip({ account: before });
    const writes = appWrites({ before });
    writes.account = { kind: 'update', data: { ...writes.account?.data, accruedCentavos: before.accruedCentavos } };
    await assertFails(commit(writes));
  });

  it('denies changing paidCentavos', async () => {
    const before = account(HOUR_MS);
    await seedTrip({ account: before });
    const writes = appWrites({ before });
    writes.account = { kind: 'update', data: { ...writes.account?.data, paidCentavos: 900 } };
    await assertFails(commit(writes));
  });

  it('denies opening a period before the current one ends, and not opening one after', async () => {
    const running = account(HOUR_MS);
    await seedTrip({ account: running });
    await assertFails(commit(appWrites({ before: running, openNextPeriod: true })));

    const ended = account(10 * DAY_MS);
    await seedTrip({ account: ended });
    await assertFails(commit(appWrites({ before: ended, openNextPeriod: false })));
  });

  it('denies a client-chosen period start or settings other than the current ones', async () => {
    const before = account(10 * DAY_MS);
    await seedTrip({ account: before });
    const clientTime = appWrites({ before, openNextPeriod: true });
    const clientStart = { ...clientTime.account?.data.current, startAt: Timestamp.now() };
    clientTime.account = { kind: 'update', data: { ...clientTime.account?.data, current: clientStart } };
    clientTime.period = { id: `${DRIVER}_3`, data: { driverId: DRIVER, ...clientStart } };
    await assertFails(commit(clientTime));

    const longer = appWrites({ before, openNextPeriod: true, settings: { ...SETTINGS, paymentPeriodDays: 30 } });
    await assertFails(commit(longer));
  });

  it('denies a wrong unpaid period when the next period opens', async () => {
    const before = account(10 * DAY_MS, { paidCentavos: 500 });
    await seedTrip({ account: before });
    const writes = appWrites({ before, openNextPeriod: true });
    writes.account = { kind: 'update', data: { ...writes.account?.data, unpaid: null } };
    await assertFails(commit(writes));
  });

  it('denies opening a period without its period document, or with a wrong one', async () => {
    const before = account(10 * DAY_MS);
    await seedTrip({ account: before });
    const missing = appWrites({ before, openNextPeriod: true });
    missing.period = null;
    await assertFails(commit(missing));

    const wrongId = appWrites({ before, openNextPeriod: true });
    wrongId.period = { id: `${DRIVER}_9`, data: wrongId.period?.data ?? {} };
    await assertFails(commit(wrongId));
  });

  it('denies commission writes without completing the trip', async () => {
    await seedTrip();
    const writes = appWrites();
    const firestore = db(DRIVER);
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, 'commissionAccounts', DRIVER), writes.account?.data ?? {});
    if (writes.period) batch.set(doc(firestore, 'commissionPeriods', writes.period.id), writes.period.data);
    batch.set(doc(firestore, 'commissions', BOOKING), writes.commission ?? {});
    await assertFails(batch.commit());
  });

  it("denies recording a commission on someone else's account or trip", async () => {
    await seedTrip();
    const writes = appWrites({ driverId: OTHER_DRIVER });
    const firestore = db(OTHER_DRIVER);
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, 'commissionAccounts', OTHER_DRIVER), writes.account?.data ?? {});
    if (writes.period) batch.set(doc(firestore, 'commissionPeriods', writes.period.id), writes.period.data);
    batch.set(doc(firestore, 'commissions', BOOKING), writes.commission ?? {});
    await assertFails(batch.commit());
  });

  it('denies changing an account outside a completion', async () => {
    const before = account(HOUR_MS);
    await seedTrip({ account: before });
    await assertFails(
      updateDoc(doc(db(DRIVER), 'commissionAccounts', DRIVER), {
        accruedCentavos: 0,
        lastBookingId: 'madeUp',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies a second commission for the same trip', async () => {
    const before = account(HOUR_MS);
    await seedTrip({ account: before });
    await seed({ [`commissions/${BOOKING}`]: { driverId: DRIVER, amountCentavos: 450 } });
    await assertFails(commit(appWrites({ before })));
  });
});

// ─── Reads ──────────────────────────────────────────────────────────────────

describe('commission accrual: reads', () => {
  beforeEach(async () => {
    await seedTrip();
    await assertSucceeds(commit(appWrites()));
  });

  it('lets the driver read their own account, periods and commissions', async () => {
    await assertSucceeds(getDoc(doc(db(DRIVER), 'commissionAccounts', DRIVER)));
    await assertSucceeds(getDoc(doc(db(DRIVER), 'commissionPeriods', `${DRIVER}_1`)));
    await assertSucceeds(getDocs(query(collection(db(DRIVER), 'commissions'), where('driverId', '==', DRIVER))));
    await assertSucceeds(getDocs(query(collection(db(DRIVER), 'commissionPeriods'), where('driverId', '==', DRIVER))));
  });

  it("denies other drivers and passengers reading a driver's commission", async () => {
    for (const uid of [OTHER_DRIVER, PASSENGER]) {
      await assertFails(getDoc(doc(db(uid), 'commissionAccounts', DRIVER)));
      await assertFails(getDoc(doc(db(uid), 'commissions', BOOKING)));
      await assertFails(getDoc(doc(db(uid), 'commissionPeriods', `${DRIVER}_1`)));
      await assertFails(getDocs(collection(db(uid), 'commissions')));
    }
  });

  it('lets an admin read and list everything', async () => {
    await assertSucceeds(getDocs(collection(adminDb(), 'commissionAccounts')));
    await assertSucceeds(getDocs(collection(adminDb(), 'commissions')));
    await assertSucceeds(getDocs(collection(adminDb(), 'commissionPeriods')));
  });

  it('denies deleting or editing commission records, even for admins', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'commissions', BOOKING), { amountCentavos: 1 }));
    await assertFails(updateDoc(doc(db(DRIVER), 'commissions', BOOKING), { amountCentavos: 1 }));
    await assertFails(updateDoc(doc(db(DRIVER), 'commissionPeriods', `${DRIVER}_1`), { graceDays: 14 }));
  });
});
