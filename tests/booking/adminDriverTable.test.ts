/// <reference types="node" />

// Drivers → All drivers table helpers (admin/src/drivers/driverTable.ts). Run with
// `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_DRIVER_FILTERS,
  driverTableParams,
  hasActiveFilters,
  initials,
  isAdminSuspended,
  matchesDriverName,
  pageNumbers,
  pageSlice,
  ratingLabel,
  ratingStars,
  readDriverFilters,
  readDriverPage,
  vehicleDescription,
} from '../../admin/src/drivers/driverTable.ts';

describe('URL state', () => {
  it('defaults to all vehicles, 10 rows and page 1 on a clean URL', () => {
    const params = new URLSearchParams('');
    assert.deepEqual(readDriverFilters(params), { search: '', vehicle: 'all', pageSize: 10 });
    assert.deepEqual(readDriverFilters(params), DEFAULT_DRIVER_FILTERS);
    assert.equal(readDriverPage(params), 1);
  });

  it('round-trips search, vehicle, rows and page, leaving defaults out', () => {
    const filters = { search: 'bella', vehicle: 'motorcycle', pageSize: 50 } as const;
    const params = driverTableParams(filters, 3);
    assert.deepEqual(params, { q: 'bella', vehicle: 'motorcycle', rows: '50', page: '3' });
    const back = new URLSearchParams(params);
    assert.deepEqual(readDriverFilters(back), filters);
    assert.equal(readDriverPage(back), 3);
    assert.deepEqual(driverTableParams(DEFAULT_DRIVER_FILTERS, 1), {});
  });

  it('ignores unknown vehicles, row counts and bad pages', () => {
    const params = new URLSearchParams('vehicle=bus&rows=15&page=-2');
    assert.equal(readDriverFilters(params).vehicle, 'all');
    assert.equal(readDriverFilters(params).pageSize, 10);
    assert.equal(readDriverPage(params), 1);
    assert.equal(readDriverPage(new URLSearchParams('page=2.5')), 1);
    assert.equal(readDriverFilters(new URLSearchParams('rows=20')).pageSize, 20);
  });

  it('drops the removed filters from older links', () => {
    const params = new URLSearchParams('status=online&account=revoked&commission=due');
    assert.deepEqual(readDriverFilters(params), DEFAULT_DRIVER_FILTERS);
  });

  it('counts search and vehicle as filters, not rows per page', () => {
    assert.equal(hasActiveFilters({ ...DEFAULT_DRIVER_FILTERS, search: '   ' }), false);
    assert.equal(hasActiveFilters({ ...DEFAULT_DRIVER_FILTERS, pageSize: 50 }), false);
    assert.equal(hasActiveFilters({ ...DEFAULT_DRIVER_FILTERS, search: 'a' }), true);
    assert.equal(hasActiveFilters({ ...DEFAULT_DRIVER_FILTERS, vehicle: 'tricycle' }), true);
  });
});

describe('name search', () => {
  it('matches the name only, case-insensitive, every word', () => {
    assert.equal(matchesDriverName('Bella Cruz', ''), true);
    assert.equal(matchesDriverName('Bella Cruz', 'BELL'), true);
    assert.equal(matchesDriverName('Bella Cruz', 'cruz bel'), true);
    assert.equal(matchesDriverName('Bella Cruz', 'bella reyes'), false);
    // Plates, emails and numbers are no longer searched.
    assert.equal(matchesDriverName('Bella Cruz', 'ABC 1234'), false);
  });
});

describe('admin suspension', () => {
  const now = Date.UTC(2026, 10, 16);
  const at = new Date(now - 1000);
  it('is not suspended without suspendedAt', () => {
    assert.equal(isAdminSuspended({ suspendedAt: null, suspendedUntil: null, suspensionLiftedAt: null }, now), false);
    assert.equal(isAdminSuspended(null, now), false);
  });
  it('is suspended until lifted, or until suspendedUntil', () => {
    assert.equal(isAdminSuspended({ suspendedAt: at, suspendedUntil: null, suspensionLiftedAt: null }, now), true);
    assert.equal(isAdminSuspended({ suspendedAt: at, suspendedUntil: new Date(now + 1), suspensionLiftedAt: null }, now), true);
    assert.equal(isAdminSuspended({ suspendedAt: at, suspendedUntil: new Date(now), suspensionLiftedAt: null }, now), false);
  });
  it('is not suspended once lifted', () => {
    assert.equal(isAdminSuspended({ suspendedAt: at, suspendedUntil: null, suspensionLiftedAt: new Date(now - 10) }, now), false);
  });
});

describe('rating stars', () => {
  it('shows whole and half stars', () => {
    assert.deepEqual(ratingStars(4.5), { full: 4, half: true, empty: 0 });
    assert.deepEqual(ratingStars(5), { full: 5, half: false, empty: 0 });
    assert.deepEqual(ratingStars(3), { full: 3, half: false, empty: 2 });
    assert.deepEqual(ratingStars(4.3), { full: 4, half: true, empty: 0 });
    assert.deepEqual(ratingStars(4.2), { full: 4, half: false, empty: 1 });
    assert.deepEqual(ratingStars(4.8), { full: 5, half: false, empty: 0 });
    assert.deepEqual(ratingStars(1.4), { full: 1, half: true, empty: 3 });
  });
  it('labels the average and count', () => {
    assert.equal(ratingLabel(4.5, 2), '4.5 out of 5 from 2 ratings');
    assert.equal(ratingLabel(5, 1), '5.0 out of 5 from 1 rating');
  });
});

describe('text helpers', () => {
  it('initials', () => {
    assert.equal(initials('Carlo Dela Cruz'), 'CC');
    assert.equal(initials('  ana '), 'A');
    assert.equal(initials(''), '?');
  });
  it('vehicle description hides missing parts', () => {
    assert.equal(vehicleDescription('Silver', 'Honda', 'Click 125'), 'Silver Honda Click 125');
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
  it('uses the chosen rows per page', () => {
    const twenty = pageSlice(items, 2, 20);
    assert.deepEqual([twenty.from, twenty.to, twenty.pageCount], [21, 24, 2]);
    assert.equal(pageSlice(items, 1, 50).pageCount, 1);
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
