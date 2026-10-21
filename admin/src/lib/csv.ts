import { toCsv } from '../reports/reportMath';

/** Downloads rows as a UTF-8 CSV file (Excel-friendly, see toCsv). */
export function downloadCsv(fileName: string, rows: (string | number)[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
