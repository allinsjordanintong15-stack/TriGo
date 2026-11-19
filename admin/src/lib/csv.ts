// CSV export for the admin website. No imports, so plain Node tests can load this file
// (tests/admin/csvExport.test.ts).

/** A number written with fixed decimals, e.g. pesos "700.50". Never treated as text. */
export type CsvAmount = { readonly csvNumber: string };

/** A cell: text, a number, or a fixed-decimal amount. */
export type CsvValue = string | number | CsvAmount;

/** A numeric cell with `decimals` places: csvAmount(700.5) → 700.50, csvAmount(-12) → -12.00. */
export function csvAmount(value: number, decimals = 2): CsvAmount {
  return { csvNumber: value.toFixed(decimals) };
}

/**
 * Text that a spreadsheet would run as a formula when it starts with one of these
 * (= + - @, tab, carriage return): SEC-09. Such text gets a leading ' so Excel and
 * Sheets show it as plain text. Numbers and amounts are written as they are, so negative
 * values stay numbers.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

/** One CSV cell: formula-looking text neutralized, then quoted when it contains , " or a line break. */
export function csvCell(value: CsvValue): string {
  let text: string;
  if (typeof value === 'number') text = String(value);
  else if (typeof value === 'object') text = value.csvNumber;
  else text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with CRLF line ends and a UTF-8 BOM so Excel reads it correctly. */
export function toCsv(rows: CsvValue[][]): string {
  return `﻿${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** Downloads rows as a UTF-8 CSV file (Excel-friendly, see toCsv). */
export function downloadCsv(fileName: string, rows: CsvValue[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
