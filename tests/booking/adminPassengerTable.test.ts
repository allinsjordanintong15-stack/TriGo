/// <reference types="node" />

// Passengers table helpers (admin/src/passengers/passengerTable.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  countByUser,
  DEFAULT_PASSENGER_FILTERS,
  hasPassengerFilters,
  matchesPassengerChip,
  matchesPassengerName,
  passengerParams,
  readPassengerFilters,
} from '../../admin/src/passengers/passengerTable.ts';

describe('URL state', () => {
  it('defaults to all passengers, 10 rows, page 1', () => {
    assert.deepEqual(readPassengerFilters(new URLSearchParams('')), DEFAULT_PASSENGER_FILTERS);
    assert.deepEqual(passengerParams(DEFAULT_PASSENGER_FILTERS, 1), {});
  });

  it('round-trips search, chip, rows and page', () => {
    const filters = { search: 'ana', chip: 'warned', pageSize: 50 } as const;
    const params = passengerParams(filters, 2);
    assert.deepEqual(params, { q: 'ana', show: 'warned', rows: '50', page: '2' });
    assert.deepEqual(readPassengerFilters(new URLSearchParams(params)), filters);
  });

  it('ignores unknown values', () => {
    assert.deepEqual(readPassengerFilters(new URLSearchParams('show=banned&rows=7')), DEFAULT_PASSENGER_FILTERS);
  });

  it('counts search and chips as filters, not rows', () => {
    assert.equal(hasPassengerFilters({ ...DEFAULT_PASSENGER_FILTERS, pageSize: 50 }), false);
    assert.equal(hasPassengerFilters({ ...DEFAULT_PASSENGER_FILTERS, search: '  ' }), false);
    assert.equal(hasPassengerFilters({ ...DEFAULT_PASSENGER_FILTERS, chip: 'complaints' }), true);
  });
});

describe('filters', () => {
  it('searches the name only', () => {
    assert.equal(matchesPassengerName('Ana Santos', 'santos ana'), true);
    assert.equal(matchesPassengerName('Ana Santos', 'ana@example.com'), false);
  });

  it('matches the chips', () => {
    assert.equal(matchesPassengerChip('all', 0, 0), true);
    assert.equal(matchesPassengerChip('complaints', 1, 0), true);
    assert.equal(matchesPassengerChip('complaints', 0, 2), false);
    assert.equal(matchesPassengerChip('warned', 0, 1), true);
    assert.equal(matchesPassengerChip('warned', 3, 0), false);
  });

  it('counts per user, skipping empty ids', () => {
    const counts = countByUser(['a', 'b', 'a', null, undefined, '']);
    assert.deepEqual([...counts.entries()], [['a', 2], ['b', 1]]);
  });
});
