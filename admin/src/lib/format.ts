// Display formatting for the whole admin website, always en-PH so every page looks the same
// whatever the browser's language: ₱1,234.50, Oct 21, 2026, 3:05 PM. CSV exports keep plain
// numbers and ISO dates instead (see lib/csv.ts callers).

const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const COUNT = new Intl.NumberFormat('en-PH');
const DATE = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' });
const DATE_TIME = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** Pesos, e.g. 1234.5 → "₱1,234.50"; null → "—". */
export function formatPeso(amount: number | null | undefined): string {
  return amount === null || amount === undefined ? '—' : PESO.format(amount);
}

/** Integer centavos, e.g. 123450 → "₱1,234.50"; null → "—". */
export function formatCentavos(centavos: number | null | undefined): string {
  return centavos === null || centavos === undefined ? '—' : PESO.format(centavos / 100);
}

/** 1234 → "1,234". */
export function formatCount(value: number): string {
  return COUNT.format(value);
}

/** "1 driver", "3 drivers" (or the given plural). */
export function plural(count: number, word: string, pluralWord = `${word}s`): string {
  return `${formatCount(count)} ${count === 1 ? word : pluralWord}`;
}

/** "Oct 21, 2026"; null → "—". */
export function formatDate(date: Date | null | undefined): string {
  return date ? DATE.format(date) : '—';
}

/** "3:05 PM"; null → "—". */
export function formatTime(date: Date | null | undefined): string {
  return date ? TIME.format(date) : '—';
}

/** "Oct 21, 2026, 3:05 PM"; null → "—". */
export function formatDateTime(date: Date | null | undefined): string {
  return date ? DATE_TIME.format(date) : '—';
}

/** A calendar day stored as 'YYYY-MM-DD' (e.g. a cash-out date) → "Oct 21, 2026". */
export function formatIsoDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? DATE.format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : value || '—';
}

/** "Last updated Oct 21, 2026, 3:05 PM." for settings pages. */
export function lastUpdated(date: Date | null): string {
  return `Last updated ${date ? formatDateTime(date) : 'at an unknown time'}.`;
}

/** A peso amount as an editable input value with 2 decimals, e.g. 20.5 → "20.50". */
export function amountInputValue(amount: number): string {
  return amount.toFixed(2);
}
