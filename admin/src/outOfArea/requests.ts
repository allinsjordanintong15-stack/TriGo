import type { DocumentData, Timestamp } from 'firebase/firestore';

import { VEHICLE_TYPE_LABELS, type AdminBooking } from '../bookings/bookings';

// Read-only view of outOfAreaRequests/{requestId} for the Out-of-Area Trips page (shape
// written by the mobile app, see src/types/index.ts OutOfAreaRequest). Admins can read
// requests but never write them. Kept free of Firebase runtime imports.

export type RequestStatus =
  | 'searching'
  | 'driver_interested'
  | 'negotiating'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled';

const STORED_STATUSES: Record<RequestStatus, true> = {
  searching: true,
  driver_interested: true,
  negotiating: true,
  accepted: true,
  rejected: true,
  expired: true,
  cancelled: true,
};

/**
 * What the admin sees. The app never writes 'expired': an open request whose expiresAt has
 * passed (or that has no expiresAt, as on old requests) is shown as expired here, matching
 * the rules' isUnexpired(). 'driver_interested' and 'negotiating' both mean a driver
 * accepted the request and the passenger has not confirmed yet.
 */
export type DisplayStatus = 'searching' | 'awaiting_passenger' | 'confirmed' | 'expired' | 'cancelled' | 'rejected' | 'unknown';

export const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
  searching: 'Looking for a driver',
  awaiting_passenger: 'Waiting for passenger',
  confirmed: 'Confirmed',
  expired: 'Expired',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  unknown: 'Unknown',
};

export type AdminOutOfAreaRequest = {
  requestId: string;
  passengerId: string;
  driverId: string | null;
  vehicleType: keyof typeof VEHICLE_TYPE_LABELS | null;
  status: RequestStatus | null;
  pickupAddress: string;
  destinationAddress: string;
  distanceKm: number | null;
  /** The admin per-km fare quoted when the request was opened (final, not negotiable). */
  fare: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  expiresAt: Date | null;
  /** When the passenger confirmed the driver (fareAgreement.agreedAt). */
  confirmedAt: Date | null;
};

function toDate(value: unknown): Date | null {
  return (value as Timestamp | undefined)?.toDate?.() ?? null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readRequest(requestId: string, data: DocumentData): AdminOutOfAreaRequest {
  const status = data.status;
  const vehicleType = data.vehicleType;
  return {
    requestId,
    passengerId: data.passengerId ?? '',
    driverId: typeof data.driverId === 'string' ? data.driverId : null,
    vehicleType: typeof vehicleType === 'string' && vehicleType in VEHICLE_TYPE_LABELS
      ? (vehicleType as keyof typeof VEHICLE_TYPE_LABELS)
      : null,
    status: typeof status === 'string' && status in STORED_STATUSES ? (status as RequestStatus) : null,
    pickupAddress: data.pickupLocation?.address ?? '',
    destinationAddress: data.destination?.address ?? '',
    distanceKm: numberOrNull(data.distanceKm),
    // agreedFare equals standardEstimatedFare since the fare lock; fall back for old requests.
    fare: numberOrNull(data.agreedFare) ?? numberOrNull(data.standardEstimatedFare),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    expiresAt: toDate(data.expiresAt),
    confirmedAt: toDate(data.fareAgreement?.agreedAt),
  };
}

export function displayStatus(request: AdminOutOfAreaRequest, now: Date): DisplayStatus {
  switch (request.status) {
    case 'searching':
    case 'driver_interested':
    case 'negotiating': {
      const unexpired = request.expiresAt !== null && now.getTime() < request.expiresAt.getTime();
      if (!unexpired) return 'expired';
      return request.status === 'searching' ? 'searching' : 'awaiting_passenger';
    }
    case 'accepted':
      return 'confirmed';
    case 'expired':
      return 'expired';
    case 'cancelled':
      return 'cancelled';
    case 'rejected':
      return 'rejected';
    default:
      return 'unknown';
  }
}

/** Newest first; requests without createdAt go last. */
export function sortRequestsNewestFirst(requests: AdminOutOfAreaRequest[]): AdminOutOfAreaRequest[] {
  return [...requests].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

// ─── Date range (list page) ─────────────────────────────────────────────

/** Each list query returns at most this many requests (newest first). */
export const REQUEST_QUERY_LIMIT = 200;

export const DEFAULT_RANGE_DAYS = 7;

/** 'YYYY-MM-DD' in local time, the value format of <input type="date">. */
export function toDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The last 7 days including today. */
export function defaultDateRange(now: Date): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DEFAULT_RANGE_DAYS - 1));
  return { from: toDateInputValue(from), to: toDateInputValue(now) };
}

function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toDateInputValue(date) === value ? date : null;
}

export type DateRange = { start: Date; end: Date };

/**
 * Both days inclusive, in local time: start is midnight of `from`, end is midnight after
 * `to` (query with createdAt >= start and createdAt < end).
 */
export function parseDateRange(from: string, to: string): DateRange | { error: string } {
  const start = parseDateInput(from);
  const toDate = parseDateInput(to);
  if (!start || !toDate) return { error: 'Choose both a start date and an end date.' };
  if (toDate.getTime() < start.getTime()) return { error: 'The start date must be on or before the end date.' };
  const end = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() + 1);
  return { start, end };
}

// ─── Timeline (detail page) ─────────────────────────────────────────────

export type TimelineEvent = { at: Date; label: string; detail?: string };

/**
 * What happened to a request and its booking, oldest first. Only recorded times are shown:
 * the request keeps no history, so a driver who withdrew leaves no trace, and updatedAt is
 * used only where the current status says what it marks.
 */
export function buildTimeline(
  request: AdminOutOfAreaRequest,
  booking: AdminBooking | null,
  now: Date,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const add = (at: Date | null, label: string, detail?: string) => {
    if (at) events.push({ at, label, detail });
  };

  add(request.createdAt, 'Request opened');
  const status = displayStatus(request, now);
  if (status === 'awaiting_passenger') add(request.updatedAt, 'Driver accepted the request');
  add(request.confirmedAt, 'Passenger confirmed the driver', booking ? undefined : 'No booking found for this request.');
  if (!request.confirmedAt && (status === 'searching' || status === 'awaiting_passenger')) {
    add(request.expiresAt, 'Expires');
  }
  if (status === 'expired') add(request.expiresAt, 'Expired', 'No driver was confirmed in time.');
  if (status === 'cancelled' && !booking) add(request.updatedAt, 'Request cancelled by the passenger');
  if (status === 'rejected') add(request.updatedAt, 'Request rejected');

  if (booking) {
    add(booking.createdAt, 'Booking created');
    add(booking.acceptedAt, 'Driver took the booking');
    add(booking.arrivedAt, 'Driver arrived at pickup');
    add(booking.startedAt, 'Trip started');
    add(booking.completedAt, 'Trip completed');
    add(
      booking.cancelledAt,
      `Booking cancelled${booking.cancelledBy ? ` by the ${booking.cancelledBy}` : ''}`,
      booking.cancellationReason ?? undefined,
    );
  }

  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}
