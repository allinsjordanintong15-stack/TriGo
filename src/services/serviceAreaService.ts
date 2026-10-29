import { BARANGAY_BOUNDARIES } from '@/constants/barangayBoundaries';
import { BoundaryBarangayId } from '@/constants/barangays';
import { TRIGO_SERVICE_AREA } from '@/constants/serviceArea';
import { Location } from '@/types';
import { calculateDistanceKmFromCoords } from '@/utils/distance';
import { distanceToPolygonEdgeMeters, findAreaContaining, isInsidePolygon } from '@/utils/polygon';

/**
 * True when the coordinate lies inside the Trinidad, Bohol municipal boundary
 * (or within the configured edge tolerance of it).
 */
export function isWithinTrigoServiceArea(latitude: number, longitude: number): boolean {
  const { boundary, edgeToleranceMeters } = TRIGO_SERVICE_AREA;

  if (isInsidePolygon(latitude, longitude, boundary)) {
    return true;
  }

  return distanceToPolygonEdgeMeters(latitude, longitude, boundary) <= edgeToleranceMeters;
}

export function isLocationWithinServiceArea(location: Location): boolean {
  return isWithinTrigoServiceArea(location.latitude, location.longitude);
}

export interface TripServiceAreaStatus {
  pickupOutside: boolean;
  destinationOutside: boolean;
  isOutOfArea: boolean;
}

export function getTripServiceAreaStatus(
  pickupLocation: Location,
  destinationLocation: Location,
): TripServiceAreaStatus {
  const pickupOutside = !isLocationWithinServiceArea(pickupLocation);
  const destinationOutside = !isLocationWithinServiceArea(destinationLocation);

  return {
    pickupOutside,
    destinationOutside,
    isOutOfArea: pickupOutside || destinationOutside,
  };
}

/**
 * A trip is out-of-area when the pickup or the destination lies outside the
 * Trinidad, Bohol service area.
 */
export function isOutOfAreaTrip(pickupLocation: Location, destinationLocation: Location): boolean {
  return getTripServiceAreaStatus(pickupLocation, destinationLocation).isOutOfArea;
}

export function isWithinServiceArea(location: Location): boolean {
  return isLocationWithinServiceArea(location);
}

/** Straight-line distance from the Trinidad poblacion, used to rank search results. */
export function distanceFromServiceAreaCenterKm(latitude: number, longitude: number): number {
  return calculateDistanceKmFromCoords(
    TRIGO_SERVICE_AREA.center.latitude,
    TRIGO_SERVICE_AREA.center.longitude,
    latitude,
    longitude,
  );
}

/** Service-area boundary as latitude/longitude points. */
export function getServiceAreaBoundaryCoordinates(): { latitude: number; longitude: number }[] {
  return TRIGO_SERVICE_AREA.boundary.map(([latitude, longitude]) => ({ latitude, longitude }));
}

/**
 * Barangay of Trinidad containing the coordinate ('poblacion' or a barangayTariffs ID), using
 * the PSA barangay boundaries. A point within the service-area edge tolerance of a barangay
 * counts as in the nearest one. Null outside Trinidad. Used for barangay tariff fares.
 */
export function findBarangayAt(latitude: number, longitude: number): BoundaryBarangayId | null {
  return findAreaContaining(
    latitude,
    longitude,
    BARANGAY_BOUNDARIES,
    TRIGO_SERVICE_AREA.edgeToleranceMeters,
  );
}

export function getServiceAreaLabel(): string {
  return `${TRIGO_SERVICE_AREA.name}, ${TRIGO_SERVICE_AREA.province}`;
}
