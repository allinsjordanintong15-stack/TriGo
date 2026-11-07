// Account deletion request: the optional reason, and the notes shown before requesting
// when something is still open. The firestore.rules anonymization refuses a driver on a
// trip or holding an out-of-area request; trip, commission and payment records are kept
// without personal details (Privacy Notice sections 10 and 11). No imports, so plain Node
// tests can load this file.

/** deletionRequests/{uid}.reason: at most this many characters (firestore.rules). */
export const DELETION_REASON_MAX_LENGTH = 500;

/** Trimmed reason, null when empty; error when too long. */
export function normalizeDeletionReason(text: string): { reason: string | null; error: string | null } {
  const reason = text.trim();
  if (reason.length > DELETION_REASON_MAX_LENGTH) {
    return {
      reason: null,
      error: `Please keep the reason to ${DELETION_REASON_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { reason: reason || null, error: null };
}

/** deletionRequests/{uid}.status as the app shows it. */
export type DeletionRequestStatus = 'pending' | 'declined' | 'completed';

/**
 * The stored status; anything unknown counts as pending (the user can still remove it,
 * which the rules allow for pending and declined requests).
 */
export function parseDeletionStatus(value: unknown): DeletionRequestStatus {
  return value === 'completed' || value === 'declined' ? value : 'pending';
}

/** The admin's decline note, trimmed; null when missing or empty. */
export function parseDeclineNote(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}

/** What is still open on the account when the user asks for deletion. */
export interface DeletionContext {
  /** As a passenger: a booking with a driver assigned that has not ended. */
  passengerTripActive: boolean;
  /** As a driver: drivers/{uid}.currentBookingId is set. */
  driverOnTrip: boolean;
  /** As a driver: drivers/{uid}.currentRequestId is set (an out-of-area request held). */
  driverHoldsRequest: boolean;
  /** Commission accrued and not yet paid, in centavos (0 when none or not a driver). */
  unpaidCommissionCentavos: number;
}

/** Booking statuses in which a passenger's trip has a driver and has not ended. */
export const ACTIVE_TRIP_STATUSES = ['accepted', 'arrived', 'in_progress'] as const;

function pesos(centavos: number): string {
  return `₱${(centavos / 100).toFixed(2)}`;
}

/** One plain-English note per open item, saying which records are kept and what waits. */
export function deletionNotes(context: DeletionContext): string[] {
  const notes: string[] = [];
  if (context.passengerTripActive || context.driverOnTrip) {
    notes.push(
      'You have a trip in progress. Its record is kept, without your name and mobile number, and the TriGo team completes the deletion only after the trip has ended.',
    );
  }
  if (context.driverHoldsRequest) {
    notes.push(
      'You are holding an out-of-area request. The TriGo team completes the deletion only after that request is confirmed, released or expired.',
    );
  }
  if (context.unpaidCommissionCentavos > 0) {
    notes.push(
      `You have ${pesos(context.unpaidCommissionCentavos)} in unpaid commission. Your commission and payment records are kept after deletion, without your name or vehicle details, and the TriGo team may contact you about the balance first.`,
    );
  }
  return notes;
}
