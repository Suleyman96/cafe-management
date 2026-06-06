// Plan 14 — minimal RFC 4180 CSV writer used by the shift reconciliation
// export. We avoid a third-party dep (no papaparse / csv-stringify) because
// our needs are flat: a 2D array of strings/numbers/Dates with header row.
// Lives in @gustri/core because it is headless and reused by web + mobile
// (mobile may export operational reports as CSV too once the parity gap on
// reporting closes).

export type CsvCell = string | number | boolean | null | undefined | Date;

const NEEDS_QUOTING = /[",\r\n]/;
// CSV/formula-injection: a *string* cell starting with one of these is
// interpreted as a formula by Excel / Google Sheets / LibreOffice, so a
// free-text value like a `staff_name` of `=cmd|'/c calc'!A1` would execute on
// open. We only screen string cells — numbers/booleans/Dates are
// machine-formatted and safe (and we must NOT prefix a legitimate negative
// number with a quote).
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  let s: string;
  if (value instanceof Date) {
    s = value.toISOString();
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    s = String(value);
  } else {
    s = value;
    // Neutralize formula injection by prefixing a single quote (OWASP) so the
    // spreadsheet treats the cell as text.
    if (FORMULA_TRIGGER.test(s)) {
      s = `'${s}`;
    }
  }
  if (NEEDS_QUOTING.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(rows: CsvCell[][]): string {
  // \r\n line endings — required by RFC 4180 and the safest default for
  // Excel on Windows. Spreadsheet tools handle either; downloads opened
  // directly into Excel surface single-LF rows as one long row.
  return rows.map((r) => r.map(escapeCell).join(',')).join('\r\n');
}

/**
 * Trigger a browser download of the given CSV string. UTF-8 BOM is
 * prepended so Excel auto-detects the encoding (otherwise the first
 * non-ASCII character — common in localized currency symbols — renders
 * mojibake on Windows). The function is a no-op outside the browser so
 * SSR-rendered pages don't blow up at import time.
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke on the next tick so the click has settled.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
