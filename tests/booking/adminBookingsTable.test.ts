/// <reference types="node" />

// Trips → Bookings table helpers (admin/src/bookings/bookingsTable.ts). Run with
// `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bookingChipLabel,
  bookingRowStatus,
  bookingStatusCounts,
  bookingTableParams,
  bookingTimeline,
  DEFAULT_BOOKING_FILTERS,
  DRIVER_NO_SHOW_REASON,
  hasBookingFilters,
  isDriverNoShow,
  matchesBookingSearch,
  readBookingFilters,
  visibleBookingChips,
} from '../../admin/src/bookings/bookingsTable.ts';
import { DRIVER_NO_SHOW_REASON as APP_NO_SHOW_REASON } from '../../src/constants/cancellation.ts';

const NOW = Date.UTC(2026, 10, 16, 4);
const later = new Date(NOW + 60_000);
const earlier = new Date(NOW - 60_000);

describe('bookingRowStatus', () => {
  it('shows stored statuses as they are', () => {
    for (const status of ['accepted', 'arrived', 'in_progress', 'completed', 'cancelled'] as const) {
      assert.equal(bookingRowStatus({ status, bookingType: 'standard', expiresAt: earlier }, NOW), status);
    }
  });

  it('expires a pending standard booking at expiresAt, or without one', () => {
    assert.equal(bookingRowStatus({ status: 'pending', bookingType: 'standard', expiresAt: later }, NOW), 'pending');
    assert.equal(bookingRowStatus({ status: 'pending', bookingType: 'standard', expiresAt: new Date(NOW) }, NOW), 'expired');
    assert.equal(bookingRowStatus({ status: 'pending', bookingType: 'standard', expiresAt: null }, NOW), 'expired');
  });

  it('never expires a pending out-of-area booking (it waits for the driver to claim)', () => {
    assert.equal(bookingRowStatus({ status: 'pending', bookingType: 'out_of_area', expiresAt: null }, NOW), 'pending');
  });

  it('marks an unreadable status unknown', () => {
    assert.equal(bookingRowStatus({ status: null, bookingType: 'standard', expiresAt: null }, NOW), 'unknown');
  });
});

describe('driver no-show', () => {
  it('matches the app constant exactly', () => {
    assert.equal(DRIVER_NO_SHOW_REASON, APP_NO_SHOW_REASON);
    assert.equal(isDriverNoShow(APP_NO_SHOW_REASON), true);
    assert.equal(isDriverNoShow('Changed plans'), false);
    assert.equal(isDriverNoShow(null), false);
  });
});

describe('status chips', () => {
  it('counts every booking under All, statuses under their chip', () => {
    const counts = bookingStatusCounts(['completed', 'completed', 'expired', 'unknown']);
    assert.deepEqual([counts.all, counts.completed, counts.expired, counts.pending], [4, 2, 1, 0]);
  });

  it('shows All, the statuses that occur, and the chosen one', () => {
    const counts = bookingStatusCounts(['completed', 'cancelled']);
    assert.deepEqual(visibleBookingChips(counts, 'all'), ['all', 'completed', 'cancelled']);
    assert.deepEqual(visibleBookingChips(counts, 'arrived'), ['all', 'arrived', 'completed', 'cancelled']);
    assert.equal(bookingChipLabel('pending'), 'Waiting for driver');
  });
});

describe('URL state', () => {
  it('defaults: last 7 days, all types and statuses, 10 rows', () => {
    assert.deepEqual(readBookingFilters(new URLSearchParams('')), DEFAULT_BOOKING_FILTERS);
    assert.deepEqual(bookingTableParams(DEFAULT_BOOKING_FILTERS, 1), {});
  });

  it('round-trips every filter and the page', () => {
    const filters = {
      preset: 'custom',
      from: '2026-11-01',
      to: '2026-11-15',
      search: 'ana',
      type: 'out_of_area',
      status: 'completed',
      pageSize: 50,
    } as const;
    const params = bookingTableParams(filters, 3);
    assert.deepEqual(params, {
      range: 'custom', from: '2026-11-01', to: '2026-11-15', q: 'ana', type: 'out_of_area', status: 'completed', rows: '50', page: '3',
    });
    assert.deepEqual(readBookingFilters(new URLSearchParams(params)), filters);
  });

  it('ignores unknown values and keeps dates only for custom', () => {
    assert.deepEqual(readBookingFilters(new URLSearchParams('type=bus&status=lost&rows=9&range=year')), DEFAULT_BOOKING_FILTERS);
    const today = readBookingFilters(new URLSearchParams('range=today&from=2026-11-01'));
    assert.deepEqual([today.preset, today.from], ['today', '']);
  });

  it('counts search, type and status as filters', () => {
    assert.equal(hasBookingFilters({ ...DEFAULT_BOOKING_FILTERS, preset: '30d', pageSize: 20 }), false);
    assert.equal(hasBookingFilters({ ...DEFAULT_BOOKING_FILTERS, type: 'standard' }), true);
    assert.equal(hasBookingFilters({ ...DEFAULT_BOOKING_FILTERS, status: 'expired' }), true);
    assert.equal(hasBookingFilters({ ...DEFAULT_BOOKING_FILTERS, search: 'x' }), true);
  });

  it('searches passenger or driver names', () => {
    assert.equal(matchesBookingSearch('Ana Santos', 'Carlo Bautista', 'carlo'), true);
    assert.equal(matchesBookingSearch('Ana Santos', null, 'carlo'), false);
  });
});

describe('bookingTimeline', () => {
  const t = (minutes: number) => new Date(NOW - 60 * 60_000 + minutes * 60_000);
  const base = {
    status: 'completed' as const,
    bookingType: 'standard' as const,
    expiresAt: t(10),
    createdAt: t(0),
    acceptedAt: t(2),
    arrivedAt: t(8),
    startedAt: t(9),
    completedAt: t(25),
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
  };

  it('lists recorded steps in order', () => {
    assert.deepEqual(
      bookingTimeline(base, NOW).map((e) => e.label),
      ['Requested', 'Accepted by the driver', 'Driver arrived at pickup', 'Trip started', 'Completed'],
    );
  });

  it('explains a driver no-show cancel', () => {
    const events = bookingTimeline(
      { ...base, status: 'cancelled', arrivedAt: null, startedAt: null, completedAt: null, cancelledAt: t(20), cancelledBy: 'passenger', cancellationReason: DRIVER_NO_SHOW_REASON },
      NOW,
    );
    assert.equal(events.at(-1)?.label, 'Cancelled by the passenger');
    assert.match(events.at(-1)?.detail ?? '', /no-show/);
  });

  it('ends an expired standard booking at expiresAt', () => {
    const events = bookingTimeline(
      { ...base, status: 'pending', acceptedAt: null, arrivedAt: null, startedAt: null, completedAt: null },
      NOW,
    );
    assert.deepEqual(events.map((e) => e.label), ['Requested', 'Expired']);
  });
});
