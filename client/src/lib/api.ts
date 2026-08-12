import type { AttendanceTransaction, EmployeeSummary, PagedResult } from '../domain/types';

interface AttendanceMeta {
  applicationName: string;
  dataSource: 'Mock' | 'SqlServer';
  reportingTimeZone: string;
  sourceTimestamp: string;
  dateBoundary: string;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { detail?: string; title?: string } | null;
    throw new Error(problem?.detail ?? problem?.title ?? `Request failed with ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

export function getMeta(signal?: AbortSignal) {
  return getJson<AttendanceMeta>('/api/attendance/meta', signal);
}

export function getEmployees(signal?: AbortSignal) {
  return getJson<EmployeeSummary[]>('/api/attendance/employees', signal);
}

export async function getTransactions(startUtc: string, endUtc: string, signal?: AbortSignal) {
  const getPage = (page: number) => {
    const query = new URLSearchParams({ startUtc, endUtc, page: String(page), pageSize: '500' });
    return getJson<PagedResult<AttendanceTransaction>>(`/api/attendance/transactions?${query}`, signal);
  };

  const first = await getPage(1);
  const items = [...first.items];
  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await getPage(page);
    items.push(...next.items);
  }
  return { ...first, items };
}
