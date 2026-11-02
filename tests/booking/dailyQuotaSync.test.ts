/// <reference types="node" />

// The default daily limit and its range are written in three places (the app, the rules
// and the admin website); this keeps the copies equal. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  DAILY_LIMIT_RANGE as ADMIN_DAILY_LIMIT_RANGE,
  DEFAULT_DAILY_LIMIT as ADMIN_DEFAULT_DAILY_LIMIT,
  isValidDailyLimit as adminIsValidDailyLimit,
  manilaDay as adminManilaDay,
} from '../../admin/src/quota/quota.ts';
import {
  DAILY_LIMIT_RANGE,
  DEFAULT_DAILY_LIMIT,
  isValidDailyLimit,
  manilaDay,
} from '../../src/utils/dailyQuota.ts';

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');

describe('default daily limit copies', () => {
  it('firestore.rules defaultDailyLimit() equals DEFAULT_DAILY_LIMIT', () => {
    const match = /function defaultDailyLimit\(\)\s*\{\s*return (\d+);\s*\}/.exec(rules);
    assert.ok(match, 'defaultDailyLimit() not found in firestore.rules');
    assert.equal(Number(match[1]), DEFAULT_DAILY_LIMIT);
  });

  it('firestore.rules allows the same dailyLimit range', () => {
    assert.match(rules, new RegExp(`data\\.dailyLimit >= ${DAILY_LIMIT_RANGE.min}\\b`));
    assert.match(rules, new RegExp(`data\\.dailyLimit <= ${DAILY_LIMIT_RANGE.max}\\b`));
  });

  it('the admin website copy equals the app (default and range)', () => {
    assert.equal(ADMIN_DEFAULT_DAILY_LIMIT, DEFAULT_DAILY_LIMIT);
    assert.deepEqual(ADMIN_DAILY_LIMIT_RANGE, DAILY_LIMIT_RANGE);
  });

  it('the admin website validates and counts days the same way as the app', () => {
    for (const value of [0, 1, 20, 100, 101, 2.5, -1, '20', null]) {
      assert.equal(adminIsValidDailyLimit(value), isValidDailyLimit(value), String(value));
    }
    const midnight = Date.UTC(2026, 10, 2, 16, 0, 0); // 12:00 AM Manila, 3 Nov 2026
    for (const ms of [0, midnight - 1, midnight, midnight + 1, Date.UTC(2026, 10, 2, 0, 0, 0)]) {
      assert.equal(adminManilaDay(ms), manilaDay(ms), String(ms));
    }
  });

  it('the default is a valid limit', () => {
    assert.ok(DEFAULT_DAILY_LIMIT >= DAILY_LIMIT_RANGE.min && DEFAULT_DAILY_LIMIT <= DAILY_LIMIT_RANGE.max);
  });
});
