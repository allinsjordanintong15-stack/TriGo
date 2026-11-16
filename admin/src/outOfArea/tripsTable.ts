// Trips → Out-of-area trips table: one combined status per trip (request + its booking),
// the status chips, and the filters kept in the URL. Type imports only, so plain Node tests
// load it (tests/booking/adminTripsTable.test.ts).

import type { BookingStatus } from '../bookings/bookings';
import type { DisplayStatus } from './requests';

/**
 * What the table shows, from the request's display status and the booking's status:
 * a finished booking (completed, cancelled) or a started one (in progress) decides; before
 * that the request does. 'rejected' (never written for out-of-area requests; the app treats
 * it as cancelled) counts as cancelled. 'unknown' = unreadable request status.
 */
export type TripStatus =
  | 'searching'
  | 'awaiting_passenger'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'unknown';

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  searching: 'Looking for a driver',
  awaiting_passenger: 'Waiting for passenger',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  expired: 'Expired',
  cancelled: 'Cancelled',
  unknown: 'Unknown',
};

export function tripStatus(request: DisplayStatus, booking: BookingStatus | null): TripStatus {
  if (booking === 'completed') return 'completed';
  if (booking === 'cancelled') return 'cancelled';
  if (booking === 'in_progress') return 'in_progress';
  switch (request) {
    case 'searching':
    case 'awaiting_passenger':
    case 'confirmed':
    case 'expired':
    case 'cancelled':
      return request;
    case 'rejected':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

export type StatusChip = 'all' | Exclude<TripStatus, 'unknown'>;

/** Chip order; "In progress" is shown only when a trip in the range has it. */
export const STATUS_CHIPS: StatusChip[] = [
  'all',
  'searching',
  'awaiting_passenger',
  'confirmed',
  'in_progress',
  'completed',
  'expired',
  'cancelled',
];

export function chipLabel(chip: StatusChip): string {
  return chip === 'all' ? 'All' : TRIP_STATUS_LABELS[chip];
}

/** Trips per status plus 'all' (every trip, unknown included). */
export function statusCounts(statuses: readonly TripStatus[]): Record<StatusChip, number> {
  const counts = Object.fromEntries(STATUS_CHIPS.map((chip) => [chip, 0])) as Record<StatusChip, number>;
  counts.all = statuses.length;
  for (const status of statuses) if (status !== 'unknown') counts[status] += 1;
  return counts;
}

/** The chips to show: all of them, except "In progress" while no trip is in progress (unless chosen). */
export function visibleChips(counts: Record<StatusChip, number>, active: StatusChip): StatusChip[] {
  return STATUS_CHIPS.filter((chip) => chip !== 'in_progress' || counts.in_progress > 0 || active === 'in_progress');
}

// ─── URL state ──────────────────────────────────────────────────────────────

export type RangePreset = 'today' | '7d' | '30d' | 'custom';

export const RANGE_PRESETS: { value: RangePreset; label: string; days: number | null }[] = [
  { value: 'today', label: 'Today', days: 1 },
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: 'custom', label: 'Custom', days: null },
];

export const TRIP_PAGE_SIZES = [10, 20, 50] as const;
export type TripPageSize = (typeof TRIP_PAGE_SIZES)[number];

export type TripFilters = {
  preset: RangePreset;
  /** 'YYYY-MM-DD', used only with the custom preset ('' = not chosen yet). */
  from: string;
  to: string;
  /** Passenger or driver name. */
  search: string;
  status: StatusChip;
  pageSize: TripPageSize;
};

export const DEFAULT_TRIP_FILTERS: TripFilters = {
  preset: '7d',
  from: '',
  to: '',
  search: '',
  status: 'all',
  pageSize: 10,
};

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Filters from the URL (?range=&from=&to=&q=&status=&rows=); unknown values fall back to the defaults. */
export function readTripFilters(params: URLSearchParams): TripFilters {
  const preset = RANGE_PRESETS.find((p) => p.value === params.get('range'))?.value ?? DEFAULT_TRIP_FILTERS.preset;
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
    status: STATUS_CHIPS.find((chip) => chip === params.get('status')) ?? DEFAULT_TRIP_FILTERS.status,
    pageSize: TRIP_PAGE_SIZES.find((size) => size === rows) ?? DEFAULT_TRIP_FILTERS.pageSize,
  };
}

/** URL parameters for these filters and page; defaults are left out. */
export function tripTableParams(filters: TripFilters, page: number): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.preset !== DEFAULT_TRIP_FILTERS.preset) params.range = filters.preset;
  if (filters.preset === 'custom') {
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
  }
  if (filters.search) params.q = filters.search;
  if (filters.status !== DEFAULT_TRIP_FILTERS.status) params.status = filters.status;
  if (filters.pageSize !== DEFAULT_TRIP_FILTERS.pageSize) params.rows = String(filters.pageSize);
  if (page > 1) params.page = String(page);
  return params;
}

/** Search or a status chip narrow the list ("Clear filters"); the date range does not. */
export function hasTripFilters(filters: TripFilters): boolean {
  return filters.search.trim() !== '' || filters.status !== 'all';
}

/** Case-insensitive; every word typed must appear in the passenger's or the driver's name. */
export function matchesTripSearch(passengerName: string, driverName: string | null, search: string): boolean {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const matches = (name: string) => words.every((word) => name.toLowerCase().includes(word));
  return matches(passengerName) || (driverName !== null && matches(driverName));
}
