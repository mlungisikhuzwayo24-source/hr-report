export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(absolute / 60)}h ${String(absolute % 60).padStart(2, '0')}m`;
}

export function formatCompactDuration(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, '0')}`;
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'percent', maximumFractionDigits: 1 }).format(value);
}

export function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

