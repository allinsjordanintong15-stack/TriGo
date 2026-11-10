/// <reference types="node" />

// Admin complaint helpers (admin/src/complaints/reportedParty.ts): who a complaint is about,
// for new complaints (reportedUserId) and older ones (from the booking). Run with
// `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { complaintCountLabel, reportedRoleFor, reportedUserOf } from '../../admin/src/complaints/reportedParty.ts';

const booking = { passengerId: 'p1', driverId: 'd1' };

describe('reportedRoleFor', () => {
  it('maps each reporter to the other side', () => {
    assert.equal(reportedRoleFor('passenger'), 'driver');
    assert.equal(reportedRoleFor('driver'), 'passenger');
    assert.equal(reportedRoleFor(null), null);
  });
});

describe('reportedUserOf', () => {
  it('uses the stored reportedUserId, with or without the booking', () => {
    const complaint = { reporterId: 'p1', reporterRole: 'passenger' as const, reportedUserId: 'd1' };
    assert.equal(reportedUserOf(complaint, null), 'd1');
    assert.equal(reportedUserOf(complaint, booking), 'd1');
  });

  it('is null when the stored value is null (a booking with no driver)', () => {
    assert.equal(reportedUserOf({ reporterId: 'p1', reporterRole: 'passenger', reportedUserId: null }, booking), null);
  });

  it('falls back to the booking for older complaints without the field', () => {
    assert.equal(reportedUserOf({ reporterId: 'p1', reporterRole: 'passenger', reportedUserId: undefined }, booking), 'd1');
    assert.equal(reportedUserOf({ reporterId: 'd1', reporterRole: 'driver', reportedUserId: undefined }, booking), 'p1');
  });

  it('is null for older complaints when the booking is not loaded, has no driver, or the role is unknown', () => {
    assert.equal(reportedUserOf({ reporterId: 'p1', reporterRole: 'passenger', reportedUserId: undefined }, null), null);
    assert.equal(
      reportedUserOf(
        { reporterId: 'p1', reporterRole: 'passenger', reportedUserId: undefined },
        { passengerId: 'p1', driverId: null },
      ),
      null,
    );
    assert.equal(reportedUserOf({ reporterId: 'p1', reporterRole: null, reportedUserId: undefined }, booking), null);
  });

  it('never returns the reporter', () => {
    const self = { passengerId: 'u1', driverId: 'u1' };
    assert.equal(reportedUserOf({ reporterId: 'u1', reporterRole: 'passenger', reportedUserId: undefined }, self), null);
  });
});

describe('complaintCountLabel', () => {
  it('words the count', () => {
    assert.equal(complaintCountLabel(0), 'No complaints');
    assert.equal(complaintCountLabel(1), '1 complaint');
    assert.equal(complaintCountLabel(12), '12 complaints');
  });
});
