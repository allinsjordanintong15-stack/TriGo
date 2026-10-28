// Fare rules (docs/DECISIONS.md, fare model 2026-10-11). Type-only imports on purpose, so
// plain Node tests (which cannot resolve the "@/..." aliases) can load this file.

import type { BoundaryBarangayId } from '../constants/barangays';
import type { FareSettings, VehicleType } from '../types';

export type FareBasis = 'per_km' | 'barangay_tariff';

/** One barangayTariffs/{barangayId} row as the app uses it. */
export interface BarangayTariffRow {
  tricycle: number;
  motorcycle: number;
  active: boolean;
}

/** Saved tariff rows by barangay ID; a barangay with no saved row is absent. */
export type BarangayTariffs = Readonly<Partial<Record<string, BarangayTariffRow>>>;

export interface FareQuoteInput {
  vehicleType: VehicleType;
  /** Road distance in km. */
  distanceKm: number;
  fareSettings: FareSettings;
  isOutOfArea: boolean;
  /** findBarangayAt() for each end; null when the point is in no barangay. */
  pickupBarangayId: BoundaryBarangayId | null;
  destinationBarangayId: BoundaryBarangayId | null;
  tariffs: BarangayTariffs;
}

export interface FareQuoteResult {
  fare: number;
  fareBasis: FareBasis;
  /** The non-Poblacion barangay whose tariff applied; null for per-km. */
  tariffBarangayId: string | null;
  /** The admin per-km rate used; null for a barangay tariff. */
  perKmRate: number | null;
}

const POBLACION: BoundaryBarangayId = 'poblacion';

/** Admin per-km fare: base fare + rate x road distance, kept to the centavo. */
export function calculatePerKmFare(
  vehicleType: VehicleType,
  distanceKm: number,
  settings: FareSettings,
): number {
  const config = settings[vehicleType];
  const fare = config.baseFare + config.perKm * distanceKm;
  return Math.round(fare * 100) / 100;
}

/**
 * Poblacion <-> any point in barangay X (either direction) is X's active tariff for the
 * vehicle type. Everything else is the per-km fare: out-of-area trips, barangay <->
 * barangay, trips within Poblacion or within one barangay, an end in no barangay, and a
 * barangay with no tariff or an inactive one.
 */
export function quoteFare(input: FareQuoteInput): FareQuoteResult {
  const { vehicleType, distanceKm, fareSettings, isOutOfArea, pickupBarangayId, destinationBarangayId } =
    input;

  const otherEnd =
    pickupBarangayId === POBLACION
      ? destinationBarangayId
      : destinationBarangayId === POBLACION
        ? pickupBarangayId
        : null;

  if (!isOutOfArea && otherEnd !== null && otherEnd !== POBLACION) {
    const tariff = input.tariffs[otherEnd];
    if (tariff?.active) {
      return {
        fare: tariff[vehicleType],
        fareBasis: 'barangay_tariff',
        tariffBarangayId: otherEnd,
        perKmRate: null,
      };
    }
  }

  return {
    fare: calculatePerKmFare(vehicleType, distanceKm, fareSettings),
    fareBasis: 'per_km',
    tariffBarangayId: null,
    perKmRate: fareSettings[vehicleType].perKm,
  };
}
