import React, { useState, useEffect, useMemo, useRef } from 'react';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import { requestService } from '../../../../core/services/adminService';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, LabelList } from 'recharts';
import { COK } from '../mayorCok';
import type { AppliedFilter } from '../components/FeedbackFeed';

const CC = {
  blue: '#34A8DB',
  teal: '#4CAF50',
  amber: '#F39C12',
  purple: '#2980B9',
  red: '#E74C3C',
};

interface RequestStatRow { name: string; pending: number; inprogress: number; completed: number; overdue: number; archived: number; total: number }

const periodToRange = (applied: AppliedFilter): { from?: string; to?: string } => {
  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const p = applied.period;
  if (p === 'today') return { from: startOfDay(now).toISOString(), to: now.toISOString() };
  if (p === 'week') {
    const monday = startOfDay(now);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return { from: monday.toISOString(), to: now.toISOString() };
  }
  if (p === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: now.toISOString() };
  if (p === 'last_month') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { from: first.toISOString(), to: last.toISOString() };
  }
  if (p === 'year') return { from: new Date(now.getFullYear(), 0, 1).toISOString(), to: now.toISOString() };
  const r: { from?: string; to?: string } = {};
  if (applied.from) r.from = startOfDay(new Date(applied.from)).toISOString();
  if (applied.to) { const end = new Date(applied.to); end.setHours(23, 59, 59, 999); r.to = end.toISOString(); }
  return r;
};

const labelForPeriod = (applied: AppliedFilter) =>
  applied.period === 'today' ? 'today'
  : applied.period === 'week' ? 'this week'
  : applied.period === 'month' ? 'this month'
  : applied.period === 'last_month' ? 'last month'
  : applied.period === 'year' ? 'this year'
  : `${applied.from || 'start'} → ${applied.to || 'now'}`;

const makeStatusBarLabel = (rows: Array<{ total?: number }>) => (props: any) => {
  const { x = 0, y = 0, width = 0, height = 0, index, value } = props;
  const num = Number(value);
  if (!num || Number.isNaN(num)) return null;
  const total = Number(rows[index]?.total) || 0;
  const pct = total > 0 ? Math.round((num / total) * 100) : null;
  const cx = x + width / 2;
  const inside = height >= (pct !== null ? 26 : 14);
  const fill = inside ? '#ffffff' : '#555555';
  const baseY = inside ? y + 11 : y - (pct !== null ? 15 : 4);
  return (
    <text x={cx} y={baseY} textAnchor="middle" fontSize={9} fontWeight={600} fill={fill}>
      <tspan x={cx}>{Number.isInteger(num) ? num : num.toFixed(2)}</tspan>
      {pct !== null && <tspan x={cx} dy={10}>({pct}%)</tspan>}
    </text>
  );
};

const MayorRequestsSection: React.FC<{ applied: AppliedFilter; refreshTick: number }> = ({ applied, refreshTick }) => {
  const [requestStats, setRequestStats] = useState<{ by_orientation: RequestStatRow[]; by_assignee: RequestStatRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const appliedKey = JSON.stringify(applied);
  const lastKeyRef = useRef('');

  useEffect(() => {
    const silent = lastKeyRef.current === appliedKey;
    lastKeyRef.current = appliedKey;
    let cancelled = false;
    (async () => {
      if (!silent) setLoading(true);
      try {
        const { from, to } = periodToRange(applied);
        const res: any = await requestService.getStatistics(from ? { period: 'range', from, to } : undefined);
        if (cancelled) return;
        if (res?.success && res.data) {
          setRequestStats({
            by_orientation: res.data.by_orientation || [],
            by_assignee: res.data.by_assignee || [],
          });
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [appliedKey, refreshTick]);

  const requestStatuses = useMemo(() => {
    const toRows = (rows: RequestStatRow[]) =>
      rows.slice(0, 8).map(r => ({
        name: r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name,
        fullName: r.name,
        pending: r.pending,
        inprogress: r.inprogress,
        completed: r.completed,
        overdue: r.overdue,
        archived: r.archived || 0,
        total: r.total,
      }));
    const departments = toRows(requestStats?.by_orientation || []);
    const total = (requestStats?.by_orientation || []).reduce((s, r) => s + r.total, 0);
    const deptCount = (requestStats?.by_orientation || []).length;
    return {
      departments,
      employees: toRows(requestStats?.by_assignee || []),
      total,
      avgPerDept: deptCount ? Math.round((total / deptCount) * 10) / 10 : 0,
      isSample: false,
    };
  }, [requestStats]);

  const periodLabel = labelForPeriod(applied);

  return (
    <div className="bg-white border border-gray-200 p-4 sm:p-5">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-base font-bold text-gray-900">Requests</div>
          <div className="text-xs text-gray-500 mt-0.5">Requests by status · {periodLabel}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-2xl font-bold leading-none" style={{ color: CC.purple }}>{requestStatuses.avgPerDept}</div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500 mt-1">Avg requests / orientation</div>
        </div>
      </div>
      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <SpiralLoader />
        </div>
      ) : requestStatuses.total === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-gray-400">
          No requests recorded in this period yet.
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: CC.amber }}>Orientation</span>
              <span className="text-xs text-gray-500">(incoming requests)</span>
            </div>
            <div className="h-56 overflow-x-auto no-scrollbar">
              <div className="h-full" style={{ minWidth: `${requestStatuses.departments.length * 110}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={requestStatuses.departments} barGap={2} barCategoryGap="18%" margin={{ top: 10, right: 5, left: -25, bottom: 25 }}>
                  <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" tick={{ fontSize: 9, fill: '#555555' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#555555' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                  <RTooltip
                    cursor={{ fill: COK.neutralLight }}
                    contentStyle={{ border: `1px solid ${COK.border}`, borderRadius: 0, fontSize: 12 }}
                    labelFormatter={(_l: any, payload: any) => payload?.[0]?.payload?.fullName || _l}
                    formatter={(value: any, name: any) => {
                      const payload = (value as any)?.payload;
                      if (!payload) return [value, name];
                      const total = payload.total || 0;
                      const entries = [
                        ['Pending', payload.pending],
                        ['In progress', payload.inprogress],
                        ['Completed', payload.completed],
                        ['Overdue', payload.overdue],
                        ['Archived', payload.archived],
                      ].filter(([, v]) => v > 0);
                      const lines = entries.map(([k, v]) => `${k}: ${v} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`);
                      return [lines.join('\n'), 'Breakdown'];
                    }}
                  />
                  <Bar dataKey="total" name="Total requests" fill={CC.purple} maxBarSize={32} isAnimationActive={false}>
                    <LabelList content={makeStatusBarLabel(requestStatuses.departments)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: CC.blue }}>Assignees</span>
              <span className="text-xs text-gray-500">(request progress)</span>
            </div>
            <div className="h-56 overflow-x-auto no-scrollbar">
              <div className="h-full" style={{ minWidth: `${requestStatuses.employees.length * 110}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={requestStatuses.employees} barGap={2} barCategoryGap="18%" margin={{ top: 10, right: 5, left: -25, bottom: 25 }}>
                  <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" tick={{ fontSize: 9, fill: '#555555' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#555555' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                  <RTooltip
                    cursor={{ fill: COK.neutralLight }}
                    contentStyle={{ border: `1px solid ${COK.border}`, borderRadius: 0, fontSize: 12 }}
                    labelFormatter={(_l: any, payload: any) => payload?.[0]?.payload?.fullName || _l}
                    formatter={(value: any, name: any) => {
                      const payload = (value as any)?.payload;
                      if (!payload) return [value, name];
                      const total = payload.total || 0;
                      const entries = [
                        ['Pending', payload.pending],
                        ['In progress', payload.inprogress],
                        ['Completed', payload.completed],
                        ['Overdue', payload.overdue],
                        ['Archived', payload.archived],
                      ].filter(([, v]) => v > 0);
                      const lines = entries.map(([k, v]) => `${k}: ${v} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`);
                      return [lines.join('\n'), 'Breakdown'];
                    }}
                  />
                  <Bar dataKey="total" name="Total requests" fill={CC.purple} maxBarSize={32} isAnimationActive={false}>
                    <LabelList content={makeStatusBarLabel(requestStatuses.employees)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
      {!loading && requestStatuses.total > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-600 mt-3">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CC.amber }}></div>Pending</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CC.blue }}></div>In progress</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CC.teal }}></div>Completed</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CC.red }}></div>Overdue</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#9E9E9E' }}></div>Archived</div>
        </div>
      )}
    </div>
  );
};

export default MayorRequestsSection;
