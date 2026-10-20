import { COLLECTIONS, firestore } from '@/firebase';
import { BookingType } from '@/types';
import { commissionCentavos, periodEndMillis } from '@/utils/commission';
import {
  doc,
  DocumentData,
  getDoc,
  serverTimestamp,
  Timestamp,
  Transaction,
} from 'firebase/firestore';

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

// ─── Accrual (in the trip completion transaction) ───────────────────────────
// commissionAccounts/{driverId} keeps running totals in centavos and the current period;
// see firestore.rules (Commission accrual). Timestamps stay Firestore Timestamps here: the
// rules compare them exactly, and a Date would drop the microseconds.

interface PeriodState {
  seq: number;
  startAt: Timestamp;
  periodDays: number;
  graceDays: number;
}

interface CommissionAccountState {
  accruedCentavos: number;
  paidCentavos: number;
  current: PeriodState & { startCentavos: number };
  unpaid: PeriodState | null;
}

function readAccountState(data: DocumentData | undefined): CommissionAccountState | null {
  const current = data?.current;
  if (
    !data ||
    typeof data.accruedCentavos !== 'number' ||
    typeof data.paidCentavos !== 'number' ||
    !current ||
    typeof current.seq !== 'number' ||
    !(current.startAt instanceof Timestamp) ||
    typeof current.periodDays !== 'number' ||
    typeof current.graceDays !== 'number' ||
    typeof current.startCentavos !== 'number'
  ) {
    return null;
  }
  return {
    accruedCentavos: data.accruedCentavos,
    paidCentavos: data.paidCentavos,
    current: {
      seq: current.seq,
      startAt: current.startAt,
      periodDays: current.periodDays,
      graceDays: current.graceDays,
      startCentavos: current.startCentavos,
    },
    unpaid: data.unpaid
      ? {
          seq: data.unpaid.seq,
          startAt: data.unpaid.startAt,
          periodDays: data.unpaid.periodDays,
          graceDays: data.unpaid.graceDays,
        }
      : null,
  };
}

/** What the completion transaction read: the settings and the driver's account, if any. */
export interface CommissionContext {
  settings: CommissionSettings | null;
  account: CommissionAccountState | null;
  /** True when an account document exists (even one this app version cannot read). */
  accountExists: boolean;
}

/** Reads for the completion transaction (all reads must come before its writes). */
export async function readCommissionContext(
  transaction: Transaction,
  driverId: string,
): Promise<CommissionContext> {
  const [settingsSnapshot, accountSnapshot] = await Promise.all([
    transaction.get(doc(firestore, COLLECTIONS.commissionSettings, 'active')),
    transaction.get(doc(firestore, COLLECTIONS.commissionAccounts, driverId)),
  ]);
  const data = settingsSnapshot.data();
  const settings =
    data &&
    typeof data.percentage === 'number' &&
    typeof data.paymentPeriodDays === 'number' &&
    typeof data.gracePeriodDays === 'number'
      ? {
          percentage: data.percentage,
          paymentPeriodDays: data.paymentPeriodDays,
          gracePeriodDays: data.gracePeriodDays,
        }
      : null;
  return {
    settings,
    account: readAccountState(accountSnapshot.data()),
    accountExists: accountSnapshot.exists(),
  };
}

/**
 * Whether this commission opens a new period: the current one has ended. Firestore rules
 * decide with server time, so near the end of a period this phone's clock may disagree;
 * the caller then retries with the other choice. Null when there is no choice to make
 * (no settings, or the first commission).
 */
export function shouldOpenNextPeriod(context: CommissionContext, nowMillis: number): boolean | null {
  if (!context.settings || !context.account) return null;
  const { startAt, periodDays } = context.account.current;
  return nowMillis >= periodEndMillis(startAt.toMillis(), periodDays);
}

export interface CompletedTrip {
  bookingId: string;
  bookingType: BookingType;
  finalFare: number;
}

/**
 * Adds the commission writes to the completion transaction: commissions/{bookingId}, the
 * driver's account and, when a period opens, commissionPeriods/{driverId}_{seq}. Nothing
 * is written when the admin has not set a commission.
 */
export function writeCommission(
  transaction: Transaction,
  context: CommissionContext,
  driverId: string,
  trip: CompletedTrip,
  openNextPeriod: boolean,
): void {
  const { settings, account } = context;
  if (!settings) return;
  if (context.accountExists && !account) {
    throw new CommissionServiceError(
      'Your commission account could not be read. Please update the app and try again.',
    );
  }

  const amountCentavos = commissionCentavos(trip.finalFare, settings.percentage);
  const accountRef = doc(firestore, COLLECTIONS.commissionAccounts, driverId);
  const opened = (seq: number, startCentavos: number) => ({
    seq,
    startAt: serverTimestamp(),
    periodDays: settings.paymentPeriodDays,
    graceDays: settings.gracePeriodDays,
    startCentavos,
  });
  const writePeriod = (period: ReturnType<typeof opened>) =>
    transaction.set(doc(firestore, COLLECTIONS.commissionPeriods, `${driverId}_${period.seq}`), {
      driverId,
      ...period,
    });

  let periodSeq: number;
  if (!account) {
    const first = opened(1, 0);
    periodSeq = first.seq;
    transaction.set(accountRef, {
      driverId,
      accruedCentavos: amountCentavos,
      paidCentavos: 0,
      current: first,
      unpaid: null,
      lastBookingId: trip.bookingId,
      updatedAt: serverTimestamp(),
    });
    writePeriod(first);
  } else if (openNextPeriod) {
    const next = opened(account.current.seq + 1, account.accruedCentavos);
    periodSeq = next.seq;
    // The closing period becomes the oldest unpaid one unless an older one already is.
    const unpaid =
      account.unpaid ??
      (account.paidCentavos < account.accruedCentavos
        ? {
            seq: account.current.seq,
            startAt: account.current.startAt,
            periodDays: account.current.periodDays,
            graceDays: account.current.graceDays,
          }
        : null);
    transaction.update(accountRef, {
      accruedCentavos: account.accruedCentavos + amountCentavos,
      current: next,
      unpaid,
      lastBookingId: trip.bookingId,
      updatedAt: serverTimestamp(),
    });
    writePeriod(next);
  } else {
    periodSeq = account.current.seq;
    transaction.update(accountRef, {
      accruedCentavos: account.accruedCentavos + amountCentavos,
      lastBookingId: trip.bookingId,
      updatedAt: serverTimestamp(),
    });
  }

  transaction.set(doc(firestore, COLLECTIONS.commissions, trip.bookingId), {
    driverId,
    bookingId: trip.bookingId,
    bookingType: trip.bookingType,
    finalFare: trip.finalFare,
    percentage: settings.percentage,
    amountCentavos,
    periodSeq,
    completedAt: serverTimestamp(),
  });
}
