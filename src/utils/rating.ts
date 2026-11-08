// Driver rating display and the "can this trip still be rated" check. Relative imports of
// alias-free files only, so plain Node tests can load this file (tests/booking/rating.test.ts).
// The admin website has its own copy of the display helpers
// (admin/src/drivers/driverRatings.ts, kept equal by tests/booking/ratingSync.test.ts).

import {
  RATING_COMMENT_MAX_LENGTH,
  RATING_TAGS,
  RATING_WINDOW_DAYS,
  type RatingTagId,
} from '../constants/rating.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** driverRatings/{driverId}: the sum and count of all stars this driver has received. */
export interface DriverRatingSummary {
  ratingSum: number;
  ratingCount: number;
}

/** The average to one decimal (4.67 → 4.7), or null when there are no ratings yet. */
export function averageRating(summary: DriverRatingSummary | null): number | null {
  if (!summary || summary.ratingCount <= 0) return null;
  return Math.round((summary.ratingSum / summary.ratingCount) * 10) / 10;
}

/** "4.7", "5.0", or "New" when the driver has no ratings (or no summary document). */
export function formatDriverRating(summary: DriverRatingSummary | null): string {
  const average = averageRating(summary);
  return average === null ? 'New' : average.toFixed(1);
}

/** Reads a stored summary; null unless both numbers are whole and not negative. */
export function readRatingSummary(data: unknown): DriverRatingSummary | null {
  if (!data || typeof data !== 'object') return null;
  const { ratingSum, ratingCount } = data as Record<string, unknown>;
  if (
    typeof ratingSum !== 'number' ||
    typeof ratingCount !== 'number' ||
    !Number.isInteger(ratingSum) ||
    !Number.isInteger(ratingCount) ||
    ratingSum < 0 ||
    ratingCount < 0
  ) {
    return null;
  }
  return { ratingSum, ratingCount };
}

/** When rating a trip completed at `completedAt` closes (the rules use server time). */
export function ratingWindowEndsAt(completedAt: Date): number {
  return completedAt.getTime() + RATING_WINDOW_DAYS * DAY_MS;
}

export interface RateableTrip {
  status: string;
  driverId: string | null;
  completedAt: Date | null;
}

/** True when the passenger may still rate this trip (completed, has a driver, in the window). */
export function isWithinRatingWindow(trip: RateableTrip, nowMillis: number): boolean {
  return (
    trip.status === 'completed' &&
    trip.driverId !== null &&
    trip.completedAt !== null &&
    nowMillis < ratingWindowEndsAt(trip.completedAt)
  );
}

/** Tags offered for a star count: positive for 4–5, the others for 1–3, none before a pick. */
export function tagsForStars(stars: number | null): (typeof RATING_TAGS)[number][] {
  if (stars === null) return [];
  const positive = stars >= 4;
  return RATING_TAGS.filter((tag) => tag.positive === positive);
}

/** Keeps only the picked tags still offered for `stars` (after the stars change). */
export function keepTagsForStars(tags: readonly RatingTagId[], stars: number | null): RatingTagId[] {
  const offered = new Set<string>(tagsForStars(stars).map((tag) => tag.id));
  return tags.filter((tag) => offered.has(tag));
}

/** Labels of stored tag ids, in list order; unknown ids are skipped. */
export function ratingTagLabels(tagIds: readonly string[]): string[] {
  return RATING_TAGS.filter((tag) => tagIds.includes(tag.id)).map((tag) => tag.label);
}

/** The comment as stored: trimmed, null when empty. */
export function normalizeRatingComment(text: string): string | null {
  const trimmed = text.trim();
  return trimmed ? trimmed : null;
}

/** Null when valid, else the message to show. */
export function validateRating(stars: number | null, comment: string): string | null {
  if (stars === null || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return 'Choose 1 to 5 stars.';
  }
  if (comment.trim().length > RATING_COMMENT_MAX_LENGTH) {
    return `Keep your comment to ${RATING_COMMENT_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

/** The summary after adding one rating (what the rules require the commit to write). */
export function summaryAfterRating(
  summary: DriverRatingSummary | null,
  stars: number,
): DriverRatingSummary {
  return {
    ratingSum: (summary?.ratingSum ?? 0) + stars,
    ratingCount: (summary?.ratingCount ?? 0) + 1,
  };
}
