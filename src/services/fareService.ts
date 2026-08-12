import { DEFAULT_FARE_SETTINGS } from '@/constants';
import { FareSettings, VehicleType } from '@/types';

export function calculateEstimatedFare(
  vehicleType: VehicleType,
  distanceKm: number,
  settings: FareSettings = DEFAULT_FARE_SETTINGS,
): number {
  const config = settings[vehicleType];
  const fare = config.baseFare + config.perKm * distanceKm;
  return Math.round(fare * 100) / 100;
}

export function getFareSettings(): FareSettings {
  return DEFAULT_FARE_SETTINGS;
}
