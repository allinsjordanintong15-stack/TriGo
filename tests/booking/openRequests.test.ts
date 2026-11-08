/// <reference types="node" />

// Waiting-request count and labels (src/utils/openRequests.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  countOpenRequests,
  formatRequestCount,
  viewRequestsLabel,
  visibleOutOfAreaCount,
  visibleStandardCount,
  waitingPassengersText,
  type OpenRequestInputs,
} from '../../src/utils/openRequests.ts';

const NOW = Date.UTC(2026, 10, 8, 4, 0);
const MINUTE = 60 * 1000;

function booking(id: string, expiresInMinutes: number | null) {
  return {
    bookingId: id,
    bookingType: 'standard' as const,
    status: 'pending' as const,
    expiresAt: expiresInMinutes === null ? null : new Date(NOW + expiresInMinutes * MINUTE),
  };
}

function outOfArea(id: string, expiresInMinutes: number | null) {
  return {
    request: {
      requestId: id,
      expiresAt: expiresInMinutes === null ? null : new Date(NOW + expiresInMinutes * MINUTE),
    },
  };
}

function inputs(overrides: Partial<OpenRequestInputs> = {}): OpenRequestInputs {
  return {
    bookings: [booking('b1', 5), booking('b2', 1)],
    declinedBookingIds: [],
    outOfArea: [outOfArea('r1', 10)],
    hiddenRequestIds: [],
    ...overrides,
  };
}

describe('countOpenRequests', () => {
  it('counts unexpired standard and out-of-area requests together', () => {
    assert.equal(countOpenRequests(inputs(), NOW), 3);
  });

  it('is 0 while nothing has loaded', () => {
    assert.equal(countOpenRequests(inputs({ bookings: null, outOfArea: null }), NOW), 0);
  });

  it('leaves out standard requests declined on this device', () => {
    assert.equal(visibleStandardCount(inputs({ declinedBookingIds: ['b1'] }), NOW), 1);
  });

  it('leaves out expired standard requests and those without expiresAt (older bookings)', () => {
    const list = inputs({ bookings: [booking('b1', 5), booking('b2', -1), booking('b3', null)] });
    assert.equal(visibleStandardCount(list, NOW), 1);
    // b1 expires at NOW + 5 min: counted until then, not at that moment.
    assert.equal(visibleStandardCount(list, NOW + 5 * MINUTE - 1), 1);
    assert.equal(visibleStandardCount(list, NOW + 5 * MINUTE), 0);
  });

  it('leaves out expired, undated and hidden out-of-area requests', () => {
    const list = inputs({
      outOfArea: [outOfArea('r1', 10), outOfArea('r2', -1), outOfArea('r3', null), outOfArea('r4', 3)],
      hiddenRequestIds: ['r4'],
    });
    assert.equal(visibleOutOfAreaCount(list, NOW), 1);
  });
});

describe('labels', () => {
  it('shows 1–9, then 9+, and nothing for 0', () => {
    assert.equal(formatRequestCount(0), '');
    assert.equal(formatRequestCount(1), '1');
    assert.equal(formatRequestCount(9), '9');
    assert.equal(formatRequestCount(10), '9+');
    assert.equal(formatRequestCount(42), '9+');
  });

  it('says passenger or passengers', () => {
    assert.equal(waitingPassengersText(1), '1 passenger is looking for a driver');
    assert.equal(waitingPassengersText(3), '3 passengers are looking for a driver');
  });

  it('puts the count in the screen-reader label', () => {
    assert.equal(viewRequestsLabel(0), 'View requests');
    assert.equal(viewRequestsLabel(2), 'View requests, 2 waiting');
  });
});
