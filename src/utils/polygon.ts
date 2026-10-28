// Polygon helpers on [latitude, longitude] rings. No imports on purpose, so plain Node tests
// (which cannot resolve the "@/..." aliases) can load this file.

export type LatLng = readonly [number, number];

const METERS_PER_DEGREE_LAT = 111_320;

/** Ray-casting point-in-polygon test on [latitude, longitude] vertices. */
export function isInsidePolygon(latitude: number, longitude: number, ring: readonly LatLng[]): boolean {
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
export function distanceToPolygonEdgeMeters(
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
 * ID of the area containing the point. If none contains it, the nearest area whose edge is
 * within toleranceMeters (pins on a border road); otherwise null.
 */
export function findAreaContaining<Id extends string>(
  latitude: number,
  longitude: number,
  areas: readonly { id: Id; boundary: readonly LatLng[] }[],
  toleranceMeters: number,
): Id | null {
  for (const area of areas) {
    if (isInsidePolygon(latitude, longitude, area.boundary)) return area.id;
  }

  let nearest: Id | null = null;
  let nearestDistance = toleranceMeters;

  for (const area of areas) {
    const distance = distanceToPolygonEdgeMeters(latitude, longitude, area.boundary);
    if (distance <= nearestDistance) {
      nearest = area.id;
      nearestDistance = distance;
    }
  }

  return nearest;
}
