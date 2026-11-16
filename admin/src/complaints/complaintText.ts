// Plain-English sentences for the complaint page, written for an admin who doesn't know
// the database. No imports (dates come in already formatted), so plain Node tests load it.

export type ComplaintStatusKey = 'open' | 'in_review' | 'resolved';

/**
 * One sentence under the status pill. `changedOn` / `changedBy` describe the last change
 * (status or notes); `changedBy` is "you", a name or email, or null when unknown.
 */
export function complaintStatusSentence(
  status: ComplaintStatusKey,
  changedOn: string | null,
  changedBy: string | null,
): string {
  const by = changedBy ? ` by ${changedBy}` : '';
  if (status === 'resolved') return changedOn ? `Resolved on ${changedOn}${by}.` : `Resolved${by}.`;
  if (status === 'in_review') return changedOn ? `In review since ${changedOn}${by}.` : `In review${by}.`;
  return 'Waiting for your review.';
}

/**
 * Complaints against the person in this role, counted from those that store who was
 * reported (filed from 10 Nov 2026). `includesThis` is false for an older complaint, which
 * isn't counted. Never says "no complaints" about someone this complaint is about.
 */
export function complaintCountText(count: number, includesThis: boolean): string {
  if (includesThis) {
    return count <= 1 ? 'First complaint on record' : `${count} complaints on record`;
  }
  if (count === 0) return 'No other complaints on record since Nov 10, 2026';
  return `${count} other complaint${count === 1 ? '' : 's'} on record since Nov 10, 2026`;
}

/** Active warnings: "No warnings yet", "1 warning", "2 warnings". */
export function warningCountText(active: number): string {
  if (active <= 0) return 'No warnings yet';
  return `${active} warning${active === 1 ? '' : 's'}`;
}

export const OLDER_COMPLAINT_NOTE =
  "This complaint was filed before Nov 10, 2026, so it isn't included in the counts.";

export const OLDER_COMPLAINT_WARN_NOTE =
  "Warnings can only be linked to complaints filed from Nov 10, 2026, because older ones don't record who was reported. You can still review this complaint and take action from the person's page.";

/** Trip status in plain words. `expired` = nobody accepted it in time. */
export function tripStatusText(status: string | null, expired: boolean): string {
  if (expired) return 'Expired: no driver accepted it in time';
  switch (status) {
    case 'pending':
      return 'Waiting for a driver';
    case 'accepted':
      return 'Driver on the way to the pickup';
    case 'arrived':
      return 'Driver waiting at the pickup';
    case 'in_progress':
      return 'Trip in progress';
    case 'completed':
      return 'Trip completed';
    case 'cancelled':
      return 'Cancelled before the trip finished';
    default:
      return 'Status unknown';
  }
}
