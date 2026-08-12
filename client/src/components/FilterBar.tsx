import { CalendarDays, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { EmployeeSummary, ReportFilters } from '../domain/types';

interface FilterBarProps {
  filters: ReportFilters;
  employees: EmployeeSummary[];
  onChange: (next: ReportFilters) => void;
}

const statuses = ['Present', 'Absent', 'Late', 'Short hours', 'Exception'];
const exceptionTypes = [
  'Missing IN', 'Missing OUT', 'Consecutive IN', 'Consecutive OUT', 'Duplicate transaction',
  'Unknown reader', 'Late arrival', 'Early departure', 'Short hours',
];

export function FilterBar({ filters, employees, onChange }: FilterBarProps) {
  const departments = [...new Map(employees.map((employee) => [employee.departmentId ?? employee.departmentName, employee])).entries()]
    .sort((a, b) => a[1].departmentName.localeCompare(b[1].departmentName));
  const update = (field: keyof ReportFilters, value: string) => onChange({
    ...filters,
    [field]: value,
    ...(field === 'departmentId' ? { employeeSourceId: '' } : {}),
  });
  const hasReportFilters = filters.departmentId || filters.employeeSourceId || filters.status || filters.exceptionType;

  return (
    <section className="no-print border-b border-slate-200 bg-white px-4 py-3 lg:px-7">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 xl:flex-row xl:items-end">
        <div className="flex shrink-0 items-center gap-2 pb-1 text-sm font-semibold text-navy-900">
          <SlidersHorizontal size={17} aria-hidden="true" />
          Report filters
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <label className="field-label">
            <span>Start date</span>
            <span className="input-with-icon">
              <CalendarDays size={15} aria-hidden="true" />
              <input type="date" value={filters.startDate} max={filters.endDate} onChange={(event) => update('startDate', event.target.value)} />
            </span>
          </label>
          <label className="field-label">
            <span>End date</span>
            <span className="input-with-icon">
              <CalendarDays size={15} aria-hidden="true" />
              <input type="date" value={filters.endDate} min={filters.startDate} onChange={(event) => update('endDate', event.target.value)} />
            </span>
          </label>
          <label className="field-label">
            <span>Department</span>
            <select value={filters.departmentId} onChange={(event) => update('departmentId', event.target.value)}>
              <option value="">All departments</option>
              {departments.map(([id, employee]) => <option key={id} value={id}>{employee.departmentName}</option>)}
            </select>
          </label>
          <label className="field-label">
            <span>Employee</span>
            <select value={filters.employeeSourceId} onChange={(event) => update('employeeSourceId', event.target.value)}>
              <option value="">All employees</option>
              {employees.filter((employee) => !filters.departmentId || (employee.departmentId ?? employee.departmentName) === filters.departmentId)
                .map((employee) => <option key={employee.employeeSourceId} value={employee.employeeSourceId}>{employee.displayName}</option>)}
            </select>
          </label>
          <label className="field-label">
            <span>Status</span>
            <select value={filters.status} onChange={(event) => update('status', event.target.value)}>
              <option value="">All statuses</option>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label className="field-label">
            <span>Exception</span>
            <select value={filters.exceptionType} onChange={(event) => update('exceptionType', event.target.value)}>
              <option value="">All exceptions</option>
              {exceptionTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
        </div>
        <button
          className="icon-button h-9 w-9 shrink-0 self-end"
          type="button"
          title="Reset report filters"
          disabled={!hasReportFilters}
          onClick={() => onChange({ ...filters, departmentId: '', employeeSourceId: '', status: '', exceptionType: '' })}
        >
          <RotateCcw size={16} aria-hidden="true" />
          <span className="sr-only">Reset report filters</span>
        </button>
      </div>
    </section>
  );
}
