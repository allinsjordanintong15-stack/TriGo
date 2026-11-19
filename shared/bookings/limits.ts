// Limits on what a passenger may book (security batch A, 2026-11-19; docs/review/
// SECURITY_AUDIT.md SEC-01, SEC-02, SEC-06, SEC-08). firestore.rules enforces the same
// numbers (tests/booking/bookingLimitsSync.test.ts fails if they differ); the app checks
// them first so a passenger sees a clear message instead of a refused write. No imports, so
// plain Node tests, Metro and Vite can all load it.

/** Highest fare the rules accept, in pesos (any booking or out-of-area request). */
export const MAX_FARE_PESOS = 20000;

/** Longest trip the rules accept, in km of road distance. */
export const MAX_DISTANCE_KM = 300;

/** Longest pickup or destination address text, in characters. */
export const MAX_ADDRESS_LENGTH = 200;

/**
 * Straight-line distance, equirectangular approximation at Trinidad's latitude (~10°):
 * one degree of longitude ≈ 109.6 km, one degree of latitude ≈ 110.6 km.
 */
export const KM_PER_DEGREE_LONGITUDE = 109.6;
export const KM_PER_DEGREE_LATITUDE = 110.6;

/**
 * A road distance is plausible when it is at least 0.9 × the straight line (rounding and the
 * approximation) and at most 4 × the straight line + 2 km (winding roads, short trips).
 */
export const MIN_ROAD_FACTOR = 0.9;
export const MAX_ROAD_FACTOR = 4;
export const ROAD_SLACK_KM = 2;

export interface Bounds {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

/**
 * Generous box around Bohol (incl. Panglao, Anda and the northern islands; excludes Cebu City):
 * both ends of a standard (in-area) booking must be inside.
 */
export const BOHOL_BOUNDS: Bounds = { minLatitude: 9.4, maxLatitude: 10.25, minLongitude: 123.6, maxLongitude: 124.7 };

/** Box around the Philippines: both ends of an out-of-area request must be inside. */
export const PHILIPPINES_BOUNDS: Bounds = {
  minLatitude: 4.0,
  maxLatitude: 21.5,
  minLongitude: 116.0,
  maxLongitude: 127.0,
};

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Approximate straight-line distance in km (same formula as firestore.rules). */
export function straightLineKm(a: LatLng, b: LatLng): number {
  const dx = (b.longitude - a.longitude) * KM_PER_DEGREE_LONGITUDE;
  const dy = (b.latitude - a.latitude) * KM_PER_DEGREE_LATITUDE;
  return Math.sqrt(dx * dx + dy * dy);
}

/** True when the road distance is above 0, at most MAX_DISTANCE_KM and plausible for the two points. */
export function isPlausibleDistance(distanceKm: number, a: LatLng, b: LatLng): boolean {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > MAX_DISTANCE_KM) return false;
  const straight = straightLineKm(a, b);
  return distanceKm >= MIN_ROAD_FACTOR * straight && distanceKm <= MAX_ROAD_FACTOR * straight + ROAD_SLACK_KM;
}

export function isWithinBounds(point: LatLng, bounds: Bounds): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= bounds.minLatitude &&
    point.latitude <= bounds.maxLatitude &&
    point.longitude >= bounds.minLongitude &&
    point.longitude <= bounds.maxLongitude
  );
}

/** A fare the rules accept: finite, above 0, at most MAX_FARE_PESOS, whole centavos. */
export function isValidFareAmount(fare: number): boolean {
  return (
    Number.isFinite(fare) &&
    fare > 0 &&
    fare <= MAX_FARE_PESOS &&
    Math.abs(fare * 100 - Math.round(fare * 100)) < 0.000001
  );
}

/** The location fields stored on a booking or request: exactly these three, address capped. */
export function toStoredLocation(location: LatLng & { address: string }): LatLng & { address: string } {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    address: location.address.slice(0, MAX_ADDRESS_LENGTH),
  };
}
