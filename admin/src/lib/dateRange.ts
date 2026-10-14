// Date ranges picked with two <input type="date"> fields (Out-of-Area Trips, Reports).
// Both days are inclusive and in the admin's local time. Kept free of Firebase imports.

/** 'YYYY-MM-DD' in local time, the value format of <input type="date">. */
export function toDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The last `days` days including today. */
export function defaultDateRange(now: Date, days: number): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  return { from: toDateInputValue(from), to: toDateInputValue(now) };
}

function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toDateInputValue(date) === value ? date : null;
}

export type DateRange = { start: Date; end: Date };

/** Calendar days in the range (both ends inclusive). */
export function rangeDays(range: DateRange): number {
  // Round: a day with a daylight-saving change is not exactly 24 hours.
  return Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000);
}

/**
 * Start is midnight of `from`, end is midnight after `to` (query with field >= start and
 * field < end). `maxDays` optionally caps the length of the range.
 */
export function parseDateRange(from: string, to: string, maxDays?: number): DateRange | { error: string } {
  const start = parseDateInput(from);
  const toDate = parseDateInput(to);
  if (!start || !toDate) return { error: 'Choose both a start date and an end date.' };
  if (toDate.getTime() < start.getTime()) return { error: 'The start date must be on or before the end date.' };
  const range = { start, end: new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() + 1) };
  if (maxDays !== undefined && rangeDays(range) > maxDays) {
    return { error: `Choose a range of at most ${maxDays} days.` };
  }
  return range;
}
