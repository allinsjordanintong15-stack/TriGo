/// <reference types="node" />

// Firestore rules tests for commission payments: a driver reports a GCash payment
// (commissionPayments + paymentReferences lock, commissionService.submitCommissionPayment);
// an admin confirms it, crediting the driver's account (oldest debt first) and
// earningsLedger/totals in the same commit, or rejects it with a reason, freeing the
// reference (admin/src/earnings/payments.ts). Headroom: measureHeadroom.ts.
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
  limit,
  orderBy,
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
  ADMIN,
  baseDocs,
  commitConfirm,
  commitSubmit,
  confirmWrites,
  DRIVER,
  multiPeriodDocs,
  OTHER_DRIVER,
  PASSENGER,
  PAYMENT,
  pendingPayment,
  REFERENCE,
  submittedDocs,
  submitWrites,
  unpaidFrom,
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
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(firestore, path), data);
  });
}

async function read(path: string): Promise<DocumentData | undefined> {
  let data: DocumentData | undefined;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    data = (await getDoc(doc(context.firestore() as unknown as Firestore, path))).data();
  });
  return data;
}

// Periods 1–3 closed (start totals 0, 300, 600), period 4 running from 900; 1200 recorded.
const { docs: MULTI, periods: PERIODS } = multiPeriodDocs();

/** What rejectPayment writes: the payment and, in the same commit, the freed reference. */
function reject(firestore: Firestore, overrides: DocumentData = {}, freeReference = true): Promise<void> {
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'commissionPayments', PAYMENT), {
    status: 'rejected',
    rejectionReason: 'No GCash payment with this reference',
    reviewedAt: serverTimestamp(),
    reviewedBy: ADMIN,
    ...overrides,
  });
  if (freeReference) batch.delete(doc(firestore, 'paymentReferences', REFERENCE));
  return batch.commit();
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
  await seed({ ...baseDocs(), ...MULTI });
});

// ─── Driver submits ─────────────────────────────────────────────────────────

describe('commission payments: driver submits', () => {
  it('records a pending payment with its reference lock', async () => {
    await assertSucceeds(commitSubmit(db(DRIVER), submitWrites(700)));
    const payment = await read(`commissionPayments/${PAYMENT}`);
    const reference = await read(`paymentReferences/${REFERENCE}`);
    if (payment?.status !== 'pending' || reference?.paymentId !== PAYMENT) throw new Error('payment not recorded');
  });

  it('allows ₱1.00 up to the balance (recorded − confirmed paid)', async () => {
    await assertFails(commitSubmit(db(DRIVER), submitWrites(99)));
    await assertFails(commitSubmit(db(DRIVER), submitWrites(1201)));
    await assertFails(commitSubmit(db(DRIVER), submitWrites(150.5)));
    await assertFails(commitSubmit(db(DRIVER), submitWrites(0)));
    await assertSucceeds(commitSubmit(db(DRIVER), submitWrites(100)));
    await testEnv.clearFirestore();
    await seed({ ...baseDocs(), ...MULTI });
    await assertSucceeds(commitSubmit(db(DRIVER), submitWrites(1200)));
  });

  it('subtracts confirmed payments from the cap', async () => {
    await seed({
      [`commissionAccounts/${DRIVER}`]: { ...MULTI[`commissionAccounts/${DRIVER}`], paidCentavos: 1000, unpaid: null },
    });
    await assertFails(commitSubmit(db(DRIVER), submitWrites(201)));
    await assertSucceeds(commitSubmit(db(DRIVER), submitWrites(200)));
  });

  it('requires a GCash reference of 10–20 digits only', async () => {
    for (const reference of ['123456789', '1'.repeat(21), '1234 567890', '12345abcde', '']) {
      await assertFails(
        commitSubmit(db(DRIVER), submitWrites(500, { payment: { reference } }), PAYMENT, reference || 'empty'),
      );
    }
    await assertSucceeds(commitSubmit(db(DRIVER), submitWrites(500, { payment: { reference: '1234567890' } }), PAYMENT, '1234567890'));
    await assertSucceeds(
      commitSubmit(db(DRIVER), submitWrites(500, { payment: { reference: '9'.repeat(20) }, reference: { paymentId: 'payment2' } }), 'payment2', '9'.repeat(20)),
    );
  });

  it('denies a reference that was already submitted, by this or another driver', async () => {
    await seed(submittedDocs(500));
    await assertFails(
      commitSubmit(db(DRIVER), submitWrites(500, { reference: { paymentId: 'payment2' } }), 'payment2'),
    );
    await seed({ [`paymentReferences/${REFERENCE}`]: { paymentId: 'other', driverId: OTHER_DRIVER, createdAt: Timestamp.now() } });
    await assertFails(
      commitSubmit(db(DRIVER), submitWrites(500, { reference: { paymentId: 'payment2' } }), 'payment2'),
    );
  });

  it('requires the reference lock in the same commit, pointing at this payment', async () => {
    await assertFails(commitSubmit(db(DRIVER), { ...submitWrites(500), reference: null }));
    await assertFails(commitSubmit(db(DRIVER), { ...submitWrites(500), payment: null }));
    await assertFails(commitSubmit(db(DRIVER), submitWrites(500, { reference: { paymentId: 'payment2' } })));
    await assertFails(commitSubmit(db(DRIVER), submitWrites(500, { reference: { driverId: OTHER_DRIVER } })));
  });

  it('denies a forged status, time, driver or extra field', async () => {
    await assertFails(commitSubmit(db(DRIVER), submitWrites(500, { payment: { status: 'confirmed' } })));
    await assertFails(commitSubmit(db(DRIVER), submitWrites(500, { payment: { submittedAt: Timestamp.now() } })));
    await assertFails(commitSubmit(db(DRIVER), submitWrites(500, { payment: { driverId: OTHER_DRIVER } })));
    await assertFails(commitSubmit(db(DRIVER), submitWrites(500, { payment: { reviewedBy: ADMIN } })));
  });

  it('denies drivers without a commission account, passengers and other drivers', async () => {
    await assertFails(
      commitSubmit(db(OTHER_DRIVER), submitWrites(500, { payment: { driverId: OTHER_DRIVER }, reference: { driverId: OTHER_DRIVER } })),
    );
    await assertFails(
      commitSubmit(db(PASSENGER), submitWrites(500, { payment: { driverId: PASSENGER }, reference: { driverId: PASSENGER } })),
    );
    await assertFails(commitSubmit(db(OTHER_DRIVER), submitWrites(500)));
  });

  it('denies the driver editing or deleting a payment or its reference', async () => {
    await seed(submittedDocs(500));
    await assertFails(updateDoc(doc(db(DRIVER), 'commissionPayments', PAYMENT), { amountCentavos: 1200 }));
    await assertFails(deleteDoc(doc(db(DRIVER), 'commissionPayments', PAYMENT)));
    await assertFails(deleteDoc(doc(db(DRIVER), 'paymentReferences', REFERENCE)));
    await assertFails(updateDoc(doc(db(DRIVER), 'paymentReferences', REFERENCE), { paymentId: 'x' }));
  });
});

// ─── Admin confirms ─────────────────────────────────────────────────────────

describe('commission payments: admin confirms', () => {
  async function confirm(amount: number, paidAfter: number, unpaid: ReturnType<typeof unpaidFrom> | null, collectedBefore: number | null = null) {
    await seed(submittedDocs(amount));
    return commitConfirm(adminDb(), confirmWrites({ amountCentavos: amount, paidAfter, unpaid, collectedBefore }));
  }

  it('confirms, creating the ledger and advancing across two unpaid periods', async () => {
    await assertSucceeds(confirm(700, 700, unpaidFrom(PERIODS[2])));
    const account = await read(`commissionAccounts/${DRIVER}`);
    const ledger = await read('earningsLedger/totals');
    if (account?.paidCentavos !== 700 || account.unpaid?.seq !== 3 || ledger?.collectedCentavos !== 700) {
      throw new Error('account or ledger not credited');
    }
  });

  it('adds to an existing ledger', async () => {
    await seed({ 'earningsLedger/totals': { collectedCentavos: 5000, cashedOutCentavos: 1000, lastPaymentId: 'old', updatedAt: Timestamp.now() } });
    await assertSucceeds(confirm(300, 300, unpaidFrom(PERIODS[1]), 5000));
  });

  it('keeps the pointer on a period paid only in part', async () => {
    await assertSucceeds(confirm(299, 299, unpaidFrom(PERIODS[0])));
  });

  it('clears the pointer once every closed period is paid (exactly, or beyond)', async () => {
    await assertSucceeds(confirm(900, 900, null));
    await testEnv.clearFirestore();
    await seed({ ...baseDocs(), ...MULTI });
    await assertSucceeds(confirm(1200, 1200, null));
  });

  it('denies a wrong unpaid pointer', async () => {
    await assertFails(confirm(700, 700, unpaidFrom(PERIODS[1])));
    await assertFails(confirm(700, 700, unpaidFrom(PERIODS[0])));
    await assertFails(confirm(700, 700, null));
    await assertFails(confirm(900, 900, unpaidFrom(PERIODS[2])));
    await assertFails(confirm(700, 700, { ...unpaidFrom(PERIODS[2]), graceDays: 30 }));
    await assertFails(confirm(700, 700, { ...unpaidFrom(PERIODS[2]), startAt: Timestamp.now() }));
  });

  it('denies crediting a different amount or paying past what was recorded', async () => {
    await assertFails(confirm(700, 800, unpaidFrom(PERIODS[2])));
    await seed(submittedDocs(1300));
    await assertFails(commitConfirm(adminDb(), confirmWrites({ amountCentavos: 1300, paidAfter: 1300, unpaid: null, collectedBefore: null })));
  });

  it('denies a ledger that does not add the payment', async () => {
    await seed(submittedDocs(700));
    const writes = confirmWrites({ amountCentavos: 700, paidAfter: 700, unpaid: unpaidFrom(PERIODS[2]), collectedBefore: null });
    writes.ledger!.data.collectedCentavos = 600;
    await assertFails(commitConfirm(adminDb(), writes));
    writes.ledger!.data.collectedCentavos = 700;
    writes.ledger!.data.cashedOutCentavos = 100;
    await assertFails(commitConfirm(adminDb(), writes));
  });

  it('requires the account and the ledger in the same commit', async () => {
    await seed(submittedDocs(700));
    const writes = confirmWrites({ amountCentavos: 700, paidAfter: 700, unpaid: unpaidFrom(PERIODS[2]), collectedBefore: null });
    await assertFails(commitConfirm(adminDb(), { ...writes, account: null }));
    await assertFails(commitConfirm(adminDb(), { ...writes, ledger: null }));
    await assertFails(updateDoc(doc(adminDb(), 'commissionPayments', PAYMENT), writes.payment));
  });

  it("denies crediting a payment to another driver's account", async () => {
    await seed({ ...submittedDocs(700), [`commissionPayments/${PAYMENT}`]: pendingPayment(700, { driverId: OTHER_DRIVER }) });
    await assertFails(commitConfirm(adminDb(), confirmWrites({ amountCentavos: 700, paidAfter: 700, unpaid: unpaidFrom(PERIODS[2]), collectedBefore: null })));
  });

  it('denies confirming a payment twice, or one that was rejected', async () => {
    await assertSucceeds(confirm(300, 300, unpaidFrom(PERIODS[1])));
    await assertFails(
      commitConfirm(adminDb(), confirmWrites({ amountCentavos: 300, paidAfter: 600, unpaid: unpaidFrom(PERIODS[2]), collectedBefore: 300 })),
    );
    await seed({ [`commissionPayments/${PAYMENT}`]: pendingPayment(300, { status: 'rejected', rejectionReason: 'x' }) });
    await assertFails(
      commitConfirm(adminDb(), confirmWrites({ amountCentavos: 300, paidAfter: 600, unpaid: unpaidFrom(PERIODS[2]), collectedBefore: 300 })),
    );
  });

  it('denies a confirm with a forged reviewer or time', async () => {
    await seed(submittedDocs(700));
    const writes = confirmWrites({ amountCentavos: 700, paidAfter: 700, unpaid: unpaidFrom(PERIODS[2]), collectedBefore: null });
    await assertFails(commitConfirm(adminDb(), { ...writes, payment: { ...writes.payment, reviewedBy: 'someone' } }));
    await assertFails(commitConfirm(adminDb(), { ...writes, payment: { ...writes.payment, reviewedAt: Timestamp.now() } }));
    await assertFails(commitConfirm(adminDb(), { ...writes, payment: { ...writes.payment, amountCentavos: 1 } }));
  });

  it('denies non-admins confirming, including the driver', async () => {
    await seed(submittedDocs(700));
    const writes = confirmWrites({ amountCentavos: 700, paidAfter: 700, unpaid: unpaidFrom(PERIODS[2]), collectedBefore: null });
    await assertFails(commitConfirm(db(DRIVER), writes));
    await assertFails(commitConfirm(db(ADMIN), writes));
  });

  it('keeps a confirmed reference locked', async () => {
    await assertSucceeds(confirm(700, 700, unpaidFrom(PERIODS[2])));
    await assertFails(deleteDoc(doc(adminDb(), 'paymentReferences', REFERENCE)));
    await assertFails(
      commitSubmit(db(DRIVER), submitWrites(100, { reference: { paymentId: 'payment2' } }), 'payment2'),
    );
  });
});

// ─── Admin rejects ──────────────────────────────────────────────────────────

describe('commission payments: admin rejects', () => {
  beforeEach(async () => {
    await seed(submittedDocs(700));
  });

  it('rejects with a reason and frees the reference for a new submission', async () => {
    await assertSucceeds(reject(adminDb()));
    if ((await read(`paymentReferences/${REFERENCE}`)) !== undefined) throw new Error('reference should be freed');
    await assertSucceeds(
      commitSubmit(db(DRIVER), submitWrites(700, { reference: { paymentId: 'payment2' } }), 'payment2'),
    );
  });

  it('requires a reason of 1–300 characters', async () => {
    await assertFails(reject(adminDb(), { rejectionReason: '' }));
    await assertFails(reject(adminDb(), { rejectionReason: '   ' }));
    await assertFails(reject(adminDb(), { rejectionReason: 'x'.repeat(301) }));
    await assertSucceeds(reject(adminDb(), { rejectionReason: 'x'.repeat(300) }));
  });

  it('requires freeing the reference in the same commit, and only by rejecting', async () => {
    await assertFails(reject(adminDb(), {}, false));
    await assertFails(deleteDoc(doc(adminDb(), 'paymentReferences', REFERENCE)));
  });

  it('denies rejecting a confirmed payment, changing other fields, or non-admins', async () => {
    await assertFails(reject(adminDb(), { amountCentavos: 1 }));
    await assertFails(reject(db(DRIVER)));
    await seed({ [`commissionPayments/${PAYMENT}`]: pendingPayment(700, { status: 'confirmed' }) });
    await assertFails(reject(adminDb()));
  });
});

// ─── Reads ──────────────────────────────────────────────────────────────────

describe('commission payments: reads', () => {
  beforeEach(async () => {
    await seed(submittedDocs(700));
  });

  it("lets the driver list their own payments (Earnings tab query) and check a reference", async () => {
    await assertSucceeds(
      getDocs(query(collection(db(DRIVER), 'commissionPayments'), where('driverId', '==', DRIVER), orderBy('submittedAt', 'desc'), limit(20))),
    );
    await assertSucceeds(getDoc(doc(db(DRIVER), 'paymentReferences', REFERENCE)));
    await assertSucceeds(getDoc(doc(db(DRIVER), 'paymentReferences', '5555555555')));
  });

  it("denies other drivers a driver's payments or references", async () => {
    await assertFails(
      getDocs(query(collection(db(OTHER_DRIVER), 'commissionPayments'), where('driverId', '==', DRIVER), orderBy('submittedAt', 'desc'), limit(20))),
    );
    await assertFails(getDoc(doc(db(OTHER_DRIVER), 'commissionPayments', PAYMENT)));
    await assertFails(getDoc(doc(db(OTHER_DRIVER), 'paymentReferences', REFERENCE)));
    await assertFails(getDocs(collection(db(DRIVER), 'paymentReferences')));
    await assertFails(
      getDocs(query(collection(db(DRIVER), 'commissionPayments'), where('status', '==', 'pending'), orderBy('submittedAt', 'asc'))),
    );
  });

  it('lets an admin list pending payments and read the ledger; drivers cannot read the ledger', async () => {
    await assertSucceeds(
      getDocs(query(collection(adminDb(), 'commissionPayments'), where('status', '==', 'pending'), orderBy('submittedAt', 'asc'))),
    );
    await assertSucceeds(getDoc(doc(adminDb(), 'earningsLedger', 'totals')));
    await assertFails(getDoc(doc(db(DRIVER), 'earningsLedger', 'totals')));
    await assertFails(
      setDoc(doc(db(DRIVER), 'earningsLedger', 'totals'), { collectedCentavos: 0, cashedOutCentavos: 0, lastPaymentId: PAYMENT, updatedAt: serverTimestamp() }),
    );
  });
});
