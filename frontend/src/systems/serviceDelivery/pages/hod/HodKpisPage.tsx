import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area,
} from 'recharts';
import { departmentManagerService } from '@/core/services/adminService';
import { useToast } from '@/core/contexts/ToastContext';
import {
  COK, FONT,
  HodPageHeader, HodCard, HodStatCard, HodEmpty, HodTh, HodChip,
} from './hodShared';

interface KpiData {
  departments: { _id: string; name?: string; response_time_target_minutes?: number }[];
  visitors: { total: number; pending: number; active: number; transferred: number; completed: number };
  daily_visitors: { date: string; count: number }[];
  hourly_today: { hour: number; visitors: number }[];
  service_times: { department_name: string; avg_minutes: number; max_minutes: number; min_minutes: number; total_cases: number; status: string }[];
  feedback: { total: number; average_rating: number; average_out_of: number; rating_distribution: { rating: number; count: number }[] };
  team: { total_members: number; active_members: number; tasks: { 'Under-review': number; 'In-progress': number; 'Completed': number; total: number } };
}

type Period = 'today' | 'week' | 'month' | 'all' | 'range';

const periodToRange = (period: Period, from: string, to: string): { from?: string; to?: string } => {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  switch (period) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from: iso(start), to: iso(now) };
    }
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      return { from: iso(start), to: iso(now) };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: iso(start), to: iso(now) };
    }
    case 'range':
      return { from: from || undefined, to: to || undefined };
    default:
      return {};
  }
};

const SERVICE_STATUS_COLORS: Record<string, string> = {
  Normal: COK.success,
  Moderate: COK.warning,
  Critical: COK.danger,
};

const chartTooltipStyle = {
  borderRadius: 0,
  border: `1px solid ${COK.border}`,
  fontFamily: FONT,
  fontSize: 12,
};

const HodKpisPage: React.FC = () => {
  const { showError } = useToast();
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range = periodToRange(period, from, to);
      const res = await departmentManagerService.getDepartmentKpis(range.from, range.to);
      if (res?.success) {
        setData(res.data);
      } else {
        showError(res?.message || 'Failed to load KPIs');
      }
    } catch {
      showError('Failed to load KPIs');
    } finally {
      setLoading(false);
    }
  }, [period, from, to, showError]);

  useEffect(() => { load(); }, [load]);

  const statusChart = useMemo(() => data ? [
    { name: 'Pending', value: data.visitors.pending },
    { name: 'Active', value: data.visitors.active },
    { name: 'Transferred', value: data.visitors.transferred },
    { name: 'Completed', value: data.visitors.completed },
  ] : [], [data]);

  const hourlyChart = useMemo(
    () => (data?.hourly_today || []).map(h => ({ name: `${String(h.hour).padStart(2, '0')}h`, visitors: h.visitors })),
    [data]
  );

  const ratingChart = useMemo(
    () => (data?.feedback.rating_distribution || []).map(r => ({ name: `${r.rating}`, count: r.count })),
    [data]
  );

  const deptNames = data?.departments.map(d => d.name).filter(Boolean).join(', ');
  const completionRate = data && data.team.tasks.total > 0
    ? Math.round((data.team.tasks.Completed / data.team.tasks.total) * 100) : 0;

  return (
    <div className="p-4">
      <HodPageHeader
        title="Department KPI Dashboard"
        subtitle={deptNames ? `Scope: ${deptNames}` : 'Key performance indicators for your department'}
        actions={
          <button className="cok-btn-outlined px-3 py-2 text-xs flex items-center gap-1" style={{ borderRadius: 0 }} onClick={load}>
            <FiRefreshCw /> Refresh
          </button>
        }
      />

      {/* Period filter — one row above the charts */}
      <HodCard className="mb-4">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-xs font-semibold uppercase" style={{ color: COK.textMid, fontFamily: FONT }}>Period</span>
          <select className="cok-auth-input py-2 px-3 text-sm" value={period} onChange={e => setPeriod(e.target.value as Period)}>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">This month</option>
            <option value="all">All time</option>
            <option value="range">Custom range</option>
          </select>
          {period === 'range' && (
            <>
              <input type="date" className="cok-auth-input py-2 px-3 text-sm" value={from} onChange={e => setFrom(e.target.value)} />
              <span className="text-xs" style={{ color: COK.gray }}>to</span>
              <input type="date" className="cok-auth-input py-2 px-3 text-sm" value={to} onChange={e => setTo(e.target.value)} />
            </>
          )}
        </div>
      </HodCard>

      {loading && !data ? (
        <HodCard><HodEmpty message="Loading department KPIs..." /></HodCard>
      ) : !data ? (
        <HodCard><HodEmpty message="No KPI data available." /></HodCard>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="flex flex-wrap gap-3 mb-4">
            <HodStatCard label="Visitors" value={data.visitors.total} hint="in selected period" />
            <HodStatCard label="Being Served" value={data.visitors.active} accent={COK.warning} />
            <HodStatCard label="Completed" value={data.visitors.completed} accent={COK.success} />
            <HodStatCard
              label="Feedback Rating"
              value={`${data.feedback.average_rating}/${Math.round(data.feedback.average_out_of || 10)}`}
              accent={data.feedback.average_rating >= 7 ? COK.success : data.feedback.average_rating >= 4 ? COK.warning : COK.danger}
              hint={`${data.feedback.total} feedback received`}
            />
            <HodStatCard label="Team Members" value={data.team.total_members} hint={`${data.team.active_members} active`} />
            <HodStatCard label="Task Completion" value={`${completionRate}%`} accent={completionRate >= 70 ? COK.success : COK.warning} hint={`${data.team.tasks.Completed}/${data.team.tasks.total} tasks`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Daily visitors */}
            <HodCard className="p-4">
              <h3 className="text-sm font-bold uppercase mb-1" style={{ color: COK.textDark, fontFamily: FONT }}>Daily Visitors</h3>
              <p className="text-xs mb-3" style={{ color: COK.gray }}>Visitors assigned to your department per day</p>
              {data.daily_visitors.length === 0 ? <HodEmpty message="No visitor data in this period." /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.daily_visitors} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F4" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: COK.border }} />
                    <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Area type="monotone" dataKey="count" name="Visitors" stroke={COK.primary} strokeWidth={2} fill="rgba(5,109,170,0.12)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </HodCard>

            {/* Hourly today */}
            <HodCard className="p-4">
              <h3 className="text-sm font-bold uppercase mb-1" style={{ color: COK.textDark, fontFamily: FONT }}>Hourly Check-ins · Today</h3>
              <p className="text-xs mb-3" style={{ color: COK.gray }}>When visitors arrive at your department today</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourlyChart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: COK.border }} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'rgba(5,109,170,0.06)' }} />
                  <Bar dataKey="visitors" name="Visitors" fill={COK.primary} radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </HodCard>

            {/* Visitors by status */}
            <HodCard className="p-4">
              <h3 className="text-sm font-bold uppercase mb-1" style={{ color: COK.textDark, fontFamily: FONT }}>Visitors by Status</h3>
              <p className="text-xs mb-3" style={{ color: COK.gray }}>Current pipeline in the selected period</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={statusChart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: COK.border }} />
                  <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'rgba(5,109,170,0.06)' }} />
                  <Bar dataKey="value" name="Visitors" fill={COK.primary} radius={[4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </HodCard>

            {/* Feedback rating distribution */}
            <HodCard className="p-4">
              <h3 className="text-sm font-bold uppercase mb-1" style={{ color: COK.textDark, fontFamily: FONT }}>Feedback Ratings</h3>
              <p className="text-xs mb-3" style={{ color: COK.gray }}>Distribution of ratings sent to your department</p>
              {ratingChart.length === 0 ? <HodEmpty message="No feedback in this period." /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ratingChart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F4" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: COK.border }} />
                    <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'rgba(5,109,170,0.06)' }} />
                    <Bar dataKey="count" name="Feedback" fill={COK.primary} radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </HodCard>
          </div>

          {/* Service time table */}
          <HodCard>
            <div className="px-4 py-3 border-b" style={{ borderColor: COK.border }}>
              <h3 className="text-sm font-bold uppercase" style={{ color: COK.textDark, fontFamily: FONT }}>Service Time by Department</h3>
              <p className="text-xs" style={{ color: COK.gray }}>Average service duration versus your response-time target</p>
            </div>
            {data.service_times.length === 0 ? (
              <HodEmpty message="No completed services with durations in this period." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr>
                      <HodTh>Department / Unit</HodTh>
                      <HodTh>Avg</HodTh>
                      <HodTh>Min</HodTh>
                      <HodTh>Max</HodTh>
                      <HodTh>Cases</HodTh>
                      <HodTh>Status</HodTh>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#F3F4F6' }}>
                    {data.service_times.map(row => (
                      <tr key={row.department_name} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-sm font-semibold" style={{ color: COK.primary, fontFamily: FONT }}>{row.department_name}</td>
                        <td className="px-3 py-2.5 text-sm" style={{ color: COK.textDark }}>{row.avg_minutes} mins</td>
                        <td className="px-3 py-2.5 text-sm" style={{ color: COK.textMid }}>{row.min_minutes} mins</td>
                        <td className="px-3 py-2.5 text-sm" style={{ color: COK.textMid }}>{row.max_minutes} mins</td>
                        <td className="px-3 py-2.5 text-sm" style={{ color: COK.textMid }}>{row.total_cases}</td>
                        <td className="px-3 py-2.5">
                          <HodChip label={row.status} color={SERVICE_STATUS_COLORS[row.status] || COK.gray} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </HodCard>
        </>
      )}
    </div>
  );
};

export default HodKpisPage;
