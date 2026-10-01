const PLUS_CODE_CHARS = '[23456789CFGHJMPQRVWX]';

// Open Location Code ("28VG+H24"), which geocoders often return in place of a name.
const PLUS_CODE_PATTERN = new RegExp(`^${PLUS_CODE_CHARS}{4,8}\\+${PLUS_CODE_CHARS}{0,3}$`, 'i');
// A Plus Code at the start of a longer string ("28VG+H24, Trinidad, Bohol").
const LEADING_PLUS_CODE_PATTERN = new RegExp(
  `^${PLUS_CODE_CHARS}{4,8}\\+${PLUS_CODE_CHARS}{0,3}(?:[\\s,]+|$)`,
  'i',
);

const PINNED_LOCATION = 'Pinned location';

export function isPlusCode(value: string): boolean {
  return PLUS_CODE_PATTERN.test(value.trim());
}

/** Trimmed text without a leading Plus Code, or null when nothing readable is left. */
export function readableAddressPart(value: string | null | undefined): string | null {
  const part = value?.trim().replace(LEADING_PLUS_CODE_PATTERN, '').trim();
  return part && !isPlusCode(part) ? part : null;
}

/** The address fields used for labels (matches expo-location's reverse geocode result). */
export interface GeocodedPlace {
  name?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  district?: string | null;
  subregion?: string | null;
  city?: string | null;
}

export interface PlaceParts {
  /** Place name or street, e.g. "Purok 3". */
  place: string | null;
  /** Barangay, e.g. "Poblacion". */
  barangay: string | null;
  /** Town or city, e.g. "Trinidad". */
  town: string | null;
}

export function getPlaceParts(place: GeocodedPlace): PlaceParts {
  const barangay = readableAddressPart(place.district);
  const town = readableAddressPart(place.city) ?? readableAddressPart(place.subregion);
  const name = readableAddressPart(place.name);
  // Android often returns the house number, barangay or town as the "name" (sometimes
  // after a Plus Code); none of those is a place name, so prefer the street then.
  const notPlaceNames = [place.streetNumber, barangay, town].map((part) =>
    readableAddressPart(part)?.toLowerCase(),
  );
  const usefulName = name && !notPlaceNames.includes(name.toLowerCase()) ? name : null;

  return {
    place: usefulName ?? readableAddressPart(place.street),
    barangay,
    town,
  };
}

/** Joins the parts that are present, skipping repeats (e.g. a name that is just the town). */
function joinParts(parts: (string | null)[]): string {
  const seen = new Set<string>();
  return parts
    .filter((part): part is string => {
      if (!part || seen.has(part.toLowerCase())) return false;
      seen.add(part.toLowerCase());
      return true;
    })
    .join(', ');
}

/**
 * "<place or street>, <barangay>, <town>", e.g. "Purok 3, Poblacion, Trinidad".
 * Null when there is neither a place/street nor a barangay to show.
 */
export function formatLocationLabel(parts: PlaceParts): string | null {
  if (!parts.place && !parts.barangay) {
    return null;
  }
  return joinParts([parts.place, parts.barangay, parts.town]);
}

/** "Near <name>, <locality>", e.g. "Near Kinan-oan, Trinidad". Null without a name. */
export function formatNearbyLabel(
  name: string | null | undefined,
  locality: string | null | undefined,
): string | null {
  const place = readableAddressPart(name);
  if (!place) {
    return null;
  }
  return `Near ${joinParts([place, readableAddressPart(locality)])}`;
}

/** Last resort: "Pinned location", plus the barangay or town when known. */
export function formatPinnedLocationLabel(parts: PlaceParts | null): string {
  const area = parts?.barangay ?? parts?.town;
  return area ? `${PINNED_LOCATION}, ${area}` : PINNED_LOCATION;
}
