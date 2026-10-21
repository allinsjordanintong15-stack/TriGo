/// <reference types="node" />

// Firestore rules tests for cash-outs: an admin records commission moved out of TriGo's
// GCash in the real GCash, Maya or bank app (cashOuts/{autoId}) together with the
// earningsLedger/totals update that adds it to cashedOutCentavos, never above
// collectedCentavos (admin/src/earnings/cashOuts.ts). Records are immutable.
// Headroom: measureHeadroom.ts. Run with `npm run test:rules`.
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
  orderBy,
  query,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import {
  ADMIN,
  baseDocs,
  CASH_OUT,
  cashOutDoc,
  cashOutWrites,
  commitCashOut,
  commitConfirm,
  confirmWrites,
  DRIVER,
  ledgerDoc,
  multiPeriodDocs,
  PASSENGER,
  submittedDocs,
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

/** A valid ₱25.00 cash-out (₱40.00 available) with one field of the record changed. */
function withCashOut(fields: DocumentData) {
  const writes = cashOutWrites(2500);
  return { ...writes, cashOut: { ...writes.cashOut, ...fields } };
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
  // ₱50.00 collected, ₱10.00 already cashed out: ₱40.00 available.
  await seed({ ...baseDocs(), 'earningsLedger/totals': ledgerDoc() });
});

describe('cash-outs: admin records', () => {
  it('records a valid cash-out with the ledger update', async () => {
    await assertSucceeds(commitCashOut(adminDb(), cashOutWrites(2500)));
    const ledger = await read('earningsLedger/totals');
    if (ledger?.cashedOutCentavos !== 3500 || ledger.collectedCentavos !== 5000 || ledger.lastCashOutId !== CASH_OUT) {
      throw new Error(`wrong ledger: ${JSON.stringify(ledger)}`);
    }
    const cashOut = await read(`cashOuts/${CASH_OUT}`);
    if (cashOut?.amountCentavos !== 2500 || cashOut.createdBy !== ADMIN) throw new Error('wrong cash-out');
  });

  it('allows cashing out exactly the available balance, every method, an empty note', async () => {
    await assertSucceeds(commitCashOut(adminDb(), { ...cashOutWrites(4000), cashOut: { ...cashOutDoc(4000), method: 'maya', note: '' } }));
    await seed({ 'earningsLedger/totals': ledgerDoc(5000, 0) });
    const writes = cashOutWrites(100, 0, 'cashOut2');
    await assertSucceeds(commitCashOut(adminDb(), { ...writes, cashOut: { ...writes.cashOut, method: 'bank_transfer' } }, 'cashOut2'));
  });

  it('allows a second cash-out after the first (lastCashOutId changes)', async () => {
    await assertSucceeds(commitCashOut(adminDb(), cashOutWrites(1500)));
    await assertSucceeds(commitCashOut(adminDb(), cashOutWrites(2500, 2500, 'cashOut2'), 'cashOut2'));
    const ledger = await read('earningsLedger/totals');
    if (ledger?.cashedOutCentavos !== 5000) throw new Error(`wrong ledger: ${JSON.stringify(ledger)}`);
  });

  it('denies a cash-out above the available balance', async () => {
    await assertFails(commitCashOut(adminDb(), cashOutWrites(4001)));
  });

  it('denies wrong ledger math', async () => {
    const writes = cashOutWrites(2500);
    await assertFails(commitCashOut(adminDb(), { ...writes, ledger: { ...writes.ledger, cashedOutCentavos: 3499 } }));
    await assertFails(commitCashOut(adminDb(), { ...writes, ledger: { ...writes.ledger, cashedOutCentavos: 3501 } }));
    // Collected cannot be raised to make room.
    await assertFails(
      commitCashOut(adminDb(), {
        cashOut: cashOutDoc(6000),
        ledger: { ...cashOutWrites(6000).ledger, collectedCentavos: 9000 },
      }),
    );
  });

  it('denies a cash-out without the ledger update, or a ledger update without a new cash-out', async () => {
    await assertFails(commitCashOut(adminDb(), { cashOut: cashOutWrites(2500).cashOut }));
    await assertFails(commitCashOut(adminDb(), { ledger: cashOutWrites(2500).ledger }));
    // The ledger must point at the cash-out created in this commit.
    const writes = cashOutWrites(2500);
    await assertFails(commitCashOut(adminDb(), { ...writes, ledger: { ...writes.ledger, lastCashOutId: 'other' } }));
  });

  it('denies a ledger update that reuses an existing cash-out', async () => {
    await assertSucceeds(commitCashOut(adminDb(), cashOutWrites(1000)));
    await assertFails(
      updateDoc(doc(adminDb(), 'earningsLedger', 'totals'), {
        cashedOutCentavos: 3000,
        lastCashOutId: CASH_OUT,
        updatedAt: Timestamp.now(),
      }),
    );
  });

  it('denies invalid cash-out fields', async () => {
    const invalid: DocumentData[] = [
      { method: 'cash' },
      { amountCentavos: 0 },
      { amountCentavos: 25.5 },
      { reference: '' },
      { reference: '   ' },
      { reference: 'x'.repeat(61) },
      { cashedOutOn: '2026-13-01' },
      { cashedOutOn: '21/10/2026' },
      { cashedOutOn: Timestamp.now() },
      { note: 'x'.repeat(301) },
      { note: null },
      { createdBy: DRIVER },
      { createdAt: Timestamp.fromMillis(Date.now() - 60_000) },
      { extra: true },
    ];
    for (const fields of invalid) await assertFails(commitCashOut(adminDb(), withCashOut(fields)));
    await assertSucceeds(commitCashOut(adminDb(), withCashOut({ reference: 'x'.repeat(60), note: 'y'.repeat(300) })));
  });

  it('denies a cash-out when there is no ledger yet (nothing collected)', async () => {
    await testEnv.clearFirestore();
    await seed(baseDocs());
    await assertFails(commitCashOut(adminDb(), cashOutWrites(100, 0)));
  });
});

describe('cash-outs: immutable', () => {
  beforeEach(async () => {
    await assertSucceeds(commitCashOut(adminDb(), cashOutWrites(2500)));
  });

  it('denies editing or deleting a cash-out, even by an admin', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'cashOuts', CASH_OUT), { amountCentavos: 100 }));
    await assertFails(updateDoc(doc(adminDb(), 'cashOuts', CASH_OUT), { note: 'changed' }));
    await assertFails(setDoc(doc(adminDb(), 'cashOuts', CASH_OUT), cashOutDoc(100)));
    await assertFails(deleteDoc(doc(adminDb(), 'cashOuts', CASH_OUT)));
  });

  it('denies lowering cashedOutCentavos or deleting the ledger', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'earningsLedger', 'totals'), { cashedOutCentavos: 0, updatedAt: Timestamp.now() }));
    await assertFails(deleteDoc(doc(adminDb(), 'earningsLedger', 'totals')));
  });

  it('lets an admin list cash-outs newest first; nobody else reads them', async () => {
    await assertSucceeds(getDocs(query(collection(adminDb(), 'cashOuts'), orderBy('createdAt', 'desc'))));
    await assertFails(getDoc(doc(db(DRIVER), 'cashOuts', CASH_OUT)));
    await assertFails(getDocs(collection(db(PASSENGER), 'cashOuts')));
    await assertFails(getDocs(collection(db(null), 'cashOuts')));
  });
});

describe('cash-outs: non-admins', () => {
  it('denies drivers, passengers and signed-out users', async () => {
    for (const firestore of [db(DRIVER), db(PASSENGER), db(DRIVER, { admin: false }), db(null)]) {
      await assertFails(commitCashOut(firestore, cashOutWrites(2500)));
      await assertFails(commitCashOut(firestore, { cashOut: cashOutWrites(2500).cashOut }));
    }
  });
});

describe('cash-outs: payment confirm after a cash-out', () => {
  it('still credits the ledger when it has lastCashOutId', async () => {
    const { docs: multi, periods } = multiPeriodDocs();
    await seed({ ...multi, ...submittedDocs(700) });
    await assertSucceeds(commitCashOut(adminDb(), cashOutWrites(2500)));
    await assertSucceeds(
      commitConfirm(
        adminDb(),
        confirmWrites({ amountCentavos: 700, paidAfter: 700, unpaid: unpaidFrom(periods[2]), collectedBefore: 5000 }),
      ),
    );
    const ledger = await read('earningsLedger/totals');
    if (ledger?.collectedCentavos !== 5700 || ledger.cashedOutCentavos !== 3500 || ledger.lastCashOutId !== CASH_OUT) {
      throw new Error(`wrong ledger: ${JSON.stringify(ledger)}`);
    }
  });
});
