import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { db } from '../firebase/config';

// commissionSettings/active: admins write (firestore.rules); admins and drivers read it.
// Stored only: nothing charges drivers yet. Commission = percentage of the final fare
// (docs/DECISIONS.md).
const COMMISSION_DOC = doc(db, 'commissionSettings', 'active');

export type CommissionSettings = {
  percentage: number;
  paymentPeriodDays: number;
  gracePeriodDays: number;
};

export type LoadedCommission = {
  /** Saved settings, or null when none are saved yet. */
  saved: CommissionSettings | null;
  updatedAt: Date | null;
};

export const PAYMENT_PERIOD_RANGE = { min: 1, max: 31 } as const;
export const GRACE_PERIOD_RANGE = { min: 0, max: 14 } as const;

function readSettings(data: Record<string, unknown> | undefined): CommissionSettings | null {
  if (
    data &&
    typeof data.percentage === 'number' &&
    typeof data.paymentPeriodDays === 'number' &&
    typeof data.gracePeriodDays === 'number'
  ) {
    return {
      percentage: data.percentage,
      paymentPeriodDays: data.paymentPeriodDays,
      gracePeriodDays: data.gracePeriodDays,
    };
  }
  return null;
}

export async function loadCommission(): Promise<LoadedCommission> {
  const snapshot = await getDoc(COMMISSION_DOC);
  const data = snapshot.data();
  return { saved: readSettings(data), updatedAt: data?.updatedAt?.toDate?.() ?? null };
}

export function commissionEqual(a: CommissionSettings | null, b: CommissionSettings | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.percentage === b.percentage &&
    a.paymentPeriodDays === b.paymentPeriodDays &&
    a.gracePeriodDays === b.gracePeriodDays
  );
}

export class StaleCommissionError extends Error {
  constructor() {
    super('Commission settings were changed by someone else. Reload the page and try again.');
  }
}

/**
 * Writes the complete settings object. Re-reads first and fails with StaleCommissionError
 * when the saved settings are no longer the ones the admin confirmed against.
 */
export async function saveCommission(
  settings: CommissionSettings,
  expectedSaved: CommissionSettings | null,
  uid: string,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(COMMISSION_DOC);
    if (!commissionEqual(readSettings(snapshot.data()), expectedSaved)) {
      throw new StaleCommissionError();
    }
    transaction.set(COMMISSION_DOC, { ...settings, updatedAt: serverTimestamp(), updatedBy: uid });
  });
}

/** Commission on a fare, rounded to the nearest centavo (for the example only). */
export function calculateCommission(fare: number, percentage: number): number {
  return Math.round(fare * percentage) / 100;
}

/** Parses a whole number of days within [min, max], or returns an error message. */
export function parseDays(input: string, range: { min: number; max: number }): { value: number } | { error: string } {
  const text = input.trim();
  if (!text) return { error: 'Required.' };
  if (!/^\d+$/.test(text)) return { error: 'Enter a whole number of days.' };
  const value = Number(text);
  if (value < range.min || value > range.max) {
    return { error: `Must be ${range.min} to ${range.max} days.` };
  }
  return { value };
}

/** Parses a percentage above 0 and up to 100 with at most 2 decimals, or returns an error message. */
export function parsePercentage(input: string): { value: number } | { error: string } {
  const text = input.trim();
  if (!text) return { error: 'Required.' };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return { error: 'Enter a number with at most 2 decimal places (e.g. 10 or 12.5).' };
  }
  const value = Number(text);
  if (value <= 0 || value > 100) return { error: 'Must be more than 0 and at most 100.' };
  return { value };
}
