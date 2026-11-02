/// <reference types="node" />

// Driver daily acceptance quota helpers (src/utils/dailyQuota.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  acceptedOn,
  acceptedTodayText,
  canRefundSlot,
  clockOffsetMs,
  DAILY_LIMIT_RANGE,
  DAILY_LIMIT_REACHED_MESSAGE,
  dailyLimitFrom,
  DAY_MS,
  DEFAULT_DAILY_LIMIT,
  fieldsAfterAccept,
  fieldsAfterRefund,
  isAtDailyLimit,
  isNearManilaMidnight,
  isValidDailyLimit,
  manilaDay,
  MIDNIGHT_RETRY_WINDOW_MS,
  msUntilManilaMidnight,
  nextManilaMidnight,
  quotaStatus,
  serverNow,
  type RefundBookingFields,
} from '../../src/utils/dailyQuota.ts';

// 12:00 AM Manila on 3 Nov 2026 is 16:00 UTC on 2 Nov.
const MIDNIGHT = Date.UTC(2026, 10, 2, 16, 0, 0);
const NOON_MANILA = Date.UTC(2026, 10, 2, 4, 0, 0); // 12:00 PM Manila, 2 Nov
const TODAY = manilaDay(NOON_MANILA);

describe('daily limit', () => {
  it('defaults to 20 and allows whole numbers 1-100', () => {
    assert.equal(DEFAULT_DAILY_LIMIT, 20);
    assert.deepEqual(DAILY_LIMIT_RANGE, { min: 1, max: 100 });
  });

  it('accepts only whole numbers in range', () => {
    for (const ok of [1, 20, 100]) assert.equal(isValidDailyLimit(ok), true, String(ok));
    for (const bad of [0, 101, -1, 2.5, NaN, Infinity, '20', null, undefined]) {
      assert.equal(isValidDailyLimit(bad), false, String(bad));
    }
  });

  it('reads the saved limit, else the default', () => {
    assert.equal(dailyLimitFrom({ dailyLimit: 35 }), 35);
    assert.equal(dailyLimitFrom({ dailyLimit: 100 }), 100);
    assert.equal(dailyLimitFrom(undefined), DEFAULT_DAILY_LIMIT);
    assert.equal(dailyLimitFrom(null), DEFAULT_DAILY_LIMIT);
    assert.equal(dailyLimitFrom({}), DEFAULT_DAILY_LIMIT);
    assert.equal(dailyLimitFrom({ dailyLimit: 0 }), DEFAULT_DAILY_LIMIT);
    assert.equal(dailyLimitFrom({ dailyLimit: 101 }), DEFAULT_DAILY_LIMIT);
    assert.equal(dailyLimitFrom({ dailyLimit: '30' }), DEFAULT_DAILY_LIMIT);
  });
});

describe('manilaDay', () => {
  it('changes at 12:00 AM Manila (16:00 UTC), not at UTC midnight', () => {
    assert.equal(manilaDay(MIDNIGHT - 1), TODAY);
    assert.equal(manilaDay(MIDNIGHT), TODAY + 1);
    // UTC midnight on 2 Nov is 8:00 AM Manila, still the same Manila day as noon.
    assert.equal(manilaDay(Date.UTC(2026, 10, 2, 0, 0, 0)), TODAY);
    assert.equal(manilaDay(Date.UTC(2026, 10, 1, 15, 59, 59, 999)), TODAY - 1);
  });

  it('counts days since 1 Jan 1970 in Manila', () => {
    assert.equal(manilaDay(0), 0); // 8:00 AM Manila, 1 Jan 1970
    assert.equal(manilaDay(16 * 60 * 60 * 1000), 1); // 12:00 AM Manila, 2 Jan 1970
    assert.equal(manilaDay(-8 * 60 * 60 * 1000), 0); // 12:00 AM Manila, 1 Jan 1970
  });
});

describe('Manila midnight', () => {
  it('finds the next midnight', () => {
    assert.equal(nextManilaMidnight(NOON_MANILA), MIDNIGHT);
    assert.equal(nextManilaMidnight(MIDNIGHT - 1), MIDNIGHT);
    assert.equal(nextManilaMidnight(MIDNIGHT), MIDNIGHT + DAY_MS);
  });

  it('measures the time left', () => {
    assert.equal(msUntilManilaMidnight(NOON_MANILA), 12 * 60 * 60 * 1000);
    assert.equal(msUntilManilaMidnight(MIDNIGHT - 1), 1);
    assert.equal(msUntilManilaMidnight(MIDNIGHT), DAY_MS);
  });

  it('is near midnight within the retry window on either side', () => {
    assert.equal(MIDNIGHT_RETRY_WINDOW_MS, 2 * 60 * 1000);
    assert.equal(isNearManilaMidnight(MIDNIGHT - MIDNIGHT_RETRY_WINDOW_MS), true);
    assert.equal(isNearManilaMidnight(MIDNIGHT), true);
    assert.equal(isNearManilaMidnight(MIDNIGHT + MIDNIGHT_RETRY_WINDOW_MS), true);
    assert.equal(isNearManilaMidnight(MIDNIGHT - MIDNIGHT_RETRY_WINDOW_MS - 1), false);
    assert.equal(isNearManilaMidnight(MIDNIGHT + MIDNIGHT_RETRY_WINDOW_MS + 1), false);
    assert.equal(isNearManilaMidnight(NOON_MANILA), false);
  });
});

describe('server clock', () => {
  it('takes the server time to be the middle of the round trip', () => {
    // Sent at 1000, confirmed at 1400 (local); the server stamped 6200: 5000 ms ahead.
    assert.equal(clockOffsetMs(6200, 1000, 1400), 5000);
    assert.equal(clockOffsetMs(1200, 1000, 1400), 0);
    assert.equal(clockOffsetMs(200, 1000, 1400), -1000);
  });

  it('applies the offset', () => {
    assert.equal(serverNow(10_000, 5000), 15_000);
    assert.equal(serverNow(10_000, -1000), 9000);
  });

  it('a phone one minute slow still gets the right day after midnight', () => {
    const phone = MIDNIGHT + 30_000 - 60_000; // 11:59:30 PM on the phone
    assert.equal(manilaDay(phone), TODAY);
    assert.equal(manilaDay(serverNow(phone, 60_000)), TODAY + 1);
  });
});

describe("today's count", () => {
  it('counts only a count stored for today', () => {
    assert.equal(acceptedOn({ acceptedCount: 3, acceptedDay: TODAY }, TODAY), 3);
    assert.equal(acceptedOn({ acceptedCount: 3, acceptedDay: TODAY - 1 }, TODAY), 0);
  });

  it('treats missing or malformed fields as 0', () => {
    assert.equal(acceptedOn({}, TODAY), 0);
    assert.equal(acceptedOn({ acceptedCount: 3 }, TODAY), 0);
    assert.equal(acceptedOn({ acceptedDay: TODAY }, TODAY), 0);
    assert.equal(acceptedOn({ acceptedCount: -2, acceptedDay: TODAY }, TODAY), 0);
    assert.equal(acceptedOn({ acceptedCount: 1.5, acceptedDay: TODAY }, TODAY), 0);
    assert.equal(acceptedOn({ acceptedCount: '3', acceptedDay: TODAY }, TODAY), 0);
    assert.equal(acceptedOn({ acceptedCount: 3, acceptedDay: String(TODAY) }, TODAY), 0);
  });
});

describe('quotaStatus', () => {
  it('reports the remaining slots', () => {
    assert.deepEqual(quotaStatus(3, 20), { acceptedToday: 3, limit: 20, remaining: 17, reached: false });
    assert.deepEqual(quotaStatus(0, 1), { acceptedToday: 0, limit: 1, remaining: 1, reached: false });
  });

  it('is reached at the limit', () => {
    assert.deepEqual(quotaStatus(20, 20), { acceptedToday: 20, limit: 20, remaining: 0, reached: true });
  });

  it('stays reached, never negative, when the limit is lowered below the count', () => {
    assert.deepEqual(quotaStatus(12, 10), { acceptedToday: 12, limit: 10, remaining: 0, reached: true });
  });

  it('isAtDailyLimit uses only today', () => {
    assert.equal(isAtDailyLimit({ acceptedCount: 20, acceptedDay: TODAY }, 20, TODAY), true);
    assert.equal(isAtDailyLimit({ acceptedCount: 19, acceptedDay: TODAY }, 20, TODAY), false);
    assert.equal(isAtDailyLimit({ acceptedCount: 20, acceptedDay: TODAY - 1 }, 20, TODAY), false);
    // Limit raised mid-day: can accept again.
    assert.equal(isAtDailyLimit({ acceptedCount: 20, acceptedDay: TODAY }, 25, TODAY), false);
    assert.equal(isAtDailyLimit({}, 1, TODAY), false);
  });
});

describe('fieldsAfterAccept', () => {
  it('adds one on the same day', () => {
    assert.deepEqual(fieldsAfterAccept({ acceptedCount: 3, acceptedDay: TODAY }, TODAY), {
      acceptedCount: 4,
      acceptedDay: TODAY,
    });
  });

  it('starts a new day at 1', () => {
    assert.deepEqual(fieldsAfterAccept({ acceptedCount: 20, acceptedDay: TODAY - 1 }, TODAY), {
      acceptedCount: 1,
      acceptedDay: TODAY,
    });
  });

  it('starts drivers without the fields at 1', () => {
    assert.deepEqual(fieldsAfterAccept({}, TODAY), { acceptedCount: 1, acceptedDay: TODAY });
  });
});

describe('canRefundSlot', () => {
  const acceptedToday = new Date(NOON_MANILA);
  const passengerCancelled: RefundBookingFields = {
    status: 'cancelled',
    cancelledBy: 'passenger',
    startedAt: null,
    acceptedAt: acceptedToday,
  };
  const counted = { acceptedCount: 2, acceptedDay: TODAY };

  it('gives the slot back when the passenger cancelled before the trip started, today', () => {
    assert.equal(canRefundSlot(passengerCancelled, counted, TODAY), true);
  });

  it('not for a driver cancel, or a booking that is not cancelled', () => {
    assert.equal(canRefundSlot({ ...passengerCancelled, cancelledBy: 'driver' }, counted, TODAY), false);
    assert.equal(canRefundSlot({ ...passengerCancelled, cancelledBy: null }, counted, TODAY), false);
    assert.equal(canRefundSlot({ ...passengerCancelled, status: 'completed' }, counted, TODAY), false);
  });

  it('not once the trip started', () => {
    const started = { ...passengerCancelled, startedAt: new Date(NOON_MANILA + 60_000) };
    assert.equal(canRefundSlot(started, counted, TODAY), false);
  });

  it('not for a booking accepted on another day', () => {
    const yesterday = { ...passengerCancelled, acceptedAt: new Date(NOON_MANILA - DAY_MS) };
    assert.equal(canRefundSlot(yesterday, counted, TODAY), false);
    // Accepted 11:59 PM, released after midnight: the new day's count is not lowered.
    const lateNight = { ...passengerCancelled, acceptedAt: new Date(MIDNIGHT - 60_000) };
    assert.equal(canRefundSlot(lateNight, { acceptedCount: 1, acceptedDay: TODAY + 1 }, TODAY + 1), false);
    assert.equal(canRefundSlot({ ...passengerCancelled, acceptedAt: null }, counted, TODAY), false);
  });

  it("not when today's count is 0 or stored for another day", () => {
    assert.equal(canRefundSlot(passengerCancelled, { acceptedCount: 0, acceptedDay: TODAY }, TODAY), false);
    assert.equal(canRefundSlot(passengerCancelled, { acceptedCount: 2, acceptedDay: TODAY - 1 }, TODAY), false);
    assert.equal(canRefundSlot(passengerCancelled, {}, TODAY), false);
  });
});

describe('fieldsAfterRefund', () => {
  it("lowers today's count by one", () => {
    assert.deepEqual(fieldsAfterRefund({ acceptedCount: 2, acceptedDay: TODAY }, TODAY), {
      acceptedCount: 1,
      acceptedDay: TODAY,
    });
  });

  it('never goes below 0', () => {
    assert.deepEqual(fieldsAfterRefund({}, TODAY), { acceptedCount: 0, acceptedDay: TODAY });
  });
});

describe('text', () => {
  it('shows the count against the limit', () => {
    assert.equal(acceptedTodayText(quotaStatus(3, 20)), 'Accepted today: 3 of 20');
    assert.equal(acceptedTodayText(quotaStatus(12, 10)), 'Accepted today: 12 of 10');
  });

  it('has the limit-reached message', () => {
    assert.equal(DAILY_LIMIT_REACHED_MESSAGE, 'Daily limit reached. You can accept again after 12:00 AM.');
  });
});
