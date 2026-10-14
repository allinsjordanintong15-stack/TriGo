import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { db } from '../firebase/config';

// fareSettings/active.outOfArea, read by the mobile app (src/services/fareService.ts) and
// written here. firestore.rules accepts only the complete object and leaves `fares` alone.
const FARE_DOC = doc(db, 'fareSettings', 'active');

export type OutOfAreaSettings = {
  enabled: boolean;
  requestExpiryMinutes: number;
  driverSearchRadiusKm: number;
};

/** Mirrors OUT_OF_AREA_FARE_SETTINGS in src/constants/outOfAreaFareSettings.ts: what the app uses when nothing is saved. */
export const APP_DEFAULT_OUT_OF_AREA: OutOfAreaSettings = {
  enabled: true,
  requestExpiryMinutes: 30,
  driverSearchRadiusKm: 15,
};

/** Same limits as firestore.rules (whole numbers). */
export const EXPIRY_RANGE = { min: 1, max: 30 } as const;
export const RADIUS_RANGE = { min: 1, max: 50 } as const;

export type LoadedOutOfArea = {
  /** The settings the app uses now (saved values merged over the app defaults, like the app does). */
  settings: OutOfAreaSettings;
  /** Exactly what is saved in Firestore, or null when the document or its outOfArea is missing. */
  saved: OutOfAreaSettings | null;
  updatedAt: Date | null;
};

function readSaved(value: unknown): OutOfAreaSettings | null {
  const data = value as Partial<OutOfAreaSettings> | undefined;
  if (
    data &&
    typeof data.enabled === 'boolean' &&
    typeof data.requestExpiryMinutes === 'number' &&
    typeof data.driverSearchRadiusKm === 'number'
  ) {
    return {
      enabled: data.enabled,
      requestExpiryMinutes: data.requestExpiryMinutes,
      driverSearchRadiusKm: data.driverSearchRadiusKm,
    };
  }
  return null;
}

export async function loadOutOfArea(): Promise<LoadedOutOfArea> {
  const snapshot = await getDoc(FARE_DOC);
  const data = snapshot.data();
  const raw = (data?.outOfArea ?? {}) as Partial<OutOfAreaSettings>;
  return {
    settings: { ...APP_DEFAULT_OUT_OF_AREA, ...raw },
    saved: readSaved(data?.outOfArea),
    updatedAt: data?.updatedAt?.toDate?.() ?? null,
  };
}

export function outOfAreaEqual(a: OutOfAreaSettings | null, b: OutOfAreaSettings | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.enabled === b.enabled &&
    a.requestExpiryMinutes === b.requestExpiryMinutes &&
    a.driverSearchRadiusKm === b.driverSearchRadiusKm
  );
}

export class StaleOutOfAreaError extends Error {
  constructor() {
    super('Out-of-area settings were changed by someone else. Reload the page and try again.');
  }
}

/**
 * Writes the whole `outOfArea` object. Fails with StaleOutOfAreaError when the saved
 * settings are no longer the ones the admin confirmed against (`expectedSaved`).
 */
export async function saveOutOfArea(
  settings: OutOfAreaSettings,
  expectedSaved: OutOfAreaSettings | null,
  uid: string,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(FARE_DOC);
    if (!outOfAreaEqual(readSaved(snapshot.data()?.outOfArea), expectedSaved)) {
      throw new StaleOutOfAreaError();
    }
    const write = { outOfArea: settings, updatedAt: serverTimestamp(), updatedBy: uid };
    if (snapshot.exists()) {
      transaction.update(FARE_DOC, write);
    } else {
      transaction.set(FARE_DOC, write);
    }
  });
}

/** Parses a whole number within [min, max], or returns an error message. */
export function parseWholeNumber(
  input: string,
  range: { min: number; max: number },
  unit: string,
): { value: number } | { error: string } {
  const text = input.trim();
  if (!text) return { error: 'Required.' };
  if (!/^\d+$/.test(text)) return { error: `Enter a whole number of ${unit}.` };
  const value = Number(text);
  if (value < range.min || value > range.max) {
    return { error: `Must be ${range.min} to ${range.max} ${unit}.` };
  }
  return { value };
}
