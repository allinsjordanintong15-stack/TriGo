/// <reference types="node" />

// The default daily limit is written in more than one place; this keeps the copies equal.
// Step 5 adds the admin website's copy here too. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { DAILY_LIMIT_RANGE, DEFAULT_DAILY_LIMIT } from '../../src/utils/dailyQuota.ts';

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

  it('the default is a valid limit', () => {
    assert.ok(DEFAULT_DAILY_LIMIT >= DAILY_LIMIT_RANGE.min && DEFAULT_DAILY_LIMIT <= DAILY_LIMIT_RANGE.max);
  });
});
