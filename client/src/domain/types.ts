export interface AttendanceTransaction {
  transactionId: string;
  employeeSourceId: string;
  employeeNumber?: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  departmentId?: string;
  departmentName: string;
  occurredAtUtc: string;
  readerSourceId?: string;
  readerName: string;
  transactionTypeId: number;
  transactionTypeName?: string;
  deviceName?: string;
  terminalName?: string;
  controllerName?: string;
  locationName?: string;
}

export interface EmployeeSummary {
  employeeSourceId: string;
  employeeNumber?: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  departmentId?: string;
  departmentName: string;
}

export type Direction = 'IN' | 'OUT' | 'UNKNOWN';

export type ExceptionType =
  | 'Missing IN'
  | 'Missing OUT'
  | 'Consecutive IN'
  | 'Consecutive OUT'
  | 'Duplicate transaction'
  | 'Unknown reader'
  | 'Late arrival'
  | 'Early departure'
  | 'Short hours'
  | 'Transaction outside the selected period';

export type AttendanceStatus =
  | 'Present'
  | 'Absent'
  | 'Late'
  | 'Short hours'
  | 'Exception';

export interface ClassifiedTransaction extends AttendanceTransaction {
  direction: Direction;
  localDate: string;
  localTime: string;
  isDuplicate?: boolean;
  isUnmatched?: boolean;
}

export interface AttendanceException {
  id: string;
  type: ExceptionType;
  employeeSourceId: string;
  employeeName: string;
  departmentName: string;
  localDate: string;
  transactionId?: string;
  occurredAtUtc?: string;
  detail: string;
}

export interface WorkSession {
  inTransaction: ClassifiedTransaction;
  outTransaction: ClassifiedTransaction;
  durationMinutes: number;
}

export interface BreakPeriod {
  startUtc: string;
  endUtc: string;
  durationMinutes: number;
}

export interface DailyAttendance {
  key: string;
  date: string;
  employee: EmployeeSummary;
  firstInUtc?: string;
  finalOutUtc?: string;
  grossMinutes: number;
  breakMinutes: number;
  netMinutes: number;
  requiredMinutes: number;
  shortfallMinutes: number;
  varianceMinutes: number;
  status: AttendanceStatus;
  exceptions: AttendanceException[];
  transactions: ClassifiedTransaction[];
  sessions: WorkSession[];
  breaks: BreakPeriod[];
  unmatchedTransactions: ClassifiedTransaction[];
}

export interface AttendanceReport {
  daily: DailyAttendance[];
  exceptions: AttendanceException[];
  outsidePeriodExceptions: AttendanceException[];
}

export interface ReportFilters {
  startDate: string;
  endDate: string;
  departmentId: string;
  employeeSourceId: string;
  status: string;
  exceptionType: string;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
