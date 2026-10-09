/** yyyy-MM-dd → local Date without the UTC shift that `new Date('yyyy-MM-dd')` causes. */
export function parseDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string): string {
  if (!value) return '-';
  const d = parseDate(value);
  return d ? d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : value;
}

export function formatDateTime(value: string): string {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString('th-TH', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function formatNumber(n: number): string {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 1 });
}

/** Neutralise spreadsheet formulas (=, +, -, @) in exported cells. */
function csvCell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const text = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Thai fiscal evaluation round: round 1 = Oct–Mar, round 2 = Apr–Sep.
 * The fiscal year (B.E.) starts in October, so Oct 2026 – Mar 2027 is "1/2570".
 */
export function evalRound(value: string): string {
  const d = parseDate(value);
  if (!d) return '';
  const month = d.getMonth() + 1;
  const fiscalYear = (month >= 10 ? d.getFullYear() + 1 : d.getFullYear()) + 543;
  return `${month >= 10 || month <= 3 ? 1 : 2}/${fiscalYear}`;
}

/** Today as yyyy-MM-dd in local time. */
export function todayString(): string {
  const n = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

/** The round containing today (local time). */
export function currentRound(): string {
  return evalRound(todayString());
}

/** Round labels present in `dates`, plus the current one, newest first. */
export function evalRounds(dates: Iterable<string>): string[] {
  const set = new Set<string>([currentRound()]);
  // Entries may be dates or already-formatted rounds ("1/2570").
  for (const d of dates) set.add(/^[12]\/\d{4}$/.test(d) ? d : evalRound(d));
  set.delete('');
  const order = (r: string) => {
    const [n, y] = r.split('/').map(Number);
    return y * 10 + n;
  };
  return [...set].sort((a, b) => order(b) - order(a));
}

/** Move `n` rounds forward (or back, if negative): shiftRound('1/2570', 1) === '2/2570'. */
export function shiftRound(round: string, n: number): string {
  const [k, y] = round.split('/').map(Number);
  const idx = y * 2 + (k - 1) + n;
  return `${(idx % 2) + 1}/${Math.floor(idx / 2)}`;
}

/** Rounds offered when creating an event: two back to three ahead of the current one, plus `extra`. */
export function roundOptions(extra: string[] = []): string[] {
  const cur = currentRound();
  const set = new Set<string>(extra.filter(Boolean));
  for (let n = -2; n <= 3; n++) set.add(shiftRound(cur, n));
  return [...set].sort((a, b) => {
    const [ka, ya] = a.split('/').map(Number);
    const [kb, yb] = b.split('/').map(Number);
    return yb * 10 + kb - (ya * 10 + ka);
  });
}
