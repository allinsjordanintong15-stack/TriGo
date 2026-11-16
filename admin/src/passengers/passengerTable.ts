// The Passengers table: name search, the "With complaints" / "Warned" chips and rows per
// page, kept in the URL. Imports only an import-free file (with .ts), so plain Node tests
// load it (tests/booking/adminPassengerTable.test.ts).

import { matchesDriverName } from '../drivers/driverTable.ts';

export const PASSENGER_PAGE_SIZES = [10, 20, 50] as const;
export type PassengerPageSize = (typeof PASSENGER_PAGE_SIZES)[number];

export type PassengerChip = 'all' | 'complaints' | 'warned';

export const PASSENGER_CHIPS: { value: PassengerChip; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'complaints', label: 'With complaints' },
  { value: 'warned', label: 'Warned' },
];

export type PassengerFilters = { search: string; chip: PassengerChip; pageSize: PassengerPageSize };

export const DEFAULT_PASSENGER_FILTERS: PassengerFilters = { search: '', chip: 'all', pageSize: 10 };

/** ?q=&show=&rows=; unknown values fall back to the defaults. */
export function readPassengerFilters(params: URLSearchParams): PassengerFilters {
  const rows = Number(params.get('rows'));
  return {
    search: params.get('q') ?? '',
    chip: PASSENGER_CHIPS.find((c) => c.value === params.get('show'))?.value ?? 'all',
    pageSize: PASSENGER_PAGE_SIZES.find((size) => size === rows) ?? DEFAULT_PASSENGER_FILTERS.pageSize,
  };
}

export function passengerParams(filters: PassengerFilters, page: number): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.search) params.q = filters.search;
  if (filters.chip !== 'all') params.show = filters.chip;
  if (filters.pageSize !== DEFAULT_PASSENGER_FILTERS.pageSize) params.rows = String(filters.pageSize);
  if (page > 1) params.page = String(page);
  return params;
}

/** Search or a chip narrow the list ("Clear search"); rows per page does not. */
export function hasPassengerFilters(filters: PassengerFilters): boolean {
  return filters.search.trim() !== '' || filters.chip !== 'all';
}

export { matchesDriverName as matchesPassengerName };

/** How many times each id occurs, e.g. complaints per reportedUserId. Empty ids are skipped. */
export function countByUser(ids: readonly (string | null | undefined)[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

export function matchesPassengerChip(
  chip: PassengerChip,
  complaints: number,
  activeWarnings: number,
): boolean {
  if (chip === 'complaints') return complaints > 0;
  if (chip === 'warned') return activeWarnings > 0;
  return true;
}
