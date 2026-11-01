/// <reference types="node" />

// Shared date/time formats (src/utils/dateTime.ts). Run with `npm run test:unit`.
// Dates are built in local time, the same zone the helpers format in.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatDate,
  formatDateTime,
  formatTime,
  formatTimeAgo,
  isSameDay,
} from '../../src/utils/dateTime.ts';

const EVENING = new Date(2026, 9, 21, 19, 34);
const MINUTE = 60 * 1000;

describe('formatDate / formatTime / formatDateTime', () => {
  it('formats "Oct 21, 2026 · 7:34 PM"', () => {
    assert.equal(formatDate(EVENING), 'Oct 21, 2026');
    assert.equal(formatTime(EVENING), '7:34 PM');
    assert.equal(formatDateTime(EVENING), 'Oct 21, 2026 · 7:34 PM');
  });

  it('uses 12 for midnight and noon and pads minutes', () => {
    assert.equal(formatTime(new Date(2026, 0, 1, 0, 5)), '12:05 AM');
    assert.equal(formatTime(new Date(2026, 0, 1, 12, 0)), '12:00 PM');
    assert.equal(formatTime(new Date(2026, 0, 1, 11, 59)), '11:59 AM');
  });

  it('shows "—" for a missing date', () => {
    assert.equal(formatDate(null), '—');
    assert.equal(formatTime(null), '—');
    assert.equal(formatDateTime(null), '—');
  });
});

describe('isSameDay', () => {
  it('compares local calendar days', () => {
    assert.equal(isSameDay(new Date(2026, 9, 21, 0, 0), new Date(2026, 9, 21, 23, 59)), true);
    assert.equal(isSameDay(new Date(2026, 9, 21, 23, 59), new Date(2026, 9, 22, 0, 0)), false);
  });
});

describe('formatTimeAgo', () => {
  const now = EVENING.getTime();
  const ago = (ms: number) => formatTimeAgo(new Date(now - ms), now);

  it('says "Just now" under a minute and for future times', () => {
    assert.equal(ago(0), 'Just now');
    assert.equal(ago(59 * 1000), 'Just now');
    assert.equal(ago(-5 * MINUTE), 'Just now');
  });

  it('counts whole minutes, then whole hours', () => {
    assert.equal(ago(MINUTE), '1 min ago');
    assert.equal(ago(59 * MINUTE + 59 * 1000), '59 min ago');
    assert.equal(ago(60 * MINUTE), '1 hr ago');
    assert.equal(ago(23 * 60 * MINUTE + 59 * MINUTE), '23 hr ago');
  });

  it('shows the date from 24 hours', () => {
    assert.equal(ago(24 * 60 * MINUTE), 'Oct 20, 2026');
  });

  it('ticks as now moves on', () => {
    const createdAt = new Date(now);
    assert.equal(formatTimeAgo(createdAt, now + 4 * MINUTE), '4 min ago');
    assert.equal(formatTimeAgo(createdAt, now + 5 * MINUTE), '5 min ago');
  });
});
