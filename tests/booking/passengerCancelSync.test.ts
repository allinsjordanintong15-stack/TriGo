/// <reference types="node" />

// The late-driver cancel limit and reason are written in the app and in firestore.rules;
// this keeps the copies equal. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  DRIVER_NO_SHOW_REASON,
  PASSENGER_NO_SHOW_CANCEL_MINUTES,
} from '../../src/constants/cancellation.ts';

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');

describe('passenger late-driver cancel copies', () => {
  it('firestore.rules passengerNoShowCancelMinutes() equals PASSENGER_NO_SHOW_CANCEL_MINUTES', () => {
    const match = /function passengerNoShowCancelMinutes\(\)\s*\{\s*return (\d+);\s*\}/.exec(rules);
    assert.ok(match, 'passengerNoShowCancelMinutes() not found in firestore.rules');
    assert.equal(Number(match[1]), PASSENGER_NO_SHOW_CANCEL_MINUTES);
  });

  it('firestore.rules driverNoShowReason() equals DRIVER_NO_SHOW_REASON', () => {
    const match = /function driverNoShowReason\(\)\s*\{\s*return '([^']*)';\s*\}/.exec(rules);
    assert.ok(match, 'driverNoShowReason() not found in firestore.rules');
    assert.equal(match[1], DRIVER_NO_SHOW_REASON);
  });

  it('the reason fits the 200-character cancellationReason limit', () => {
    assert.ok(DRIVER_NO_SHOW_REASON.length <= 200);
  });
});
