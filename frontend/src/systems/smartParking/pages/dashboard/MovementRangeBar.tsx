import React from 'react';
import type { MovementRange } from './useParkingMovement';

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
  customLabel: string | null;
  onRange: (range: Exclude<MovementRange, 'custom'>) => void;
  onOpenCustom: () => void;
}

const MovementRangeBar: React.FC<MovementRangeBarProps> = ({ range, customLabel, onRange, onOpenCustom }) => (
  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-2 mb-4">
    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 w-full sm:w-auto">
      <span>Period</span>
      <select
        value={range}
        onChange={(e) => {
          const next = e.target.value as MovementRange;
          if (next === 'custom') onOpenCustom();
          else onRange(next);
        }}
        className="w-full sm:w-48 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case text-gray-900 cursor-pointer focus:outline-none focus:border-[#056daa]"
      >
        {OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
      </select>
    </label>

    {range === 'custom' && customLabel ? (
      <div className="flex items-center gap-2 min-w-0">
        <span className="rounded-full bg-[#056daa]/10 px-3 py-1.5 text-xs font-medium text-[#056daa] truncate">{customLabel}</span>
        <button
          type="button"
          onClick={onOpenCustom}
          className="shrink-0 rounded-full border border-[#056daa] px-3 py-1 text-xs font-semibold text-[#056daa] hover:bg-[#056daa]/10 cursor-pointer"
        >
          Change
        </button>
      </div>
    ) : null}
  </div>
);

export default MovementRangeBar;
