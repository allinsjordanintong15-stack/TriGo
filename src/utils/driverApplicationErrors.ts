// Messages for a failed driver application submit. Pure logic with no imports, so plain
// Node tests can load it (tests/drivers/driverApplicationErrors.test.ts).

/** The application's status as stored (DriverApplicationStatus in src/types). */
type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export const SUBMIT_MESSAGES = {
  offline: 'No connection, so nothing was sent. Check your internet connection. Your photos and details are kept; tap Submit again.',
  pending: 'You already have an application under review. Go back to see its status.',
  approved: 'Your driver application has already been approved.',
  denied: 'The server did not accept this application. Go back to see its status; if you have not applied yet, sign out and in again, then submit.',
  photosUnreadable: 'Your photos could not be prepared for sending. Please retake them and try again.',
  photosTooLarge: 'Your photos are too large to send. Please retake them a little further away and try again.',
  busy: 'The service is busy right now. Your photos and details are kept; please try again in a few minutes.',
  rejectedData: 'Some of your details could not be accepted by the server. Please check them and try again.',
  other: 'Your application was not submitted. Your photos and details are kept; tap Submit again.',
} as const;

/**
 * Turns an error from the submit into a message the applicant can act on. `statusNow` is the
 * application's status read after a permission-denied (null: none, or it could not be read).
 */
export function submitErrorMessage(
  error: unknown,
  statusNow: ApplicationStatus | null = null,
): string {
  const code = (error as { code?: unknown } | null)?.code;
  const message = String((error as { message?: unknown } | null)?.message ?? '');
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'cancelled') {
    return SUBMIT_MESSAGES.offline;
  }
  if (code === 'permission-denied') {
    if (statusNow === 'pending') return SUBMIT_MESSAGES.pending;
    if (statusNow === 'approved') return SUBMIT_MESSAGES.approved;
    return SUBMIT_MESSAGES.denied;
  }
  if (/base64/i.test(message)) return SUBMIT_MESSAGES.photosUnreadable;
  if (/maximum (allowed )?size|too large|exceeds/i.test(message)) return SUBMIT_MESSAGES.photosTooLarge;
  if (code === 'resource-exhausted') return SUBMIT_MESSAGES.busy;
  if (code === 'invalid-argument') return SUBMIT_MESSAGES.rejectedData;
  return SUBMIT_MESSAGES.other;
}
