import React, { useState, useEffect, useRef } from 'react';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import { statisticsService } from '../../../../core/services/adminService';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LabelList
} from 'recharts';
import type { AppliedFilter } from '../components/FeedbackFeed';

const PRIMARY = '#056daa';
const SUCCESS = '#4CAF50';
const DANGER = '#E74C3C';
const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const GRAY_DISABLED = '#9E9E9E';
const fontHeading = "'Montserrat', sans-serif";

interface ActivityPoint {
  label: string;
  parking_check_in: number;
  parking_check_out: number;
  service_checked_in: number;
}

const axisTickProps = {
  tick: { fontSize: 11, fill: GRAY_DISABLED },
  axisLine: false as const,
  tickLine: false as const,
};

const tooltipStyle = { backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 0 };
const pointLabel = { position: 'top' as const, fill: NEUTRAL_DARK, fontSize: 10, fontWeight: 600 };
const barLabelStyle = { fill: NEUTRAL_DARK, fontWeight: 700, fontSize: 11, fontFamily: fontHeading };

const StaticLegend: React.FC<{ items: Array<{ color: string; label: string }> }> = ({ items }) => (
  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2">
    {items.map((it) => (
      <div key={it.label} className="flex items-center gap-1.5 text-xs text-[#555555]" style={{ fontFamily: fontHeading }}>
        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: it.color }} />
        {it.label}
      </div>
    ))}
  </div>
);

const MayorActivitySection: React.FC<{ applied: AppliedFilter; refreshTick: number }> = ({ applied, refreshTick }) => {
  const [activityData, setActivityData] = useState<ActivityPoint[]>([]);
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
        const res: any = await statisticsService.getActivityTimeline({
          period: applied.period,
          from: applied.period === 'range' ? applied.from : undefined,
          to: applied.period === 'range' ? applied.to : undefined,
        });
        if (cancelled) return;
        const timeline = res?.data;
        setActivityData(Array.isArray(timeline) ? timeline : []);
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [appliedKey, refreshTick]);

  const activityMinWidth = Math.max(560, activityData.length * 52);
  const comparisonMinWidth = Math.max(560, activityData.length * 72);

  const spinner = (
    <div className="h-72 flex items-center justify-center">
      <SpiralLoader />
    </div>
  );
  const empty = <div className="h-72 flex items-center justify-center text-sm text-[#9E9E9E]">No data for this period</div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-[#E0E0E0] p-4">
          <h2 className="text-sm font-bold text-[#333333] mb-3" style={{ fontFamily: fontHeading }}>Parking Activity</h2>
          {loading ? spinner : activityData.length === 0 ? empty : (
            <div className="overflow-x-auto">
              <div className="h-72" style={{ minWidth: `${activityMinWidth}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="mayorColorCheckIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.25}/>
                        <stop offset="95%" stopColor={PRIMARY} stopOpacity={0.02}/>
                      </linearGradient>
                      <linearGradient id="mayorColorCheckOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={DANGER} stopOpacity={0.25}/>
                        <stop offset="95%" stopColor={DANGER} stopOpacity={0.02}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                    <XAxis dataKey="label" {...axisTickProps} angle={-30} textAnchor="end" height={60} interval={0} />
                    <YAxis {...axisTickProps} allowDecimals={false} domain={[0, (dataMax: number) => Math.ceil((dataMax || 1) * 1.2)]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="parking_check_in" stroke={PRIMARY} strokeWidth={2} fill="url(#mayorColorCheckIn)" name="Cars Checked In" dot={{ r: 3 }} activeDot={{ r: 6, fill: PRIMARY, stroke: '#fff', strokeWidth: 2 }} label={pointLabel} isAnimationActive={false} />
                    <Area type="monotone" dataKey="parking_check_out" stroke={DANGER} strokeWidth={2} fill="url(#mayorColorCheckOut)" name="Cars Checked Out" dot={{ r: 3 }} activeDot={{ r: 6, fill: DANGER, stroke: '#fff', strokeWidth: 2 }} label={pointLabel} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {!loading && activityData.length > 0 && (
            <StaticLegend items={[{ color: PRIMARY, label: 'Cars Checked In' }, { color: DANGER, label: 'Cars Checked Out' }]} />
          )}
        </div>

        <div className="bg-white border border-[#E0E0E0] p-4">
          <h2 className="text-sm font-bold text-[#333333] mb-3" style={{ fontFamily: fontHeading }}>Service Delivery Activity</h2>
          {loading ? spinner : activityData.length === 0 ? empty : (
            <div className="overflow-x-auto">
              <div className="h-72" style={{ minWidth: `${activityMinWidth}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="mayorColorService" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SUCCESS} stopOpacity={0.25}/>
                        <stop offset="95%" stopColor={SUCCESS} stopOpacity={0.02}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                    <XAxis dataKey="label" {...axisTickProps} angle={-30} textAnchor="end" height={60} interval={0} />
                    <YAxis {...axisTickProps} allowDecimals={false} domain={[0, (dataMax: number) => Math.ceil((dataMax || 1) * 1.2)]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="service_checked_in" stroke={SUCCESS} strokeWidth={2} fill="url(#mayorColorService)" name="Visitors Checked In" dot={{ r: 3 }} activeDot={{ r: 6, fill: SUCCESS, stroke: '#fff', strokeWidth: 2 }} label={pointLabel} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {!loading && activityData.length > 0 && (
            <StaticLegend items={[{ color: SUCCESS, label: 'Visitors Checked In' }]} />
          )}
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E0] p-4">
        <h2 className="text-sm font-bold text-[#333333] mb-3" style={{ fontFamily: fontHeading }}>Parking vs Service Delivery</h2>
        {loading ? spinner : activityData.length === 0 ? empty : (
          <div className="overflow-x-auto">
            <div className="h-72" style={{ minWidth: `${comparisonMinWidth}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="label" {...axisTickProps} angle={-30} textAnchor="end" height={60} interval={0} />
                  <YAxis {...axisTickProps} allowDecimals={false} domain={[0, (dataMax: number) => Math.ceil((dataMax || 1) * 1.2)]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="parking_check_in" fill={PRIMARY} name="Cars Checked In" isAnimationActive={false}>
                    <LabelList dataKey="parking_check_in" position="top" style={barLabelStyle} />
                  </Bar>
                  <Bar dataKey="service_checked_in" fill={SUCCESS} name="Visitors Checked In" isAnimationActive={false}>
                    <LabelList dataKey="service_checked_in" position="top" style={barLabelStyle} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {!loading && activityData.length > 0 && (
          <StaticLegend items={[{ color: PRIMARY, label: 'Cars Checked In' }, { color: SUCCESS, label: 'Visitors Checked In' }]} />
        )}
      </div>
    </div>
  );
};

export default MayorActivitySection;
