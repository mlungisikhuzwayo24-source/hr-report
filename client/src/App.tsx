import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, Building2, CalendarDays, FileClock, Gauge, ListChecks, Menu, PanelLeftClose, UserRound, X,
} from 'lucide-react';
import { FilterBar } from './components/FilterBar';
import { calculateAttendance } from './domain/attendanceEngine';
import { exclusiveEndUtc, localDate, southAfricanDateStartUtc } from './domain/dateTime';
import type { AttendanceTransaction, DailyAttendance, EmployeeSummary, ReportFilters } from './domain/types';
import { getEmployees, getMeta, getTransactions } from './lib/api';
import { DashboardView } from './views/DashboardView';
import {
  DailyReportView, DepartmentReportView, EmployeeDetailView, ExceptionsView, MonthlyReportView, RawTransactionsView,
} from './views/ReportViews';

type ViewId = 'dashboard' | 'daily' | 'monthly' | 'departments' | 'employee' | 'transactions' | 'exceptions';

const navItems = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: Gauge },
  { id: 'daily' as const, label: 'Daily attendance', icon: CalendarDays },
  { id: 'monthly' as const, label: 'Employee summary', icon: ListChecks },
  { id: 'departments' as const, label: 'Departments', icon: Building2 },
  { id: 'employee' as const, label: 'Employee detail', icon: UserRound },
  { id: 'transactions' as const, label: 'Raw transactions', icon: FileClock },
  { id: 'exceptions' as const, label: 'Exceptions', icon: AlertTriangle },
];

const initialFilters: ReportFilters = {
  startDate: '2026-07-29',
  endDate: '2026-08-04',
  departmentId: '',
  employeeSourceId: '',
  status: '',
  exceptionType: '',
};

function App() {
  const [activeView, setActiveView] = useState<ViewId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [transactions, setTransactions] = useState<AttendanceTransaction[]>([]);
  const [dataSource, setDataSource] = useState('Mock');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    getEmployees(controller.signal).then(setEmployees).catch((reason) => setError(errorMessage(reason)));
    getMeta(controller.signal).then((meta) => setDataSource(meta.dataSource)).catch((reason) => setError(errorMessage(reason)));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    getTransactions(southAfricanDateStartUtc(filters.startDate), exclusiveEndUtc(filters.endDate), controller.signal)
      .then((result) => setTransactions(result.items))
      .catch((reason) => {
        if ((reason as Error).name !== 'AbortError') setError(errorMessage(reason));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [filters.startDate, filters.endDate]);

  const report = useMemo(() => calculateAttendance(transactions, {
    startDate: filters.startDate,
    endDate: filters.endDate,
    employees,
  }), [transactions, employees, filters.startDate, filters.endDate]);

  const departmentEmployeeIds = useMemo(() => new Set(employees
    .filter((employee) => !filters.departmentId || (employee.departmentId ?? employee.departmentName) === filters.departmentId)
    .map((employee) => employee.employeeSourceId)), [employees, filters.departmentId]);

  const visibleDaily = useMemo(() => report.daily.filter((record) =>
    departmentEmployeeIds.has(record.employee.employeeSourceId)
    && (!filters.employeeSourceId || record.employee.employeeSourceId === filters.employeeSourceId)
    && (!filters.status || record.status === filters.status)
    && (!filters.exceptionType || record.exceptions.some((item) => item.type === filters.exceptionType))),
  [report.daily, departmentEmployeeIds, filters.employeeSourceId, filters.status, filters.exceptionType]);

  const visibleKeys = useMemo(() => new Set(visibleDaily.map((record) => record.key)), [visibleDaily]);
  const visibleTransactions = useMemo(() => transactions.filter((transaction) =>
    departmentEmployeeIds.has(transaction.employeeSourceId)
    && (!filters.employeeSourceId || transaction.employeeSourceId === filters.employeeSourceId)
    && ((!filters.status && !filters.exceptionType) || visibleKeys.has(`${transaction.employeeSourceId}|${localDate(transaction.occurredAtUtc)}`)))
    .sort((a, b) => new Date(b.occurredAtUtc).getTime() - new Date(a.occurredAtUtc).getTime()),
  [transactions, departmentEmployeeIds, filters.employeeSourceId, filters.status, filters.exceptionType, visibleKeys]);

  const visibleExceptions = useMemo(() => report.exceptions.filter((item) =>
    departmentEmployeeIds.has(item.employeeSourceId)
    && (!filters.employeeSourceId || item.employeeSourceId === filters.employeeSourceId)
    && (!filters.exceptionType || item.type === filters.exceptionType)
    && (!filters.status || visibleKeys.has(`${item.employeeSourceId}|${item.localDate}`))),
  [report.exceptions, departmentEmployeeIds, filters.employeeSourceId, filters.exceptionType, filters.status, visibleKeys]);

  const filteredEmployees = employees.filter((employee) => departmentEmployeeIds.has(employee.employeeSourceId));
  const selectedEmployeeId = filters.employeeSourceId || visibleDaily[0]?.employee.employeeSourceId || filteredEmployees[0]?.employeeSourceId || '';
  const currentLabel = navItems.find((item) => item.id === activeView)?.label;

  const navigate = (view: ViewId) => { setActiveView(view); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700">
      <div className="print-only" />
      <aside className={`no-print fixed inset-y-0 left-0 z-40 w-[236px] bg-navy-950 transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <button className="flex items-center gap-3 text-left" type="button" onClick={() => navigate('dashboard')}>
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-600 text-white"><BarChart3 size={18} aria-hidden="true" /></span>
            <span><span className="block text-sm font-bold text-white">Attendance Insights</span><span className="block text-[10px] text-slate-400">Management reporting</span></span>
          </button>
          <button className="icon-button-dark lg:hidden" onClick={() => setSidebarOpen(false)} title="Close navigation"><X size={18} /><span className="sr-only">Close navigation</span></button>
        </div>
        <nav className="px-3 py-5" aria-label="Reporting views">
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase text-slate-500">Reporting</div>
          {navItems.map((item) => <button key={item.id} className={`nav-item ${activeView === item.id ? 'nav-item-active' : ''}`} type="button" onClick={() => navigate(item.id)}><item.icon size={17} aria-hidden="true" />{item.label}{item.id === 'exceptions' && visibleExceptions.length > 0 && <span className="ml-auto rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">{visibleExceptions.length}</span>}</button>)}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /><span className="text-xs font-semibold text-slate-200">{dataSource} data</span></div>
          <div className="mt-1 text-[10px] text-slate-500">Read-only reporting source</div>
        </div>
      </aside>
      {sidebarOpen && <button className="no-print fixed inset-0 z-30 bg-navy-950/50 lg:hidden" aria-label="Close navigation overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="lg:pl-[236px]">
        <header className="no-print flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-7">
          <div className="flex items-center gap-3"><button className="icon-button lg:hidden" type="button" title="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={19} /><span className="sr-only">Open navigation</span></button>
            <div><div className="text-[11px] font-semibold uppercase text-teal-700">Attendance reporting</div><h1 className="text-base font-bold text-navy-950">{currentLabel}</h1></div></div>
          <div className="flex items-center gap-3"><span className="hidden text-xs text-slate-500 sm:inline">Africa/Johannesburg</span><span className="data-pill"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{dataSource}</span><PanelLeftClose size={18} className="hidden text-slate-300 lg:block" aria-hidden="true" /></div>
        </header>
        <FilterBar filters={filters} employees={employees} onChange={setFilters} />
        <main className="mx-auto max-w-[1600px] px-4 py-5 lg:px-7 lg:py-6">
          {error ? <ErrorState message={error} /> : loading && employees.length === 0 ? <LoadingState /> : (
            <View activeView={activeView} records={visibleDaily} transactions={visibleTransactions} exceptions={visibleExceptions} employees={filteredEmployees}
              selectedEmployeeId={selectedEmployeeId} startDate={filters.startDate} endDate={filters.endDate}
              onEmployeeChange={(employeeSourceId) => setFilters((current) => ({ ...current, employeeSourceId }))} />
          )}
        </main>
      </div>
    </div>
  );
}

function View({ activeView, records, transactions, exceptions, employees, selectedEmployeeId, startDate, endDate, onEmployeeChange }: {
  activeView: ViewId; records: DailyAttendance[]; transactions: AttendanceTransaction[]; exceptions: ReturnType<typeof calculateAttendance>['exceptions']; employees: EmployeeSummary[];
  selectedEmployeeId: string; startDate: string; endDate: string; onEmployeeChange: (id: string) => void;
}) {
  switch (activeView) {
    case 'daily': return <DailyReportView records={records} startDate={startDate} endDate={endDate} />;
    case 'monthly': return <MonthlyReportView records={records} startDate={startDate} endDate={endDate} />;
    case 'departments': return <DepartmentReportView records={records} startDate={startDate} endDate={endDate} />;
    case 'employee': return <EmployeeDetailView records={records} employees={employees} selectedEmployeeId={selectedEmployeeId} onEmployeeChange={onEmployeeChange} startDate={startDate} endDate={endDate} />;
    case 'transactions': return <RawTransactionsView transactions={transactions} startDate={startDate} endDate={endDate} />;
    case 'exceptions': return <ExceptionsView exceptions={exceptions} startDate={startDate} endDate={endDate} />;
    default: return <DashboardView records={records} startDate={startDate} endDate={endDate} />;
  }
}

function LoadingState() { return <div className="space-y-4" aria-live="polite"><div className="h-8 w-52 animate-pulse rounded bg-slate-200" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="h-32 animate-pulse rounded-lg bg-white" /><div className="h-32 animate-pulse rounded-lg bg-white" /><div className="h-32 animate-pulse rounded-lg bg-white" /><div className="h-32 animate-pulse rounded-lg bg-white" /></div><div className="h-72 animate-pulse rounded-lg bg-white" /><span className="sr-only">Loading attendance reports</span></div>; }
function ErrorState({ message }: { message: string }) { return <div className="border border-rose-200 bg-rose-50 p-5"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 text-rose-600" size={20} /><div><h2 className="font-bold text-rose-900">Unable to load attendance data</h2><p className="mt-1 text-sm text-rose-700">{message}</p></div></div></div>; }
function errorMessage(reason: unknown) { return reason instanceof Error ? reason.message : 'An unexpected reporting error occurred.'; }

export default App;
