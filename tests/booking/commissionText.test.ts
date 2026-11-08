/// <reference types="node" />

// Earnings tab commission text (src/utils/commissionText.ts). Run with `npm run test:unit`.
// All instants are built in UTC; Manila is UTC+8. The helpers never use the phone's zone.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type CommissionAccountTimes,
  commissionStatus,
  formatManilaDay,
  formatPeriodEndDay,
  periodEndMillis,
} from '../../src/utils/commission.ts';
import { formatPayBy, overdueNotice } from '../../src/utils/commissionText.ts';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** An instant given as a Manila wall-clock time. */
function manila(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour - 8, minute);
}

/** Period 3: 3 days from a trip on Nov 7, 15:30 Manila, so it covers Nov 7, 8 and 9. */
const START = manila(2026, 11, 7, 15, 30);

function account(startAtMillis: number, overrides: Partial<CommissionAccountTimes> = {}) {
  return {
    accruedCentavos: 4210,
    paidCentavos: 0,
    current: { seq: 3, startAtMillis, periodDays: 3, graceDays: 2, startCentavos: 0 },
    unpaid: null,
    ...overrides,
  } satisfies CommissionAccountTimes;
}

describe('formatPayBy: the due day matches the period end', () => {
  it('the period ends at Manila midnight after Nov 9, shown as Nov 9 in the details', () => {
    const end = periodEndMillis(START, 3);
    assert.equal(end, manila(2026, 11, 10, 0, 0));
    assert.equal(
      `${formatManilaDay(START)} – ${formatPeriodEndDay(end)}`,
      'Nov 7, 2026 – Nov 9, 2026',
    );
  });

  it('says Nov 9 at mid-day, with the time left to that midnight', () => {
    const now = manila(2026, 11, 8, 12, 0);
    const summary = commissionStatus(account(START), now);
    assert.equal(summary.status, 'due');
    assert.equal(summary.dueAtMillis, periodEndMillis(START, 3));
    assert.equal(formatPayBy(summary, now), 'Pay by the end of Nov 9, 2026 · 1 day 12 hr left');
  });

  it('says Nov 9 just before the due midnight', () => {
    const now = manila(2026, 11, 9, 23, 30);
    assert.equal(
      formatPayBy(commissionStatus(account(START), now), now),
      'Pay by the end of Nov 9, 2026 · 30 min left',
    );
  });

  it('periods starting at 00:00 or 23:59 Manila on Nov 7 end on Nov 9 too', () => {
    for (const start of [manila(2026, 11, 7, 0, 0), manila(2026, 11, 7, 23, 59)]) {
      const now = manila(2026, 11, 8, 9, 0);
      const summary = commissionStatus(account(start), now);
      assert.equal(formatPeriodEndDay(periodEndMillis(start, 3)), 'Nov 9, 2026');
      assert.match(formatPayBy(summary, now) ?? '', /^Pay by the end of Nov 9, 2026 · /);
    }
  });

  it('at exactly the due midnight the period is overdue: pay by the grace end (Nov 11)', () => {
    const now = manila(2026, 11, 10, 0, 0);
    const summary = commissionStatus(account(START), now);
    assert.equal(summary.status, 'overdue');
    assert.equal(formatPayBy(summary, now), 'Pay by the end of Nov 11, 2026 · 2 days left');
  });

  it('shows no countdown when paid up or suspended', () => {
    const paid = commissionStatus(account(START, { paidCentavos: 4210 }), START + HOUR);
    assert.equal(formatPayBy(paid, START + HOUR), null);
    const late = manila(2026, 11, 12, 0, 0);
    const suspended = commissionStatus(account(START), late);
    assert.equal(suspended.status, 'suspended');
    assert.equal(formatPayBy(suspended, late), null);
  });
});

describe('overdueNotice', () => {
  it('names the overdue amount and the grace end while overdue', () => {
    const now = manila(2026, 11, 10, 9, 0);
    const notice = overdueNotice(commissionStatus(account(START), now));
    assert.deepEqual(notice, {
      title: '₱42.10 overdue',
      message:
        'It was due by the end of Nov 9, 2026. Pay ₱42.10 by the end of Nov 11, 2026 (grace period) to keep accepting new requests. Only payments TriGo has confirmed count, so pay early.',
    });
  });

  it('names the overdue amount needed to accept again once suspended', () => {
    const now = manila(2026, 11, 12, 0, 0);
    const notice = overdueNotice(commissionStatus(account(START), now));
    assert.deepEqual(notice, {
      title: 'Suspended: ₱42.10 overdue',
      message:
        'Your grace period ended on Nov 11, 2026. Pay ₱42.10 to accept new requests again; you can accept again once TriGo confirms your payment. You can still finish your current trip.',
    });
  });

  it('uses only the closed periods’ amount, not the running period, when one is unpaid', () => {
    // Period 2 (₱30.00) is closed and unpaid; Period 3 has added ₱12.10 so far.
    const unpaidStart = START - 3 * DAY;
    const withUnpaid = account(START, {
      current: { seq: 3, startAtMillis: START, periodDays: 3, graceDays: 2, startCentavos: 3000 },
      unpaid: { seq: 2, startAtMillis: unpaidStart, periodDays: 3, graceDays: 2 },
    });
    const now = manila(2026, 11, 8, 12, 0);
    const summary = commissionStatus(withUnpaid, now);
    assert.equal(summary.status, 'overdue');
    assert.equal(summary.overdueCentavos, 3000);
    assert.equal(overdueNotice(summary)?.title, '₱30.00 overdue');
  });

  it('is null when due or paid up', () => {
    assert.equal(overdueNotice(commissionStatus(account(START), START + HOUR)), null);
    assert.equal(
      overdueNotice(commissionStatus(account(START, { paidCentavos: 4210 }), START + HOUR)),
      null,
    );
  });
});
