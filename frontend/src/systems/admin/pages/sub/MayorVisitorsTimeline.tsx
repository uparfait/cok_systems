import React, { useState, useEffect, useMemo } from 'react';
import { FiBarChart2, FiLoader, FiFilter } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, CartesianGrid } from 'recharts';
import { statisticsService } from '../../../../core/services/adminService';

// City of Kigali (CoK) institutional design constants
const PRIMARY = '#056daa';
const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';

type Granularity = 'hour' | 'day' | 'week' | 'month';
type PeriodKey = 'today' | 'thisweek' | 'lastweek' | 'thismonth' | 'lastmonth' | 'thisyear';

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'thisweek', label: 'This week' },
  { key: 'lastweek', label: 'Last week' },
  { key: 'thismonth', label: 'This month' },
  { key: 'lastmonth', label: 'Last month' },
  { key: 'thisyear', label: 'This year' },
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// ISO week key matching MongoDB's '%G-W%V' $dateToString format (e.g. "2026-W32")
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad(weekNo)}`;
}

// Monday of the week containing d
function mondayOf(d: Date): Date {
  const day = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}

interface BucketDef { key: string; label: string; tooltip: string }

// The selected period decides both the date range and the x-axis unit:
// year -> months, month -> weeks, week -> days, day -> hours
function rangeFor(period: PeriodKey): { from: Date; to: Date; granularity: Granularity; buckets: BucketDef[] } {
  const now = new Date();
  const buckets: BucketDef[] = [];

  if (period === 'today') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    for (let h = 0; h < 24; h++) {
      buckets.push({
        key: `${dayKey(from)}T${pad(h)}`,
        label: `${h}:00`,
        tooltip: `${from.toLocaleDateString()} ${h}:00 - ${h}:59`,
      });
    }
    return { from, to, granularity: 'hour', buckets };
  }

  if (period === 'thisweek' || period === 'lastweek') {
    const monday = mondayOf(now);
    if (period === 'lastweek') monday.setDate(monday.getDate() - 7);
    const from = new Date(monday);
    const to = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      buckets.push({
        key: dayKey(d),
        label: `${WEEKDAY_NAMES[d.getDay()]} ${d.getDate()}`,
        tooltip: d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      });
    }
    return { from, to, granularity: 'day', buckets };
  }

  if (period === 'thismonth' || period === 'lastmonth') {
    const base = period === 'lastmonth'
      ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const from = base;
    const to = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
    // One bucket per ISO week touching the month, labelled Week 1..N of the month
    let cursor = mondayOf(from);
    let index = 1;
    while (cursor <= to) {
      const weekEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 6);
      buckets.push({
        key: isoWeekKey(cursor),
        label: `Week ${index}`,
        tooltip: `${cursor.toLocaleDateString()} — ${weekEnd.toLocaleDateString()}`,
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
      index++;
    }
    return { from, to, granularity: 'week', buckets };
  }

  // thisyear
  const from = new Date(now.getFullYear(), 0, 1);
  const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  for (let m = 0; m < 12; m++) {
    buckets.push({
      key: `${now.getFullYear()}-${pad(m + 1)}`,
      label: MONTH_NAMES[m],
      tooltip: `${MONTH_NAMES[m]} ${now.getFullYear()}`,
    });
  }
  return { from, to, granularity: 'month', buckets };
}

/**
 * Mayor's service delivery view: a single filterable visitors chart.
 * Vertical bars, counts on top, x-axis unit adapts to the chosen period,
 * and the whole chart scrolls horizontally as one connected timeline.
 */
const MayorVisitorsTimeline: React.FC = () => {
  const [period, setPeriod] = useState<PeriodKey>('thisweek');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const range = useMemo(() => rangeFor(period), [period]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const res: any = await statisticsService.getVisitorsTimeline(
          range.from.toISOString(),
          range.to.toISOString(),
          range.granularity
        );
        const data = res?.data || res;
        if (!ignore && (res?.success || data?.buckets)) {
          const map: Record<string, number> = {};
          (data.buckets || []).forEach((b: { bucket: string; count: number }) => { map[b.bucket] = b.count; });
          setCounts(map);
          setTotal(data.total || 0);
        } else if (!ignore) {
          setError('Failed to load visitor statistics');
        }
      } catch (e: any) {
        // A 404 means the backend is running old code without /statistics/visitors-timeline
        if (!ignore) setError(e?.response?.status === 404
          ? 'Statistics endpoint not found — restart the backend server to load it'
          : 'Failed to load visitor statistics');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [range]);

  // Every bucket of the period appears, zeros included, so the timeline stays connected
  const chartData = useMemo(
    () => range.buckets.map(b => ({ label: b.label, tooltip: b.tooltip, count: counts[b.key] || 0 })),
    [range, counts]
  );

  return (
    <div className="px-4 py-4">
      <div className="mb-5">
        <h1 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
          <FiBarChart2 className="w-4 h-4" style={{ color: PRIMARY }} />
          Service Delivery — Visitors
        </h1>
        <p className="text-xs mt-0.5 text-[#555555]">
          Visitor check-ins over time · {PERIODS.find(p => p.key === period)?.label} · {total} visitor(s)
        </p>
      </div>

      <div className="bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        {/* Period filter — same dropdown pattern as the mayor overview toolbar */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-end gap-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <FiFilter className="w-3.5 h-3.5" style={{ color: '#555555' }} />
          <label className="text-xs font-medium" style={{ fontFamily: fontHeading, color: '#555555' }} htmlFor="mayor-visitors-period">
            Period
          </label>
          <select
            id="mayor-visitors-period"
            value={period}
            onChange={e => setPeriod(e.target.value as PeriodKey)}
            className="text-xs px-2 py-1.5 border border-gray-300 bg-white focus:outline-none cursor-pointer"
            style={{ fontFamily: fontHeading, borderRadius: 0, color: NEUTRAL_DARK }}
          >
            {PERIODS.map(p => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="h-[380px] flex items-center justify-center">
            <FiLoader className="w-6 h-6 animate-spin" style={{ color: PRIMARY }} />
          </div>
        ) : error ? (
          <div className="h-[380px] flex items-center justify-center text-sm" style={{ color: '#E53935', fontFamily: fontHeading }}>
            {error}
          </div>
        ) : (
          /* One connected chart that scrolls to the right when the period has many buckets */
          <div className="overflow-x-auto px-6 py-4">
            <div style={{ minWidth: Math.max(chartData.length * 72, 640), height: 380 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BORDER} />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    tick={{ fontSize: 11, fill: '#555555', fontFamily: fontHeading }}
                    axisLine={{ stroke: BORDER }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#555555', fontFamily: fontHeading }}
                    axisLine={{ stroke: BORDER }}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(5,109,170,0.06)' }}
                    contentStyle={{ border: `1px solid ${BORDER}`, borderRadius: 0, fontSize: 12, fontFamily: fontHeading }}
                    formatter={(value: any) => [`${value} visitor(s)`, 'Checked in']}
                    labelFormatter={(_label: any, payload: any) => payload?.[0]?.payload?.tooltip || _label}
                  />
                  <Bar dataKey="count" fill={PRIMARY} barSize={36} radius={[0, 0, 0, 0]}>
                    {/* Count printed on top of each bar */}
                    <LabelList dataKey="count" position="top" style={{ fill: NEUTRAL_DARK, fontWeight: 700, fontSize: 12, fontFamily: fontHeading }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MayorVisitorsTimeline;
