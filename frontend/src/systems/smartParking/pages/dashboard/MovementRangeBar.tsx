import React, { useEffect, useState } from 'react';
import type { CustomDates, MovementRange } from './useParkingMovement';
import { todayString } from './useParkingMovement';

const OPTIONS: { key: MovementRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

interface MovementRangeBarProps {
  range: MovementRange;
  custom: CustomDates;
  busy: boolean;
  onRange: (range: MovementRange) => void;
  onApplyCustom: (dates: CustomDates) => void;
}

const LABEL = 'flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600';
const INPUT = 'border border-gray-300 bg-white px-2 py-1.5 text-sm font-normal normal-case text-gray-900 cursor-pointer';

const MovementRangeBar: React.FC<MovementRangeBarProps> = ({ range, custom, busy, onRange, onApplyCustom }) => {
  const [draft, setDraft] = useState<CustomDates>(custom);

  useEffect(() => {
    setDraft({ from: custom.from, to: custom.to });
  }, [custom.from, custom.to]);

  const valid = !!draft.from && !!draft.to && draft.from <= draft.to;
  const changed = draft.from !== custom.from || draft.to !== custom.to;

  return (
    <div className="flex flex-wrap items-end gap-2 mb-4">
      <label className={LABEL}>
        <span>Period</span>
        <select value={range} onChange={(e) => onRange(e.target.value as MovementRange)} className={`${INPUT} min-w-40`}>
          {OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </select>
      </label>

      {range === 'custom' ? (
        <>
          <label className={LABEL}>
            <span className="cok-req">From</span>
            <input
              type="date"
              value={draft.from}
              max={draft.to || todayString()}
              onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
              className={INPUT}
            />
          </label>
          <label className={LABEL}>
            <span className="cok-req">To</span>
            <input
              type="date"
              value={draft.to}
              min={draft.from || undefined}
              max={todayString()}
              onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
              className={INPUT}
            />
          </label>
          <button
            type="button"
            disabled={!valid || busy || !changed}
            onClick={() => onApplyCustom(draft)}
            className="cok-btn-primary w-auto! px-4! py-1.5! text-xs! disabled:opacity-50"
          >
            Apply
          </button>
        </>
      ) : null}
    </div>
  );
};

export default MovementRangeBar;
