import React, { useState } from 'react';
import { FiActivity, FiTrendingUp } from 'react-icons/fi';
import { formatDateTime } from '../../../../core/components/visitor/visitorApi';
import MovementRangeBar from './MovementRangeBar';
import CustomRangeOverlay from './CustomRangeOverlay';
import MovementBars, { MovementLegend, SERIES } from './MovementBars';
import type { CustomPeriod, Movement } from './useParkingMovement';
import { dayOf, todayString, useParkingMovement } from './useParkingMovement';
import { CARD_SHADOW, NEUTRAL_DARK, WHITE, fontHeading } from './dashboardTheme';

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

const periodName = (movement: Movement): string => (movement.range === 'custom' ? `(${movement.label})` : movement.label);

const startNote = (movement: Movement): string | null => {
  const by = movement.started_by;
  if (movement.auto && by) {
    const since = formatDateTime(by.check_in);
    return by.still_inside
      ? `${by.plate_number} has been parked since ${since}, so the chart starts that day.`
      : `${by.plate_number} came in on ${since} and left today, so the chart starts that day.`;
  }
  const inside = movement.earliest_inside;
  if (inside && new Date(inside.check_in).getTime() < new Date(movement.from).getTime()) {
    return `${inside.plate_number} has been parked since ${formatDateTime(inside.check_in)}, before this period.`;
  }
  return null;
};

const Spinner: React.FC = () => (
  <div className="flex items-center justify-center h-60 sm:h-72">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent"></div>
  </div>
);

const HourlyParkingChart: React.FC<HourlyParkingChartProps> = ({ enabled }) => {
  const movement = useParkingMovement(enabled);
  const [customOpen, setCustomOpen] = useState(false);
  const data = movement.data;
  const hasMovement = !!data && data.points.some((p) => p.check_in > 0 || p.check_out > 0 || p.flagged > 0);
  const note = data ? startNote(data) : null;

  const customStart: CustomPeriod = movement.custom || {
    from: `${data?.earliest_inside ? dayOf(data.earliest_inside.check_in) : todayString()}T00:00`,
    to: `${todayString()}T24:00`,
  };

  const applyCustom = (period: CustomPeriod) => {
    setCustomOpen(false);
    movement.applyCustom(period);
  };

  return (
    <div className="p-3 sm:p-4 md:p-5 mb-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
      <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(5,109,170,0.1)' }}>
            <FiTrendingUp className="w-4 h-4 text-[#056daa]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Hourly Parking Analytics</h2>
            {data && !movement.loading ? (
              <p className="text-xs text-[#555555] truncate">Vehicle movement {periodName(data)}, {UNIT_TEXT[data.unit]}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={movement.reload}
          disabled={movement.loading}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#056daa] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#045d94] disabled:opacity-60 cursor-pointer sm:w-auto"
          style={{ fontFamily: fontHeading }}
        >
          <FiActivity className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <MovementRangeBar
        range={movement.range}
        customLabel={movement.range === 'custom' && data && data.range === 'custom' ? data.label : null}
        onRange={movement.setRange}
        onOpenCustom={() => setCustomOpen(true)}
      />

      {movement.loading ? (
        <Spinner />
      ) : movement.error && !data ? (
        <div className="flex flex-col items-center justify-center h-48 text-[#9E9E9E]">
          <p className="text-sm text-center">{movement.error}</p>
          <button type="button" onClick={movement.reload} className="mt-2 text-sm text-[#056daa] hover:underline cursor-pointer">
            Try again
          </button>
        </div>
      ) : data && hasMovement ? (
        <div className="flex flex-col gap-3">
          {note ? <p className="text-xs text-[#555555]">{note}</p> : null}
          <MovementBars movement={data} />
          <MovementLegend />
          <div className="grid grid-cols-1 gap-2 border-t border-[#E0E0E0] pt-3 sm:grid-cols-3 sm:gap-3">
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 sm:flex-col sm:justify-center sm:text-center" style={{ backgroundColor: `${s.color}14` }}>
                <p className="text-xs text-[#555555]">Total {s.name} {periodName(data)}</p>
                <p className="text-xl sm:text-2xl font-bold" style={{ fontFamily: fontHeading, color: s.color }}>{data.totals[s.key]}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-48 text-[#9E9E9E]">
          <FiTrendingUp className="w-10 h-10 mb-2 opacity-50" />
          <p className="text-sm text-center">No vehicle movement {data ? periodName(data) : 'in this period'}</p>
          <button type="button" onClick={movement.reload} className="mt-2 text-sm text-[#056daa] hover:underline cursor-pointer">
            Click to refresh
          </button>
        </div>
      )}

      {customOpen ? (
        <CustomRangeOverlay initial={customStart} onApply={applyCustom} onClose={() => setCustomOpen(false)} />
      ) : null}
    </div>
  );
};

export default HourlyParkingChart;
