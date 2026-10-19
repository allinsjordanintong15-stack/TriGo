import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { db } from '../firebase/config';

// paymentSettings/active: TriGo's GCash account that drivers pay commission to. TriGo moves
// no money: drivers pay in GCash and report the reference, and an admin verifies it
// (docs/DECISIONS.md, 2026-10-19). firestore.rules: admins write the complete object;
// admins and drivers read it (the driver app shows it as the pay instructions).
const PAYMENT_DOC = doc(db, 'paymentSettings', 'active');

export type PaymentSettings = {
  gcashName: string;
  /** 11 digits, e.g. 09171234567 (firestore.rules: ^09[0-9]{9}$). */
  gcashNumber: string;
};

export type LoadedPaymentSettings = {
  /** Saved settings, or null when none are saved yet. */
  saved: PaymentSettings | null;
  updatedAt: Date | null;
};

/** Same limit as firestore.rules. */
export const GCASH_NAME_MAX_LENGTH = 60;

function readSaved(data: Record<string, unknown> | undefined): PaymentSettings | null {
  if (data && typeof data.gcashName === 'string' && typeof data.gcashNumber === 'string') {
    return { gcashName: data.gcashName, gcashNumber: data.gcashNumber };
  }
  return null;
}

export async function loadPaymentSettings(): Promise<LoadedPaymentSettings> {
  const data = (await getDoc(PAYMENT_DOC)).data();
  return { saved: readSaved(data), updatedAt: data?.updatedAt?.toDate?.() ?? null };
}

export function paymentSettingsEqual(a: PaymentSettings | null, b: PaymentSettings | null): boolean {
  if (!a || !b) return a === b;
  return a.gcashName === b.gcashName && a.gcashNumber === b.gcashNumber;
}

export class StalePaymentSettingsError extends Error {
  constructor() {
    super('The GCash account was changed by someone else. Reload the page and try again.');
  }
}

/**
 * Writes the complete object. Fails with StalePaymentSettingsError when the saved settings
 * are no longer the ones the admin confirmed against (`expectedSaved`).
 */
export async function savePaymentSettings(
  settings: PaymentSettings,
  expectedSaved: PaymentSettings | null,
  uid: string,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(PAYMENT_DOC);
    if (!paymentSettingsEqual(readSaved(snapshot.data()), expectedSaved)) {
      throw new StalePaymentSettingsError();
    }
    transaction.set(PAYMENT_DOC, { ...settings, updatedAt: serverTimestamp(), updatedBy: uid });
  });
}

/** Trims and collapses spaces; returns the account name or an error message. */
export function parseGcashName(input: string): { value: string } | { error: string } {
  const value = input.trim().replace(/\s+/g, ' ');
  if (!value) return { error: 'Required.' };
  if (value.length > GCASH_NAME_MAX_LENGTH) return { error: `At most ${GCASH_NAME_MAX_LENGTH} characters.` };
  return { value };
}

/**
 * A Philippine mobile number for GCash. Spaces and dashes are allowed; +63 / 63 becomes 0.
 * Returns the 11 digits that are stored, e.g. "+63 917 123 4567" → "09171234567".
 */
export function parseGcashNumber(input: string): { value: string } | { error: string } {
  const text = input.trim();
  if (!text) return { error: 'Required.' };
  if (!/^\+?[0-9 -]+$/.test(text)) return { error: 'Enter a mobile number, e.g. 0917 123 4567.' };
  let digits = text.replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length === 12) digits = `0${digits.slice(2)}`;
  if (!/^09[0-9]{9}$/.test(digits)) return { error: 'Enter an 11-digit mobile number starting with 09.' };
  return { value: digits };
}

/** "09171234567" → "0917 123 4567". */
export function formatGcashNumber(digits: string): string {
  return /^[0-9]{11}$/.test(digits) ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` : digits;
}
