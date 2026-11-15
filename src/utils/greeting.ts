/** Manila is UTC+8 all year (no daylight saving). */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export type TimeOfDayGreeting = 'Good morning' | 'Good afternoon' | 'Good evening';

/**
 * Greeting for the time of day in Manila, whatever the phone's time zone: morning before
 * 12:00, afternoon before 18:00, evening otherwise.
 */
export function getManilaGreeting(epochMs: number): TimeOfDayGreeting {
  const hour = Math.floor((epochMs + MANILA_OFFSET_MS) / HOUR_MS) % 24;
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** First word of a full name, or the fallback when the name is empty. */
export function getFirstName(fullName: string | null | undefined, fallback: string): string {
  return fullName?.trim().split(/\s+/)[0] || fallback;
}
