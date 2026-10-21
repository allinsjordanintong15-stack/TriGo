import { COLLECTIONS, firestore } from '@/firebase';
import { BookingType } from '@/types';
import {
  CommissionAccountTimes,
  commissionCentavos,
  commissionStatus,
  normalizeGcashReference,
  periodEndMillis,
} from '@/utils/commission';
import {
  collection,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  serverTimestamp,
  startAfter,
  Timestamp,
  Transaction,
  where,
  writeBatch,
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

// ─── Reads for the driver Earnings tab ──────────────────────────────────────

/** The driver's commission account, or null before their first commission. */
export async function getCommissionAccount(driverId: string): Promise<CommissionAccountTimes | null> {
  let data: DocumentData | undefined;
  try {
    data = (await getDoc(doc(firestore, COLLECTIONS.commissionAccounts, driverId))).data();
  } catch {
    throw new CommissionServiceError(
      'Unable to load your commission. Please check your internet connection and try again.',
    );
  }
  if (!data) return null;
  const state = readAccountState(data);
  if (!state) {
    throw new CommissionServiceError(
      'Your commission account could not be read. Please update the app and try again.',
    );
  }
  const times = (period: PeriodState) => ({
    seq: period.seq,
    startAtMillis: period.startAt.toMillis(),
    periodDays: period.periodDays,
    graceDays: period.graceDays,
  });
  return {
    accruedCentavos: state.accruedCentavos,
    paidCentavos: state.paidCentavos,
    current: { ...times(state.current), startCentavos: state.current.startCentavos },
    unpaid: state.unpaid ? times(state.unpaid) : null,
  };
}

/** Shown when a suspended driver tries to accept a request; the rules refuse it anyway. */
export const COMMISSION_SUSPENDED_MESSAGE =
  'Your commission is overdue and your grace period has ended. Pay the overdue amount on the Earnings tab; you can accept new requests once TriGo confirms your payment.';

/**
 * True when the driver may not accept new requests (T1 accept, out-of-area propose)
 * because commission is still owed after a grace period (firestore.rules
 * isCommissionSuspended). Finishing a current trip and the out-of-area claim stay allowed.
 */
export async function isCommissionSuspended(driverId: string): Promise<boolean> {
  const account = await getCommissionAccount(driverId);
  return account !== null && commissionStatus(account, Date.now()).status === 'suspended';
}

/** commissions/{bookingId}: the commission recorded when a trip was completed. */
export interface CommissionRecord {
  bookingId: string;
  bookingType: BookingType;
  finalFare: number;
  percentage: number;
  amountCentavos: number;
  periodSeq: number;
  completedAt: Date | null;
}

export const COMMISSION_PAGE_SIZE = 20;

export type CommissionCursor = QueryDocumentSnapshot<DocumentData>;

export interface CommissionPage {
  commissions: CommissionRecord[];
  cursor: CommissionCursor | null;
  hasMore: boolean;
}

/** The driver's commissions, newest first, 20 at a time. */
export async function fetchDriverCommissions(
  driverId: string,
  after: CommissionCursor | null = null,
): Promise<CommissionPage> {
  // Composite index commissions (driverId ASC, completedAt DESC) in firestore.indexes.json.
  const constraints = [
    where('driverId', '==', driverId),
    orderBy('completedAt', 'desc'),
    ...(after ? [startAfter(after)] : []),
    limit(COMMISSION_PAGE_SIZE),
  ];

  try {
    const snapshot = await getDocs(query(collection(firestore, COLLECTIONS.commissions), ...constraints));
    return {
      commissions: snapshot.docs.map((d) => {
        const data = d.data();
        return {
          bookingId: d.id,
          bookingType: data.bookingType,
          finalFare: data.finalFare,
          percentage: data.percentage,
          amountCentavos: data.amountCentavos,
          periodSeq: data.periodSeq,
          completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toDate() : null,
        };
      }),
      cursor: snapshot.docs[snapshot.docs.length - 1] ?? after,
      hasMore: snapshot.docs.length === COMMISSION_PAGE_SIZE,
    };
  } catch (error) {
    const code = (error as { code?: string }).code;
    console.warn('[TriGo] fetchDriverCommissions failed', error);
    throw new CommissionServiceError(
      code === 'failed-precondition'
        ? 'Commission history is not available yet: the database index is still being set up.'
        : 'Unable to load your commission history. Please check your internet connection and try again.',
    );
  }
}

// ─── Commission payments ────────────────────────────────────────────────────
// The driver pays TriGo by GCash outside the app, then reports the amount and GCash
// reference number here; an admin checks it and confirms or rejects it (admin Earnings
// page). See firestore.rules (Commission payments).

export type CommissionPaymentStatus = 'pending' | 'confirmed' | 'rejected';

export interface CommissionPayment {
  paymentId: string;
  amountCentavos: number;
  reference: string;
  status: CommissionPaymentStatus;
  rejectionReason: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
}

/**
 * Reports a GCash payment: commissionPayments/{autoId} (pending) and the reference lock
 * paymentReferences/{reference} in one commit. Firestore rules refuse a reference that was
 * already submitted and an amount above the balance (recorded − confirmed paid).
 */
export async function submitCommissionPayment(
  driverId: string,
  amountCentavos: number,
  reference: string,
): Promise<void> {
  const normalized = normalizeGcashReference(reference);
  const batch = writeBatch(firestore);
  const paymentRef = doc(collection(firestore, COLLECTIONS.commissionPayments));
  const referenceRef = doc(firestore, COLLECTIONS.paymentReferences, normalized);
  batch.set(paymentRef, {
    driverId,
    amountCentavos,
    reference: normalized,
    status: 'pending',
    submittedAt: serverTimestamp(),
  });
  batch.set(referenceRef, { paymentId: paymentRef.id, driverId, createdAt: serverTimestamp() });

  try {
    await batch.commit();
  } catch (error) {
    if ((error as { code?: string }).code !== 'permission-denied') {
      throw new CommissionServiceError(
        'Unable to submit your payment. Please check your internet connection and try again.',
      );
    }
    // The rules do not say why. A used reference is the common case: it exists (this
    // driver's) or cannot be read (another driver's).
    const used = await getDoc(referenceRef).then(
      (snapshot) => snapshot.exists(),
      () => true,
    );
    throw new CommissionServiceError(
      used
        ? 'This GCash reference number was already submitted. Check the number on your GCash receipt.'
        : 'The amount is more than your commission balance. Please check the amount and try again.',
    );
  }
}

export type PaymentCursor = QueryDocumentSnapshot<DocumentData>;

export interface PaymentPage {
  payments: CommissionPayment[];
  cursor: PaymentCursor | null;
  hasMore: boolean;
}

export const PAYMENT_PAGE_SIZE = 20;

/** The driver's reported payments, newest first, 20 at a time. */
export async function fetchDriverPayments(
  driverId: string,
  after: PaymentCursor | null = null,
): Promise<PaymentPage> {
  // Composite index commissionPayments (driverId ASC, submittedAt DESC).
  const constraints = [
    where('driverId', '==', driverId),
    orderBy('submittedAt', 'desc'),
    ...(after ? [startAfter(after)] : []),
    limit(PAYMENT_PAGE_SIZE),
  ];

  try {
    const snapshot = await getDocs(
      query(collection(firestore, COLLECTIONS.commissionPayments), ...constraints),
    );
    return {
      payments: snapshot.docs.map((d) => {
        const data = d.data();
        return {
          paymentId: d.id,
          amountCentavos: data.amountCentavos,
          reference: data.reference,
          status:
            data.status === 'confirmed' || data.status === 'rejected' ? data.status : 'pending',
          rejectionReason: typeof data.rejectionReason === 'string' ? data.rejectionReason : null,
          submittedAt: data.submittedAt instanceof Timestamp ? data.submittedAt.toDate() : null,
          reviewedAt: data.reviewedAt instanceof Timestamp ? data.reviewedAt.toDate() : null,
        };
      }),
      cursor: snapshot.docs[snapshot.docs.length - 1] ?? after,
      hasMore: snapshot.docs.length === PAYMENT_PAGE_SIZE,
    };
  } catch (error) {
    const code = (error as { code?: string }).code;
    console.warn('[TriGo] fetchDriverPayments failed', error);
    throw new CommissionServiceError(
      code === 'failed-precondition'
        ? 'Payment history is not available yet: the database index is still being set up.'
        : 'Unable to load your payments. Please check your internet connection and try again.',
    );
  }
}
