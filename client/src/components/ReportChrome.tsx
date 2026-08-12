import type { ReactNode } from 'react';
import { Download, Printer } from 'lucide-react';
import { REPORTING_TIME_ZONE, formatReportDate } from '../domain/dateTime';

interface PageHeadingProps {
  title: string;
  description: string;
  recordCount?: number;
  onExport?: () => void;
  children?: ReactNode;
}

export function PageHeading({ title, description, recordCount, onExport, children }: PageHeadingProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-xl font-bold text-navy-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="no-print flex items-center gap-2">
        {children}
        {recordCount !== undefined && <span className="mr-1 text-xs font-medium text-slate-500">{recordCount.toLocaleString()} records</span>}
        {onExport && (
          <button className="secondary-button" type="button" onClick={onExport}>
            <Download size={16} aria-hidden="true" /> Export CSV
          </button>
        )}
        <button className="secondary-button" type="button" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" /> Print
        </button>
      </div>
    </div>
  );
}

export function PrintHeader({ startDate, endDate, title }: { startDate: string; endDate: string; title: string }) {
  return (
    <div className="print-only mb-5 border-b border-slate-400 pb-3">
      <div className="text-lg font-bold text-navy-950">Attendance Insights</div>
      <div className="mt-1 flex justify-between text-xs text-slate-600">
        <span>{title} · {formatReportDate(startDate)} to {formatReportDate(endDate)}</span>
        <span>Reporting timezone: {REPORTING_TIME_ZONE}</span>
      </div>
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center border border-dashed border-slate-300 bg-white px-6 text-center">
      <div className="mb-3 h-1 w-12 bg-teal-600" />
      <p className="font-semibold text-navy-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{detail}</p>
    </div>
  );
}

