/// <reference types="node" />

// Rating limits are written in the app and in firestore.rules, and the display helpers in
// the app and on the admin website; this keeps the copies equal. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  formatDriverRating as adminFormatDriverRating,
  readRatingSummary as adminReadRatingSummary,
} from '../../admin/src/drivers/driverRatings.ts';
import {
  RATING_COMMENT_MAX_LENGTH,
  RATING_TAG_IDS,
  RATING_WINDOW_DAYS,
} from '../../src/constants/rating.ts';
import { formatDriverRating, readRatingSummary } from '../../src/utils/rating.ts';

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');

describe('rating copies in firestore.rules', () => {
  it('ratingWindowDays() equals RATING_WINDOW_DAYS', () => {
    const match = /function ratingWindowDays\(\)\s*\{\s*return (\d+);\s*\}/.exec(rules);
    assert.ok(match, 'ratingWindowDays() not found');
    assert.equal(Number(match[1]), RATING_WINDOW_DAYS);
  });

  it('ratingCommentMaxLength() equals RATING_COMMENT_MAX_LENGTH', () => {
    const match = /function ratingCommentMaxLength\(\)\s*\{\s*return (\d+);\s*\}/.exec(rules);
    assert.ok(match, 'ratingCommentMaxLength() not found');
    assert.equal(Number(match[1]), RATING_COMMENT_MAX_LENGTH);
  });

  it('ratingTagIds() lists exactly RATING_TAGS', () => {
    const match = /function ratingTagIds\(\)\s*\{\s*return \[([^\]]*)\];\s*\}/.exec(rules);
    assert.ok(match, 'ratingTagIds() not found');
    const ids = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(ids, [...RATING_TAG_IDS]);
  });
});

describe('admin website copy of the rating display', () => {
  const samples = [
    undefined,
    { ratingSum: 0, ratingCount: 0 },
    { ratingSum: 14, ratingCount: 3 },
    { ratingSum: 13, ratingCount: 3 },
    { ratingSum: 5, ratingCount: 1 },
    { ratingSum: 4.5, ratingCount: 1 },
    { ratingSum: -1, ratingCount: 2 },
  ];

  it('reads and formats every sample the same way', () => {
    for (const sample of samples) {
      assert.deepEqual(adminReadRatingSummary(sample), readRatingSummary(sample));
      assert.equal(
        adminFormatDriverRating(adminReadRatingSummary(sample)),
        formatDriverRating(readRatingSummary(sample)),
      );
    }
  });
});
