/// <reference types="node" />

// Passenger Home greeting (src/utils/greeting.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getFirstName, getManilaGreeting } from '../../src/utils/greeting.ts';

// Manila wall-clock time as an instant (UTC+8).
function manila(hour: number, minute = 0): number {
  return Date.UTC(2026, 10, 15, hour - 8, minute);
}

describe('getManilaGreeting', () => {
  it('says good morning from midnight until noon', () => {
    assert.equal(getManilaGreeting(manila(0)), 'Good morning');
    assert.equal(getManilaGreeting(manila(11, 59)), 'Good morning');
  });

  it('says good afternoon from noon until 6 pm', () => {
    assert.equal(getManilaGreeting(manila(12)), 'Good afternoon');
    assert.equal(getManilaGreeting(manila(17, 59)), 'Good afternoon');
  });

  it('says good evening from 6 pm until midnight', () => {
    assert.equal(getManilaGreeting(manila(18)), 'Good evening');
    assert.equal(getManilaGreeting(manila(23, 59)), 'Good evening');
  });

  it('uses Manila time, not UTC', () => {
    // 23:00 UTC is 07:00 the next day in Manila.
    assert.equal(getManilaGreeting(Date.UTC(2026, 10, 15, 23, 0)), 'Good morning');
  });
});

describe('getFirstName', () => {
  it('takes the first word of the full name', () => {
    assert.equal(getFirstName('Juan  Dela Cruz', 'Passenger'), 'Juan');
    assert.equal(getFirstName('  Maria ', 'Passenger'), 'Maria');
  });

  it('falls back when the name is missing or blank', () => {
    assert.equal(getFirstName(null, 'Passenger'), 'Passenger');
    assert.equal(getFirstName('   ', 'Passenger'), 'Passenger');
  });
});
