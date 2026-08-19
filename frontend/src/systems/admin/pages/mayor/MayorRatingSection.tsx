import React, { useState, useEffect, useRef, useMemo } from 'react';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import { statisticsService, departmentService } from '../../../../core/services/adminService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, CartesianGrid } from 'recharts';
import { FiX } from 'react-icons/fi';
import FeedbackFeed from '../components/FeedbackFeed';
import type { AppliedFilter, DeptOption } from '../components/FeedbackFeed';

const PRIMARY = '#056daa';
const NEUTRAL_DARK = '#333333';
const NEUTRAL_LIGHT = '#F7F9FB';
const BORDER = '#E0E0E0';
const fontHeading = "'Montserrat', sans-serif";

type Sentiment = 'positive' | 'neutral' | 'negative';

const SENTIMENT_META: Record<Sentiment, { label: string; color: string }> = {
  positive: { label: 'Positive', color: '#4CAF50' },
  neutral: { label: 'Neutral', color: '#F39C12' },
  negative: { label: 'Negative', color: '#E74C3C' },
};

const classifySentiment = (rate?: number, rateOutOf?: number): Sentiment => {
  const max = rateOutOf || 10;
  const ratio = (rate || 0) / max;
  if (ratio >= 0.7) return 'positive';
  if (ratio >= 0.4) return 'neutral';
  return 'negative';
};

const SentimentChartTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const sentiment = SENTIMENT_META[classifySentiment(d.rating, 10)];
  return (
    <div style={{ backgroundColor: '#fff', border: `1px solid ${BORDER}`, fontSize: 12, padding: '8px 10px' }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.fullName || d.name}</div>
      <div>{d.rating}/10 · <span style={{ color: sentiment.color, fontWeight: 600 }}>{sentiment.label}</span></div>
      <div>{d.count} feedback</div>
      {d.positive !== undefined && (
        <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ color: SENTIMENT_META.negative.color }}>Negative: {d.negative}</div>
          <div style={{ color: SENTIMENT_META.neutral.color }}>Neutral: {d.neutral}</div>
          <div style={{ color: SENTIMENT_META.positive.color }}>Positive: {d.positive}</div>
        </div>
      )}
    </div>
  );
};

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

interface RatingRow { name: string; rating: number; count: number; id: string }
interface SentimentStatRow { name: string; average_rating: number; count: number; positive: number; neutral: number; negative: number }
interface SentimentTrendRow { name: string; rating: number; count: number; fullName?: string; positive?: number; neutral?: number; negative?: number; isGeneral?: boolean; barRating?: number; segNegative?: number; segNeutral?: number; segPositive?: number }

const formatRating = (value: any) => {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
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

const DeptNameTick: React.FC<any> = ({ x, y, payload }) => {
  const lines = wrapLabel(payload?.value);
  const startDy = 4 - (lines.length - 1) * 5.5;
  return (
    <text x={x} y={y} textAnchor="end" fill="#555555" fontSize={10} fontFamily={fontHeading}>
      {lines.map((l, i) => (
        <tspan key={i} x={x - 4} dy={i === 0 ? startDy : 11}>{l}</tspan>
      ))}
    </text>
  );
};

const MayorRatingSection: React.FC<{ applied: AppliedFilter; refreshTick: number }> = ({ applied, refreshTick }) => {
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [units, setUnits] = useState<DeptOption[]>([]);
  const [selectedDept, setSelectedDept] = useState<{ name: string; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackSentiment, setFeedbackSentiment] = useState<{ departments: SentimentStatRow[]; general: Omit<SentimentStatRow, 'name'> } | null>(null);
  const appliedKey = JSON.stringify(applied);
  const lastKeyRef = useRef('');

  useEffect(() => {
    const silent = lastKeyRef.current === appliedKey;
    lastKeyRef.current = appliedKey;
    let cancelled = false;
    (async () => {
      if (!silent) setLoading(true);
      try {
        const params = {
          period: applied.period,
          from: applied.period === 'range' ? applied.from : undefined,
          to: applied.period === 'range' ? applied.to : undefined,
        };
        const { from, to } = periodToRange(applied);
        const [avgR, deptR, sentimentR] = await Promise.all([
          statisticsService.getFeedbackAverageByDepartment(params),
          departmentService.getAll(),
          statisticsService.getFeedbackSentiment(from, to),
        ]);
        if (cancelled) return;
        const deptMap = new Map<string, string>();
        if (deptR?.success && deptR.data) {
          const mains: DeptOption[] = [];
          const unitList: DeptOption[] = [];
          deptR.data.forEach((d: any) => {
            deptMap.set(d.department_name, d.department_id);
            if (d.department_id) mains.push({ name: d.department_name, id: d.department_id });
            (d.sub_departments || []).forEach((u: any) => {
              deptMap.set(u.department_name, u.department_id);
              if (u.department_id) unitList.push({ name: u.department_name, id: u.department_id });
            });
          });
          setDepartments(mains);
          setUnits(unitList);
        }
        const avgData: any = (avgR as any)?.data || {};
        const byDept = avgData?.by_department || {};
        setRows(
          Object.entries(byDept)
            .map(([name, v]: [string, any]) => ({
              name,
              rating: v?.average_rating || 0,
              count: v?.total_feedback || 0,
              id: deptMap.get(name) || '',
            }))
            .sort((a, b) => b.rating - a.rating)
        );
        const sData: any = (sentimentR as any);
        if (sData?.success && sData.data) setFeedbackSentiment(sData.data);
        else setFeedbackSentiment(null);
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [appliedKey, refreshTick]);

  const sentimentTrend = useMemo<SentimentTrendRow[]>(() => {
    const toRow = (label: string, fullName: string, s: Omit<SentimentStatRow, 'name'>, isGeneral = false): SentimentTrendRow => {
      const rating = Math.round((s.average_rating || 0) * 10) / 10;
      const total = s.count || 1;
      return {
        name: label.length > 18 ? label.slice(0, 17) + '...' : label,
        fullName,
        rating,
        count: s.count,
        positive: s.positive,
        neutral: s.neutral,
        negative: s.negative,
        isGeneral,
        barRating: rating,
        segNegative: rating * ((s.negative || 0) / total),
        segNeutral: rating * ((s.neutral || 0) / total),
        segPositive: rating * ((s.positive || 0) / total),
      };
    };
    if (!feedbackSentiment) {
      return rows.map(d => {
        const s = classifySentiment(d.rating, 10);
        return {
          name: d.name,
          rating: d.rating,
          count: d.count,
          barRating: d.rating,
          segNegative: s === 'negative' ? d.rating : 0,
          segNeutral: s === 'neutral' ? d.rating : 0,
          segPositive: s === 'positive' ? d.rating : 0,
        };
      });
    }
    const trendRows: SentimentTrendRow[] = (feedbackSentiment.departments || [])
      .filter(d => d.count > 0)
      .map(d => toRow(d.name, d.name, d))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 8);
    const g = feedbackSentiment.general;
    if (g && g.count > 0) trendRows.push(toRow('General', 'General feedback', g, true));
    return trendRows;
  }, [feedbackSentiment, rows]);

  const chartHeight = Math.max(220, rows.length * 48 + 30);

  const handleBarClick = (entry: any, e?: any) => {
    if (e?.stopPropagation) e.stopPropagation();
    const p = entry?.payload || entry;
    if (p?.id) setSelectedDept({ name: p.name, id: p.id });
  };

  const spinner = (
    <div className="h-56 flex items-center justify-center">
      <SpiralLoader />
    </div>
  );

  const axisProps = {
    tick: { fontSize: 11, fill: '#555555' },
    axisLine: { stroke: BORDER },
    tickLine: false as const,
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div
          className="bg-white p-4 cursor-pointer transition-colors hover:bg-[#F7F9FB]"
          style={{ border: `1px solid ${BORDER}` }}
          onClick={() => setSelectedDept({ name: 'All Departments', id: 'all' })}
        >
          <div className="flex justify-between items-start flex-wrap gap-2">
            <h3 style={{ fontFamily: fontHeading, fontSize: 14, fontWeight: 600, color: NEUTRAL_DARK, margin: '0 0 12px 0' }}>
              Average Rating by Department
            </h3>
            <span className="text-xs text-gray-400">Click to view all feedbacks</span>
          </div>
          {loading ? spinner : rows.length === 0 ? (
            <p className="text-sm text-gray-500">No department feedback yet.</p>
          ) : (
            <div style={{ width: '100%', height: `${chartHeight}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 44, left: 0, bottom: 5 }}>
                  <CartesianGrid stroke={BORDER} horizontal={false} />
                  <XAxis type="number" domain={[0, (dataMax: number) => Math.ceil((dataMax || 1) * 1.2)]} {...axisProps} />
                  <YAxis type="category" dataKey="name" width={124} interval={0} tick={<DeptNameTick />} axisLine={{ stroke: BORDER }} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: NEUTRAL_LIGHT }}
                    contentStyle={{ backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 0, fontSize: 12 }}
                    formatter={(value: any) => [formatRating(value), 'Avg rating']}
                  />
                  <Bar dataKey="rating" fill={PRIMARY} barSize={14} isAnimationActive={false} cursor="pointer" onClick={handleBarClick}>
                    <LabelList
                      dataKey="rating"
                      position="right"
                      style={{ fill: NEUTRAL_DARK, fontWeight: 700, fontSize: 11, fontFamily: fontHeading }}
                      formatter={formatRating}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
          <h3 style={{ fontFamily: fontHeading, fontSize: 15, fontWeight: 600, color: NEUTRAL_DARK, margin: 0 }}>
            Department Sentiment
          </h3>
          <div className="text-[11px] uppercase tracking-wide text-gray-400 mt-0.5 mb-2">Average rating out of 10</div>
          {loading ? spinner : sentimentTrend.length === 0 ? (
            <p className="text-sm text-gray-500">No feedback in this period yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sentimentTrend} layout="vertical" margin={{ top: 5, right: 32, left: 10, bottom: 5 }}>
                  <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11, fill: '#555555' }} axisLine={{ stroke: BORDER }} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={130} interval={0} tick={{ fontSize: 10, fill: '#555555' }} axisLine={{ stroke: BORDER }} tickLine={false} />
                  <Tooltip cursor={{ fill: NEUTRAL_LIGHT }} content={<SentimentChartTooltip />} />
                  <Bar dataKey="segNegative" name="Negative" stackId="rating" barSize={16} isAnimationActive={false} fill={SENTIMENT_META.negative.color}>
                    <LabelList dataKey="negative" position="center" fontSize={10} fill="#ffffff" fontWeight={700} formatter={(v: any) => (v ? v : '')} />
                  </Bar>
                  <Bar dataKey="segNeutral" name="Neutral" stackId="rating" isAnimationActive={false} fill={SENTIMENT_META.neutral.color}>
                    <LabelList dataKey="neutral" position="center" fontSize={10} fill="#ffffff" fontWeight={700} formatter={(v: any) => (v ? v : '')} />
                  </Bar>
                  <Bar dataKey="segPositive" name="Positive" stackId="rating" isAnimationActive={false} fill={SENTIMENT_META.positive.color}>
                    <LabelList dataKey="positive" position="center" fontSize={10} fill="#ffffff" fontWeight={700} formatter={(v: any) => (v ? v : '')} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {!loading && sentimentTrend.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-600 mt-2">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENTIMENT_META.negative.color }}></div>Negative (&lt;4)</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENTIMENT_META.neutral.color }}></div>Neutral (4-6.9)</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENTIMENT_META.positive.color }}></div>Positive (7+)</div>
            </div>
          )}
        </div>
      </div>

      {selectedDept && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-2 sm:px-4 pb-6 overflow-y-auto"
          style={{ paddingTop: '90px' }}
          onClick={() => setSelectedDept(null)}
        >
          <div
            className="bg-white w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            style={{ border: `1px solid ${BORDER}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 sticky top-0 z-10" style={{ backgroundColor: PRIMARY }}>
              <span className="text-xs font-bold text-white uppercase tracking-[1px] truncate" style={{ fontFamily: fontHeading }}>
                Feedbacks · {selectedDept.name}
              </span>
              <button
                onClick={() => setSelectedDept(null)}
                className="cok-btn-outlined-reverse flex items-center gap-1.5 shrink-0"
                style={{ padding: '0.3rem 0.7rem' }}
              >
                <FiX className="w-4 h-4" />
                Close
              </button>
            </div>
            <FeedbackFeed
              applied={applied}
              departments={departments}
              units={units}
              initialTarget={selectedDept.id}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default MayorRatingSection;
