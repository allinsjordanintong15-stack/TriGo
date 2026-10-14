import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { db } from '../firebase/config';

// fareSettings/active, read by the mobile app (src/services/fareService.ts) and written here.
// firestore.rules only accepts a complete `fares` object and leaves `outOfArea` untouched
// (that is saved on the System settings page, admin/src/settings/outOfAreaSettings.ts).
const FARE_DOC = doc(db, 'fareSettings', 'active');

export const VEHICLE_TYPES = ['tricycle', 'motorcycle'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  tricycle: 'Tricycle',
  motorcycle: 'Motorcycle',
};

export type VehicleFare = { baseFare: number; perKm: number };
export type Fares = Record<VehicleType, VehicleFare>;

/** Mirrors DEFAULT_FARE_SETTINGS in src/constants/index.ts: what the app uses when no document exists. */
export const APP_DEFAULT_FARES: Fares = {
  tricycle: { baseFare: 15, perKm: 8 },
  motorcycle: { baseFare: 10, perKm: 6 },
};

export type LoadedFares = {
  /** The fares the app uses now (saved values merged over the app defaults, like the app does). */
  fares: Fares;
  /** Exactly what is saved in Firestore, or null when the document or its fares are missing. */
  saved: Fares | null;
  updatedAt: Date | null;
};

function readVehicleFare(value: unknown): VehicleFare | null {
  const fare = value as Partial<VehicleFare> | undefined;
  if (fare && typeof fare.baseFare === 'number' && typeof fare.perKm === 'number') {
    return { baseFare: fare.baseFare, perKm: fare.perKm };
  }
  return null;
}

function readSavedFares(value: unknown): Fares | null {
  const fares = value as Partial<Record<VehicleType, unknown>> | undefined;
  const tricycle = readVehicleFare(fares?.tricycle);
  const motorcycle = readVehicleFare(fares?.motorcycle);
  return tricycle && motorcycle ? { tricycle, motorcycle } : null;
}

export async function loadFares(): Promise<LoadedFares> {
  const snapshot = await getDoc(FARE_DOC);
  const data = snapshot.data();
  const rawFares = (data?.fares ?? {}) as Partial<Record<VehicleType, unknown>>;
  const fares: Fares = {
    tricycle: readVehicleFare(rawFares.tricycle) ?? APP_DEFAULT_FARES.tricycle,
    motorcycle: readVehicleFare(rawFares.motorcycle) ?? APP_DEFAULT_FARES.motorcycle,
  };
  const updatedAt = data?.updatedAt?.toDate?.() ?? null;
  return { fares, saved: readSavedFares(data?.fares), updatedAt };
}

export function faresEqual(a: Fares | null, b: Fares | null): boolean {
  if (!a || !b) return a === b;
  return VEHICLE_TYPES.every(
    (type) => a[type].baseFare === b[type].baseFare && a[type].perKm === b[type].perKm,
  );
}

export class StaleFaresError extends Error {
  constructor() {
    super('Fare settings were changed by someone else. Reload the page and try again.');
  }
}

/**
 * Writes the whole `fares` object. Fails with StaleFaresError when the saved fares are no
 * longer the ones the admin confirmed against (`expectedSaved`).
 */
export async function saveFares(fares: Fares, expectedSaved: Fares | null, uid: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(FARE_DOC);
    if (!faresEqual(readSavedFares(snapshot.data()?.fares), expectedSaved)) {
      throw new StaleFaresError();
    }
    const write = { fares, updatedAt: serverTimestamp(), updatedBy: uid };
    if (snapshot.exists()) {
      transaction.update(FARE_DOC, write);
    } else {
      transaction.set(FARE_DOC, write);
    }
  });
}

/** Same formula and rounding as calculateEstimatedFare in src/services/fareService.ts. */
export function calculateFare(fare: VehicleFare, distanceKm: number): number {
  return Math.round((fare.baseFare + fare.perKm * distanceKm) * 100) / 100;
}

export function formatPeso(amount: number): string {
  return `₱${amount.toFixed(2)}`;
}

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Parses a peso amount with at most 2 decimals, or returns an error message. */
export function parseAmount(
  input: string,
  options: { allowZero: boolean },
): { value: number } | { error: string } {
  const text = input.trim();
  if (!text) return { error: 'Required.' };
  if (!AMOUNT_PATTERN.test(text)) {
    return { error: 'Enter a number with at most 2 decimal places (e.g. 8 or 8.50).' };
  }
  const value = Number(text);
  if (options.allowZero ? value < 0 : value <= 0) {
    return { error: options.allowZero ? 'Must be 0 or more.' : 'Must be more than 0.' };
  }
  return { value };
}
