// Who a complaint is about: the other side of the booking. Written as reportedUserId on
// complaints/{bookingId}_{reporterUid} (firestore.rules checks the same thing against the
// booking). No imports, so plain Node tests can load this file.

export type ComplaintReporterRole = 'passenger' | 'driver';

/**
 * The driver when a passenger reports, the passenger when a driver reports; null when that
 * side is empty (a request nobody accepted) or would be the reporter themselves.
 */
export function reportedUserIdFor(
  booking: { passengerId: string | null; driverId: string | null },
  role: ComplaintReporterRole,
  reporterUid: string,
): string | null {
  const other = role === 'passenger' ? booking.driverId : booking.passengerId;
  return other && other !== reporterUid ? other : null;
}
