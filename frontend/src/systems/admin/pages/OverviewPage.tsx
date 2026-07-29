// Overview.tsx - Fixed Y-axis to show whole numbers only
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { statisticsService, employeeService, parkingService, serviceDeliveryService, feedbackService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import Chart from 'chart.js/auto';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell, LabelList, AreaChart, Area, CartesianGrid, Legend, ComposedChart, Line } from 'recharts';
import { COK, CokBadge } from './mayorCok';

// ==================== TYPES ====================

interface DashboardData {
  employeeStats: { total: number; active: number; inactive: number; locked: number };
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

// Speedometer-style gauge — needle points at the hour of the LAST check-in; that hour's count shown in the center
const HourGauge: React.FC<{ hours: Array<{ hour: number; count: number }> }> = ({ hours }) => {
  if (!hours.length) return null;
  const n = hours.length;
  const lastIdx = hours.reduce((best, h, i) => (h.count > 0 ? i : best), 0);
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
            <g key={h.hour}>
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

// Mirrored departments-vs-services chart: orange bars (people served) grow left
// from the center divider, blue bars (services handled by the department's top
// employee) grow right, both aligned to their number lines.
// Used by the dashboard card (top rows) and the detail modal (all rows, scrollable).
const DeptServicesMirror: React.FC<{
  rows: Array<{ name: string; staff: number; served: number; emp: { name: string; served: number } }>;
  cc: { amber: string; blue: string };
  scroll?: boolean;
  onLeftClick?: () => void;
  onRightClick?: () => void;
}> = ({ rows, cc, scroll, onLeftClick, onRightClick }) => {
  const maxServed = Math.max(...rows.map(r => r.served), 1);
  const maxEmp = Math.max(...rows.map(r => r.emp.served), 1);
  // At most ~6 axis ticks regardless of scale
  const makeTicks = (max: number) => {
    const step = Math.max(1, Math.ceil(max / 5));
    const ticks: number[] = [];
    for (let v = 0; v <= Math.floor(max); v += step) ticks.push(v);
    return ticks;
  };
  const leftTicks = makeTicks(maxServed);
  const rightTicks = makeTicks(maxEmp);

  return (
    <div>
      {/* Column headers, underlined in their series color like the reference design.
          Each half is its own click target when a handler is provided. */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`flex-1 flex items-center gap-2 pb-2 border-b-[3px] ${onLeftClick ? 'cursor-pointer' : ''}`}
          style={{ borderColor: cc.amber }}
          onClick={onLeftClick}
        >
          <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: cc.amber }}>
            Departments
          </span>
          <span className="text-xs text-gray-500">(people served)</span>
        </div>
        <div
          className={`flex-1 flex items-center justify-end gap-2 pb-2 border-b-[3px] ${onRightClick ? 'cursor-pointer' : ''}`}
          style={{ borderColor: cc.blue }}
          onClick={onRightClick}
        >
          <span className="text-xs text-gray-500">(services by top employee)</span>
          <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: cc.blue }}>
            Services
          </span>
        </div>
      </div>

      {/* Mirrored rows: orange bars grow left from the center divider, blue bars grow right.
          Bars sit on a soft full-width track; a white-fade gradient gives them depth. */}
      <div className={scroll ? 'space-y-3 max-h-[55vh] overflow-y-auto pr-1' : 'space-y-3'}>
        {rows.map(row => (
          <div
            key={row.name}
            className="flex items-center py-0.5 rounded-md hover:bg-gray-50 transition-colors"
            title={`${row.name}: ${row.served} people served · ${row.staff} staff · top employee: ${row.emp.name} (${row.emp.served} services)`}
          >
            <div
              className={`flex-1 flex items-center gap-2.5 min-w-0 ${onLeftClick ? 'cursor-pointer' : ''}`}
              onClick={onLeftClick}
            >
              <span className="w-40 sm:w-48 flex-shrink-0 text-right text-[13px] font-medium text-gray-700 truncate">
                {row.name} <span className="text-gray-400 font-normal">({row.served})</span>
              </span>
              <div className="flex-1 h-6 bg-gray-100/80 flex justify-end overflow-hidden">
                <div
                  className="h-full shadow-sm transition-all duration-500"
                  style={{
                    width: `${(row.served / maxServed) * 100}%`,
                    minWidth: row.served > 0 ? 4 : 0,
                    backgroundColor: cc.amber,
                    backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.08), rgba(255,255,255,0.28))',
                  }}
                ></div>
              </div>
            </div>

            <div
              className="w-[3px] self-stretch rounded-full mx-1 flex-shrink-0"
              style={{ background: `linear-gradient(to bottom, ${cc.amber}, ${cc.blue})` }}
            ></div>

            <div
              className={`flex-1 flex items-center gap-2.5 min-w-0 ${onRightClick ? 'cursor-pointer' : ''}`}
              onClick={onRightClick}
            >
              <div className="flex-1 h-6 bg-gray-100/80 flex justify-start overflow-hidden">
                {/* Width maps 1:1 to the axis so a bar of 3 ends at the 3 tick */}
                <div
                  className="h-full shadow-sm transition-all duration-500"
                  style={{
                    width: `${(row.emp.served / maxEmp) * 100}%`,
                    minWidth: row.emp.served > 0 ? 4 : 0,
                    backgroundColor: cc.blue,
                    backgroundImage: 'linear-gradient(to left, rgba(0,0,0,0.08), rgba(255,255,255,0.28))',
                  }}
                ></div>
              </div>
              <span
                className="w-40 sm:w-48 flex-shrink-0 text-[13px] font-medium text-gray-700 truncate"
                title={`${row.emp.name} · ${row.emp.served} services`}
              >
                {row.emp.name} <span className="text-gray-400 font-normal">({row.emp.served})</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Scale row aligned with bar areas */}
      <div className="flex items-start mt-2">
        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <span className="w-40 sm:w-48 flex-shrink-0"></span>
          <div className="flex-1 relative px-1" style={{ height: 24 }}>
            <div className="absolute inset-x-1 top-0 h-px bg-gray-900"></div>
            {leftTicks.map((tick) => {
              const pct = maxServed > 0 ? ((maxServed - tick) / maxServed) * 100 : 0;
              return (
                <div key={tick} className="absolute top-0 flex flex-col items-center" style={{ left: `calc(${pct}% + 4px)`, transform: 'translateX(-50%)' }}>
                  <div className="w-px h-2 bg-gray-900"></div>
                  <span className="mt-0.5 text-[11px] font-bold text-gray-900">{tick}</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Spacer matching the rows' center divider width, keeps the axes aligned */}
        <div className="w-[3px] mx-1 flex-shrink-0"></div>
        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <div className="flex-1 relative px-1" style={{ height: 24 }}>
            <div className="absolute inset-x-1 top-0 h-px bg-gray-900"></div>
            {rightTicks.map((tick) => {
              const pct = maxEmp > 0 ? (tick / maxEmp) * 100 : 0;
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
  const [data, setData] = useState<DashboardData | null>(null);

  // Raw visitors + employee list feed the departments-vs-services chart and its
  // employees-served breakdown; period state drives the toolbar date filter
  const [visitors, setVisitors] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [period, setPeriod] = useState<'today' | 'week' | 'lastweek' | 'month' | 'lastmonth' | 'all' | 'range'>('month');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  // One record per service actually delivered to a visitor: department + provider + date.
  // Completed services come from durations.services_durations; services_status entries
  // with a provider that never reached durations are counted once as well.
  const servedRecords = useMemo(() => {
    const records: Array<{ department: string; providerId?: string; providerName?: string; date?: string; visitor: string }> = [];
    visitors.forEach((v: any) => {
      const visitorName = v?.full_name || 'Unknown visitor';
      const durations = v?.durations?.services_durations || [];
      durations.forEach((s: any) => {
        if (!s?.department_name) return;
        records.push({
          department: s.department_name,
          providerId: s.provider_id,
          providerName: s.provider_name,
          date: s.started_at || v.entry_date,
          visitor: visitorName,
        });
      });
      (v?.services_status || []).forEach((s: any) => {
        if (!s?.department_name || (!s.provider_id && !s.provider_name)) return;
        const already = durations.some(
          (d: any) => d.department_id === s.department_id && (d.provider_id || '') === (s.provider_id || '')
        );
        if (!already) {
          records.push({
            department: s.department_name,
            providerId: s.provider_id,
            providerName: s.provider_name,
            date: v.entry_date,
            visitor: visitorName,
          });
        }
      });
    });
    return records;
  }, [visitors]);

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

  const filteredServed = useMemo(() => servedRecords.filter(r => isInPeriod(r.date)), [servedRecords, isInPeriod]);

  // Distinct visitors whose entry date falls in the selected period — shown beside the chart
  const totalVisitorsInPeriod = useMemo(
    () => visitors.filter((v: any) => isInPeriod(v?.entry_date)).length,
    [visitors, isInPeriod]
  );

  // Visitor requests grouped by status (pending / in progress / completed), once per
  // department (incoming requests) and once per employee (how their requests progress).
  // Requests with no employee recorded are grouped under "Unassigned".
  // The requests feature is not live yet — flip this to true to switch the chart
  // from sample data to the real per-status aggregation below.
  const REQUESTS_FEATURE_READY = false;
  const requestStatuses = useMemo(() => {
    type StatusCounts = { pending: number; inprogress: number; completed: number; overdue: number };
    const emptyCounts = (): StatusCounts => ({ pending: 0, inprogress: 0, completed: 0, overdue: 0 });
    const deptMap: Record<string, StatusCounts> = {};
    const empMap: Record<string, StatusCounts> = {};
    let total = 0;
    const DAY_MS = 24 * 60 * 60 * 1000;
    visitors.forEach((v: any) => {
      if (!isInPeriod(v?.entry_date)) return;
      (v?.services_status || []).forEach((s: any) => {
        if (!s?.department_name) return;
        // A request not yet completed and older than 24h counts as overdue
        const ageMs = v?.entry_date ? Date.now() - new Date(v.entry_date).getTime() : 0;
        const status: keyof StatusCounts =
          s.s_type === 'Completed' ? 'completed'
          : ageMs > DAY_MS ? 'overdue'
          : s.s_type === 'Inprogress' ? 'inprogress'
          : 'pending';
        total += 1;
        if (!deptMap[s.department_name]) deptMap[s.department_name] = emptyCounts();
        deptMap[s.department_name][status] += 1;
        const empName = s.provider_name && s.provider_name !== 'Not specified' ? s.provider_name : 'Unassigned';
        if (!empMap[empName]) empMap[empName] = emptyCounts();
        empMap[empName][status] += 1;
      });
    });
    const toRows = (m: Record<string, StatusCounts>) =>
      Object.entries(m)
        .map(([name, v]) => ({
          name: name.length > 14 ? name.slice(0, 13) + '…' : name,
          fullName: name,
          ...v,
          total: v.pending + v.inprogress + v.completed + v.overdue,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);
    const deptCount = Object.keys(deptMap).length;

    // No real request data yet — show clearly-labeled sample data so the chart's
    // design is visible; it is replaced automatically once real requests exist
    if (!REQUESTS_FEATURE_READY || total === 0) {
      const deptNames = (data?.departments?.map(d => d.name).slice(0, 5) || []);
      const sampleDepts = deptNames.length
        ? deptNames
        : ['Urban Economy', 'Urban Planning', 'City Engineering', 'Social Development', 'Digitalization'];
      // Use the system's real employees for the sample; only the counts are dummy
      const realEmpNames = employees.map((e: any) => e.full_name).filter(Boolean).slice(0, 5);
      const sampleEmps = realEmpNames.length
        ? realEmpNames
        : ['J. Mukamana', 'E. Niyonzima', 'A. Uwase', 'P. Habimana', 'C. Ingabire'];
      const P = [7, 4, 6, 3, 5];
      const I = [3, 5, 2, 4, 1];
      const C = [9, 6, 4, 7, 3];
      const O = [2, 1, 3, 2, 1];
      const sampleRows = (names: string[]) =>
        names.map((name, i) => ({
          name: name.length > 14 ? name.slice(0, 13) + '…' : name,
          fullName: name,
          pending: P[i % P.length],
          inprogress: I[i % I.length],
          completed: C[i % C.length],
          overdue: O[i % O.length],
          total: P[i % P.length] + I[i % I.length] + C[i % C.length] + O[i % O.length],
        }));
      const dummyDepts = sampleRows(sampleDepts);
      const dummyTotal = dummyDepts.reduce((s, r) => s + r.total, 0);
      return {
        departments: dummyDepts,
        employees: sampleRows(sampleEmps),
        total: dummyTotal,
        avgPerDept: Math.round((dummyTotal / sampleDepts.length) * 10) / 10,
        isSample: true,
      };
    }

    return {
      departments: toRows(deptMap),
      employees: toRows(empMap),
      total,
      avgPerDept: deptCount ? Math.round((total / deptCount) * 10) / 10 : 0,
      isSample: false,
    };
  }, [visitors, isInPeriod, data, employees]);

  const labelForPeriod = useCallback((p: PeriodChoice) =>
    p === 'today' ? 'today'
    : p === 'week' ? 'this week'
    : p === 'lastweek' ? 'last week'
    : p === 'month' ? 'this month'
    : p === 'lastmonth' ? 'last month'
    : p === 'all' ? 'all time'
    : `${rangeFrom || 'start'} → ${rangeTo || 'now'}`, [rangeFrom, rangeTo]);
  const periodLabel = labelForPeriod(period);

  // Every employee with the number of people they served in the selected period;
  // providers on records that don't match an employee account still get a row.
  // The employees endpoint populates department as { name }, so read that first;
  // if the account has no department, fall back to where they actually served.
  const employeeServed = useMemo(() => {
    const counts: Record<string, { name: string; count: number; dept?: string; visitors: Array<{ visitor: string; department: string }> }> = {};
    filteredServed.forEach(r => {
      const key = r.providerId || r.providerName;
      if (!key) return;
      if (!counts[key]) counts[key] = { name: r.providerName || 'Unknown provider', count: 0, dept: r.department, visitors: [] };
      counts[key].count += 1;
      counts[key].visitors.push({ visitor: r.visitor, department: r.department });
    });
    const used = new Set<string>();
    const rows = employees.map((e: any) => {
      const id = e._id || e.id || '';
      const name = e.full_name || 'Unknown';
      let served = 0;
      let servedDept: string | undefined;
      const visitorsList: Array<{ visitor: string; department: string }> = [];
      if (id && counts[id]) { served += counts[id].count; servedDept = counts[id].dept; visitorsList.push(...counts[id].visitors); used.add(id); }
      if (counts[name]) { served += counts[name].count; servedDept = servedDept || counts[name].dept; visitorsList.push(...counts[name].visitors); used.add(name); }
      const accountDept = e.department?.department_name || e.department?.name || e.department_name;
      return { name, department: accountDept || servedDept || '—', served, visitors: visitorsList };
    });
    Object.entries(counts).forEach(([key, v]) => {
      if (!used.has(key)) rows.push({ name: v.name, department: v.dept || '—', served: v.count, visitors: v.visitors });
    });
    return rows.sort((a, b) => b.served - a.served);
  }, [employees, filteredServed]);

  // Departments vs services mirrored chart: people served (left) against the
  // department's busiest employee and their services handled (right), busiest
  // departments first. Departments where no one served still get an employee
  // name with a zero bar. Returns every department; the card shows the top rows.
  const deptVsServices = useMemo(() => {
    if (!data) return [] as Array<{ name: string; staff: number; served: number; emp: { name: string; served: number } }>;
    const servedByDept: Record<string, number> = {};
    filteredServed.forEach(r => { servedByDept[r.department] = (servedByDept[r.department] || 0) + 1; });
    const staffByDept: Record<string, number> = {};
    data.departments.forEach(d => { staffByDept[d.name] = d.staff; });
    // Who actually served: tally services per provider inside each department from
    // the same records that feed the left side, then keep the busiest provider
    const perDeptProvider: Record<string, Record<string, number>> = {};
    filteredServed.forEach(r => {
      const provider = r.providerName || 'Unknown provider';
      if (!perDeptProvider[r.department]) perDeptProvider[r.department] = {};
      perDeptProvider[r.department][provider] = (perDeptProvider[r.department][provider] || 0) + 1;
    });
    // Keyed by normalized department name so casing/spacing differences
    // between the department list, service records and employee accounts still match
    const norm = (s: string) => s.trim().toLowerCase();
    const topEmpByDept: Record<string, { name: string; served: number }> = {};
    Object.entries(perDeptProvider).forEach(([dept, providers]) => {
      const [topName, topCount] = Object.entries(providers).sort((a, b) => b[1] - a[1])[0];
      topEmpByDept[norm(dept)] = { name: topName, served: topCount };
    });
    // Departments with no serving records fall back to one of their employees at zero
    employees.forEach((e: any) => {
      const dept = e.department?.department_name || e.department?.name || e.department_name;
      if (dept && !topEmpByDept[norm(dept)]) {
        topEmpByDept[norm(dept)] = { name: e.full_name || 'Unknown', served: 0 };
      }
    });
    const names = Array.from(new Set([...data.departments.map(d => d.name), ...Object.keys(servedByDept)]));
    return names
      .map(name => ({
        name,
        staff: staffByDept[name] || 0,
        served: servedByDept[name] || 0,
        emp: topEmpByDept[norm(name)] || { name: 'No employee', served: 0 },
      }))
      .sort((a, b) => b.served - a.served);
  }, [data, filteredServed, employees]);
  const maxEmployeeServed = Math.max(...employeeServed.map(e => e.served), 1);
  // Mean load among employees who served at least one person; anyone above
  // 1.5× this is highlighted as overloaded in the workload chart
  const avgEmployeeLoad = useMemo(() => {
    const active = employeeServed.filter(e => e.served > 0);
    return active.length ? active.reduce((sum, e) => sum + e.served, 0) / active.length : 0;
  }, [employeeServed]);
  // Expanded employee row (shows the visitors they served) in the employees detail modal
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  // Sentiment filter inside the ratings & sentiment analysis modal
  const [sentimentFilter, setSentimentFilter] = useState<'all' | Sentiment>('all');

  // Filter inside the employee account status modal; statuses use the same
  // fields as the stats endpoint: is_active and access_control.is_locked
  const [empStatusFilter, setEmpStatusFilter] = useState<'all' | 'active' | 'inactive' | 'locked'>('all');
  const empStatusFiltered = useMemo(
    () =>
      employees.filter((e: any) =>
        empStatusFilter === 'all' ? true
        : empStatusFilter === 'locked' ? !!e.access_control?.is_locked
        : empStatusFilter === 'active' ? !!e.is_account_activated
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

  // Same departments climbing from worst to best rating, so negative sentiment
  // sits on the left and the highest-rated department is the tallest bar on the right
  const sentimentTrend = useMemo(
    () => [...deptRatings].sort((a, b) => a.rating - b.rating),
    [deptRatings]
  );

  // Empty-state flags so cards show a message instead of a blank chart
  const hasHourlyParking = !!data && data.hourlyParking.some(h => (h.check_in || 0) > 0 || (h.check_out || 0) > 0);

  // Check-ins per local hour within a period, straight from the visitors list so
  // the gauge matches the rest of the dashboard and refreshes with socket updates.
  // The dial is dynamic: an 11-hour window that slides with the clock (8 hours
  // back, 2 ahead), plus any hour in the period with activity.
  const buildHourRows = useCallback((p: PeriodChoice) => {
    const counts: Record<number, number> = {};
    const now = new Date();
    visitors.forEach((v: any) => {
      if (!v?.entry_date || !isDateInPeriod(v.entry_date, p)) return;
      const t = new Date(v.entry_date);
      if (isNaN(t.getTime())) return;
      counts[t.getHours()] = (counts[t.getHours()] || 0) + 1;
    });
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
  }, [visitors, isDateInPeriod]);
  const gaugeHours = useMemo(() => buildHourRows(period), [buildHourRows, period]);
  const hasGaugeData = gaugeHours.some(g => g.count > 0);

  // The hourly detail modal has its own period filter; null means it follows
  // the toolbar filter (it resets to that each time the modal opens)
  const [modalHourPeriod, setModalHourPeriod] = useState<PeriodChoice | null>(null);
  const modalHourPeriodEff: PeriodChoice = modalHourPeriod ?? period;
  const modalHours = useMemo(() => buildHourRows(modalHourPeriodEff), [buildHourRows, modalHourPeriodEff]);

  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
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

  // Ratings-analysis rows narrowed to the selected sentiment
  const filteredRatings = useMemo(
    () => modalData.filter((f: any) => sentimentFilter === 'all' || classifySentiment(f.rate, f.rate_out_of) === sentimentFilter),
    [modalData, sentimentFilter]
  );
  
  const chartsRef = useRef<Map<string, Chart>>(new Map());

   // Fetch real data; silent mode refreshes in the background (socket updates)
  // without tearing the page down to the loading spinner
  const fetchData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const [
        employeesRes, servicesRes, flaggedStatsRes,
        feedbackTotalsRes, feedbackAvgRes, hourlyParkingRes, hourlyServiceRes, departmentsRes,
        flaggedCountRes, visitorsRes, allEmployeesRes
      ] = await Promise.all([
        statisticsService.getEmployeeStats(),
        statisticsService.getServiceDeliveryStats(),
        statisticsService.getFlaggedVehiclesStats(),
        statisticsService.getFeedbackTotals(),
        statisticsService.getFeedbackAverageByDepartment(),
        statisticsService.getHourlyParkingStats(),
        statisticsService.getHourlyServiceDeliveryStats(),
        statisticsService.getDepartmentsWithLeaders(),
        parkingService.getFlaggedActiveVehicles(1, 1000), // Get count for KPI
        serviceDeliveryService.getAll(1, 1000, 'all'), // Every visitor (in-house + checked out) with per-service provider + date
        employeeService.getAll(1, 1000), // Full employee list for the served-by breakdown
      ]);
      
      const employees = (employeesRes as any)?.data || employeesRes;
      const services = (servicesRes as any)?.data || servicesRes;
      const flaggedStats = (flaggedStatsRes as any)?.data || flaggedStatsRes;
      const feedbackTotals = (feedbackTotalsRes as any)?.data || feedbackTotalsRes;
      const flaggedCount = flaggedCountRes;
      const feedbackAvg = (feedbackAvgRes as any)?.data || feedbackAvgRes;
      const hourlyParkingRaw = (hourlyParkingRes as any)?.data?.hourly || (hourlyParkingRes as any) || [];
      const hourlyServiceRaw = (hourlyServiceRes as any)?.data?.hourly || (hourlyServiceRes as any) || [];
      const departmentsRaw = (departmentsRes as any)?.data?.departments || (departmentsRes as any)?.departments || [];
      const visitorsRaw = (visitorsRes as any)?.data || [];
      const allEmployeesRaw = (allEmployeesRes as any)?.data || [];
      setVisitors(Array.isArray(visitorsRaw) ? visitorsRaw : []);
      setEmployees(Array.isArray(allEmployeesRaw) ? allEmployeesRaw : []);

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
            count: flaggedCount?.total || 0,
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
    }
  }, [showError]);
  
  // Create all charts with whole number Y-axis
  const createCharts = useCallback(() => {
    if (!data) return;
    
    // Destroy existing charts
    chartsRef.current.forEach(chart => chart.destroy());
    chartsRef.current.clear();
    
    const deptNames = data.departments.map(d => d.name);

    // CHART 8 config · "Employees per department" — color: backgroundColor, thickness: maxBarThickness, size: h-80 div in JSX
    const empCanvas = document.getElementById('chart-employees') as HTMLCanvasElement;
    if (empCanvas && deptNames.length) {
      const empData = data.departments.map(d => d.staff);
      const maxEmp = Math.max(...empData, 1);
      
      chartsRef.current.set('employees', new Chart(empCanvas, {
        type: 'bar',
        data: {
          labels: deptNames,
          datasets: [{
            data: empData,
            backgroundColor: CC.purple,
            barPercentage: 0.85,
            categoryPercentage: 0.9,
            // Same bar thickness as the Average Rating by Department chart
            maxBarThickness: 16,
            borderRadius: 0,
            label: 'Employees'
          }]
        },
        options: {
          ...getChartConfig(maxEmp),
          indexAxis: 'y',
          scales: {
            x: {
              ...getChartConfig(maxEmp).scales.x,
              ticks: {
                callback: (value: any) => Math.round(Number(value)).toString(),
                stepSize: 1,
                font: { size: 12 },
                color: '#374151',
              }
            },
            y: {
              grid: { display: false },
              ticks: { font: { size: 12, weight: 600 }, color: '#1f2937' }
            }
          }
        }
      }));
    }
    
    // CHART 9 config · "Employee account status" donut — slice colors: backgroundColor array, ring: cutout, size: canvas classes in JSX
    const statusCanvas = document.getElementById('chart-status') as HTMLCanvasElement;
    if (statusCanvas) {
      chartsRef.current.set('status', new Chart(statusCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Activated', 'Not activated', 'Locked'],
          datasets: [{
            data: [data.employeeStats.active, data.employeeStats.inactive, data.employeeStats.locked],
            backgroundColor: [CC.blue, CC.amber, CC.red],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: any) => `${ctx.label}: ${Math.round(ctx.raw)}`
              }
            }
          }
        }
      }));
    }

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
      'car_checkedin', 'car_checkedout',
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
          console.log('Rating analysis response:', response);
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
                borderRadius: 4,
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
  
  if (loading || !data) {
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
      {/* Scopes the soft rounded dashboard theme to this page only (globals.css .cok-mayor-dash) */}
      <div className="cok-mayor-dash">
      {/* CoK design-rule page header for the mayor account */}
      {isMayor && (
        <div className="px-4 pt-3 pb-2">
          <h1
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: '-0.5px',
              color: '#34A8DB',
              margin: 0,
            }}
          >
            Dashboard
          </h1>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-500"><path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" strokeWidth="1.2"/></svg>
          <label className="font-medium">Period</label>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value as typeof period)}
            className="text-xs px-2 py-1 border border-gray-300 rounded bg-white"
          >
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="lastweek">Last week</option>
            <option value="month">This month</option>
            <option value="lastmonth">Last month</option>
            <option value="all">All</option>
            <option value="range">Custom range</option>
          </select>
          {period === 'range' && (
            <>
              <input
                type="date"
                value={rangeFrom}
                onChange={e => setRangeFrom(e.target.value)}
                className="text-xs px-1.5 py-1 border border-gray-300 rounded bg-white"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={rangeTo}
                onChange={e => setRangeTo(e.target.value)}
                className="text-xs px-1.5 py-1 border border-gray-300 rounded bg-white"
              />
            </>
          )}
        </div>
        <button
          onClick={() => fetchData()}
          className="ml-auto text-xs px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M13.65 2.35A7.958 7.958 0 008 0C4.69 0 1.99 2.24 1.25 5.4m-.9 5.25A7.958 7.958 0 008 16c3.31 0 6.01-2.24 6.75-5.4M16 6l-4-4-4 4M0 10l4 4 4-4" stroke="white" strokeWidth="1.5" fill="none"/></svg>
          Refresh
        </button>
        {!isMayor && (
          <>
            <span className="flex items-center gap-1 text-xs" title={isConnected ? 'Real-time updates active' : 'Real-time updates unavailable — use Refresh'}>
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: isConnected ? '#4CAF50' : '#9E9E9E' }}
              ></span>
              <span className="text-gray-500">{isConnected ? 'Live' : 'Offline'}</span>
            </span>
            <span className="text-xs text-gray-500 hidden lg:inline">{lastRefresh.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </>
        )}
      </div>
      
      {/* Main Content */}
      <div className="p-3 space-y-2.5">
        
        {/* CHART 1 · "Departments vs services" — drawn by DeptServicesMirror (top of file); colors from CC */}
        <div className="bg-white border border-gray-200 p-4 sm:p-5 rounded-lg shadow-sm hover:shadow-md transition-all">
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
                Click <span style={{ color: CC.amber }} className="font-semibold">left</span> for departments · <span style={{ color: CC.blue }} className="font-semibold">right</span> for employees
              </div>
            </div>
          </div>

          {deptVsServices.length === 0 ? (
            <div className="h-40 w-full flex items-center justify-center text-xs text-gray-400">
              No department data available yet
            </div>
          ) : (
            <DeptServicesMirror
              rows={deptVsServices.slice(0, 8)}
              cc={CC}
              onLeftClick={() => setSelectedCard('dept-served')}
              onRightClick={() => setSelectedCard('employee-served')}
            />
          )}
        </div>

        {/* CHARTS 2 & 3 · "Requests" histograms — height: h-56 divs, colors: fill= on each <Bar>, bar width: maxBarSize */}
        <div className="bg-white border border-gray-200 p-4 sm:p-5 rounded-lg shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="text-base font-bold text-gray-900">Requests</div>
              <div className="text-xs text-gray-500 mt-0.5">Visitor requests by status · {periodLabel}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-bold leading-none" style={{ color: CC.purple }}>{requestStatuses.avgPerDept}</div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 mt-1">Avg requests / department</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 mb-3">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: CC.amber }}></div>Pending</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: CC.blue }}></div>In progress</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: CC.teal }}></div>Completed</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: CC.red }}></div>Overdue</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: CC.amber }}>Departments</span>
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
                      <Bar dataKey="pending" name="Pending" fill={CC.amber} maxBarSize={32} />
                      <Bar dataKey="inprogress" name="In progress" fill={CC.blue} maxBarSize={32} />
                      <Bar dataKey="completed" name="Completed" fill={CC.teal} maxBarSize={32} />
                      <Bar dataKey="overdue" name="Overdue" fill={CC.red} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: CC.blue }}>Employees</span>
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
                      <Bar dataKey="pending" name="Pending" fill={CC.amber} maxBarSize={32} />
                      <Bar dataKey="inprogress" name="In progress" fill={CC.blue} maxBarSize={32} />
                      <Bar dataKey="completed" name="Completed" fill={CC.teal} maxBarSize={32} />
                      <Bar dataKey="overdue" name="Overdue" fill={CC.red} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
        </div>

        {/* Ratings row — department averages (left) next to the banded avg-feedback chart (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {/* CHART 4 · "Average Rating by Department" — height: h-64 div, color: fill= on <Bar>, thickness: barSize */}
          <div
            onClick={() => { setSentimentFilter('all'); handleCardClick('rating-analysis'); }}
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
                    <Bar dataKey="rating" fill={COK.primary} radius={[0, 0, 0, 0]} barSize={16} />
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
          <div className="text-[11px] uppercase tracking-wide text-gray-400 mt-0.5 mb-2">From negative to positive · avg rating out of 10</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mb-2">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: SENTIMENT_META.negative.color }}></div>Negative (&lt;4)</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: SENTIMENT_META.neutral.color }}></div>Neutral (4–6.9)</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: SENTIMENT_META.positive.color }}></div>Positive (7+)</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded" style={{ backgroundColor: CC.blue }}></div>Rating trend</div>
          </div>
          {sentimentTrend.length === 0 ? (
            <p className="text-sm text-gray-500" style={{ fontFamily: COK.bodyFont }}>No department feedback yet.</p>
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
                  <RTooltip
                    cursor={{ fill: COK.neutralLight }}
                    contentStyle={{ border: `1px solid ${COK.border}`, borderRadius: 0, fontSize: 12 }}
                    formatter={(value: any, name: any, entry: any) =>
                      name === 'Rating trend'
                        ? [null, null]
                        : [`${value}/10 · ${SENTIMENT_META[classifySentiment(Number(value), 10)].label} (${entry?.payload?.count} feedback)`, 'Avg rating']
                    }
                  />
                  <Bar dataKey="rating" name="Avg rating" barSize={34} radius={[0, 0, 0, 0]}>
                    {sentimentTrend.map((d, i) => (
                      <Cell key={i} fill={SENTIMENT_META[classifySentiment(d.rating, 10)].color} />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="rating"
                    name="Rating trend"
                    stroke={CC.blue}
                    strokeWidth={2}
                    dot={{ r: 4, fill: CC.blue, stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          </div>
        </div>

        {/* CHART 6 · "Hourly service check-ins" — drawn by HourGauge (top of file); edit bars/colors there */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          <div
            onClick={() => { setModalHourPeriod(null); handleCardClick('service-hourly'); }}
            className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Hourly service check-ins</div>
              </div>
              <span className="text-xs text-gray-400">Click for details</span>
            </div>
            {hasGaugeData ? (
              <HourGauge hours={gaugeHours} />
            ) : (
              <div className="h-48 w-full flex items-center justify-center text-xs text-gray-400">
                No visitor check-ins recorded · {periodLabel}
              </div>
            )}
          </div>

          {/* CHART 7 · "Parking Usage Trends" — height: h-48 div, colors: stroke (line) + fill (shade) on each <Area> */}
          <div className="bg-white border border-gray-200 p-3">
            <div className="mb-3">
              <div className="text-sm font-semibold text-gray-900">Parking Usage Trends</div>
              <div className="text-xs text-gray-500">Check-ins vs check-outs · today</div>
            </div>
            {hasHourlyParking ? (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.hourlyParking}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tickFormatter={(v: number) => `${v}:00`} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip />
                    <Legend />
                    <Area type="monotone" dataKey="check_in" stroke="#3b82f6" fill="rgba(59,130,246,0.1)" name="Check-ins" />
                    <Area type="monotone" dataKey="check_out" stroke="#ef4444" fill="rgba(239,68,68,0.1)" name="Check-outs" />
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
                {/* CHART 8 · "Employees per department" — height: h-80 div; color/thickness in createCharts (search: CHART 8 config) */}
                <div className="grid grid-cols-1 gap-2.5">
                  <div
                    onClick={() => handleCardClick('employees-detail')}
                    className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="inline-block border border-gray-300 px-3 py-1.5">
                        <div className="text-base font-bold text-gray-900">Employees per department</div>
                        <div className="text-xs text-gray-500">Staff headcount</div>
                      </div>
                      <button className="text-gray-400 text-lg">⋯</button>
                    </div>
                    <div className="flex gap-3 text-xs mb-2">
                      <div className="flex items-center gap-1"><div className="w-2 h-2 bg-purple-600"></div>Headcount</div>
                    </div>
                    <div className="h-80 w-full">
                      <canvas id="chart-employees"></canvas>
                    </div>
                  </div>
                </div>
                
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
                onClick={() => { setEmpStatusFilter('all'); setSelectedCard('employee-status'); }}
                className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Employee account status</div>
                    <div className="text-xs text-gray-500">Activation and lock state</div>
                  </div>
                  <span className="text-xs text-gray-400">Click to view employees</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs mb-3">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-600"></div>Activated {data.employeeStats.active}</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-500"></div>Not activated {data.employeeStats.inactive}</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-600"></div>Locked {data.employeeStats.locked}</div>
                </div>
                <div className="h-32 w-full flex justify-center">
                  <canvas id="chart-status" className="max-w-[150px] max-h-[150px]"></canvas>
                </div>
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
            style={selectedCard === 'employee-status' || selectedCard === 'rating-analysis' || selectedCard === 'employees-detail' || selectedCard === 'service-hourly' ? { borderRadius: 0 } : undefined}
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
                                  <span className={`px-1 sm:px-2 py-1 text-xs rounded ${employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {employee.is_active ? 'Active' : 'Inactive'}
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
                                  <span className={`px-1 sm:px-2 py-1 text-xs rounded ${record.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
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
                                  <span className={`px-1 sm:px-2 py-1 text-xs rounded ${visitor.is_still_inhouse ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
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
                                  <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
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
                      { key: 'all', label: 'All', count: employees.length, chip: 'bg-gray-100 text-gray-700 border-gray-300' },
                      { key: 'active', label: 'Activated', count: employees.filter((e: any) => !!e.is_account_activated).length, chip: 'bg-green-100 text-green-800 border-green-300' },
                      { key: 'inactive', label: 'Not activated', count: employees.filter((e: any) => !e.is_account_activated).length, chip: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
                      { key: 'locked', label: 'Locked', count: employees.filter((e: any) => !!e.access_control?.is_locked).length, chip: 'bg-red-100 text-red-800 border-red-300' },
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
                                  </div>
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

              {selectedCard === 'dept-served' && (
                <div className="space-y-4">
                  {/* Headline stats — all obey the toolbar period filter */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-600">
                    <span>Period: <span className="font-semibold capitalize">{periodLabel}</span></span>
                    <span><span className="font-semibold" style={{ color: CC.blue }}>{totalVisitorsInPeriod}</span> total visitors</span>
                    <span><span className="font-semibold" style={{ color: CC.amber }}>{filteredServed.length}</span> people served</span>
                  </div>
                  {deptVsServices.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-xs text-gray-400">
                      No department data available yet
                    </div>
                  ) : (
                    <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-2">
                      {deptVsServices.map((d, idx) => {
                        const maxServedAll = Math.max(...deptVsServices.map(r => r.served), 1);
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs hover:bg-gray-50 rounded px-1 py-1">
                            <span className="w-44 sm:w-56 flex-shrink-0 truncate text-right font-medium text-gray-800" title={d.name}>
                              {d.name} <span className="text-gray-400 font-normal">({d.staff} staff)</span>
                            </span>
                            <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                              {d.served > 0 && (
                                <div
                                  className="h-full rounded transition-all duration-500"
                                  style={{
                                    width: `${(d.served / maxServedAll) * 100}%`,
                                    minWidth: 4,
                                    backgroundColor: CC.amber,
                                    backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.06), rgba(255,255,255,0.25))',
                                  }}
                                ></div>
                              )}
                            </div>
                            <span className="w-10 text-right font-semibold" style={{ color: d.served > 0 ? CC.amber : '#9ca3af' }}>{d.served}</span>
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
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 inline-block rounded-sm" style={{ backgroundColor: CC.blue }}></span>Normal load</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 inline-block rounded-sm" style={{ backgroundColor: CC.red }}></span>Overloaded (above 1.5× average)</span>
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
                              className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
                            >
                              <span className="w-3 flex-shrink-0 text-gray-400">{isOpen ? '▾' : '▸'}</span>
                              <span className="w-36 sm:w-44 flex-shrink-0 truncate font-medium text-gray-800" title={e.name}>{e.name}</span>
                              <span className="w-28 sm:w-40 flex-shrink-0 truncate text-gray-400" title={e.department}>{e.department}</span>
                              <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                                {e.served > 0 && (
                                  <div
                                    className="h-full rounded transition-all duration-500"
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
                        {/* Sentiment filter chips with live counts */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          <button
                            onClick={() => setSentimentFilter('all')}
                            className={`px-3 py-1.5 text-xs font-semibold border bg-gray-100 text-gray-700 border-gray-300 transition-colors ${sentimentFilter === 'all' ? 'ring-2 ring-blue-400' : 'opacity-80 hover:opacity-100'}`}
                          >
                            All ({modalData.length})
                          </button>
                          {(['positive', 'neutral', 'negative'] as Sentiment[]).map(s => {
                            const count = modalData.filter((f: any) => classifySentiment(f.rate, f.rate_out_of) === s).length;
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
                        {/* Same table design rules as the event-manager events table:
                            bordered container, CoK-blue uppercase header, zebra rows, bordered cells */}
                        <div className="overflow-auto max-h-[55vh] border-2 border-gray-300">
                          <table className="w-full border-collapse table-auto min-w-[640px]">
                            <thead className="sticky top-0 z-10">
                              <tr>
                                {['Rating', 'Sentiment', 'Department', 'Comment', 'From', 'Date'].map(label => (
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
                              {filteredRatings.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="px-4 py-16 text-center bg-white">
                                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">No ratings for this sentiment</span>
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
                                      <span
                                        className="inline-flex flex-col items-center justify-center w-11 h-11"
                                        style={{ backgroundColor: `${meta.color}1A`, borderLeft: `3px solid ${meta.color}` }}
                                      >
                                        <span style={{ fontFamily: COK.headingFont, fontSize: 15, fontWeight: 700, color: meta.color }}>
                                          {f.rate ?? ''}
                                        </span>
                                        <span className="text-[9px] text-gray-400">/ {f.rate_out_of || 10}</span>
                                      </span>
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
                        value={modalHourPeriodEff}
                        onChange={e => setModalHourPeriod(e.target.value as PeriodChoice)}
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
            </div>
          </div>
        </div>
      )}
      </div>
    </MainLayout>
  );
};

export default Overview;