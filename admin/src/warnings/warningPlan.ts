// Warnings on the admin website: the exact field values each write sends and the labels.
// No imports (the server time is passed in), so plain Node tests and the Firestore rules
// tests use this very code.
//
// warnings/{warningId} (firestore.rules, Warnings): the ID is the complaint's ID when the
// warning comes from a complaint, so a complaint can lead to at most one warning. Admins
// create and may only withdraw; the warned user sets acknowledgedAt once in the app. Warnings
// are counted; the admin decides any suspension (nothing happens automatically).

/** warnings/{id}.reason: at most this many characters (firestore.rules). */
export const WARNING_REASON_MAX_LENGTH = 500;

export type WarningRole = 'driver' | 'passenger';
export type WarningStatus = 'active' | 'withdrawn';

export type NewWarningInput = {
  userId: string;
  /** The role the user had on the trip (a complaint by a passenger warns the driver). */
  role: WarningRole;
  /** Null for a warning not tied to a complaint (then bookingId is null too). */
  complaintId: string | null;
  bookingId: string | null;
  reason: string;
};

/** The new warnings/{id} document; with a complaint, the ID must be complaintId. */
export function newWarningDoc(input: NewWarningInput, adminUid: string, now: unknown) {
  return {
    userId: input.userId,
    role: input.role,
    complaintId: input.complaintId,
    bookingId: input.complaintId === null ? null : input.bookingId,
    reason: input.reason.trim(),
    adminId: adminUid,
    createdAt: now,
    status: 'active' as WarningStatus,
    acknowledgedAt: null,
  };
}

/** The only change an admin may make afterwards. */
export function withdrawnWarningUpdate(now: unknown, adminUid: string) {
  return { status: 'withdrawn' as WarningStatus, withdrawnAt: now, withdrawnBy: adminUid };
}

/** Account deletion: the record stays, its reason is cleared in the anonymizing commit. */
export function clearedReasonUpdate(now: unknown) {
  return { reason: '', reasonClearedAt: now };
}

/** Error text, or null when the reason can be saved. */
export function validateWarningReason(text: string): string | null {
  const reason = text.trim();
  if (!reason) return 'Write the reason the user will read.';
  if (reason.length > WARNING_REASON_MAX_LENGTH) {
    return `Keep the reason to ${WARNING_REASON_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

/** "No warnings", "1 warning", "3 warnings". */
export function warningCountLabel(count: number): string {
  if (count === 0) return 'No warnings';
  return `${count} warning${count === 1 ? '' : 's'}`;
}

/**
 * The summary line on a driver or passenger page: active warnings, withdrawn ones in
 * brackets, then complaints. E.g. "2 warnings (1 withdrawn) · 3 complaints".
 */
export function warningSummaryLabel(
  warnings: readonly { status: WarningStatus }[],
  complaintLabel: string,
): string {
  const active = warnings.filter((w) => w.status === 'active').length;
  const withdrawn = warnings.length - active;
  const withdrawnPart = withdrawn > 0 ? ` (${withdrawn} withdrawn)` : '';
  return `${warningCountLabel(active)}${withdrawnPart} · ${complaintLabel}`;
}
