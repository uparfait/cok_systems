import React, { useState, useEffect, useRef } from 'react';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import { statisticsService } from '../../../../core/services/adminService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { AppliedFilter } from '../components/FeedbackFeed';

const PRIMARY = '#056daa';
const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const GRAY_DISABLED = '#9E9E9E';
const fontHeading = "'Montserrat', sans-serif";

interface OccupancyPoint { label: string; occupied: number; percentage: number }

const ParkingOccupancyDonut: React.FC<{ occupied: number; totalSlots: number }> = ({ occupied, totalSlots }) => {
  const pct = totalSlots > 0 ? Math.min(100, Math.round((occupied / totalSlots) * 100)) : 0;
  const R = 70;
  const CIRC = 2 * Math.PI * R;
  const STROKE = 22;
  return (
    <div className="flex flex-col items-center py-2">
      <div className="flex flex-wrap items-center justify-center gap-3 w-full">
        <svg viewBox="0 0 200 200" style={{ width: '100%', maxWidth: 190 }}>
          <circle cx="100" cy="100" r={R} fill="none" stroke="#E0E0E0" strokeWidth={STROKE} />
          <circle
            cx="100" cy="100" r={R} fill="none"
            stroke="#E74C3C" strokeWidth={STROKE} strokeLinecap="butt"
            strokeDasharray={`${(pct / 100) * CIRC} ${CIRC}`}
            transform="rotate(-90 100 100)"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
          <text x="100" y="100" textAnchor="middle" dominantBaseline="central" fontSize="34" fontWeight="800" fill="#C62828">
            {pct}%
          </text>
        </svg>
        <svg viewBox="0 0 200 200" style={{ width: '100%', maxWidth: 120 }}>
          <circle cx="100" cy="100" r={R} fill="none" stroke="#E0E0E0" strokeWidth={STROKE} />
          <circle
            cx="100" cy="100" r={R} fill="none"
            stroke="#056daa" strokeWidth={STROKE} strokeLinecap="butt"
            strokeDasharray={`${(pct / 100) * CIRC} ${CIRC}`}
            transform="rotate(-90 100 100)"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
          <text x="100" y="100" textAnchor="middle" dominantBaseline="central" fontSize="28" fontWeight="800" fill="#045d94">
            {occupied}/{totalSlots}
          </text>
        </svg>
      </div>
      <div className="text-lg font-bold text-gray-800 mt-1">Parking occupancy</div>
    </div>
  );
};

const MayorOccupancySection: React.FC<{ applied: AppliedFilter; refreshTick: number }> = ({ applied, refreshTick }) => {
  const [points, setPoints] = useState<OccupancyPoint[]>([]);
  const [totalSlots, setTotalSlots] = useState(0);
  const [current, setCurrent] = useState<{ occupied: number; totalSlots: number; percentage: number }>({ occupied: 0, totalSlots: 0, percentage: 0 });
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
        const res: any = await statisticsService.getOccupancyTimeline({
          period: applied.period,
          from: applied.period === 'range' ? applied.from : undefined,
          to: applied.period === 'range' ? applied.to : undefined,
        });
        if (cancelled) return;
        const rows = Array.isArray(res?.data) ? res.data : [];
        const cur = res?.current || {};
        setPoints(rows);
        setCurrent({
          occupied: cur.occupied || 0,
          totalSlots: cur.totalSlots || res?.totalSlots || 0,
          percentage: cur.percentage || 0,
        });
        setTotalSlots(res?.totalSlots || cur.totalSlots || 0);
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [appliedKey, refreshTick]);

  const chartMinWidth = Math.max(560, points.length * 52);

  return (
    <div className="bg-white border border-[#E0E0E0] p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-bold text-[#333333]" style={{ fontFamily: fontHeading }}>Parking Occupancy</h2>
          <p className="text-xs text-[#9E9E9E] mt-0.5">
            {applied.period === 'today'
              ? 'Occupied share of all parking slots · live'
              : 'Peak occupancy per period: the busiest hour of each day/month, as a share of all slots'}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <div className="text-lg font-bold leading-none" style={{ color: PRIMARY, fontFamily: fontHeading }}>{totalSlots}</div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mt-1">Total slots</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold leading-none" style={{ color: '#E74C3C', fontFamily: fontHeading }}>{current.percentage}%</div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mt-1">Current occupancy</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-72 flex items-center justify-center">
          <SpiralLoader />
        </div>
      ) : applied.period === 'today' ? (
        <ParkingOccupancyDonut occupied={current.occupied} totalSlots={current.totalSlots || totalSlots} />
      ) : points.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-sm text-[#9E9E9E]">No occupancy data for this period</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="h-72" style={{ minWidth: `${chartMinWidth}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 24, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: GRAY_DISABLED }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" height={60} interval={0} />
                <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: GRAY_DISABLED }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 0 }}
                  formatter={(value: any, _n: any, entry: any) => [`${value}% (${entry?.payload?.occupied ?? 0} cars at the busiest hour)`, 'Peak occupancy']}
                />
                <Area
                  type="monotone"
                  dataKey="percentage"
                  stroke={PRIMARY}
                  strokeWidth={2}
                  fill="rgba(5,109,170,0.1)"
                  name="Peak occupancy"
                  dot={{ r: 3 }}
                  activeDot={{ r: 6, fill: PRIMARY, stroke: '#fff', strokeWidth: 2 }}
                  label={{ position: 'top', fill: NEUTRAL_DARK, fontSize: 10, fontWeight: 600, formatter: (v: any) => `${v}%` }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default MayorOccupancySection;
