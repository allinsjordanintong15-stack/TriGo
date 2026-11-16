/// <reference types="node" />

// Drivers → All drivers table helpers (admin/src/drivers/driverTable.ts). Run with
// `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  accountStanding,
  DEFAULT_DRIVER_FILTERS,
  driverTableParams,
  dutyDot,
  hasActiveFilters,
  initials,
  isAdminSuspended,
  matchesDutyFilter,
  pageNumbers,
  pageSlice,
  readDriverFilters,
  readDriverPage,
  vehicleDescription,
} from '../../admin/src/drivers/driverTable.ts';

describe('URL filters', () => {
  it('defaults to Active drivers and page 1 on a clean URL', () => {
    const params = new URLSearchParams('');
    assert.deepEqual(readDriverFilters(params), DEFAULT_DRIVER_FILTERS);
    assert.equal(readDriverPage(params), 1);
    assert.equal(hasActiveFilters(DEFAULT_DRIVER_FILTERS), false);
  });

  it('round-trips filters and page, leaving defaults out', () => {
    const filters = { search: 'abc', duty: 'on_trip', vehicle: 'tricycle', account: 'all', commission: 'suspended' } as const;
    const params = driverTableParams(filters, 3);
    assert.deepEqual(params, { q: 'abc', status: 'on_trip', vehicle: 'tricycle', account: 'all', commission: 'suspended', page: '3' });
    const back = new URLSearchParams(params);
    assert.deepEqual(readDriverFilters(back), filters);
    assert.equal(readDriverPage(back), 3);
    assert.deepEqual(driverTableParams(DEFAULT_DRIVER_FILTERS, 1), {});
  });

  it('ignores unknown values and bad pages', () => {
    const params = new URLSearchParams('status=flying&account=x&page=-2');
    assert.equal(readDriverFilters(params).duty, 'all');
    assert.equal(readDriverFilters(params).account, 'active');
    assert.equal(readDriverPage(params), 1);
    assert.equal(readDriverPage(new URLSearchParams('page=2.5')), 1);
  });

  it('counts a blank search as no filter', () => {
    assert.equal(hasActiveFilters({ ...DEFAULT_DRIVER_FILTERS, search: '   ' }), false);
    assert.equal(hasActiveFilters({ ...DEFAULT_DRIVER_FILTERS, account: 'all' }), true);
  });
});

describe('admin suspension and account standing', () => {
  const now = Date.UTC(2026, 10, 16);
  it('is not suspended without suspendedAt', () => {
    assert.equal(isAdminSuspended({ suspendedAt: null, suspendedUntil: null }, now), false);
    assert.equal(isAdminSuspended(null, now), false);
  });
  it('is suspended until lifted, or until suspendedUntil', () => {
    const at = new Date(now - 1000);
    assert.equal(isAdminSuspended({ suspendedAt: at, suspendedUntil: null }, now), true);
    assert.equal(isAdminSuspended({ suspendedAt: at, suspendedUntil: new Date(now + 1) }, now), true);
    assert.equal(isAdminSuspended({ suspendedAt: at, suspendedUntil: new Date(now) }, now), false);
  });
  it('puts revoked before suspended', () => {
    assert.equal(accountStanding(false, true), 'revoked');
    assert.equal(accountStanding(true, true), 'suspended');
    assert.equal(accountStanding(true, false), 'active');
  });
});

describe('duty', () => {
  const offline = { isOnline: false, isAvailable: false, currentBookingId: null };
  const available = { isOnline: true, isAvailable: true, currentBookingId: null };
  const busy = { isOnline: true, isAvailable: false, currentBookingId: null };
  const onTrip = { isOnline: true, isAvailable: false, currentBookingId: 'b1' };
  it('shows one dot', () => {
    assert.equal(dutyDot(offline), 'offline');
    assert.equal(dutyDot(available), 'online');
    assert.equal(dutyDot(busy), 'online');
    assert.equal(dutyDot(onTrip), 'on_trip');
  });
  it('filters', () => {
    assert.deepEqual(
      [offline, available, busy, onTrip].map((d) => matchesDutyFilter(d, 'online')),
      [false, true, true, true],
    );
    assert.deepEqual(
      [offline, available, busy, onTrip].map((d) => matchesDutyFilter(d, 'available')),
      [false, true, false, false],
    );
    assert.deepEqual(
      [offline, available, busy, onTrip].map((d) => matchesDutyFilter(d, 'on_trip')),
      [false, false, false, true],
    );
    assert.deepEqual(
      [offline, available, busy, onTrip].map((d) => matchesDutyFilter(d, 'offline')),
      [true, false, false, false],
    );
  });
});

describe('text helpers', () => {
  it('initials', () => {
    assert.equal(initials('Carlo Dela Cruz'), 'CC');
    assert.equal(initials('  ana '), 'A');
    assert.equal(initials(''), '?');
  });
  it('vehicle description hides missing parts', () => {
    assert.equal(vehicleDescription('Red', 'Honda', 'TMX 155'), 'Red Honda TMX 155');
    assert.equal(vehicleDescription(null, 'Honda', null), 'Honda');
    assert.equal(vehicleDescription(null, null, null), '');
  });
});

describe('pagination', () => {
  const items = Array.from({ length: 24 }, (_, i) => i + 1);
  it('slices 10 per page with Showing x–y of n', () => {
    const first = pageSlice(items, 1);
    assert.deepEqual([first.from, first.to, first.total, first.pageCount], [1, 10, 24, 3]);
    const last = pageSlice(items, 3);
    assert.deepEqual(last.items, [21, 22, 23, 24]);
    assert.deepEqual([last.from, last.to], [21, 24]);
  });
  it('clamps a page past the end (e.g. after filtering)', () => {
    assert.equal(pageSlice(items, 9).page, 3);
    const empty = pageSlice([], 2);
    assert.deepEqual([empty.page, empty.pageCount, empty.from, empty.to], [1, 1, 0, 0]);
  });
  it('page numbers with gaps', () => {
    assert.deepEqual(pageNumbers(1, 3), [1, 2, 3]);
    assert.deepEqual(pageNumbers(5, 12), [1, 'gap', 4, 5, 6, 'gap', 12]);
    assert.deepEqual(pageNumbers(3, 12), [1, 2, 3, 4, 'gap', 12]);
    assert.deepEqual(pageNumbers(1, 1), [1]);
  });
});
