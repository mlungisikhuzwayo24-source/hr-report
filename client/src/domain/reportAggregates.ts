import type { DailyAttendance, EmployeeSummary } from './types';

export interface EmployeePeriodSummary {
  employee: EmployeeSummary;
  expectedDays: number;
  daysPresent: number;
  absences: number;
  lateArrivals: number;
  requiredMinutes: number;
  netMinutes: number;
  shortfallMinutes: number;
  exceptionCount: number;
  attendanceRate: number;
}

export interface DepartmentSummary {
  departmentId?: string;
  departmentName: string;
  employeeCount: number;
  expectedWorkdays: number;
  daysPresent: number;
  absences: number;
  lateArrivals: number;
  requiredMinutes: number;
  netMinutes: number;
  shortfallMinutes: number;
  exceptionCount: number;
  attendanceRate: number;
}

export function aggregateEmployees(records: DailyAttendance[]): EmployeePeriodSummary[] {
  const grouped = groupRecords(records, (record) => record.employee.employeeSourceId);
  return [...grouped.values()].map((employeeRecords) => {
    const expectedRecords = employeeRecords.filter((record) => record.requiredMinutes > 0);
    const daysPresent = expectedRecords.filter((record) => record.status !== 'Absent').length;
    return {
      employee: employeeRecords[0].employee,
      expectedDays: expectedRecords.length,
      daysPresent,
      absences: expectedRecords.length - daysPresent,
      lateArrivals: employeeRecords.filter((record) => record.exceptions.some((item) => item.type === 'Late arrival')).length,
      requiredMinutes: sum(employeeRecords, 'requiredMinutes'),
      netMinutes: sum(employeeRecords, 'netMinutes'),
      shortfallMinutes: sum(employeeRecords, 'shortfallMinutes'),
      exceptionCount: employeeRecords.reduce((total, record) => total + record.exceptions.length, 0),
      attendanceRate: expectedRecords.length === 0 ? 0 : daysPresent / expectedRecords.length,
    };
  }).sort((a, b) => a.employee.displayName.localeCompare(b.employee.displayName));
}

export function aggregateDepartments(records: DailyAttendance[]): DepartmentSummary[] {
  const grouped = groupRecords(records, (record) => record.employee.departmentId ?? record.employee.departmentName);
  return [...grouped.values()].map((departmentRecords) => {
    const expectedRecords = departmentRecords.filter((record) => record.requiredMinutes > 0);
    const daysPresent = expectedRecords.filter((record) => record.status !== 'Absent').length;
    return {
      departmentId: departmentRecords[0].employee.departmentId,
      departmentName: departmentRecords[0].employee.departmentName,
      employeeCount: new Set(departmentRecords.map((record) => record.employee.employeeSourceId)).size,
      expectedWorkdays: expectedRecords.length,
      daysPresent,
      absences: expectedRecords.length - daysPresent,
      lateArrivals: departmentRecords.filter((record) => record.exceptions.some((item) => item.type === 'Late arrival')).length,
      requiredMinutes: sum(departmentRecords, 'requiredMinutes'),
      netMinutes: sum(departmentRecords, 'netMinutes'),
      shortfallMinutes: sum(departmentRecords, 'shortfallMinutes'),
      exceptionCount: departmentRecords.reduce((total, record) => total + record.exceptions.length, 0),
      attendanceRate: expectedRecords.length === 0 ? 0 : daysPresent / expectedRecords.length,
    };
  }).sort((a, b) => a.departmentName.localeCompare(b.departmentName));
}

function sum(records: DailyAttendance[], field: 'requiredMinutes' | 'netMinutes' | 'shortfallMinutes') {
  return records.reduce((total, record) => total + record[field], 0);
}

function groupRecords<T>(records: T[], keyFor: (record: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const record of records) {
    const key = keyFor(record);
    grouped.set(key, [...(grouped.get(key) ?? []), record]);
  }
  return grouped;
}
