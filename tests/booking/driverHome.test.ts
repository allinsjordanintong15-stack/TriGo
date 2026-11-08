/// <reference types="node" />

// Driver Home accept-restriction text (src/utils/driverHome.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { COMMISSION_DUE_SOON_HOURS } from '../../src/constants/commission.ts';
import {
  type CommissionAccountTimes,
  commissionStatus,
  graceEndMillis,
  periodEndMillis,
} from '../../src/utils/commission.ts';
import { quotaStatus } from '../../src/utils/dailyQuota.ts';
import { getAcceptRestriction, isCommissionDueSoon } from '../../src/utils/driverHome.ts';

const HOUR = 60 * 60 * 1000;

describe('isCommissionDueSoon', () => {
  // A 7-day period with a 3-day grace period and ₱42.10 owed, nothing paid.
  const startAtMillis = Date.UTC(2026, 10, 2, 2, 0); // Nov 2, 10:00 Manila
  const account: CommissionAccountTimes = {
    accruedCentavos: 4210,
    paidCentavos: 0,
    current: { seq: 1, startAtMillis, periodDays: 7, graceDays: 3, startCentavos: 0 },
    unpaid: null,
  };
  const dueAt = periodEndMillis(startAtMillis, 7);
  const graceEnd = graceEndMillis(startAtMillis, 7, 3);
  const at = (now: number) => isCommissionDueSoon(commissionStatus(account, now), now);

  it('uses a 24-hour threshold', () => {
    assert.equal(COMMISSION_DUE_SOON_HOURS, 24);
  });

  it('is hidden with more than 24 hours left', () => {
    assert.equal(commissionStatus(account, dueAt - 24 * HOUR - 1).status, 'due');
    assert.equal(at(dueAt - 24 * HOUR - 1), false);
    assert.equal(at(dueAt - 3 * 24 * HOUR), false);
    assert.equal(at(startAtMillis), false);
  });

  it('is shown at exactly 24 hours left', () => {
    assert.equal(at(dueAt - 24 * HOUR), true);
  });

  it('is shown with less than 24 hours left, up to the due time', () => {
    assert.equal(at(dueAt - 23 * HOUR), true);
    assert.equal(at(dueAt - 1), true);
  });

  it('is never true for overdue or suspended, also within 24 hours of a deadline', () => {
    const overdueNow = graceEnd - HOUR;
    assert.equal(commissionStatus(account, overdueNow).status, 'overdue');
    assert.equal(at(overdueNow), false);
    assert.equal(at(dueAt), false);

    const suspendedNow = graceEnd + HOUR;
    assert.equal(commissionStatus(account, suspendedNow).status, 'suspended');
    assert.equal(at(suspendedNow), false);
  });

  it('is never true when paid up or without a due time', () => {
    const paid = { ...account, paidCentavos: 4210 };
    assert.equal(isCommissionDueSoon(commissionStatus(paid, dueAt - HOUR), dueAt - HOUR), false);
    assert.equal(isCommissionDueSoon({ status: 'due', dueAtMillis: null }, dueAt), false);
  });
});

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
