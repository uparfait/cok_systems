import React, { useState, useEffect, useRef, useMemo } from 'react';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import { statisticsService } from '../../../../core/services/adminService';
import type { AppliedFilter } from '../components/FeedbackFeed';

const CC = {
  blue: '#34A8DB',
  teal: '#4CAF50',
  amber: '#F39C12',
  purple: '#2980B9',
  red: '#E74C3C',
};

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

const DeptServicesMirror: React.FC<{
  rows: Array<{ name: string; assigned: number; served: number; notServed: number }>;
  cc: { amber: string; teal: string; red: string };
  scroll?: boolean;
}> = ({ rows, cc, scroll }) => {
  const maxLeft = Math.max(...rows.map(r => r.assigned), 1);
  const maxRight = Math.max(...rows.map(r => r.served + r.notServed), 1);
  const makeTicks = (max: number) => {
    const step = Math.max(1, Math.ceil(max / 5));
    const ticks: number[] = [];
    for (let v = 0; v <= Math.floor(max); v += step) ticks.push(v);
    return ticks;
  };
  const leftTicks = makeTicks(maxLeft);
  const rightTicks = makeTicks(maxRight);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 flex items-center gap-2 pb-2 border-b-[3px]" style={{ borderColor: cc.amber }}>
          <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: cc.amber }}>
            Departments
          </span>
          <span className="text-xs text-gray-500">(people oriented)</span>
        </div>
        <div className="flex-1 flex items-center justify-end gap-2 pb-2 border-b-[3px]" style={{ borderColor: cc.teal }}>
          <span className="text-xs text-gray-500">(served vs not served)</span>
          <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: cc.teal }}>
            Visitors
          </span>
        </div>
      </div>

      <div className={scroll ? 'space-y-3 max-h-[55vh] overflow-y-auto pr-1' : 'space-y-3'}>
        {rows.map(row => {
          const notServed = Math.max(0, row.assigned - row.served);
          return (
            <div
              key={row.name}
              className="flex items-center py-0.5 hover:bg-gray-50 transition-colors"
              title={`${row.name}: ${row.assigned} assigned · ${row.served} served · ${notServed} not served`}
            >
              <div className="flex-1 flex items-center gap-2.5 min-w-0">
                <span className="w-28 sm:w-48 flex-shrink-0 text-right text-[11px] sm:text-[12px] font-medium text-gray-700 break-words leading-tight">
                  {row.name}
                </span>
                <div className="flex-1 h-6 bg-gray-100/80 flex items-center justify-end overflow-hidden">
                  {row.assigned > 0 && (row.assigned / maxLeft) * 100 < 12 && (
                    <span className="text-[11px] font-bold pr-1 leading-none" style={{ color: cc.amber }}>{row.assigned}</span>
                  )}
                  <div
                    className="h-full transition-all duration-500 flex items-center justify-center"
                    style={{
                      width: `${(row.assigned / maxLeft) * 100}%`,
                      minWidth: row.assigned > 0 ? 4 : 0,
                      backgroundColor: cc.amber,
                    }}
                  >
                    {(row.assigned / maxLeft) * 100 >= 12 && (
                      <span className="text-[11px] font-bold text-white leading-none">{row.assigned}</span>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="w-[3px] self-stretch mx-1 flex-shrink-0"
                style={{ background: '#056daa' }}
              ></div>

              <div className="flex-1 flex items-center gap-2.5 min-w-0">
                <div className="flex-1 h-6 bg-gray-100/80 flex items-center justify-start overflow-hidden">
                  {notServed > 0 && (
                    <div
                      className="h-full transition-all duration-500 flex items-center justify-center"
                      style={{
                        width: `${(notServed / maxLeft) * 100}%`,
                        minWidth: 2,
                        backgroundColor: cc.red,
                      }}
                    >
                      {(notServed / maxLeft) * 100 >= 12 && (
                        <span className="text-[11px] font-bold text-white leading-none">{notServed}</span>
                      )}
                    </div>
                  )}
                  {row.served > 0 && (
                    <div
                      className="h-full transition-all duration-500 flex items-center justify-center"
                      style={{
                        width: `${(row.served / maxLeft) * 100}%`,
                        minWidth: 2,
                        backgroundColor: cc.teal,
                      }}
                    >
                      {(row.served / maxLeft) * 100 >= 12 && (
                        <span className="text-[11px] font-bold text-white leading-none">{row.served}</span>
                      )}
                    </div>
                  )}
                  {((notServed > 0 && (notServed / maxLeft) * 100 < 12) || (row.served > 0 && (row.served / maxLeft) * 100 < 12)) && (
                    <span className="text-[11px] font-bold pl-1 leading-none whitespace-nowrap">
                      {notServed > 0 && (notServed / maxLeft) * 100 < 12 && <span style={{ color: cc.red }}>{notServed}</span>}
                      {notServed > 0 && (notServed / maxLeft) * 100 < 12 && row.served > 0 && (row.served / maxLeft) * 100 < 12 && <span className="text-gray-300"> / </span>}
                      {row.served > 0 && (row.served / maxLeft) * 100 < 12 && <span style={{ color: cc.teal }}>{row.served}</span>}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-start mt-2">
        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <span className="w-28 sm:w-48 flex-shrink-0"></span>
          <div className="flex-1 relative px-1" style={{ height: 24 }}>
            <div className="absolute inset-x-1 top-0 h-px bg-gray-900"></div>
            {leftTicks.map((tick) => {
              const pct = maxLeft > 0 ? ((maxLeft - tick) / maxLeft) * 100 : 0;
              return (
                <div key={tick} className="absolute top-0 flex flex-col items-center" style={{ left: `calc(${pct}% + 4px)`, transform: 'translateX(-50%)' }}>
                  <div className="w-px h-2 bg-gray-900"></div>
                  <span className="mt-0.5 text-[11px] font-bold text-gray-900">{tick}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="w-[3px] mx-1 flex-shrink-0"></div>
        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <div className="flex-1 relative px-1" style={{ height: 24 }}>
            <div className="absolute inset-x-1 top-0 h-px bg-gray-900"></div>
            {rightTicks.map((tick) => {
              const pct = maxRight > 0 ? (tick / maxRight) * 100 : 0;
              return (
                <div key={tick} className="absolute top-0 flex flex-col items-center" style={{ left: `calc(${pct}% + 4px)`, transform: 'translateX(-50%)' }}>
                  <div className="w-px h-2 bg-gray-900"></div>
                  <span className="mt-0.5 text-[11px] font-bold text-gray-900">{tick}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const MayorDeptServicesSection: React.FC<{ applied: AppliedFilter; refreshTick: number }> = ({ applied, refreshTick }) => {
  const [rows, setRows] = useState<Array<{ name: string; assigned: number; served: number; notServed: number }>>([]);
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
        const [servedRes, deptRes] = await Promise.all([
          statisticsService.getServedStats(from, to),
          statisticsService.getDepartmentsWithLeaders(),
        ]);
        if (cancelled) return;
        const served: any = (servedRes as any)?.data || {};
        const departmentsRaw = (deptRes as any)?.data?.departments || (deptRes as any)?.departments || [];
        const assignedByDept: Record<string, number> = {};
        (served.assigned_by_department || []).forEach((d: any) => { assignedByDept[d.name] = d.assigned; });
        const servedByDept: Record<string, number> = {};
        (served.by_department || []).forEach((d: any) => { servedByDept[d.name] = d.served; });
        const names = new Set<string>([
          ...departmentsRaw.map((d: any) => d.department_name),
          ...Object.keys(assignedByDept),
        ]);
        setRows(
          Array.from(names)
            .map(name => {
              const assigned = assignedByDept[name] || 0;
              const servedCount = servedByDept[name] || 0;
              const notServed = Math.max(0, assigned - servedCount);
              return { name, assigned, served: servedCount, notServed };
            })
            .sort((a, b) => b.assigned - a.assigned)
        );
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [appliedKey, refreshTick]);

  const totals = useMemo(() => {
    const visitors = rows.reduce((s, r) => s + (r.assigned || 0), 0);
    const served = rows.reduce((s, r) => s + (r.served || 0), 0);
    return { visitors, served, notServed: Math.max(0, visitors - served) };
  }, [rows]);

  return (
    <div className="bg-white border border-gray-200 p-4 sm:p-5">
      <div className="mb-4">
        <div className="text-base font-bold text-gray-900">Department and services</div>
      </div>

      {loading ? (
        <div className="h-40 w-full flex items-center justify-center">
          <SpiralLoader />
        </div>
      ) : rows.length === 0 ? (
        <div className="h-40 w-full flex items-center justify-center text-xs text-gray-400">
          No department data available yet
        </div>
      ) : (
        <>
          <DeptServicesMirror
            rows={rows}
            cc={{ amber: CC.amber, teal: CC.teal, red: CC.red }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4" style={{ borderTop: '1px solid #E0E0E0' }}>
            <div className="p-3" style={{ border: '1px solid #E0E0E0', borderLeft: `3px solid ${CC.amber}` }}>
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Total Visitors</div>
              <div className="text-2xl font-bold mt-1" style={{ color: '#333333', fontFamily: "'Montserrat', sans-serif" }}>{totals.visitors.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-0.5">Visitors who visited the City of Kigali in this period</div>
            </div>
            <div className="p-3" style={{ border: '1px solid #E0E0E0', borderLeft: `3px solid ${CC.teal}` }}>
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Total Served</div>
              <div className="text-2xl font-bold mt-1" style={{ color: CC.teal, fontFamily: "'Montserrat', sans-serif" }}>{totals.served.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-0.5">Visitors whose services were completed</div>
            </div>
            <div className="p-3" style={{ border: '1px solid #E0E0E0', borderLeft: `3px solid ${CC.red}` }}>
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Total Not Served</div>
              <div className="text-2xl font-bold mt-1" style={{ color: CC.red, fontFamily: "'Montserrat', sans-serif" }}>{totals.notServed.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-0.5">Visitors who were not served yet</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MayorDeptServicesSection;
