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
const MIN_BAR = 8;
const GROUP_WIDTH: Record<Movement['unit'], number> = { hour: 46, day: 46, week: 64, month: 52, year: 48 };

/** Two short lines per label: the hour, weekday or month on top, the date or year under it. */
const splitLabel = (label: string): [string, string] => {
  const hour = /^(\d{1,2} [A-Z][a-z]{2}) (\d{2}:00)$/.exec(label);
  if (hour) return [hour[2], hour[1]];
  const day = /^([A-Z][a-z]{2}) (\d{1,2} [A-Z][a-z]{2})$/.exec(label);
  if (day) return [day[1], day[2]];
  const week = /^Week of (.+)$/.exec(label);
  if (week) return ['Week of', week[1]];
  const month = /^([A-Z][a-z]{2}) (\d{4})$/.exec(label);
  if (month) return [month[1], month[2]];
  return [label, ''];
};

interface TickProps {
  x?: number;
  y?: number;
  index?: number;
  payload?: { value?: string | number };
}

interface GroupShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: ChartPoint;
}

const LEFT_OPACITY = 0.4;

/** A rectangle with only its top corners rounded, for the part that starts at the top of a bar. */
const topRounded = (x: number, y: number, w: number, h: number): string => {
  const r = Math.min(3, w / 2, h);
  return `M${x},${y + h} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h} Z`;
};

const GroupShape: React.FC<GroupShapeProps> = ({ x = 0, y = 0, width = 0, height = 0, payload }) => {
  if (!payload || !payload.peak || height <= 0) return <g />;
  const bars = SERIES.filter((s) => payload[s.key as SeriesKey] > 0);
  const size = Math.max(MIN_BAR, Math.min(MAX_BAR, (width - GAP * (bars.length - 1)) / bars.length));
  const total = bars.length * size + (bars.length - 1) * GAP;
  const left = x + (width - total) / 2;
  const base = y + height;
  return (
    <g>
      {bars.map((s, i) => {
        const value = payload[s.key as SeriesKey];
        const h = Math.max(1, (height * value) / payload.peak);
        const bx = left + i * (size + GAP);
        const gone = s.key === 'check_in' ? Math.min(payload.entered_left || 0, value) : 0;
        const goneHeight = gone > 0 ? (h * gone) / value : 0;
        return (
          <g key={s.key}>
            <rect x={bx} y={base - h} width={size} height={h} rx={3} ry={3} fill={s.color} />
            {goneHeight > 0 ? (
              <path d={topRounded(bx, base - h, size, goneHeight)} fill={SERIES[1].color} fillOpacity={LEFT_OPACITY} />
            ) : null}
            <text x={bx + size / 2} y={base - h - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill={s.color}>{value}</text>
          </g>
        );
      })}
    </g>
  );
};

const LeftSwatch: React.FC = () => (
  <span className="relative inline-block h-2.5 w-2.5 overflow-hidden rounded-full" style={{ backgroundColor: SERIES[0].color }}>
    <span className="absolute inset-x-0 top-0 h-1/2" style={{ backgroundColor: SERIES[1].color, opacity: LEFT_OPACITY }} />
  </span>
);

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
        <React.Fragment key={s.key}>
          <p className="flex items-center gap-1.5 text-gray-700">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}: <span className="font-semibold">{point[s.key as SeriesKey]}</span>
          </p>
          {s.key === 'check_in' && point.check_in > 0 ? (
            <p className="ml-4 flex items-center gap-1.5 text-gray-600">
              <LeftSwatch />
              Of these, already left: <span className="font-semibold">{point.entered_left || 0}</span>
              <span className="text-gray-400">({point.check_in - (point.entered_left || 0)} still inside)</span>
            </p>
          ) : null}
        </React.Fragment>
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
    <span className="inline-flex items-center gap-1.5">
      <LeftSwatch />
      Entered and already left
    </span>
  </div>
);

const MovementBars: React.FC<{ movement: Movement }> = ({ movement }) => {
  const points: ChartPoint[] = movement.points.map((p) => ({ ...p, peak: Math.max(p.check_in, p.check_out, p.flagged) }));
  const minWidth = Math.max(280, points.length * GROUP_WIDTH[movement.unit]);
  const lines = points.map((p) => splitLabel(p.label));

  const renderTick = ({ x = 0, y = 0, index = 0 }: TickProps) => {
    const [top, bottom] = lines[index] || ['', ''];
    const showBottom = !!bottom && (index === 0 || (lines[index - 1] || ['', ''])[1] !== bottom);
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={11} textAnchor="middle" fontSize={10} fill="#4B5563">{top}</text>
        {showBottom ? <text x={0} y={0} dy={24} textAnchor="middle" fontSize={9} fill="#9CA3AF">{bottom}</text> : null}
      </g>
    );
  };

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="h-60 sm:h-72" style={{ minWidth }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 24, right: 8, left: -8, bottom: 8 }} barCategoryGap="12%">
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
            <XAxis
              dataKey="label"
              stroke={GRAY_DISABLED}
              tick={(props: unknown) => renderTick(props as TickProps)}
              axisLine={false}
              tickLine={false}
              interval={0}
              height={36}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, (max: number) => Math.max(1, Math.ceil(max * 1.2))]}
              stroke={GRAY_DISABLED}
              tick={{ fontSize: 10, fill: '#4B5563' }}
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
