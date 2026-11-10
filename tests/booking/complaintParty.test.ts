/// <reference types="node" />

// Who a complaint is about (src/utils/complaintParty.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { reportedUserIdFor } from '../../src/utils/complaintParty.ts';

describe('reportedUserIdFor', () => {
  const booking = { passengerId: 'p1', driverId: 'd1' };

  it('names the driver when the passenger reports', () => {
    assert.equal(reportedUserIdFor(booking, 'passenger', 'p1'), 'd1');
  });

  it('names the passenger when the driver reports', () => {
    assert.equal(reportedUserIdFor(booking, 'driver', 'd1'), 'p1');
  });

  it('is null when the booking has no driver (a request nobody accepted)', () => {
    assert.equal(reportedUserIdFor({ passengerId: 'p1', driverId: null }, 'passenger', 'p1'), null);
  });

  it('never names the reporter', () => {
    assert.equal(reportedUserIdFor({ passengerId: 'u1', driverId: 'u1' }, 'passenger', 'u1'), null);
    assert.equal(reportedUserIdFor({ passengerId: 'u1', driverId: 'u1' }, 'driver', 'u1'), null);
  });
});
