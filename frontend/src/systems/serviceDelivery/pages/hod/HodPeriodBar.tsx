import React, { useState } from 'react';

export type HodPeriod = 'today' | 'week' | 'month' | 'last_month' | 'year' | 'range';

export interface HodAppliedPeriod {
  period: HodPeriod;
  from?: string;
  to?: string;
}

const PERIOD_OPTIONS: { value: HodPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'year', label: 'This Year' },
  { value: 'range', label: 'Custom Range' },
];

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const periodToRange = (period: HodPeriod, rangeFrom?: string, rangeTo?: string): { from?: string; to?: string } => {
  const now = new Date();
  if (period === 'range') {
    return { from: rangeFrom || undefined, to: rangeTo || undefined };
  }
  if (period === 'today') {
    return { from: fmt(now), to: fmt(now) };
  }
  if (period === 'week') {
    const monday = new Date(now);
    const day = monday.getDay();
    monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
    return { from: fmt(monday), to: fmt(now) };
  }
  if (period === 'month') {
    return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) };
  }
  if (period === 'last_month') {
    return {
      from: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: fmt(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: fmt(now) };
};

const inputStyle: React.CSSProperties = { paddingLeft: '12px', minHeight: '38px' };

const HodPeriodBar: React.FC<{ applied: HodAppliedPeriod; onApply: (value: HodAppliedPeriod) => void }> = ({ applied, onApply }) => {
  const [period, setPeriod] = useState<HodPeriod>(applied.period);
  const [from, setFrom] = useState(applied.from || '');
  const [to, setTo] = useState(applied.to || '');

  const handlePeriodChange = (value: HodPeriod) => {
    setPeriod(value);
    if (value !== 'range') {
      onApply({ period: value });
    }
  };

  return (
    <div className="bg-white p-3 flex flex-col sm:flex-row sm:items-center gap-2" style={{ border: '1px solid #E0E0E0' }}>
      <select
        value={period}
        onChange={e => handlePeriodChange(e.target.value as HodPeriod)}
        className="cok-auth-input w-full sm:w-56 text-sm"
        style={inputStyle}
      >
        {PERIOD_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {period === 'range' && (
        <>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="cok-auth-input w-full sm:w-auto text-sm"
            style={inputStyle}
          />
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="cok-auth-input w-full sm:w-auto text-sm"
            style={inputStyle}
          />
          <button
            className="px-5 py-2 text-xs font-semibold text-white"
            style={{
              backgroundColor: '#056daa',
              borderRadius: 0,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontFamily: "'Montserrat', sans-serif",
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#045d94'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#056daa'; }}
            onClick={() => onApply({ period: 'range', from: from || undefined, to: to || undefined })}
          >
            Apply
          </button>
        </>
      )}
    </div>
  );
};

export default HodPeriodBar;
