import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  FiPhone,
} from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import MainLayout from '../../../core/components/Layout/MainLayout';
import {
  COK,
  CokLabel,
  CokLoadingOverlay,
  CokPageHeader,
  CokTab,
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

// Donut slice palette for the Feedback by Department card — same set as the admin analytics page
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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
  // Current tab's list, fetched straight from the database on every tab switch
  const [items, setItems] = useState<FeedbackItem[]>([]);
  // Latest combined fetch, kept separately so charts stay stable across tab switches
  const [chartItems, setChartItems] = useState<FeedbackItem[]>([]);
  // Real database counts returned by the backend (not the length of the fetched slice)
  const [totals, setTotals] = useState({ all: 0, service: 0, general: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('all');
  const [sentimentTab, setSentimentTab] = useState<SentimentTab>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;
  const FETCH_LIMIT = 20; // backend never returns more than this per request

  useEffect(() => {
    let cancelled = false;
    const mapItem = (category: Category) => (f: any): FeedbackItem => ({
      ...f,
      category,
      sentiment: classifySentiment(f.rate, f.rate_out_of),
    });
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (categoryTab === 'service') {
          const res = await axios.get(`${SERVICE_FEEDBACK_API}?limit=${FETCH_LIMIT}&page=1`);
          if (cancelled) return;
          setItems((res.data?.data || []).map(mapItem('service')));
          setTotals((t) => ({ ...t, service: res.data?.total ?? 0, all: (res.data?.total ?? 0) + t.general }));
        } else if (categoryTab === 'general') {
          const res = await axios.get(`${GENERAL_FEEDBACK_API}?limit=${FETCH_LIMIT}&page=1`);
          if (cancelled) return;
          setItems((res.data?.data || []).map(mapItem('general')));
          setTotals((t) => ({ ...t, general: res.data?.total ?? 0, all: t.service + (res.data?.total ?? 0) }));
        } else {
          const [serviceRes, generalRes] = await Promise.all([
            axios.get(`${SERVICE_FEEDBACK_API}?limit=${FETCH_LIMIT}&page=1`),
            axios.get(`${GENERAL_FEEDBACK_API}?limit=${FETCH_LIMIT}&page=1`),
          ]);
          if (cancelled) return;
          const merged = [
            ...(serviceRes.data?.data || []).map(mapItem('service')),
            ...(generalRes.data?.data || []).map(mapItem('general')),
          ].sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime());
          const serviceTotal = serviceRes.data?.total ?? 0;
          const generalTotal = generalRes.data?.total ?? 0;
          setItems(merged);
          setChartItems(merged);
          setTotals({ service: serviceTotal, general: generalTotal, all: serviceTotal + generalTotal });
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load feedback');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryTab]);

  const sentimentCounts = useMemo(
    () => ({
      positive: chartItems.filter((i) => i.sentiment === 'positive').length,
      neutral: chartItems.filter((i) => i.sentiment === 'neutral').length,
      negative: chartItems.filter((i) => i.sentiment === 'negative').length,
    }),
    [chartItems]
  );

  const departmentData = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    for (const i of chartItems) {
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
  }, [chartItems]);

  const sentimentData = [
    { name: 'Positive', value: sentimentCounts.positive, color: COK.success },
    { name: 'Neutral', value: sentimentCounts.neutral, color: COK.warning },
    { name: 'Negative', value: sentimentCounts.negative, color: COK.danger },
  ];

  // Total ratings per department for the bar chart — every department, largest first
  // (service feedback carries the department name; axis labels truncate, tooltip keeps the full name)
  const feedbackPieData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of chartItems) {
      if (i.category !== 'service' || !i.department_name) continue;
      map[i.department_name] = (map[i.department_name] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({
        name: name.length > 28 ? name.slice(0, 27) + '…' : name,
        fullName: name,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [chartItems]);

  // Category filtering now happens in the database query; only sentiment stays client-side
  // (sentiment is derived from the rating, so the backend can't filter on it)
  const filtered = useMemo(
    () => (sentimentTab === 'all' ? items : items.filter((i) => i.sentiment === sentimentTab)),
    [items, sentimentTab]
  );

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
    { key: 'all', label: 'All Feedback', count: totals.all },
    { key: 'service', label: 'Service Feedback', count: totals.service },
    { key: 'general', label: 'General Feedback', count: totals.general },
  ];

  return (
    <MainLayout>
      <div className="p-4 space-y-6" style={{ backgroundColor: COK.neutralLight, minHeight: '100%' }}>
        <CokPageHeader
          title="Feedback Analysis"
        />

        {/* Feedback by Department bar chart — replaces the old summary tiles */}
        <div className="bg-white p-4 relative" style={{ border: `1px solid ${COK.border}` }}>
          {loading && <CokLoadingOverlay />}
          <h3 style={{ fontFamily: COK.headingFont, fontSize: 15, fontWeight: 600, color: COK.neutralDark, margin: '0 0 16px 0' }}>
            Feedback by Department
          </h3>
          {feedbackPieData.length === 0 && !loading ? (
            <p className="text-sm text-gray-500" style={{ fontFamily: COK.bodyFont }}>No department feedback yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={feedbackPieData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: COK.neutralLight }}
                    contentStyle={{ border: `1px solid ${COK.border}`, borderRadius: 0, fontSize: 12 }}
                    formatter={(value: any) => [`${value} rating(s)`, 'Total']}
                    labelFormatter={(_label: any, payload: any) => payload?.[0]?.payload?.fullName || _label}
                  />
                  <Bar dataKey="value" radius={[0, 0, 0, 0]}>
                    {feedbackPieData.map((entry, index) => (
                      <Cell key={entry.fullName} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                    {/* Count printed inside each bar */}
                    <LabelList dataKey="value" position="center" style={{ fill: '#fff', fontWeight: 700, fontSize: 12 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
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
            <div
              className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4"
              style={{ backgroundColor: COK.neutralLight }}
            >
              {paged.map((f) => {
                const meta = SENTIMENT_META[f.sentiment];
                return (
                  <div
                    key={`${f.category}-${f._id}`}
                    className="bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                    style={{
                      border: `1px solid ${COK.border}`,
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span style={{ fontFamily: COK.headingFont, fontSize: 16, fontWeight: 700, color: COK.neutralDark, lineHeight: 1.2 }}>
                          {f.user_name?.trim() || 'Anonymous'}
                        </span>
                        <span
                          className="w-fit px-2 py-0.5 text-[12px]"
                          style={{ fontFamily: COK.headingFont, fontWeight: 600, color: COK.primaryDark, backgroundColor: '#EAF6FC' }}
                        >
                          {f.category === 'service' ? f.department_name || 'Department not specified' : 'General Feedback'}
                        </span>
                        {f.provider_name && (
                          <span className="text-[11px] text-gray-400">Served by {f.provider_name}</span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 text-xs text-gray-500">
                        <span style={{ fontFamily: COK.headingFont, fontSize: 14, fontWeight: 700, color: meta.color }}>
                          {typeof f.rate === 'number' ? `${f.rate} / ${f.rate_out_of || 10}` : meta.label}
                        </span>
                        {f.telephone?.trim() && (
                          <span className="flex items-center gap-1" style={{ color: '#374151', fontWeight: 500 }}>
                            <FiPhone className="w-3 h-3" />
                            {f.telephone}
                          </span>
                        )}
                        <span>
                          {f.created_date
                            ? new Date(f.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : ''}
                        </span>
                      </div>
                    </div>
                    <div
                      className="px-4 py-3.5 text-sm"
                      style={{
                        backgroundColor: '#f9fafb',
                        border: '1px solid #f3f4f6',
                        fontFamily: COK.bodyFont,
                        lineHeight: 1.5,
                        color: f.textmessage ? '#374151' : '#9E9E9E',
                        fontStyle: f.textmessage ? 'normal' : 'italic',
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {f.textmessage || 'No written comment rating only.'}
                    </div>
                  </div>
                );
              })}
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

          {/* <div className="px-4 py-3 text-xs text-gray-400" style={{ borderTop: `1px solid ${COK.border}`, fontFamily: COK.bodyFont }}>
            <CokLabel>Classification</CokLabel>
            <span>
             <p style={{ fontFamily: COK.bodyFont, fontSize: 14, fontWeight: 900,  }}> general
              feedback is submitted freely by</p>
            </span>
          </div> */}
        </div>
      </div>
    </MainLayout>
  );
}
