// Account deletion on the admin website: the exact field values each write sends, the
// checks shown before anonymizing, and the decline note. No imports (the server time is
// passed in), so plain Node tests and the Firestore rules tests use this very code.
//
// One commit anonymizes the account (firestore.rules, Users / Contacts / Drivers / Driver
// applications / Account deletion requests): users/{uid} blanked, contacts/{uid} deleted,
// drivers/{uid} and driverApplications/{uid} blanked when they exist, and the pending
// request completed. Bookings hold only IDs, so they stay as they are. The sign-in account
// is deleted by hand in the Firebase Console afterwards (no Cloud Functions).

/** The name every anonymized record shows. */
export const DELETED_NAME = 'Deleted user';

/** deletionRequests/{uid}.declineNote: at most this many characters (firestore.rules). */
export const DECLINE_NOTE_MAX_LENGTH = 500;

/** users/{uid}: name, email, mobile number and photo removed; uid, role, dates and consent stay. */
export function anonymizedUserUpdate(now: unknown) {
  return {
    fullName: DELETED_NAME,
    email: '',
    mobileNumber: '',
    profileImage: null,
    anonymizedAt: now,
    updatedAt: now,
  };
}

/**
 * drivers/{uid}: name, plate and vehicle details removed; unverified, offline, unavailable,
 * without a position, for good. Type, rating and quota count stay.
 */
export function anonymizedDriverUpdate(now: unknown, adminUid: string) {
  return {
    fullName: DELETED_NAME,
    vehiclePlate: '',
    vehicleBrand: '',
    vehicleModel: '',
    vehicleColor: '',
    isVerified: false,
    isOnline: false,
    isAvailable: false,
    currentLocation: null,
    verificationNote: null,
    verificationUpdatedAt: now,
    verificationUpdatedBy: adminUid,
    anonymizedAt: now,
    updatedAt: now,
  };
}

/**
 * driverApplications/{uid}: names, email, mobile number, plate, vehicle details, document
 * references and remarks removed. Status, vehicle type, dates and the privacy
 * acknowledgement stay.
 */
export function anonymizedApplicationUpdate(now: unknown) {
  return {
    firstName: '',
    middleName: null,
    lastName: '',
    fullName: DELETED_NAME,
    email: '',
    mobileNumber: '',
    vehiclePlate: '',
    vehicleBrand: '',
    vehicleModel: '',
    vehicleColor: '',
    documents: null,
    adminRemarks: null,
    anonymizedAt: now,
    updatedAt: now,
  };
}

/** deletionRequests/{uid}, in the anonymizing commit. */
export function completedRequestUpdate(now: unknown, adminUid: string) {
  return { status: 'completed', completedAt: now, completedBy: adminUid };
}

/** deletionRequests/{uid}: declined, with a note the user reads in the app. */
export function declinedRequestUpdate(note: string, now: unknown, adminUid: string) {
  return { status: 'declined', declineNote: note.trim(), declinedAt: now, declinedBy: adminUid };
}

/** deletionRequests/{uid}: the sign-in account was deleted in the Firebase Console. */
export function authDeletedUpdate(now: unknown, adminUid: string) {
  return { authDeletedAt: now, authDeletedBy: adminUid };
}

/** Error text, or null when the note can be saved. */
export function validateDeclineNote(text: string): string | null {
  const note = text.trim();
  if (!note) return 'Write a short note for the user explaining why.';
  if (note.length > DECLINE_NOTE_MAX_LENGTH) {
    return `Keep the note to ${DECLINE_NOTE_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

// ─── Checks before anonymizing ─────────────────────────────────────────────

/** What is still open on the account, read when the request is opened. */
export type OpenItems = {
  /** Passenger bookings with a driver assigned that have not ended. */
  passengerActiveTrips: number;
  /** drivers/{uid}.currentBookingId is set. */
  driverOnTrip: boolean;
  /** drivers/{uid}.currentRequestId is set (an out-of-area request held). */
  driverHoldsRequest: boolean;
  /** Commission accrued and not paid, in centavos; null when it could not be read. */
  unpaidCentavos: number | null;
};

export type CheckState = 'ok' | 'warning' | 'blocking';

export type DeletionCheck = {
  id: 'passenger-trip' | 'driver-trip' | 'held-request' | 'commission';
  label: string;
  state: CheckState;
  detail: string;
};

/** Booking statuses in which a trip has a driver assigned and has not ended. */
export const ACTIVE_TRIP_STATUSES = ['accepted', 'arrived', 'in_progress'] as const;

/**
 * One line per check. Blocking: the rules refuse the commit (driver on a trip or holding a
 * request), or a passenger trip is under way (wait until it ends). Warning: unpaid
 * commission, kept on record without the name; the admin decides.
 */
export function deletionChecks(items: OpenItems, formatCentavos: (centavos: number) => string): DeletionCheck[] {
  return [
    items.passengerActiveTrips > 0
      ? {
          id: 'passenger-trip',
          label: 'Trip as passenger',
          state: 'blocking',
          detail: `${items.passengerActiveTrips} trip${items.passengerActiveTrips === 1 ? '' : 's'} in progress. Wait until ${items.passengerActiveTrips === 1 ? 'it ends' : 'they end'}.`,
        }
      : { id: 'passenger-trip', label: 'Trip as passenger', state: 'ok', detail: 'No trip in progress.' },
    items.driverOnTrip
      ? {
          id: 'driver-trip',
          label: 'Trip as driver',
          state: 'blocking',
          detail: 'The driver is on a trip. Wait until it ends.',
        }
      : { id: 'driver-trip', label: 'Trip as driver', state: 'ok', detail: 'No trip in progress.' },
    items.driverHoldsRequest
      ? {
          id: 'held-request',
          label: 'Out-of-area request',
          state: 'blocking',
          detail: 'The driver holds an out-of-area request. Wait until it is confirmed, released or expired.',
        }
      : { id: 'held-request', label: 'Out-of-area request', state: 'ok', detail: 'None held.' },
    items.unpaidCentavos === null
      ? {
          id: 'commission',
          label: 'Unpaid commission',
          state: 'warning',
          detail: 'Could not be read. Check Earnings before deleting.',
        }
      : items.unpaidCentavos > 0
        ? {
            id: 'commission',
            label: 'Unpaid commission',
            state: 'warning',
            detail: `${formatCentavos(items.unpaidCentavos)} unpaid. The commission and payment records are kept without the name; settle it with the driver first if you need to.`,
          }
        : { id: 'commission', label: 'Unpaid commission', state: 'ok', detail: 'Nothing owed.' },
  ];
}

/** Anonymizing is allowed when no check is blocking. */
export function canAnonymize(checks: readonly DeletionCheck[]): boolean {
  return checks.every((check) => check.state !== 'blocking');
}
