/// <reference types="node" />

// Driver Home accept-restriction text (src/utils/driverHome.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { quotaStatus } from '../../src/utils/dailyQuota.ts';
import { getAcceptRestriction } from '../../src/utils/driverHome.ts';

describe('getAcceptRestriction', () => {
  it('is null when nothing blocks accepting', () => {
    assert.equal(getAcceptRestriction(null, null), null);
    assert.equal(getAcceptRestriction('paid_up', quotaStatus(3, 20)), null);
    assert.equal(getAcceptRestriction('due', quotaStatus(19, 20)), null);
    assert.equal(getAcceptRestriction('overdue', quotaStatus(0, 20)), null);
  });

  it('explains a commission suspension', () => {
    const restriction = getAcceptRestriction('suspended', quotaStatus(2, 20));
    assert.ok(restriction);
    assert.match(restriction.title, /stay online/);
    assert.match(restriction.message, /grace period has ended/);
    assert.doesNotMatch(restriction.message, /12:00 AM/);
    assert.match(restriction.message, /finish your current trip/);
  });

  it('explains the daily limit with the limit number', () => {
    const restriction = getAcceptRestriction('paid_up', quotaStatus(20, 20));
    assert.ok(restriction);
    assert.match(restriction.message, /limit of 20/);
    assert.match(restriction.message, /after 12:00 AM/);
    assert.doesNotMatch(restriction.message, /grace period/);
  });

  it('gives both reasons when both apply, also with an unread quota', () => {
    const both = getAcceptRestriction('suspended', quotaStatus(25, 20));
    assert.ok(both);
    assert.match(both.message, /grace period has ended/);
    assert.match(both.message, /limit of 20/);
    assert.ok(getAcceptRestriction('suspended', null));
  });
});
