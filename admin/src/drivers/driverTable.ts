// The Drivers → All drivers table: filters kept in the URL, the account standing and duty
// shown per row, and pagination. Free of imports (types only) so plain Node tests load it
// (tests/booking/adminDriverTable.test.ts).

import type { CommissionStatus } from '../earnings/commissionStatus';

export const DRIVERS_PAGE_SIZE = 10;

export type DutyFilter = 'all' | 'online' | 'available' | 'on_trip' | 'offline';
export type VehicleFilter = 'all' | 'tricycle' | 'motorcycle';
export type AccountFilter = 'active' | 'suspended' | 'revoked' | 'all';
export type CommissionFilter = 'all' | CommissionStatus;

export type DriverTableFilters = {
  search: string;
  duty: DutyFilter;
  vehicle: VehicleFilter;
  account: AccountFilter;
  commission: CommissionFilter;
};

export const DEFAULT_DRIVER_FILTERS: DriverTableFilters = {
  search: '',
  duty: 'all',
  vehicle: 'all',
  account: 'active',
  commission: 'all',
};

export const DUTY_FILTER_OPTIONS: { value: DutyFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'available', label: 'Available' },
  { value: 'on_trip', label: 'On a trip' },
  { value: 'offline', label: 'Offline' },
];

export const VEHICLE_FILTER_OPTIONS: { value: VehicleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tricycle', label: 'Tricycle' },
  { value: 'motorcycle', label: 'Motorcycle' },
];

export const ACCOUNT_FILTER_OPTIONS: { value: AccountFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'all', label: 'All' },
];

export const COMMISSION_FILTER_OPTIONS: { value: CommissionFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid_up', label: 'Paid up' },
  { value: 'due', label: 'Due' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'suspended', label: 'Suspended for non-payment' },
];

function pick<T extends string>(value: string | null, options: { value: T }[], fallback: T): T {
  return options.find((option) => option.value === value)?.value ?? fallback;
}

/** Filters from the URL (?q=&status=&vehicle=&account=&commission=); unknown values fall back to the defaults. */
export function readDriverFilters(params: URLSearchParams): DriverTableFilters {
  return {
    search: params.get('q') ?? '',
    duty: pick(params.get('status'), DUTY_FILTER_OPTIONS, DEFAULT_DRIVER_FILTERS.duty),
    vehicle: pick(params.get('vehicle'), VEHICLE_FILTER_OPTIONS, DEFAULT_DRIVER_FILTERS.vehicle),
    account: pick(params.get('account'), ACCOUNT_FILTER_OPTIONS, DEFAULT_DRIVER_FILTERS.account),
    commission: pick(params.get('commission'), COMMISSION_FILTER_OPTIONS, DEFAULT_DRIVER_FILTERS.commission),
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
  if (filters.duty !== DEFAULT_DRIVER_FILTERS.duty) params.status = filters.duty;
  if (filters.vehicle !== DEFAULT_DRIVER_FILTERS.vehicle) params.vehicle = filters.vehicle;
  if (filters.account !== DEFAULT_DRIVER_FILTERS.account) params.account = filters.account;
  if (filters.commission !== DEFAULT_DRIVER_FILTERS.commission) params.commission = filters.commission;
  if (page > 1) params.page = String(page);
  return params;
}

export function hasActiveFilters(filters: DriverTableFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.duty !== DEFAULT_DRIVER_FILTERS.duty ||
    filters.vehicle !== DEFAULT_DRIVER_FILTERS.vehicle ||
    filters.account !== DEFAULT_DRIVER_FILTERS.account ||
    filters.commission !== DEFAULT_DRIVER_FILTERS.commission
  );
}

/**
 * An admin suspension on drivers/{uid}: suspendedAt set, suspendedUntil a time or null
 * ("until lifted"). It stops counting at suspendedUntil (no write needed). Records without
 * these fields are not suspended. (Admin suspension is Part B; until it exists no driver has them.)
 */
export type AdminSuspension = { suspendedAt: Date | null; suspendedUntil: Date | null };

export function isAdminSuspended(suspension: AdminSuspension | null, nowMillis: number): boolean {
  if (!suspension?.suspendedAt) return false;
  return suspension.suspendedUntil === null || nowMillis < suspension.suspendedUntil.getTime();
}

/** Revoked (or never verified) comes first: a revoked driver cannot work at all. */
export type AccountStanding = 'active' | 'suspended' | 'revoked';

export const ACCOUNT_STANDING_LABELS: Record<AccountStanding, string> = {
  active: 'Active',
  suspended: 'Suspended',
  revoked: 'Revoked',
};

export function accountStanding(isVerified: boolean, suspended: boolean): AccountStanding {
  if (!isVerified) return 'revoked';
  return suspended ? 'suspended' : 'active';
}

/** The dot under the account pill. "Online" covers available and busy-but-online drivers. */
export type DutyDot = 'on_trip' | 'online' | 'offline';

export const DUTY_DOT_LABELS: Record<DutyDot, string> = { on_trip: 'On a trip', online: 'Online', offline: 'Offline' };

export type DutyFields = {
  isOnline: boolean;
  isAvailable: boolean;
  currentBookingId: string | null;
};

export function dutyDot(driver: DutyFields): DutyDot {
  if (driver.currentBookingId) return 'on_trip';
  return driver.isOnline ? 'online' : 'offline';
}

export function matchesDutyFilter(driver: DutyFields, filter: DutyFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'online':
      return driver.isOnline;
    case 'available':
      return driver.isOnline && driver.isAvailable && !driver.currentBookingId;
    case 'on_trip':
      return driver.currentBookingId !== null;
    case 'offline':
      return !driver.isOnline;
  }
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

export function pageSlice<T>(all: T[], requestedPage: number, pageSize = DRIVERS_PAGE_SIZE): PageSlice<T> {
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
