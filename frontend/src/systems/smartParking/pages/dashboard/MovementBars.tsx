import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Movement, MovementPoint } from './useParkingMovement';
import { BORDER, GRAY_DISABLED } from './dashboardTheme';

export const SERIES = [
  { key: 'check_in', name: 'Check-ins', color: '#056daa' },
  { key: 'check_out', name: 'Check-outs', color: '#4CAF50' },
  { key: 'flagged', name: 'Flagged', color: '#E74C3C' },
] as const;

type SeriesKey = typeof SERIES[number]['key'];
type ChartPoint = MovementPoint & { peak: number };

const GAP = 2;
const MAX_BAR = 18;
const GROUP_WIDTH: Record<Movement['unit'], number> = { hour: 72, day: 84, week: 104, month: 84, year: 72 };

interface GroupShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: ChartPoint;
}

const GroupShape: React.FC<GroupShapeProps> = ({ x = 0, y = 0, width = 0, height = 0, payload }) => {
  if (!payload || !payload.peak || height <= 0) return <g />;
  const bars = SERIES.filter((s) => payload[s.key as SeriesKey] > 0);
  const size = Math.max(4, Math.min(MAX_BAR, (width - GAP * (bars.length - 1)) / bars.length));
  const total = bars.length * size + (bars.length - 1) * GAP;
  const left = x + (width - total) / 2;
  const base = y + height;
  return (
    <g>
      {bars.map((s, i) => {
        const value = payload[s.key as SeriesKey];
        const h = Math.max(1, (height * value) / payload.peak);
        const bx = left + i * (size + GAP);
        return (
          <g key={s.key}>
            <rect x={bx} y={base - h} width={size} height={h} rx={3} ry={3} fill={s.color} />
            <text x={bx + size / 2} y={base - h - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill={s.color}>{value}</text>
          </g>
        );
      })}
    </g>
  );
};

interface TipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  label?: string | number;
}

const MovementTooltip: React.FC<TipProps> = ({ active, payload, label }) => {
  const point = active && payload && payload.length ? (payload[0].payload as ChartPoint | undefined) : undefined;
  if (!point) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-gray-800">{label}</p>
      {SERIES.map((s) => (
        <p key={s.key} className="flex items-center gap-1.5 text-gray-700">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
          {s.name}: <span className="font-semibold">{point[s.key as SeriesKey]}</span>
        </p>
      ))}
    </div>
  );
};

export const MovementLegend: React.FC = () => (
  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-600">
    {SERIES.map((s) => (
      <span key={s.key} className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
        {s.name}
      </span>
    ))}
  </div>
);

const MovementBars: React.FC<{ movement: Movement }> = ({ movement }) => {
  const points: ChartPoint[] = movement.points.map((p) => ({ ...p, peak: Math.max(p.check_in, p.check_out, p.flagged) }));
  const minWidth = Math.max(280, points.length * GROUP_WIDTH[movement.unit]);

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="h-60 sm:h-72" style={{ minWidth }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 24, right: 8, left: -8, bottom: 8 }} barCategoryGap="12%">
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
            <XAxis
              dataKey="label"
              stroke={GRAY_DISABLED}
              tick={{ fontSize: 10, fill: GRAY_DISABLED }}
              axisLine={false}
              tickLine={false}
              interval={0}
              height={28}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, (max: number) => Math.max(1, Math.ceil(max * 1.2))]}
              stroke={GRAY_DISABLED}
              tick={{ fontSize: 10, fill: GRAY_DISABLED }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip cursor={{ fill: 'rgba(5,109,170,0.06)' }} content={(props) => <MovementTooltip {...(props as TipProps)} />} />
            <Bar dataKey="peak" shape={(props: unknown) => <GroupShape {...(props as GroupShapeProps)} />} isAnimationActive={false} legendType="none" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MovementBars;
