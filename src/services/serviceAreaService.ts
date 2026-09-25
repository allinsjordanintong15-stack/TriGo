import { TRIGO_SERVICE_AREA } from '@/constants/serviceArea';
import { Location } from '@/types';
import { calculateDistanceKmFromCoords } from '@/utils/distance';

type LatLng = readonly [number, number];

const METERS_PER_DEGREE_LAT = 111_320;

/** Ray-casting point-in-polygon test on [latitude, longitude] vertices. */
function isInsidePolygon(latitude: number, longitude: number, ring: readonly LatLng[]): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lonI] = ring[i];
    const [latJ, lonJ] = ring[j];

    const crosses =
      latI > latitude !== latJ > latitude &&
      longitude < ((lonJ - lonI) * (latitude - latI)) / (latJ - latI) + lonI;

    if (crosses) inside = !inside;
  }

  return inside;
}

/** Shortest distance in metres from a point to the polygon edge (local planar approximation). */
function distanceToPolygonEdgeMeters(
  latitude: number,
  longitude: number,
  ring: readonly LatLng[],
): number {
  const metersPerDegreeLon = METERS_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180);
  const toXY = ([lat, lon]: LatLng) => ({
    x: (lon - longitude) * metersPerDegreeLon,
    y: (lat - latitude) * METERS_PER_DEGREE_LAT,
  });

  let minDistance = Infinity;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = toXY(ring[j]);
    const b = toXY(ring[i]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t =
      lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared));
    const distance = Math.hypot(a.x + t * dx, a.y + t * dy);

    if (distance < minDistance) minDistance = distance;
  }

  return minDistance;
}

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

/** Service-area boundary in react-native-maps coordinate format. */
export function getServiceAreaBoundaryCoordinates(): { latitude: number; longitude: number }[] {
  return TRIGO_SERVICE_AREA.boundary.map(([latitude, longitude]) => ({ latitude, longitude }));
}

export function getServiceAreaLabel(): string {
  return `${TRIGO_SERVICE_AREA.name}, ${TRIGO_SERVICE_AREA.province}`;
}
