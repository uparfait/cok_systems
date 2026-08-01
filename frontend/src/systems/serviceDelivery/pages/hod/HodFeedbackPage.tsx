import React, { useCallback, useEffect, useState } from 'react';
import { FiRefreshCw, FiStar } from 'react-icons/fi';
import { departmentManagerService } from '@/core/services/adminService';
import { useToast } from '@/core/contexts/ToastContext';
import {
  COK, FONT, formatDateTime,
  HodPageHeader, HodCard, HodStatCard, HodPagination, HodEmpty, HodChip,
} from './hodShared';

interface FeedbackItem {
  _id: string;
  user_name?: string;
  telephone?: string;
  textmessage?: string;
  rate?: number;
  rate_out_of?: number;
  created_date?: string;
  department_name?: string;
  provider_name?: string;
}

interface FeedbackAnalytics {
  average_rating: number;
  total_feedback: number;
}

const LIMIT = 10;

const ratingColor = (rate: number, outOf: number) => {
  const ratio = outOf > 0 ? rate / outOf : 0;
  if (ratio >= 0.7) return COK.success;
  if (ratio >= 0.4) return COK.warning;
  return COK.danger;
};

const HodFeedbackPage: React.FC = () => {
  const { showError } = useToast();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [analytics, setAnalytics] = useState<FeedbackAnalytics | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState('');
  const [rating, setRating] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await departmentManagerService.getDepartmentFeedback(
        page, LIMIT, dateFilter || undefined, rating ? parseInt(rating) : undefined
      );
      if (res?.success) {
        setItems(res.data || []);
        setTotal(res.total || 0);
        if (res.analytics) setAnalytics(res.analytics);
      } else {
        showError(res?.message || 'Failed to load feedback');
      }
    } catch {
      showError('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [page, dateFilter, rating, showError]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(Math.ceil(total / LIMIT), 1);
  const avg = analytics ? Math.round(analytics.average_rating * 10) / 10 : 0;

  return (
    <div className="p-4">
      <HodPageHeader
        title="Department Feedback"
        subtitle="Citizen feedback sent to your department only"
        actions={
          <button className="cok-btn-outlined px-3 py-2 text-xs flex items-center gap-1" style={{ borderRadius: 0 }} onClick={load}>
            <FiRefreshCw /> Refresh
          </button>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <HodStatCard label="Total Feedback" value={analytics?.total_feedback ?? total} />
        <HodStatCard
          label="Average Rating"
          value={<span className="flex items-center gap-1">{avg} <FiStar size={18} style={{ color: COK.warning }} /></span>}
          accent={avg >= 7 ? COK.success : avg >= 4 ? COK.warning : COK.danger}
          hint="out of 10"
        />
      </div>

      <HodCard>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b" style={{ borderColor: COK.border }}>
          <select className="cok-auth-input py-2 px-3 text-sm" value={dateFilter}
            onChange={e => { setDateFilter(e.target.value); setPage(1); }}>
            <option value="">All time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This week</option>
            <option value="last_week">Last week</option>
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
          </select>
          <select className="cok-auth-input py-2 px-3 text-sm" value={rating}
            onChange={e => { setRating(e.target.value); setPage(1); }}>
            <option value="">Any rating</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => <option key={r} value={r}>{r} / 10</option>)}
          </select>
        </div>

        {loading ? (
          <HodEmpty message="Loading feedback..." />
        ) : items.length === 0 ? (
          <HodEmpty message="No feedback found for your department with these filters." />
        ) : (
          <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
            {items.map(item => {
              const outOf = item.rate_out_of || 10;
              return (
                <div key={item._id} className="px-4 py-3 bg-gray-50 hover:bg-gray-100 border-b border-gray-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold" style={{ color: COK.primary, fontFamily: FONT }}>{item.user_name || 'Anonymous'}</p>
                        <HodChip label={`${item.rate ?? '—'}/${outOf}`} color={ratingColor(item.rate || 0, outOf)} />
                        {item.provider_name && <span className="text-xs" style={{ color: COK.gray }}>served by {item.provider_name}</span>}
                      </div>
                      <p className="text-sm mt-1" style={{ color: COK.textMid }}>{item.textmessage || 'No comment left.'}</p>
                      <p className="text-xs mt-1.5" style={{ color: COK.gray }}>
                        {item.department_name ? `${item.department_name} · ` : ''}{formatDateTime(item.created_date)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <HodPagination page={page} totalPages={totalPages} onPage={setPage} />
      </HodCard>
    </div>
  );
};

export default HodFeedbackPage;
