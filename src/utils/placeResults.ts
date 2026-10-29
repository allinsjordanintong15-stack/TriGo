// Ranking and labels for geocoder place results in the pickup/destination search. Relative
// imports (with ".ts" on value imports) on purpose, so plain Node tests, which resolve neither
// the "@/..." aliases nor extensionless paths, can load this file. The service-area and
// barangay lookups are passed in for the same reason.

import { BARANGAYS, POBLACION_ID, type BoundaryBarangayId } from '../constants/barangays.ts';
import { TRIGO_SERVICE_AREA } from '../constants/serviceArea.ts';
import type { LocationSearchResult } from '../types';
import { normalizeSearchText } from './barangaySearch.ts';

/** A place from ORS or the phone geocoder, before ranking. */
export interface PlaceCandidate {
  latitude: number;
  longitude: number;
  /** Place name, e.g. "Trinidad Catholic Cemetery". Null from the phone geocoder. */
  name: string | null;
  /** Full label for places outside Trinidad, e.g. "Tagbilaran City, BO, Philippines". */
  label: string | null;
}

/** A ranked place; `address` is null when the caller must reverse geocode a label. */
export type RankedPlace = Omit<LocationSearchResult, 'address'> & { address: string | null };

export interface RankPlacesOptions {
  isWithinServiceArea: (latitude: number, longitude: number) => boolean;
  findBarangayAt: (latitude: number, longitude: number) => BoundaryBarangayId | null;
  distanceFromCenterKm: (latitude: number, longitude: number) => number;
  /** The barangay suggestions already shown; places duplicating them are dropped. */
  barangayResults: readonly LocationSearchResult[];
  max: number;
}

/** Places this close together are one place. */
const DUPLICATE_DISTANCE_M = 50;
const METERS_PER_DEGREE_LAT = 111_320;

const BARANGAY_NAMES: Record<BoundaryBarangayId, string> = Object.fromEntries([
  [POBLACION_ID, 'Poblacion'],
  ...BARANGAYS.map(({ id, name }) => [id, name]),
]) as Record<BoundaryBarangayId, string>;

/** Short-range distance in metres (planar approximation; only used under ~100 m). */
function metersBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const metersPerDegreeLon = METERS_PER_DEGREE_LAT * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(
    (a.latitude - b.latitude) * METERS_PER_DEGREE_LAT,
    (a.longitude - b.longitude) * metersPerDegreeLon,
  );
}

/** Same name ignoring case, punctuation, spaces and "brgy": "Brgy. Kinanoan" = "Kinan-oan". */
function isSameName(a: string, b: string): boolean {
  const compact = (text: string) => normalizeSearchText(text).replace(/ /g, '');
  return compact(a) === compact(b);
}

/**
 * "Trinidad Catholic Cemetery · Poblacion" inside Trinidad (or "<name> · Trinidad" when the
 * name is the barangay itself); the full label outside. Null when there is no name.
 */
export function formatPlaceLabel(
  candidate: PlaceCandidate,
  barangayId: BoundaryBarangayId | null,
): string | null {
  const name = candidate.name?.trim();

  if (!barangayId) return candidate.label?.trim() || name || null;
  if (!name) return null;

  const barangayName = BARANGAY_NAMES[barangayId];
  return `${name} · ${isSameName(name, barangayName) ? TRIGO_SERVICE_AREA.name : barangayName}`;
}

/** True when the place is a barangay already suggested: next to its pin, or named after it. */
function duplicatesBarangay(
  candidate: PlaceCandidate,
  barangayId: BoundaryBarangayId | null,
  barangayResults: readonly LocationSearchResult[],
): boolean {
  return barangayResults.some(
    (result) =>
      metersBetween(candidate, result) < DUPLICATE_DISTANCE_M ||
      (candidate.name !== null &&
        barangayId !== null &&
        result.barangayId === barangayId &&
        isSameName(candidate.name, BARANGAY_NAMES[barangayId])),
  );
}

/**
 * Places for the search list: duplicates (of each other or of a barangay suggestion) removed,
 * places inside Trinidad first in the geocoder's own order, then the rest by distance from
 * Trinidad. Nothing outside is filtered out, so out-of-area destinations stay possible.
 */
export function rankPlaceResults(
  candidates: readonly PlaceCandidate[],
  options: RankPlacesOptions,
): RankedPlace[] {
  const unique: PlaceCandidate[] = [];
  for (const candidate of candidates) {
    if (!unique.some((existing) => metersBetween(existing, candidate) < DUPLICATE_DISTANCE_M)) {
      unique.push(candidate);
    }
  }

  const places = unique
    .map((candidate, order) => {
      const { latitude, longitude } = candidate;
      const withinServiceArea = options.isWithinServiceArea(latitude, longitude);
      const barangayId = withinServiceArea ? options.findBarangayAt(latitude, longitude) : null;
      return {
        candidate,
        order,
        barangayId,
        withinServiceArea,
        distanceKm: options.distanceFromCenterKm(latitude, longitude),
      };
    })
    .filter(({ candidate, barangayId }) =>
      !duplicatesBarangay(candidate, barangayId, options.barangayResults),
    );

  places.sort((a, b) => {
    if (a.withinServiceArea !== b.withinServiceArea) return a.withinServiceArea ? -1 : 1;
    return a.withinServiceArea ? a.order - b.order : a.distanceKm - b.distanceKm;
  });

  return places.slice(0, options.max).map(({ candidate, barangayId, withinServiceArea }) => ({
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    address: formatPlaceLabel(candidate, barangayId),
    kind: 'place',
    // Barangay suggestions only; a place's barangay is in its label.
    barangayId: null,
    withinServiceArea,
  }));
}
