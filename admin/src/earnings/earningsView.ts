// Earnings page view logic: the tabs, the filters kept in the URL, and the "Due" text of the
// Driver balances table. Imports only import-free files (with .ts), so plain Node tests load
// it (tests/booking/adminEarningsView.test.ts). Amounts are integer centavos.

import type { CommissionStatus, StatusSummary } from './commissionStatus.ts';

export type EarningsTab = 'overview' | 'payments' | 'balances' | 'cash-outs';

export const EARNINGS_TABS: { tab: EarningsTab; label: string }[] = [
  { tab: 'overview', label: 'Overview' },
  { tab: 'payments', label: 'Payments to review' },
  { tab: 'balances', label: 'Driver balances' },
  { tab: 'cash-outs', label: 'Cash-outs' },
];

export function earningsTab(value: string | undefined): EarningsTab | null {
  return EARNINGS_TABS.find((t) => t.tab === value)?.tab ?? null;
}

export const EARNINGS_PAGE_SIZES = [10, 20, 50] as const;
export type EarningsPageSize = (typeof EARNINGS_PAGE_SIZES)[number];

/** Payment history and cash-out history show this many per page. */
export const HISTORY_PAGE_SIZE = 10;

function readPage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

// ─── Driver balances ────────────────────────────────────────────────────────

/**
 * 'behind' (overdue or suspended) has no chip of its own; the Dashboard's "drivers behind on
 * commission" card links to it, and it shows as an extra chip while chosen.
 */
export type BalanceChip = 'all' | CommissionStatus | 'behind';

export const BALANCE_CHIPS: BalanceChip[] = ['all', 'paid_up', 'due', 'overdue', 'suspended'];

export const BALANCE_CHIP_LABELS: Record<BalanceChip, string> = {
  all: 'All',
  paid_up: 'Paid up',
  due: 'Due',
  overdue: 'Overdue',
  suspended: 'Suspended (non-payment)',
  behind: 'Overdue or suspended',
};

export type BalanceFilters = { search: string; status: BalanceChip; pageSize: EarningsPageSize };

export const DEFAULT_BALANCE_FILTERS: BalanceFilters = { search: '', status: 'all', pageSize: 10 };

const ALL_BALANCE_CHIPS: BalanceChip[] = [...BALANCE_CHIPS, 'behind'];

/** ?q=&status=&rows=&page= on the Driver balances tab. */
export function readBalanceFilters(params: URLSearchParams): BalanceFilters {
  const rows = Number(params.get('rows'));
  return {
    search: params.get('q') ?? '',
    status: ALL_BALANCE_CHIPS.find((chip) => chip === params.get('status')) ?? 'all',
    pageSize: EARNINGS_PAGE_SIZES.find((size) => size === rows) ?? DEFAULT_BALANCE_FILTERS.pageSize,
  };
}

export function balanceParams(filters: BalanceFilters, page: number): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.search) params.q = filters.search;
  if (filters.status !== 'all') params.status = filters.status;
  if (filters.pageSize !== DEFAULT_BALANCE_FILTERS.pageSize) params.rows = String(filters.pageSize);
  if (page > 1) params.page = String(page);
  return params;
}

export function matchesBalanceChip(status: CommissionStatus | null, chip: BalanceChip): boolean {
  if (chip === 'all') return true;
  if (chip === 'behind') return status === 'overdue' || status === 'suspended';
  return status === chip;
}

/** The chips to show: the four statuses, plus "Overdue or suspended" while chosen. */
export function visibleBalanceChips(active: BalanceChip): BalanceChip[] {
  return active === 'behind' ? [...BALANCE_CHIPS, 'behind'] : BALANCE_CHIPS;
}

export function readPageParam(params: URLSearchParams, key = 'page'): number {
  return readPage(params.get(key));
}

// ─── Payment history ────────────────────────────────────────────────────────

export type HistoryChip = 'all' | 'confirmed' | 'rejected';

export const HISTORY_CHIPS: { value: HistoryChip; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
];

/** ?history=confirmed|rejected&hpage=N on the Payments tab. */
export function readHistoryFilter(params: URLSearchParams): { status: HistoryChip; page: number } {
  return {
    status: HISTORY_CHIPS.find((c) => c.value === params.get('history'))?.value ?? 'all',
    page: readPage(params.get('hpage')),
  };
}

export function historyParams(status: HistoryChip, page: number): Record<string, string> {
  const params: Record<string, string> = {};
  if (status !== 'all') params.history = status;
  if (page > 1) params.hpage = String(page);
  return params;
}

// ─── "Due" column ───────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
/** Manila is UTC+8 all year. */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function manilaDayNumber(millis: number): number {
  return Math.floor((millis + MANILA_OFFSET_MS) / DAY_MS);
}

/** "Nov 9" for the Manila calendar day containing `millis`. */
export function manilaShortDay(millis: number): string {
  const manila = new Date(millis + MANILA_OFFSET_MS);
  return `${MONTHS[manila.getUTCMonth()]} ${manila.getUTCDate()}`;
}

/** The last Manila day before a period end (a Manila midnight), e.g. Nov 10 00:00 → "Nov 9". */
function lastDayBefore(endMillis: number): string {
  return manilaShortDay(endMillis - 1);
}

/** Formats integer centavos as pesos (the page passes formatCentavos). */
export type CentavosFormatter = (centavos: number) => string;

/**
 * The one-line "Due" text for a driver's balance (all dates are Manila days; periods end at
 * midnight):
 *   due        "Pay by Nov 9 · 2 days left" / "· last day"
 *   overdue    "₱42.10 overdue · grace ends Nov 11"
 *   suspended  "Suspended since Nov 12" (the day after the grace period's last day)
 *   paid up    "—"
 */
export function dueText(summary: StatusSummary, nowMillis: number, peso: CentavosFormatter): string {
  switch (summary.status) {
    case 'paid_up':
      return '—';
    case 'due': {
      if (summary.dueAtMillis === null) return 'Due';
      const daysLeft = manilaDayNumber(summary.dueAtMillis - 1) - manilaDayNumber(nowMillis);
      const left = daysLeft <= 0 ? 'last day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
      return `Pay by ${lastDayBefore(summary.dueAtMillis)} · ${left}`;
    }
    case 'overdue':
      return summary.graceEndsAtMillis === null
        ? `${peso(summary.overdueCentavos)} overdue`
        : `${peso(summary.overdueCentavos)} overdue · grace ends ${lastDayBefore(summary.graceEndsAtMillis)}`;
    case 'suspended':
      return summary.graceEndsAtMillis === null
        ? 'Suspended'
        : `Suspended since ${manilaShortDay(summary.graceEndsAtMillis)}`;
  }
}
