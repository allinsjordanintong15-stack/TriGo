// Complaints list (both tabs): status chips, search, rows per page and the complaint open in
// the side panel, all kept in the URL; plus the short texts the table shows. Imports only an
// import-free file (with .ts), so plain Node tests load it (tests/booking/adminComplaintsTable.test.ts).

import { OUTCOME_LABELS, type ComplaintOutcome } from './complaintResolve.ts';

export type ComplaintChip = 'open' | 'in_review' | 'resolved' | 'all';

export const COMPLAINT_CHIPS: { value: ComplaintChip; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

export const COMPLAINT_PAGE_SIZES = [10, 20, 50] as const;
export type ComplaintPageSize = (typeof COMPLAINT_PAGE_SIZES)[number];

export type ComplaintFilters = {
  /** Open by default: what needs attention first. */
  status: ComplaintChip;
  /** Reporter or reported person's name. */
  search: string;
  pageSize: ComplaintPageSize;
  /** The complaint shown in the side panel (its ID), or null. */
  open: string | null;
};

export const DEFAULT_COMPLAINT_FILTERS: ComplaintFilters = { status: 'open', search: '', pageSize: 10, open: null };

/** ?status=&q=&rows=&page=&open=; unknown values fall back to the defaults. */
export function readComplaintFilters(params: URLSearchParams): ComplaintFilters {
  const rows = Number(params.get('rows'));
  const open = params.get('open');
  return {
    status: COMPLAINT_CHIPS.find((c) => c.value === params.get('status'))?.value ?? 'open',
    search: params.get('q') ?? '',
    pageSize: COMPLAINT_PAGE_SIZES.find((size) => size === rows) ?? DEFAULT_COMPLAINT_FILTERS.pageSize,
    open: open && /^[^/]{1,200}$/.test(open) ? open : null,
  };
}

export function complaintParams(filters: ComplaintFilters, page: number): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.status !== 'open') params.status = filters.status;
  if (filters.search) params.q = filters.search;
  if (filters.pageSize !== DEFAULT_COMPLAINT_FILTERS.pageSize) params.rows = String(filters.pageSize);
  if (page > 1) params.page = String(page);
  if (filters.open) params.open = filters.open;
  return params;
}

/** Case-insensitive; every word typed must appear in the reporter's or the reported person's name. */
export function matchesComplaintSearch(reporterName: string, reportedName: string | null, search: string): boolean {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const matches = (name: string) => words.every((word) => name.toLowerCase().includes(word));
  return matches(reporterName) || (reportedName !== null && matches(reportedName));
}

/** The text under "Resolved": the outcome, or nothing for complaints resolved before outcomes existed. */
export function outcomeText(outcome: ComplaintOutcome | null): string | null {
  return outcome ? OUTCOME_LABELS[outcome] : null;
}

/** First line of the message, for the list (full text goes in the title). */
export function firstLine(message: string): string {
  return message.trim().split(/\r?\n/)[0] ?? '';
}

/** The empty-state text for a chip. */
export function emptyComplaintsText(status: ComplaintChip, filtered: boolean): string {
  if (filtered) return 'No complaints match your search.';
  if (status === 'open') return 'No open complaints — all caught up.';
  if (status === 'in_review') return 'No complaints in review.';
  if (status === 'resolved') return 'No resolved complaints yet.';
  return 'No complaints yet.';
}
