import React from 'react';
import { FiActivity, FiTrendingUp } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatDateTime } from '../../../../core/components/visitor/visitorApi';
import MovementRangeBar from './MovementRangeBar';
import type { Movement } from './useParkingMovement';
import { useParkingMovement } from './useParkingMovement';
import { BORDER, CARD_SHADOW, GRAY_DISABLED, NEUTRAL_DARK, PRIMARY, PRIMARY_HOVER, WHITE, fontHeading } from './dashboardTheme';

const CHECK_IN = '#056daa';
const CHECK_OUT = '#4CAF50';
const FLAGGED = '#E74C3C';

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
  hour: 60,
  day: 76,
  week: 100,
  month: 76,
  year: 64,
};

const periodName = (movement: Movement): string => (movement.range === 'custom' ? `(${movement.label})` : movement.label);

const startNote = (movement: Movement): string | null => {
  const inside = movement.earliest_inside;
  if (!inside) return null;
  const since = formatDateTime(inside.check_in);
  if (movement.auto && movement.range === 'custom') return `Starting ${movement.label.split(' - ')[0]}: ${inside.plate_number} has been parked since ${since}.`;
  if (new Date(inside.check_in).getTime() < new Date(movement.from).getTime()) return `${inside.plate_number} has been parked since ${since}, before this period.`;
  return null;
};

const Total: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="text-center min-w-0">
    <p className="text-xs sm:text-sm text-[#555555]">{label}</p>
    <p className="text-xl sm:text-2xl font-bold" style={{ fontFamily: fontHeading, color }}>{value}</p>
  </div>
);

const HourlyParkingChart: React.FC<HourlyParkingChartProps> = ({ enabled }) => {
  const movement = useParkingMovement(enabled);
  const data = movement.data;
  const points = data?.points || [];
  const hasMovement = points.some((p) => p.check_in > 0 || p.check_out > 0 || p.flagged > 0);
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
            {data && !movement.loading ? (
              <p className="text-xs text-[#555555]">Vehicle movement {periodName(data)}, {UNIT_TEXT[data.unit]}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={movement.reload}
          disabled={movement.loading}
          className="px-3 py-1.5 text-white transition-colors flex items-center justify-center gap-1 cursor-pointer w-full sm:w-auto disabled:opacity-60"
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

      {movement.loading ? (
        <div className="flex flex-col items-center justify-center h-56 sm:h-64 gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent"></div>
          <p className="text-xs text-[#555555]">Loading vehicle movement...</p>
        </div>
      ) : movement.error && !data ? (
        <div className="flex flex-col items-center justify-center h-48 text-[#9E9E9E]">
          <p className="text-sm">{movement.error}</p>
          <button type="button" onClick={movement.reload} className="mt-2 text-sm text-[#056daa] hover:underline">
            Try again
          </button>
        </div>
      ) : data && hasMovement ? (
        <div>
          {note ? <p className="text-xs text-[#555555] mb-2">{note}</p> : null}
          <div className="overflow-x-auto">
            <div className="h-56 sm:h-64" style={{ minWidth: chartWidth }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points} margin={{ top: 20, right: 10, left: 0, bottom: 25 }} barGap={2} barCategoryGap="20%">
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
                  <Tooltip
                    cursor={{ fill: 'rgba(5,109,170,0.06)' }}
                    contentStyle={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0, boxShadow: CARD_SHADOW }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="check_in" name="Check-ins" fill={CHECK_IN} radius={[2, 2, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="check_out" name="Check-outs" fill={CHECK_OUT} radius={[2, 2, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="flagged" name="Flagged" fill={FLAGGED} radius={[2, 2, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4 pt-4 border-t border-[#E0E0E0]">
            <Total label={`Total Check-ins ${periodName(data)}`} value={data.totals.check_in} color={CHECK_IN} />
            <Total label={`Total Check-outs ${periodName(data)}`} value={data.totals.check_out} color={CHECK_OUT} />
            <Total label={`Total Flagged ${periodName(data)}`} value={data.totals.flagged} color={FLAGGED} />
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
