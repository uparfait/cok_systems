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
  FiTrendingUp, FiTrendingDown, FiRefreshCw, FiCalendar, FiUsers, 
  FiTruck, FiCheckCircle, FiClock, FiBarChart2, FiPieChart
} from 'react-icons/fi';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

// Colors for charts
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <FiBarChart2 className="w-6 h-6 text-purple-600" />
              Comprehensive analytics for parking and service delivery
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            <button 
              onClick={fetchAnalyticsData}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Parking Check-Ins</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{totalParkingCheckIns}</p>
                <p className="text-xs text-green-600 mt-1 flex items-center">
                  <FiTrendingUp className="w-3 h-3 mr-1" /> Today
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FiTruck className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Service Visitors</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{totalServiceVisitors}</p>
                <p className="text-xs text-green-600 mt-1 flex items-center">
                  <FiTrendingUp className="w-3 h-3 mr-1" /> Today
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <FiUsers className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Employees</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{employeeStats.active || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  of {employeeStats.total || 0} total
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <FiCheckCircle className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg Feedback</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">
                  {feedbackData?.overall_average?.average_rating?.toFixed(1) || '0.0'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {feedbackData?.overall_average?.total_feedback || 0} reviews
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <FiPieChart className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Parking Activity Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Parking Activity</h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={parkingHourly} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCheckIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCheckOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(v) => `${v}:00`}
                      stroke="#9ca3af"
                      fontSize={12}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip formatter={(v: any) => [v || 0]} labelFormatter={(l) => `${l}:00`} />
                    <Legend />
                    <Area type="monotone" dataKey="check_in" stroke="#3b82f6" strokeWidth={2} fill="url(#colorCheckIn)" name="Check-Ins" dot={false} activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="check_out" stroke="#ef4444" strokeWidth={2} fill="url(#colorCheckOut)" name="Check-Outs" dot={false} activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Service Delivery Activity Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Delivery Activity</h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serviceHourly} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorService" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(v) => `${v}:00`}
                      stroke="#9ca3af"
                      fontSize={12}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip formatter={(v: any) => [v || 0, 'Visitors']} labelFormatter={(l) => `${l}:00`} />
                    <Area type="monotone" dataKey="visitors_checked_in" stroke="#10b981" strokeWidth={2} fill="url(#colorService)" name="Visitors" dot={false} activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Comparison Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Parking vs Service Delivery</h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(v) => `${v}:00`}
                      stroke="#9ca3af"
                      fontSize={12}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="parking" fill="#3b82f6" name="Parking" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="service" fill="#10b981" name="Service" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Feedback by Department */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Feedback by Department</h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent"></div>
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
                    >
                      {feedbackPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
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
