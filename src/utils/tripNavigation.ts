// Turn-by-turn navigation for the driver's active trip, handed off to Google Maps.
// Alias-free and type-only imports on purpose, so plain Node tests can load this file.

import type { BookingStatus, Location } from '../types';

export type NavigationTarget = 'pickup' | 'destination';

/**
 * Where the driver should head: the pickup until the trip starts (accepted, arrived),
 * the destination once it is in progress, nothing for pending or finished bookings.
 */
export function navigationTarget(status: BookingStatus): NavigationTarget | null {
  if (status === 'accepted' || status === 'arrived') return 'pickup';
  if (status === 'in_progress') return 'destination';
  return null;
}

/**
 * Google Maps directions from the phone's current position to `point` (Maps Universal
 * URL: opens the Google Maps app when installed, else the browser).
 */
export function googleMapsDirectionsUrl(point: Pick<Location, 'latitude' | 'longitude'>): string {
  const destination = `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

/** Statuses during which the driver's phone is kept awake on the Trip screen. */
export function isActiveTripStatus(status: BookingStatus): boolean {
  return status === 'accepted' || status === 'arrived' || status === 'in_progress';
}
