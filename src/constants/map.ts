/**
 * A map viewport as a centre plus the span it shows, in degrees.
 */
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Default map viewport — the Municipality of Trinidad, Bohol and its immediate neighbours
 * (map framing only — not used as booking data or as a service-area check).
 */
export const TRINIDAD_BOHOL_REGION = {
  latitude: 10.0468,
  longitude: 124.3189,
  latitudeDelta: 0.14,
  longitudeDelta: 0.2,
} as const;

export const MAP_DELTA = {
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
} as const;

/**
 * Free OpenStreetMap vector tiles from OpenFreeMap — no API key, account or billing.
 * https://openfreemap.org
 */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** Zoom level that shows roughly `longitudeDelta` degrees across the map. */
export function zoomForRegion(region: Pick<MapRegion, 'longitudeDelta'>): number {
  return Math.log2(360 / region.longitudeDelta);
}
