/// <reference types="node" />

// Shared fixtures for commission accrual: the documents a trip completion starts from and
// the exact writes driverBookingService.completeTrip + commissionService.writeCommission
// make. Used by commissionAccrual.test.ts and measureHeadroom.ts.
// Self-contained on purpose: Node's type stripping does not resolve the "@/..." aliases.

import { doc, serverTimestamp, Timestamp, writeBatch, type DocumentData, type Firestore } from 'firebase/firestore';

export const ADMIN = 'admin1';
export const PASSENGER = 'passenger1';
export const DRIVER = 'driver1';
export const OTHER_DRIVER = 'driver2';
/** A passenger whose driver application was approved (the longest isDriver() path). */
export const APPLICANT_DRIVER = 'passengerDriver1';
export const BOOKING = 'booking1';
export const FARE = 45;
export const PERCENTAGE = 10;
export const PERIOD_DAYS = 7;
export const GRACE_DAYS = 3;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
const MANILA_OFFSET_MS = 8 * HOUR_MS;

/** Same as src/utils/commission.ts periodEndMillis. */
export function periodEndMillis(startAtMillis: number, periodDays: number): number {
  return (Math.floor((startAtMillis + MANILA_OFFSET_MS) / DAY_MS) + periodDays) * DAY_MS - MANILA_OFFSET_MS;
}

export type Settings = { percentage: number; paymentPeriodDays: number; gracePeriodDays: number };
export const SETTINGS: Settings = { percentage: PERCENTAGE, paymentPeriodDays: PERIOD_DAYS, gracePeriodDays: GRACE_DAYS };

export type Period = { seq: number; startAt: Timestamp; periodDays: number; graceDays: number };
export type Account = {
  accruedCentavos: number;
  paidCentavos: number;
  current: Period & { startCentavos: number };
  unpaid: Period | null;
};

function location(address: string) {
  return { latitude: 9.97, longitude: 124.48, address };
}

/** Users and records every scenario needs. */
export function baseDocs(): Record<string, DocumentData> {
  return {
    [`users/${PASSENGER}`]: { uid: PASSENGER, role: 'passenger' },
    [`users/${DRIVER}`]: { uid: DRIVER, role: 'driver' },
    [`users/${OTHER_DRIVER}`]: { uid: OTHER_DRIVER, role: 'driver' },
    [`users/${APPLICANT_DRIVER}`]: { uid: APPLICANT_DRIVER, role: 'passenger' },
    [`driverApplications/${APPLICANT_DRIVER}`]: { status: 'approved' },
    [`drivers/${OTHER_DRIVER}`]: driverRecord(null),
  };
}

export function inProgressBooking(driverId: string, overrides: DocumentData = {}): DocumentData {
  return {
    passengerId: PASSENGER,
    driverId,
    bookingType: 'standard',
    vehicleType: 'tricycle',
    pickupLocation: location('Poblacion, Trinidad'),
    destination: location('Kinan-oan, Trinidad'),
    distanceKm: 3.2,
    estimatedFare: FARE,
    driverProposedFare: null,
    agreedFare: null,
    finalFare: null,
    status: 'in_progress',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  };
}

/** An in-progress out-of-area booking at the agreed fare. */
export function outOfAreaInProgressBooking(driverId: string, fare: number): DocumentData {
  return inProgressBooking(driverId, {
    bookingType: 'out_of_area',
    estimatedFare: fare,
    driverProposedFare: fare,
    agreedFare: fare,
    outOfAreaRequestId: BOOKING,
  });
}

export function driverRecord(bookingId: string | null): DocumentData {
  return {
    isVerified: true,
    isOnline: true,
    isAvailable: false,
    vehicleType: 'tricycle',
    currentBookingId: bookingId,
    currentRequestId: null,
  };
}

/** An account whose current period started `startedMsAgo` ago. */
export function account(startedMsAgo: number, overrides: Partial<Account> = {}): Account {
  return {
    accruedCentavos: 900,
    paidCentavos: 0,
    current: {
      seq: 2,
      startAt: Timestamp.fromMillis(Date.now() - startedMsAgo),
      periodDays: PERIOD_DAYS,
      graceDays: GRACE_DAYS,
      startCentavos: 400,
    },
    unpaid: null,
    ...overrides,
  };
}

/** The documents a completion starts from (settings: undefined = SETTINGS, null = none). */
export function tripDocs(
  options: { driverId?: string; settings?: Settings | null; account?: Account | null; booking?: DocumentData } = {},
): Record<string, DocumentData> {
  const driverId = options.driverId ?? DRIVER;
  const docs: Record<string, DocumentData> = {
    [`bookings/${BOOKING}`]: options.booking ?? inProgressBooking(driverId),
    [`drivers/${driverId}`]: driverRecord(BOOKING),
  };
  const settings = options.settings === undefined ? SETTINGS : options.settings;
  if (settings) {
    docs['commissionSettings/active'] = { ...settings, updatedAt: Timestamp.now(), updatedBy: ADMIN };
  }
  if (options.account) {
    docs[`commissionAccounts/${driverId}`] = {
      driverId,
      ...options.account,
      lastBookingId: 'olderBooking',
      updatedAt: Timestamp.now(),
    };
  }
  return docs;
}

export type Writes = {
  booking: DocumentData;
  driver: DocumentData;
  commission: DocumentData | null;
  account: { kind: 'set' | 'update'; data: DocumentData } | null;
  period: { id: string; data: DocumentData } | null;
};

/**
 * The writes completeTrip + writeCommission make for `before` (null = first commission),
 * opening a new period when `openNextPeriod`. No commission writes without settings.
 */
export function appWrites(
  options: {
    driverId?: string;
    finalFare?: number;
    bookingType?: string;
    settings?: Settings | null;
    before?: Account | null;
    openNextPeriod?: boolean;
  } = {},
): Writes {
  const driverId = options.driverId ?? DRIVER;
  const finalFare = options.finalFare ?? FARE;
  const settings = options.settings === undefined ? SETTINGS : options.settings;
  const before = options.before ?? null;
  const writes: Writes = {
    booking: {
      status: 'completed',
      completedAt: serverTimestamp(),
      finalFare,
      paymentMethod: 'cash',
      updatedAt: serverTimestamp(),
    },
    driver: { currentBookingId: null, isOnline: true, isAvailable: true, updatedAt: serverTimestamp() },
    commission: null,
    account: null,
    period: null,
  };
  if (!settings) return writes;

  const amountCentavos = Math.round(finalFare * settings.percentage);
  const opened = (seq: number, startCentavos: number) => ({
    seq,
    startAt: serverTimestamp(),
    periodDays: settings.paymentPeriodDays,
    graceDays: settings.gracePeriodDays,
    startCentavos,
  });
  let periodSeq: number;
  if (!before) {
    const first = opened(1, 0);
    periodSeq = 1;
    writes.account = {
      kind: 'set',
      data: {
        driverId,
        accruedCentavos: amountCentavos,
        paidCentavos: 0,
        current: first,
        unpaid: null,
        lastBookingId: BOOKING,
        updatedAt: serverTimestamp(),
      },
    };
    writes.period = { id: `${driverId}_1`, data: { driverId, ...first } };
  } else if (options.openNextPeriod) {
    const next = opened(before.current.seq + 1, before.accruedCentavos);
    periodSeq = next.seq;
    const unpaid =
      before.unpaid ??
      (before.paidCentavos < before.accruedCentavos
        ? {
            seq: before.current.seq,
            startAt: before.current.startAt,
            periodDays: before.current.periodDays,
            graceDays: before.current.graceDays,
          }
        : null);
    writes.account = {
      kind: 'update',
      data: {
        accruedCentavos: before.accruedCentavos + amountCentavos,
        current: next,
        unpaid,
        lastBookingId: BOOKING,
        updatedAt: serverTimestamp(),
      },
    };
    writes.period = { id: `${driverId}_${next.seq}`, data: { driverId, ...next } };
  } else {
    periodSeq = before.current.seq;
    writes.account = {
      kind: 'update',
      data: { accruedCentavos: before.accruedCentavos + amountCentavos, lastBookingId: BOOKING, updatedAt: serverTimestamp() },
    };
  }
  writes.commission = {
    driverId,
    bookingId: BOOKING,
    bookingType: options.bookingType ?? 'standard',
    finalFare,
    percentage: settings.percentage,
    amountCentavos,
    periodSeq,
    completedAt: serverTimestamp(),
  };
  return writes;
}

/** Commits the writes in one batch as `firestore` (the driver's client). */
export function commitWrites(firestore: Firestore, writes: Writes, driverId = DRIVER): Promise<void> {
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'bookings', BOOKING), writes.booking);
  batch.update(doc(firestore, 'drivers', driverId), writes.driver);
  if (writes.account) {
    const ref = doc(firestore, 'commissionAccounts', driverId);
    if (writes.account.kind === 'set') batch.set(ref, writes.account.data);
    else batch.update(ref, writes.account.data);
  }
  if (writes.period) batch.set(doc(firestore, 'commissionPeriods', writes.period.id), writes.period.data);
  if (writes.commission) batch.set(doc(firestore, 'commissions', BOOKING), writes.commission);
  return batch.commit();
}

// ─── Commission payments ────────────────────────────────────────────────────
// The exact writes commissionService.submitCommissionPayment (driver) and
// admin/src/earnings/payments.ts confirmPayment / rejectPayment make.

export const PAYMENT = 'payment1';
export const REFERENCE = '1234567890123';

/** commissionPeriods/{driverId}_{seq} for a period that started `startedMsAgo` ago. */
export function periodDoc(seq: number, startCentavos: number, startedMsAgo: number, driverId = DRIVER): DocumentData {
  return {
    driverId,
    seq,
    startAt: Timestamp.fromMillis(Date.now() - startedMsAgo),
    periodDays: PERIOD_DAYS,
    graceDays: GRACE_DAYS,
    startCentavos,
  };
}

/** The account's `unpaid` pointer for a period document. */
export function unpaidFrom(period: DocumentData): Period {
  return { seq: period.seq, startAt: period.startAt, periodDays: period.periodDays, graceDays: period.graceDays };
}

/**
 * A driver with three closed periods (1: ₱0–3, 2: ₱3–6, 3: ₱6–9) and a running period 4
 * from ₱9; ₱12 recorded, nothing paid, period 1 unpaid.
 */
export function multiPeriodDocs(driverId = DRIVER): { docs: Record<string, DocumentData>; periods: DocumentData[] } {
  const periods = [
    periodDoc(1, 0, 30 * DAY_MS, driverId),
    periodDoc(2, 300, 22 * DAY_MS, driverId),
    periodDoc(3, 600, 14 * DAY_MS, driverId),
  ];
  const current = periodDoc(4, 900, 2 * DAY_MS, driverId);
  const docs: Record<string, DocumentData> = {
    [`drivers/${driverId}`]: driverRecord(null),
    [`commissionAccounts/${driverId}`]: {
      driverId,
      accruedCentavos: 1200,
      paidCentavos: 0,
      current: { ...unpaidFrom(current), startCentavos: 900 },
      unpaid: unpaidFrom(periods[0]),
      lastBookingId: 'olderBooking',
      updatedAt: Timestamp.now(),
    },
  };
  for (const period of [...periods, current]) docs[`commissionPeriods/${driverId}_${period.seq}`] = period;
  return { docs, periods };
}

export function pendingPayment(amountCentavos: number, overrides: DocumentData = {}): DocumentData {
  return {
    driverId: DRIVER,
    amountCentavos,
    reference: REFERENCE,
    status: 'pending',
    submittedAt: Timestamp.now(),
    ...overrides,
  };
}

/** A submitted payment and its reference lock, as already stored. */
export function submittedDocs(amountCentavos: number, paymentId = PAYMENT, reference = REFERENCE): Record<string, DocumentData> {
  return {
    [`commissionPayments/${paymentId}`]: pendingPayment(amountCentavos, { reference }),
    [`paymentReferences/${reference}`]: { paymentId, driverId: DRIVER, createdAt: Timestamp.now() },
  };
}

export type SubmitWrites = { payment: DocumentData | null; reference: DocumentData | null };

export function submitWrites(amountCentavos: number, overrides: { payment?: DocumentData; reference?: DocumentData } = {}): SubmitWrites {
  return {
    payment: {
      driverId: DRIVER,
      amountCentavos,
      reference: REFERENCE,
      status: 'pending',
      submittedAt: serverTimestamp(),
      ...overrides.payment,
    },
    reference: { paymentId: PAYMENT, driverId: DRIVER, createdAt: serverTimestamp(), ...overrides.reference },
  };
}

export function commitSubmit(firestore: Firestore, writes: SubmitWrites, paymentId = PAYMENT, reference = REFERENCE): Promise<void> {
  const batch = writeBatch(firestore);
  if (writes.payment) batch.set(doc(firestore, 'commissionPayments', paymentId), writes.payment);
  if (writes.reference) batch.set(doc(firestore, 'paymentReferences', reference), writes.reference);
  return batch.commit();
}

export type ConfirmWrites = {
  payment: DocumentData;
  account: DocumentData | null;
  /** 'set' creates the ledger (first confirm). */
  ledger: { kind: 'set' | 'update'; data: DocumentData } | null;
};

/** Confirming a payment of `amountCentavos`: paid becomes `paidAfter`, `unpaid` the new pointer. */
export function confirmWrites(options: {
  amountCentavos: number;
  paidAfter: number;
  unpaid: Period | null;
  /** collectedCentavos before; null = no ledger yet. */
  collectedBefore: number | null;
  paymentId?: string;
}): ConfirmWrites {
  const paymentId = options.paymentId ?? PAYMENT;
  return {
    payment: { status: 'confirmed', reviewedAt: serverTimestamp(), reviewedBy: ADMIN },
    account: {
      paidCentavos: options.paidAfter,
      unpaid: options.unpaid,
      lastPaymentId: paymentId,
      updatedAt: serverTimestamp(),
    },
    ledger:
      options.collectedBefore === null
        ? {
            kind: 'set',
            data: {
              collectedCentavos: options.amountCentavos,
              cashedOutCentavos: 0,
              lastPaymentId: paymentId,
              updatedAt: serverTimestamp(),
            },
          }
        : {
            kind: 'update',
            data: {
              collectedCentavos: options.collectedBefore + options.amountCentavos,
              lastPaymentId: paymentId,
              updatedAt: serverTimestamp(),
            },
          },
  };
}

export function commitConfirm(firestore: Firestore, writes: ConfirmWrites, paymentId = PAYMENT, driverId = DRIVER): Promise<void> {
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'commissionPayments', paymentId), writes.payment);
  if (writes.account) batch.update(doc(firestore, 'commissionAccounts', driverId), writes.account);
  if (writes.ledger?.kind === 'set') batch.set(doc(firestore, 'earningsLedger', 'totals'), writes.ledger.data);
  if (writes.ledger?.kind === 'update') batch.update(doc(firestore, 'earningsLedger', 'totals'), writes.ledger.data);
  return batch.commit();
}

// ─── Commission enforcement ─────────────────────────────────────────────────
// The exact writes driverBookingService.acceptBooking (T1), fareAgreementService.createProposal
// (propose) and driverBookingService.claimOutOfAreaBooking (claim) make.

export const REQUEST = 'request1';
export const OUT_OF_AREA_FARE = 520;

/** An online, available driver with no trip or reservation. */
export function availableDriverRecord(): DocumentData {
  return { ...driverRecord(null), isAvailable: true };
}

/** commissionAccounts/{driverId} as stored. */
export function accountDoc(state: Account, driverId = DRIVER): DocumentData {
  return { driverId, ...state, lastBookingId: 'olderBooking', updatedAt: Timestamp.now() };
}

/** An open standard booking (T1 accept starts from it). */
export function openBooking(): DocumentData {
  return inProgressBooking(DRIVER, { driverId: null, status: 'pending' });
}

export function commitAccept(firestore: Firestore, driverId = DRIVER): Promise<void> {
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'bookings', BOOKING), {
    driverId,
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(firestore, 'drivers', driverId), {
    isAvailable: false,
    currentBookingId: BOOKING,
    updatedAt: serverTimestamp(),
  });
  return batch.commit();
}

function requestFareAgreement(overrides: DocumentData = {}): DocumentData {
  return {
    standardEstimatedFare: OUT_OF_AREA_FARE,
    driverProposedFare: OUT_OF_AREA_FARE,
    agreedFare: OUT_OF_AREA_FARE,
    agreedByPassenger: false,
    agreedByDriver: true,
    agreedAt: null,
    ...overrides,
  };
}

/** An open out-of-area request (propose starts from it). */
export function openRequest(overrides: DocumentData = {}): DocumentData {
  return {
    passengerId: PASSENGER,
    pickupLocation: location('Poblacion, Trinidad'),
    destination: location('Tagbilaran City'),
    vehicleType: 'tricycle',
    distanceKm: 48.5,
    standardEstimatedFare: OUT_OF_AREA_FARE,
    suggestedAgreementFare: null,
    agreedFare: null,
    status: 'searching',
    driverId: null,
    fareAgreement: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + 30 * 60 * 1000),
    ...overrides,
  };
}

export function commitPropose(firestore: Firestore, driverId = DRIVER): Promise<void> {
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'outOfAreaRequests', REQUEST), {
    status: 'negotiating',
    driverId,
    suggestedAgreementFare: OUT_OF_AREA_FARE,
    fareAgreement: requestFareAgreement(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(firestore, 'drivers', driverId), {
    currentRequestId: REQUEST,
    isAvailable: false,
    updatedAt: serverTimestamp(),
  });
  return batch.commit();
}

/**
 * The passenger confirmed DRIVER on REQUEST: the request is accepted, the driver still
 * reserved for it, and the unclaimed booking waits at bookings/{REQUEST}.
 */
export function claimDocs(driverId = DRIVER): Record<string, DocumentData> {
  const agreed = requestFareAgreement({ agreedByPassenger: true, agreedAt: Timestamp.now() });
  return {
    [`drivers/${driverId}`]: { ...driverRecord(null), currentRequestId: REQUEST },
    [`outOfAreaRequests/${REQUEST}`]: openRequest({
      status: 'accepted',
      driverId,
      suggestedAgreementFare: OUT_OF_AREA_FARE,
      agreedFare: OUT_OF_AREA_FARE,
      fareAgreement: agreed,
    }),
    [`bookings/${REQUEST}`]: {
      ...inProgressBooking(driverId, {
        driverId: null,
        status: 'pending',
        bookingType: 'out_of_area',
        destination: location('Tagbilaran City'),
        distanceKm: 48.5,
        estimatedFare: OUT_OF_AREA_FARE,
        driverProposedFare: OUT_OF_AREA_FARE,
        agreedFare: OUT_OF_AREA_FARE,
        outOfAreaRequestId: REQUEST,
      }),
      fareAgreement: agreed,
      acceptedAt: null,
    },
  };
}

export function commitClaim(firestore: Firestore, driverId = DRIVER): Promise<void> {
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'bookings', REQUEST), {
    driverId,
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(firestore, 'drivers', driverId), {
    currentBookingId: REQUEST,
    currentRequestId: null,
    isAvailable: false,
    updatedAt: serverTimestamp(),
  });
  return batch.commit();
}
