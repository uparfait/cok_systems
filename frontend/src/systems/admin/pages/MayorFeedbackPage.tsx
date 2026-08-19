import { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, CartesianGrid } from 'recharts';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { departmentService, statisticsService } from '../../../core/services/adminService';
import { COK, CokLoadingOverlay } from './mayorCok';
import FeedbackFeed from './components/FeedbackFeed';
import type { AppliedFilter, DeptOption, PeriodValue } from './components/FeedbackFeed';

const PRIMARY = '#056daa';
const PRIMARY_HOVER = '#045d94';
const fontHeading = "'Montserrat', sans-serif";

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'year', label: 'This Year' },
  { value: 'range', label: 'Custom Range' },
];

const SENTIMENT_COLORS = { positive: COK.success, neutral: COK.warning, negative: COK.danger };

const periodToRange = (applied: AppliedFilter): { from?: string; to?: string } => {
  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const p = applied.period;
  if (p === 'today') return { from: startOfDay(now).toISOString(), to: now.toISOString() };
  if (p === 'week') {
    const monday = startOfDay(now);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return { from: monday.toISOString(), to: now.toISOString() };
  }
  if (p === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: now.toISOString() };
  if (p === 'last_month') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { from: first.toISOString(), to: last.toISOString() };
  }
  if (p === 'year') return { from: new Date(now.getFullYear(), 0, 1).toISOString(), to: now.toISOString() };
  const r: { from?: string; to?: string } = {};
  if (applied.from) r.from = startOfDay(new Date(applied.from)).toISOString();
  if (applied.to) { const end = new Date(applied.to); end.setHours(23, 59, 59, 999); r.to = end.toISOString(); }
  return r;
};

const wrapLabel = (name: string, max = 18): string[] => {
  const words = String(name || '').split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max && line) { lines.push(line); line = w; }
    else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
};

const DeptNameTick = ({ x, y, payload }: any) => {
  const lines = wrapLabel(payload?.value);
  const startDy = 4 - (lines.length - 1) * 5.5;
  return (
    <text x={x} y={y} textAnchor="end" fill="#555555" fontSize={11} fontFamily={fontHeading}>
      {lines.map((l, i) => (
        <tspan key={i} x={x - 4} dy={i === 0 ? startDy : 12}>{l}</tspan>
      ))}
    </text>
  );
};

interface DeptRow { name: string; rating: number; count: number }

export default function MayorFeedbackPage() {
  const [deptRows, setDeptRows] = useState<DeptRow[]>([]);
  const [sentimentCounts, setSentimentCounts] = useState({ positive: 0, neutral: 0, negative: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [units, setUnits] = useState<DeptOption[]>([]);

  const [period, setPeriod] = useState<PeriodValue>('month');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [applied, setApplied] = useState<AppliedFilter>({ period: 'month' });
  const appliedKey = JSON.stringify(applied);
  const lastKeyRef = useRef('');

  useEffect(() => {
    const silent = lastKeyRef.current === appliedKey;
    lastKeyRef.current = appliedKey;
    let cancelled = false;
    (async () => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const params = {
          period: applied.period,
          from: applied.period === 'range' ? applied.from : undefined,
          to: applied.period === 'range' ? applied.to : undefined,
        };
        const { from, to } = periodToRange(applied);
        const [avgR, sentimentR] = await Promise.all([
          statisticsService.getFeedbackAverageByDepartment(params),
          statisticsService.getFeedbackSentiment(from, to),
        ]);
        if (cancelled) return;
        const byDept = (avgR as any)?.data?.by_department || {};
        setDeptRows(
          Object.entries(byDept).map(([name, v]: [string, any]) => ({
            name,
            rating: v?.average_rating || 0,
            count: v?.total_feedback || 0,
          }))
        );
        const sData: any = (sentimentR as any)?.data;
        if (sData) {
          const rows = [...(sData.departments || []), ...(sData.general ? [sData.general] : [])];
          setSentimentCounts({
            positive: rows.reduce((s: number, r: any) => s + (r.positive || 0), 0),
            neutral: rows.reduce((s: number, r: any) => s + (r.neutral || 0), 0),
            negative: rows.reduce((s: number, r: any) => s + (r.negative || 0), 0),
          });
        } else {
          setSentimentCounts({ positive: 0, neutral: 0, negative: 0 });
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load feedback');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [appliedKey]);

  useEffect(() => {
    let cancelled = false;
    departmentService
      .getAll()
      .then((res: any) => {
        if (cancelled || !res?.success || !res.data) return;
        const mains: DeptOption[] = [];
        const unitList: DeptOption[] = [];
        res.data.forEach((d: any) => {
          if (d.department_id) mains.push({ name: d.department_name, id: d.department_id });
          (d.sub_departments || []).forEach((u: any) => {
            if (u.department_id) unitList.push({ name: u.department_name, id: u.department_id });
          });
        });
        setDepartments(mains);
        setUnits(unitList);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handlePeriodChange = (value: PeriodValue) => {
    setPeriod(value);
    if (value !== 'range') setApplied({ period: value });
  };

  const handleApplyRange = () => {
    if (!rangeFrom) return;
    setApplied({ period: 'range', from: rangeFrom, to: rangeTo || undefined });
  };

  const feedbackByDept = useMemo(
    () => [...deptRows].filter((d) => d.count > 0).sort((a, b) => b.count - a.count),
    [deptRows]
  );
  const departmentData = useMemo(
    () => [...deptRows].filter((d) => d.count > 0).sort((a, b) => b.rating - a.rating),
    [deptRows]
  );

  const sentimentData = [
    { name: 'Positive', value: sentimentCounts.positive, color: SENTIMENT_COLORS.positive },
    { name: 'Neutral', value: sentimentCounts.neutral, color: SENTIMENT_COLORS.neutral },
    { name: 'Negative', value: sentimentCounts.negative, color: SENTIMENT_COLORS.negative },
  ];

  const deptChartHeight = Math.max(300, feedbackByDept.length * 64 + 40);
  const ratingChartHeight = Math.max(300, departmentData.length * 64 + 40);

  const axisProps = {
    tick: { fontSize: 11, fill: '#555555' },
    axisLine: { stroke: COK.border },
    tickLine: false as const,
  };

  return (
    <MainLayout>
      <div className="p-3 sm:p-4 space-y-3" style={{ backgroundColor: COK.neutralLight, minHeight: '100%' }}>
        <div className="bg-white p-4" style={{ border: `1px solid ${COK.border}` }}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
            <select
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value as PeriodValue)}
              className="cok-auth-input w-full sm:flex-1 text-sm"
              style={{ paddingLeft: '12px', minHeight: '38px' }}
            >
              {PERIOD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            {period === 'range' && (
              <>
                <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="cok-auth-input w-full sm:flex-1 text-sm" style={{ paddingLeft: '10px', minHeight: '38px' }} />
                <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="cok-auth-input w-full sm:flex-1 text-sm" style={{ paddingLeft: '10px', minHeight: '38px' }} />
                <button
                  onClick={handleApplyRange}
                  disabled={!rangeFrom}
                  className="w-full sm:w-auto px-4 py-2 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, letterSpacing: '1px', textTransform: 'uppercase' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                >
                  Apply
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white p-4 relative" style={{ border: `1px solid ${COK.border}` }}>
          {loading && <CokLoadingOverlay />}
          <h3 style={{ fontFamily: fontHeading, fontSize: 15, fontWeight: 600, color: COK.neutralDark, margin: '0 0 16px 0' }}>
            Feedback by Department
          </h3>
          {feedbackByDept.length === 0 && !loading ? (
            <p className="text-sm text-gray-500">No department feedback in this period.</p>
          ) : (
            <div style={{ width: '100%', height: `${deptChartHeight}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={feedbackByDept} layout="vertical" margin={{ top: 5, right: 44, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COK.border} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} domain={[0, (dataMax: number) => Math.ceil((dataMax || 1) * 1.2)]} {...axisProps} />
                  <YAxis type="category" dataKey="name" width={130} interval={0} tick={<DeptNameTick />} axisLine={{ stroke: COK.border }} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: COK.neutralLight }}
                    contentStyle={{ backgroundColor: '#FFFFFF', border: `1px solid ${COK.border}`, borderRadius: 0, fontSize: 12 }}
                    formatter={(value: any) => [`${value} rating(s)`, 'Total']}
                  />
                  <Bar dataKey="count" fill={PRIMARY} barSize={30} isAnimationActive={false}>
                    <LabelList dataKey="count" position="right" style={{ fill: '#333333', fontWeight: 700, fontSize: 12, fontFamily: fontHeading }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-white p-4 relative" style={{ border: `1px solid ${COK.border}` }}>
            {loading && <CokLoadingOverlay />}
            <h3 style={{ fontFamily: fontHeading, fontSize: 15, fontWeight: 600, color: COK.neutralDark, margin: '0 0 16px 0' }}>
              Sentiment Distribution
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sentimentData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COK.border} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#555555' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                  <YAxis allowDecimals={false} domain={[0, (dataMax: number) => Math.ceil((dataMax || 1) * 1.2)]} tick={{ fontSize: 12, fill: '#555555' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                  <Tooltip cursor={{ fill: COK.neutralLight }} contentStyle={{ backgroundColor: '#FFFFFF', border: `1px solid ${COK.border}`, borderRadius: 0, fontSize: 12 }} />
                  <Bar dataKey="value" maxBarSize={72} isAnimationActive={false}>
                    {sentimentData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                    <LabelList dataKey="value" position="top" style={{ fill: '#333333', fontWeight: 700, fontSize: 12, fontFamily: fontHeading }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-600 mt-2">
              {sentimentData.map((s) => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></div>
                  {s.name}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 relative" style={{ border: `1px solid ${COK.border}` }}>
            {loading && <CokLoadingOverlay />}
            <h3 style={{ fontFamily: fontHeading, fontSize: 15, fontWeight: 600, color: COK.neutralDark, margin: '0 0 16px 0' }}>
              Average Rating by Department
            </h3>
            {departmentData.length === 0 && !loading ? (
              <p className="text-sm text-gray-500">No department feedback in this period.</p>
            ) : (
              <div style={{ width: '100%', height: `${ratingChartHeight}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentData} layout="vertical" margin={{ top: 5, right: 44, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COK.border} horizontal={false} />
                    <XAxis type="number" domain={[0, 10]} {...axisProps} />
                    <YAxis type="category" dataKey="name" width={130} interval={0} tick={<DeptNameTick />} axisLine={{ stroke: COK.border }} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: COK.neutralLight }}
                      contentStyle={{ backgroundColor: '#FFFFFF', border: `1px solid ${COK.border}`, borderRadius: 0, fontSize: 12 }}
                      formatter={(value: any, _n: any, entry: any) => [`${value}/10 (${entry?.payload?.count} feedback)`, 'Avg rating']}
                    />
                    <Bar dataKey="rating" fill={PRIMARY} barSize={30} isAnimationActive={false}>
                      <LabelList dataKey="rating" position="right" style={{ fill: '#333333', fontWeight: 700, fontSize: 12, fontFamily: fontHeading }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="p-3 text-sm bg-white" style={{ color: COK.danger, border: `1px solid ${COK.border}` }}>
            Failed to load feedback: {error}
          </p>
        )}

        <FeedbackFeed applied={applied} departments={departments} units={units} />
      </div>
    </MainLayout>
  );
}
