import React from 'react';
import { FiActivity, FiTrendingUp } from 'react-icons/fi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatDateTime } from '../../../../core/components/visitor/visitorApi';
import MovementRangeBar from './MovementRangeBar';
import type { Movement } from './useParkingMovement';
import { useParkingMovement } from './useParkingMovement';
import { BORDER, CARD_SHADOW, GRAY_DISABLED, NEUTRAL_DARK, PRIMARY, PRIMARY_HOVER, WHITE, fontHeading } from './dashboardTheme';

interface HourlyParkingChartProps {
  enabled: boolean;
}

const UNIT_TEXT: Record<Movement['unit'], string> = {
  hour: 'by hour',
  day: 'by day',
  week: 'by week',
  month: 'by month',
  year: 'by year',
};

const POINT_WIDTH: Record<Movement['unit'], number> = {
  hour: 44,
  day: 56,
  week: 84,
  month: 64,
  year: 52,
};

const periodName = (movement: Movement): string => (movement.range === 'custom' ? `(${movement.label})` : movement.label);

const startNote = (movement: Movement): string | null => {
  const inside = movement.earliest_inside;
  if (!inside || new Date(inside.check_in).getTime() >= new Date(movement.from).getTime()) return null;
  return `Starts at ${formatDateTime(inside.check_in)}, when ${inside.plate_number}, still inside, arrived.`;
};

const HourlyParkingChart: React.FC<HourlyParkingChartProps> = ({ enabled }) => {
  const movement = useParkingMovement(enabled);
  const data = movement.data;
  const points = data?.points || [];
  const hasMovement = points.some((p) => p.check_in > 0 || p.check_out > 0);
  const note = data ? startNote(data) : null;
  const chartWidth = data ? Math.max(320, points.length * POINT_WIDTH[data.unit]) : 320;

  return (
    <div className="p-3 sm:p-4 md:p-5 mb-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 shrink-0" style={{ backgroundColor: 'rgba(5,109,170,0.1)' }}>
            <FiTrendingUp className="w-5 h-5 text-[#056daa]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Hourly Parking Analytics</h2>
            {data ? (
              <p className="text-xs text-[#555555]">Vehicle movement {periodName(data)}, {UNIT_TEXT[data.unit]}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={movement.reload}
          className="px-3 py-1.5 text-white transition-colors flex items-center justify-center gap-1 cursor-pointer w-full sm:w-auto"
          style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
        >
          <FiActivity className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <MovementRangeBar
        range={movement.range}
        custom={movement.custom}
        busy={movement.loading}
        onRange={movement.setRange}
        onApplyCustom={movement.applyCustom}
      />

      {movement.loading && !data ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent"></div>
        </div>
      ) : movement.error && !data ? (
        <div className="flex flex-col items-center justify-center h-48 text-[#9E9E9E]">
          <p className="text-sm">{movement.error}</p>
          <button type="button" onClick={movement.reload} className="mt-2 text-sm text-[#056daa] hover:underline">
            Try again
          </button>
        </div>
      ) : data && hasMovement ? (
        <div className={movement.loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {note ? <p className="text-xs text-[#555555] mb-2">{note}</p> : null}
          <div className="overflow-x-auto">
            <div className="h-56 sm:h-64" style={{ minWidth: chartWidth }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 20, right: 10, left: 0, bottom: 25 }}>
                  <defs>
                    <linearGradient id="colorCheckIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#056daa" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#056daa" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="colorCheckOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E74C3C" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#E74C3C" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke={GRAY_DISABLED}
                    tick={{ fontSize: 10, fill: GRAY_DISABLED }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={8}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke={GRAY_DISABLED}
                    tick={{ fontSize: 10, fill: GRAY_DISABLED }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip contentStyle={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0, boxShadow: CARD_SHADOW }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="check_in" name="Check-ins" stroke="#056daa" strokeWidth={2} fillOpacity={1} fill="url(#colorCheckIn)" dot={{ r: 3, fill: '#fff', stroke: '#056daa', strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="check_out" name="Check-outs" stroke="#E74C3C" strokeWidth={2} fillOpacity={1} fill="url(#colorCheckOut)" dot={{ r: 3, fill: '#fff', stroke: '#E74C3C', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4 pt-4 border-t border-[#E0E0E0]">
            <div className="text-center">
              <p className="text-xs sm:text-sm text-[#555555]">Total Check-ins {periodName(data)}</p>
              <p className="text-xl sm:text-2xl font-bold text-[#056daa]" style={{ fontFamily: fontHeading }}>{data.totals.check_in}</p>
            </div>
            <div className="text-center">
              <p className="text-xs sm:text-sm text-[#555555]">Total Check-outs {periodName(data)}</p>
              <p className="text-xl sm:text-2xl font-bold text-[#E74C3C]" style={{ fontFamily: fontHeading }}>{data.totals.check_out}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-48 text-[#9E9E9E]">
          <FiTrendingUp className="w-12 h-12 mb-2 opacity-50" />
          <p className="text-sm">No vehicle movement {data ? periodName(data) : 'in this period'}</p>
          <button type="button" onClick={movement.reload} className="mt-2 text-sm text-[#056daa] hover:underline">
            Click to refresh
          </button>
        </div>
      )}
    </div>
  );
};

export default HourlyParkingChart;
