import { directionForReader } from './readerMappings';
import { eachWorkday, exclusiveEndUtc, localDate, localTime, southAfricanDateStartUtc } from './dateTime';
import type {
  AttendanceException,
  AttendanceReport,
  AttendanceStatus,
  AttendanceTransaction,
  ClassifiedTransaction,
  DailyAttendance,
  EmployeeSummary,
  ExceptionType,
  WorkSession,
} from './types';

export const attendanceRules = {
  scheduledStartMinutes: 8 * 60,
  scheduledEndMinutes: 16 * 60 + 30,
  lunchStartMinutes: 12 * 60,
  lunchEndMinutes: 14 * 60,
  lunchMinutes: 60,
  requiredMinutes: 7 * 60 + 30,
  lateGraceMinutes: 10,
} as const;

interface CalculateOptions {
  startDate: string;
  endDate: string;
  employees: EmployeeSummary[];
}

export function calculateAttendance(
  transactions: AttendanceTransaction[],
  options: CalculateOptions,
): AttendanceReport {
  const startUtc = new Date(southAfricanDateStartUtc(options.startDate)).getTime();
  const endUtc = new Date(exclusiveEndUtc(options.endDate)).getTime();
  const outsidePeriodExceptions: AttendanceException[] = [];
  const inPeriod: AttendanceTransaction[] = [];

  for (const transaction of transactions) {
    const timestamp = new Date(transaction.occurredAtUtc).getTime();
    if (timestamp < startUtc || timestamp >= endUtc) {
      outsidePeriodExceptions.push(makeException(
        'Transaction outside the selected period',
        transaction,
        localDate(transaction.occurredAtUtc),
        'The transaction falls outside the inclusive start and exclusive end boundary.',
      ));
    } else {
      inPeriod.push(transaction);
    }
  }

  const grouped = new Map<string, AttendanceTransaction[]>();
  for (const transaction of inPeriod) {
    const date = localDate(transaction.occurredAtUtc);
    const key = `${transaction.employeeSourceId}|${date}`;
    grouped.set(key, [...(grouped.get(key) ?? []), transaction]);
  }

  const daily: DailyAttendance[] = [];
  for (const date of eachWorkday(options.startDate, options.endDate)) {
    for (const employee of options.employees) {
      daily.push(calculateDay(employee, date, grouped.get(`${employee.employeeSourceId}|${date}`) ?? []));
    }
  }

  const knownEmployeeIds = new Set(options.employees.map((employee) => employee.employeeSourceId));
  for (const [key, dayTransactions] of grouped) {
    const [employeeSourceId, date] = key.split('|');
    if (!knownEmployeeIds.has(employeeSourceId) || !daily.some((record) => record.key === key)) {
      const first = dayTransactions[0];
      daily.push(calculateDay({
        employeeSourceId,
        employeeNumber: first.employeeNumber,
        displayName: first.displayName,
        firstName: first.firstName,
        lastName: first.lastName,
        departmentId: first.departmentId,
        departmentName: first.departmentName,
      }, date, dayTransactions));
    }
  }

  daily.sort((a, b) => b.date.localeCompare(a.date) || a.employee.displayName.localeCompare(b.employee.displayName));
  return {
    daily,
    exceptions: [...daily.flatMap((record) => record.exceptions), ...outsidePeriodExceptions],
    outsidePeriodExceptions,
  };
}

function calculateDay(
  employee: EmployeeSummary,
  date: string,
  sourceTransactions: AttendanceTransaction[],
): DailyAttendance {
  const sorted = [...sourceTransactions].sort(
    (a, b) => new Date(a.occurredAtUtc).getTime() - new Date(b.occurredAtUtc).getTime(),
  );
  const transactions: ClassifiedTransaction[] = sorted.map((transaction) => ({
    ...transaction,
    direction: directionForReader(transaction.readerName),
    localDate: date,
    localTime: localTime(transaction.occurredAtUtc, true),
  }));

  const exceptions: AttendanceException[] = [];
  const sessions: WorkSession[] = [];
  const unmatchedTransactions: ClassifiedTransaction[] = [];
  let openIn: ClassifiedTransaction | undefined;
  let previousDirection: 'IN' | 'OUT' | undefined;
  const duplicateSignatures = new Set<string>();

  for (const transaction of transactions) {
    const signature = `${transaction.occurredAtUtc}|${transaction.readerName}|${transaction.transactionTypeId}`;
    if (duplicateSignatures.has(signature)) {
      transaction.isDuplicate = true;
      transaction.isUnmatched = true;
      unmatchedTransactions.push(transaction);
      exceptions.push(makeException('Duplicate transaction', transaction, date, 'Same employee, time, reader, and type as an earlier transaction.'));
      continue;
    }
    duplicateSignatures.add(signature);

    if (transaction.direction === 'UNKNOWN') {
      transaction.isUnmatched = true;
      unmatchedTransactions.push(transaction);
      exceptions.push(makeException('Unknown reader', transaction, date, `No direction mapping exists for ${transaction.readerName}.`));
      continue;
    }

    if (transaction.direction === previousDirection) {
      const type: ExceptionType = transaction.direction === 'IN' ? 'Consecutive IN' : 'Consecutive OUT';
      exceptions.push(makeException(type, transaction, date, `A second ${transaction.direction} occurred without the opposite direction.`));
    }

    if (transaction.direction === 'IN') {
      if (openIn) {
        transaction.isUnmatched = true;
        unmatchedTransactions.push(transaction);
      } else {
        openIn = transaction;
      }
    } else if (openIn) {
      sessions.push({
        inTransaction: openIn,
        outTransaction: transaction,
        durationMinutes: minutesBetween(openIn.occurredAtUtc, transaction.occurredAtUtc),
      });
      openIn = undefined;
    } else {
      transaction.isUnmatched = true;
      unmatchedTransactions.push(transaction);
      exceptions.push(makeException('Missing IN', transaction, date, 'OUT transaction has no preceding valid IN.'));
    }

    previousDirection = transaction.direction;
  }

  if (openIn) {
    openIn.isUnmatched = true;
    unmatchedTransactions.push(openIn);
    exceptions.push(makeException('Missing OUT', openIn, date, 'IN transaction has no following valid OUT.'));
  }

  const validIns = transactions.filter((transaction) => transaction.direction === 'IN' && !transaction.isDuplicate);
  const validOuts = transactions.filter((transaction) => transaction.direction === 'OUT' && !transaction.isDuplicate);
  const firstInUtc = validIns.at(0)?.occurredAtUtc;
  const finalOutUtc = validOuts.at(-1)?.occurredAtUtc;
  const scheduleStartUtc = utcAtLocalMinute(date, attendanceRules.scheduledStartMinutes);
  const scheduleEndUtc = utcAtLocalMinute(date, attendanceRules.scheduledEndMinutes);
  const lunchStartUtc = utcAtLocalMinute(date, attendanceRules.lunchStartMinutes);
  const lunchEndUtc = utcAtLocalMinute(date, attendanceRules.lunchEndMinutes);
  const grossMinutes = firstInUtc && finalOutUtc && new Date(finalOutUtc) >= new Date(firstInUtc)
    ? overlapMinutes(firstInUtc, finalOutUtc, scheduleStartUtc, scheduleEndUtc)
    : 0;
  const breaks = sessions.slice(1).map((session, index) => {
    const previous = sessions[index];
    return {
      startUtc: previous.outTransaction.occurredAtUtc,
      endUtc: session.inTransaction.occurredAtUtc,
      durationMinutes: Math.max(0, minutesBetween(previous.outTransaction.occurredAtUtc, session.inTransaction.occurredAtUtc)),
    };
  });
  const scheduledSessionMinutes = sessions.reduce(
    (total, session) => total + overlapMinutes(
      session.inTransaction.occurredAtUtc,
      session.outTransaction.occurredAtUtc,
      scheduleStartUtc,
      scheduleEndUtc,
    ),
    0,
  );
  const actualLunchBreakMinutes = breaks.reduce(
    (total, item) => total + overlapMinutes(item.startUtc, item.endUtc, lunchStartUtc, lunchEndUtc),
    0,
  );
  const policyLunchMinutes = firstInUtc && finalOutUtc
    ? Math.min(
        attendanceRules.lunchMinutes,
        overlapMinutes(firstInUtc, finalOutUtc, lunchStartUtc, lunchEndUtc),
      )
    : 0;
  const additionalLunchDeduction = Math.max(0, policyLunchMinutes - actualLunchBreakMinutes);
  const netMinutes = Math.max(0, scheduledSessionMinutes - additionalLunchDeduction);
  const breakMinutes = Math.max(0, grossMinutes - netMinutes);
  const weekday = ![0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
  const requiredMinutes = weekday ? attendanceRules.requiredMinutes : 0;
  const shortfallMinutes = Math.max(0, requiredMinutes - netMinutes);

  if (weekday && firstInUtc && localMinuteOfDay(firstInUtc) > attendanceRules.scheduledStartMinutes + attendanceRules.lateGraceMinutes) {
    exceptions.push(makeException('Late arrival', validIns[0], date, `First IN was ${localTime(firstInUtc)}; grace ends at 08:10.`));
  }
  if (weekday && finalOutUtc && localMinuteOfDay(finalOutUtc) < attendanceRules.scheduledEndMinutes) {
    exceptions.push(makeException('Early departure', validOuts.at(-1)!, date, `Final OUT was ${localTime(finalOutUtc)}; schedule ends at 16:30.`));
  }
  if (weekday && sourceTransactions.length > 0 && netMinutes < requiredMinutes) {
    exceptions.push(makeSummaryException('Short hours', employee, date, `${shortfallMinutes} scheduled minutes were not worked.`));
  }

  const status = determineStatus(sourceTransactions.length, exceptions, shortfallMinutes);
  return {
    key: `${employee.employeeSourceId}|${date}`,
    date,
    employee,
    firstInUtc,
    finalOutUtc,
    grossMinutes,
    breakMinutes,
    netMinutes,
    requiredMinutes,
    shortfallMinutes,
    varianceMinutes: Math.min(0, netMinutes - requiredMinutes),
    status,
    exceptions,
    transactions,
    sessions,
    breaks,
    unmatchedTransactions,
  };
}

function determineStatus(
  transactionCount: number,
  exceptions: AttendanceException[],
  shortfallMinutes: number,
): AttendanceStatus {
  if (transactionCount === 0) return 'Absent';
  const critical = new Set<ExceptionType>([
    'Missing IN', 'Missing OUT', 'Consecutive IN', 'Consecutive OUT', 'Duplicate transaction', 'Unknown reader',
  ]);
  if (exceptions.some((item) => critical.has(item.type))) return 'Exception';
  if (exceptions.some((item) => item.type === 'Late arrival')) return 'Late';
  if (shortfallMinutes > 0) return 'Short hours';
  return 'Present';
}

function utcAtLocalMinute(date: string, minute: number): string {
  const start = new Date(southAfricanDateStartUtc(date)).getTime();
  return new Date(start + minute * 60_000).toISOString();
}

function overlapMinutes(startUtc: string, endUtc: string, windowStartUtc: string, windowEndUtc: string): number {
  const start = Math.max(new Date(startUtc).getTime(), new Date(windowStartUtc).getTime());
  const end = Math.min(new Date(endUtc).getTime(), new Date(windowEndUtc).getTime());
  return Math.max(0, Math.round((end - start) / 60_000));
}

function localMinuteOfDay(utcIso: string): number {
  const [hour, minute] = localTime(utcIso, true).split(':').map(Number);
  return hour * 60 + minute;
}

function minutesBetween(startUtc: string, endUtc: string): number {
  return Math.max(0, Math.round((new Date(endUtc).getTime() - new Date(startUtc).getTime()) / 60_000));
}

function makeException(
  type: ExceptionType,
  transaction: AttendanceTransaction,
  date: string,
  detail: string,
): AttendanceException {
  return {
    id: `${transaction.transactionId}-${type}`,
    type,
    employeeSourceId: transaction.employeeSourceId,
    employeeName: transaction.displayName,
    departmentName: transaction.departmentName,
    localDate: date,
    transactionId: transaction.transactionId,
    occurredAtUtc: transaction.occurredAtUtc,
    detail,
  };
}

function makeSummaryException(
  type: ExceptionType,
  employee: EmployeeSummary,
  date: string,
  detail: string,
): AttendanceException {
  return {
    id: `${employee.employeeSourceId}-${date}-${type}`,
    type,
    employeeSourceId: employee.employeeSourceId,
    employeeName: employee.displayName,
    departmentName: employee.departmentName,
    localDate: date,
    detail,
  };
}
