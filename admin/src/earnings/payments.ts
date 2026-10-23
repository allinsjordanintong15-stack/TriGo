import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentData,
  type Transaction,
} from 'firebase/firestore';

import { db } from '../firebase/config';
import { formatCentavos } from '../lib/format';

// Commission payments drivers report from the app (GCash, outside TriGo). An admin checks
// each one against TriGo's GCash account, then confirms it (credits the driver's
// commissionAccounts/{uid} and earningsLedger/totals in the same commit) or rejects it
// with a reason (frees the reference so the driver can resubmit). firestore.rules
// (Commission payments) checks every value written here.

export type PendingPayment = {
  paymentId: string;
  driverId: string;
  driverName: string;
  amountCentavos: number;
  reference: string;
  submittedAt: Date | null;
  /** The driver's account when the list loaded (recorded and confirmed paid). */
  accruedCentavos: number | null;
  paidCentavos: number | null;
};

export const MAX_REJECTION_REASON_LENGTH = 300;

/** Pending payments, oldest first, with each driver's name and balance. */
export async function loadPendingPayments(): Promise<PendingPayment[]> {
  // Composite index commissionPayments (status ASC, submittedAt ASC).
  const snapshot = await getDocs(
    query(collection(db, 'commissionPayments'), where('status', '==', 'pending'), orderBy('submittedAt', 'asc')),
  );
  const driverIds = [...new Set(snapshot.docs.map((d) => String(d.data().driverId)))];
  const [drivers, accounts] = await Promise.all([
    Promise.all(driverIds.map((uid) => getDoc(doc(db, 'drivers', uid)))),
    Promise.all(driverIds.map((uid) => getDoc(doc(db, 'commissionAccounts', uid)))),
  ]);
  const nameOf = new Map(driverIds.map((uid, i) => [uid, String(drivers[i].data()?.fullName ?? '')]));
  const accountOf = new Map(driverIds.map((uid, i) => [uid, accounts[i].data()]));

  return snapshot.docs.map((d) => {
    const data = d.data();
    const account = accountOf.get(data.driverId);
    return {
      paymentId: d.id,
      driverId: data.driverId,
      driverName: nameOf.get(data.driverId) ?? '',
      amountCentavos: data.amountCentavos,
      reference: data.reference,
      submittedAt: (data.submittedAt as Timestamp | undefined)?.toDate?.() ?? null,
      accruedCentavos: typeof account?.accruedCentavos === 'number' ? account.accruedCentavos : null,
      paidCentavos: typeof account?.paidCentavos === 'number' ? account.paidCentavos : null,
    };
  });
}

export class PaymentConflictError extends Error {}

async function readPendingPayment(transaction: Transaction, paymentId: string): Promise<DocumentData> {
  const snap = await transaction.get(doc(db, 'commissionPayments', paymentId));
  if (!snap.exists()) throw new PaymentConflictError('This payment no longer exists.');
  const data = snap.data();
  if (data.status !== 'pending') {
    throw new PaymentConflictError('This payment was already reviewed. Reload the page to see the latest.');
  }
  return data;
}

type UnpaidPeriod = { seq: number; startAt: Timestamp; periodDays: number; graceDays: number };

/**
 * The oldest closed period still owed once `paid` centavos are paid (oldest debt first),
 * as firestore.rules checks it: null when every closed period is paid, else the period s
 * with startCentavos(s) <= paid < startCentavos(s + 1). Reads period documents from the
 * current pointer forward.
 */
async function unpaidAfterPaying(
  transaction: Transaction,
  driverId: string,
  account: DocumentData,
  paid: number,
): Promise<UnpaidPeriod | null> {
  const current = account.current as { seq: number; startCentavos: number };
  if (paid >= current.startCentavos) return null;
  const pointer = account.unpaid as UnpaidPeriod | null;
  if (!pointer) {
    throw new PaymentConflictError('This account has no unpaid period to apply the payment to. Reload the page.');
  }

  const periodData = async (seq: number) => {
    const snap = await transaction.get(doc(db, 'commissionPeriods', `${driverId}_${seq}`));
    if (!snap.exists()) throw new PaymentConflictError(`Commission period ${seq} is missing for this driver.`);
    return snap.data();
  };

  let seq = pointer.seq;
  let period = await periodData(seq);
  for (;;) {
    const nextStart =
      seq + 1 === current.seq ? current.startCentavos : ((await periodData(seq + 1)).startCentavos as number);
    if (paid < nextStart) break;
    seq += 1;
    period = await periodData(seq);
  }
  return {
    seq: period.seq,
    startAt: period.startAt,
    periodDays: period.periodDays,
    graceDays: period.graceDays,
  };
}

/** What confirming changes on the driver's account, for the confirm dialog. */
export type ConfirmResult = { paidBefore: number; paidAfter: number; accrued: number };

/**
 * Confirms a pending payment: credits the driver's account (oldest debt first) and the
 * earnings ledger in one transaction that re-reads everything.
 */
export async function confirmPayment(paymentId: string, adminUid: string): Promise<ConfirmResult> {
  return runTransaction(db, async (transaction) => {
    const payment = await readPendingPayment(transaction, paymentId);
    const accountRef = doc(db, 'commissionAccounts', payment.driverId);
    const ledgerRef = doc(db, 'earningsLedger', 'totals');
    const [accountSnap, ledgerSnap] = await Promise.all([transaction.get(accountRef), transaction.get(ledgerRef)]);
    if (!accountSnap.exists()) throw new PaymentConflictError('This driver has no commission account.');
    const account = accountSnap.data();
    const paidAfter = account.paidCentavos + payment.amountCentavos;
    if (paidAfter > account.accruedCentavos) {
      throw new PaymentConflictError(
        `This payment is more than the driver owes (${formatCentavos(account.accruedCentavos - account.paidCentavos)}). Reject it and ask the driver to submit the right amount.`,
      );
    }
    const unpaid = await unpaidAfterPaying(transaction, payment.driverId, account, paidAfter);

    // Exact field sets allowed by firestore.rules (Commission payments).
    transaction.update(doc(db, 'commissionPayments', paymentId), {
      status: 'confirmed',
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid,
    });
    transaction.update(accountRef, {
      paidCentavos: paidAfter,
      unpaid,
      lastPaymentId: paymentId,
      updatedAt: serverTimestamp(),
    });
    if (ledgerSnap.exists()) {
      transaction.update(ledgerRef, {
        collectedCentavos: ledgerSnap.data().collectedCentavos + payment.amountCentavos,
        lastPaymentId: paymentId,
        updatedAt: serverTimestamp(),
      });
    } else {
      transaction.set(ledgerRef, {
        collectedCentavos: payment.amountCentavos,
        cashedOutCentavos: 0,
        lastPaymentId: paymentId,
        updatedAt: serverTimestamp(),
      });
    }
    return { paidBefore: account.paidCentavos, paidAfter, accrued: account.accruedCentavos };
  });
}

/** Rejects a pending payment with a reason and frees its reference in the same commit. */
export async function rejectPayment(paymentId: string, adminUid: string, reason: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const payment = await readPendingPayment(transaction, paymentId);
    transaction.update(doc(db, 'commissionPayments', paymentId), {
      status: 'rejected',
      rejectionReason: reason.trim(),
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid,
    });
    transaction.delete(doc(db, 'paymentReferences', payment.reference));
  });
}

export type PaymentRecord = {
  paymentId: string;
  driverId: string;
  amountCentavos: number;
  reference: string;
  status: string;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  rejectionReason: string;
};

/** Every payment (any status), newest first, for the CSV export (single-field index). */
export async function loadAllPayments(): Promise<PaymentRecord[]> {
  const snapshot = await getDocs(query(collection(db, 'commissionPayments'), orderBy('submittedAt', 'desc')));
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      paymentId: d.id,
      driverId: String(data.driverId ?? ''),
      amountCentavos: typeof data.amountCentavos === 'number' ? data.amountCentavos : 0,
      reference: String(data.reference ?? ''),
      status: String(data.status ?? ''),
      submittedAt: (data.submittedAt as Timestamp | undefined)?.toDate?.() ?? null,
      reviewedAt: (data.reviewedAt as Timestamp | undefined)?.toDate?.() ?? null,
      rejectionReason: String(data.rejectionReason ?? ''),
    };
  });
}
