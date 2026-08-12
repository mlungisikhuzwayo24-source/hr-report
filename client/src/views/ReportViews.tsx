import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, DoorOpen, Timer, UserRound } from 'lucide-react';
import { formatReportDate, localDate, localTime, REPORTING_TIME_ZONE } from '../domain/dateTime';
import { aggregateDepartments, aggregateEmployees } from '../domain/reportAggregates';
import { directionForReader } from '../domain/readerMappings';
import type { AttendanceException, AttendanceTransaction, DailyAttendance, EmployeeSummary } from '../domain/types';
import { downloadCsv, formatCompactDuration, formatDuration, formatPercent } from '../lib/format';
import { DirectionBadge, ExceptionBadge, StatusBadge } from '../components/StatusBadge';
import { EmptyState, PageHeading, PrintHeader } from '../components/ReportChrome';

interface ReportProps {
  records: DailyAttendance[];
  startDate: string;
  endDate: string;
}

const timezoneColumn = REPORTING_TIME_ZONE;

export function DailyReportView({ records, startDate, endDate, embedded = false }: ReportProps & { embedded?: boolean }) {
  const exportCsv = () => downloadCsv('daily-attendance.csv',
    ['Date', 'Employee', 'Employee number', 'Department', 'First In', 'Final Out', 'Break', 'Net Hours', 'Required Hours', 'Variance', 'Status', 'Exceptions', 'Reporting timezone'],
    records.map((record) => [record.date, record.employee.displayName, record.employee.employeeNumber, record.employee.departmentName,
      record.firstInUtc ? localTime(record.firstInUtc) : '', record.finalOutUtc ? localTime(record.finalOutUtc) : '', formatCompactDuration(record.breakMinutes),
      formatCompactDuration(record.netMinutes), formatCompactDuration(record.requiredMinutes), formatCompactDuration(record.varianceMinutes), record.status,
      record.exceptions.map((item) => item.type).join('; '), timezoneColumn]));
  return (
    <>
      {!embedded && <PrintHeader startDate={startDate} endDate={endDate} title="Daily attendance report" />}
      {!embedded && <PageHeading title="Daily attendance" description="First and final clockings, paired-session hours, and daily variance." recordCount={records.length} onExport={exportCsv} />}
      {records.length === 0 ? <EmptyState title="No daily records" detail="No employee-days match the current report filters." /> : (
        <Table>
          <thead><tr><Th>Date</Th><Th>Employee</Th><Th>Department</Th><Th>First In</Th><Th>Final Out</Th><Th>Break</Th><Th>Net</Th><Th>Required</Th><Th>Variance</Th><Th>Status</Th><Th>Exceptions</Th></tr></thead>
          <tbody>{records.map((record) => (
            <tr key={record.key}>
              <Td strong>{formatReportDate(record.date)}</Td>
              <Td><EmployeeCell employee={record.employee} /></Td>
              <Td>{record.employee.departmentName}</Td>
              <Td mono>{record.firstInUtc ? localTime(record.firstInUtc) : '—'}</Td>
              <Td mono>{record.finalOutUtc ? localTime(record.finalOutUtc) : '—'}</Td>
              <Td mono>{formatCompactDuration(record.breakMinutes)}</Td>
              <Td mono strong>{formatCompactDuration(record.netMinutes)}</Td>
              <Td mono>{formatCompactDuration(record.requiredMinutes)}</Td>
              <Td mono><span className={record.varianceMinutes < 0 ? 'text-rose-700' : record.varianceMinutes > 0 ? 'text-teal-700' : ''}>{formatCompactDuration(record.varianceMinutes)}</span></Td>
              <Td><StatusBadge status={record.status} /></Td>
              <Td><ExceptionList exceptions={record.exceptions} /></Td>
            </tr>
          ))}</tbody>
        </Table>
      )}
    </>
  );
}

export function MonthlyReportView({ records, startDate, endDate }: ReportProps) {
  const summaries = aggregateEmployees(records);
  const exportCsv = () => downloadCsv('employee-period-summary.csv',
    ['Employee', 'Employee number', 'Department', 'Expected days', 'Days present', 'Absences', 'Late arrivals', 'Required hours', 'Hours worked', 'Shortfall', 'Attendance rate', 'Exceptions', 'Reporting timezone'],
    summaries.map((item) => [item.employee.displayName, item.employee.employeeNumber, item.employee.departmentName, item.expectedDays, item.daysPresent, item.absences,
      item.lateArrivals, formatCompactDuration(item.requiredMinutes), formatCompactDuration(item.netMinutes), formatCompactDuration(item.shortfallMinutes),
      formatPercent(item.attendanceRate), item.exceptionCount, timezoneColumn]));
  return (
    <>
      <PrintHeader startDate={startDate} endDate={endDate} title="Monthly employee report" />
      <PageHeading title="Employee period summary" description="Monthly-style attendance totals for the selected reporting period." recordCount={summaries.length} onExport={exportCsv} />
      {summaries.length === 0 ? <EmptyState title="No employee summaries" detail="No employee records match the current report filters." /> : (
        <Table><thead><tr><Th>Employee</Th><Th>Department</Th><Th>Expected</Th><Th>Present</Th><Th>Absent</Th><Th>Late</Th><Th>Required</Th><Th>Worked</Th><Th>Shortfall</Th><Th>Attendance</Th><Th>Exceptions</Th></tr></thead>
          <tbody>{summaries.map((item) => <tr key={item.employee.employeeSourceId}>
            <Td><EmployeeCell employee={item.employee} /></Td><Td>{item.employee.departmentName}</Td><Td mono>{item.expectedDays}</Td><Td mono strong>{item.daysPresent}</Td>
            <Td mono>{item.absences}</Td><Td mono>{item.lateArrivals}</Td><Td mono>{formatCompactDuration(item.requiredMinutes)}</Td><Td mono strong>{formatCompactDuration(item.netMinutes)}</Td>
            <Td mono><span className="text-rose-700">{formatCompactDuration(item.shortfallMinutes)}</span></Td>
            <Td><Rate value={item.attendanceRate} /></Td><Td mono>{item.exceptionCount}</Td>
          </tr>)}</tbody>
        </Table>
      )}
    </>
  );
}

export function DepartmentReportView({ records, startDate, endDate }: ReportProps) {
  const summaries = aggregateDepartments(records);
  const exportCsv = () => downloadCsv('department-summary.csv',
    ['Department', 'Employee count', 'Expected workdays', 'Days present', 'Absences', 'Late arrivals', 'Required hours', 'Hours worked', 'Shortfall', 'Exceptions', 'Attendance rate', 'Reporting timezone'],
    summaries.map((item) => [item.departmentName, item.employeeCount, item.expectedWorkdays, item.daysPresent, item.absences, item.lateArrivals,
      formatCompactDuration(item.requiredMinutes), formatCompactDuration(item.netMinutes), formatCompactDuration(item.shortfallMinutes),
      item.exceptionCount, formatPercent(item.attendanceRate), timezoneColumn]));
  return (
    <>
      <PrintHeader startDate={startDate} endDate={endDate} title="Department summary report" />
      <PageHeading title="Department summary" description="Attendance, hours, and exception performance by department." recordCount={summaries.length} onExport={exportCsv} />
      {summaries.length === 0 ? <EmptyState title="No department summaries" detail="No departments match the current report filters." /> : (
        <Table><thead><tr><Th>Department</Th><Th>Employees</Th><Th>Expected days</Th><Th>Present</Th><Th>Absences</Th><Th>Late</Th><Th>Required</Th><Th>Worked</Th><Th>Shortfall</Th><Th>Exceptions</Th><Th>Attendance</Th></tr></thead>
          <tbody>{summaries.map((item) => <tr key={item.departmentId ?? item.departmentName}>
            <Td strong>{item.departmentName}</Td><Td mono>{item.employeeCount}</Td><Td mono>{item.expectedWorkdays}</Td><Td mono strong>{item.daysPresent}</Td><Td mono>{item.absences}</Td>
            <Td mono>{item.lateArrivals}</Td><Td mono>{formatCompactDuration(item.requiredMinutes)}</Td><Td mono strong>{formatCompactDuration(item.netMinutes)}</Td>
            <Td mono><span className="text-rose-700">{formatCompactDuration(item.shortfallMinutes)}</span></Td>
            <Td mono>{item.exceptionCount}</Td><Td><Rate value={item.attendanceRate} /></Td>
          </tr>)}</tbody>
        </Table>
      )}
    </>
  );
}

interface EmployeeDetailProps extends ReportProps {
  employees: EmployeeSummary[];
  selectedEmployeeId: string;
  onEmployeeChange: (employeeId: string) => void;
}

export function EmployeeDetailView({ records, employees, selectedEmployeeId, onEmployeeChange, startDate, endDate }: EmployeeDetailProps) {
  const [tab, setTab] = useState<'daily' | 'timeline' | 'sessions'>('daily');
  const employee = employees.find((item) => item.employeeSourceId === selectedEmployeeId) ?? records[0]?.employee;
  const employeeRecords = records.filter((record) => record.employee.employeeSourceId === employee?.employeeSourceId);
  const summary = aggregateEmployees(employeeRecords)[0];
  const transactions = employeeRecords.flatMap((record) => record.transactions).sort((a, b) => new Date(b.occurredAtUtc).getTime() - new Date(a.occurredAtUtc).getTime());

  if (!employee || !summary) return <EmptyState title="No employee detail" detail="Choose an employee with results in the selected reporting period." />;
  const metrics = [
    ['Required hours', formatDuration(summary.requiredMinutes)], ['Net hours worked', formatDuration(summary.netMinutes)], ['Days present', String(summary.daysPresent)],
    ['Shortfall', formatDuration(summary.shortfallMinutes)], ['Attendance rate', formatPercent(summary.attendanceRate)], ['Exceptions', String(summary.exceptionCount)],
  ];
  const exportCsv = () => downloadCsv(`employee-${employee.employeeNumber ?? employee.employeeSourceId}.csv`,
    ['Date', 'Employee', 'Department', 'First In', 'Final Out', 'Break', 'Net Hours', 'Required Hours', 'Shortfall', 'Status', 'Exceptions', 'Reporting timezone'],
    employeeRecords.map((record) => [record.date, employee.displayName, employee.departmentName, record.firstInUtc ? localTime(record.firstInUtc) : '',
      record.finalOutUtc ? localTime(record.finalOutUtc) : '', formatCompactDuration(record.breakMinutes), formatCompactDuration(record.netMinutes),
      formatCompactDuration(record.requiredMinutes), formatCompactDuration(record.shortfallMinutes), record.status,
      record.exceptions.map((item) => item.type).join('; '), timezoneColumn]));

  return (
    <>
      <PrintHeader startDate={startDate} endDate={endDate} title={`Employee detail · ${employee.displayName}`} />
      <PageHeading title="Employee attendance detail" description={`${formatReportDate(startDate)} to ${formatReportDate(endDate)} · ${REPORTING_TIME_ZONE}`} onExport={exportCsv}>
        <select className="detail-select" value={employee.employeeSourceId} onChange={(event) => onEmployeeChange(event.target.value)} aria-label="Select employee detail">
          {employees.map((item) => <option key={item.employeeSourceId} value={item.employeeSourceId}>{item.displayName}</option>)}
        </select>
      </PageHeading>
      <section className="mb-4 flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">{initials(employee.displayName)}</div>
          <div><h3 className="text-lg font-bold text-navy-950">{employee.displayName}</h3><p className="text-sm text-slate-500">{employee.employeeNumber ?? 'No employee number'} · {employee.departmentName}</p></div></div>
        <div className="grid grid-cols-3 gap-x-7 gap-y-3 md:grid-cols-6">{metrics.map(([label, value]) => <div key={label}><div className="text-[11px] font-semibold uppercase text-slate-400">{label}</div><div className="mt-1 text-sm font-bold tabular-nums text-navy-950">{value}</div></div>)}</div>
      </section>
      <div className="no-print mb-4 flex w-fit rounded-md border border-slate-200 bg-white p-1" role="tablist">
        {([['daily', 'Daily attendance'], ['timeline', 'Transaction timeline'], ['sessions', 'Sessions & breaks']] as const).map(([id, label]) => (
          <button key={id} className={`tab-button ${tab === id ? 'tab-button-active' : ''}`} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'daily' && <DailyReportView records={employeeRecords} startDate={startDate} endDate={endDate} embedded />}
      {tab === 'timeline' && (
        <section className="panel overflow-hidden"><div className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-bold text-navy-950">Raw transaction timeline</h3><p className="mt-1 text-xs text-slate-500">Every mapped and unmatched transaction for this employee.</p></div>
          <div className="divide-y divide-slate-100">{transactions.map((transaction) => <div className="grid grid-cols-[90px_68px_1fr] items-start gap-3 px-4 py-3 sm:grid-cols-[110px_68px_1fr_auto]" key={transaction.transactionId}>
            <div className="text-xs tabular-nums text-slate-500"><div className="font-semibold text-slate-700">{formatReportDate(transaction.localDate)}</div>{transaction.localTime}</div>
            <DirectionBadge direction={transaction.direction} /><div><div className="text-sm font-semibold text-navy-950">{transaction.readerName}</div><div className="mt-1 text-xs text-slate-500">{transaction.transactionTypeName ?? 'Transaction'} · {transaction.locationName ?? 'Location not mapped'}</div></div>
            <div className="hidden text-right text-xs text-slate-400 sm:block">{transaction.transactionId}</div>
          </div>)}</div>
        </section>
      )}
      {tab === 'sessions' && <SessionsView records={employeeRecords} />}
    </>
  );
}

function SessionsView({ records }: { records: DailyAttendance[] }) {
  const sessions = records.flatMap((record) => record.sessions.map((session, index) => ({ record, session, index })));
  const breaks = records.flatMap((record) => record.breaks.map((item, index) => ({ record, item, index })));
  const unmatched = records.flatMap((record) => record.unmatchedTransactions);
  return <div className="grid gap-4 xl:grid-cols-3">
    <DetailPanel icon={Clock3} title="Paired sessions" count={sessions.length}>{sessions.map(({ record, session, index }) => <DetailRow key={`${record.key}-${index}`} title={`${localTime(session.inTransaction.occurredAtUtc)} – ${localTime(session.outTransaction.occurredAtUtc)}`} meta={`${formatReportDate(record.date)} · ${formatDuration(session.durationMinutes)}`} />)}</DetailPanel>
    <DetailPanel icon={Timer} title="Break periods" count={breaks.length}>{breaks.length ? breaks.map(({ record, item, index }) => <DetailRow key={`${record.key}-${index}`} title={`${localTime(item.startUtc)} – ${localTime(item.endUtc)}`} meta={`${formatReportDate(record.date)} · ${formatDuration(item.durationMinutes)}`} />) : <PanelEmpty text="No breaks between completed sessions" />}</DetailPanel>
    <DetailPanel icon={DoorOpen} title="Unmatched transactions" count={unmatched.length}>{unmatched.length ? unmatched.map((transaction) => <DetailRow key={transaction.transactionId} title={`${transaction.direction} · ${localTime(transaction.occurredAtUtc)}`} meta={`${formatReportDate(transaction.localDate)} · ${transaction.readerName}`} />) : <PanelEmpty text="All mapped transactions are paired" />}</DetailPanel>
  </div>;
}

export function RawTransactionsView({ transactions, startDate, endDate }: { transactions: AttendanceTransaction[]; startDate: string; endDate: string }) {
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(transactions.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const items = transactions.slice((safePage - 1) * pageSize, safePage * pageSize);
  const exportCsv = () => downloadCsv('raw-transactions.csv',
    ['Transaction ID', 'Local date', 'Local time', 'Employee', 'Employee number', 'Department', 'Reader Name', 'Device', 'Transaction Type', 'UTC timestamp', 'Reporting timezone'],
    transactions.map((item) => [item.transactionId, localDate(item.occurredAtUtc), localTime(item.occurredAtUtc, true), item.displayName, item.employeeNumber,
      item.departmentName, item.readerName, item.deviceName ?? item.terminalName ?? '', item.transactionTypeName ?? item.transactionTypeId, item.occurredAtUtc, timezoneColumn]));
  return <>
    <PrintHeader startDate={startDate} endDate={endDate} title="Raw transaction report" />
    <PageHeading title="Raw transactions" description="Read-only Impro Access Portal transaction projection." recordCount={transactions.length} onExport={exportCsv} />
    {transactions.length === 0 ? <EmptyState title="No transactions" detail="No raw transactions match the selected filters." /> : <>
      <Table><thead><tr><Th>Local date & time</Th><Th>Employee</Th><Th>Department</Th><Th>Reader Name</Th><Th>Direction</Th><Th>Transaction type</Th><Th>Device</Th><Th>Transaction ID</Th></tr></thead>
        <tbody>{items.map((item) => { const direction = directionForReader(item.readerName); return <tr key={item.transactionId}>
          <Td><div className="font-semibold text-slate-700">{formatReportDate(localDate(item.occurredAtUtc))}</div><div className="mt-1 font-mono text-xs text-slate-500">{localTime(item.occurredAtUtc, true)}</div></Td>
          <Td><div className="font-semibold text-navy-950">{item.displayName}</div><div className="mt-1 text-xs text-slate-400">{item.employeeNumber}</div></Td><Td>{item.departmentName}</Td>
          <Td strong>{item.readerName}</Td><Td><DirectionBadge direction={direction} /></Td><Td>{item.transactionTypeName ?? item.transactionTypeId}</Td><Td>{item.deviceName ?? item.terminalName ?? '—'}</Td><Td mono>{item.transactionId}</Td>
        </tr>; })}</tbody>
      </Table>
      <Pagination page={safePage} pageCount={pageCount} onPage={setPage} />
    </>}
  </>;
}

export function ExceptionsView({ exceptions, startDate, endDate }: { exceptions: AttendanceException[]; startDate: string; endDate: string }) {
  const exportCsv = () => downloadCsv('attendance-exceptions.csv',
    ['Date', 'Employee', 'Department', 'Exception', 'Detail', 'Transaction ID', 'UTC timestamp', 'Reporting timezone'],
    exceptions.map((item) => [item.localDate, item.employeeName, item.departmentName, item.type, item.detail, item.transactionId, item.occurredAtUtc, timezoneColumn]));
  return <>
    <PrintHeader startDate={startDate} endDate={endDate} title="Exception report" />
    <PageHeading title="Attendance exceptions" description="Invalid sequences, unmapped readers, and schedule variances requiring attention." recordCount={exceptions.length} onExport={exportCsv} />
    {exceptions.length === 0 ? <EmptyState title="No exceptions found" detail="The selected records contain no attendance exceptions." /> : (
      <Table><thead><tr><Th>Date</Th><Th>Employee</Th><Th>Department</Th><Th>Exception</Th><Th>Time</Th><Th>Detail</Th><Th>Transaction</Th></tr></thead>
        <tbody>{exceptions.map((item) => <tr key={item.id}><Td strong>{formatReportDate(item.localDate)}</Td><Td strong>{item.employeeName}</Td><Td>{item.departmentName}</Td><Td><ExceptionBadge type={item.type} /></Td>
          <Td mono>{item.occurredAtUtc ? localTime(item.occurredAtUtc, true) : '—'}</Td><Td>{item.detail}</Td><Td mono>{item.transactionId ?? 'Daily result'}</Td></tr>)}</tbody>
      </Table>
    )}
  </>;
}

function Table({ children }: { children: React.ReactNode }) { return <div className="panel table-scroll"><table className="report-table">{children}</table></div>; }
function Th({ children }: { children: React.ReactNode }) { return <th>{children}</th>; }
function Td({ children, mono, strong }: { children: React.ReactNode; mono?: boolean; strong?: boolean }) { return <td className={`${mono ? 'font-mono tabular-nums' : ''} ${strong ? 'font-semibold text-navy-950' : ''}`}>{children}</td>; }
function EmployeeCell({ employee }: { employee: EmployeeSummary }) { return <div className="flex min-w-40 items-center gap-2"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-navy-800">{initials(employee.displayName)}</div><div><div className="font-semibold text-navy-950">{employee.displayName}</div><div className="mt-0.5 text-[11px] text-slate-400">{employee.employeeNumber ?? '—'}</div></div></div>; }
function ExceptionList({ exceptions }: { exceptions: AttendanceException[] }) { if (!exceptions.length) return <span className="text-slate-400">None</span>; return <div className="flex min-w-36 flex-wrap gap-1">{exceptions.slice(0, 2).map((item) => <ExceptionBadge key={item.id} type={item.type} />)}{exceptions.length > 2 && <span className="badge bg-slate-100 text-slate-600">+{exceptions.length - 2}</span>}</div>; }
function Rate({ value }: { value: number }) { return <div className="min-w-24"><div className="mb-1 flex justify-between text-xs"><span className="font-semibold text-navy-950">{formatPercent(value)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.min(100, value * 100)}%` }} /></div></div>; }
function initials(name: string) { return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(); }
function DetailPanel({ icon: Icon, title, count, children }: { icon: typeof Clock3; title: string; count: number; children: React.ReactNode }) { return <section className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div className="flex items-center gap-2"><Icon size={16} className="text-teal-700" /><h3 className="text-sm font-bold text-navy-950">{title}</h3></div><span className="badge bg-slate-100 text-slate-600">{count}</span></div><div className="max-h-[460px] divide-y divide-slate-100 overflow-auto">{children}</div></section>; }
function DetailRow({ title, meta }: { title: string; meta: string }) { return <div className="px-4 py-3"><div className="text-sm font-semibold text-navy-950">{title}</div><div className="mt-1 text-xs text-slate-500">{meta}</div></div>; }
function PanelEmpty({ text }: { text: string }) { return <div className="px-4 py-10 text-center text-sm text-slate-400">{text}</div>; }
function Pagination({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (page: number) => void }) { return <div className="no-print mt-3 flex items-center justify-end gap-2"><span className="text-xs text-slate-500">Page {page} of {pageCount}</span><button className="icon-button" disabled={page <= 1} onClick={() => onPage(page - 1)} title="Previous page"><ChevronLeft size={16} /><span className="sr-only">Previous page</span></button><button className="icon-button" disabled={page >= pageCount} onClick={() => onPage(page + 1)} title="Next page"><ChevronRight size={16} /><span className="sr-only">Next page</span></button></div>; }
