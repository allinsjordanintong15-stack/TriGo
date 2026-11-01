/// <reference types="node" />

// Standard booking expiry helpers (isBookingExpired, bookingExpiryMinutes,
// bookingSearchMinutes). Run with `npm run test:unit`.
// Imports only alias-free files: Node's type stripping does not resolve the "@/..." aliases.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bookingExpiryMinutes,
  bookingSearchMinutes,
  DEFAULT_BOOKING_EXPIRY_MINUTES,
  isBookingExpired,
  MAX_BOOKING_EXPIRY_MINUTES,
  type BookingExpiryFields,
} from '../../src/utils/bookingExpiry.ts';

const NOW = Date.UTC(2026, 10, 1, 10, 0, 0);
const MINUTE = 60 * 1000;

function booking(overrides: Partial<BookingExpiryFields> = {}): BookingExpiryFields {
  return {
    bookingType: 'standard',
    status: 'pending',
    expiresAt: new Date(NOW + 5 * MINUTE),
    ...overrides,
  };
}

describe('isBookingExpired', () => {
  it('is false for a pending standard booking before expiresAt', () => {
    assert.equal(isBookingExpired(booking(), NOW), false);
  });

  it('is true at and after expiresAt', () => {
    assert.equal(isBookingExpired(booking({ expiresAt: new Date(NOW) }), NOW), true);
    assert.equal(isBookingExpired(booking({ expiresAt: new Date(NOW - MINUTE) }), NOW), true);
  });

  it('is true for a pending standard booking without expiresAt (made before expiry)', () => {
    assert.equal(isBookingExpired(booking({ expiresAt: null }), NOW), true);
  });

  it('is false once a driver accepted, or after cancel/complete, even past expiresAt', () => {
    const past = new Date(NOW - MINUTE);
    for (const status of ['accepted', 'arrived', 'in_progress', 'completed', 'cancelled'] as const) {
      assert.equal(isBookingExpired(booking({ status, expiresAt: past }), NOW), false, status);
    }
  });

  it('is false for out-of-area bookings (no expiresAt)', () => {
    assert.equal(isBookingExpired(booking({ bookingType: 'out_of_area', expiresAt: null }), NOW), false);
  });
});

describe('bookingExpiryMinutes', () => {
  it('uses whole minutes from 1 to 30 as set', () => {
    assert.equal(bookingExpiryMinutes(1), 1);
    assert.equal(bookingExpiryMinutes(15), 15);
    assert.equal(bookingExpiryMinutes(30), 30);
  });

  it('caps values above the maximum at 30', () => {
    assert.equal(bookingExpiryMinutes(45), MAX_BOOKING_EXPIRY_MINUTES);
  });

  it('falls back to the default for missing or invalid values', () => {
    for (const value of [undefined, null, 0, -5, 7.5, '10', Number.NaN]) {
      assert.equal(bookingExpiryMinutes(value), DEFAULT_BOOKING_EXPIRY_MINUTES, String(value));
    }
  });
});

describe('bookingSearchMinutes', () => {
  it('rounds createdAt to expiresAt to whole minutes', () => {
    assert.equal(bookingSearchMinutes(new Date(NOW), new Date(NOW + 10 * MINUTE + 2000)), 10);
  });

  it('is at least 1 and the default without expiresAt', () => {
    assert.equal(bookingSearchMinutes(new Date(NOW), new Date(NOW + 1000)), 1);
    assert.equal(bookingSearchMinutes(new Date(NOW), null), DEFAULT_BOOKING_EXPIRY_MINUTES);
  });
});
