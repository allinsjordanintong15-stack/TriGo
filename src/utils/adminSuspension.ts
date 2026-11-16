// Admin suspension of a driver (drivers/{uid}: suspendedAt, suspendedUntil, suspensionReason,
// suspensionLiftedAt; set on the Admin Website). Active while suspendedAt is set, it was not
// lifted, and suspendedUntil is null (until lifted) or still ahead; it ends by itself at
// suspendedUntil. Same test as firestore.rules isAdminSuspended and the admin website
// (admin/src/drivers/driverTable.ts). While active the rules refuse new standard accepts and
// out-of-area proposals; going online, finishing a trip and the out-of-area claim stay allowed.
// No imports, so plain Node tests load it (tests/booking/adminSuspension.test.ts).

export interface AdminSuspension {
  suspendedAt: Date | null;
  /** Null = until TriGo lifts it. */
  suspendedUntil: Date | null;
  /** The admin's reason; the driver reads it on Home. */
  reason: string;
  liftedAt: Date | null;
}

export const ADMIN_SUSPENDED_MESSAGE =
  'TriGo suspended your account, so you cannot accept new requests right now. See the notice on Home.';

export function isSuspensionActive(suspension: AdminSuspension | null, nowMillis: number): boolean {
  if (!suspension?.suspendedAt || suspension.liftedAt) return false;
  return suspension.suspendedUntil === null || nowMillis < suspension.suspendedUntil.getTime();
}

/**
 * Home banner title: "Suspended until Nov 20, 2026 · 3:05 PM" or "Suspended until TriGo
 * lifts it". `formatEnd` formats the end (src/utils/dateTime.ts formatDateTime).
 */
export function suspensionTitle(suspension: AdminSuspension, formatEnd: (date: Date) => string): string {
  return suspension.suspendedUntil
    ? `Suspended until ${formatEnd(suspension.suspendedUntil)}`
    : 'Suspended until TriGo lifts it';
}

/** The time until which this suspension blocks, for re-rendering when it ends; null = no end. */
export function suspensionEndMillis(suspension: AdminSuspension | null): number | null {
  return suspension?.suspendedUntil ? suspension.suspendedUntil.getTime() : null;
}
