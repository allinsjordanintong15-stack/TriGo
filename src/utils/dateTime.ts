// Shared date and time formats for the whole app: "Oct 21, 2026 · 7:34 PM".
// Built by hand (not toLocale*/Intl) so every phone shows the same text whatever its
// language or Intl support. Uses the phone's local time zone. Alias-free on purpose, so
// plain Node tests can load this file.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MINUTE_MS = 60 * 1000;

/** "Oct 21, 2026"; null → "—". */
export function formatDate(date: Date | null): string {
  if (!date) return '—';
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** "7:34 PM"; null → "—". */
export function formatTime(date: Date | null): string {
  if (!date) return '—';
  const hours = date.getHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hour12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** "Oct 21, 2026 · 7:34 PM"; null → "—". */
export function formatDateTime(date: Date | null): string {
  if (!date) return '—';
  return `${formatDate(date)} · ${formatTime(date)}`;
}

/** True when both dates fall on the same local calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * How long ago something happened, for open requests: "Just now", "5 min ago",
 * "2 hr ago", then the date ("Oct 21, 2026") from 24 hours. Pass a ticking `now`
 * (useNow) so the label stays current while the screen is open.
 */
export function formatTimeAgo(date: Date, now: number): string {
  const minutes = Math.max(0, Math.floor((now - date.getTime()) / MINUTE_MS));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} hr ago` : formatDate(date);
}

/**
 * Time remaining until a deadline, for commission banners: "2 days 3 hr", "5 hr 12 min",
 * "12 min", "less than 1 min", and "0 min" once it has passed. Floors each part, so it
 * never shows more time than is left.
 */
export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return '0 min';
  const totalMinutes = Math.floor(ms / MINUTE_MS);
  if (totalMinutes < 1) return 'less than 1 min';
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    const minutes = totalMinutes % 60;
    return minutes === 0 ? `${totalHours} hr` : `${totalHours} hr ${minutes} min`;
  }
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const dayText = `${days} ${days === 1 ? 'day' : 'days'}`;
  return hours === 0 ? dayText : `${dayText} ${hours} hr`;
}
