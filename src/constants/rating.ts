// Post-trip driver ratings (ratings/{bookingId}, summary in driverRatings/{driverId}).
// No imports, so plain Node tests can load this file. firestore.rules keeps its own copy
// of these values; tests/booking/ratingSync.test.ts fails if they differ.

/** A passenger can rate a completed trip for this many days after it was completed. */
export const RATING_WINDOW_DAYS = 7;

/** Longest optional comment, in characters. */
export const RATING_COMMENT_MAX_LENGTH = 300;

/** Quick tags: stored by id; positive ones are offered for 4–5 stars, the others for 1–3. */
export const RATING_TAGS = [
  { id: 'on_time', label: 'On time', positive: true },
  { id: 'safe_driving', label: 'Safe driving', positive: true },
  { id: 'friendly', label: 'Friendly', positive: true },
  { id: 'clean_vehicle', label: 'Clean vehicle', positive: true },
  { id: 'good_route', label: 'Good route', positive: true },
  { id: 'late_pickup', label: 'Late pickup', positive: false },
  { id: 'unsafe_driving', label: 'Unsafe driving', positive: false },
  { id: 'rude', label: 'Rude', positive: false },
] as const;

export type RatingTagId = (typeof RATING_TAGS)[number]['id'];

export const RATING_TAG_IDS: readonly RatingTagId[] = RATING_TAGS.map((tag) => tag.id);
