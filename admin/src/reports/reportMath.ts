// Pure helpers for the Reports page: report periods, axis ticks, money rounding and CSV.
// Kept free of Firebase imports.

import { rangeDays, toDateInputValue, type DateRange } from '../lib/dateRange';

/** Ranges up to this many days are charted per day; longer ones per calendar month. */
export const MAX_DAILY_DAYS = 62;

/** The longest range the page accepts (about a year, at most 13 monthly periods). */
export const MAX_REPORT_DAYS = 366;

export const DEFAULT_REPORT_DAYS = 30;

export type Granularity = 'day' | 'month';

export type Period = {
  start: Date;
  /** Exclusive. */
  end: Date;
  /** Short axis label, e.g. "Oct 8" or "Oct 2026". */
  label: string;
  /** Full label for tooltips and the table, e.g. "Thu, Oct 8, 2026" or "October 2026". */
  longLabel: string;
  /** For CSV: the period's first day as YYYY-MM-DD. */
  isoStart: string;
};

export function granularityFor(range: DateRange): Granularity {
  return rangeDays(range) <= MAX_DAILY_DAYS ? 'day' : 'month';
}

/** Consecutive periods covering the range exactly; months are clipped to the range. */
export function buildPeriods(range: DateRange): { granularity: Granularity; periods: Period[] } {
  const granularity = granularityFor(range);
  const periods: Period[] = [];
  let cursor = range.start;
  while (cursor.getTime() < range.end.getTime()) {
    const next =
      granularity === 'day'
        ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
        : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const end = next.getTime() < range.end.getTime() ? next : range.end;
    periods.push({
      start: cursor,
      end,
      label:
        granularity === 'day'
          ? cursor.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
          : cursor.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }),
      longLabel:
        granularity === 'day'
          ? cursor.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
          : cursor.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
      isoStart: toDateInputValue(cursor),
    });
    cursor = end;
  }
  return { granularity, periods };
}

/** Sums of centavo amounts carry floating-point noise. */
export function roundPeso(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Evenly spaced "nice" ticks (steps of 1, 2 or 5 × 10^n) from 0 to at least `max`, about
 * `target` intervals. Whole-number steps when `integer` (trip counts).
 */
export function niceTicks(max: number, integer: boolean, target = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const rough = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const multiple = [1, 2, 5, 10].find((m) => m * magnitude >= rough) ?? 10;
  let step = multiple * magnitude;
  if (integer) step = Math.max(1, Math.ceil(step));
  const ticks: number[] = [];
  for (let value = 0; value < max + step; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6);
    if (value >= max) break;
  }
  return ticks;
}

/** Compact axis labels: 950, 1.2K, 15K, 1.5M. */
export function compactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${trimZero(value / 1_000_000)}M`;
  if (Math.abs(value) >= 1_000) return `${trimZero(value / 1_000)}K`;
  return trimZero(value);
}

function trimZero(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** One CSV cell: quoted when it contains a comma, quote or line break. */
function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with CRLF line ends and a UTF-8 BOM so Excel reads it correctly. */
export function toCsv(rows: (string | number)[][]): string {
  return `﻿${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
