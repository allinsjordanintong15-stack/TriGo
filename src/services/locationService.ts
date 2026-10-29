import { MAP_DELTA } from '@/constants/map';
import { TRIGO_SERVICE_AREA } from '@/constants/serviceArea';
import {
  distanceFromServiceAreaCenterKm,
  findBarangayAt,
  getServiceAreaLabel,
  isWithinTrigoServiceArea,
} from '@/services/serviceAreaService';
import { reverseGeocodeWithOrs, searchPlacesWithOrs } from '@/services/geocodingService';
import { Location as AppLocation, LocationSearchResult } from '@/types';
import { searchBarangays } from '@/utils/barangaySearch';
import {
  formatLocationLabel,
  formatPinnedLocationLabel,
  getPlaceParts,
  PlaceParts,
} from '@/utils/formatLocationLabel';
import { PlaceCandidate, rankPlaceResults } from '@/utils/placeResults';
import * as Location from 'expo-location';

export class LocationServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocationServiceError';
  }
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

  if (existingStatus === Location.PermissionStatus.GRANTED) {
    return true;
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

export async function getCurrentCoordinates(): Promise<{
  latitude: number;
  longitude: number;
}> {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    throw new LocationServiceError(
      'Location permission is required. Please enable location access in your device settings.',
    );
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

/**
 * Readable label for a point, never a Plus Code. Tries the device geocoder's street,
 * place name and barangay first, then a nearby place from ORS, then "Pinned location".
 * Only the label comes from here; callers keep the exact coordinates.
 *
 * Inside the service area the town is always "Trinidad": geocoders' admin boundaries
 * disagree with the official one near the border (e.g. Bongbong labelled San Miguel).
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  let parts: PlaceParts | null = null;
  const serviceAreaTown = isWithinTrigoServiceArea(latitude, longitude)
    ? TRIGO_SERVICE_AREA.name
    : undefined;

  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });

    if (place) {
      const placeParts = getPlaceParts(place);
      parts = { ...placeParts, town: serviceAreaTown ?? placeParts.town };
      const label = formatLocationLabel(parts);
      if (label) {
        return label;
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[TriGo Geocode] device geocoder failed:', error);
    }
  }

  return (
    (await reverseGeocodeWithOrs(latitude, longitude, serviceAreaTown)) ??
    formatPinnedLocationLabel(parts)
  );
}

export async function resolveLocation(
  latitude: number,
  longitude: number,
): Promise<AppLocation> {
  const address = await reverseGeocode(latitude, longitude);
  return { latitude, longitude, address };
}

export async function getCurrentLocation(): Promise<AppLocation> {
  const coordinates = await getCurrentCoordinates();
  return resolveLocation(coordinates.latitude, coordinates.longitude);
}

const MAX_SEARCH_RESULTS = 5;
/** Place search (ORS or the phone geocoder) starts at this many characters. */
export const MIN_PLACE_SEARCH_LENGTH = 3;

/**
 * Phone geocoder places for the text. It returns coordinates only, so the results have no
 * names; their labels come from reverseGeocode.
 */
async function searchPlacesWithDevice(text: string): Promise<PlaceCandidate[]> {
  // With a Trinidad, Bohol hint first so local places win (unless the text already names
  // Trinidad), then without it so municipalities, cities and landmarks elsewhere are found.
  const queries = /\btrinidad\b/i.test(text)
    ? [`${text}, Philippines`]
    : [`${text}, ${getServiceAreaLabel()}, Philippines`, `${text}, Philippines`];
  const candidates: PlaceCandidate[] = [];

  for (const query of queries) {
    try {
      const results = await Location.geocodeAsync(query);
      for (const { latitude, longitude } of results) {
        candidates.push({ latitude, longitude, name: null, label: null });
      }
    } catch {
      // One failed geocode query should not discard results from the other.
    }
  }

  return candidates;
}

/**
 * Search places by text: ORS (biased toward Trinidad), or the phone geocoder when ORS is
 * unavailable or finds nothing. Places inside Trinidad, Bohol come first, labelled with their
 * barangay, then everything else by distance from Trinidad — nothing outside is filtered
 * out, so passengers can still pick destinations for out-of-area trips. Places duplicating
 * one of `barangayResults` are dropped. Text that exactly names a barangay is not sent to
 * any geocoder (the barangay suggestion covers it), which saves ORS quota.
 */
export async function searchLocations(
  searchText: string,
  barangayResults: readonly LocationSearchResult[] = [],
): Promise<LocationSearchResult[]> {
  const trimmed = searchText.trim();
  if (trimmed.length < MIN_PLACE_SEARCH_LENGTH || searchBarangays(trimmed)[0]?.match === 'exact') {
    return [];
  }

  const orsPlaces = await searchPlacesWithOrs(trimmed);
  let candidates = orsPlaces ?? [];

  if (candidates.length === 0) {
    // The phone geocoder needs location permission; ORS does not.
    const hasPermission = await requestLocationPermission();
    if (hasPermission) {
      candidates = await searchPlacesWithDevice(trimmed);
    } else if (orsPlaces === null) {
      throw new LocationServiceError(
        'Location permission is required to search places. Please enable location access.',
      );
    }
  }

  const ranked = rankPlaceResults(candidates, {
    isWithinServiceArea: isWithinTrigoServiceArea,
    findBarangayAt,
    distanceFromCenterKm: distanceFromServiceAreaCenterKm,
    barangayResults,
    max: MAX_SEARCH_RESULTS,
  });

  return Promise.all(
    ranked.map(async (place) => ({
      ...place,
      address: place.address ?? (await reverseGeocode(place.latitude, place.longitude)),
    })),
  );
}

export function toMapRegion(location: AppLocation) {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    ...MAP_DELTA,
  };
}

export function coordinatesAreEqual(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < 0.00001 &&
    Math.abs(a.longitude - b.longitude) < 0.00001
  );
}
