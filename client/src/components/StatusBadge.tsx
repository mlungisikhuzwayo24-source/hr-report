import type { AttendanceStatus, Direction, ExceptionType } from '../domain/types';

const statusStyles: Record<AttendanceStatus, string> = {
  Present: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Absent: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  Late: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  'Short hours': 'bg-orange-50 text-orange-800 ring-orange-600/20',
  Exception: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return <span className={`badge ring-1 ring-inset ${statusStyles[status]}`}>{status}</span>;
}

export function DirectionBadge({ direction }: { direction: Direction }) {
  const style = direction === 'IN'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
    : direction === 'OUT'
      ? 'bg-sky-50 text-sky-700 ring-sky-600/20'
      : 'bg-rose-50 text-rose-700 ring-rose-600/20';
  return <span className={`badge min-w-14 justify-center ring-1 ring-inset ${style}`}>{direction}</span>;
}

export function ExceptionBadge({ type }: { type: ExceptionType }) {
  const notable = type === 'Missing IN' || type === 'Missing OUT' || type === 'Unknown reader';
  return (
    <span className={`badge ring-1 ring-inset ${notable ? 'bg-rose-50 text-rose-700 ring-rose-600/20' : 'bg-amber-50 text-amber-800 ring-amber-600/20'}`}>
      {type}
    </span>
  );
}
