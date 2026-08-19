import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiStar, FiPhone, FiMessageSquare } from 'react-icons/fi';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer } from 'recharts';
import { departmentManagerService } from '@/core/services/adminService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import HodPeriodBar, { periodToRange } from './HodPeriodBar';
import type { HodAppliedPeriod } from './HodPeriodBar';

const PRIMARY = '#056daa';
const WARNING = '#F39C12';
const NEUTRAL_DARK = '#333333';
const GRAY_MID = '#555555';
const GRAY = '#9E9E9E';
const BORDER = '#E0E0E0';
const NEUTRAL_LIGHT = '#F7F9FB';
const FONT = "'Montserrat', sans-serif";

const LIMIT = 10;

interface FeedbackItem {
  _id: string;
  user_name?: string;
  telephone?: string;
  textmessage?: string;
  rate?: number;
  rate_out_of?: number;
  created_date?: string;
  department_name?: string;
  source?: string;
}

interface FeedbackAnalytics {
  average_rating: number;
  total_feedback: number;
  general_feedback: number;
  sentiment?: { positive: number; neutral: number; negative: number };
}

const SENTIMENT_COLORS: Record<string, string> = {
  Positive: '#4CAF50',
  Neutral: '#F39C12',
  Negative: '#E74C3C',
};

interface DeptOption {
  id: string;
  name: string;
}

const StatTile: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="bg-white p-4 flex-1 min-w-[150px]" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: GRAY_MID, fontFamily: FONT }}>{label}</p>
    <p className="text-2xl font-bold mt-1" style={{ color: NEUTRAL_DARK, fontFamily: FONT }}>{value}</p>
    {hint && <p className="text-xs mt-0.5" style={{ color: GRAY }}>{hint}</p>}
  </div>
);

const HodFeedbackPage: React.FC = () => {
  const [applied, setApplied] = useState<HodAppliedPeriod>({ period: 'month' });
  const [target, setTarget] = useState('all');
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [units, setUnits] = useState<DeptOption[]>([]);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [analytics, setAnalytics] = useState<FeedbackAnalytics | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchIdRef = useRef(0);
  const pageRef = useRef(1);
  pageRef.current = page;

  const range = useMemo(() => periodToRange(applied.period, applied.from, applied.to), [applied]);

  useEffect(() => {
    let mounted = true;
    departmentManagerService.getManagedDepartments()
      .then((res: any) => {
        if (!mounted || !res?.success || !Array.isArray(res.data)) return;
        const opts = res.data.map((d: any) => ({
          id: String(d._id || d.department_id),
          name: d.department_name || d.name || 'Unnamed',
          isUnit: !!d.is_unit,
        }));
        setDepartments(opts.filter((o: any) => !o.isUnit).map(({ id, name }: any) => ({ id, name })));
        setUnits(opts.filter((o: any) => o.isUnit).map(({ id, name }: any) => ({ id, name })));
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const fetchPage = useCallback(async (p: number, mode: 'initial' | 'append' | 'silent') => {
    const fetchId = ++fetchIdRef.current;
    if (mode === 'append') setLoadingMore(true);
    else if (mode === 'initial') setInitialLoading(true);
    try {
      const res: any = await departmentManagerService.getDepartmentFeedback({
        page: p,
        limit: LIMIT,
        target,
        from: range.from,
        to: range.to,
      });
      if (fetchId !== fetchIdRef.current) return;
      const rows: FeedbackItem[] = Array.isArray(res?.data) ? res.data : [];
      setItems(prev => {
        if (mode !== 'append') return rows;
        const seen = new Set(prev.map(x => x._id));
        return [...prev, ...rows.filter(x => !seen.has(x._id))];
      });
      setPage(res?.page || p);
      setTotalPages(res?.totalPages || 1);
      setTotal(res?.total || 0);
      if (res?.analytics) setAnalytics(res.analytics);
    } catch {
      if (fetchId === fetchIdRef.current && mode === 'initial') setItems([]);
    } finally {
      if (fetchId === fetchIdRef.current) {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    }
  }, [target, range.from, range.to]);

  useEffect(() => {
    setItems([]);
    setPage(1);
    setTotalPages(1);
    fetchPage(1, 'initial');
  }, [fetchPage]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pageRef.current === 1) fetchPage(1, 'silent');
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchPage]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60 && !loadingMore && !initialLoading && page < totalPages) {
      fetchPage(page + 1, 'append');
    }
  };

  const sentimentData = useMemo(() => ([
    { name: 'Positive', value: analytics?.sentiment?.positive || 0 },
    { name: 'Neutral', value: analytics?.sentiment?.neutral || 0 },
    { name: 'Negative', value: analytics?.sentiment?.negative || 0 },
  ]), [analytics]);

  const totalFeedbackStat = analytics
    ? target === 'all'
      ? analytics.total_feedback + analytics.general_feedback
      : target === 'general'
        ? analytics.general_feedback
        : analytics.total_feedback
    : total;
  const avg = analytics ? Math.round(analytics.average_rating * 10) / 10 : 0;

  return (
    <div className="p-4" style={{ fontFamily: FONT }}>
      <div className="mb-4">
        <HodPeriodBar applied={applied} onApply={setApplied} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <StatTile label="Total Feedback" value={totalFeedbackStat} hint="For the selected filters" />
        <StatTile label="Average Rating" value={avg} hint="Out of 10, department feedback only" />
      </div>

      <div className="bg-white p-4 mb-4" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
        <h2 className="text-sm font-bold" style={{ fontFamily: FONT, color: NEUTRAL_DARK }}>Feedback Sentiment</h2>
        <p className="text-xs mt-0.5 mb-3" style={{ color: GRAY_MID }}>For the selected filters</p>
        {initialLoading ? (
          <div className="flex items-center justify-center h-64">
            <SpiralLoader />
          </div>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sentimentData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid stroke={BORDER} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: FONT }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                    domain={[0, (dataMax: number) => Math.ceil((dataMax || 1) * 1.2)]}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(5,109,170,0.05)' }}
                    contentStyle={{ borderRadius: 0, border: `1px solid ${BORDER}`, backgroundColor: '#FFFFFF', fontFamily: FONT }}
                  />
                  <Bar dataKey="value" maxBarSize={70}>
                    {sentimentData.map(entry => (
                      <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name]} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="top"
                      style={{ fill: '#333333', fontWeight: 700, fontSize: 12, fontFamily: FONT }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2 flex-wrap">
              {sentimentData.map(entry => (
                <span key={entry.name} className="flex items-center gap-1.5 text-xs" style={{ color: GRAY_MID, fontFamily: FONT }}>
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: SENTIMENT_COLORS[entry.name] }} />
                  {entry.name}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="bg-white" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
        <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2" style={{ fontFamily: FONT, color: NEUTRAL_DARK }}>
              <FiMessageSquare className="w-4 h-4" style={{ color: PRIMARY }} />Feedbacks
            </h2>
            <p className="text-xs mt-0.5" style={{ color: GRAY_MID }}>{total} feedback{total === 1 ? '' : 's'} for the selected filters</p>
          </div>
          <select
            value={target}
            onChange={e => setTarget(e.target.value)}
            className="cok-auth-input w-full sm:w-72 text-sm"
            style={{ paddingLeft: '12px', minHeight: '38px' }}
          >
            <option value="all">All</option>
            <option value="general">General</option>
            {departments.length > 0 && (
              <optgroup label="Departments">
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </optgroup>
            )}
            {units.length > 0 && (
              <optgroup label="Units">
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </optgroup>
            )}
          </select>
        </div>

        {initialLoading ? (
          <div className="flex items-center justify-center py-12">
            <SpiralLoader />
            <span className="ml-2 text-sm" style={{ color: GRAY }}>Loading feedbacks...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: GRAY }}>No feedback found for the selected filters</p>
          </div>
        ) : (
          <div className="p-4 max-h-[620px] overflow-y-auto" onScroll={handleScroll}>
            <div className="flex flex-col gap-4 w-full max-w-[520px] mx-auto">
              {items.map((fb, i) => (
                <div key={fb._id || i} className="bg-white p-4" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <span className="text-sm font-bold leading-tight break-words" style={{ fontFamily: FONT, color: NEUTRAL_DARK }}>
                        {fb.user_name || 'Anonymous'}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 w-fit" style={{ fontFamily: FONT, backgroundColor: 'rgba(5,109,170,0.08)', color: PRIMARY }}>
                        {fb.department_name || 'General'}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs shrink-0">
                      <span className="flex items-center gap-1 text-sm font-bold" style={{ fontFamily: FONT, color: WARNING }}>
                        <FiStar className="w-3.5 h-3.5" style={{ fill: WARNING }} />{fb.rate ?? 0}/{fb.rate_out_of || 10}
                      </span>
                      <span className="font-medium" style={{ color: GRAY_MID }}>
                        {fb.created_date ? new Date(fb.created_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                      </span>
                      <span className="flex items-center gap-1" style={{ color: GRAY }}>
                        <FiPhone className="w-3 h-3" />{fb.telephone || '-'}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 text-sm leading-relaxed whitespace-pre-line break-words" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}`, color: NEUTRAL_DARK }}>
                    {fb.textmessage ? fb.textmessage : <span className="italic" style={{ color: GRAY }}>No message</span>}
                  </div>
                </div>
              ))}
              {loadingMore && (
                <div className="flex items-center justify-center py-3">
                  <SpiralLoader />
                  <span className="ml-2 text-xs" style={{ color: GRAY }}>Loading more...</span>
                </div>
              )}
              {!loadingMore && page >= totalPages && items.length > 0 && (
                <p className="text-center text-xs py-2" style={{ color: GRAY }}>All feedback loaded</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HodFeedbackPage;
