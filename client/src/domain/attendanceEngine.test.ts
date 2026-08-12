import { describe, expect, it } from 'vitest';
import { calculateAttendance } from './attendanceEngine';
import { exclusiveEndUtc, localDate, southAfricanDateStartUtc } from './dateTime';
import type { AttendanceTransaction, EmployeeSummary } from './types';

const employee: EmployeeSummary = {
  employeeSourceId: 'E1', employeeNumber: '1001', displayName: 'Test Employee', firstName: 'Test', lastName: 'Employee', departmentId: 'D1', departmentName: 'Finance',
};
const date = '2026-08-03';

function utc(localTime: string) { return new Date(`${date}T${localTime}:00+02:00`).toISOString(); }
function tx(id: string, time: string, readerName: string): AttendanceTransaction {
  return { transactionId: id, employeeSourceId: employee.employeeSourceId, employeeNumber: employee.employeeNumber, displayName: employee.displayName,
    departmentId: employee.departmentId, departmentName: employee.departmentName, occurredAtUtc: utc(time), readerName, transactionTypeId: 1, transactionTypeName: 'Access' };
}
function calculate(items: AttendanceTransaction[]) { return calculateAttendance(items, { startDate: date, endDate: date, employees: [employee] }).daily[0]; }
const IN = 'Main Door T and A Reader (IN)';
const OUT = 'Main Door T and A Reader (OUT)';
const BIN = 'Basement T and A (IN)';

describe('attendance calculation engine', () => {
  it('pairs a normal IN and OUT sequence', () => {
    const result = calculate([tx('1', '08:00', IN), tx('2', '12:00', OUT), tx('3', '13:00', BIN), tx('4', '16:30', OUT)]);
    expect(result.sessions).toHaveLength(2);
    expect(result.breakMinutes).toBe(60);
    expect(result.netMinutes).toBe(450);
    expect(result.status).toBe('Present');
  });

  it('deducts the fixed one-hour lunch when no lunch clockings exist', () => {
    const result = calculate([tx('1', '08:00', IN), tx('2', '16:30', OUT)]);
    expect(result.grossMinutes).toBe(510);
    expect(result.breakMinutes).toBe(60);
    expect(result.netMinutes).toBe(450);
  });

  it('normalises a shorter lunch clocking to one hour', () => {
    const result = calculate([tx('1', '08:00', IN), tx('2', '12:30', OUT), tx('3', '13:00', IN), tx('4', '16:30', OUT)]);
    expect(result.breaks[0].durationMinutes).toBe(30);
    expect(result.breakMinutes).toBe(60);
    expect(result.netMinutes).toBe(450);
  });

  it('calculates multiple daily sessions and breaks', () => {
    const result = calculate([tx('1', '08:00', IN), tx('2', '10:00', OUT), tx('3', '10:15', BIN), tx('4', '12:00', OUT), tx('5', '13:00', IN), tx('6', '16:30', OUT)]);
    expect(result.sessions).toHaveLength(3);
    expect(result.breakMinutes).toBe(75);
    expect(result.netMinutes).toBe(435);
  });

  it('flags a missing IN', () => {
    const result = calculate([tx('1', '16:30', OUT)]);
    expect(result.exceptions.map((item) => item.type)).toContain('Missing IN');
    expect(result.unmatchedTransactions).toHaveLength(1);
  });

  it('flags a missing OUT without creating an assumed time', () => {
    const result = calculate([tx('1', '08:00', IN)]);
    expect(result.exceptions.map((item) => item.type)).toContain('Missing OUT');
    expect(result.finalOutUtc).toBeUndefined();
    expect(result.netMinutes).toBe(0);
  });

  it('flags consecutive IN transactions', () => {
    const result = calculate([tx('1', '08:00', IN), tx('2', '08:02', BIN), tx('3', '16:30', OUT)]);
    expect(result.exceptions.map((item) => item.type)).toContain('Consecutive IN');
    expect(result.sessions[0].inTransaction.transactionId).toBe('1');
  });

  it('flags consecutive OUT transactions', () => {
    const result = calculate([tx('1', '08:00', IN), tx('2', '16:29', OUT), tx('3', '16:30', OUT)]);
    expect(result.exceptions.map((item) => item.type)).toContain('Consecutive OUT');
  });

  it('detects and excludes duplicate transactions from pairing', () => {
    const result = calculate([tx('1', '08:00', IN), tx('2', '08:00', IN), tx('3', '16:30', OUT)]);
    expect(result.exceptions.map((item) => item.type)).toContain('Duplicate transaction');
    expect(result.sessions).toHaveLength(1);
  });

  it('classifies an unmapped Reader Name as unknown', () => {
    const result = calculate([tx('1', '08:00', 'Visitor Reader'), tx('2', '16:30', OUT)]);
    expect(result.transactions[0].direction).toBe('UNKNOWN');
    expect(result.exceptions.map((item) => item.type)).toContain('Unknown reader');
  });

  it('uses the confirmed real main-door Reader Name spacing', () => {
    const result = calculate([tx('1', '08:00', 'Main Door T and A Reader  (IN)'), tx('2', '16:30', 'Main Door T and A Reader  (OUT)')]);
    expect(result.transactions.map((item) => item.direction)).toEqual(['IN', 'OUT']);
  });

  it('converts UTC timestamps to Africa/Johannesburg', () => {
    expect(southAfricanDateStartUtc(date)).toBe('2026-08-02T22:00:00.000Z');
    expect(exclusiveEndUtc(date)).toBe('2026-08-03T22:00:00.000Z');
    expect(localDate('2026-08-02T22:15:00.000Z')).toBe(date);
  });

  it('excludes time before 08:00 and after 16:30 without an overtime flag', () => {
    const result = calculate([tx('1', '07:30', IN), tx('2', '17:00', OUT)]);
    expect(result.grossMinutes).toBe(510);
    expect(result.netMinutes).toBe(450);
    expect(result.shortfallMinutes).toBe(0);
    expect(result.exceptions.map((item) => item.type)).not.toContain('Overtime');
    expect(result.status).toBe('Present');
  });

  it('calculates shortfall from completed sessions', () => {
    const result = calculate([tx('1', '08:00', IN), tx('2', '14:00', OUT)]);
    expect(result.netMinutes).toBe(300);
    expect(result.shortfallMinutes).toBe(150);
    expect(result.exceptions.map((item) => item.type)).toContain('Short hours');
  });

  it('flags transactions outside the selected UTC boundaries', () => {
    const outside = { ...tx('1', '08:00', IN), occurredAtUtc: '2026-08-01T06:00:00.000Z' };
    const report = calculateAttendance([outside], { startDate: date, endDate: date, employees: [employee] });
    expect(report.outsidePeriodExceptions[0].type).toBe('Transaction outside the selected period');
  });
});
