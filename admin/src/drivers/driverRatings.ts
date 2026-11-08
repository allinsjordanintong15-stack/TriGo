// Driver rating as shown on the admin website: driverRatings/{driverId} =
// { ratingSum, ratingCount }, written by the passenger app's rating commit (checked by
// firestore.rules). Copy of src/utils/rating.ts (readRatingSummary, averageRating,
// formatDriverRating); tests/booking/ratingSync.test.ts keeps them equal.

export type DriverRatingSummary = { ratingSum: number; ratingCount: number };

/** A stored summary; null unless both numbers are whole and not negative. */
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

/** The average to one decimal, or null when there are no ratings yet. */
export function averageRating(summary: DriverRatingSummary | null): number | null {
  if (!summary || summary.ratingCount <= 0) return null;
  return Math.round((summary.ratingSum / summary.ratingCount) * 10) / 10;
}

/** "4.7", or "New" when the driver has no ratings (or no summary document). */
export function formatDriverRating(summary: DriverRatingSummary | null): string {
  const average = averageRating(summary);
  return average === null ? 'New' : average.toFixed(1);
}

/** "4.7 (12 ratings)", "New (no ratings yet)" for the driver detail page. */
export function formatDriverRatingWithCount(summary: DriverRatingSummary | null): string {
  const count = summary?.ratingCount ?? 0;
  if (count === 0) return 'New (no ratings yet)';
  return `${formatDriverRating(summary)} (${count} rating${count === 1 ? '' : 's'})`;
}
