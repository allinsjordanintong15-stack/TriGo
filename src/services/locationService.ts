import { MAP_DELTA } from '@/constants/map';
import {
  distanceFromServiceAreaCenterKm,
  getServiceAreaLabel,
  isWithinTrigoServiceArea,
} from '@/services/serviceAreaService';
import { Location as AppLocation } from '@/types';
import { calculateDistanceKmFromCoords } from '@/utils/distance';
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

export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });

    if (results.length === 0) {
      return formatCoordinateAddress(latitude, longitude);
    }

    const place = results[0];
    const parts = [
      place.name,
      place.street,
      place.district,
      place.city,
      place.region,
    ].filter(Boolean);

    if (parts.length === 0) {
      return formatCoordinateAddress(latitude, longitude);
    }

    return parts.join(', ');
  } catch {
    return formatCoordinateAddress(latitude, longitude);
  }
}

export function formatCoordinateAddress(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
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

export interface LocationSearchResult extends AppLocation {
  withinServiceArea: boolean;
}

const MAX_SEARCH_RESULTS = 5;

/**
 * Search places by text. Results inside Trinidad, Bohol are ranked first, followed by
 * everything else ordered by distance from Trinidad — nothing outside is filtered out,
 * so passengers can still pick destinations for out-of-area trips.
 */
export async function searchLocations(searchText: string): Promise<LocationSearchResult[]> {
  const trimmed = searchText.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    throw new LocationServiceError(
      'Location permission is required to search places. Please enable location access.',
    );
  }

  // Query with a Trinidad, Bohol hint first so local places win, then without it so
  // municipalities, cities and landmarks elsewhere are still found.
  const queries = [`${trimmed}, ${getServiceAreaLabel()}, Philippines`, `${trimmed}, Philippines`];
  const candidates: { latitude: number; longitude: number }[] = [];

  for (const query of queries) {
    try {
      const results = await Location.geocodeAsync(query);
      for (const result of results) {
        const isDuplicate = candidates.some(
          (existing) =>
            calculateDistanceKmFromCoords(
              existing.latitude,
              existing.longitude,
              result.latitude,
              result.longitude,
            ) < 0.05,
        );
        if (!isDuplicate) {
          candidates.push({ latitude: result.latitude, longitude: result.longitude });
        }
      }
    } catch {
      // One failed geocode query should not discard results from the other.
    }
  }

  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      withinServiceArea: isWithinTrigoServiceArea(candidate.latitude, candidate.longitude),
      distanceKm: distanceFromServiceAreaCenterKm(candidate.latitude, candidate.longitude),
    }))
    .sort((a, b) => {
      if (a.withinServiceArea !== b.withinServiceArea) {
        return a.withinServiceArea ? -1 : 1;
      }
      return a.distanceKm - b.distanceKm;
    })
    .slice(0, MAX_SEARCH_RESULTS);

  return Promise.all(
    ranked.map(async ({ latitude, longitude, withinServiceArea }) => ({
      latitude,
      longitude,
      withinServiceArea,
      address: await reverseGeocode(latitude, longitude),
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
