import { COLLECTIONS, firestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * commissionSettings/active, set on the admin website. Commission = percentage of the final
 * fare on every completed trip (docs/DECISIONS.md). Firestore rules let admins and anyone
 * with a drivers/{uid} record read it; passengers cannot.
 */
export interface CommissionSettings {
  percentage: number;
  paymentPeriodDays: number;
  gracePeriodDays: number;
}

/**
 * paymentSettings/active: TriGo's GCash account that drivers pay commission to. TriGo
 * moves no money: drivers pay in GCash and enter the reference number, and an admin
 * verifies it. Same read access as commissionSettings.
 */
export interface PaymentSettings {
  gcashName: string;
  /** 11 digits, e.g. 09171234567. */
  gcashNumber: string;
}

export class CommissionServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommissionServiceError';
  }
}

/** The saved commission settings, or null when the admin has not set any (no commission). */
export async function getCommissionSettings(): Promise<CommissionSettings | null> {
  try {
    const data = (await getDoc(doc(firestore, COLLECTIONS.commissionSettings, 'active'))).data();
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
  } catch {
    throw new CommissionServiceError(
      'Unable to load the commission settings. Please check your internet connection and try again.',
    );
  }
}

/** TriGo's GCash account, or null when the admin has not saved one yet. */
export async function getPaymentSettings(): Promise<PaymentSettings | null> {
  try {
    const data = (await getDoc(doc(firestore, COLLECTIONS.paymentSettings, 'active'))).data();
    if (data && typeof data.gcashName === 'string' && typeof data.gcashNumber === 'string') {
      return { gcashName: data.gcashName, gcashNumber: data.gcashNumber };
    }
    return null;
  } catch {
    throw new CommissionServiceError(
      'Unable to load the payment details. Please check your internet connection and try again.',
    );
  }
}

/** "09171234567" → "0917 123 4567" (as shown on the admin website). */
export function formatGcashNumber(digits: string): string {
  return /^[0-9]{11}$/.test(digits)
    ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
    : digits;
}
