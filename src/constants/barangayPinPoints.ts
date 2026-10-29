// Pin location for a barangay search result. Relative imports (with ".ts" on value imports)
// on purpose, so plain Node tests, which resolve neither the "@/..." aliases nor extensionless
// paths, can load this file.

import { BARANGAY_BOUNDARIES } from './barangayBoundaries.ts';
import type { BoundaryBarangayId } from './barangays.ts';

/**
 * Hand-picked "barangay proper" points ([latitude, longitude], e.g. the barangay hall or
 * chapel), edited by hand. A barangay listed here uses this point instead of its computed
 * interior point. Empty until curated points are provided. tests/barangays checks that
 * every point is inside its own barangay, at least 100 m from the edge.
 */
export const CURATED_BARANGAY_PIN_POINTS: Partial<
  Record<BoundaryBarangayId, readonly [number, number]>
> = {};

/** Where the pin goes when a barangay search result is chosen: curated, else interior point. */
export function getBarangayPinPoint(id: BoundaryBarangayId): { latitude: number; longitude: number } {
  const point =
    CURATED_BARANGAY_PIN_POINTS[id] ?? BARANGAY_BOUNDARIES.find((area) => area.id === id)?.interiorPoint;
  if (!point) throw new Error(`Unknown barangay: ${id}`);

  const [latitude, longitude] = point;
  return { latitude, longitude };
}
