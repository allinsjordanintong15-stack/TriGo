import { TRIGO_SERVICE_AREA } from '@/constants/serviceArea';
import { Location } from '@/types';
import { calculateDistanceKmFromCoords } from '@/utils/distance';

export function isWithinTrigoServiceArea(latitude: number, longitude: number): boolean {
  const distanceFromCenter = calculateDistanceKmFromCoords(
    TRIGO_SERVICE_AREA.center.latitude,
    TRIGO_SERVICE_AREA.center.longitude,
    latitude,
    longitude,
  );

  return distanceFromCenter <= TRIGO_SERVICE_AREA.radiusKm;
}

export function isLocationWithinServiceArea(location: Location): boolean {
  return isWithinTrigoServiceArea(location.latitude, location.longitude);
}

/**
 * A trip is out-of-area when the destination lies outside the standard TriGo service area.
 */
export function isOutOfAreaTrip(
  _pickupLocation: Location,
  destinationLocation: Location,
): boolean {
  return !isLocationWithinServiceArea(destinationLocation);
}

export function isWithinServiceArea(location: Location): boolean {
  return isLocationWithinServiceArea(location);
}

export function getServiceAreaLabel(): string {
  return `${TRIGO_SERVICE_AREA.name}, ${TRIGO_SERVICE_AREA.province}`;
}
