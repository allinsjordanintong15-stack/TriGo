/// <reference types="node" />

// Admin Quota page helpers (admin/src/quota/quota.ts): the limit form and the drivers
// table. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  acceptedOn,
  buildQuotaRows,
  manilaDay,
  parseDailyLimit,
  readSavedLimit,
} from '../../admin/src/quota/quota.ts';

const TODAY = manilaDay(Date.UTC(2026, 10, 2, 4, 0, 0)); // 12:00 PM Manila, 2 Nov 2026

describe('parseDailyLimit', () => {
  it('accepts whole numbers 1-100, with spaces around', () => {
    assert.deepEqual(parseDailyLimit('20'), { value: 20 });
    assert.deepEqual(parseDailyLimit(' 1 '), { value: 1 });
    assert.deepEqual(parseDailyLimit('100'), { value: 100 });
  });

  it('explains what is wrong', () => {
    assert.deepEqual(parseDailyLimit(''), { error: 'Required.' });
    assert.deepEqual(parseDailyLimit('  '), { error: 'Required.' });
    for (const text of ['2.5', '-3', 'ten', '1e2']) {
      assert.deepEqual(parseDailyLimit(text), { error: 'Enter a whole number.' }, text);
    }
    assert.deepEqual(parseDailyLimit('0'), { error: 'Enter a number from 1 to 100.' });
    assert.deepEqual(parseDailyLimit('101'), { error: 'Enter a number from 1 to 100.' });
  });
});

describe('readSavedLimit', () => {
  it('reads a valid saved limit, else null (the default applies)', () => {
    assert.equal(readSavedLimit({ dailyLimit: 35 }), 35);
    assert.equal(readSavedLimit(undefined), null);
    assert.equal(readSavedLimit({}), null);
    assert.equal(readSavedLimit({ dailyLimit: 0 }), null);
    assert.equal(readSavedLimit({ dailyLimit: '20' }), null);
  });
});

describe('acceptedOn (admin)', () => {
  it('counts only today', () => {
    assert.equal(acceptedOn({ acceptedCount: 4, acceptedDay: TODAY }, TODAY), 4);
    assert.equal(acceptedOn({ acceptedCount: 4, acceptedDay: TODAY - 1 }, TODAY), 0);
    assert.equal(acceptedOn({}, TODAY), 0);
  });
});

describe('buildQuotaRows', () => {
  const driver = (uid: string, fullName: string, count: number | null, extra: Record<string, unknown> = {}) => ({
    uid,
    data: {
      fullName,
      vehiclePlate: `${uid.toUpperCase()} 123`,
      vehicleType: 'tricycle',
      isVerified: true,
      ...(count === null ? {} : { acceptedCount: count, acceptedDay: TODAY }),
      ...extra,
    },
  });

  it('lists verified drivers, fewest slots left first', () => {
    const rows = buildQuotaRows(
      [
        driver('a', 'Ana', 2),
        driver('b', 'Ben', 5),
        driver('c', 'Cora', null),
        driver('d', 'Dan', 5, { isVerified: false }),
        driver('e', 'Eli', 9, { acceptedDay: TODAY - 1 }),
      ],
      5,
      TODAY,
    );
    assert.deepEqual(
      rows.map((row) => [row.uid, row.acceptedToday, row.remaining, row.reached]),
      [
        ['b', 5, 0, true],
        ['a', 2, 3, false],
        ['c', 0, 5, false],
        ['e', 0, 5, false],
      ],
    );
  });

  it('a lowered limit: over the limit counts as at it, never negative', () => {
    const [row] = buildQuotaRows([driver('a', 'Ana', 7)], 3, TODAY);
    assert.equal(row.remaining, 0);
    assert.equal(row.reached, true);
  });

  it('ties: most accepted first, then by name', () => {
    const rows = buildQuotaRows(
      [driver('z', 'Zed', 0), driver('y', 'Amy', 0), driver('x', 'Mia', 1)],
      1,
      TODAY,
    );
    assert.deepEqual(rows.map((row) => row.uid), ['x', 'y', 'z']);
  });
});
