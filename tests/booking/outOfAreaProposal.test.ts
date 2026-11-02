/// <reference types="node" />

// Out-of-area request states (src/utils/outOfAreaProposal.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { OutOfAreaRequest } from '../../src/types/index.ts';
import { isExpiredOpenRequest } from '../../src/utils/outOfAreaProposal.ts';

const NOW = Date.UTC(2026, 10, 2, 8, 0, 0);
const place = { latitude: 9.9, longitude: 124.5, address: 'Trinidad, Bohol' };

function request(overrides: Partial<OutOfAreaRequest> = {}): OutOfAreaRequest {
  return {
    requestId: 'r1',
    passengerId: 'p1',
    pickupLocation: place,
    destination: place,
    vehicleType: 'tricycle',
    distanceKm: 12,
    standardEstimatedFare: 120,
    suggestedAgreementFare: null,
    agreedFare: null,
    status: 'searching',
    driverId: null,
    fareAgreement: null,
    createdAt: new Date(NOW - 10 * 60_000),
    updatedAt: null,
    expiresAt: new Date(NOW + 60_000),
    ...overrides,
  };
}

describe('isExpiredOpenRequest', () => {
  it('is false while an open request still has time', () => {
    assert.equal(isExpiredOpenRequest(request(), NOW), false);
  });

  it('is true for an open request past its expiry, or exactly at it', () => {
    assert.equal(isExpiredOpenRequest(request({ expiresAt: new Date(NOW - 1) }), NOW), true);
    assert.equal(isExpiredOpenRequest(request({ expiresAt: new Date(NOW) }), NOW), true);
  });

  it('is true for an old open request with no expiry', () => {
    assert.equal(isExpiredOpenRequest(request({ expiresAt: null }), NOW), true);
  });

  it('is true for a request marked expired', () => {
    assert.equal(isExpiredOpenRequest(request({ status: 'expired' }), NOW), true);
  });

  it('is false once a driver holds it, even past the expiry', () => {
    const held = request({ status: 'negotiating', driverId: 'd1', expiresAt: new Date(NOW - 1) });
    assert.equal(isExpiredOpenRequest(held, NOW), false);
  });

  it('is false for cancelled or accepted requests', () => {
    const past = new Date(NOW - 1);
    assert.equal(isExpiredOpenRequest(request({ status: 'cancelled', expiresAt: past }), NOW), false);
    assert.equal(isExpiredOpenRequest(request({ status: 'accepted', expiresAt: past }), NOW), false);
  });
});
