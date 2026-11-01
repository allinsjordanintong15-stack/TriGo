import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { db } from '../firebase/config';

// fareSettings/active.booking, read by the mobile app (src/services/fareService.ts) and
// written here. firestore.rules accepts only the complete object ({ requestExpiryMinutes },
// a whole number 1-30) and leaves `fares` and `outOfArea` alone.
const FARE_DOC = doc(db, 'fareSettings', 'active');

export type BookingSettings = {
  /** Whole minutes a standard booking stays open for drivers. */
  requestExpiryMinutes: number;
};

/** Mirrors DEFAULT_BOOKING_SETTINGS in src/utils/bookingExpiry.ts: what the app uses when nothing is saved. */
export const APP_DEFAULT_BOOKING: BookingSettings = { requestExpiryMinutes: 10 };

/** Same limits as firestore.rules (whole numbers). */
export const BOOKING_EXPIRY_RANGE = { min: 1, max: 30 } as const;

export type LoadedBookingSettings = {
  /** The settings the app uses now (the saved value, or the app default). */
  settings: BookingSettings;
  /** Exactly what is saved in Firestore, or null when the document or its booking is missing. */
  saved: BookingSettings | null;
  updatedAt: Date | null;
};

function readSaved(value: unknown): BookingSettings | null {
  const data = value as Partial<BookingSettings> | undefined;
  if (data && typeof data.requestExpiryMinutes === 'number') {
    return { requestExpiryMinutes: data.requestExpiryMinutes };
  }
  return null;
}

/** Same fallback as the app's bookingExpiryMinutes(): whole minutes 1-30, else the default. */
function appMinutes(saved: BookingSettings | null): number {
  const minutes = saved?.requestExpiryMinutes;
  if (minutes === undefined || !Number.isInteger(minutes) || minutes < BOOKING_EXPIRY_RANGE.min) {
    return APP_DEFAULT_BOOKING.requestExpiryMinutes;
  }
  return Math.min(minutes, BOOKING_EXPIRY_RANGE.max);
}

export async function loadBookingSettings(): Promise<LoadedBookingSettings> {
  const snapshot = await getDoc(FARE_DOC);
  const data = snapshot.data();
  const saved = readSaved(data?.booking);
  return {
    settings: { requestExpiryMinutes: appMinutes(saved) },
    saved,
    updatedAt: data?.updatedAt?.toDate?.() ?? null,
  };
}

export function bookingSettingsEqual(a: BookingSettings | null, b: BookingSettings | null): boolean {
  if (!a || !b) return a === b;
  return a.requestExpiryMinutes === b.requestExpiryMinutes;
}

export class StaleBookingSettingsError extends Error {
  constructor() {
    super('Booking settings were changed by someone else. Reload the page and try again.');
  }
}

/**
 * Writes the whole `booking` object. Fails with StaleBookingSettingsError when the saved
 * settings are no longer the ones the admin confirmed against (`expectedSaved`).
 */
export async function saveBookingSettings(
  settings: BookingSettings,
  expectedSaved: BookingSettings | null,
  uid: string,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(FARE_DOC);
    if (!bookingSettingsEqual(readSaved(snapshot.data()?.booking), expectedSaved)) {
      throw new StaleBookingSettingsError();
    }
    const write = { booking: settings, updatedAt: serverTimestamp(), updatedBy: uid };
    if (snapshot.exists()) {
      transaction.update(FARE_DOC, write);
    } else {
      transaction.set(FARE_DOC, write);
    }
  });
}
