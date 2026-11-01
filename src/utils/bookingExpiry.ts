// Standard booking expiry. Relative, type-only imports on purpose, so plain Node tests,
// which resolve neither the "@/..." aliases nor extensionless paths, can load this file.

import type { BookingSettings, BookingStatus, BookingType } from '../types';

/** Used when fareSettings/active has no `booking` (admins set 1-30 minutes). */
export const DEFAULT_BOOKING_EXPIRY_MINUTES = 10;

/**
 * Longest booking lifetime the app writes. firestore.rules accepts expiresAt up to
 * 35 minutes after the server time (this cap + 5 minutes of client clock-skew grace).
 */
export const MAX_BOOKING_EXPIRY_MINUTES = 30;

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  requestExpiryMinutes: DEFAULT_BOOKING_EXPIRY_MINUTES,
};

/** The minutes a new booking stays open: whole minutes in 1-30, else the default. */
export function bookingExpiryMinutes(setting: unknown): number {
  if (typeof setting !== 'number' || !Number.isInteger(setting) || setting < 1) {
    return DEFAULT_BOOKING_EXPIRY_MINUTES;
  }
  return Math.min(setting, MAX_BOOKING_EXPIRY_MINUTES);
}

/** The fields of a Booking the expiry depends on. */
export interface BookingExpiryFields {
  bookingType: BookingType;
  status: BookingStatus;
  expiresAt: Date | null;
}

/**
 * True for a standard booking still pending (no driver accepted) whose expiresAt has
 * passed, or that has none (made before expiry existed). Expiry is never written to the
 * booking: its status stays 'pending'. Out-of-area bookings never expire this way.
 */
export function isBookingExpired(booking: BookingExpiryFields, now: number = Date.now()): boolean {
  return (
    booking.bookingType === 'standard' &&
    booking.status === 'pending' &&
    (booking.expiresAt === null || booking.expiresAt.getTime() <= now)
  );
}

/** Whole minutes the booking was open for drivers (createdAt to expiresAt), at least 1. */
export function bookingSearchMinutes(createdAt: Date, expiresAt: Date | null): number {
  if (expiresAt === null) return DEFAULT_BOOKING_EXPIRY_MINUTES;
  return Math.max(1, Math.round((expiresAt.getTime() - createdAt.getTime()) / 60000));
}
