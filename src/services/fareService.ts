import { DEFAULT_FARE_SETTINGS } from '@/constants';
import { OUT_OF_AREA_FARE_SETTINGS } from '@/constants/outOfAreaFareSettings';
import { COLLECTIONS, firestore } from '@/firebase';
import {
  FareSettings,
  OutOfAreaFareSettings,
  VehicleType,
} from '@/types';
import { doc, getDoc } from 'firebase/firestore';

export function calculateEstimatedFare(
  vehicleType: VehicleType,
  distanceKm: number,
  settings: FareSettings = DEFAULT_FARE_SETTINGS,
): number {
  const config = settings[vehicleType];
  const fare = config.baseFare + config.perKm * distanceKm;
  return Math.round(fare * 100) / 100;
}

/**
 * Active fare configuration document id in the `fareSettings` collection.
 * Administrators manage this document (via the future admin system); the
 * passenger app only reads it. Falls back to the in-code defaults when the
 * document is missing or unreadable so the app still works in development.
 */
export const ACTIVE_FARE_CONFIG_DOC = 'active';

export interface TriGoFareConfig {
  fares: FareSettings;
  outOfArea: OutOfAreaFareSettings;
}

/**
 * Reads the active fare configuration from Firestore.
 * Returns the in-code defaults when the document is missing or on any error,
 * ensuring existing/ongoing bookings and the booking flow keep working.
 */
export async function fetchFareConfig(): Promise<TriGoFareConfig> {
  try {
    const snapshot = await getDoc(
      doc(firestore, COLLECTIONS.fareSettings, ACTIVE_FARE_CONFIG_DOC),
    );

    if (!snapshot.exists()) {
      return {
        fares: DEFAULT_FARE_SETTINGS,
        outOfArea: OUT_OF_AREA_FARE_SETTINGS,
      };
    }

    const data = snapshot.data() as Partial<TriGoFareConfig>;

    return {
      fares: {
        ...DEFAULT_FARE_SETTINGS,
        ...(data.fares ?? {}),
      },
      outOfArea: {
        ...OUT_OF_AREA_FARE_SETTINGS,
        ...(data.outOfArea ?? {}),
      },
    };
  } catch {
    return {
      fares: DEFAULT_FARE_SETTINGS,
      outOfArea: OUT_OF_AREA_FARE_SETTINGS,
    };
  }
}
