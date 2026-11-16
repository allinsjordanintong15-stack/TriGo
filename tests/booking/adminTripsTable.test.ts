/// <reference types="node" />

// Trips → Out-of-area trips table helpers (admin/src/outOfArea/tripsTable.ts). Run with
// `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  chipLabel,
  DEFAULT_TRIP_FILTERS,
  hasTripFilters,
  matchesTripSearch,
  readTripFilters,
  statusCounts,
  tripStatus,
  tripTableParams,
  visibleChips,
} from '../../admin/src/outOfArea/tripsTable.ts';

describe('tripStatus (request + booking → one status)', () => {
  it('uses the request status before a booking exists', () => {
    assert.equal(tripStatus('searching', null), 'searching');
    assert.equal(tripStatus('awaiting_passenger', null), 'awaiting_passenger');
    assert.equal(tripStatus('confirmed', null), 'confirmed');
    assert.equal(tripStatus('expired', null), 'expired');
    assert.equal(tripStatus('cancelled', null), 'cancelled');
  });

  it('keeps a confirmed trip Confirmed until it starts', () => {
    assert.equal(tripStatus('confirmed', 'pending'), 'confirmed');
    assert.equal(tripStatus('confirmed', 'accepted'), 'confirmed');
    assert.equal(tripStatus('confirmed', 'arrived'), 'confirmed');
  });

  it('lets the booking decide once started or finished', () => {
    assert.equal(tripStatus('confirmed', 'in_progress'), 'in_progress');
    assert.equal(tripStatus('confirmed', 'completed'), 'completed');
    assert.equal(tripStatus('confirmed', 'cancelled'), 'cancelled');
    assert.equal(tripStatus('cancelled', 'cancelled'), 'cancelled');
  });

  it('counts rejected as cancelled and keeps unreadable statuses apart', () => {
    assert.equal(tripStatus('rejected', null), 'cancelled');
    assert.equal(tripStatus('unknown', null), 'unknown');
  });
});

describe('status chips', () => {
  it('counts every trip under All and each status under its chip', () => {
    const counts = statusCounts(['searching', 'completed', 'completed', 'unknown', 'cancelled']);
    assert.equal(counts.all, 5);
    assert.equal(counts.completed, 2);
    assert.equal(counts.searching, 1);
    assert.equal(counts.cancelled, 1);
    assert.equal(counts.expired, 0);
  });

  it('shows In progress only when a trip has it or it is chosen', () => {
    const none = statusCounts(['completed']);
    assert.ok(!visibleChips(none, 'all').includes('in_progress'));
    assert.ok(visibleChips(none, 'in_progress').includes('in_progress'));
    assert.ok(visibleChips(statusCounts(['in_progress']), 'all').includes('in_progress'));
    assert.deepEqual(visibleChips(none, 'all'), [
      'all', 'searching', 'awaiting_passenger', 'confirmed', 'completed', 'expired', 'cancelled',
    ]);
  });

  it('labels', () => {
    assert.equal(chipLabel('all'), 'All');
    assert.equal(chipLabel('searching'), 'Looking for a driver');
  });
});

describe('URL state', () => {
  it('defaults to the last 7 days, all statuses, 10 rows', () => {
    assert.deepEqual(readTripFilters(new URLSearchParams('')), DEFAULT_TRIP_FILTERS);
    assert.deepEqual(tripTableParams(DEFAULT_TRIP_FILTERS, 1), {});
  });

  it('round-trips a custom range, search, chip, rows and page', () => {
    const filters = {
      preset: 'custom',
      from: '2026-11-01',
      to: '2026-11-15',
      search: 'ana',
      status: 'completed',
      pageSize: 20,
    } as const;
    const params = tripTableParams(filters, 2);
    assert.deepEqual(params, {
      range: 'custom', from: '2026-11-01', to: '2026-11-15', q: 'ana', status: 'completed', rows: '20', page: '2',
    });
    assert.deepEqual(readTripFilters(new URLSearchParams(params)), filters);
  });

  it('keeps from/to only for the custom preset', () => {
    const read = readTripFilters(new URLSearchParams('range=30d&from=2026-11-01&to=2026-11-15'));
    assert.deepEqual([read.preset, read.from, read.to], ['30d', '', '']);
    assert.deepEqual(tripTableParams({ ...DEFAULT_TRIP_FILTERS, from: '2026-11-01' }, 1), {});
  });

  it('ignores unknown values', () => {
    const read = readTripFilters(new URLSearchParams('range=year&status=lost&rows=7&from=nope'));
    assert.deepEqual(read, DEFAULT_TRIP_FILTERS);
    assert.equal(readTripFilters(new URLSearchParams('range=custom&from=11/01/2026')).from, '');
  });

  it('counts search and status as filters, not the range or rows', () => {
    assert.equal(hasTripFilters({ ...DEFAULT_TRIP_FILTERS, preset: 'today', pageSize: 50 }), false);
    assert.equal(hasTripFilters({ ...DEFAULT_TRIP_FILTERS, search: '  ' }), false);
    assert.equal(hasTripFilters({ ...DEFAULT_TRIP_FILTERS, search: 'ana' }), true);
    assert.equal(hasTripFilters({ ...DEFAULT_TRIP_FILTERS, status: 'expired' }), true);
  });
});

describe('search', () => {
  it('matches the passenger or the driver name, every word', () => {
    assert.equal(matchesTripSearch('Ana Santos', 'Bella Cruz', ''), true);
    assert.equal(matchesTripSearch('Ana Santos', 'Bella Cruz', 'santos'), true);
    assert.equal(matchesTripSearch('Ana Santos', 'Bella Cruz', 'cruz bel'), true);
    assert.equal(matchesTripSearch('Ana Santos', 'Bella Cruz', 'ana cruz'), false);
    assert.equal(matchesTripSearch('Ana Santos', null, 'bella'), false);
  });
});
