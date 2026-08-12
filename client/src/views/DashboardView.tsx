import {
  AlertTriangle, CalendarCheck2, CalendarX2, ClockAlert, LogOut, TimerOff, UserCheck, Users,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import type { DailyAttendance } from '../domain/types';
import { aggregateDepartments } from '../domain/reportAggregates';
import { formatReportDate } from '../domain/dateTime';
import { formatCompactDuration } from '../lib/format';
import { EmptyState, PageHeading } from '../components/ReportChrome';

interface DashboardProps {
  records: DailyAttendance[];
  startDate: string;
  endDate: string;
}

const pieColors: Record<string, string> = {
  Present: '#059669', Absent: '#94a3b8', Late: '#d97706', 'Short hours': '#ea580c', Exception: '#e11d48',
};

export function DashboardView({ records, startDate, endDate }: DashboardProps) {
  const latestDate = records.map((record) => record.date).sort().at(-1);
  const latestRecords = records.filter((record) => record.date === latestDate);
  const unique = (predicate: (record: DailyAttendance) => boolean) =>
    new Set(records.filter(predicate).map((record) => record.employee.employeeSourceId)).size;
  const missingClockings = records.reduce(
    (count, record) => count + record.exceptions.filter((item) => item.type === 'Missing IN' || item.type === 'Missing OUT').length,
    0,
  );
  const totalExceptions = records.reduce((count, record) => count + record.exceptions.length, 0);
  const kpis = [
    { label: 'Employees expected', value: new Set(latestRecords.map((record) => record.employee.employeeSourceId)).size, note: latestDate ? formatReportDate(latestDate) : 'Latest workday', icon: Users, tone: 'navy' },
    { label: 'Employees present', value: latestRecords.filter((record) => record.status !== 'Absent').length, note: 'Latest workday', icon: UserCheck, tone: 'teal' },
    { label: 'Employees absent', value: latestRecords.filter((record) => record.status === 'Absent').length, note: 'Latest workday', icon: CalendarX2, tone: 'slate' },
    { label: 'Employees late', value: unique((record) => record.exceptions.some((item) => item.type === 'Late arrival')), note: 'Selected period', icon: ClockAlert, tone: 'amber' },
    { label: 'Short hours', value: unique((record) => record.shortfallMinutes > 0 && record.status !== 'Absent'), note: 'Selected period', icon: TimerOff, tone: 'orange' },
    { label: 'Early departures', value: unique((record) => record.exceptions.some((item) => item.type === 'Early departure')), note: 'Selected period', icon: LogOut, tone: 'cyan' },
    { label: 'Missing clockings', value: missingClockings, note: 'Transactions', icon: CalendarCheck2, tone: 'rose' },
    { label: 'Total exceptions', value: totalExceptions, note: 'Selected period', icon: AlertTriangle, tone: 'red' },
  ];

  const statusCounts = records.reduce<Record<string, number>>((counts, record) => {
    counts[record.status] = (counts[record.status] ?? 0) + 1;
    return counts;
  }, {});
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const departmentData = aggregateDepartments(records).map((item) => ({
    department: item.departmentName,
    worked: Number((item.netMinutes / 60).toFixed(1)),
    required: Number((item.requiredMinutes / 60).toFixed(1)),
  }));
  const trendMap = records.reduce<Map<string, DailyAttendance[]>>((grouped, record) => {
    grouped.set(record.date, [...(grouped.get(record.date) ?? []), record]);
    return grouped;
  }, new Map());
  const trendData = [...trendMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => ({
    date: new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00Z`)),
    late: items.filter((record) => record.exceptions.some((item) => item.type === 'Late arrival')).length,
    shortfall: Number((items.reduce((sum, record) => sum + record.shortfallMinutes, 0) / 60).toFixed(1)),
  }));

  return (
    <>
      <PageHeading title="Management dashboard" description={`${formatReportDate(startDate)} to ${formatReportDate(endDate)} · Africa/Johannesburg`} />
      {records.length === 0 ? <EmptyState title="No attendance results" detail="Adjust the report filters or choose a date range containing workdays." /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
            {kpis.map((kpi) => (
              <article className="kpi-card" key={kpi.label}>
                <div className={`kpi-icon kpi-${kpi.tone}`}><kpi.icon size={18} aria-hidden="true" /></div>
                <div className="mt-4 text-2xl font-bold tabular-nums text-navy-950">{kpi.value}</div>
                <div className="mt-1 text-xs font-semibold text-slate-700">{kpi.label}</div>
                <div className="mt-1 text-[11px] text-slate-400">{kpi.note}</div>
              </article>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <ChartPanel title="Attendance status" subtitle="Employee-days across the selected period">
              <ResponsiveContainer width="100%" height={270}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2} isAnimationActive={false}>
                    {statusData.map((entry) => <Cell key={entry.name} fill={pieColors[entry.name] ?? '#64748b'} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </ChartPanel>
            <ChartPanel title="Hours worked by department" subtitle="Net worked hours compared with required hours">
              <ResponsiveContainer width="100%" height={270}>
                <BarChart data={departmentData} margin={{ top: 10, right: 10, left: -15, bottom: 8 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="h" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} />
                  <Bar dataKey="required" name="Required" fill="#cbd5e1" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="worked" name="Worked" fill="#0d9488" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
            <ChartPanel title="Daily late arrivals" subtitle="Employees arriving after the 08:10 grace period">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData} margin={{ top: 10, right: 14, left: -25, bottom: 5 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="late" name="Late arrivals" stroke="#d97706" strokeWidth={2.5} dot={{ r: 3, fill: '#d97706' }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>
            <ChartPanel title="Daily shortfall trend" subtitle="Total scheduled hours not worked by workday">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData} margin={{ top: 10, right: 14, left: -22, bottom: 5 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}h`} />
                  <Tooltip formatter={(value) => formatCompactDuration(Number(value) * 60)} contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="shortfall" name="Shortfall" stroke="#e11d48" strokeWidth={2.5} dot={{ r: 3, fill: '#e11d48' }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>
        </>
      )}
    </>
  );
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="panel p-4">
      <div className="mb-1 flex items-start justify-between">
        <div><h3 className="text-sm font-bold text-navy-950">{title}</h3><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>
      </div>
      {children}
    </section>
  );
}

const tooltipStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  boxShadow: '0 8px 24px rgba(7, 23, 39, 0.08)',
  fontSize: '12px',
};
