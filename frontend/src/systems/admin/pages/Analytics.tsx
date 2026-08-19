import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { statisticsService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { useToast } from '../../../core/contexts/ToastContext';
import {
  FiTrendingUp, FiRefreshCw, FiUsers,
  FiTruck, FiCheckCircle, FiPieChart
} from 'react-icons/fi';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, LabelList
} from 'recharts';

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const DANGER = "#E74C3C";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'year', label: 'This Year' },
  { value: 'range', label: 'Custom Range' },
];

type PeriodValue = 'today' | 'week' | 'month' | 'last_month' | 'year' | 'range';

interface ActivityPoint {
  label: string;
  parking_check_in: number;
  parking_check_out: number;
  service_checked_in: number;
}

interface FeedbackData {
  by_department: { [key: string]: { average_rating: number; total_feedback: number } };
  overall_average: { average_rating: number; total_feedback: number };
}

const axisTickProps = {
  tick: { fontSize: 11, fill: GRAY_DISABLED },
  axisLine: false as const,
  tickLine: false as const,
};

const tooltipStyle = { backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0, boxShadow: CARD_SHADOW };
const pointLabel = { position: 'top' as const, fill: NEUTRAL_DARK, fontSize: 10, fontWeight: 600 };
const barLabelStyle = { fill: NEUTRAL_DARK, fontWeight: 700, fontSize: 11, fontFamily: fontHeading };

const Analytics: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [period, setPeriod] = useState<PeriodValue>('today');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  const [activityData, setActivityData] = useState<ActivityPoint[]>([]);
  const [employeeStats, setEmployeeStats] = useState<any>({});
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);

  const fetchAnalyticsData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const timelineRes = await statisticsService.getActivityTimeline({
        period,
        from: period === 'range' ? (rangeFrom || undefined) : undefined,
        to: period === 'range' ? (rangeTo || undefined) : undefined,
      });
      const timeline = (timelineRes as any)?.data;
      setActivityData(Array.isArray(timeline) ? timeline : []);

      const empStatsRes = await statisticsService.getEmployeeStats();
      setEmployeeStats((empStatsRes as any)?.data || empStatsRes || {});

      const feedbackRes = await statisticsService.getFeedbackAverageByDepartment();
      setFeedbackData((feedbackRes as any)?.data || null);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      showError('Failed to load analytics data');
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [period, rangeFrom, rangeTo, showError]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated && !authLoading && period !== 'range') {
      fetchAnalyticsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, period]);

  const handleApply = () => {
    fetchAnalyticsData();
  };

  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label || 'Today';
  const periodCaption = period === 'range' && rangeFrom
    ? `${rangeFrom} to ${rangeTo || 'today'}`
    : periodLabel;

  const feedbackBarData = feedbackData?.by_department
    ? Object.entries(feedbackData.by_department).map(([dept, data]: [string, any]) => ({
        name: dept,
        reviews: data.total_feedback || 0,
        rating: Number(data.average_rating || 0).toFixed(1),
      }))
    : [];

  const totalParkingCheckIns = activityData.reduce((sum, d) => sum + d.parking_check_in, 0);
  const totalServiceVisitors = activityData.reduce((sum, d) => sum + d.service_checked_in, 0);

  const activityMinWidth = Math.max(560, activityData.length * 52);
  const comparisonMinWidth = Math.max(560, activityData.length * 72);
  const feedbackChartHeight = Math.max(288, feedbackBarData.length * 48 + 60);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 flex-wrap">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodValue)}
            className="cok-auth-input w-full sm:w-auto pr-3 py-2 text-sm"
            style={{ paddingLeft: '12px', minHeight: '38px' }}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {period === 'range' && (
            <>
              <input
                type="date"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="cok-auth-input w-full sm:w-auto pr-2 py-2 text-sm"
                style={{ paddingLeft: '10px', minHeight: '38px' }}
              />
              <input
                type="date"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                className="cok-auth-input w-full sm:w-auto pr-2 py-2 text-sm"
                style={{ paddingLeft: '10px', minHeight: '38px' }}
              />
              <button
                onClick={handleApply}
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
          <button
            onClick={() => fetchAnalyticsData()}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 text-white text-xs font-medium"
            style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
          >
            <FiRefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#555555]">Parking Check-Ins</p>
                {(loading && firstLoad) ? (
                  <div className="h-8 w-16 bg-[#E0E0E0] animate-pulse mt-1"></div>
                ) : (
                  <p className="text-lg font-bold text-[#056daa] mt-0.5">{totalParkingCheckIns}</p>
                )}
                <p className="text-xs text-[#388E3C] mt-0.5 flex items-center">
                  <FiTrendingUp className="w-3 h-3 mr-1" /> {periodCaption}
                </p>
              </div>
              <div className="w-10 h-10 bg-[rgba(5,109,170,0.1)] flex items-center justify-center">
                <FiTruck className="w-5 h-5 text-[#056daa]" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#555555]">Service Visitors</p>
                {(loading && firstLoad) ? (
                  <div className="h-8 w-16 bg-[#E0E0E0] animate-pulse mt-1"></div>
                ) : (
                  <p className="text-lg font-bold text-[#388E3C] mt-0.5">{totalServiceVisitors}</p>
                )}
                <p className="text-xs text-[#388E3C] mt-0.5 flex items-center">
                  <FiTrendingUp className="w-3 h-3 mr-1" /> {periodCaption}
                </p>
              </div>
              <div className="w-10 h-10 bg-[rgba(76,175,80,0.12)] flex items-center justify-center">
                <FiUsers className="w-5 h-5 text-[#388E3C]" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#555555]">Active Employees</p>
                {(loading && firstLoad) ? (
                  <div className="h-8 w-16 bg-[#E0E0E0] animate-pulse mt-1"></div>
                ) : (
                  <p className="text-lg font-bold text-[#2980B9] mt-0.5">{employeeStats.active || 0}</p>
                )}
                <p className="text-xs text-[#555555] mt-0.5">
                  of {employeeStats.total || 0} total
                </p>
              </div>
              <div className="w-10 h-10 bg-[rgba(41,128,185,0.1)] flex items-center justify-center">
                <FiCheckCircle className="w-5 h-5 text-[#2980B9]" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#555555]">Avg Feedback</p>
                {(loading && firstLoad) ? (
                  <div className="h-8 w-16 bg-[#E0E0E0] animate-pulse mt-1"></div>
                ) : (
                  <p className="text-lg font-bold text-[#F39C12] mt-0.5">
                    {feedbackData?.overall_average?.average_rating?.toFixed(1) || '0.0'}
                  </p>
                )}
                <p className="text-xs text-[#555555] mt-0.5">
                  {feedbackData?.overall_average?.total_feedback || 0} reviews
                </p>
              </div>
              <div className="w-10 h-10 bg-[rgba(243,156,18,0.12)] flex items-center justify-center">
                <FiPieChart className="w-5 h-5 text-[#F39C12]" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
            <h2 className="text-sm font-bold text-[#333333] mb-3" style={{ fontFamily: fontHeading }}>Parking Activity</h2>
            {loading ? (
              <div className="h-72 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent"></div>
              </div>
            ) : activityData.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-sm text-[#9E9E9E]">No data for this period</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="h-72" style={{ minWidth: `${activityMinWidth}px` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorCheckIn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.25}/>
                          <stop offset="95%" stopColor={PRIMARY} stopOpacity={0.02}/>
                        </linearGradient>
                        <linearGradient id="colorCheckOut" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={DANGER} stopOpacity={0.25}/>
                          <stop offset="95%" stopColor={DANGER} stopOpacity={0.02}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                      <XAxis dataKey="label" {...axisTickProps} angle={-30} textAnchor="end" height={60} interval={0} />
                      <YAxis {...axisTickProps} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Area type="monotone" dataKey="parking_check_in" stroke={PRIMARY} strokeWidth={2} fill="url(#colorCheckIn)" name="Cars Checked In" dot={{ r: 3 }} activeDot={{ r: 6, fill: PRIMARY, stroke: '#fff', strokeWidth: 2 }} label={pointLabel} />
                      <Area type="monotone" dataKey="parking_check_out" stroke={DANGER} strokeWidth={2} fill="url(#colorCheckOut)" name="Cars Checked Out" dot={{ r: 3 }} activeDot={{ r: 6, fill: DANGER, stroke: '#fff', strokeWidth: 2 }} label={pointLabel} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
            <h2 className="text-sm font-bold text-[#333333] mb-3" style={{ fontFamily: fontHeading }}>Service Delivery Activity</h2>
            {loading ? (
              <div className="h-72 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent"></div>
              </div>
            ) : activityData.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-sm text-[#9E9E9E]">No data for this period</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="h-72" style={{ minWidth: `${activityMinWidth}px` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorService" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={SUCCESS} stopOpacity={0.25}/>
                          <stop offset="95%" stopColor={SUCCESS} stopOpacity={0.02}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                      <XAxis dataKey="label" {...axisTickProps} angle={-30} textAnchor="end" height={60} interval={0} />
                      <YAxis {...axisTickProps} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Area type="monotone" dataKey="service_checked_in" stroke={SUCCESS} strokeWidth={2} fill="url(#colorService)" name="Visitors Checked In" dot={{ r: 3 }} activeDot={{ r: 6, fill: SUCCESS, stroke: '#fff', strokeWidth: 2 }} label={pointLabel} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
            <h2 className="text-sm font-bold text-[#333333] mb-3" style={{ fontFamily: fontHeading }}>Parking vs Service Delivery</h2>
            {loading ? (
              <div className="h-72 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent"></div>
              </div>
            ) : activityData.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-sm text-[#9E9E9E]">No data for this period</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="h-72" style={{ minWidth: `${comparisonMinWidth}px` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                      <XAxis dataKey="label" {...axisTickProps} angle={-30} textAnchor="end" height={60} interval={0} />
                      <YAxis {...axisTickProps} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar dataKey="parking_check_in" fill={PRIMARY} name="Cars Checked In">
                        <LabelList dataKey="parking_check_in" position="top" style={barLabelStyle} />
                      </Bar>
                      <Bar dataKey="service_checked_in" fill={SUCCESS} name="Visitors Checked In">
                        <LabelList dataKey="service_checked_in" position="top" style={barLabelStyle} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
            <h2 className="text-sm font-bold text-[#333333] mb-3" style={{ fontFamily: fontHeading }}>Feedback by Department</h2>
            {loading ? (
              <div className="h-72 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent"></div>
              </div>
            ) : feedbackBarData.length > 0 ? (
              <div style={{ width: '100%', height: `${feedbackChartHeight}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={feedbackBarData} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                    <XAxis type="number" {...axisTickProps} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" {...axisTickProps} width={130} interval={0} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: any) => [value, name === 'reviews' ? 'Reviews' : name]} />
                    <Legend />
                    <Bar dataKey="reviews" fill={PRIMARY} name="Reviews" barSize={18}>
                      <LabelList dataKey="reviews" position="right" style={barLabelStyle} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-[#555555]">
                No feedback data available
              </div>
            )}
          </div>
        </div>

      </div>
    </MainLayout>
  );
};

export default Analytics;
