import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

import { db } from '../firebase/config';
import { formatCentavos } from '../lib/format';

// Cash-outs: commission an admin moved out of TriGo's GCash in the real GCash, Maya or bank
// app. TriGo only records them. Each record is created with the earningsLedger/totals update
// that adds it to cashedOutCentavos, never above collectedCentavos, and is never edited or
// deleted. firestore.rules (Cash-outs) checks every value written here.

export const CASH_OUT_METHODS = ['gcash', 'maya', 'bank_transfer'] as const;
export type CashOutMethod = (typeof CASH_OUT_METHODS)[number];

export const CASH_OUT_METHOD_LABELS: Record<CashOutMethod, string> = {
  gcash: 'GCash',
  maya: 'Maya',
  bank_transfer: 'Bank transfer',
};

export const MAX_CASH_OUT_REFERENCE_LENGTH = 60;
export const MAX_CASH_OUT_NOTE_LENGTH = 300;

export type CashOut = {
  cashOutId: string;
  method: CashOutMethod | null;
  amountCentavos: number;
  reference: string;
  cashedOutOn: string;
  note: string;
  createdAt: Date | null;
  createdBy: string;
};

export type CashOutInput = {
  method: CashOutMethod;
  amountCentavos: number;
  reference: string;
  cashedOutOn: string;
  note: string;
};

/** "1,250.50" or "1250.5" → 125050 centavos; null unless a positive amount with ≤ 2 decimals. */
export function parsePesoAmount(text: string): number | null {
  const value = text.trim().replace(/,/g, '');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const centavos = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return centavos > 0 ? centavos : null;
}

/** True for a real calendar day written 'YYYY-MM-DD' (the value of <input type="date">). */
export function isCalendarDate(value: string): boolean {
  const match = /^(20\d{2})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

/** Every cash-out, newest first (single-field index on createdAt). */
export async function loadCashOuts(): Promise<CashOut[]> {
  const snapshot = await getDocs(query(collection(db, 'cashOuts'), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      cashOutId: d.id,
      method: CASH_OUT_METHODS.includes(data.method) ? (data.method as CashOutMethod) : null,
      amountCentavos: typeof data.amountCentavos === 'number' ? data.amountCentavos : 0,
      reference: String(data.reference ?? ''),
      cashedOutOn: String(data.cashedOutOn ?? ''),
      note: String(data.note ?? ''),
      createdAt: (data.createdAt as Timestamp | undefined)?.toDate?.() ?? null,
      createdBy: String(data.createdBy ?? ''),
    };
  });
}

export class CashOutConflictError extends Error {}

/**
 * Records a cash-out and adds it to the ledger in one transaction that re-reads the ledger,
 * so a cash-out recorded meanwhile in another tab cannot push the total above collected.
 * Returns the available balance (collected − cashed out) after it.
 */
export async function recordCashOut(input: CashOutInput, adminUid: string): Promise<number> {
  return runTransaction(db, async (transaction) => {
    const ledgerRef = doc(db, 'earningsLedger', 'totals');
    const ledgerSnap = await transaction.get(ledgerRef);
    if (!ledgerSnap.exists()) {
      throw new CashOutConflictError('Nothing has been collected yet, so there is nothing to cash out.');
    }
    const { collectedCentavos, cashedOutCentavos } = ledgerSnap.data();
    const available = collectedCentavos - cashedOutCentavos;
    if (input.amountCentavos > available) {
      throw new CashOutConflictError(
        `This is more than the available balance (${formatCentavos(available)}). Reload the page to see the latest.`,
      );
    }

    const cashOutRef = doc(collection(db, 'cashOuts'));
    // Exact field sets allowed by firestore.rules (Cash-outs).
    transaction.set(cashOutRef, {
      method: input.method,
      amountCentavos: input.amountCentavos,
      reference: input.reference.trim(),
      cashedOutOn: input.cashedOutOn,
      note: input.note.trim(),
      createdAt: serverTimestamp(),
      createdBy: adminUid,
    });
    transaction.update(ledgerRef, {
      cashedOutCentavos: cashedOutCentavos + input.amountCentavos,
      lastCashOutId: cashOutRef.id,
      updatedAt: serverTimestamp(),
    });
    return available - input.amountCentavos;
  });
}
