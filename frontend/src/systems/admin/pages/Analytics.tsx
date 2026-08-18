// Analytics - Analytics Dashboard for Service Delivery & Parking
// Features: Multiple charts, statistics, comparisons

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { statisticsService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { useToast } from '../../../core/contexts/ToastContext';
import {
  FiTrendingUp, FiRefreshCw, FiUsers,
  FiTruck, FiCheckCircle, FiBarChart2, FiPieChart
} from 'react-icons/fi';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LabelList
} from 'recharts';

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const DANGER = "#E74C3C";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const ACCENT_DARK_BLUE = "#2980B9";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const COLORS = [PRIMARY, SUCCESS, WARNING, DANGER, ACCENT_DARK_BLUE];

interface HourlyParkingData {
  hour: number;
  check_in: number;
  check_out: number;
}

interface HourlyServiceData {
  hour: number;
  visitors_checked_in: number;
}

interface FeedbackData {
  by_department: { [key: string]: { average_rating: number; total_feedback: number } };
  overall_average: { average_rating: number; total_feedback: number };
}

const Analytics: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showError } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');
  
  // Data states
  const [parkingHourly, setParkingHourly] = useState<HourlyParkingData[]>([]);
  const [serviceHourly, setServiceHourly] = useState<HourlyServiceData[]>([]);
  const [employeeStats, setEmployeeStats] = useState<any>({});
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [serviceDeliveryStats, setServiceDeliveryStats] = useState<any>({});
  const [parkingStats, setParkingStats] = useState<any>({});

  // Fetch all analytics data
  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch parking hourly stats
      const parkingHourlyRes = await statisticsService.getHourlyParkingStats();
      const parkingHourlyData = parkingHourlyRes?.data?.hourly || parkingHourlyRes?.hourly || [];
      setParkingHourly(parkingHourlyData);

      // Fetch service delivery hourly stats
      const serviceHourlyRes = await statisticsService.getHourlyServiceDeliveryStats();
      const serviceHourlyData = serviceHourlyRes?.data?.hourly || serviceHourlyRes?.hourly || [];
      setServiceHourly(serviceHourlyData);

      // Fetch employee stats
      const empStatsRes = await statisticsService.getEmployeeStats();
      setEmployeeStats(empStatsRes?.data || empStatsRes || {});

      // Fetch feedback data
      const feedbackRes = await statisticsService.getFeedbackAverageByDepartment();
      setFeedbackData(feedbackRes?.data || null);

      // Fetch service delivery stats
      const serviceStatsRes = await statisticsService.getServiceDeliveryStats();
      setServiceDeliveryStats(serviceStatsRes?.data || {});

      // Fetch currently parked stats
      const parkedRes = await statisticsService.getCurrentlyParkedStats();
      setParkingStats(parkedRes?.data || {});

    } catch (error) {
      console.error('Error fetching analytics data:', error);
      showError('Failed to load analytics data');
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [showError]);

  // Initial load
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchAnalyticsData();
    }
  }, [isAuthenticated, authLoading, fetchAnalyticsData]);

  // Prepare data for combined comparison chart
  const comparisonData = parkingHourly.map((p, i) => ({
    hour: p.hour,
    parking: p.check_in,
    service: serviceHourly[i]?.visitors_checked_in || 0
  }));

  // Prepare data for feedback pie chart
  const feedbackPieData = feedbackData?.by_department ? 
    Object.entries(feedbackData.by_department).map(([dept, data]: [string, any]) => ({
      name: dept,
      value: data.total_feedback || 0
    })).filter(d => d.value > 0) : [];

  // Calculate totals
  const totalParkingCheckIns = parkingHourly.reduce((sum, h) => sum + h.check_in, 0);
  const totalParkingCheckOuts = parkingHourly.reduce((sum, h) => sum + h.check_out, 0);
  const totalServiceVisitors = serviceHourly.reduce((sum, h) => sum + h.visitors_checked_in, 0);

  // Loading state
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
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-[#333333] flex items-center gap-2" style={{ fontFamily: fontHeading }}>
              <FiBarChart2 className="w-4 h-4 text-[#056daa]" />
              Comprehensive analytics for parking and service delivery
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="cok-auth-input pr-3 py-2 text-sm"
              style={{ paddingLeft: '12px' }}
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            <button
              onClick={fetchAnalyticsData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium"
              style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
            >
              <FiRefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Key Metrics */}
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
                  <FiTrendingUp className="w-3 h-3 mr-1" /> Today
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
                  <FiTrendingUp className="w-3 h-3 mr-1" /> Today
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

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Parking Activity Chart */}
          <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
            <h2 className="text-sm font-bold text-[#333333] mb-3">Parking Activity</h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent"></div>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={parkingHourly} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
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
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(v: number) => `${v}:00`}
                      tick={{ fontSize: 12, fill: GRAY_DISABLED }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 12, fill: GRAY_DISABLED }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: any) => [v || 0]} labelFormatter={(l) => `${l}:00`} contentStyle={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0, boxShadow: CARD_SHADOW }} />
                    <Legend />
                    <Area type="monotone" dataKey="check_in" stroke={PRIMARY} strokeWidth={2} fill="url(#colorCheckIn)" name="Check-Ins" dot={{ r: 3 }} activeDot={{ r: 6, fill: PRIMARY, stroke: '#fff', strokeWidth: 2 }} label={{ position: 'top', fill: NEUTRAL_DARK, fontSize: 10, fontWeight: 600 }} />
                    <Area type="monotone" dataKey="check_out" stroke={DANGER} strokeWidth={2} fill="url(#colorCheckOut)" name="Check-Outs" dot={{ r: 3 }} activeDot={{ r: 6, fill: DANGER, stroke: '#fff', strokeWidth: 2 }} label={{ position: 'top', fill: NEUTRAL_DARK, fontSize: 10, fontWeight: 600 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Service Delivery Activity Chart */}
          <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
            <h2 className="text-sm font-bold text-[#333333] mb-3">Service Delivery Activity</h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent"></div>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serviceHourly} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorService" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SUCCESS} stopOpacity={0.25}/>
                        <stop offset="95%" stopColor={SUCCESS} stopOpacity={0.02}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(v: number) => `${v}:00`}
                      tick={{ fontSize: 12, fill: GRAY_DISABLED }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 12, fill: GRAY_DISABLED }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: any) => [v || 0, 'Visitors']} labelFormatter={(l) => `${l}:00`} contentStyle={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0, boxShadow: CARD_SHADOW }} />
                    <Area type="monotone" dataKey="visitors_checked_in" stroke={SUCCESS} strokeWidth={2} fill="url(#colorService)" name="Visitors" dot={{ r: 3 }} activeDot={{ r: 6, fill: SUCCESS, stroke: '#fff', strokeWidth: 2 }} label={{ position: 'top', fill: NEUTRAL_DARK, fontSize: 10, fontWeight: 600 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Comparison Chart */}
          <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
            <h2 className="text-sm font-bold text-[#333333] mb-3">Parking vs Service Delivery</h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent"></div>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(v: number) => `${v}:00`}
                      tick={{ fontSize: 12, fill: GRAY_DISABLED }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 12, fill: GRAY_DISABLED }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0, boxShadow: CARD_SHADOW }} />
                    <Legend />
                    <Bar dataKey="parking" fill={PRIMARY} name="Parking">
                      <LabelList dataKey="parking" position="top" style={{ fill: NEUTRAL_DARK, fontWeight: 700, fontSize: 11, fontFamily: fontHeading }} />
                    </Bar>
                    <Bar dataKey="service" fill={SUCCESS} name="Service">
                      <LabelList dataKey="service" position="top" style={{ fill: NEUTRAL_DARK, fontWeight: 700, fontSize: 11, fontFamily: fontHeading }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Feedback by Department */}
          <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
            <h2 className="text-sm font-bold text-[#333333] mb-3">Feedback by Department</h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent"></div>
              </div>
            ) : feedbackPieData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={feedbackPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={{ stroke: GRAY_DISABLED }}
                    >
                      {feedbackPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0, boxShadow: CARD_SHADOW }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-[#555555]">
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
