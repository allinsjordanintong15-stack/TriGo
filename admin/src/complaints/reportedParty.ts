// Who a complaint is about. Complaints filed from 2026-11-10 store reportedUserId (the other
// side of the booking, checked by firestore.rules); older ones don't, so the detail page
// falls back to the booking. No imports, so plain Node tests can load this file.

export type ReporterRole = 'passenger' | 'driver';

/** The reported person's role: passengers report drivers, drivers report passengers. */
export function reportedRoleFor(reporterRole: ReporterRole | null): ReporterRole | null {
  if (reporterRole === 'passenger') return 'driver';
  if (reporterRole === 'driver') return 'passenger';
  return null;
}

/**
 * The reported user's uid: the stored reportedUserId, else (older complaints) the other side
 * of the booking when it is loaded; null when unknown or when there is nobody (no driver).
 */
export function reportedUserOf(
  complaint: { reporterId: string; reporterRole: ReporterRole | null; reportedUserId: string | null | undefined },
  booking: { passengerId: string | null; driverId: string | null } | null,
): string | null {
  if (typeof complaint.reportedUserId === 'string' && complaint.reportedUserId) return complaint.reportedUserId;
  if (complaint.reportedUserId === null || !booking) return null;
  const role = reportedRoleFor(complaint.reporterRole);
  const other = role === 'driver' ? booking.driverId : role === 'passenger' ? booking.passengerId : null;
  return other && other !== complaint.reporterId ? other : null;
}

/** "No complaints", "1 complaint", "3 complaints". */
export function complaintCountLabel(count: number): string {
  if (count === 0) return 'No complaints';
  return `${count} complaint${count === 1 ? '' : 's'}`;
}
