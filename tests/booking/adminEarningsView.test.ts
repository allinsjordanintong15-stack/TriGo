/// <reference types="node" />

// Earnings page view logic (admin/src/earnings/earningsView.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  balanceParams,
  DEFAULT_BALANCE_FILTERS,
  dueText,
  earningsTab,
  historyParams,
  manilaShortDay,
  matchesBalanceChip,
  readBalanceFilters,
  readHistoryFilter,
  readPageParam,
  visibleBalanceChips,
} from '../../admin/src/earnings/earningsView.ts';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Manila midnight starting Nov 10, 2026 (= Nov 9 16:00 UTC). */
const NOV10 = Date.UTC(2026, 10, 9, 16);
const peso = (c: number) => `₱${(c / 100).toFixed(2)}`;

const summary = (status: 'paid_up' | 'due' | 'overdue' | 'suspended', extra: Partial<Record<string, number | null>> = {}) => ({
  status,
  balanceCentavos: 4210,
  overdueCentavos: 4210,
  dueAtMillis: NOV10,
  graceEndsAtMillis: NOV10 + 2 * DAY,
  ...extra,
});

describe('dueText', () => {
  it('counts Manila days left until the last day to pay', () => {
    // Nov 7, 10:00 Manila: the last day is Nov 9, two days away.
    assert.equal(dueText(summary('due'), NOV10 - 3 * DAY + 10 * HOUR, peso), 'Pay by Nov 9 · 2 days left');
    assert.equal(dueText(summary('due'), NOV10 - 2 * DAY + HOUR, peso), 'Pay by Nov 9 · 1 day left');
    // Nov 9, 11 PM Manila: still the last day.
    assert.equal(dueText(summary('due'), NOV10 - HOUR, peso), 'Pay by Nov 9 · last day');
  });

  it('shows the overdue amount and the last grace day', () => {
    assert.equal(dueText(summary('overdue'), NOV10 + HOUR, peso), '₱42.10 overdue · grace ends Nov 11');
  });

  it('shows when the suspension started (the day after the grace period)', () => {
    assert.equal(dueText(summary('suspended'), NOV10 + 3 * DAY, peso), 'Suspended since Nov 12');
  });

  it('shows a dash when paid up', () => {
    assert.equal(dueText(summary('paid_up', { dueAtMillis: null, graceEndsAtMillis: null }), NOV10, peso), '—');
  });

  it('formats Manila days whatever the browser time zone', () => {
    assert.equal(manilaShortDay(NOV10), 'Nov 10');
    assert.equal(manilaShortDay(NOV10 - 1), 'Nov 9');
  });
});

describe('tabs and URL state', () => {
  it('knows the four tabs', () => {
    assert.equal(earningsTab('overview'), 'overview');
    assert.equal(earningsTab('cash-outs'), 'cash-outs');
    assert.equal(earningsTab('nope'), null);
    assert.equal(earningsTab(undefined), null);
  });

  it('round-trips the balance filters', () => {
    assert.deepEqual(readBalanceFilters(new URLSearchParams('')), DEFAULT_BALANCE_FILTERS);
    const filters = { search: 'carlo', status: 'overdue', pageSize: 20 } as const;
    const params = balanceParams(filters, 2);
    assert.deepEqual(params, { q: 'carlo', status: 'overdue', rows: '20', page: '2' });
    assert.deepEqual(readBalanceFilters(new URLSearchParams(params)), filters);
    assert.equal(readPageParam(new URLSearchParams(params)), 2);
    assert.deepEqual(balanceParams(DEFAULT_BALANCE_FILTERS, 1), {});
    assert.deepEqual(readBalanceFilters(new URLSearchParams('status=lost&rows=7')), DEFAULT_BALANCE_FILTERS);
  });

  it('keeps the Dashboard "behind" filter as an extra chip', () => {
    assert.equal(readBalanceFilters(new URLSearchParams('status=behind')).status, 'behind');
    assert.ok(visibleBalanceChips('behind').includes('behind'));
    assert.ok(!visibleBalanceChips('all').includes('behind'));
    assert.equal(matchesBalanceChip('overdue', 'behind'), true);
    assert.equal(matchesBalanceChip('suspended', 'behind'), true);
    assert.equal(matchesBalanceChip('due', 'behind'), false);
    assert.equal(matchesBalanceChip('due', 'all'), true);
    assert.equal(matchesBalanceChip(null, 'due'), false);
  });

  it('round-trips the payment history filter', () => {
    assert.deepEqual(readHistoryFilter(new URLSearchParams('')), { status: 'all', page: 1 });
    assert.deepEqual(historyParams('rejected', 3), { history: 'rejected', hpage: '3' });
    assert.deepEqual(readHistoryFilter(new URLSearchParams(historyParams('rejected', 3))), { status: 'rejected', page: 3 });
    assert.deepEqual(historyParams('all', 1), {});
  });
});
