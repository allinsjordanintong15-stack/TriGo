/// <reference types="node" />

// Passenger cancel timing (src/utils/passengerCancel.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PASSENGER_NO_SHOW_CANCEL_MINUTES } from '../../src/constants/cancellation.ts';
import {
  canPassengerCancelNow,
  noShowCancelOpensAt,
  passengerCancelState,
} from '../../src/utils/passengerCancel.ts';

const MINUTE = 60 * 1000;
const ACCEPTED_AT = new Date(Date.UTC(2026, 10, 8, 2, 0));
const OPENS_AT = ACCEPTED_AT.getTime() + 15 * MINUTE;

const accepted = { status: 'accepted' as const, acceptedAt: ACCEPTED_AT };

describe('passengerCancelState', () => {
  it('uses a 15-minute limit', () => {
    assert.equal(PASSENGER_NO_SHOW_CANCEL_MINUTES, 15);
    assert.equal(noShowCancelOpensAt(accepted), OPENS_AT);
  });

  it('pending: cancel any time', () => {
    const pending = { status: 'pending' as const, acceptedAt: null };
    assert.deepEqual(passengerCancelState(pending, 0), { kind: 'cancel' });
    assert.equal(canPassengerCancelNow(pending, 0), true);
  });

  it('accepted, before the limit: wait, with the time it opens', () => {
    assert.deepEqual(passengerCancelState(accepted, ACCEPTED_AT.getTime()), {
      kind: 'wait_for_driver',
      opensAt: OPENS_AT,
    });
    assert.deepEqual(passengerCancelState(accepted, OPENS_AT - 1), {
      kind: 'wait_for_driver',
      opensAt: OPENS_AT,
    });
    assert.equal(canPassengerCancelNow(accepted, OPENS_AT - 1), false);
  });

  it('accepted, at and after the limit: the driver is late, may cancel', () => {
    assert.deepEqual(passengerCancelState(accepted, OPENS_AT), { kind: 'driver_late' });
    assert.deepEqual(passengerCancelState(accepted, OPENS_AT + 60 * MINUTE), {
      kind: 'driver_late',
    });
    assert.equal(canPassengerCancelNow(accepted, OPENS_AT), true);
  });

  it('accepted without acceptedAt (older bookings): locked', () => {
    const noTime = { status: 'accepted' as const, acceptedAt: null };
    assert.equal(noShowCancelOpensAt(noTime), null);
    assert.deepEqual(passengerCancelState(noTime, OPENS_AT + 60 * MINUTE), { kind: 'locked' });
  });

  for (const status of ['arrived', 'in_progress', 'completed', 'cancelled'] as const) {
    it(`${status}: locked, also long after the limit`, () => {
      const booking = { status, acceptedAt: ACCEPTED_AT };
      assert.equal(noShowCancelOpensAt(booking), null);
      assert.deepEqual(passengerCancelState(booking, OPENS_AT + 60 * MINUTE), { kind: 'locked' });
      assert.equal(canPassengerCancelNow(booking, OPENS_AT + 60 * MINUTE), false);
    });
  }
});
