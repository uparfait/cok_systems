import React, { useState, useEffect, useCallback, useRef } from 'react';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import { feedbackService } from '../../../../core/services/adminService';
import { FiStar, FiMessageSquare, FiPhone } from 'react-icons/fi';

const PRIMARY = "#056daa";
const NEUTRAL_DARK = "#333333";
const fontHeading = "'Montserrat', sans-serif";

export type PeriodValue = 'today' | 'week' | 'month' | 'last_month' | 'year' | 'range';
export interface AppliedFilter { period: PeriodValue; from?: string; to?: string; }

export interface FeedbackItem { _id: string; department_name?: string; rate: number; rate_out_of: number; textmessage?: string; created_date?: string; user_name?: string; telephone?: string; provider_name?: string; department_id?: string; source?: string; }
export interface DeptOption { name: string; id: string; }

export default function FeedbackFeed({ applied, departments, units, initialTarget }: { applied: AppliedFilter; departments: DeptOption[]; units: DeptOption[]; initialTarget?: string }) {
  const [target, setTarget] = useState(initialTarget || 'all');
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (initialTarget) setTarget(initialTarget);
  }, [initialTarget]);

  const fetchPage = useCallback(async (p: number, append: boolean) => {
    const fetchId = ++fetchIdRef.current;
    if (append) setLoadingMore(true); else setInitialLoading(true);
    try {
      const r: any = await feedbackService.listFeedbacks({
        target,
        period: applied.period,
        from: applied.period === 'range' ? applied.from : undefined,
        to: applied.period === 'range' ? applied.to : undefined,
        page: p,
        limit: 10,
      });
      if (fetchId !== fetchIdRef.current) return;
      const rows: FeedbackItem[] = Array.isArray(r?.data) ? r.data : [];
      setItems((prev) => {
        if (!append) return rows;
        const seen = new Set(prev.map((x) => x._id));
        return [...prev, ...rows.filter((x) => !seen.has(x._id))];
      });
      setPage(r?.page || p);
      setTotalPages(r?.totalPages || 1);
      setTotal(r?.total || 0);
    } catch {
      if (fetchId === fetchIdRef.current && !append) setItems([]);
    } finally {
      if (fetchId === fetchIdRef.current) { setInitialLoading(false); setLoadingMore(false); }
    }
  }, [target, applied]);

  useEffect(() => {
    setItems([]);
    setPage(1);
    setTotalPages(1);
    fetchPage(1, false);
  }, [fetchPage]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60 && !loadingMore && !initialLoading && page < totalPages) {
      fetchPage(page + 1, true);
    }
  };

  return (
    <div className="bg-white border border-[#E0E0E0]">
      <div className="p-4 border-b border-[#E0E0E0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
            <FiMessageSquare className="w-4 h-4 text-[#056daa]" />Feedbacks
          </h2>
          <p className="text-xs text-[#555555] mt-0.5">{total} feedback{total === 1 ? '' : 's'} for the selected filters</p>
        </div>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="cok-auth-input w-full sm:w-72 text-sm"
          style={{ paddingLeft: '12px', minHeight: '38px' }}
        >
          <option value="all">All</option>
          <option value="general">General</option>
          {departments.length > 0 && (
            <optgroup label="Departments">
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </optgroup>
          )}
          {units.length > 0 && (
            <optgroup label="Units">
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </optgroup>
          )}
        </select>
      </div>

      {initialLoading ? (
        <div className="flex items-center justify-center py-12">
          <SpiralLoader />
          <span className="ml-2 text-sm text-[#9E9E9E]">Loading feedbacks...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <FiMessageSquare className="w-10 h-10 text-[#E0E0E0] mx-auto mb-2" />
          <p className="text-sm text-[#9E9E9E]">No feedback found for the selected filters</p>
        </div>
      ) : (
        <div className="p-4 max-h-[620px] overflow-y-auto" onScroll={handleScroll}>
          <div className="flex flex-col gap-4 w-full max-w-[520px] mx-auto">
            {items.map((fb, i) => (
              <div key={fb._id || i} className="bg-white border border-[#E0E0E0] p-4">
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <span className="text-sm font-bold leading-tight break-words" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                      {fb.user_name || 'Anonymous'}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 w-fit" style={{ fontFamily: fontHeading, backgroundColor: 'rgba(5,109,170,0.08)', color: PRIMARY }}>
                      {fb.department_name || 'General'}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs shrink-0">
                    <span className="flex items-center gap-1 text-sm font-bold" style={{ fontFamily: fontHeading, color: '#F39C12' }}>
                      <FiStar className="w-3.5 h-3.5 fill-[#F39C12]" />{fb.rate ?? 0}/{fb.rate_out_of || 10}
                    </span>
                    <span className="font-medium text-[#555555]">
                      {fb.created_date ? new Date(fb.created_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                    </span>
                    <span className="flex items-center gap-1 text-[#9E9E9E]">
                      <FiPhone className="w-3 h-3" />{fb.telephone || '-'}
                    </span>
                  </div>
                </div>
                <div className="p-3 text-sm leading-relaxed whitespace-pre-line break-words" style={{ backgroundColor: '#F7F9FB', border: '1px solid #E0E0E0', color: NEUTRAL_DARK }}>
                  {fb.textmessage ? fb.textmessage : <span className="italic text-[#9E9E9E]">No message</span>}
                </div>
              </div>
            ))}
            {loadingMore && (
              <div className="flex items-center justify-center py-3">
                <SpiralLoader />
                <span className="ml-2 text-xs text-[#9E9E9E]">Loading more...</span>
              </div>
            )}
            {!loadingMore && page >= totalPages && items.length > 0 && (
              <p className="text-center text-xs text-[#9E9E9E] py-2">All feedback loaded</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
