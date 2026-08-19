import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { statisticsService, feedbackService, departmentService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { useToast } from '../../../core/contexts/ToastContext';
import { FiStar, FiTrendingUp, FiRefreshCw, FiMessageSquare, FiBarChart2, FiTarget, FiEye, FiX } from 'react-icons/fi';
import FeedbackFeed from './components/FeedbackFeed';
import type { AppliedFilter, FeedbackItem, DeptOption, PeriodValue } from './components/FeedbackFeed';

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const NEUTRAL_DARK = "#333333";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";

const buttonBaseStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  borderRadius: 0,
};

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'year', label: 'This Year' },
  { value: 'range', label: 'Custom Range' },
];

interface DepartmentRating { department: string; department_id: string; average_rating: number; total_feedback: number; average_out_of: number; }


const FeedbackPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [deptRatings, setDeptRatings] = useState<DepartmentRating[]>([]);
  const [overallAvg, setOverallAvg] = useState({ average_rating: 0, total_feedback: 0 });
  const [totalFeedback, setTotalFeedback] = useState(0);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [selectedDept, setSelectedDept] = useState<{ name: string; id: string } | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [units, setUnits] = useState<DeptOption[]>([]);

  const [period, setPeriod] = useState<PeriodValue>('month');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [applied, setApplied] = useState<AppliedFilter>({ period: 'month' });

  const fetchData = useCallback(async (filter: AppliedFilter) => {
    setLoading(true);
    try {
      const params = {
        period: filter.period,
        from: filter.period === 'range' ? filter.from : undefined,
        to: filter.period === 'range' ? filter.to : undefined,
      };
      const deptR = await departmentService.getAll();
      const deptMap = new Map<string, string>();
      if (deptR.success && deptR.data) {
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
      const [avgR, totalsR] = await Promise.all([
        statisticsService.getFeedbackAverageByDepartment(params),
        statisticsService.getFeedbackTotals(params),
      ]);
      const avgData = avgR?.data || {};
      if (avgData?.by_department) {
        setDeptRatings(Object.entries(avgData.by_department).map(([name, data]: [string, any]) => ({ department: name, department_id: deptMap.get(name) || '', average_rating: data.average_rating || 0, total_feedback: data.total_feedback || 0, average_out_of: data.average_out_of || 5 })).sort((a, b) => b.average_rating - a.average_rating));
      } else {
        setDeptRatings([]);
      }
      setOverallAvg(avgData?.overall_average || { average_rating: 0, total_feedback: 0 });
      setTotalFeedback((totalsR?.data || {}).total || 0);
    } catch (error) { showError('Failed to load feedback'); }
    finally { setLoading(false); }
  }, [showError]);

  useEffect(() => { if (!authLoading && !isAuthenticated) navigate('/login'); }, [authLoading, isAuthenticated, navigate]);
  useEffect(() => { if (isAuthenticated && !authLoading) fetchData(applied); }, [isAuthenticated, authLoading, fetchData, applied]);

  const handlePeriodChange = (value: PeriodValue) => {
    setPeriod(value);
    if (value !== 'range') setApplied({ period: value });
  };

  const handleApplyRange = () => {
    if (!rangeFrom) return;
    setApplied({ period: 'range', from: rangeFrom, to: rangeTo || undefined });
  };

  const fetchDeptFeedback = useCallback(async (name: string, id: string) => {
    if (!id) { showError(`Missing ID for ${name}`); return; }
    setFeedbackList([]); setSelectedDept({ name, id }); setFeedbackLoading(true);
    try { const r = await feedbackService.searchByDepartment(id, 1, 100); if (r.success) setFeedbackList(Array.isArray(r.data) ? r.data : (r.data?.data || [])); else setFeedbackList([]); }
    catch (error) { setFeedbackList([]); } finally { setFeedbackLoading(false); }
  }, [showError]);

  const insights = deptRatings.reduce((acc, d) => { acc.total += d.total_feedback; if (d.average_rating >= 4.5) acc.excellent += d.total_feedback; else if (d.average_rating >= 3.5) acc.good += d.total_feedback; else acc.poor += d.total_feedback; return acc; }, { total: 0, excellent: 0, good: 0, poor: 0 });

  if (authLoading) return <div className="flex items-center justify-center min-h-[600px]"><LoadingSpinner /></div>;

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="bg-white border border-[#E0E0E0] p-4">
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
                <button onClick={handleApplyRange} disabled={!rangeFrom} className="w-full sm:w-auto px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed" style={{ ...buttonBaseStyle, backgroundColor: PRIMARY, color: WHITE, border: 'none' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}>Apply</button>
              </>
            )}
            <button onClick={() => fetchData(applied)} disabled={loading} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 disabled:opacity-50 transition-colors" style={{ ...buttonBaseStyle, backgroundColor: PRIMARY, color: WHITE, border: 'none' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}><FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: 'Total Feedback', value: totalFeedback.toLocaleString(), sub: 'For the selected period', icon: FiMessageSquare, color: 'text-[#056daa]', bg: 'bg-[rgba(5,109,170,0.1)]' },
            { label: 'Average Rating', value: overallAvg.average_rating?.toFixed(1) || '0.0', sub: <div className="flex mt-1">{[1, 2, 3, 4, 5].map(s => <FiStar key={s} className={`w-3 h-3 ${s <= Number(overallAvg.average_rating || 0) ? 'text-[#F39C12] fill-[#F39C12]' : 'text-[#E0E0E0]'}`} />)}</div>, icon: FiStar, color: 'text-[#F39C12]', bg: 'bg-[rgba(243,156,18,0.12)]' },
            { label: 'Departments', value: deptRatings.length, sub: 'Receiving feedback', icon: FiTarget, color: 'text-[#2980B9]', bg: 'bg-[rgba(41,128,185,0.1)]' },
            { label: 'Satisfaction Rate', value: `${((Number(overallAvg.average_rating?.toFixed(2)) || 0) * 10).toFixed(2)}%`, sub: 'Overall', icon: FiTrendingUp, color: 'text-[#388E3C]', bg: 'bg-[rgba(76,175,80,0.12)]' },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-[#E0E0E0] p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ fontFamily: fontHeading, color: PRIMARY }}>{s.label}</p><p className="text-xl font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{s.value}</p>{typeof s.sub === 'string' ? <p className="text-xs text-[#9E9E9E] mt-0.5">{s.sub}</p> : s.sub}</div>
                <div className={`w-10 h-10 ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
              </div>
            </div>
          ))}
        </div>

        {selectedDept && (
          <div key={selectedDept.id} id="feedback-messages-section" className="bg-white border border-[#E0E0E0]">
            <div className="p-4 border-b border-[#E0E0E0]"><div className="flex items-center justify-between"><h2 className="text-sm font-bold flex items-center gap-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}><FiMessageSquare className="w-4 h-4 text-[#056daa]" />Feedback - {selectedDept.name}</h2><button onClick={() => { setFeedbackList([]); setSelectedDept(null); }} className="p-1 hover:bg-[#F7F9FB]"><FiX className="w-4 h-4" /></button></div></div>
            <div className="p-4">
              {feedbackLoading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-2 border-[#056daa] border-t-transparent" /><span className="ml-2 text-sm text-[#9E9E9E]">Loading...</span></div>
                : feedbackList.length > 0 ? <div className="overflow-x-auto"><table className="w-full"><thead style={{ backgroundColor: 'rgba(5,109,170,0.06)' }}><tr>{['Visitor', 'Rating', 'Comment', 'Date'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ fontFamily: fontHeading, color: PRIMARY }}>{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-[#E0E0E0]">{feedbackList.map((fb, i) => <tr key={fb._id || i} className="hover:bg-[#F7F9FB]"><td className="px-3 py-2.5"><div className="flex items-center gap-2"><div className="w-7 h-7 bg-[rgba(5,109,170,0.1)] flex items-center justify-center"><FiMessageSquare className="w-3.5 h-3.5 text-[#056daa]" /></div><span className="text-sm font-medium text-[#333333]">{fb.user_name || 'Anonymous'}</span></div></td><td className="px-3 py-2.5"><span className="text-sm font-bold text-[#333333]">{fb.rate || 0}/{fb.rate_out_of || 10}</span></td><td className="px-3 py-2.5 max-w-xs text-xs text-[#555555]">{fb.textmessage ? (fb.textmessage.length > 100 ? fb.textmessage.substring(0, 100) + '...' : fb.textmessage) : <span className="text-[#9E9E9E] italic">No message</span>}</td><td className="px-3 py-2.5 text-xs text-[#555555]">{fb.created_date ? new Date(fb.created_date).toLocaleDateString() : 'N/A'}</td></tr>)}</tbody></table></div>
                  : <div className="text-center py-8"><FiMessageSquare className="w-10 h-10 text-[#E0E0E0] mx-auto mb-2" /><p className="text-sm text-[#9E9E9E]">No feedback messages for {selectedDept.name}</p></div>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="bg-white border border-[#E0E0E0]">
              <div className="p-4 border-b border-[#E0E0E0]"><h2 className="text-sm font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Department Rankings</h2><p className="text-xs text-[#555555] mt-0.5">Sorted by average rating</p></div>
              <div className="overflow-x-auto">
                <table className="w-full"><thead className="sticky top-0 z-10" style={{ backgroundColor: 'rgba(5,109,170,0.06)' }}><tr>{['Rank', 'Department', 'Rating', 'Feedback', 'Performance'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ fontFamily: fontHeading, color: PRIMARY }}>{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-[#E0E0E0]">
                    {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-2 border-[#056daa] border-t-transparent mx-auto" /></td></tr>
                      : deptRatings.length > 0 ? deptRatings.map((d, i) => (
                          <tr key={d.department} className="hover:bg-[#F7F9FB]">
                            <td className="px-4 py-3"><span className={`inline-flex items-center justify-center w-7 h-7 text-xs font-bold ${i === 0 ? 'bg-[rgba(243,156,18,0.12)] text-[#F39C12]' : i === 1 ? 'bg-[rgba(51,51,51,0.08)] text-[#555555]' : i === 2 ? 'bg-[rgba(243,156,18,0.12)] text-[#F39C12]' : 'bg-[rgba(5,109,170,0.06)] text-[#555555]'}`}>{i + 1}</span></td>
                            <td className="px-4 py-3 text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{d.department}</td>
                            <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="text-sm font-bold text-[#333333]">{d.average_rating?.toFixed(1) || '0.0'}</span><div className="flex">{[1, 2, 3, 4, 5].map(s => <FiStar key={s} className={`w-3 h-3 ${s <= Number(d.average_rating || 0) ? 'text-[#F39C12] fill-[#F39C12]' : 'text-[#E0E0E0]'}`} />)}</div></div></td>
                            <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="text-xs text-[#555555]">{d.total_feedback} reviews</span><button onClick={() => fetchDeptFeedback(d.department, d.department_id)} disabled={!d.department_id} className="text-xs text-[#056daa] hover:text-[#045d94] font-medium flex items-center gap-1 disabled:opacity-50"><FiEye className="w-3 h-3" />View</button></div></td>
                            <td className="px-4 py-3"><span className={`text-xs px-2 py-1 font-medium ${d.average_rating >= 4.5 ? 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]' : d.average_rating >= 3.5 ? 'bg-[rgba(5,109,170,0.1)] text-[#045d94]' : d.average_rating >= 2.5 ? 'bg-[rgba(243,156,18,0.12)] text-[#F39C12]' : 'bg-[rgba(231,76,60,0.12)] text-[#E74C3C]'}`}>{d.average_rating >= 4.5 ? 'Excellent' : d.average_rating >= 3.5 ? 'Good' : d.average_rating >= 2.5 ? 'Average' : 'Poor'}</span></td>
                          </tr>
                        )) : <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#9E9E9E]"><FiEye className="w-8 h-8 text-[#E0E0E0] mx-auto mb-2" />No data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white border border-[#E0E0E0] p-4"><h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}><FiBarChart2 className="w-4 h-4 text-[#056daa]" />Performance Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2.5 bg-[rgba(76,175,80,0.12)]"><span className="text-xs font-medium text-[#388E3C]">Excellent (4.5+)</span><span className="text-sm font-bold text-[#388E3C]">{insights.excellent}</span></div>
                <div className="flex justify-between items-center p-2.5 bg-[rgba(5,109,170,0.1)]"><span className="text-xs font-medium text-[#045d94]">Good (3.5-4.4)</span><span className="text-sm font-bold text-[#056daa]">{insights.good}</span></div>
                <div className="flex justify-between items-center p-2.5 bg-[rgba(243,156,18,0.12)]"><span className="text-xs font-medium text-[#F39C12]">Needs Improvement</span><span className="text-sm font-bold text-[#F39C12]">{insights.poor}</span></div>
              </div>
            </div>
          </div>
        </div>

        <FeedbackFeed applied={applied} departments={departments} units={units} />
      </div>
    </MainLayout>
  );
};

export default FeedbackPage;
