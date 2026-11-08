/// <reference types="node" />

// Driver rating display and rating-window logic (src/utils/rating.ts). Run with
// `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RATING_COMMENT_MAX_LENGTH, RATING_WINDOW_DAYS } from '../../src/constants/rating.ts';
import {
  averageRating,
  formatDriverRating,
  isWithinRatingWindow,
  keepTagsForStars,
  normalizeRatingComment,
  ratingTagLabels,
  ratingWindowEndsAt,
  readRatingSummary,
  summaryAfterRating,
  tagsForStars,
  validateRating,
} from '../../src/utils/rating.ts';

const DAY = 24 * 60 * 60 * 1000;
const COMPLETED_AT = new Date(Date.UTC(2026, 10, 8, 4, 0));

describe('averageRating / formatDriverRating', () => {
  it('shows "New" with no summary or zero ratings', () => {
    assert.equal(averageRating(null), null);
    assert.equal(formatDriverRating(null), 'New');
    assert.equal(formatDriverRating({ ratingSum: 0, ratingCount: 0 }), 'New');
  });

  it('rounds the average to one decimal', () => {
    assert.equal(formatDriverRating({ ratingSum: 14, ratingCount: 3 }), '4.7'); // 4.666…
    assert.equal(formatDriverRating({ ratingSum: 13, ratingCount: 3 }), '4.3'); // 4.333…
    assert.equal(formatDriverRating({ ratingSum: 9, ratingCount: 2 }), '4.5');
    assert.equal(formatDriverRating({ ratingSum: 5, ratingCount: 1 }), '5.0');
    assert.equal(averageRating({ ratingSum: 1, ratingCount: 1 }), 1);
  });
});

describe('readRatingSummary', () => {
  it('reads whole, non-negative numbers', () => {
    assert.deepEqual(readRatingSummary({ ratingSum: 14, ratingCount: 3, lastBookingId: 'b' }), {
      ratingSum: 14,
      ratingCount: 3,
    });
  });

  it('rejects missing, fractional, negative or non-numeric values', () => {
    assert.equal(readRatingSummary(undefined), null);
    assert.equal(readRatingSummary({ ratingSum: 4.5, ratingCount: 1 }), null);
    assert.equal(readRatingSummary({ ratingSum: -1, ratingCount: 1 }), null);
    assert.equal(readRatingSummary({ ratingSum: '5', ratingCount: 1 }), null);
    assert.equal(readRatingSummary({ ratingSum: 5 }), null);
  });
});

describe('summaryAfterRating', () => {
  it('starts from zero without a summary and adds exactly one rating', () => {
    assert.deepEqual(summaryAfterRating(null, 4), { ratingSum: 4, ratingCount: 1 });
    assert.deepEqual(summaryAfterRating({ ratingSum: 14, ratingCount: 3 }, 5), {
      ratingSum: 19,
      ratingCount: 4,
    });
  });
});

describe('rating window', () => {
  const trip = { status: 'completed', driverId: 'driver1', completedAt: COMPLETED_AT };

  it(`closes ${RATING_WINDOW_DAYS} days after completion`, () => {
    assert.equal(RATING_WINDOW_DAYS, 7);
    assert.equal(ratingWindowEndsAt(COMPLETED_AT), COMPLETED_AT.getTime() + 7 * DAY);
  });

  it('is open right after completion and until just before the end', () => {
    assert.equal(isWithinRatingWindow(trip, COMPLETED_AT.getTime()), true);
    assert.equal(isWithinRatingWindow(trip, COMPLETED_AT.getTime() + 7 * DAY - 1), true);
  });

  it('is closed at and after the end', () => {
    assert.equal(isWithinRatingWindow(trip, COMPLETED_AT.getTime() + 7 * DAY), false);
    assert.equal(isWithinRatingWindow(trip, COMPLETED_AT.getTime() + 30 * DAY), false);
  });

  it('is closed for trips that are not completed or have no driver or completion time', () => {
    const now = COMPLETED_AT.getTime() + DAY;
    assert.equal(isWithinRatingWindow({ ...trip, status: 'cancelled' }, now), false);
    assert.equal(isWithinRatingWindow({ ...trip, driverId: null }, now), false);
    assert.equal(isWithinRatingWindow({ ...trip, completedAt: null }, now), false);
  });
});

describe('tags', () => {
  it('offers positive tags for 4–5 stars, the others for 1–3, none before a pick', () => {
    assert.deepEqual(tagsForStars(null), []);
    assert.ok(tagsForStars(5).every((tag) => tag.positive));
    assert.ok(tagsForStars(4).some((tag) => tag.id === 'on_time'));
    assert.ok(tagsForStars(2).every((tag) => !tag.positive));
    assert.ok(tagsForStars(3).some((tag) => tag.id === 'late_pickup'));
  });

  it('drops picked tags that no longer fit after the stars change', () => {
    assert.deepEqual(keepTagsForStars(['on_time', 'friendly'], 5), ['on_time', 'friendly']);
    assert.deepEqual(keepTagsForStars(['on_time', 'friendly'], 2), []);
    assert.deepEqual(keepTagsForStars(['rude', 'on_time'], 1), ['rude']);
  });

  it('labels stored tags in list order and skips unknown ids', () => {
    assert.deepEqual(ratingTagLabels(['friendly', 'on_time', 'unknown']), ['On time', 'Friendly']);
  });
});

describe('validateRating / normalizeRatingComment', () => {
  it('needs a whole number of stars from 1 to 5', () => {
    assert.equal(validateRating(null, ''), 'Choose 1 to 5 stars.');
    assert.equal(validateRating(0, ''), 'Choose 1 to 5 stars.');
    assert.equal(validateRating(6, ''), 'Choose 1 to 5 stars.');
    assert.equal(validateRating(4.5, ''), 'Choose 1 to 5 stars.');
    assert.equal(validateRating(1, ''), null);
    assert.equal(validateRating(5, ''), null);
  });

  it(`allows a comment up to ${RATING_COMMENT_MAX_LENGTH} characters`, () => {
    assert.equal(validateRating(5, 'x'.repeat(RATING_COMMENT_MAX_LENGTH)), null);
    assert.match(validateRating(5, 'x'.repeat(RATING_COMMENT_MAX_LENGTH + 1)) ?? '', /300/);
  });

  it('stores a trimmed comment, or null when empty', () => {
    assert.equal(normalizeRatingComment('  Great ride  '), 'Great ride');
    assert.equal(normalizeRatingComment('   '), null);
  });
});
