// Overview.tsx - Fixed Y-axis to show whole numbers only
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { statisticsService, employeeService, parkingService, serviceDeliveryService, feedbackService, reservationService, requestService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import Chart from 'chart.js/auto';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell, LabelList, AreaChart, Area, CartesianGrid, Legend, ComposedChart, Line } from 'recharts';
import { COK, CokBadge } from './mayorCok';
import { FiFilter } from 'react-icons/fi';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import ParkingLotMap from '../../../core/components/ParkingLotMap';

// ==================== TYPES ====================

// Shape of /statistics/served — all served/workload aggregation happens server-side
interface ServedStats {
  total_visitors: number;
  hourly: Array<{ hour: number; count: number }>;
  last_checkin: string | null;
  by_department: Array<{ name: string; served: number; top_employee: { name: string; served: number } | null }>;
  by_employee: Array<{ id: string | null; name: string; department: string | null; served: number; visitors: Array<{ visitor: string; department: string }> }>;
}

interface DashboardData {
  employeeStats: { total: number; active: number; inactive: number; locked: number; online: number; offline: number };
  serviceStats: { total: number; completed: number; inhouse: number; by_department: Record<string, number> };
  flaggedVehicles: { 
    currently_flagged: { count: number; min_minutes: number; max_minutes: number }; 
    history: { count: number; min_minutes: number; max_minutes: number } 
  };
  feedbackTotals: { total: number; by_department: Record<string, number> };
  feedbackAvg: { overall_average: { average_rating: number }; by_department: Record<string, { average_rating: number }> };
  hourlyParking: { hour: number; check_in: number; check_out: number }[];
  hourlyService: { hour: number; visitors_checked_in: number }[];
  departments: Array<{ name: string; leader: string; staff: number; rating: number; feedback: number }>;
}

// ==================== CONSTANTS ====================

const SERVICE_HOURS = ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19']; 

// Helper function to format hour labels with AM/PM
const formatHourLabel = (hour: number): string => {
  const hourNum = parseInt(hour.toString());
  if (hourNum === 0) return '12 AM';
  if (hourNum < 12) return `${hourNum} AM`;
  if (hourNum === 12) return '12 PM';
  return `${hourNum - 12} PM`;
};

// Sentiment classification, same thresholds as the mayor feedback-analysis page
type Sentiment = 'positive' | 'neutral' | 'negative';

const SENTIMENT_META: Record<Sentiment, { label: string; color: string }> = {
  positive: { label: 'Positive', color: COK.success },
  neutral: { label: 'Neutral', color: COK.warning },
  negative: { label: 'Negative', color: COK.danger },
};

const classifySentiment = (rate?: number, rateOutOf?: number): Sentiment => {
  const max = rateOutOf || 10;
  const ratio = (rate || 0) / max;
  if (ratio >= 0.7) return 'positive';
  if (ratio >= 0.4) return 'neutral';
  return 'negative';
};

// Tooltip for the Department Sentiment chart: avg rating, feedback count, and the
// positive/neutral/negative breakdown when the row carries per-sentiment counts
const SentimentChartTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const sentiment = SENTIMENT_META[classifySentiment(d.rating, 10)];
  return (
    <div style={{ backgroundColor: '#fff', border: `1px solid ${COK.border}`, fontSize: 12, padding: '8px 10px' }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.fullName || d.name}</div>
      <div>{d.rating}/10 · <span style={{ color: sentiment.color, fontWeight: 600 }}>{sentiment.label}</span></div>
      <div>{d.count} feedback</div>
      {d.positive !== undefined && (
        <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px solid ${COK.border}` }}>
          <div style={{ color: SENTIMENT_META.negative.color }}>Negative: {d.negative}</div>
          <div style={{ color: SENTIMENT_META.neutral.color }}>Neutral: {d.neutral}</div>
          <div style={{ color: SENTIMENT_META.positive.color }}>Positive: {d.positive}</div>
        </div>
      )}
    </div>
  );
};
// Bar value label like the reference design: the count with its share of the row total
// ("650" over "(32%)"), drawn just under the top of the bar. Bars too short to fit the
// text get the label above them in gray instead. Static — no animation, no blinking.
const makeStatusBarLabel = (rows: Array<{ total?: number }>) => (props: any) => {
  const { x = 0, y = 0, width = 0, height = 0, index, value } = props;
  const num = Number(value);
  if (!num || Number.isNaN(num)) return null;
  const total = Number(rows[index]?.total) || 0;
  const pct = total > 0 ? Math.round((num / total) * 100) : null;
  const cx = x + width / 2;
  const inside = height >= (pct !== null ? 26 : 14);
  const fill = inside ? '#ffffff' : '#6b7280';
  const baseY = inside ? y + 11 : y - (pct !== null ? 15 : 4);
  return (
    <text x={cx} y={baseY} textAnchor="middle" fontSize={9} fontWeight={600} fill={fill}>
      <tspan x={cx}>{Number.isInteger(num) ? num : num.toFixed(2)}</tspan>
      {pct !== null && <tspan x={cx} dy={10}>({pct}%)</tspan>}
    </text>
  );
};

// Helper to get chart config with dynamic Y-axis ticks
const getChartConfig = (maxValue: number, minValue: number = 0) => {
  // Calculate dynamic step size using "nice numbers" algorithm
  const range = maxValue - minValue;
  const targetSteps = 5; // Aim for about 5-7 ticks on Y-axis 

  // Calculate rough step size 
  const roughStep = range / targetSteps;

  // Find the magnitude (power of 10)
  const magnitude = Math.floor(Math.log10(roughStep));
  const magnitudePow = Math.pow(10, magnitude);

  // Normalize to get first digit
  const normalizedStep = roughStep / magnitudePow;

  // Choose nice step from {1, 2, 5, 10}
  let niceStep;
  if (normalizedStep < 1.5) {
    niceStep = 1;
  } else if (normalizedStep < 3.5) {
    niceStep = 2;
  } else if (normalizedStep < 7.5) {
    niceStep = 5;
  } else {
    niceStep = 10;
  }

  // Calculate final step size
  const stepSize = niceStep * magnitudePow;

  // Calculate nice min/max values
  const niceMin = Math.floor(minValue / stepSize) * stepSize;
  const niceMax = Math.ceil(maxValue / stepSize) * stepSize;
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = Math.round(context.raw);
            return `${context.dataset.label}: ${value}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        min: niceMin,
        max: niceMax,
        grid: { color: '#e5e7eb' },
        ticks: {
          stepSize: stepSize,
          callback: (value: any) => Math.round(Number(value)).toString(),
          precision: 0  // Force no decimal places
        },
        title: {
          display: true,
          text: 'count',
          color: '#9ca3af',
          font: { size: 10 }
        }
      }, 
      x: { 
        grid: { display: false },
        ticks: { font: { size: 10 } }
      }
    }
  };
};

// Inline plugin: draws values on column caps. Set `valueLabels: 'all' | 'max'`
// on a bar dataset to opt in ('max' labels only the peak column).
const barValueLabels = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart: any) {
    const ctx = chart.ctx;
    chart.data.datasets.forEach((ds: any, di: number) => {
      const mode = ds.valueLabels;
      if (!mode) return;
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden || meta.type !== 'bar') return;
      const values = (ds.data || []).map((v: any) => Number(v) || 0);
      const maxIdx = values.indexOf(Math.max(...values));
      const horizontal = chart.options.indexAxis === 'y';
      ctx.save();
      ctx.fillStyle = '#6b7280';
      ctx.font = '600 10px sans-serif';
      if (horizontal) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
      } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
      }
      meta.data.forEach((el: any, i: number) => {
        if (mode === 'max' && (i !== maxIdx || values[i] <= 0)) return;
        const text = String(Math.round(values[i]));
        if (horizontal) ctx.fillText(text, el.x + 5, el.y);
        else ctx.fillText(text, el.x, el.y - 4);
      });
      ctx.restore();
    });
  },
};

// ==================== MAIN COMPONENT ====================

// Speedometer-style gauge — needle points at the hour of the LAST check-in (lastHour = hour of the newest entry_date)
const HourGauge: React.FC<{ hours: Array<{ hour: number; count: number }>; lastHour?: number | null }> = ({ hours, lastHour }) => {
  if (!hours.length) return null;
  const n = hours.length;
  const propIdx = lastHour == null ? -1 : hours.findIndex(h => h.hour === lastHour);
  const lastIdx = propIdx >= 0 ? propIdx : hours.reduce((best, h, i) => (h.count > 0 ? i : best), 0);
  const last = hours[lastIdx];
  const cx = 100;
  const cy = 100;
  const rOuter = 92;
  const rInner = 66;
  const seg = 180 / n;
  const GAP = 1.6;
  const rad = (deg: number) => (Math.PI * deg) / 180;
  // deg 0 = far left of the dial, deg 180 = far right
  const pt = (r: number, deg: number) => ({ x: cx - r * Math.cos(rad(deg)), y: cy - r * Math.sin(rad(deg)) });
  const segColor = (i: number) => (i < n * 0.3 ? '#F5C542' : i < n * 0.7 ? '#4CAF50' : '#E53935');
  const needleDeg = lastIdx * seg + seg / 2;
  const tip = pt(rInner - 4, needleDeg);
  const baseHalf = 4;
  const b1 = { x: cx - baseHalf * Math.cos(rad(needleDeg + 90)), y: cy - baseHalf * Math.sin(rad(needleDeg + 90)) };
  const b2 = { x: cx - baseHalf * Math.cos(rad(needleDeg - 90)), y: cy - baseHalf * Math.sin(rad(needleDeg - 90)) };

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 112" className="w-full" style={{ maxWidth: 340 }}>
        {hours.map((h, i) => {
          const a1 = i * seg + GAP / 2;
          const a2 = (i + 1) * seg - GAP / 2;
          const p1 = pt(rOuter, a1);
          const p2 = pt(rOuter, a2);
          const p3 = pt(rInner, a2);
          const p4 = pt(rInner, a1);
          const label = pt((rOuter + rInner) / 2, (a1 + a2) / 2);
          return (
            <g key={h.hour} style={{ cursor: 'pointer' }}>
              {/* Native SVG tooltip: hovering a segment shows the hour and how many check-ins it had */}
              <title>{`${formatHourLabel(h.hour)} · ${h.count} check-in${h.count === 1 ? '' : 's'}`}</title>
              <path
                d={`M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 0 0 ${p4.x} ${p4.y} Z`}
                fill={segColor(i)}
              />
              <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fontSize="5.5" fontWeight="700" fill="#1f2937">
                {formatHourLabel(h.hour).replace(' ', '')}
              </text>
            </g>
          );
        })}
        {/* Check-in count of the last-check-in hour, centered in the dial */}
        <text x={cx} y={cy - 28} textAnchor="middle" fontSize="24" fontWeight="800" fill="#111827">
          {last.count}
        </text>
        {/* Needle pointing at the hour of the last check-in */}
        <polygon points={`${tip.x},${tip.y} ${b1.x},${b1.y} ${b2.x},${b2.y}`} fill="#1f2937" />
        <circle cx={cx} cy={cy} r="8" fill="#1f2937" stroke="#fff" strokeWidth="2" />
        <circle cx={cx} cy={cy} r="2.6" fill="#E53935" />
      </svg>
      <div className="text-xs text-gray-500 mt-1">
        Last check-in: <span className="font-semibold text-gray-800">{formatHourLabel(last.hour)}</span> ·{' '}
        <span className="font-semibold text-gray-800">{last.count} check-ins</span> that hour
      </div>
    </div>
  );
};

// Circular occupancy chart — thick donut ring filled by the occupied share, percentage centered inside.
// Occupancy % = parked vehicles ÷ total slots (e.g. 162 parked of 406 slots → 40%).
const ParkingOccupancyDonut: React.FC<{ occupied: number; totalSlots: number; onViewMap?: () => void }> = ({ occupied, totalSlots, onViewMap }) => {
  const pct = totalSlots > 0 ? Math.min(100, Math.round((occupied / totalSlots) * 100)) : 0;
  const R = 70;
  const CIRC = 2 * Math.PI * R;
  const STROKE = 22;
  return (
    <div className="flex flex-col items-center py-2">
      <svg viewBox="0 0 200 200" className="w-full" style={{ maxWidth: 220 }}>
        <defs>
          <linearGradient id="occGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E53935" />
            <stop offset="100%" stopColor="#B71C1C" />
          </linearGradient>
        </defs>
        {/* Track ring */}
        <circle cx="100" cy="100" r={R} fill="none" stroke="#E8EBF3" strokeWidth={STROKE} />
        {/* Progress arc starts at 12 o'clock */}
        <circle
          cx="100" cy="100" r={R} fill="none"
          stroke="url(#occGrad)" strokeWidth={STROKE} strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * CIRC} ${CIRC}`}
          transform="rotate(-90 100 100)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="100" y="100" textAnchor="middle" dominantBaseline="central" fontSize="34" fontWeight="800" fill="#C62828">
          {pct}%
        </text>
      </svg>
      <div className="text-sm font-semibold text-gray-800 mt-1">Parking occupancy</div>
      <div className="text-xs text-gray-500 mt-0.5">
        {occupied} of {totalSlots} slots occupied
      </div>
      {onViewMap && (
        <button
          type="button"
          onClick={onViewMap}
          className="mt-3 px-4 py-1.5 border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
        >
          View map
        </button>
      )}
    </div>
  );
};

// 3D-style exploded pie (SVG) — separated slices with extruded depth, % labels on slices, callout lines to names
const StatusPie3D: React.FC<{ slices: Array<{ label: string; value: number; color: string }> }> = ({ slices }) => {
  const data = slices.filter(s => s.value > 0);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (!total) return <div className="h-40 flex items-center justify-center text-xs text-gray-400">No employee accounts yet</div>;

  // Geometry: squashed ellipse pie with per-slice explode offset and a darker extruded side wall
  const cx = 280, cy = 112, rx = 104, squash = 0.55, ry = rx * squash, depth = 24, explode = 13;
  const shade = (hex: string, f: number) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
  };

  let angle = -Math.PI / 2;
  const parts = data.map(d => {
    const sweep = (d.value / total) * Math.PI * 2;
    const p = { ...d, a0: angle, a1: angle + sweep, mid: angle + sweep / 2 };
    angle += sweep;
    return p;
  });

  const off = (p: { mid: number }) => ({ ox: Math.cos(p.mid) * explode, oy: Math.sin(p.mid) * explode * squash });
  const pt = (ang: number, ox: number, oy: number) => ({ x: cx + ox + rx * Math.cos(ang), y: cy + oy + ry * Math.sin(ang) });

  const topPath = (p: typeof parts[0]) => {
    const { ox, oy } = off(p);
    const s = pt(p.a0, ox, oy), e = pt(p.a1, ox, oy);
    const large = p.a1 - p.a0 > Math.PI ? 1 : 0;
    return `M ${cx + ox} ${cy + oy} L ${s.x} ${s.y} A ${rx} ${ry} 0 ${large} 1 ${e.x} ${e.y} Z`;
  };

  // Side wall only for the front-facing rim (angles between 0 and PI in screen space)
  const wallPath = (p: typeof parts[0]) => {
    const lo = Math.max(p.a0, 0), hi = Math.min(p.a1, Math.PI);
    if (lo >= hi) return null;
    const { ox, oy } = off(p);
    const s = pt(lo, ox, oy), e = pt(hi, ox, oy);
    const large = hi - lo > Math.PI ? 1 : 0;
    return `M ${s.x} ${s.y} A ${rx} ${ry} 0 ${large} 1 ${e.x} ${e.y} L ${e.x} ${e.y + depth} A ${rx} ${ry} 0 ${large} 0 ${s.x} ${s.y + depth} Z`;
  };

  return (
    <svg viewBox="0 0 560 235" className="w-full" style={{ maxWidth: 640, margin: '0 auto', display: 'block' }}>
      {parts.map(p => { const w = wallPath(p); return w ? <path key={`w${p.label}`} d={w} fill={shade(p.color, 0.72)} /> : null; })}
      {parts.map(p => <path key={`t${p.label}`} d={topPath(p)} fill={p.color} />)}
      {parts.map(p => {
        const { ox, oy } = off(p);
        const lx = cx + ox + rx * 0.58 * Math.cos(p.mid);
        const ly = cy + oy + ry * 0.58 * Math.sin(p.mid);
        const pct = Math.round((p.value / total) * 100);
        return (
          <text key={`p${p.label}`} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="19" fontWeight="800" fill="#fff" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
            {pct}%
          </text>
        );
      })}
      {parts.map(p => {
        const right = Math.cos(p.mid) >= 0;
        const sx = cx + Math.cos(p.mid) * (rx + explode + 2);
        const sy = cy + Math.sin(p.mid) * (ry + explode * squash + 2) + (Math.sin(p.mid) > 0 ? depth : 0);
        const ex = cx + (right ? 1 : -1) * (rx + 46);
        const ey = sy + (Math.sin(p.mid) > 0 ? 14 : -14);
        return (
          <g key={`c${p.label}`}>
            <polyline points={`${sx},${sy} ${ex},${ey} ${ex + (right ? 22 : -22)},${ey}`} fill="none" stroke="#9ca3af" strokeWidth="1" />
            <text x={ex + (right ? 26 : -26)} y={ey} textAnchor={right ? 'start' : 'end'} dominantBaseline="middle" fontSize="11" fontWeight="600" fill="#374151">
              {p.label} ({p.value})
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// Mirrored departments-vs-staff chart: amber bars (staff assigned) grow left
// from the center divider, teal/red stacked bars (served vs not served) grow
// right, both aligned to their number lines.
// Used by the dashboard card (top rows) and the detail modal (all rows, scrollable).
const DeptServicesMirror: React.FC<{
  rows: Array<{ name: string; staff: number; served: number; notServed: number }>;
  cc: { amber: string; teal: string; red: string };
  scroll?: boolean;
}> = ({ rows, cc, scroll }) => {
  const maxLeft = Math.max(...rows.map(r => r.staff), 1);
  const maxRight = Math.max(...rows.map(r => r.served + r.notServed), 1);
  const makeTicks = (max: number) => {
    const step = Math.max(1, Math.ceil(max / 5));
    const ticks: number[] = [];
    for (let v = 0; v <= Math.floor(max); v += step) ticks.push(v);
    return ticks;
  };
  const leftTicks = makeTicks(maxLeft);
  const rightTicks = makeTicks(maxRight);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 flex items-center gap-2 pb-2 border-b-[3px]" style={{ borderColor: cc.amber }}>
          <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: cc.amber }}>
            Departments
          </span>
          <span className="text-xs text-gray-500">(people assigned)</span>
        </div>
        <div className="flex-1 flex items-center justify-end gap-2 pb-2 border-b-[3px]" style={{ borderColor: cc.teal }}>
          <span className="text-xs text-gray-500">(served vs not served)</span>
          <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: cc.teal }}>
            Attendance
          </span>
        </div>
      </div>

      <div className={scroll ? 'space-y-3 max-h-[55vh] overflow-y-auto pr-1' : 'space-y-3'}>
        {rows.map(row => {
          const notServed = Math.max(0, row.staff - row.served);
          const servedPct = row.staff > 0 ? (row.served / row.staff) * 100 : 0;
          const notServedPct = row.staff > 0 ? (notServed / row.staff) * 100 : 0;
          return (
            <div
              key={row.name}
              className="flex items-center py-0.5 hover:bg-gray-50 transition-colors"
              title={`${row.name}: ${row.staff} assigned · ${row.served} served · ${notServed} not served`}
            >
              <div className="flex-1 flex items-center gap-2.5 min-w-0">
                <span className="w-40 sm:w-48 flex-shrink-0 text-right text-[13px] font-medium text-gray-700 truncate">
                  {row.name} <span className="text-gray-400 font-normal">({row.staff})</span>
                </span>
                <div className="flex-1 h-6 bg-gray-100/80 flex justify-end overflow-hidden">
                  <div
                    className="h-full shadow-sm-disabled transition-all duration-500"
                    style={{
                      width: `${(row.staff / maxLeft) * 100}%`,
                      minWidth: row.staff > 0 ? 4 : 0,
                      backgroundColor: cc.amber,
                      backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.08), rgba(255,255,255,0.28))',
                    }}
                  ></div>
                </div>
              </div>

              <div
                className="w-[3px] self-stretch mx-1 flex-shrink-0"
                style={{ background: `linear-gradient(to bottom, ${cc.amber}, ${cc.teal})` }}
              ></div>

              <div className="flex-1 flex items-center gap-2.5 min-w-0">
                <div className="flex-1 h-6 bg-gray-100/80 flex justify-start overflow-hidden">
                  <div className="flex h-full w-full">
                    {notServed > 0 && (
                      <div
                        className="h-full shadow-sm-disabled transition-all duration-500"
                        style={{
                          width: `${(notServed / maxLeft) * 100}%`,
                          minWidth: notServed > 0 ? 2 : 0,
                          backgroundColor: cc.red,
                          backgroundImage: 'linear-gradient(to left, rgba(0,0,0,0.08), rgba(255,255,255,0.25))',
                        }}
                      ></div>
                    )}
                    {row.served > 0 && (
                      <div
                        className="h-full shadow-sm-disabled transition-all duration-500"
                        style={{
                          width: `${(row.served / maxLeft) * 100}%`,
                          minWidth: row.served > 0 ? 2 : 0,
                          backgroundColor: cc.teal,
                          backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.08), rgba(255,255,255,0.25))',
                        }}
                      ></div>
                    )}
                  </div>
                </div>
                <span
                  className="w-40 sm:w-48 flex-shrink-0 text-[13px] font-medium text-gray-700 truncate"
                  title={`${row.served} served · ${notServed} not served`}
                >
                  <span style={{ color: cc.teal }}>{row.served}</span>
                  <span className="text-gray-300 mx-1">/</span>
                  <span style={{ color: cc.red }}>{notServed}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scale row aligned with bar areas */}
      <div className="flex items-start mt-2">
        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <span className="w-40 sm:w-48 flex-shrink-0"></span>
          <div className="flex-1 relative px-1" style={{ height: 24 }}>
            <div className="absolute inset-x-1 top-0 h-px bg-gray-900"></div>
            {leftTicks.map((tick) => {
              const pct = maxLeft > 0 ? ((maxLeft - tick) / maxLeft) * 100 : 0;
              return (
                <div key={tick} className="absolute top-0 flex flex-col items-center" style={{ left: `calc(${pct}% + 4px)`, transform: 'translateX(-50%)' }}>
                  <div className="w-px h-2 bg-gray-900"></div>
                  <span className="mt-0.5 text-[11px] font-bold text-gray-900">{tick}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="w-[3px] mx-1 flex-shrink-0"></div>
        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <div className="flex-1 relative px-1" style={{ height: 24 }}>
            <div className="absolute inset-x-1 top-0 h-px bg-gray-900"></div>
            {rightTicks.map((tick) => {
              const pct = maxRight > 0 ? (tick / maxRight) * 100 : 0;
              return (
                <div key={tick} className="absolute top-0 flex flex-col items-center" style={{ left: `calc(${pct}% + 4px)`, transform: 'translateX(-50%)' }}>
                  <div className="w-px h-2 bg-gray-900"></div>
                  <span className="mt-0.5 text-[11px] font-bold text-gray-900">{tick}</span>
                </div>
              );
            })}
          </div>
          <span className="w-40 sm:w-48 flex-shrink-0"></span>
        </div>
      </div>
    </div>
  );
};

const Overview: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();

  // CHART COLORS: all charts read from CC — first palette = mayor, second = admin; change a hex to recolor everywhere
  const isMayor = (user?.role || '').toLowerCase().includes('mayor');
  const CC = useMemo(
    () =>
      isMayor
        ? {
            blue: '#34A8DB',
            teal: '#4CAF50',
            amber: '#F39C12',
            purple: '#2980B9',
            red: '#E53935',
            blueSoft: 'rgba(52,168,219,0.05)',
            tealSoft: 'rgba(76,175,80,0.05)',
            amberSoft: 'rgba(243,156,18,0.05)',
          }
        : {
            blue: '#2563EB',
            teal: '#0D9488',
            amber: '#EAB308',
            purple: '#9333EA',
            red: '#DC2626',
            blueSoft: 'rgba(37,99,235,0.05)',
            tealSoft: 'rgba(13,148,136,0.05)',
            amberSoft: 'rgba(234,179,8,0.05)',
          },
    [isMayor]
  );
  
  const [loading, setLoading] = useState(true);
  const [firstTimeLoading, seTfirstTimeLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  // Parking card: lot-map data + which view is shown ('chart' occupancy donut is the default,
  // 'map' is the slot map opened via View map, 'trends' is the old area chart)
  const [parkingView, setParkingView] = useState<'chart' | 'map' | 'trends'>('chart');
  const [parkingLot, setParkingLot] = useState<{ totalSlots: number; vehicles: any[]; reservations: any[] }>({ totalSlots: 0, vehicles: [], reservations: [] });

  // Served aggregates come pre-computed from /statistics/served (same pattern as
  // the receptionist dashboard); the employee list loads only when its modal opens
  const [servedStats, setServedStats] = useState<ServedStats | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [period, setPeriod] = useState<'today' | 'week' | 'lastweek' | 'month' | 'lastmonth' | 'all' | 'range'>('month');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  // Toolbar selections are drafts; they only hit the live filter when Apply is clicked
  const [draftPeriod, setDraftPeriod] = useState<typeof period>('month');
  const [draftRangeFrom, setDraftRangeFrom] = useState('');
  const [draftRangeTo, setDraftRangeTo] = useState('');
  const applyToolbarPeriod = () => { setPeriod(draftPeriod); setRangeFrom(draftRangeFrom); setRangeTo(draftRangeTo); };

  // Period filter: today / this week / last week / this month / last month /
  // all records / custom from→to range (inclusive). Weeks run Monday → Sunday.
  // isDateInPeriod takes the period explicitly so the toolbar filter and the
  // hourly modal's own filter can share the same logic.
  type PeriodChoice = 'today' | 'week' | 'lastweek' | 'month' | 'lastmonth' | 'all' | 'range';
  const isDateInPeriod = useCallback((dateStr: string | undefined, p: PeriodChoice) => {
    if (p === 'all') return true;
    if (!dateStr) return false;
    const t = new Date(dateStr);
    if (isNaN(t.getTime())) return false;
    const now = new Date();
    if (p === 'today') return t.toDateString() === now.toDateString();
    if (p === 'week' || p === 'lastweek') {
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      if (p === 'week') return t >= monday;
      const lastMonday = new Date(monday);
      lastMonday.setDate(monday.getDate() - 7);
      return t >= lastMonday && t < monday;
    }
    if (p === 'month') return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth();
    if (p === 'lastmonth') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return t.getFullYear() === lm.getFullYear() && t.getMonth() === lm.getMonth();
    }
    if (!rangeFrom && !rangeTo) return true;
    if (rangeFrom && t < new Date(rangeFrom)) return false;
    if (rangeTo) {
      const end = new Date(rangeTo);
      end.setHours(23, 59, 59, 999);
      if (t > end) return false;
    }
    return true;
  }, [rangeFrom, rangeTo]);
  const isInPeriod = useCallback((dateStr?: string) => isDateInPeriod(dateStr, period), [isDateInPeriod, period]);

  // Period → from/to ISO params for the served-stats endpoint (same semantics as isDateInPeriod)
  const periodToRange = useCallback((p: PeriodChoice): { from?: string; to?: string } => {
    const now = new Date();
    const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    if (p === 'all') return {};
    if (p === 'today') return { from: startOfDay(now).toISOString(), to: now.toISOString() };
    if (p === 'week' || p === 'lastweek') {
      const monday = startOfDay(now);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      if (p === 'week') return { from: monday.toISOString(), to: now.toISOString() };
      const lastMonday = new Date(monday);
      lastMonday.setDate(monday.getDate() - 7);
      return { from: lastMonday.toISOString(), to: new Date(monday.getTime() - 1).toISOString() };
    }
    if (p === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: now.toISOString() };
    if (p === 'lastmonth') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from: first.toISOString(), to: last.toISOString() };
    }
    const r: { from?: string; to?: string } = {};
    if (rangeFrom) r.from = startOfDay(new Date(rangeFrom)).toISOString();
    if (rangeTo) { const end = new Date(rangeTo); end.setHours(23, 59, 59, 999); r.to = end.toISOString(); }
    return r;
  }, [rangeFrom, rangeTo]);

  // Backend-aggregated served stats, refetched when the toolbar period changes
  const fetchServedStats = useCallback(async (p: PeriodChoice) => {
    try {
      const { from, to } = periodToRange(p);
      const res: any = await statisticsService.getServedStats(from, to);
      if (res?.success) setServedStats(res.data);
    } catch { /* keep the previous stats on a failed refresh */ }
  }, [periodToRange]);

  useEffect(() => { fetchServedStats(period); }, [fetchServedStats, period]);

  // Socket refreshes call this ref so fetchData doesn't need period in its deps
  const servedRefreshRef = useRef<() => void>(() => {});

  // Distinct visitors whose entry date falls in the selected period — shown beside the chart
  const totalVisitorsInPeriod = servedStats?.total_visitors || 0;

  // Real request statistics from /requests/statistics: per-orientation (incoming)
  // and per-assignee status counts, aggregated server-side for the toolbar period
  interface RequestStatRow { name: string; pending: number; inprogress: number; completed: number; overdue: number; archived: number; total: number }
  const [requestStats, setRequestStats] = useState<{ by_orientation: RequestStatRow[]; by_assignee: RequestStatRow[] } | null>(null);
  const fetchRequestStats = useCallback(async (p: PeriodChoice) => {
    try {
      const { from, to } = periodToRange(p);
      const res: any = await requestService.getStatistics(from ? { period: 'range', from, to } : undefined);
      if (res?.success && res.data) {
        setRequestStats({
          by_orientation: res.data.by_orientation || [],
          by_assignee: res.data.by_assignee || [],
        });
      }
    } catch { /* keep the previous stats on a failed refresh */ }
  }, [periodToRange]);

  useEffect(() => { fetchRequestStats(period); }, [fetchRequestStats, period]);

  // Feedback sentiment (departments + general/unserviced) aggregated server-side
  // for the toolbar period — drives the Department Sentiment chart
  interface SentimentStatRow { name: string; average_rating: number; count: number; positive: number; neutral: number; negative: number }
  const [feedbackSentiment, setFeedbackSentiment] = useState<{ departments: SentimentStatRow[]; general: Omit<SentimentStatRow, 'name'> } | null>(null);
  const fetchFeedbackSentiment = useCallback(async (p: PeriodChoice) => {
    try {
      const { from, to } = periodToRange(p);
      const res: any = await statisticsService.getFeedbackSentiment(from, to);
      if (res?.success && res.data) setFeedbackSentiment(res.data);
    } catch { /* keep the previous stats on a failed refresh */ }
  }, [periodToRange]);

  useEffect(() => { fetchFeedbackSentiment(period); }, [fetchFeedbackSentiment, period]);

  // Served + request + sentiment aggregates refresh together on socket-triggered refetches
  useEffect(() => {
    servedRefreshRef.current = () => { fetchServedStats(period); fetchRequestStats(period); fetchFeedbackSentiment(period); };
  }, [fetchServedStats, fetchRequestStats, fetchFeedbackSentiment, period]);

  const requestStatuses = useMemo(() => {
    const toRows = (rows: RequestStatRow[]) =>
      rows.slice(0, 8).map(r => ({
        name: r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name,
        fullName: r.name,
        pending: r.pending,
        inprogress: r.inprogress,
        completed: r.completed,
        overdue: r.overdue,
        archived: r.archived || 0,
        total: r.total,
      }));
    const departments = toRows(requestStats?.by_orientation || []);
    const total = (requestStats?.by_orientation || []).reduce((s, r) => s + r.total, 0);
    const deptCount = (requestStats?.by_orientation || []).length;
    return {
      departments,
      employees: toRows(requestStats?.by_assignee || []),
      total,
      avgPerDept: deptCount ? Math.round((total / deptCount) * 10) / 10 : 0,
      isSample: false,
    };
  }, [requestStats]);

  const labelForPeriod = useCallback((p: PeriodChoice) =>
    p === 'today' ? 'today'
    : p === 'week' ? 'this week'
    : p === 'lastweek' ? 'last week'
    : p === 'month' ? 'this month'
    : p === 'lastmonth' ? 'last month'
    : p === 'all' ? 'all time'
    : `${rangeFrom || 'start'} → ${rangeTo || 'now'}`, [rangeFrom, rangeTo]);
  const periodLabel = labelForPeriod(period);

  // Every employee with the number of people they served in the selected period —
  // aggregated server-side by /statistics/served (includes zero-served employees
  // and providers on records that don't match an employee account)
  const employeeServed = useMemo(
    () =>
      (servedStats?.by_employee || []).map(e => ({
        name: e.name,
        department: e.department || '—',
        served: e.served,
        visitors: e.visitors || [],
      })),
    [servedStats]
  );

  // Departments vs services mirrored chart: staff assigned (left) against
  // served vs not served (right), busiest departments first.
  // Returns every department; the card shows the top rows.
  const deptVsServices = useMemo(() => {
    if (!data) return [] as Array<{ name: string; staff: number; served: number; notServed: number }>;
    const staffByDept: Record<string, number> = {};
    data.departments.forEach(d => { staffByDept[d.name] = d.staff; });
    const norm = (s: string) => s.trim().toLowerCase();
    const servedByDept: Record<string, number> = {};
    (servedStats?.by_department || []).forEach(d => {
      servedByDept[d.name] = d.served;
    });
    const names = Array.from(new Set([...data.departments.map(d => d.name), ...Object.keys(servedByDept)]));
    return names
      .map(name => {
        const staff = staffByDept[name] || 0;
        const served = servedByDept[name] || 0;
        const notServed = Math.max(0, staff - served);
        return { name, staff, served, notServed };
      })
      .sort((a, b) => b.staff - a.staff);
  }, [data, servedStats]);
  const maxEmployeeServed = Math.max(...employeeServed.map(e => e.served), 1);
  // Mean load among employees who served at least one person; anyone above
  // 1.5× this is highlighted as overloaded in the workload chart
  const avgEmployeeLoad = useMemo(() => {
    const active = employeeServed.filter(e => e.served > 0);
    return active.length ? active.reduce((sum, e) => sum + e.served, 0) / active.length : 0;
  }, [employeeServed]);
  // Expanded employee row (shows the visitors they served) in the employees detail modal
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  // Sentiment + period filters inside the ratings & sentiment analysis modal.
  // The period select and its custom-range dates are drafts committed on Apply;
  // the range dates are the modal's own, independent of the toolbar range.
  const [sentimentFilter, setSentimentFilter] = useState<'all' | Sentiment>('all');
  const [ratingPeriod, setRatingPeriod] = useState<PeriodChoice>('all');
  const [ratingRangeFrom, setRatingRangeFrom] = useState('');
  const [ratingRangeTo, setRatingRangeTo] = useState('');
  const [draftRatingPeriod, setDraftRatingPeriod] = useState<PeriodChoice>('all');
  const [draftRatingRangeFrom, setDraftRatingRangeFrom] = useState('');
  const [draftRatingRangeTo, setDraftRatingRangeTo] = useState('');
  const applyRatingPeriod = () => { setRatingPeriod(draftRatingPeriod); setRatingRangeFrom(draftRatingRangeFrom); setRatingRangeTo(draftRatingRangeTo); };
  const resetRatingFilters = () => {
    setSentimentFilter('all');
    setRatingPeriod('all'); setRatingRangeFrom(''); setRatingRangeTo('');
    setDraftRatingPeriod('all'); setDraftRatingRangeFrom(''); setDraftRatingRangeTo('');
  };

  // Filter inside the employee account status modal; statuses use the same
  // fields as the stats endpoint: is_active and access_control.is_locked
  const [empStatusFilter, setEmpStatusFilter] = useState<'all' | 'active' | 'inactive' | 'locked' | 'online' | 'offline'>('all');
  const empStatusFiltered = useMemo(
    () =>
      employees.filter((e: any) =>
        empStatusFilter === 'all' ? true
        : empStatusFilter === 'locked' ? !!e.access_control?.is_locked
        : empStatusFilter === 'active' ? !!e.is_account_activated
        : empStatusFilter === 'online' ? !!e.is_active
        : empStatusFilter === 'offline' ? !e.is_active
        : !e.is_account_activated
      ),
    [employees, empStatusFilter]
  );

  // Average rating per department (out of 10) with feedback counts, best first —
  // mirrors the departmentData memo on the feedback-analysis page
  const deptRatings = useMemo(() => {
    if (!data) return [] as Array<{ name: string; rating: number; count: number }>;
    return Object.entries(data.feedbackAvg.by_department)
      .map(([name, v]) => ({
        name: name.length > 18 ? name.slice(0, 17) + '…' : name,
        rating: Math.round(((v?.average_rating || 0)) * 10) / 10,
        count: Number(data.feedbackTotals.by_department[name]) || 0,
      }))
      .filter(d => d.count > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 8);
  }, [data]);

  // Departments climbing from worst to best rating (negative sentiment on the left),
  // built from the period-aware sentiment endpoint, with one General (unserviced)
  // feedback bar appended after the department bars. Falls back to the all-time
  // department averages until the sentiment stats arrive.
  // barRating draws the plain department bars; the seg* keys stack into the General
  // bar's horizontal bands (negative → neutral → positive), each sized by that
  // category's share of the feedback while the total height stays the avg rating
  interface SentimentTrendRow { name: string; rating: number; count: number; fullName?: string; positive?: number; neutral?: number; negative?: number; isGeneral?: boolean; barRating?: number; segNegative?: number; segNeutral?: number; segPositive?: number }
  const sentimentTrend = useMemo<SentimentTrendRow[]>(() => {
    if (!feedbackSentiment) return [...deptRatings].sort((a, b) => a.rating - b.rating).map(d => ({ ...d, barRating: d.rating }));
    const rows: SentimentTrendRow[] = (feedbackSentiment.departments || [])
      .filter(d => d.count > 0)
      .map(d => ({
        name: d.name.length > 18 ? d.name.slice(0, 17) + '…' : d.name,
        fullName: d.name,
        rating: Math.round((d.average_rating || 0) * 10) / 10,
        count: d.count,
        positive: d.positive,
        neutral: d.neutral,
        negative: d.negative,
        barRating: Math.round((d.average_rating || 0) * 10) / 10,
        segNegative: 0,
        segNeutral: 0,
        segPositive: 0,
      }))
      .sort((a, b) => a.rating - b.rating)
      .slice(0, 8);
    const g = feedbackSentiment.general;
    if (g && g.count > 0) {
      const gRating = Math.round((g.average_rating || 0) * 10) / 10;
      rows.push({
        name: 'General',
        fullName: 'General feedback',
        rating: gRating,
        count: g.count,
        positive: g.positive,
        neutral: g.neutral,
        negative: g.negative,
        isGeneral: true,
        barRating: 0,
        segNegative: gRating * (g.negative / g.count),
        segNeutral: gRating * (g.neutral / g.count),
        segPositive: gRating * (g.positive / g.count),
      });
    }
    return rows;
  }, [feedbackSentiment, deptRatings]);

  // Empty-state flags so cards show a message instead of a blank chart
  const hasHourlyParking = !!data && data.hourlyParking.some(h => (h.check_in || 0) > 0 || (h.check_out || 0) > 0);

  // Check-ins per local hour come pre-counted from /statistics/served for the
  // selected period. The dial is dynamic: an 11-hour window that slides with the
  // clock (8 hours back, 2 ahead), plus any hour in the period with activity.
  const buildDial = useCallback((hourly: Array<{ hour: number; count: number }>) => {
    const counts: Record<number, number> = {};
    hourly.forEach(h => { if (h.count > 0) counts[h.hour] = h.count; });
    const now = new Date();
    let start = now.getHours() - 8;
    let end = now.getHours() + 2;
    if (start < 0) { end -= start; start = 0; }
    if (end > 23) { start = Math.max(0, start - (end - 23)); end = 23; }
    const hours = new Set<number>();
    for (let h = start; h <= end; h++) hours.add(h);
    Object.keys(counts).forEach(h => hours.add(parseInt(h)));
    return Array.from(hours)
      .sort((a, b) => a - b)
      .map(hour => ({ hour, count: counts[hour] || 0 }));
  }, []);
  const gaugeHours = useMemo(() => buildDial(servedStats?.hourly || []), [buildDial, servedStats]);
  const hasGaugeData = gaugeHours.some(g => g.count > 0);
  // Hour of the chronologically newest check-in in the period — drives the gauge needle
  const lastCheckinHour = useMemo(() => {
    if (!servedStats?.last_checkin) return null;
    const t = new Date(servedStats.last_checkin);
    return isNaN(t.getTime()) ? null : t.getHours();
  }, [servedStats]);

  // Parking gauge: today's VEHICLE check-ins per hour (same sliding dial window: 8h back, 2h ahead + active hours)
  const parkingGaugeHours = useMemo(() => {
    const counts: Record<number, number> = {};
    (data?.hourlyParking || []).forEach(h => { if ((h.check_in || 0) > 0) counts[h.hour] = h.check_in; });
    const now = new Date();
    let start = now.getHours() - 8;
    let end = now.getHours() + 2;
    if (start < 0) { end -= start; start = 0; }
    if (end > 23) { start = Math.max(0, start - (end - 23)); end = 23; }
    const hours = new Set<number>();
    for (let h = start; h <= end; h++) hours.add(h);
    Object.keys(counts).forEach(h => hours.add(parseInt(h, 10)));
    return Array.from(hours).sort((a, b) => a - b).map(hour => ({ hour, count: counts[hour] || 0 }));
  }, [data]);
  const hasParkingGauge = parkingGaugeHours.some(g => g.count > 0);
  // Data is today-only, so the last non-empty hour IS the hour of the last vehicle check-in
  const lastParkingHour = useMemo(() => {
    const nonEmpty = parkingGaugeHours.filter(g => g.count > 0);
    return nonEmpty.length ? nonEmpty[nonEmpty.length - 1].hour : null;
  }, [parkingGaugeHours]);

  // The hourly detail modal has its own period filter; null means it follows
  // the toolbar filter (it resets to that each time the modal opens). A period
  // different from the toolbar's triggers its own served-stats fetch.
  const [modalHourPeriod, setModalHourPeriod] = useState<PeriodChoice | null>(null);
  // Draft for the hourly modal's period select — committed on Apply
  const [draftModalHourPeriod, setDraftModalHourPeriod] = useState<PeriodChoice | null>(null);
  const modalHourPeriodEff: PeriodChoice = modalHourPeriod ?? period;
  const [modalServedHourly, setModalServedHourly] = useState<Array<{ hour: number; count: number }> | null>(null);
  useEffect(() => {
    if (modalHourPeriod === null || modalHourPeriod === period) { setModalServedHourly(null); return; }
    let ignore = false;
    (async () => {
      try {
        const { from, to } = periodToRange(modalHourPeriod);
        const res: any = await statisticsService.getServedStats(from, to);
        if (!ignore && res?.success) setModalServedHourly(res.data?.hourly || []);
      } catch { /* the modal falls back to the toolbar-period hours */ }
    })();
    return () => { ignore = true; };
  }, [modalHourPeriod, period, periodToRange]);
  const modalHours = useMemo(
    () => buildDial(modalServedHourly ?? (servedStats?.hourly || [])),
    [buildDial, modalServedHourly, servedStats]
  );

  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  // The employee list is only needed by the status modal's table — fetched
  // 50 per page (receptionist pattern) whenever that modal is open
  const EMP_STATUS_PAGE_SIZE = 50;
  const [empStatusPage, setEmpStatusPage] = useState(1);
  const [empStatusTotal, setEmpStatusTotal] = useState(0);
  useEffect(() => {
    if (selectedCard !== 'employee-status') return;
    let ignore = false;
    (async () => {
      try {
        const res: any = await employeeService.getAll(empStatusPage, EMP_STATUS_PAGE_SIZE);
        if (!ignore && (res?.status || res?.success)) {
          setEmployees(Array.isArray(res.data) ? res.data : []);
          setEmpStatusTotal(res.total || 0);
        }
      } catch { /* the modal shows its empty state */ }
    })();
    return () => { ignore = true; };
  }, [selectedCard, empStatusPage]);
  const [showAllDepartments, setShowAllDepartments] = useState(false);
  const [departmentPage, setDepartmentPage] = useState(1);
  const departmentLimit = 5;

  // Pagination states for modals
  const [modalData, setModalData] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalPagination, setModalPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 10
  });

  // Ratings-analysis rows narrowed to the modal's period first, then the selected
  // sentiment; the sentiment chips count from the period-filtered set so their
  // numbers follow the period dropdown. Custom range uses the modal's own dates.
  const periodRatings = useMemo(
    () => modalData.filter((f: any) => {
      if (ratingPeriod !== 'range') return isDateInPeriod(f?.created_date, ratingPeriod);
      if (!f?.created_date) return false;
      const t = new Date(f.created_date);
      if (isNaN(t.getTime())) return false;
      if (ratingRangeFrom && t < new Date(ratingRangeFrom)) return false;
      if (ratingRangeTo) {
        const end = new Date(ratingRangeTo);
        end.setHours(23, 59, 59, 999);
        if (t > end) return false;
      }
      return true;
    }),
    [modalData, isDateInPeriod, ratingPeriod, ratingRangeFrom, ratingRangeTo]
  );
  const filteredRatings = useMemo(
    () => periodRatings.filter((f: any) => sentimentFilter === 'all' || classifySentiment(f.rate, f.rate_out_of) === sentimentFilter),
    [periodRatings, sentimentFilter]
  );
  
  const chartsRef = useRef<Map<string, Chart>>(new Map());
  const [isFetching, setIsFetching] = useState(true);

   // Fetch real data; silent mode refreshes in the background (socket updates)
  // without tearing the page down to the loading spinner
  const fetchData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      setIsFetching(true)
      const [
        employeesRes, servicesRes, flaggedStatsRes,
        feedbackTotalsRes, feedbackAvgRes, hourlyParkingRes, hourlyServiceRes, departmentsRes,
        slotConfigRes, activeVehiclesRes, reservationsRes
      ] = await Promise.all([
        statisticsService.getEmployeeStats(),
        statisticsService.getServiceDeliveryStats(),
        statisticsService.getFlaggedVehiclesStats(),
        statisticsService.getFeedbackTotals(),
        statisticsService.getFeedbackAverageByDepartment(),
        statisticsService.getHourlyParkingStats(),
        statisticsService.getHourlyServiceDeliveryStats(),
        statisticsService.getDepartmentsWithLeaders(),
        statisticsService.getParkingSlots().catch(() => null), // Slot totals for the parking lot map
        parkingService.getAllPaginated(1, 200, 'active').catch(() => null), // Every parked vehicle (lot holds 200 slots) so map slot colors stay accurate
        reservationService.getAll().catch(() => null), // Reservations (plates) for the map
        seTfirstTimeLoading(false)
      ]);

      // Served/workload aggregates refresh alongside the stats (period-aware)
      servedRefreshRef.current();

      const employees = (employeesRes as any)?.data || employeesRes;
      const services = (servicesRes as any)?.data || servicesRes;
      const flaggedStats = (flaggedStatsRes as any)?.data || flaggedStatsRes;
      const feedbackTotals = (feedbackTotalsRes as any)?.data || feedbackTotalsRes;
      const feedbackAvg = (feedbackAvgRes as any)?.data || feedbackAvgRes;
      const hourlyParkingRaw = (hourlyParkingRes as any)?.data?.hourly || (hourlyParkingRes as any) || [];
      const hourlyServiceRaw = (hourlyServiceRes as any)?.data?.hourly || (hourlyServiceRes as any) || [];
      const departmentsRaw = (departmentsRes as any)?.data?.departments || (departmentsRes as any)?.departments || [];

      // Parking lot map: slot totals + currently parked vehicles + active reservations
      const slotCfg = (slotConfigRes as any)?.data?.available_slots || slotConfigRes || {};
      
      const activeVehiclesRaw = (activeVehiclesRes as any)?.data || [];
      const reservationsRaw = (reservationsRes as any)?.reservations || [];
      setParkingLot({
        totalSlots: Number(slotCfg?.totalSlots) || 200,
        vehicles: Array.isArray(activeVehiclesRaw) ? activeVehiclesRaw : [],
        reservations: (Array.isArray(reservationsRaw) ? reservationsRaw : []).filter((r: any) => r?.status === 'active'),
      });

      const departments = departmentsRaw.map((dept: any) => ({
        name: dept.department_name,
        leader: dept.department_leader?.full_name || 'Not assigned',
        staff: dept.total_employees,
        rating: Math.round((feedbackAvg?.by_department?.[dept.department_name]?.average_rating || 0)),
        feedback: feedbackTotals?.by_department?.[dept.department_name] || 0,
      }));
      
      setData({
        employeeStats: {
          total: employees?.total || 0,
          // is_active only tracks who is online right now; account status
          // comes from is_account_activated (activated / not_activated)
          active: employees?.activated || 0,
          inactive: employees?.not_activated || 0,
          locked: employees?.locked || 0,
          online: employees?.active || 0,
          offline: employees?.inactive || 0,
        },
        serviceStats: {
          total: services?.total || 0,
          completed: services?.completed || 0,
          inhouse: services?.inhouse || 0,
          // Prefer the all-services breakdown; by_department only counts in-house visitors
          by_department: services?.by_department_total || services?.by_department || {},
        },
        flaggedVehicles: {
          currently_flagged: {
            // The stats endpoint already counts flagged vehicles server-side
            count: flaggedStats?.currently_flagged?.count || 0,
            min_minutes: flaggedStats?.currently_flagged?.min_minutes || 0,
            max_minutes: flaggedStats?.currently_flagged?.max_minutes || 0
          },
          history: flaggedStats?.history || { count: 0, min_minutes: 0, max_minutes: 0 },
        },
        feedbackTotals: {
          total: feedbackTotals?.total || 0,
          by_department: feedbackTotals?.by_department || {},
        },
        feedbackAvg: {
          overall_average: feedbackAvg?.overall_average || { average_rating: 0 },
          by_department: feedbackAvg?.by_department || {},
        },
        hourlyParking: Array.isArray(hourlyParkingRaw) ? hourlyParkingRaw : [],
        hourlyService: Array.isArray(hourlyServiceRaw) ? hourlyServiceRaw : [],
        departments,
      });
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
      showError('Failed to load dashboard data');
    } finally {
      setLoading(false);
      seTfirstTimeLoading(false)
       setIsFetching(false)
    }
  }, [showError]);
  
  // Create all charts with whole number Y-axis
  const createCharts = useCallback(() => {
    if (!data) return;
    
    // Destroy existing charts
    chartsRef.current.forEach(chart => chart.destroy());
    chartsRef.current.clear();
    
    // CHART 9 · "Employee account status" is now the StatusPie3D SVG component rendered directly in the JSX (search: StatusPie3D)

  }, [data, CC]);
  
  // Initial fetch and chart creation
  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, fetchData]);
  
  useEffect(() => {
    if (data && !loading) {
      const timer = setTimeout(createCharts, 100);
      return () => clearTimeout(timer);
    }
  }, [data, loading, createCharts]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => chartsRef.current.forEach(chart => chart.resize());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login');
  }, [isAuthenticated, authLoading, navigate]);

  // Live updates: refetch silently (debounced) on every event the backend
  // broadcasts that affects this dashboard's numbers
  const { socket, isConnected } = useSocket();
  useEffect(() => {
    if (!socket || !isConnected) return;
    const events = [
      'car_checkedin', 'car_checkedout', 'parking_alert',
      'visitor_checkedin', 'visitor_checkedout',
      'new_visitor_assigned', 'leave_return',
      'service_status_updated', 'feedback_submitted',
    ];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      // Debounce: bursts of events (e.g. assign + status change) trigger one refetch
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fetchData({ silent: true }), 800);
    };
    events.forEach(ev => socket.on(ev, handler));
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(ev => socket.off(ev, handler));
    };
  }, [socket, isConnected, fetchData]);

  

useEffect(() => {
  
  const intervalId = setInterval(() => {

    if(isFetching) {
      console.log("Already fetching");
      return;
    }
    fetchData({silent: true});
   
    console.log("Data refreshed"); 
  }, 5000);

  return () => clearInterval(intervalId);
}, [isFetching,fetchData]);

  // Fetch paginated data for modals
  const fetchModalData = useCallback(async (cardType: string, page: number = 1, limit: number = 8) => {
    setModalLoading(true);
    try {
      let response: any;
      console.log(`Fetching ${cardType} data for page ${page}, limit ${limit}`);

      switch (cardType) {
        case 'employees':
          // For employees, get detailed list with pagination
          response = await employeeService.getAll(page, limit);
          console.log('Employee response:', response);
          if (response && response.success && response.data) {
            setModalData(response.data);
            setModalPagination({
              currentPage: response.page || page,
              totalPages: Math.ceil((response.total || 0) / limit),
              totalItems: response.total || 0,
              limit
            });
          } else {
            setModalData([]);
            setModalPagination({ currentPage: page, totalPages: 1, totalItems: 0, limit });
          }
          break;

        case 'parking':
          // For parking modal, show only active records
          response = await parkingService.getAllPaginated(page, limit, 'active');
          console.log('Parking response:', response);
          if (response && response.success && response.data) {
            setModalData(response.data);
            setModalPagination({
              currentPage: page,
              totalPages: Math.ceil((response.total || 0) / limit),
              totalItems: response.total || 0,
              limit
            });
          } else {
            setModalData([]);
            setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
          }
          break;

        case 'services':
          // Show all visitors (not just in-house) to match KPI total
          response = await serviceDeliveryService.getAll(page, limit);
          console.log('Services response:', response);
          if (response && response.success && response.data) {
            setModalData(response.data);
            setModalPagination({
              currentPage: page,
              totalPages: Math.ceil((response.total || 0) / limit),
              totalItems: response.total || 0,
              limit
            });
          } else {
            setModalData([]);
            setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
          }
          break;

        case 'flagged':
          response = await parkingService.getFlaggedActiveVehicles(page, limit);
          console.log('Flagged response:', response);
          if (response && response.success && response.data) {
            setModalData(response.data);
            setModalPagination({
              currentPage: page,
              totalPages: Math.ceil((response.total || 0) / limit),
              totalItems: response.total || 0,
              limit
            });
          } else {
            setModalData([]);
            setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
          }
          break;

        case 'services-detail':
          // Services by department detailed view
          response = await statisticsService.getServiceDeliveryStats();
          console.log('Services detail response:', response);
          if (response && response.success && response.data) {
            // Transform department data for display (all services, not just in-house)
            const deptData = Object.entries(response.data.by_department_total || response.data.by_department || {}).map(([dept, count]) => ({
              department: dept,
              count: count as number
            }));
            setModalData(deptData);
            setModalPagination({ currentPage: 1, totalPages: 1, totalItems: deptData.length, limit });
          } else {
            setModalData([]);
            setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
          }
          break;

        case 'employees-detail':
          // Employees by department detailed view
          response = await statisticsService.getDepartmentsWithLeaders();
          console.log('Employees detail response:', response);
          if (response && response.success && response.data && response.data.departments) {
            setModalData(response.data.departments);
            setModalPagination({ currentPage: 1, totalPages: 1, totalItems: response.data.departments.length, limit });
          } else {
            setModalData([]);
            setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
          }
          break;

        case 'rating-analysis':
          // Pull a large page of raw feedback so sentiment can be classified per item
          response = await feedbackService.getAll(1, 100);
          //console.log('Rating analysis response:', response);
          if (response && (response as any).success && (response as any).data) {
            setModalData((response as any).data);
            setModalPagination({
              currentPage: 1,
              totalPages: 1,
              totalItems: (response as any).total || (response as any).data.length,
              limit: 100
            });
          } else {
            setModalData([]);
            setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
          }
          break;

        case 'service-hourly':
          response = await statisticsService.getHourlyServiceDeliveryStats();
          console.log('Service hourly response:', response);
          if (response && (response as any).success && (response as any).data) {
            setModalData((response as any).data.hourly || []);
            setModalPagination({ currentPage: 1, totalPages: 1, totalItems: ((response as any).data.hourly || []).length, limit });
          } else {
            setModalData([]);
            setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
          }
          break;

        default:
          setModalData([]);
          setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
      }
    } catch (error) {
      console.error('Error fetching modal data:', error);
      setModalData([]);
      setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
    } finally {
      setModalLoading(false);
      seTfirstTimeLoading(false)
    }
  }, []);

  // Handle card click to open modal with data
  const handleCardClick = useCallback((cardType: string) => {
    setSelectedCard(cardType);
    fetchModalData(cardType);
  }, [fetchModalData]);

  // Handle modal close and cleanup charts
  const handleModalClose = useCallback(() => {
    // Destroy modal-specific charts
    const chartsToDestroy = ['modal-service-hourly', 'modal-services-detail'];
    chartsToDestroy.forEach(chartId => {
      const chart = chartsRef.current.get(chartId);
      if (chart) {
        chart.destroy();
        chartsRef.current.delete(chartId);
      }
    });
    setSelectedCard(null);
  }, []);

  // POPUP CHARTS A & B (inside modals) — configured below; height on the container divs in modal JSX
  useEffect(() => {
    if (selectedCard === 'services-detail' && modalData.length > 0) {
      const createServicesChart = () => {
        const modalCanvas = document.getElementById('modal-services-detail-chart') as HTMLCanvasElement;
        if (modalCanvas) {
          // Destroy existing chart
          const existingChart = chartsRef.current.get('modal-services-detail');
          if (existingChart) {
            existingChart.destroy();
          }

          const deptNames = modalData.map((dept: any) => dept.department);
          const deptCounts = modalData.map((dept: any) => dept.count);
          const maxCount = Math.max(...deptCounts, 1);

          const newChart = new Chart(modalCanvas, {
            type: 'bar',
            data: {
              labels: deptNames,
              datasets: [{
                data: deptCounts,
                backgroundColor: CC.blue,
                borderRadius: 0,
                borderSkipped: 'start',
                maxBarThickness: 24,
                barPercentage: 0.6,
                categoryPercentage: 0.8,
                label: 'Services',
                valueLabels: 'all',
              } as any]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context: any) => {
                      const value = Math.round(context.raw);
                      return `Total services: ${value}`;
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  min: 0,
                  max: maxCount + 1,
                  grid: { color: '#e5e7eb' },
                  ticks: {
                    stepSize: Math.max(1, Math.ceil(maxCount / 5)),
                    callback: (value: any) => Math.round(Number(value)).toString(),
                    precision: 0
                  },
                  title: {
                    display: true,
                    text: 'count',
                    color: '#9ca3af',
                    font: { size: 10 }
                  }
                },
                x: {
                  grid: { display: false },
                  ticks: {
                    font: { size: 12 },
                    maxRotation: 45
                  }
                }
              }
            },
            plugins: [barValueLabels]
          });

          chartsRef.current.set('modal-services-detail', newChart);
        }
      };

      // Delay to ensure modal is fully rendered
      const timeoutId = setTimeout(createServicesChart, 300);
      return () => clearTimeout(timeoutId);
    }

    if (selectedCard === 'service-hourly' && modalHours.length > 0) {
      const createModalChart = () => {
        const modalCanvas = document.getElementById('modal-service-hourly-chart') as HTMLCanvasElement;
        if (modalCanvas) {
          // Destroy existing chart
          const existingChart = chartsRef.current.get('modal-service-hourly');
          if (existingChart) {
            existingChart.destroy();
          }

          // Same hour-of-day data as the gauge card, filtered by the modal's own period
          const formattedServiceHourLabels = modalHours.map(g => formatHourLabel(g.hour));
          const visitorData = modalHours.map(g => g.count);
          const maxVisitor = Math.max(...visitorData, 1);

          const newChart = new Chart(modalCanvas, {
            type: 'line',
            data: {
              labels: formattedServiceHourLabels,
              datasets: [{
                data: visitorData,
                borderColor: CC.teal,
                backgroundColor: CC.tealSoft,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                borderWidth: 3,
                pointBackgroundColor: CC.teal,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                label: 'Visitors'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context: any) => {
                      const value = Math.round(context.raw);
                      return `Visitors checked in: ${value}`;
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  min: 0,
                  max: Math.max(maxVisitor * 2, 10),
                  grid: { color: '#e5e7eb' },
                  ticks: {
                    stepSize: Math.max(1, Math.ceil((maxVisitor * 2) / 5)),
                    callback: (value: any) => Math.round(Number(value)).toString(),
                    precision: 0
                  },
                  title: {
                    display: true,
                    text: 'count',
                    color: '#9ca3af',
                    font: { size: 10 }
                  }
                },
                x: {
                  grid: { display: false },
                  ticks: {
                    font: { size: 12 },
                    maxRotation: 45
                  }
                }
              }
            }
          });

          chartsRef.current.set('modal-service-hourly', newChart);
        }
      };

      // Delay to ensure modal is fully rendered
      const timeoutId = setTimeout(createModalChart, 300);
      return () => {
        clearTimeout(timeoutId);
        // Clean up charts when component unmounts or selectedCard changes
        const chartsToDestroy = ['modal-service-hourly', 'modal-services-detail'];
        chartsToDestroy.forEach(chartId => {
          if (!selectedCard || !selectedCard.includes(chartId.split('-')[1])) {
            const chart = chartsRef.current.get(chartId);
            if (chart) {
              chart.destroy();
              chartsRef.current.delete(chartId);
            }
          }
        });
      };
    }
  }, [selectedCard, modalData, modalHours]);

  // Handle pagination change
  const handlePageChange = useCallback((newPage: number) => {
    if (selectedCard) {
      fetchModalData(selectedCard, newPage, modalPagination.limit);
    }
  }, [selectedCard, modalPagination.limit, fetchModalData]);

  // Computed values (rounded, no decimals)
  const avgRating = data ? Math.round(data.feedbackAvg.overall_average.average_rating) : 0;
  const maxStaff = data ? Math.max(...data.departments.map(d => d.staff), 1) : 1;
  
  // Visible data for expandable tables
  const visibleDepartments = showAllDepartments
    ? data?.departments
    : data?.departments?.slice((departmentPage - 1) * departmentLimit, departmentPage * departmentLimit);
  
  if ((loading && firstTimeLoading) || !data) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Scopes the square-corner dashboard theme (CoK design rule: no border radius) to this page only (globals.css .cok-mayor-dash) */}
      <div className="cok-mayor-dash">
      {/* CoK design-rule page header for the mayor account */}
      {/* {isMayor && (
        <div className="px-4 pt-3 pb-2">
          <h1
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: '-0.5px',
              color: '#056daa', 
              margin: 0,
            }}
          >
            Dashboard
          </h1>
        </div>
      )} */}

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-500"><path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" strokeWidth="1.2"/></svg>
          <label className="font-medium">Period</label>
          <select
            value={draftPeriod}
            onChange={e => setDraftPeriod(e.target.value as typeof period)}
            className="text-xs px-2 py-1 border border-gray-300 bg-white"
          >
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="lastweek">Last week</option>
            <option value="month">This month</option>
            <option value="lastmonth">Last month</option>
            <option value="all">All</option>
            <option value="range">Custom range</option>
          </select>
          {draftPeriod === 'range' && (
            <>
              <input
                type="date"
                value={draftRangeFrom}
                onChange={e => setDraftRangeFrom(e.target.value)}
                className="text-xs px-1.5 py-1 border border-gray-300 bg-white"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={draftRangeTo}
                onChange={e => setDraftRangeTo(e.target.value)}
                className="text-xs px-1.5 py-1 border border-gray-300 bg-white"
              />
            </>
          )}
          <button
            type="button"
            onClick={applyToolbarPeriod}
            disabled={draftPeriod === period && draftRangeFrom === rangeFrom && draftRangeTo === rangeTo}
            className="flex items-center gap-2 px-4 py-2 bg-[#056daa] text-white text-[13px] font-semibold uppercase tracking-[1px] hover:bg-[#045d94] transition-colors disabled:opacity-40 disabled:hover:bg-[#056daa] disabled:cursor-default"
            style={{ fontFamily: COK.headingFont, borderRadius: 0 }}
          >
            <FiFilter className="w-4 h-4" />
            Apply
          </button>
        </div>
    <button
  onClick={() => fetchData()}
  className="ml-auto cursor-pointer text-xl h-[30px] max-h-[30px] px-3 py-1 text-white flex items-center gap-1"
  style={{ backgroundColor: '#056daa' }}
  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#04578a'; }}
  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#056daa'; }}
>
 
 {
  loading ? <SpiralLoader color="#FFFFFF" /> : ''
 }
 
  Refresh
</button>
     
      </div>
      
      {/* Main Content */}
      <div className="p-3 space-y-2.5">
        
        {/* CHART 1 · "Departments vs services" — drawn by DeptServicesMirror (top of file); colors from CC */}
        <div className="bg-white border border-gray-200 p-4 sm:p-5 shadow-sm-disabled hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-base font-bold text-gray-900">Departments vs services</div>
              <div className="text-xs text-gray-500 mt-0.5">
                People served against services handled per employee · {periodLabel}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-bold leading-none" style={{ color: CC.blue }}>{totalVisitorsInPeriod}</div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 mt-1">Total visitors · {periodLabel}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Staff assigned vs served · {periodLabel}
              </div>
            </div>
          </div>

          {deptVsServices.length === 0 ? (
            <div className="h-40 w-full flex items-center justify-center text-xs text-gray-400">
              No department data available yet
            </div>
          ) : (
            <DeptServicesMirror
              rows={deptVsServices}
              cc={{ amber: CC.amber, teal: CC.teal, red: CC.red }}
            />
          )}
        </div>

        {/* CHARTS 2 & 3 · "Requests" histograms — height: h-56 divs, colors: fill= on each <Bar>, bar width: maxBarSize */}
        <div className="bg-white border border-gray-200 p-4 sm:p-5 shadow-sm-disabled">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="text-base font-bold text-gray-900">Requests</div>
              <div className="text-xs text-gray-500 mt-0.5">Requests by status · {periodLabel}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-bold leading-none" style={{ color: CC.purple }}>{requestStatuses.avgPerDept}</div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 mt-1">Avg requests / orientation</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 mb-3">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: CC.amber }}></div>Pending</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: CC.blue }}></div>In progress</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: CC.teal }}></div>Completed</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: CC.red }}></div>Overdue</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: '#9E9E9E' }}></div>Archived</div>
          </div>

          {requestStatuses.total === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-gray-400">
              No requests recorded in this period yet.
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: CC.amber }}>Orientation</span>
                  <span className="text-xs text-gray-500">(incoming requests)</span>
                </div>
                {/* Scrolls horizontally when many departments (110px each) — scrollbar hidden via no-scrollbar */}
                <div className="h-56 overflow-x-auto no-scrollbar">
                  <div className="h-full" style={{ minWidth: `${requestStatuses.departments.length * 110}px` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={requestStatuses.departments} barGap={2} barCategoryGap="18%" margin={{ top: 10, right: 5, left: -25, bottom: 25 }}>
                      <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                      <RTooltip
                        cursor={{ fill: COK.neutralLight }}
                        contentStyle={{ border: `1px solid ${COK.border}`, borderRadius: 0, fontSize: 12 }}
                        labelFormatter={(_l: any, payload: any) => payload?.[0]?.payload?.fullName || _l}
                      />
                      <Bar dataKey="pending" name="Pending" fill={CC.amber} maxBarSize={32} isAnimationActive={false}>
                        <LabelList content={makeStatusBarLabel(requestStatuses.departments)} />
                      </Bar>
                      <Bar dataKey="inprogress" name="In progress" fill={CC.blue} maxBarSize={32} isAnimationActive={false}>
                        <LabelList content={makeStatusBarLabel(requestStatuses.departments)} />
                      </Bar>
                      <Bar dataKey="completed" name="Completed" fill={CC.teal} maxBarSize={32} isAnimationActive={false}>
                        <LabelList content={makeStatusBarLabel(requestStatuses.departments)} />
                      </Bar>
                      <Bar dataKey="overdue" name="Overdue" fill={CC.red} maxBarSize={32} isAnimationActive={false}>
                        <LabelList content={makeStatusBarLabel(requestStatuses.departments)} />
                      </Bar>
                      <Bar dataKey="archived" name="Archived" fill="#9E9E9E" maxBarSize={32} isAnimationActive={false}>
                        <LabelList content={makeStatusBarLabel(requestStatuses.departments)} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: CC.blue }}>Assignees</span>
                  <span className="text-xs text-gray-500">(request progress)</span>
                </div>
                {/* Scrolls horizontally when many employees (110px each) — scrollbar hidden via no-scrollbar */}
                <div className="h-56 overflow-x-auto no-scrollbar">
                  <div className="h-full" style={{ minWidth: `${requestStatuses.employees.length * 110}px` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={requestStatuses.employees} barGap={2} barCategoryGap="18%" margin={{ top: 10, right: 5, left: -25, bottom: 25 }}>
                      <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                      <RTooltip
                        cursor={{ fill: COK.neutralLight }}
                        contentStyle={{ border: `1px solid ${COK.border}`, borderRadius: 0, fontSize: 12 }}
                        labelFormatter={(_l: any, payload: any) => payload?.[0]?.payload?.fullName || _l}
                      />
                      <Bar dataKey="pending" name="Pending" fill={CC.amber} maxBarSize={32} isAnimationActive={false}>
                        <LabelList content={makeStatusBarLabel(requestStatuses.employees)} />
                      </Bar>
                      <Bar dataKey="inprogress" name="In progress" fill={CC.blue} maxBarSize={32} isAnimationActive={false}>
                        <LabelList content={makeStatusBarLabel(requestStatuses.employees)} />
                      </Bar>
                      <Bar dataKey="completed" name="Completed" fill={CC.teal} maxBarSize={32} isAnimationActive={false}>
                        <LabelList content={makeStatusBarLabel(requestStatuses.employees)} />
                      </Bar>
                      <Bar dataKey="overdue" name="Overdue" fill={CC.red} maxBarSize={32} isAnimationActive={false}>
                        <LabelList content={makeStatusBarLabel(requestStatuses.employees)} />
                      </Bar>
                      <Bar dataKey="archived" name="Archived" fill="#9E9E9E" maxBarSize={32} isAnimationActive={false}>
                        <LabelList content={makeStatusBarLabel(requestStatuses.employees)} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ratings row — department averages (left) next to the banded avg-feedback chart (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {/* CHART 4 · "Average Rating by Department" — height: h-64 div, color: fill= on <Bar>, thickness: barSize */}
          <div
            onClick={() => { resetRatingFilters(); handleCardClick('rating-analysis'); }}
            className="bg-white p-4 relative cursor-pointer hover:shadow-md transition-all"
            style={{ border: `1px solid ${COK.border}` }}
          >
            <div className="flex justify-between items-start">
              <h3 style={{ fontFamily: COK.headingFont, fontSize: 15, fontWeight: 600, color: COK.neutralDark, margin: '0 0 16px 0' }}>
                Average Rating by Department
              </h3>
              <span className="text-xs text-gray-400">Click for ratings &amp; sentiment</span>
            </div>
            {deptRatings.length === 0 ? (
              <p className="text-sm text-gray-500" style={{ fontFamily: COK.bodyFont }}>No department feedback yet.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptRatings} layout="vertical" margin={{ top: 5, right: 25, left: 10, bottom: 5 }}>
                    <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                    <RTooltip
                      cursor={{ fill: COK.neutralLight }}
                      contentStyle={{ border: `1px solid ${COK.border}`, borderRadius: 0, fontSize: 12 }}
                      formatter={(value: any, _n: any, entry: any) => [`${value}/10 (${entry?.payload?.count} feedback)`, 'Avg rating']}
                    />
                    <Bar dataKey="rating" fill={COK.primary} radius={[0, 0, 0, 0]} barSize={16} isAnimationActive={false}>
                      <LabelList position="insideEnd" fontSize={10} fill="#ffffff" formatter={(value: any) => {
                        const num = Number(value);
                        if (Number.isNaN(num)) return value;
                        return Number.isInteger(num) ? String(num) : num.toFixed(2);
                      }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* CHART 5 · "Department Sentiment" — height: h-64 div, bar colors: SENTIMENT_META, trend line: <Line> stroke */}
          <div className="bg-white p-4" style={{ border: `1px solid ${COK.border}` }}>
          <h3 style={{ fontFamily: COK.headingFont, fontSize: 15, fontWeight: 600, color: COK.neutralDark, margin: 0 }}>
            Department Sentiment
          </h3>
          <div className="text-[11px] uppercase tracking-wide text-gray-400 mt-0.5 mb-2">From negative to positive · avg rating out of 10 · {periodLabel}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mb-2">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: SENTIMENT_META.negative.color }}></div>Negative (&lt;4)</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: SENTIMENT_META.neutral.color }}></div>Neutral (4–6.9)</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: SENTIMENT_META.positive.color }}></div>Positive (7+)</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ background: `linear-gradient(to top, ${SENTIMENT_META.negative.color} 33%, ${SENTIMENT_META.neutral.color} 33% 66%, ${SENTIMENT_META.positive.color} 66%)` }}></div>General feedback </div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5" style={{ backgroundColor: CC.blue }}></div>Rating trend</div>
          </div>
          {sentimentTrend.length === 0 ? (
            <p className="text-sm text-gray-500" style={{ fontFamily: COK.bodyFont }}>No feedback in this period yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sentimentTrend} margin={{ top: 15, right: 15, left: -22, bottom: 30 }}>
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    axisLine={{ stroke: COK.border }}
                    tickLine={false}
                  />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                  <RTooltip cursor={{ fill: COK.neutralLight }} content={<SentimentChartTooltip />} />
                  {/* barRating renders the department bars; the seg* stack renders the General
                      bar as horizontal negative/neutral/positive bands (same total height) */}
                  <Bar dataKey="barRating" name="Avg rating" barSize={34} radius={[0, 0, 0, 0]} stackId="sentiment" isAnimationActive={false}>
                    {sentimentTrend.map((d, i) => (
                      <Cell key={i} fill={SENTIMENT_META[classifySentiment(d.rating, 10)].color} />
                    ))}
                    <LabelList position="insideEnd" fontSize={9} fill="#ffffff" formatter={(value: any) => {
                      const num = Number(value);
                      if (Number.isNaN(num)) return value;
                      return Number.isInteger(num) ? String(num) : num.toFixed(2);
                    }} />
                  </Bar>
                  <Bar dataKey="segNegative" name="Negative share" barSize={34} stackId="sentiment" fill={SENTIMENT_META.negative.color} isAnimationActive={false}>
                    <LabelList position="insideEnd" fontSize={9} fill="#ffffff" formatter={(value: any) => {
                      const num = Number(value);
                      if (Number.isNaN(num)) return value;
                      return Number.isInteger(num) ? String(num) : num.toFixed(2);
                    }} />
                  </Bar>
                  <Bar dataKey="segNeutral" name="Neutral share" barSize={34} stackId="sentiment" fill={SENTIMENT_META.neutral.color} isAnimationActive={false}>
                    <LabelList position="insideEnd" fontSize={9} fill="#ffffff" formatter={(value: any) => {
                      const num = Number(value);
                      if (Number.isNaN(num)) return value;
                      return Number.isInteger(num) ? String(num) : num.toFixed(2);
                    }} />
                  </Bar>
                  <Bar dataKey="segPositive" name="Positive share" barSize={34} stackId="sentiment" fill={SENTIMENT_META.positive.color} isAnimationActive={false}>
                    <LabelList position="insideEnd" fontSize={9} fill="#ffffff" formatter={(value: any) => {
                      const num = Number(value);
                      if (Number.isNaN(num)) return value;
                      return Number.isInteger(num) ? String(num) : num.toFixed(2);
                    }} />
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="rating"
                    name="Rating trend"
                    stroke={CC.blue}
                    strokeWidth={2}
                    dot={{ r: 4, fill: CC.blue, stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          </div>
        </div>

        {/* CHART 6 · "Hourly parking check-ins" gauge — needle points at the last vehicle check-in hour; hover a segment for its count; click opens the check-ins graph */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          <div
            onClick={() => handleCardClick('parking-hourly')}
            className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Hourly parking check-ins</div>
                <div className="text-xs text-gray-500">Vehicles · today</div>
              </div>
              <span className="text-xs text-gray-400">Click for details</span>
            </div>
            {hasParkingGauge ? (
              <HourGauge hours={parkingGaugeHours} lastHour={lastParkingHour} />
            ) : (
              <div className="h-48 w-full flex items-center justify-center text-xs text-gray-400">
                No vehicle check-ins recorded today
              </div>
            )}
          </div>

          {/* CHART 7 · Parking card — occupancy donut by default, View map opens the lot map, toggle to the old trends area chart */}
          <div className="bg-white border border-gray-200 p-3">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  {parkingView === 'chart' ? 'Parking Occupancy' : parkingView === 'map' ? 'Parking Lot' : 'Parking Usage Trends'}

                </div>
                <div className="text-xs text-gray-500">
                  {parkingView === 'chart' ? 'Occupied share of all parking slots · live'
                  : parkingView === 'map' ? 'Slot occupancy · all currently active vehicles'
                  : 'Check-ins vs check-outs · today'}
                </div>
              </div>
              <div className="flex border border-gray-300 text-xs flex-shrink-0">
                <button onClick={() => setParkingView('chart')} className={`px-2 py-1 ${parkingView === 'chart' ? 'cok-primary-bg text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Occupancy</button>
                <button onClick={() => setParkingView('trends')} className={`px-2 py-1 ${parkingView === 'trends' ? 'cok-primary-bg text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Trends</button>
              </div>
            </div>
            {parkingView === 'chart' ? (
              <ParkingOccupancyDonut
                occupied={parkingLot.vehicles.length}
                totalSlots={parkingLot.totalSlots}
                onViewMap={() => setParkingView('map')}
              />
            ) : parkingView === 'map' ? (
              <ParkingLotMap totalSlots={parkingLot.totalSlots} vehicles={parkingLot.vehicles} reservations={parkingLot.reservations} />
            ) : hasHourlyParking ? (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.hourlyParking}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tickFormatter={(v: number) => `${v}:00`} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip />
                    <Legend />
                    <Area type="monotone" dataKey="check_in" stroke="#3b82f6" fill="rgba(59,130,246,0.1)" name="Check-ins" isAnimationActive={false} />
                    <Area type="monotone" dataKey="check_out" stroke="#ef4444" fill="rgba(239,68,68,0.1)" name="Check-outs" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 w-full flex items-center justify-center text-xs text-gray-400">
                No parking check-ins recorded today
              </div>
            )}
          </div>
        </div>

        {/* Overview Tab Content */}
        <div className="grid grid-cols-1 gap-2.5">

              {/* Left Column */}
              <div className="space-y-2.5">
                {/* Department Overview Table */}
                <div className="bg-white border border-gray-200 p-3">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Department overview</div>
                      <div className="text-xs text-gray-500">Leaders, staff, and feedback ratings</div>
                    </div>
                    <button className="text-gray-400 text-lg">⋯</button>
                  </div>
                  {/* Same table design rules as the event-manager events table:
                      bordered container, CoK-blue uppercase header, zebra rows, bordered cells */}
                  <div className="overflow-auto border-2 border-gray-300">
                    <table className="w-full border-collapse table-auto">
                      <thead className="sticky top-0 z-10">
                        <tr>
                          {['Department', 'Leader', 'Staff', 'Rating', 'Feedback'].map(label => (
                            <th
                              key={label}
                              className="cok-primary-bg text-white px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest"
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(!visibleDepartments || visibleDepartments.length === 0) ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-16 text-center bg-white">
                              <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">No departments found</span>
                            </td>
                          </tr>
                        ) : (
                          visibleDepartments.map((row, idx) => {
                            const staffPercent = Math.round((row.staff / maxStaff) * 100);
                            const ratingChip =
                              row.rating >= 9 ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : row.rating >= 7 ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : row.rating >= 5 ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-red-50 text-red-800 border-red-300';
                            const isLast = idx === visibleDepartments.length - 1;
                            const cell = (colIdx: number) =>
                              `px-4 py-3 ${colIdx === 0 ? '' : 'border-l border-gray-200'} ${isLast ? '' : 'border-b border-gray-200'}`;
                            return (
                              <tr
                                key={idx}
                                className={`transition-colors duration-100 ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50/50 hover:bg-blue-50'}`}
                              >
                                <td className={cell(0)}>
                                  <span className="font-bold text-gray-900 text-sm">{row.name}</span>
                                </td>
                                <td className={cell(1)}>
                                  <span className="text-sm font-semibold text-gray-900">{row.leader}</span>
                                </td>
                                <td className={cell(2)}>
                                  <div className="text-sm text-gray-700 font-medium">{row.staff}</div>
                                  <div className="h-1 bg-gray-100 mt-1 w-16">
                                    <div className="h-full bg-purple-600" style={{ width: `${staffPercent}%` }}></div>
                                  </div>
                                </td>
                                <td className={cell(3)}>
                                  <span className={`inline-block border px-2.5 py-0.5 text-xs font-semibold ${ratingChip}`}>
                                    {row.rating}/10
                                  </span>
                                </td>
                                <td className={cell(4)}>
                                  <span className="text-sm text-gray-700 font-medium">{row.feedback}</span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  {!showAllDepartments && data.departments.length > departmentLimit && (
                    <div className="mt-3 flex flex-col sm:flex-row justify-between items-center gap-2">
                      <div className="text-xs text-gray-600 text-center sm:text-left">
                        Showing {visibleDepartments?.length || 0} of {data.departments.length} departments
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setDepartmentPage(Math.max(1, departmentPage - 1))}
                          disabled={departmentPage <= 1}
                          className="px-2 py-1 text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setDepartmentPage(Math.min(Math.ceil(data.departments.length / departmentLimit), departmentPage + 1))}
                          disabled={departmentPage >= Math.ceil(data.departments.length / departmentLimit)}
                          className="px-2 py-1 text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                      <button
                        onClick={() => setShowAllDepartments(true)}
                        className="text-xs px-2 py-1 bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Show All
                      </button>
                    </div>
                  )}
                  {showAllDepartments && (
                    <div className="mt-3 text-center">
                      <button
                        onClick={() => {
                          setShowAllDepartments(false);
                          setDepartmentPage(1);
                        }}
                        className="text-xs px-3 py-1 bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Show Less
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
            </div>
            
            {/* CHART 9 · "Employee account status" — size: h-32 div + canvas classes; colors in createCharts (search: CHART 9 config) */}
            <div className="grid grid-cols-1 gap-2.5">
              <div
                onClick={() => { setEmpStatusFilter('all'); setEmpStatusPage(1); setSelectedCard('employee-status'); }}
                className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Employee account status</div>
                    <div className="text-xs text-gray-500">Activation, lock and online state</div>
                  </div>
                  <span className="text-xs text-gray-400">Click to view employees</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs mb-3">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-600"></div>Activated {data.employeeStats.active}</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-500"></div>Not activated {data.employeeStats.inactive}</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-600"></div>Locked {data.employeeStats.locked}</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-600"></div>Online {data.employeeStats.online}</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-gray-400"></div>Offline {data.employeeStats.offline}</div>
                </div>
                {/* 3D exploded pie — size: maxWidth in StatusPie3D's svg style; colors: the CC values passed below */}
                <StatusPie3D
                  slices={[
                    { label: 'Activated', value: data.employeeStats.active, color: CC.blue },
                    { label: 'Not activated', value: data.employeeStats.inactive, color: CC.amber },
                    { label: 'Locked', value: data.employeeStats.locked, color: CC.red },
                    { label: 'Online', value: data.employeeStats.online, color: CC.teal },
                    { label: 'Offline', value: data.employeeStats.offline, color: '#9E9E9E' },
                  ]}
                />
              </div>
            </div>
        

      </div>
      
      {/* Modal for Card Details */}
      {selectedCard && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4"
            onClick={handleModalClose}
          >
          <div
            className={`bg-white w-full ${selectedCard === 'dept-served' || selectedCard === 'employee-served' ? 'max-w-6xl' : 'max-w-4xl'} mx-2 sm:mx-4 max-h-[90vh] sm:max-h-[85vh] overflow-y-auto`}
            // The mayor theme rounds modal panels; these views follow the square design rules
            style={{ borderRadius: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedCard === 'employees' && 'Employee Details'}
                {selectedCard === 'parking' && 'Currently Parked Vehicles'}
                {selectedCard === 'services' && 'Service Delivery Visitors'}
                {selectedCard === 'flagged' && 'Flagged Vehicles Details'}
                {selectedCard === 'services-detail' && 'Services by Department - Detailed View'}
                {selectedCard === 'employees-detail' && 'Employees by Department'}
                {selectedCard === 'service-hourly' && 'Hourly Service Check-ins - Detailed View'}
                {selectedCard === 'parking-hourly' && 'Hourly Parking Check-ins - Detailed View'}
                {selectedCard === 'rating-analysis' && 'Ratings & Sentiment Analysis'}
                {selectedCard === 'dept-served' && 'Departments & People Served'}
                {selectedCard === 'employee-served' && 'Employees & Who They Served'}
                {selectedCard === 'employee-status' && 'Employee Account Status'}
              </h3>
              <button
                onClick={handleModalClose}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              {selectedCard === 'employees' && (
                <div className="space-y-4">


                  {modalLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                    <>
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-xs sm:text-sm border border-gray-200 min-w-[600px]">
                          <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Name</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Email</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Telephone</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Department</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalData.map((employee: any, idx: number) => (
                              <tr key={idx} className="border-b hover:bg-gray-50">
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">{employee.full_name || '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm break-all">{employee.email || '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{employee.telephone || '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">{employee.department_name || employee.department?.department_name || '____'}</td>
                                <td className="px-2 sm:px-4 py-2">
                                  <span className={`px-1 sm:px-2 py-1 text-xs ${employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {employee.is_active ? 'Online' : 'Offline'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
                        <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                          Showing {modalData.length} of {modalPagination.totalItems} records (Total: {modalPagination.totalItems})
                        </div>
                        <div className="flex gap-1 sm:gap-2">
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage - 1)}
                            disabled={modalPagination.currentPage <= 1}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage + 1)}
                            disabled={modalPagination.currentPage >= modalPagination.totalPages}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedCard === 'parking' && (
                <div className="space-y-4">


                  {modalLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                     <>
                       <div className="overflow-x-auto max-h-64 overflow-y-auto">
                         <table className="w-full text-xs sm:text-sm border border-gray-200 min-w-[700px]">
                           <thead className="bg-gray-50 sticky top-0 z-10">
                             <tr>
                               <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Plate Number</th>
                               <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Driver Name</th>
                               <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Driver Type</th>
                               <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Entry Time</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Duration</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalData.map((record: any, idx: number) => (
                              <tr key={idx} className="border-b hover:bg-gray-50">
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{record.plate_number || record.plate_no || '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">{record.driver_name || 'Unknown'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{record.driver_type || 'Unknown'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{record.check_in ? new Date(record.check_in).toLocaleString() : '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{record.current_duration || '____'}</td>
                                <td className="px-2 sm:px-4 py-2">
                                  <span className={`px-1 sm:px-2 py-1 text-xs ${record.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {record.status || 'Unknown'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
                        <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                          Showing {modalData.length} of {modalPagination.totalItems} records (Total: {modalPagination.totalItems})
                        </div>
                        <div className="flex gap-1 sm:gap-2">
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage - 1)}
                            disabled={modalPagination.currentPage <= 1}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage + 1)}
                            disabled={modalPagination.currentPage >= modalPagination.totalPages}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedCard === 'services' && (
                <div className="space-y-4">

                  {modalLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                     <>
                       <div className="overflow-x-auto max-h-64 overflow-y-auto">
                         <table className="w-full text-xs sm:text-sm border border-gray-200 min-w-[700px]">
                           <thead className="bg-gray-50 sticky top-0 z-10">
                             <tr>
                               <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Name</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Telephone</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Entry Date</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Duration</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Status</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b">Current Department</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalData.map((visitor: any, idx: number) => (
                              <tr key={idx} className="border-b hover:bg-gray-50">
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">{visitor.full_name || '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{visitor.telephone || '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{visitor.entry_date ? new Date(visitor.entry_date).toLocaleDateString() : '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{visitor.current_duration || '____'}</td>
                                <td className="px-2 sm:px-4 py-2">
                                  <span className={`px-1 sm:px-2 py-1 text-xs ${visitor.is_still_inhouse ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                    {visitor.is_still_inhouse ? 'In House' : 'Completed'}
                                  </span>
                                </td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">
                                  {visitor.departments_assigned && visitor.departments_assigned.length > 0
                                    ? visitor.departments_assigned[visitor.departments_assigned.length - 1].department_name
                                    : '____'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
                        <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                          Showing {modalData.length} of {modalPagination.totalItems} records (Total: {modalPagination.totalItems})
                        </div>
                        <div className="flex gap-1 sm:gap-2">
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage - 1)}
                            disabled={modalPagination.currentPage <= 1}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage + 1)}
                            disabled={modalPagination.currentPage >= modalPagination.totalPages}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedCard === 'flagged' && (
                <div className="space-y-4">

                  {modalLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                     <>
                       <div className="overflow-x-auto max-h-64 overflow-y-auto">
                         <table className="w-full text-sm border border-gray-200">
                           <thead className="bg-gray-50 sticky top-0 z-10">
                             <tr>
                               <th className="px-4 py-2 text-left border-b">Plate Number</th>
                              <th className="px-4 py-2 text-left border-b">Driver Name</th>
                              <th className="px-4 py-2 text-left border-b">Entry Time</th>
                              <th className="px-4 py-2 text-left border-b">Duration</th>
                              <th className="px-4 py-2 text-left border-b">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalData.map((vehicle: any, idx: number) => (
                              <tr key={idx} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-2">{vehicle.plate_number || vehicle.plate_no || '____'}</td>
                                <td className="px-4 py-2">{vehicle.driver_name || 'Unknown'}</td>
                                <td className="px-4 py-2">{vehicle.check_in ? new Date(vehicle.check_in).toLocaleString() : '____'}</td>
                                <td className="px-4 py-2">{vehicle.current_duration || '____'}</td>
                                <td className="px-4 py-2">
                                  <span className="px-2 py-1 text-xs bg-red-100 text-red-800">
                                    Flagged
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
                        <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                          Showing {modalData.length} of {modalPagination.totalItems} records (Total: {modalPagination.totalItems})
                        </div>
                        <div className="flex gap-1 sm:gap-2">
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage - 1)}
                            disabled={modalPagination.currentPage <= 1}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage + 1)}
                            disabled={modalPagination.currentPage >= modalPagination.totalPages}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedCard === 'employee-status' && (
                <div className="space-y-4">
                  {/* Status filter chips with live counts from the real employee list */}
                  <div className="flex flex-wrap gap-2">
                    {([
                      // Counts come from the backend stats endpoint, same source as the pie
                      { key: 'all', label: 'All', count: data?.employeeStats.total ?? employees.length, chip: 'bg-gray-100 text-gray-700 border-gray-300' },
                      { key: 'active', label: 'Activated', count: data?.employeeStats.active ?? 0, chip: 'bg-green-100 text-green-800 border-green-300' },
                      { key: 'inactive', label: 'Not activated', count: data?.employeeStats.inactive ?? 0, chip: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
                      { key: 'locked', label: 'Locked', count: data?.employeeStats.locked ?? 0, chip: 'bg-red-100 text-red-800 border-red-300' },
                      { key: 'online', label: 'Online', count: data?.employeeStats.online ?? 0, chip: 'bg-teal-100 text-teal-800 border-teal-300' },
                      { key: 'offline', label: 'Offline', count: data?.employeeStats.offline ?? 0, chip: 'bg-gray-200 text-gray-600 border-gray-400' },
                    ] as const).map(f => (
                      <button
                        key={f.key}
                        onClick={() => setEmpStatusFilter(f.key)}
                        className={`px-3 py-1.5 text-xs font-semibold border transition-colors ${f.chip} ${empStatusFilter === f.key ? 'ring-2 ring-blue-400' : 'opacity-80 hover:opacity-100'}`}
                      >
                        {f.label} ({f.count})
                      </button>
                    ))}
                  </div>
                  {/* Same table design rules as the event-manager events table:
                      bordered container, CoK-blue uppercase header, zebra rows, bordered cells */}
                  {empStatusFiltered.length === 0 ? (
                    <div className="border-2 border-gray-300 px-4 py-16 text-center bg-white">
                      <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">No employees in this status</span>
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-80 border-2 border-gray-300">
                      <table className="w-full border-collapse table-auto min-w-[560px]">
                        <thead className="sticky top-0 z-10">
                          <tr>
                            {['Name', 'Email', 'Department', 'Status'].map(label => (
                              <th
                                key={label}
                                className="cok-primary-bg text-white px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest whitespace-nowrap"
                              >
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {empStatusFiltered.map((e: any, idx: number) => {
                            const locked = !!e.access_control?.is_locked;
                            const isLast = idx === empStatusFiltered.length - 1;
                            const cell = (colIdx: number) =>
                              `px-4 py-3 ${colIdx === 0 ? '' : 'border-l border-gray-200'} ${isLast ? '' : 'border-b border-gray-200'}`;
                            return (
                              <tr
                                key={idx}
                                className={`transition-colors duration-100 ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50/50 hover:bg-blue-50'}`}
                              >
                                <td className={`${cell(0)} whitespace-nowrap`}>
                                  <span className="font-bold text-gray-900 text-sm">{e.full_name || '—'}</span>
                                </td>
                                <td className={`${cell(1)} break-all`}>
                                  <span className="text-sm text-gray-700">{e.email || '—'}</span>
                                </td>
                                <td className={cell(2)}>
                                  <span className="text-sm text-gray-700 font-medium">{e.department?.department_name || e.department?.name || e.department_name || '—'}</span>
                                </td>
                                <td className={cell(3)}>
                                  <div className="flex flex-wrap gap-1">
                                    <span className={`inline-block border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${e.is_account_activated ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'}`}>
                                      {e.is_account_activated ? 'Activated' : 'Not activated'}
                                    </span>
                                    {locked && (
                                      <span className="inline-block border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide bg-red-100 text-red-800 border-red-300">
                                        Locked
                                      </span>
                                    )}
                                    <span className={`inline-block border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${e.is_active ? 'bg-teal-100 text-teal-800 border-teal-300' : 'bg-gray-200 text-gray-600 border-gray-400'}`}>
                                      {e.is_active ? 'Active' : 'Offline'}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {/* Server-side pagination, 50 employees per page */}
                  {empStatusTotal > EMP_STATUS_PAGE_SIZE && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
                      <span>
                        Page <span className="font-semibold">{empStatusPage}</span> of{' '}
                        <span className="font-semibold">{Math.max(1, Math.ceil(empStatusTotal / EMP_STATUS_PAGE_SIZE))}</span>
                        {' '}· {empStatusTotal} employees
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEmpStatusPage(p => Math.max(1, p - 1))}
                          disabled={empStatusPage <= 1}
                          className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setEmpStatusPage(p => p + 1)}
                          disabled={empStatusPage >= Math.ceil(empStatusTotal / EMP_STATUS_PAGE_SIZE)}
                          className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedCard === 'dept-served' && (
                <div className="space-y-4">
                  {/* Headline stats — all obey the toolbar period filter */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-600">
                    <span>Period: <span className="font-semibold capitalize">{periodLabel}</span></span>
                    <span><span className="font-semibold" style={{ color: CC.amber }}>{totalVisitorsInPeriod}</span> total visitors</span>
                    <span><span className="font-semibold" style={{ color: CC.teal }}>{(servedStats?.by_department || []).reduce((s, d) => s + d.served, 0)}</span> people served</span>
                  </div>
                  {deptVsServices.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-xs text-gray-400">
                      No department data available yet
                    </div>
                  ) : (
                    <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-2">
                      {deptVsServices.map((d, idx) => {
                        const notServed = Math.max(0, d.staff - d.served);
                        const maxStaff = Math.max(...deptVsServices.map(r => r.staff), 1);
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs hover:bg-gray-50 px-1 py-1">
                            <span className="w-44 sm:w-56 flex-shrink-0 truncate text-right font-medium text-gray-800" title={d.name}>
                              {d.name} <span className="text-gray-400 font-normal">({d.staff})</span>
                            </span>
                            <div className="flex-1 h-5 bg-gray-100 overflow-hidden">
                              <div className="flex h-full">
                                {d.served > 0 && (
                                  <div
                                    className="h-full transition-all duration-500"
                                    style={{
                                      width: `${(d.served / maxStaff) * 100}%`,
                                      minWidth: d.served > 0 ? 2 : 0,
                                      backgroundColor: CC.teal,
                                    }}
                                  ></div>
                                )}
                                {notServed > 0 && (
                                  <div
                                    className="h-full transition-all duration-500"
                                    style={{
                                      width: `${(notServed / maxStaff) * 100}%`,
                                      minWidth: notServed > 0 ? 2 : 0,
                                      backgroundColor: CC.red,
                                    }}
                                  ></div>
                                )}
                              </div>
                            </div>
                            <span className="w-16 text-right font-semibold flex items-center justify-end gap-1">
                              <span style={{ color: CC.teal }}>{d.served}</span>
                              <span className="text-gray-300">/</span>
                              <span style={{ color: CC.red }}>{notServed}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {selectedCard === 'employee-served' && (
                <div className="space-y-4">
                  {/* Headline stats — all obey the toolbar period filter */}
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-600">
                      <span>Period: <span className="font-semibold capitalize">{periodLabel}</span></span>
                      <span><span className="font-semibold" style={{ color: CC.blue }}>{employeeServed.filter(e => e.served > 0).length}</span> employees served someone</span>
                      <span className="text-gray-400">Click an employee to see who they served</span>
                    </div>
                    <div className="flex gap-4 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: CC.blue }}></span>Normal load</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: CC.red }}></span>Overloaded (above 1.5× average)</span>
                    </div>
                  </div>
                  {employeeServed.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 mb-2">No employees found</div>
                      <div className="text-sm text-gray-400">Employee service records will appear here once services are delivered.</div>
                    </div>
                  ) : (
                    <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-1.5">
                      {employeeServed.map((e, idx) => {
                        const overloaded = avgEmployeeLoad > 0 && e.served > avgEmployeeLoad * 1.5;
                        const rowKey = `${e.name}-${idx}`;
                        const isOpen = expandedEmployee === rowKey;
                        return (
                          <div key={idx}>
                            <div
                              onClick={() => setExpandedEmployee(isOpen ? null : rowKey)}
                              className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5"
                            >
                              <span className="w-3 flex-shrink-0 text-gray-400">{isOpen ? '▾' : '▸'}</span>
                              <span className="w-36 sm:w-44 flex-shrink-0 truncate font-medium text-gray-800" title={e.name}>{e.name}</span>
                              <span className="w-28 sm:w-40 flex-shrink-0 truncate text-gray-400" title={e.department}>{e.department}</span>
                              <div className="flex-1 h-4 bg-gray-100 overflow-hidden">
                                {e.served > 0 && (
                                  <div
                                    className="h-full transition-all duration-500"
                                    style={{
                                      width: `${Math.max((e.served / maxEmployeeServed) * 100, 3)}%`,
                                      backgroundColor: overloaded ? CC.red : CC.blue,
                                      backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.06), rgba(255,255,255,0.25))',
                                    }}
                                  ></div>
                                )}
                              </div>
                              <span className="w-8 text-right font-semibold" style={{ color: e.served > 0 ? (overloaded ? CC.red : CC.blue) : '#9ca3af' }}>
                                {e.served}
                              </span>
                            </div>
                            {isOpen && (
                              <div className="ml-40 sm:ml-52 my-1 pl-3 border-l-2 border-gray-200 space-y-0.5">
                                {e.visitors.length === 0 ? (
                                  <div className="text-[11px] text-gray-400 italic">Served no one in this period</div>
                                ) : (
                                  e.visitors.map((v, i) => (
                                    <div key={i} className="text-[11px] text-gray-600">
                                      {v.visitor} <span className="text-gray-400">· {v.department}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {selectedCard === 'rating-analysis' && (
                <div className="space-y-5">
                  {modalLoading ? (
                    <div className="text-center py-8">Loading feedback data...</div>
                  ) : modalData.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 mb-2">No feedback records found</div>
                      <div className="text-sm text-gray-400">
                        Ratings and sentiment will appear here once citizens submit feedback.
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Ratings table */}
                      <div>
                        <h4 style={{ fontFamily: COK.headingFont, fontSize: 14, fontWeight: 600, color: COK.neutralDark, margin: '0 0 10px 0' }}>
                          Ratings ({filteredRatings.length})
                        </h4>
                        {/* Sentiment filter chips (counts follow the period dropdown) + modal-level period filter */}
                        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setSentimentFilter('all')}
                              className={`px-3 py-1.5 text-xs font-semibold border bg-gray-100 text-gray-700 border-gray-300 transition-colors ${sentimentFilter === 'all' ? 'ring-2 ring-blue-400' : 'opacity-80 hover:opacity-100'}`}
                            >
                              All ({periodRatings.length})
                            </button>
                            {(['positive', 'neutral', 'negative'] as Sentiment[]).map(s => {
                              const count = periodRatings.filter((f: any) => classifySentiment(f.rate, f.rate_out_of) === s).length;
                              return (
                                <button
                                  key={s}
                                  onClick={() => setSentimentFilter(s)}
                                  className={`px-3 py-1.5 text-xs font-semibold border transition-colors ${sentimentFilter === s ? 'ring-2 ring-blue-400' : 'opacity-80 hover:opacity-100'}`}
                                  style={{
                                    backgroundColor: `${SENTIMENT_META[s].color}1A`,
                                    color: SENTIMENT_META[s].color,
                                    borderColor: SENTIMENT_META[s].color,
                                  }}
                                >
                                  {SENTIMENT_META[s].label} ({count})
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-xs text-gray-600">
                            <label className="font-medium">Period</label>
                            <select
                              value={draftRatingPeriod}
                              onChange={e => setDraftRatingPeriod(e.target.value as PeriodChoice)}
                              className="text-xs px-2 py-1 border border-gray-300 bg-white"
                            >
                              <option value="today">Today</option>
                              <option value="week">This week</option>
                              <option value="lastweek">Last week</option>
                              <option value="month">This month</option>
                              <option value="lastmonth">Last month</option>
                              <option value="all">All</option>
                              <option value="range">Custom range</option>
                            </select>
                            {draftRatingPeriod === 'range' && (
                              <>
                                <input
                                  type="date"
                                  value={draftRatingRangeFrom}
                                  onChange={e => setDraftRatingRangeFrom(e.target.value)}
                                  className="text-xs px-1.5 py-1 border border-gray-300 bg-white"
                                />
                                <span className="text-gray-400">to</span>
                                <input
                                  type="date"
                                  value={draftRatingRangeTo}
                                  onChange={e => setDraftRatingRangeTo(e.target.value)}
                                  className="text-xs px-1.5 py-1 border border-gray-300 bg-white"
                                />
                              </>
                            )}
                            <button
                              type="button"
                              onClick={applyRatingPeriod}
                              disabled={draftRatingPeriod === ratingPeriod && draftRatingRangeFrom === ratingRangeFrom && draftRatingRangeTo === ratingRangeTo}
                              className="flex items-center gap-2 px-4 py-2 bg-[#056daa] text-white text-[13px] font-semibold uppercase tracking-[1px] hover:bg-[#045d94] transition-colors disabled:opacity-40 disabled:hover:bg-[#056daa] disabled:cursor-default"
                              style={{ fontFamily: COK.headingFont, borderRadius: 0 }}
                            >
                              <FiFilter className="w-4 h-4" />
                              Apply
                            </button>
                          </div>
                        </div>
                        {/* Same table design rules as the event-manager events table:
                            bordered container, CoK-blue uppercase header, zebra rows, bordered cells */}
                        <div className="overflow-auto max-h-[55vh] border-2 border-gray-300">
                          <table className="w-full border-collapse table-fixed min-w-[720px]">
                            <thead className="sticky top-0 z-10">
                              <tr>
                                {([
                                  { label: 'Rating', width: 'w-24' },
                                  { label: 'Sentiment', width: 'w-28' },
                                  { label: 'Department', width: 'w-44' },
                                  { label: 'Comment', width: '' },
                                  { label: 'From', width: 'w-36' },
                                  { label: 'Date', width: 'w-32' },
                                ]).map(col => (
                                  <th
                                    key={col.label}
                                    className={`cok-primary-bg text-white px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest whitespace-nowrap ${col.width}`}
                                  >
                                    {col.label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredRatings.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="px-4 py-16 text-center bg-white">
                                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">No ratings for this filter</span>
                                  </td>
                                </tr>
                              )}
                              {filteredRatings.map((f: any, idx: number) => {
                                const meta = SENTIMENT_META[classifySentiment(f.rate, f.rate_out_of)];
                                const isLast = idx === filteredRatings.length - 1;
                                const cell = (colIdx: number) =>
                                  `px-4 py-3 ${colIdx === 0 ? '' : 'border-l border-gray-200'} ${isLast ? '' : 'border-b border-gray-200'}`;
                                return (
                                  <tr
                                    key={idx}
                                    className={`transition-colors duration-100 ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50/50 hover:bg-blue-50'}`}
                                  >
                                    <td className={`${cell(0)} whitespace-nowrap`}>
                                      {(() => {
                                        // Accent bar height is proportional to the rating (3/10 short, 10/10 full)
                                        const outOf = Number(f.rate_out_of) || 10;
                                        const pct = Math.max(0, Math.min(100, (Number(f.rate) / outOf) * 100));
                                        return (
                                          <span className="inline-flex items-end gap-1.5 h-11">
                                            <span className="inline-flex items-end w-1.5 h-full bg-gray-100">
                                              <span className="w-full" style={{ height: `${pct}%`, backgroundColor: meta.color, display: 'block' }} />
                                            </span>
                                            <span
                                              className="inline-flex flex-col items-center justify-center w-11 h-11"
                                              style={{ backgroundColor: `${meta.color}1A` }}
                                            >
                                              <span style={{ fontFamily: COK.headingFont, fontSize: 15, fontWeight: 700, color: meta.color }}>
                                                {f.rate ?? ''}
                                              </span>
                                              <span className="text-[9px] text-gray-400">/ {f.rate_out_of || 10}</span>
                                            </span>
                                          </span>
                                        );
                                      })()}
                                    </td>
                                    <td className={cell(1)}>
                                      <CokBadge label={meta.label} color={meta.color} />
                                    </td>
                                    <td className={cell(2)}>
                                      <span className="text-sm font-semibold text-gray-900">{f.department_name || 'Not specified'}</span>
                                    </td>
                                    <td className={`${cell(3)} max-w-xs`}>
                                      <p className="text-sm truncate" style={{ color: f.textmessage ? '#555555' : '#9E9E9E', fontStyle: f.textmessage ? 'normal' : 'italic', margin: 0 }} title={f.textmessage}>
                                        {f.textmessage || 'No written comment rating only.'}
                                      </p>
                                    </td>
                                    <td className={`${cell(4)} whitespace-nowrap`}>
                                      <span className="text-sm text-gray-700 font-medium">{f.user_name?.trim() || 'Anonymous'}</span>
                                    </td>
                                    <td className={`${cell(5)} whitespace-nowrap`}>
                                      <span className="text-sm text-gray-500">
                                        {f.created_date
                                          ? new Date(f.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                          : '—'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedCard === 'services-detail' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      Services by department
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs mb-3">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-600"></div>Total services</div>
                  </div>
                  <div className="h-[500px] w-full">
                    <canvas id="modal-services-detail-chart"></canvas>
                  </div>
                </div>
              )}

              {selectedCard === 'employees-detail' && (
                <div className="space-y-4">
                  {modalLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : modalData.length === 0 ? (
                    <div className="border-2 border-gray-300 px-4 py-16 text-center bg-white">
                      <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">No departments found</span>
                    </div>
                  ) : (
                    /* Same table design rules as the event-manager events table:
                       bordered container, CoK-blue uppercase header, zebra rows, bordered cells */
                    <div className="overflow-auto max-h-[55vh] border-2 border-gray-300">
                      <table className="w-full border-collapse table-auto min-w-[500px]">
                        <thead className="sticky top-0 z-10">
                          <tr>
                            {['Department', 'Leader', 'Total Employees', 'Created Date'].map(label => (
                              <th
                                key={label}
                                className="cok-primary-bg text-white px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest whitespace-nowrap"
                              >
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {modalData.map((dept: any, idx: number) => {
                            const isLast = idx === modalData.length - 1;
                            const cell = (colIdx: number) =>
                              `px-4 py-3 ${colIdx === 0 ? '' : 'border-l border-gray-200'} ${isLast ? '' : 'border-b border-gray-200'}`;
                            return (
                              <tr
                                key={idx}
                                className={`transition-colors duration-100 ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50/50 hover:bg-blue-50'}`}
                              >
                                <td className={cell(0)}>
                                  <span className="font-bold text-gray-900 text-sm">{dept.department_name}</span>
                                </td>
                                <td className={cell(1)}>
                                  <span className="text-sm font-semibold text-gray-900">
                                    {dept.department_leader?.full_name || 'Not assigned'}
                                  </span>
                                </td>
                                <td className={cell(2)}>
                                  <span className="text-sm text-gray-700 font-medium">{dept.total_employees || 0}</span>
                                </td>
                                <td className={`${cell(3)} whitespace-nowrap`}>
                                  <span className="text-sm text-gray-500">
                                    {dept.created_date ? new Date(dept.created_date).toLocaleDateString() : 'N/A'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {selectedCard === 'service-hourly' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="text-sm text-gray-600">
                      Visitor arrivals · <span className="capitalize">{labelForPeriod(modalHourPeriodEff)}</span>
                    </div>
                    {/* Modal-level period filter; opens following the toolbar filter */}
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <label className="font-medium">Period</label>
                      <select
                        value={draftModalHourPeriod ?? modalHourPeriodEff}
                        onChange={e => setDraftModalHourPeriod(e.target.value as PeriodChoice)}
                        className="text-xs px-2 py-1 border border-gray-300 bg-white"
                      >
                        <option value="today">Today</option>
                        <option value="week">This week</option>
                        <option value="lastweek">Last week</option>
                        <option value="month">This month</option>
                        <option value="lastmonth">Last month</option>
                        <option value="all">All</option>
                        {period === 'range' && <option value="range">Custom range</option>}
                      </select>
                      <button
                        type="button"
                        onClick={() => setModalHourPeriod(draftModalHourPeriod ?? modalHourPeriodEff)}
                        disabled={(draftModalHourPeriod ?? modalHourPeriodEff) === modalHourPeriodEff}
                        className="flex items-center gap-2 px-4 py-2 bg-[#056daa] text-white text-[13px] font-semibold uppercase tracking-[1px] hover:bg-[#045d94] transition-colors disabled:opacity-40 disabled:hover:bg-[#056daa] disabled:cursor-default"
                        style={{ fontFamily: COK.headingFont, borderRadius: 0 }}
                      >
                        <FiFilter className="w-4 h-4" />
                        Apply
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs mb-3">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-teal-600"></div>Visitors checked in</div>
                  </div>
                  <div className="h-48 sm:h-56 md:h-64 w-full">
                    <canvas id="modal-service-hourly-chart"></canvas>
                  </div>
                </div>
              )}

              {/* Parking check-ins graph — opened by clicking the hourly parking gauge */}
              {selectedCard === 'parking-hourly' && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">Vehicle check-ins per hour · today</div>
                  <div className="flex gap-3 text-xs mb-3">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-600"></div>Vehicles checked in</div>
                  </div>
                  <div className="h-48 sm:h-56 md:h-64 w-full">
                    {(data?.hourlyParking || []).some(h => (h.check_in || 0) > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data?.hourlyParking || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" tickFormatter={(v: number) => formatHourLabel(Number(v))} tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <RTooltip labelFormatter={(v: any) => formatHourLabel(Number(v))} />
                          <Area type="monotone" dataKey="check_in" stroke="#3b82f6" fill="rgba(59,130,246,0.15)" name="Check-ins" isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
                        No vehicle check-ins recorded today
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </MainLayout>
  );
};

export default Overview;