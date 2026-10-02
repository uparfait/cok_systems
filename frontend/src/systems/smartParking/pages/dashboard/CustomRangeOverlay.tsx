import React, { useMemo, useState } from 'react';
import OverlayShell from '../../../../core/components/overlay/OverlayShell';
import type { CustomPeriod } from './useParkingMovement';
import { todayString } from './useParkingMovement';

interface CustomRangeOverlayProps {
  initial: CustomPeriod;
  onApply: (period: CustomPeriod) => void;
  onClose: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const FROM_HOURS = Array.from({ length: 24 }, (_, h) => h);
const TO_HOURS = Array.from({ length: 24 }, (_, h) => h + 1);

const LABEL = 'flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600';
const INPUT = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal normal-case text-gray-900 focus:outline-none focus:border-[#056daa]';

const split = (value: string, fallbackHour: number) => {
  const [day, time] = (value || '').split('T');
  const hour = time ? Number(time.split(':')[0]) : fallbackHour;
  return { day: day || todayString(), hour: Number.isFinite(hour) ? hour : fallbackHour };
};

const CustomRangeOverlay: React.FC<CustomRangeOverlayProps> = ({ initial, onApply, onClose }) => {
  const start = split(initial.from, 0);
  const end = split(initial.to, 24);
  const [fromDay, setFromDay] = useState(start.day);
  const [fromHour, setFromHour] = useState(Math.min(23, start.hour));
  const [toDay, setToDay] = useState(end.day);
  const [toHour, setToHour] = useState(Math.max(1, end.hour));
  const today = todayString();

  const fromValue = `${fromDay}T${pad(fromHour)}:00`;
  const toValue = `${toDay}T${pad(toHour)}:00`;

  const problem = useMemo(() => {
    if (!fromDay || !toDay) return 'Choose both days';
    if (fromDay > today) return 'The From day cannot be in the future';
    if (toValue <= fromValue) return 'The To time must be after the From time';
    return null;
  }, [fromDay, toDay, fromValue, toValue, today]);

  return (
    <OverlayShell
      title="Custom period"
      onClose={onClose}
      width="sm"
      zIndex={1100}
      footer={(
        <button
          type="button"
          disabled={!!problem}
          onClick={() => onApply({ from: fromValue, to: toValue })}
          className="cok-btn-primary w-full! sm:w-auto! px-6! py-2! rounded-md! disabled:opacity-50"
        >
          Apply
        </button>
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className={LABEL}>
            <span className="cok-req">From day</span>
            <input type="date" value={fromDay} max={toDay || today} onChange={(e) => setFromDay(e.target.value)} className={INPUT} />
          </label>
          <label className={LABEL}>
            <span className="cok-req">From hour</span>
            <select value={fromHour} onChange={(e) => setFromHour(Number(e.target.value))} className={INPUT}>
              {FROM_HOURS.map((h) => <option key={h} value={h}>{pad(h)}:00</option>)}
            </select>
          </label>
          <label className={LABEL}>
            <span className="cok-req">To day</span>
            <input type="date" value={toDay} min={fromDay || undefined} max={today} onChange={(e) => setToDay(e.target.value)} className={INPUT} />
          </label>
          <label className={LABEL}>
            <span className="cok-req">To hour</span>
            <select value={toHour} onChange={(e) => setToHour(Number(e.target.value))} className={INPUT}>
              {TO_HOURS.map((h) => <option key={h} value={h}>{pad(h)}:00</option>)}
            </select>
          </label>
        </div>
        {problem ? <p className="text-xs text-red-600">{problem}</p> : null}
      </div>
    </OverlayShell>
  );
};

export default CustomRangeOverlay;
