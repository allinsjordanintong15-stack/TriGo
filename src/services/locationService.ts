import { MAP_DELTA } from '@/constants/map';
import { Location as AppLocation } from '@/types';
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
