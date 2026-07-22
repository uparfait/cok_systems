import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  FiMessageSquare,
  FiStar,
  FiThumbsUp,
  FiGlobe,
  FiUser,
  FiPhone,
} from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import MainLayout from '../../../core/components/Layout/MainLayout';
import {
  COK,
  CokLabel,
  CokLoadingOverlay,
  CokPageHeader,
  CokStatCard,
  CokBadge,
  CokTab,
  CokTh,
  CokTableEmpty,
  CokPagination,
} from './mayorCok';

const SERVICE_FEEDBACK_API = '/cok/api/feedback/search';
const GENERAL_FEEDBACK_API = '/cok/api/feedback/search-unserviced';

type Sentiment = 'positive' | 'neutral' | 'negative';
type Category = 'service' | 'general';

interface FeedbackItem {
  _id: string;
  user_name?: string;
  telephone?: string;
  textmessage?: string;
  rate?: number;
  rate_out_of?: number;
  created_date?: string;
  department_name?: string;
  department_id?: string;
  provider_name?: string;
  category: Category;
  sentiment: Sentiment;
}

const SENTIMENT_META: Record<Sentiment, { label: string; color: string }> = {
  positive: { label: 'Positive', color: COK.success },
  neutral: { label: 'Neutral', color: COK.warning },
  negative: { label: 'Negative', color: COK.danger },
};

function classifySentiment(rate?: number, rateOutOf?: number): Sentiment {
  const max = rateOutOf || 10;
  const ratio = (rate || 0) / max;
  if (ratio >= 0.7) return 'positive';
  if (ratio >= 0.4) return 'neutral';
  return 'negative';
}

type CategoryTab = 'all' | Category;
type SentimentTab = 'all' | Sentiment;

export default function MayorFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('all');
  const [sentimentTab, setSentimentTab] = useState<SentimentTab>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [serviceRes, generalRes] = await Promise.all([
          axios.get(`${SERVICE_FEEDBACK_API}?limit=100&page=1`),
          axios.get(`${GENERAL_FEEDBACK_API}?limit=100&page=1`),
        ]);
        const service: FeedbackItem[] = (serviceRes.data?.data || []).map((f: any) => ({
          ...f,
          category: 'service' as Category,
          sentiment: classifySentiment(f.rate, f.rate_out_of),
        }));
        const general: FeedbackItem[] = (generalRes.data?.data || []).map((f: any) => ({
          ...f,
          category: 'general' as Category,
          sentiment: classifySentiment(f.rate, f.rate_out_of),
        }));
        const merged = [...service, ...general].sort(
          (a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime()
        );
        if (!cancelled) setItems(merged);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load feedback');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const rated = items.filter((i) => typeof i.rate === 'number');
    const avg = rated.length
      ? rated.reduce((s, i) => s + (i.rate || 0) / (i.rate_out_of || 10), 0) / rated.length
      : 0;
    const positive = items.filter((i) => i.sentiment === 'positive').length;
    const neutral = items.filter((i) => i.sentiment === 'neutral').length;
    const negative = items.filter((i) => i.sentiment === 'negative').length;
    const general = items.filter((i) => i.category === 'general').length;
    const service = items.filter((i) => i.category === 'service').length;
    return {
      total,
      avgOutOf10: (avg * 10).toFixed(1),
      positive,
      neutral,
      negative,
      positivePct: total ? Math.round((positive / total) * 100) : 0,
      general,
      service,
    };
  }, [items]);

  const departmentData = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    for (const i of items) {
      if (i.category !== 'service' || !i.department_name) continue;
      const key = i.department_name;
      if (!map[key]) map[key] = { sum: 0, count: 0 };
      map[key].sum += ((i.rate || 0) / (i.rate_out_of || 10)) * 10;
      map[key].count += 1;
    }
    return Object.entries(map)
      .map(([name, v]) => ({
        name: name.length > 18 ? name.slice(0, 17) + '…' : name,
        rating: Number((v.sum / v.count).toFixed(1)),
        count: v.count,
      }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 8);
  }, [items]);

  const sentimentData = [
    { name: 'Positive', value: stats.positive, color: COK.success },
    { name: 'Neutral', value: stats.neutral, color: COK.warning },
    { name: 'Negative', value: stats.negative, color: COK.danger },
  ];

  const filtered = useMemo(() => {
    let list = items;
    if (categoryTab !== 'all') list = list.filter((i) => i.category === categoryTab);
    if (sentimentTab !== 'all') list = list.filter((i) => i.sentiment === sentimentTab);
    return list;
  }, [items, categoryTab, sentimentTab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  const selectCategory = (key: CategoryTab) => {
    setCategoryTab(key);
    setPage(1);
  };

  const selectSentiment = (key: SentimentTab) => {
    setSentimentTab(key);
    setPage(1);
  };

  const CATEGORY_TABS: Array<{ key: CategoryTab; label: string; count: number }> = [
    { key: 'all', label: 'All Feedback', count: stats.total },
    { key: 'service', label: 'Service Feedback', count: stats.service },
    { key: 'general', label: 'General Feedback', count: stats.general },
  ];

  return (
    <MainLayout>
      <div className="p-4 space-y-4" style={{ backgroundColor: COK.neutralLight, minHeight: '100%' }}>
        <CokPageHeader
          title="Feedback Analysis"
          subtitle="Citizen satisfaction — service delivery and general feedback"
        />

        {/* Summary tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <CokStatCard
            label="Total Feedback"
            value={stats.total}
            sub={`${stats.service} service · ${stats.general} general`}
            accent={COK.primary}
            loading={loading}
            icon={<FiMessageSquare className="w-5 h-5" style={{ color: COK.primary }} />}
          />
          <CokStatCard
            label="Average Rating"
            value={`${stats.avgOutOf10}/10`}
            accent={COK.warning}
            loading={loading}
            icon={<FiStar className="w-5 h-5" style={{ color: COK.warning }} />}
          />
          <CokStatCard
            label="Positive Share"
            value={`${stats.positivePct}%`}
            sub={`${stats.positive} positive submissions`}
            accent={COK.success}
            loading={loading}
            icon={<FiThumbsUp className="w-5 h-5" style={{ color: COK.success }} />}
          />
          <CokStatCard
            label="General Feedback"
            value={stats.general}
            sub="Not tied to a service visit"
            accent={COK.primaryDark}
            loading={loading}
            icon={<FiGlobe className="w-5 h-5" style={{ color: COK.primaryDark }} />}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-white p-4 relative" style={{ border: `1px solid ${COK.border}` }}>
            {loading && <CokLoadingOverlay />}
            <h3 style={{ fontFamily: COK.headingFont, fontSize: 15, fontWeight: 600, color: COK.neutralDark, margin: '0 0 16px 0' }}>
              Sentiment Distribution
            </h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sentimentData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                  <Tooltip cursor={{ fill: COK.neutralLight }} contentStyle={{ border: `1px solid ${COK.border}`, borderRadius: 0, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 0, 0, 0]}>
                    {sentimentData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-4 relative" style={{ border: `1px solid ${COK.border}` }}>
            {loading && <CokLoadingOverlay />}
            <h3 style={{ fontFamily: COK.headingFont, fontSize: 15, fontWeight: 600, color: COK.neutralDark, margin: '0 0 16px 0' }}>
              Average Rating by Department
            </h3>
            {departmentData.length === 0 && !loading ? (
              <p className="text-sm text-gray-500" style={{ fontFamily: COK.bodyFont }}>No department feedback yet.</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentData} layout="vertical" margin={{ top: 5, right: 25, left: 10, bottom: 5 }}>
                    <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                    <Tooltip
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
        </div>

        {/* Classified feedback list */}
        <div className="bg-white relative" style={{ border: `1px solid ${COK.border}` }}>
          {loading && <CokLoadingOverlay />}

          <div className="flex flex-wrap items-center gap-1 px-2 pt-2" style={{ borderBottom: `1px solid ${COK.border}` }}>
            {CATEGORY_TABS.map((t) => (
              <CokTab key={t.key} label={t.label} count={t.count} active={categoryTab === t.key} onClick={() => selectCategory(t.key)} />
            ))}
            <div className="ml-auto flex items-center gap-1 pb-2 pr-1">
              {(['all', 'positive', 'neutral', 'negative'] as SentimentTab[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => selectSentiment(s)}
                  className="px-2 py-1 text-[11px] uppercase transition-opacity hover:opacity-80"
                  style={{
                    fontFamily: COK.headingFont,
                    fontWeight: 600,
                    letterSpacing: '0.3px',
                    color: sentimentTab === s ? '#FFFFFF' : COK.neutralDark,
                    backgroundColor:
                      sentimentTab === s
                        ? s === 'all'
                          ? COK.primaryDark
                          : SENTIMENT_META[s as Sentiment].color
                        : COK.neutralLight,
                    border: `1px solid ${COK.border}`,
                  }}
                >
                  {s === 'all' ? 'All' : SENTIMENT_META[s as Sentiment].label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="p-4 text-sm" style={{ color: COK.danger, fontFamily: COK.bodyFont }}>
              Failed to load feedback: {error}
            </p>
          )}

          {!error && !loading && filtered.length === 0 && <CokTableEmpty message="No feedback found" />}

          {paged.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-auto">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <CokTh center>Rating</CokTh>
                    <CokTh center>Sentiment</CokTh>
                    <CokTh>Type</CokTh>
                    <CokTh>Comment</CokTh>
                    <CokTh>From</CokTh>
                    <CokTh>Date</CokTh>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((f, rowIndex) => {
                    const meta = SENTIMENT_META[f.sentiment];
                    return (
                      <tr
                        key={`${f.category}-${f._id}`}
                        className={`transition-colors duration-100 ${
                          rowIndex % 2 === 0 ? 'bg-white hover:bg-blue-50/30' : 'bg-gray-50/50 hover:bg-blue-50/30'
                        }`}
                      >
                        <td className="px-4 py-3 border-r border-gray-200 align-top text-center whitespace-nowrap">
                          <span
                            className="inline-flex flex-col items-center justify-center w-11 h-11"
                            style={{ backgroundColor: `${meta.color}1A`, borderLeft: `2px solid ${meta.color}` }}
                          >
                            <span style={{ fontFamily: COK.headingFont, fontSize: 15, fontWeight: 700, color: meta.color }}>
                              {f.rate ?? '—'}
                            </span>
                            <span className="text-[9px] text-gray-400">/ {f.rate_out_of || 10}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 border-r border-gray-200 align-top text-center">
                          <CokBadge label={meta.label} color={meta.color} />
                        </td>
                        <td className="px-4 py-3 border-r border-gray-200 align-top">
                          {f.category === 'service' ? (
                            <>
                              <CokBadge label="Service" color={COK.tertiary} />
                              <p className="text-xs text-gray-500" style={{ margin: '4px 0 0 0' }}>
                                {f.department_name || 'Department not specified'}
                              </p>
                              {f.provider_name && (
                                <p className="text-[11px] text-gray-400" style={{ margin: 0 }}>Served by {f.provider_name}</p>
                              )}
                            </>
                          ) : (
                            <CokBadge label="General" color={COK.primaryDark} />
                          )}
                        </td>
                        <td className="px-4 py-3 border-r border-gray-200 align-top max-w-md">
                          <p
                            className="text-sm"
                            style={{
                              fontFamily: COK.bodyFont,
                              color: f.textmessage ? '#555555' : '#9E9E9E',
                              fontStyle: f.textmessage ? 'normal' : 'italic',
                              margin: 0,
                            }}
                          >
                            {f.textmessage || 'No written comment — rating only.'}
                          </p>
                        </td>
                        <td className="px-4 py-3 border-r border-gray-200 align-top whitespace-nowrap">
                          <span className="flex items-center gap-1 text-sm" style={{ color: COK.neutralDark }}>
                            <FiUser className="w-3 h-3 text-gray-400" />
                            {f.user_name?.trim() || 'Anonymous'}
                          </span>
                          {f.telephone?.trim() && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <FiPhone className="w-3 h-3" />
                              {f.telephone}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top whitespace-nowrap text-sm" style={{ color: COK.neutralDark }}>
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
          )}

          {filtered.length > 0 && (
            <CokPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={filtered.length}
              onPageChange={setPage}
            />
          )}

          <div className="px-4 py-3 text-xs text-gray-400" style={{ borderTop: `1px solid ${COK.border}`, fontFamily: COK.bodyFont }}>
            <CokLabel>Classification</CokLabel>
            <span>
              Positive ≥ 7/10 · Neutral 4–6/10 · Negative &lt; 4/10 — Service feedback is tied to a department visit; general
              feedback is submitted freely by citizens.
            </span>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
