// The Drivers → All drivers table: the verified drivers (active and suspended), searched by
// name, filtered by vehicle, paged 10 / 20 / 50 at a time, all kept in the URL. Free of
// imports so plain Node tests load it (tests/booking/adminDriverTable.test.ts).

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
export const DRIVERS_PAGE_SIZE: PageSize = 10;

export type VehicleFilter = 'all' | 'motorcycle' | 'tricycle';

export type DriverTableFilters = {
  /** Matched against the driver's name only. */
  search: string;
  vehicle: VehicleFilter;
  pageSize: PageSize;
};

export const DEFAULT_DRIVER_FILTERS: DriverTableFilters = { search: '', vehicle: 'all', pageSize: DRIVERS_PAGE_SIZE };

export const VEHICLE_FILTER_OPTIONS: { value: VehicleFilter; label: string }[] = [
  { value: 'all', label: 'All vehicles' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'tricycle', label: 'Tricycle' },
];

/** Filters from the URL (?q=&vehicle=&rows=); unknown values fall back to the defaults. */
export function readDriverFilters(params: URLSearchParams): DriverTableFilters {
  const vehicle = params.get('vehicle');
  const rows = Number(params.get('rows'));
  return {
    search: params.get('q') ?? '',
    vehicle: VEHICLE_FILTER_OPTIONS.find((o) => o.value === vehicle)?.value ?? DEFAULT_DRIVER_FILTERS.vehicle,
    pageSize: PAGE_SIZE_OPTIONS.find((size) => size === rows) ?? DEFAULT_DRIVER_FILTERS.pageSize,
  };
}

/** Page 1 when missing or not a whole number ≥ 1 (clamped to the last page by pageSlice). */
export function readDriverPage(params: URLSearchParams): number {
  const page = Number(params.get('page'));
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** URL parameters for these filters and page; defaults are left out so a clean URL means "no filters". */
export function driverTableParams(filters: DriverTableFilters, page: number): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.search) params.q = filters.search;
  if (filters.vehicle !== DEFAULT_DRIVER_FILTERS.vehicle) params.vehicle = filters.vehicle;
  if (filters.pageSize !== DEFAULT_DRIVER_FILTERS.pageSize) params.rows = String(filters.pageSize);
  if (page > 1) params.page = String(page);
  return params;
}

/** Search or vehicle narrow the list (rows per page does not). */
export function hasActiveFilters(filters: DriverTableFilters): boolean {
  return filters.search.trim() !== '' || filters.vehicle !== DEFAULT_DRIVER_FILTERS.vehicle;
}

/** Case-insensitive; every word typed must appear in the name ("cruz bel" finds "Bella Cruz"). */
export function matchesDriverName(fullName: string, search: string): boolean {
  const name = fullName.toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => name.includes(word));
}

/**
 * The latest admin suspension on drivers/{uid} (driverActionPlan.ts). Active while suspendedAt
 * is set, it was not lifted, and suspendedUntil is null (until lifted) or still ahead; it
 * stops by itself at suspendedUntil (no write). Same test as firestore.rules isAdminSuspended.
 */
export type AdminSuspension = {
  suspendedAt: Date | null;
  suspendedUntil: Date | null;
  suspensionLiftedAt: Date | null;
};

export function isAdminSuspended(suspension: AdminSuspension | null, nowMillis: number): boolean {
  if (!suspension?.suspendedAt || suspension.suspensionLiftedAt) return false;
  return suspension.suspendedUntil === null || nowMillis < suspension.suspendedUntil.getTime();
}

/**
 * Star display for an average (0–5): whole stars, a half star from .25 up to .75, rounded
 * to the nearest half otherwise. E.g. 4.5 → 4 full + half; 4.8 → 5 full.
 */
export function ratingStars(average: number): { full: number; half: boolean; empty: number } {
  const halves = Math.round(Math.min(5, Math.max(0, average)) * 2);
  const full = Math.floor(halves / 2);
  const half = halves % 2 === 1;
  return { full, half, empty: 5 - full - (half ? 1 : 0) };
}

/** "★★★★½"-style text for screen readers and titles: "4.5 out of 5". */
export function ratingLabel(average: number, count: number): string {
  return `${average.toFixed(1)} out of 5 from ${count} rating${count === 1 ? '' : 's'}`;
}

/** Up to two initials ("Carlo Dela Cruz" → "CC"); "?" when there is no name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** "Red Honda TMX 155" with missing parts left out; '' when all are missing. */
export function vehicleDescription(color: string | null, brand: string | null, model: string | null): string {
  return [color, brand, model].filter((part): part is string => Boolean(part)).join(' ');
}

export type PageSlice<T> = {
  items: T[];
  /** The page actually shown (clamped to 1…pageCount). */
  page: number;
  pageCount: number;
  /** 1-based positions of the first and last item shown; 0 and 0 when there are none. */
  from: number;
  to: number;
  total: number;
};

export function pageSlice<T>(all: T[], requestedPage: number, pageSize: number = DRIVERS_PAGE_SIZE): PageSlice<T> {
  const total = all.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(requestedPage)), pageCount);
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);
  return { items, page, pageCount, from: items.length ? start + 1 : 0, to: start + items.length, total };
}

/**
 * Page numbers to show, with 'gap' for skipped runs: always the first and last page and the
 * current page's neighbours, e.g. 1 … 4 5 6 … 12.
 */
export function pageNumbers(page: number, pageCount: number): (number | 'gap')[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
  const sorted = [...wanted].sort((a, b) => a - b);
  const result: (number | 'gap')[] = [];
  for (const n of sorted) {
    const previous = result[result.length - 1];
    if (typeof previous === 'number' && n - previous === 2) result.push(previous + 1);
    else if (typeof previous === 'number' && n - previous > 2) result.push('gap');
    result.push(n);
  }
  return result;
}
