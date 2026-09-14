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
const PRIMARY = '#056daa';
const BORDER = '#E0E0E0';
const fontHeading = "'Montserrat', sans-serif";

export interface DeptServiceRow { name: string; assigned: number; served: number; notServed: number }
export interface DeptServiceTotals { visitors: number; served: number; notServed: number }
export interface DeptServicesData { rows: DeptServiceRow[]; totals: DeptServiceTotals; loading: boolean }

export const periodToRange = (applied: AppliedFilter): { from?: string; to?: string } => {
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

export const useDeptServices = (applied: AppliedFilter, refreshTick: number): DeptServicesData => {
  const [rows, setRows] = useState<DeptServiceRow[]>([]);
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
              return { name, assigned, served: servedCount, notServed: Math.max(0, assigned - servedCount) };
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

  return { rows, totals, loading };
};

const BarValue: React.FC<{ value: number; pct: number; color: string; inside?: boolean }> = ({ value, pct, color, inside }) => {
  if (value <= 0) return null;
  if (pct >= 14) return <span className="text-[10px] font-bold text-white leading-none">{value}</span>;
  return inside ? null : <span className="text-[10px] font-bold leading-none" style={{ color }}>{value}</span>;
};

const DeptServicesMirror: React.FC<{ rows: DeptServiceRow[]; compact?: boolean }> = ({ rows, compact }) => {
  const maxLeft = Math.max(...rows.map(r => r.assigned), 1);
  const makeTicks = (max: number) => {
    const step = Math.max(1, Math.ceil(max / 4));
    const ticks: number[] = [];
    for (let v = 0; v <= Math.floor(max); v += step) ticks.push(v);
    return ticks;
  };
  const ticks = makeTicks(maxLeft);
  const nameWidth = compact ? 'w-24 sm:w-32' : 'w-28 sm:w-48';
  const barHeight = compact ? 'h-5' : 'h-6';

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex items-center gap-1.5 pb-1.5 border-b-2" style={{ borderColor: CC.amber }}>
          <span className="text-[11px] font-extrabold tracking-wide uppercase" style={{ color: CC.amber }}>Departments</span>
          <span className="text-[10px] text-gray-500 hidden sm:inline">(assigned)</span>
        </div>
        <div className="flex-1 flex items-center justify-end gap-1.5 pb-1.5 border-b-2" style={{ borderColor: CC.teal }}>
          <span className="text-[10px] text-gray-500 hidden sm:inline">(not served vs served)</span>
          <span className="text-[11px] font-extrabold tracking-wide uppercase" style={{ color: CC.teal }}>Visitors</span>
        </div>
      </div>

      <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
        {rows.map(row => {
          const notServed = Math.max(0, row.assigned - row.served);
          const leftPct = (row.assigned / maxLeft) * 100;
          const notServedPct = (notServed / maxLeft) * 100;
          const servedPct = (row.served / maxLeft) * 100;
          return (
            <div
              key={row.name}
              className="flex items-center py-0.5 hover:bg-gray-50 transition-colors"
              title={`${row.name}: ${row.assigned} assigned - ${row.served} served - ${notServed} not served`}
            >
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className={`${nameWidth} flex-shrink-0 text-right text-[11px] font-medium text-gray-700 truncate leading-tight`}>{row.name}</span>
                <div className={`flex-1 ${barHeight} bg-gray-100/80 flex items-center justify-end overflow-hidden`}>
                  {leftPct < 14 && <span className="pr-1"><BarValue value={row.assigned} pct={leftPct} color={CC.amber} /></span>}
                  <div className="h-full transition-all duration-500 flex items-center justify-center" style={{ width: `${leftPct}%`, minWidth: row.assigned > 0 ? 4 : 0, backgroundColor: CC.amber }}>
                    <BarValue value={row.assigned} pct={leftPct} color={CC.amber} inside />
                  </div>
                </div>
              </div>

              <div className="w-[3px] self-stretch mx-1 flex-shrink-0" style={{ background: PRIMARY }}></div>

              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className={`flex-1 ${barHeight} bg-gray-100/80 flex items-center justify-start overflow-hidden`}>
                  {notServed > 0 && (
                    <div className="h-full transition-all duration-500 flex items-center justify-center" style={{ width: `${notServedPct}%`, minWidth: 2, backgroundColor: CC.red }}>
                      <BarValue value={notServed} pct={notServedPct} color={CC.red} inside />
                    </div>
                  )}
                  {row.served > 0 && (
                    <div className="h-full transition-all duration-500 flex items-center justify-center" style={{ width: `${servedPct}%`, minWidth: 2, backgroundColor: CC.teal }}>
                      <BarValue value={row.served} pct={servedPct} color={CC.teal} inside />
                    </div>
                  )}
                  {((notServed > 0 && notServedPct < 14) || (row.served > 0 && servedPct < 14)) && (
                    <span className="text-[10px] font-bold pl-1 leading-none whitespace-nowrap">
                      {notServed > 0 && notServedPct < 14 && <span style={{ color: CC.red }}>{notServed}</span>}
                      {notServed > 0 && notServedPct < 14 && row.served > 0 && servedPct < 14 && <span className="text-gray-300"> / </span>}
                      {row.served > 0 && servedPct < 14 && <span style={{ color: CC.teal }}>{row.served}</span>}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-start mt-1.5">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className={`${nameWidth} flex-shrink-0`}></span>
          <div className="flex-1 relative px-1" style={{ height: 22 }}>
            <div className="absolute inset-x-1 top-0 h-px bg-gray-900"></div>
            {ticks.map((tick) => (
              <div key={tick} className="absolute top-0 flex flex-col items-center" style={{ left: `calc(${((maxLeft - tick) / maxLeft) * 100}% + 4px)`, transform: 'translateX(-50%)' }}>
                <div className="w-px h-1.5 bg-gray-900"></div>
                <span className="mt-0.5 text-[10px] font-bold text-gray-900">{tick}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="w-[3px] mx-1 flex-shrink-0"></div>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="flex-1 relative px-1" style={{ height: 22 }}>
            <div className="absolute inset-x-1 top-0 h-px bg-gray-900"></div>
            {ticks.map((tick) => (
              <div key={tick} className="absolute top-0 flex flex-col items-center" style={{ left: `calc(${(tick / maxLeft) * 100}% + 4px)`, transform: 'translateX(-50%)' }}>
                <div className="w-px h-1.5 bg-gray-900"></div>
                <span className="mt-0.5 text-[10px] font-bold text-gray-900">{tick}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const DeptServicesTotals: React.FC<{ totals: DeptServiceTotals; loading: boolean }> = ({ totals, loading }) => {
  const cards = [
    { label: 'Total Visitors', value: totals.visitors, hint: 'Visitors who visited the City of Kigali in this period', color: '#333333', accent: CC.amber },
    { label: 'Total Served', value: totals.served, hint: 'Visitors whose services were completed', color: CC.teal, accent: CC.teal },
    { label: 'Total Not Served', value: totals.notServed, hint: 'Visitors who were not served yet', color: CC.red, accent: CC.red },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="bg-white p-4" style={{ border: `1px solid ${BORDER}`, borderLeft: `4px solid ${card.accent}` }}>
          <div className="text-[11px] uppercase tracking-wide text-gray-500" style={{ fontFamily: fontHeading }}>{card.label}</div>
          <div className="text-3xl font-bold mt-1 leading-none" style={{ color: card.color, fontFamily: fontHeading }}>{loading ? '-' : card.value.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1.5">{card.hint}</div>
        </div>
      ))}
    </div>
  );
};

const PREVIEW_LIMIT = 7;

const MayorDeptServicesSection: React.FC<{ data: DeptServicesData }> = ({ data }) => {
  const { rows, loading } = data;
  const [showAll, setShowAll] = useState(false);
  const preview = rows.slice(0, PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, rows.length - PREVIEW_LIMIT);

  return (
    <>
      <div className="bg-white p-4 flex flex-col h-full" style={{ border: `1px solid ${BORDER}` }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 style={{ fontFamily: fontHeading, fontSize: 15, fontWeight: 600, color: '#333333', margin: 0 }}>Department and services</h3>
            <div className="text-[11px] uppercase tracking-wide text-gray-400 mt-0.5">Visitors assigned, served and not served per department</div>
          </div>
          {hiddenCount > 0 && (
            <button type="button" onClick={() => setShowAll(true)} className="text-xs font-semibold cursor-pointer whitespace-nowrap hover:underline" style={{ color: PRIMARY, fontFamily: fontHeading }}>
              View more ({hiddenCount})
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-center mt-3">
          {loading ? (
            <div className="h-56 flex items-center justify-center"><SpiralLoader /></div>
          ) : rows.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-gray-400">No department data available yet</div>
          ) : (
            <DeptServicesMirror rows={preview} compact />
          )}
        </div>
      </div>

      {showAll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" onClick={() => setShowAll(false)}>
          <div className="bg-white w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 sm:px-5 py-4 flex items-center justify-between text-white shrink-0" style={{ backgroundColor: PRIMARY }}>
              <div className="min-w-0">
                <h2 className="text-sm font-bold truncate" style={{ fontFamily: fontHeading }}>Department and services</h2>
                <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>All {rows.length} departments for the selected period</p>
              </div>
              <button type="button" onClick={() => setShowAll(false)} className="border border-white text-white hover:bg-white hover:text-[#333333] transition-colors cursor-pointer shrink-0 text-xs font-semibold uppercase" style={{ padding: '0.4rem 1rem', letterSpacing: '1px', fontFamily: fontHeading, borderRadius: 0 }}>Close</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <DeptServicesMirror rows={rows} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MayorDeptServicesSection;
