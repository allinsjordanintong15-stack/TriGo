// Trips → Bookings table (all bookings, standard and out-of-area): the status shown per
// booking, the status chips and the filters kept in the URL. Only type imports and .ts
// imports of import-free files, so plain Node tests load it (tests/booking/adminBookingsTable.test.ts).

import {
  DEFAULT_TRIP_FILTERS,
  RANGE_PRESETS,
  TRIP_PAGE_SIZES,
  type RangePreset,
  type TripPageSize,
} from '../outOfArea/tripsTable.ts';
import type { BookingStatus } from './bookings';

export { matchesTripSearch as matchesBookingSearch } from '../outOfArea/tripsTable.ts';

/**
 * Same text as src/constants/cancellation.ts DRIVER_NO_SHOW_REASON (the passenger's cancel
 * after a late driver; firestore.rules requires exactly this). tests/booking/adminBookingsTable.test.ts
 * keeps them equal.
 */
export const DRIVER_NO_SHOW_REASON = 'Driver did not arrive';

/** The stored status, or 'expired' for a standard booking no driver took in time; 'unknown' = unreadable. */
export type BookingRowStatus = BookingStatus | 'expired' | 'unknown';

export const BOOKING_ROW_STATUS_LABELS: Record<BookingRowStatus, string> = {
  pending: 'Waiting for driver',
  accepted: 'Accepted',
  arrived: 'Arrived',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
  unknown: 'Unknown',
};

type StatusFields = {
  status: BookingStatus | null;
  bookingType: 'standard' | 'out_of_area' | null;
  expiresAt: Date | null;
};

/**
 * Same expiry rule as the app and bookings.ts isBookingExpired: a standard booking still
 * pending at or after expiresAt (or without one, from before expiry existed) is expired.
 */
export function bookingRowStatus(booking: StatusFields, nowMillis: number): BookingRowStatus {
  if (!booking.status) return 'unknown';
  if (
    booking.status === 'pending' &&
    booking.bookingType === 'standard' &&
    (booking.expiresAt === null || booking.expiresAt.getTime() <= nowMillis)
  ) {
    return 'expired';
  }
  return booking.status;
}

export function isDriverNoShow(cancellationReason: string | null): boolean {
  return cancellationReason === DRIVER_NO_SHOW_REASON;
}

export type BookingChip = 'all' | Exclude<BookingRowStatus, 'unknown'>;

export const BOOKING_CHIPS: BookingChip[] = [
  'all',
  'pending',
  'accepted',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
  'expired',
];

export function bookingChipLabel(chip: BookingChip): string {
  return chip === 'all' ? 'All' : BOOKING_ROW_STATUS_LABELS[chip];
}

/** Bookings per status plus 'all' (every booking, unknown included). */
export function bookingStatusCounts(statuses: readonly BookingRowStatus[]): Record<BookingChip, number> {
  const counts = Object.fromEntries(BOOKING_CHIPS.map((chip) => [chip, 0])) as Record<BookingChip, number>;
  counts.all = statuses.length;
  for (const status of statuses) if (status !== 'unknown') counts[status] += 1;
  return counts;
}

/** All, the statuses that occur in the loaded bookings, and the chosen one (even at 0). */
export function visibleBookingChips(counts: Record<BookingChip, number>, active: BookingChip): BookingChip[] {
  return BOOKING_CHIPS.filter((chip) => chip === 'all' || counts[chip] > 0 || chip === active);
}

// ─── URL state ──────────────────────────────────────────────────────────────

export type BookingTypeFilter = 'all' | 'standard' | 'out_of_area';

export const BOOKING_TYPE_FILTER_OPTIONS: { value: BookingTypeFilter; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'standard', label: 'Standard' },
  { value: 'out_of_area', label: 'Out-of-area' },
];

export type BookingFilters = {
  preset: RangePreset;
  /** 'YYYY-MM-DD', used only with the custom preset ('' = not chosen yet). */
  from: string;
  to: string;
  /** Passenger or driver name. */
  search: string;
  type: BookingTypeFilter;
  status: BookingChip;
  pageSize: TripPageSize;
};

export const DEFAULT_BOOKING_FILTERS: BookingFilters = {
  preset: DEFAULT_TRIP_FILTERS.preset,
  from: '',
  to: '',
  search: '',
  type: 'all',
  status: 'all',
  pageSize: DEFAULT_TRIP_FILTERS.pageSize,
};

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Filters from the URL (?range=&from=&to=&q=&type=&status=&rows=); unknown values fall back to the defaults. */
export function readBookingFilters(params: URLSearchParams): BookingFilters {
  const preset = RANGE_PRESETS.find((p) => p.value === params.get('range'))?.value ?? DEFAULT_BOOKING_FILTERS.preset;
  const day = (key: string) => {
    const value = params.get(key) ?? '';
    return preset === 'custom' && DAY_PATTERN.test(value) ? value : '';
  };
  const rows = Number(params.get('rows'));
  return {
    preset,
    from: day('from'),
    to: day('to'),
    search: params.get('q') ?? '',
    type: BOOKING_TYPE_FILTER_OPTIONS.find((o) => o.value === params.get('type'))?.value ?? DEFAULT_BOOKING_FILTERS.type,
    status: BOOKING_CHIPS.find((chip) => chip === params.get('status')) ?? DEFAULT_BOOKING_FILTERS.status,
    pageSize: TRIP_PAGE_SIZES.find((size) => size === rows) ?? DEFAULT_BOOKING_FILTERS.pageSize,
  };
}

/** URL parameters for these filters and page; defaults are left out. */
export function bookingTableParams(filters: BookingFilters, page: number): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.preset !== DEFAULT_BOOKING_FILTERS.preset) params.range = filters.preset;
  if (filters.preset === 'custom') {
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
  }
  if (filters.search) params.q = filters.search;
  if (filters.type !== DEFAULT_BOOKING_FILTERS.type) params.type = filters.type;
  if (filters.status !== DEFAULT_BOOKING_FILTERS.status) params.status = filters.status;
  if (filters.pageSize !== DEFAULT_BOOKING_FILTERS.pageSize) params.rows = String(filters.pageSize);
  if (page > 1) params.page = String(page);
  return params;
}

/** Search, type or a status chip narrow the list ("Clear filters"); the date range does not. */
export function hasBookingFilters(filters: BookingFilters): boolean {
  return filters.search.trim() !== '' || filters.type !== 'all' || filters.status !== 'all';
}

// ─── Detail page timeline ───────────────────────────────────────────────────

export type BookingTimelineEvent = { at: Date; label: string; detail?: string };

type TimelineFields = StatusFields & {
  createdAt: Date | null;
  acceptedAt: Date | null;
  arrivedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelledBy: 'passenger' | 'driver' | null;
  cancellationReason: string | null;
};

/** What happened, oldest first; only recorded times (and an expired booking's end). */
export function bookingTimeline(booking: TimelineFields, nowMillis: number): BookingTimelineEvent[] {
  const events: BookingTimelineEvent[] = [];
  const add = (at: Date | null, label: string, detail?: string) => {
    if (at) events.push(detail ? { at, label, detail } : { at, label });
  };
  add(booking.createdAt, 'Requested');
  add(booking.acceptedAt, 'Accepted by the driver');
  add(booking.arrivedAt, 'Driver arrived at pickup');
  add(booking.startedAt, 'Trip started');
  add(booking.completedAt, 'Completed');
  if (booking.cancelledAt) {
    const by = booking.cancelledBy ? ` by the ${booking.cancelledBy}` : '';
    const reason = isDriverNoShow(booking.cancellationReason)
      ? 'Driver no-show: the driver did not arrive in time.'
      : (booking.cancellationReason ?? undefined);
    add(booking.cancelledAt, `Cancelled${by}`, reason);
  }
  if (bookingRowStatus(booking, nowMillis) === 'expired') {
    add(booking.expiresAt, 'Expired', 'No driver accepted it in time.');
  }
  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}
