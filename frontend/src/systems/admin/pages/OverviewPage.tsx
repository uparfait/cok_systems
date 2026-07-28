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
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell, LabelList, AreaChart, Area, CartesianGrid, Legend } from 'recharts';
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

  // Mayor accounts use the City of Kigali design-rule palette for charts
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
  const [recentParking, setRecentParking] = useState<any[]>([]);
  const [recentVisitors, setRecentVisitors] = useState<any[]>([]);
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

  // Toolbar period filter: today / this week / last week / this month / last month /
  // all records / custom from→to range (inclusive). Weeks run Monday → Sunday.
  const isInPeriod = useCallback((dateStr?: string) => {
    if (period === 'all') return true;
    if (!dateStr) return false;
    const t = new Date(dateStr);
    if (isNaN(t.getTime())) return false;
    const now = new Date();
    if (period === 'today') return t.toDateString() === now.toDateString();
    if (period === 'week' || period === 'lastweek') {
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      if (period === 'week') return t >= monday;
      const lastMonday = new Date(monday);
      lastMonday.setDate(monday.getDate() - 7);
      return t >= lastMonday && t < monday;
    }
    if (period === 'month') return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth();
    if (period === 'lastmonth') {
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
  }, [period, rangeFrom, rangeTo]);

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
    const deptMap: Record<string, { pending: number; inprogress: number; completed: number }> = {};
    const empMap: Record<string, { pending: number; inprogress: number; completed: number }> = {};
    let total = 0;
    visitors.forEach((v: any) => {
      if (!isInPeriod(v?.entry_date)) return;
      (v?.services_status || []).forEach((s: any) => {
        if (!s?.department_name) return;
        const status: 'pending' | 'inprogress' | 'completed' =
          s.s_type === 'Completed' ? 'completed' : s.s_type === 'Inprogress' ? 'inprogress' : 'pending';
        total += 1;
        if (!deptMap[s.department_name]) deptMap[s.department_name] = { pending: 0, inprogress: 0, completed: 0 };
        deptMap[s.department_name][status] += 1;
        const empName = s.provider_name && s.provider_name !== 'Not specified' ? s.provider_name : 'Unassigned';
        if (!empMap[empName]) empMap[empName] = { pending: 0, inprogress: 0, completed: 0 };
        empMap[empName][status] += 1;
      });
    });
    const toRows = (m: Record<string, { pending: number; inprogress: number; completed: number }>) =>
      Object.entries(m)
        .map(([name, v]) => ({
          name: name.length > 14 ? name.slice(0, 13) + '…' : name,
          fullName: name,
          ...v,
          total: v.pending + v.inprogress + v.completed,
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
      const sampleRows = (names: string[]) =>
        names.map((name, i) => ({
          name: name.length > 14 ? name.slice(0, 13) + '…' : name,
          fullName: name,
          pending: P[i % P.length],
          inprogress: I[i % I.length],
          completed: C[i % C.length],
          total: P[i % P.length] + I[i % I.length] + C[i % C.length],
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

  const periodLabel =
    period === 'today' ? 'today'
    : period === 'week' ? 'this week'
    : period === 'lastweek' ? 'last week'
    : period === 'month' ? 'this month'
    : period === 'lastmonth' ? 'last month'
    : period === 'all' ? 'all time'
    : `${rangeFrom || 'start'} → ${rangeTo || 'now'}`;

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

  // Empty-state flags so cards show a message instead of a blank chart
  const hasHourlyService = !!data && data.hourlyService.some(h => (h.visitors_checked_in || 0) > 0);
  const hasHourlyParking = !!data && data.hourlyParking.some(h => (h.check_in || 0) > 0 || (h.check_out || 0) > 0);

  const recentCheckIns = useMemo(() => {
    const items: any[] = [];
    (recentParking || []).forEach((p: any) => {
      const time = p.checkInTime || p.check_in || p.entry_date;
      items.push({
        id: `parking-${p._id || Math.random()}`,
        type: 'parking',
        name: p.plate_number || p.plateNumber || p.driver_name || p.vehicle || 'Unknown vehicle',
        time: time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
      });
    });
    (recentVisitors || []).forEach((v: any) => {
      const time = v.checkInTime || v.check_in || v.entry_date;
      items.push({
        id: `visitor-${v._id || Math.random()}`,
        type: 'visitor',
        name: v.full_name || v.name || v.visitorName || `Visitor ${v.badge_number || ''}`.trim() || 'Unknown visitor',
        time: time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
      });
    });
    return items.sort((a, b) => b.time.localeCompare(a.time));
  }, [recentParking, recentVisitors]);

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
  
  const chartsRef = useRef<Map<string, Chart>>(new Map());

   // Fetch real data; silent mode refreshes in the background (socket updates)
  // without tearing the page down to the loading spinner
  const fetchData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const [
        employeesRes, servicesRes, flaggedStatsRes,
        feedbackTotalsRes, feedbackAvgRes, hourlyParkingRes, hourlyServiceRes, departmentsRes,
        flaggedCountRes, visitorsRes, allEmployeesRes, recentParkingRes
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
        parkingService.getAllPaginated(1, 10, 'all'), // Recent parking check-ins
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
      const recentParkingRaw = (recentParkingRes as any)?.data || [];
      setVisitors(Array.isArray(visitorsRaw) ? visitorsRaw : []);
      setEmployees(Array.isArray(allEmployeesRaw) ? allEmployeesRaw : []);
      setRecentParking(Array.isArray(recentParkingRaw) ? recentParkingRaw : []);
      const sortedVisitors = (visitorsRaw as any[]).slice().sort((a: any, b: any) =>
        new Date(b.entry_date || 0).getTime() - new Date(a.entry_date || 0).getTime()
      );
      setRecentVisitors(sortedVisitors.slice(0, 10));
      
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
          active: employees?.active || 0,
          inactive: employees?.inactive || 0,
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
    const filteredHourlyService = data.hourlyService.filter((h: any) => SERVICE_HOURS.includes(h.hour.toString()));
    const visitorData = filteredHourlyService.map(h => h.visitors_checked_in);
    const formattedServiceHourLabels = filteredHourlyService.map((h: any) => formatHourLabel(h.hour));
    const maxVisitor = Math.max(...visitorData, 1);

    // 3. Employees Chart (Bar chart)
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
            barPercentage: 0.6,
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
              ticks: { callback: (value: any) => Math.round(Number(value)).toString(), stepSize: 1 }
            },
            y: { grid: { display: false } }
          }
        }
      }));
    }
    
    // 6. Hourly Service Check-ins (columns + 3-hour moving-average trend line, one shared axis)
    const svcHourCanvas = document.getElementById('chart-service-hourly') as HTMLCanvasElement;
    if (svcHourCanvas) {
      const movingAvg = visitorData.map((_, i) => {
        const windowVals = visitorData.slice(Math.max(0, i - 2), i + 1);
        return windowVals.reduce((a, b) => a + b, 0) / windowVals.length;
      });
      chartsRef.current.set('serviceHourly', new Chart(svcHourCanvas, {
        type: 'bar',
        data: {
          labels: formattedServiceHourLabels,
          datasets: [
            {
              type: 'bar',
              label: 'Visitors',
              data: visitorData,
              backgroundColor: CC.teal,
              borderRadius: 4,
              borderSkipped: 'start',
              maxBarThickness: 18,
              barPercentage: 0.6,
              categoryPercentage: 0.8,
              valueLabels: 'max',
            } as any,
            {
              type: 'line',
              label: '3-hr average',
              data: movingAvg,
              borderColor: CC.purple,
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 4,
              pointBackgroundColor: CC.purple,
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              tension: 0.4,
              fill: false,
            } as any,
          ]
        },
        options: {
          ...getChartConfig(maxVisitor),
          layout: { padding: { top: 12 } },
        },
        plugins: [barValueLabels]
      }));
    }
    
    // 7. Employee Status Chart (Donut)
    const statusCanvas = document.getElementById('chart-status') as HTMLCanvasElement;
    if (statusCanvas) {
      chartsRef.current.set('status', new Chart(statusCanvas, {
        type: 'doughnut',
        data: { 
          labels: ['Active', 'Inactive', 'Locked'], 
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

  // Create modal charts when selectedCard changes
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

    if (selectedCard === 'service-hourly' && modalData.length > 0) {
      const createModalChart = () => {
        const modalCanvas = document.getElementById('modal-service-hourly-chart') as HTMLCanvasElement;
        if (modalCanvas) {
          // Destroy existing chart
          const existingChart = chartsRef.current.get('modal-service-hourly');
          if (existingChart) {
            existingChart.destroy();
          }

          const formattedServiceHourLabels = modalData.filter((h: any) => SERVICE_HOURS.includes(h.hour.toString())).map((h: any) => formatHourLabel(h.hour));
          const visitorData = modalData.filter((h: any) => SERVICE_HOURS.includes(h.hour.toString())).map((hour: any) => hour.visitors_checked_in || 0);
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
  }, [selectedCard, modalData]);

  // Handle pagination change
  const handlePageChange = useCallback((newPage: number) => {
    if (selectedCard) {
      fetchModalData(selectedCard, newPage, modalPagination.limit);
    }
  }, [selectedCard, modalPagination.limit, fetchModalData]);

  // Sentiment breakdown of the feedback loaded into the rating-analysis modal
  const modalSentiment = useMemo(() => {
    const counts: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
    if (selectedCard === 'rating-analysis') {
      modalData.forEach((f: any) => {
        counts[classifySentiment(f.rate, f.rate_out_of)] += 1;
      });
    }
    return counts;
  }, [selectedCard, modalData]);
  const modalSentimentData = (['positive', 'neutral', 'negative'] as Sentiment[]).map(s => ({
    name: SENTIMENT_META[s].label,
    value: modalSentiment[s],
    color: SENTIMENT_META[s].color,
  }));
  const modalSentimentTotal = modalData.length || 1;

  // Computed values (rounded, no decimals)
  const avgRating = data ? Math.round(data.feedbackAvg.overall_average.average_rating) : 0;
  const maxStaff = data ? Math.max(...data.departments.map(d => d.staff), 1) : 1;
  
  // Get color based on rating
  const getRatingColor = (rating: number) => {
    if (rating >= 9) return 'text-emerald-600';
    if (rating >= 7) return 'text-blue-600';
    if (rating >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };
  
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
        
        {/* Departments vs services  mirrored comparison of people served and workload per employee.
            Each half of the chart opens its own detail view. */}
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

        {/* Requests histogram — status of visitor requests, departments (left) and employees (right) */}
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
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: CC.amber }}>Departments</span>
                  <span className="text-xs text-gray-500">(incoming requests)</span>
                </div>
                <div className="h-56">
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
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: CC.blue }}>Employees</span>
                  <span className="text-xs text-gray-500">(request progress)</span>
                </div>
                <div className="h-56">
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
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
        </div>

        {/* Ratings row — department averages (left) next to the banded avg-feedback chart (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {/* Average rating by department — same design as the feedback-analysis chart;
              click opens the ratings table + sentiment distribution */}
          <div
            onClick={() => handleCardClick('rating-analysis')}
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

          {/* Avg feedback rating — vertical column chart, bars colored by rating band */}
          <div className="bg-white p-4" style={{ border: `1px solid ${COK.border}` }}>
            <h3 style={{ fontFamily: COK.headingFont, fontSize: 15, fontWeight: 600, color: COK.neutralDark, margin: 0 }}>
              Avg Feedback Rating
            </h3>
            <div className="text-[11px] uppercase tracking-wide text-gray-400 mt-0.5 mb-2">By department · out of 10</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mb-2">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: '#059669' }}></div>Excellent (9–10)</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: '#2563eb' }}></div>Good (7–8)</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: '#eab308' }}></div>Average (5–6)</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5" style={{ backgroundColor: '#dc2626' }}></div>Poor (&lt;5)</div>
            </div>
            {deptRatings.length === 0 ? (
              <p className="text-sm text-gray-500" style={{ fontFamily: COK.bodyFont }}>No department feedback yet.</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptRatings} margin={{ top: 18, right: 10, left: -22, bottom: 30 }}>
                    <XAxis
                      dataKey="name"
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      axisLine={{ stroke: COK.border }}
                      tickLine={false}
                    />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                    <RTooltip
                      cursor={{ fill: COK.neutralLight }}
                      contentStyle={{ border: `1px solid ${COK.border}`, borderRadius: 0, fontSize: 12 }}
                      formatter={(value: any, _n: any, entry: any) => [`${value}/10 (${entry?.payload?.count} feedback)`, 'Avg rating']}
                    />
                    <Bar dataKey="rating" barSize={28} radius={[0, 0, 0, 0]}>
                      <LabelList dataKey="rating" position="top" style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }} />
                      {deptRatings.map((d, i) => (
                        <Cell key={i} fill={d.rating >= 9 ? '#059669' : d.rating >= 7 ? '#2563eb' : d.rating >= 5 ? '#eab308' : '#dc2626'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Services row — hourly check-ins, full width */}
        <div className="grid grid-cols-1 gap-2.5">
          <div
            onClick={() => handleCardClick('service-hourly')}
            className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Hourly service check-ins</div>
                <div className="text-xs text-gray-500">Visitor arrivals · today</div>
              </div>
              <button className="text-gray-400 text-lg">⋯</button>
            </div>
            <div className="flex gap-3 text-xs mb-2">
              <div className="flex items-center gap-1"><div className="w-2 h-2" style={{ backgroundColor: CC.teal }}></div>Visitors checked in</div>
              <div className="flex items-center gap-1"><div className="w-3 h-0.5 rounded" style={{ backgroundColor: CC.purple }}></div>3-hr average</div>
            </div>
            {hasHourlyService ? (
              <div className="h-36 w-full">
                <canvas id="chart-service-hourly"></canvas>
              </div>
            ) : (
              <div className="h-36 w-full flex items-center justify-center text-xs text-gray-400">
                No visitor check-ins recorded today
              </div>
            )}
          </div>

        </div>

        {/* Overview Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-2.5">
                {/* Parking Usage Trends — same area chart as the admin smart-parking dashboard */}
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
                
                {/* Employees per department */}
                <div className="grid grid-cols-1 gap-2.5">
                  <div
                    onClick={() => handleCardClick('employees-detail')}
                    className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Employees per department</div>
                        <div className="text-xs text-gray-500">Staff headcount</div>
                      </div>
                      <button className="text-gray-400 text-lg">⋯</button>
                    </div>
                    <div className="flex gap-3 text-xs mb-2">
                      <div className="flex items-center gap-1"><div className="w-2 h-2 bg-purple-600"></div>Headcount</div>
                    </div>
                    <div className="h-40 w-full">
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left py-2 px-2 font-semibold text-gray-600">Department</th>
                          <th className="text-left py-2 px-2 font-semibold text-gray-600">Leader</th>
                          <th className="text-left py-2 px-2 font-semibold text-gray-600">Staff</th>
                          <th className="text-left py-2 px-2 font-semibold text-gray-600">Rating</th>
                          <th className="text-left py-2 px-2 font-semibold text-gray-600">Feedback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleDepartments?.map((row, idx) => {
                          const staffPercent = Math.round((row.staff / maxStaff) * 100);
                          return (
                            <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-2 font-medium text-gray-900">{row.name}</td>
                              <td className="py-2 px-2 text-gray-500">{row.leader}</td>
                              <td className="py-2 px-2">
                                <div>{row.staff}</div>
                                <div className="h-1 bg-gray-100 mt-1 w-16">
                                  <div className="h-full bg-purple-600" style={{ width: `${staffPercent}%` }}></div>
                                </div>
                              </td>
                              <td className={`py-2 px-2 font-semibold ${getRatingColor(row.rating)}`}>{row.rating}/10</td>
                              <td className="py-2 px-2 text-gray-500">{row.feedback}</td>
                            </tr>
                          );
                        })}
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
              
              {/* Right Column */}
              <div className="space-y-2.5">
                {/* Flagged Vehicles */}
                <div className="bg-white border border-gray-200 p-3">
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-gray-900">Flagged vehicles</div>
                    <div className="text-xs text-gray-500">Currently flagged</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 p-4 text-center">
                    <div className="text-2xl font-light text-red-600 mb-1">{data.flaggedVehicles.currently_flagged.count}</div>
                    <div className="text-sm text-gray-600 mb-2">Currently flagged</div>
                    <div className="text-xs text-gray-500">
                      Duration: {data.flaggedVehicles.currently_flagged.min_minutes}–{data.flaggedVehicles.currently_flagged.max_minutes} min
                    </div>
                  </div>
                </div>
                
                {/* Recent Check-ins */}
                <div className="bg-white border border-gray-200 p-3">
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-gray-900">Recent check-ins</div>
                    <div className="text-xs text-gray-500">Parking and visitors</div>
                  </div>
                  <div className="space-y-2">
                    {recentCheckIns.length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-3">No recent activity</div>
                    ) : (
                      recentCheckIns.slice(0, 5).map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.type === 'parking' ? 'bg-blue-600' : 'bg-teal-600'}`}></span>
                            <span className="text-gray-700 truncate">{item.name}</span>
                          </div>
                          <span className="text-gray-400 flex-shrink-0 ml-2">{item.time}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Bottom Row */}
            <div className="grid grid-cols-1 gap-2.5">
              <div className="bg-white border border-gray-200 p-3">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Employee account status</div>
                    <div className="text-xs text-gray-500">Activation and lock state</div>
                  </div>
                  <button className="text-gray-400 text-lg">⋯</button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs mb-3">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-600"></div>Active {data.employeeStats.active}</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-500"></div>Inactive {data.employeeStats.inactive}</div>
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
                      {/* Sentiment distribution */}
                      <div>
                        <h4 style={{ fontFamily: COK.headingFont, fontSize: 14, fontWeight: 600, color: COK.neutralDark, margin: '0 0 10px 0' }}>
                          Sentiment Distribution
                        </h4>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {(['positive', 'neutral', 'negative'] as Sentiment[]).map(s => (
                            <div
                              key={s}
                              className="p-2.5 text-center"
                              style={{ backgroundColor: `${SENTIMENT_META[s].color}1A`, borderLeft: `3px solid ${SENTIMENT_META[s].color}` }}
                            >
                              <div style={{ fontFamily: COK.headingFont, fontSize: 18, fontWeight: 700, color: SENTIMENT_META[s].color }}>
                                {modalSentiment[s]}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {SENTIMENT_META[s].label} · {Math.round((modalSentiment[s] / modalSentimentTotal) * 100)}%
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={modalSentimentData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                              <RTooltip cursor={{ fill: COK.neutralLight }} contentStyle={{ border: `1px solid ${COK.border}`, borderRadius: 0, fontSize: 12 }} />
                              <Bar dataKey="value" radius={[0, 0, 0, 0]}>
                                {modalSentimentData.map(entry => (
                                  <Cell key={entry.name} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Ratings table */}
                      <div>
                        <h4 style={{ fontFamily: COK.headingFont, fontSize: 14, fontWeight: 600, color: COK.neutralDark, margin: '0 0 10px 0' }}>
                          Ratings ({modalData.length})
                        </h4>
                        <div className="overflow-x-auto max-h-72 overflow-y-auto">
                          <table className="w-full text-sm border border-gray-200 min-w-[640px]">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                              <tr>
                                <th className="px-3 py-2 text-center border-b whitespace-nowrap">Rating</th>
                                <th className="px-3 py-2 text-center border-b whitespace-nowrap">Sentiment</th>
                                <th className="px-3 py-2 text-left border-b whitespace-nowrap">Department</th>
                                <th className="px-3 py-2 text-left border-b">Comment</th>
                                <th className="px-3 py-2 text-left border-b whitespace-nowrap">From</th>
                                <th className="px-3 py-2 text-left border-b whitespace-nowrap">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {modalData.map((f: any, idx: number) => {
                                const meta = SENTIMENT_META[classifySentiment(f.rate, f.rate_out_of)];
                                return (
                                  <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 border-b`}>
                                    <td className="px-3 py-2 text-center whitespace-nowrap">
                                      <span
                                        className="inline-flex flex-col items-center justify-center w-10 h-10"
                                        style={{ backgroundColor: `${meta.color}1A`, borderLeft: `2px solid ${meta.color}` }}
                                      >
                                        <span style={{ fontFamily: COK.headingFont, fontSize: 14, fontWeight: 700, color: meta.color }}>
                                          {f.rate ?? ''}
                                        </span>
                                        <span className="text-[9px] text-gray-400">/ {f.rate_out_of || 10}</span>
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <CokBadge label={meta.label} color={meta.color} />
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-600">{f.department_name || 'Not specified'}</td>
                                    <td className="px-3 py-2 max-w-xs">
                                      <p className="text-xs truncate" style={{ color: f.textmessage ? '#555555' : '#9E9E9E', fontStyle: f.textmessage ? 'normal' : 'italic', margin: 0 }} title={f.textmessage}>
                                        {f.textmessage || 'No written comment — rating only.'}
                                      </p>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{f.user_name?.trim() || 'Anonymous'}</td>
                                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                                      {f.created_date
                                        ? new Date(f.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                        : '—'}
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
                  ) : (
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-xs sm:text-sm border border-gray-200 min-w-[500px]">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Department</th>
                            <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Leader</th>
                            <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Total Employees</th>
                            <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Created Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalData.map((dept: any, idx: number) => (
                            <tr key={idx} className="border-b hover:bg-gray-50">
                              <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium">{dept.department_name}</td>
                              <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">
                                {dept.department_leader?.full_name || 'Not assigned'}
                              </td>
                              <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">{dept.total_employees || 0}</td>
                              <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                                {dept.created_date ? new Date(dept.created_date).toLocaleDateString() : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {selectedCard === 'service-hourly' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      Visitor arrivals · today
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