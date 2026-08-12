export const REPORTING_TIME_ZONE = 'Africa/Johannesburg';

const localDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORTING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const localTimeFormatter = new Intl.DateTimeFormat('en-ZA', {
  timeZone: REPORTING_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function localDate(utcIso: string): string {
  return localDateFormatter.format(new Date(utcIso));
}

export function localTime(utcIso: string, includeSeconds = false): string {
  const value = localTimeFormatter.format(new Date(utcIso));
  return includeSeconds ? value : value.slice(0, 5);
}

export function southAfricanDateStartUtc(date: string): string {
  return new Date(`${date}T00:00:00+02:00`).toISOString();
}

export function exclusiveEndUtc(endDate: string): string {
  const [year, month, day] = endDate.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDate = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  return southAfricanDateStartUtc(nextDate);
}

export function eachWorkday(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function formatReportDate(date: string): string {
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));
}

