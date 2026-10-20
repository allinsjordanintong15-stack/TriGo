import {
  collection,
  count,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  sum,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';

import { db } from '../firebase/config';
import type { AccountTimes, PeriodTimes } from './commissionStatus';

// Earnings page totals and driver balances. All amounts in integer centavos.
//   earned      = every commission recorded (sum of commissions/*.amountCentavos)
//   collected   = confirmed payments (earningsLedger/totals.collectedCentavos)
//   outstanding = earned − collected (what drivers still owe)
//   cashed out  = recorded cash-outs (earningsLedger/totals.cashedOutCentavos)
//   available   = collected − cashed out

export type EarningsTotals = {
  earnedCentavos: number;
  commissions: number;
  collectedCentavos: number;
  cashedOutCentavos: number;
  outstandingCentavos: number;
  availableCentavos: number;
};

export async function loadEarningsTotals(): Promise<EarningsTotals> {
  const [aggregate, ledgerSnap] = await Promise.all([
    getAggregateFromServer(collection(db, 'commissions'), { earned: sum('amountCentavos'), commissions: count() }),
    getDoc(doc(db, 'earningsLedger', 'totals')),
  ]);
  const { earned, commissions } = aggregate.data();
  const ledger = ledgerSnap.data();
  // Integer centavos, so the sum is exact; rounding only guards against a stray float.
  const earnedCentavos = Math.round(earned ?? 0);
  const collectedCentavos = typeof ledger?.collectedCentavos === 'number' ? ledger.collectedCentavos : 0;
  const cashedOutCentavos = typeof ledger?.cashedOutCentavos === 'number' ? ledger.cashedOutCentavos : 0;
  return {
    earnedCentavos,
    commissions,
    collectedCentavos,
    cashedOutCentavos,
    outstandingCentavos: earnedCentavos - collectedCentavos,
    availableCentavos: collectedCentavos - cashedOutCentavos,
  };
}

export type DriverBalance = {
  driverId: string;
  driverName: string;
  /** Null when the account document cannot be read by this version of the website. */
  account: AccountTimes | null;
};

function readPeriod(value: unknown): PeriodTimes | null {
  const period = value as DocumentData | null | undefined;
  if (
    !period ||
    typeof period.seq !== 'number' ||
    !(period.startAt instanceof Timestamp) ||
    typeof period.periodDays !== 'number' ||
    typeof period.graceDays !== 'number'
  ) {
    return null;
  }
  return {
    seq: period.seq,
    startAtMillis: period.startAt.toMillis(),
    periodDays: period.periodDays,
    graceDays: period.graceDays,
  };
}

function readAccount(data: DocumentData): AccountTimes | null {
  const current = readPeriod(data.current);
  if (
    typeof data.accruedCentavos !== 'number' ||
    typeof data.paidCentavos !== 'number' ||
    !current ||
    typeof data.current.startCentavos !== 'number'
  ) {
    return null;
  }
  return {
    accruedCentavos: data.accruedCentavos,
    paidCentavos: data.paidCentavos,
    current: { ...current, startCentavos: data.current.startCentavos },
    unpaid: readPeriod(data.unpaid),
  };
}

/** Every driver with a commission account, with their name from drivers/{uid}. */
export async function loadDriverBalances(): Promise<DriverBalance[]> {
  const snapshot = await getDocs(collection(db, 'commissionAccounts'));
  const names = await Promise.all(
    snapshot.docs.map((d) => getDoc(doc(db, 'drivers', d.id)).then((driver) => String(driver.data()?.fullName ?? ''))),
  );
  return snapshot.docs.map((d, index) => ({
    driverId: d.id,
    driverName: names[index],
    account: readAccount(d.data()),
  }));
}
