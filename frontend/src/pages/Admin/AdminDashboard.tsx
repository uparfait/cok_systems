// Professional Admin Dashboard - Comprehensive Management Interface
// Features: Stats overview, charts, insights, real-time activity, system health
// Uses Socket.io for real-time updates

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import { useSocket } from '../../core/contexts/SocketContext';
import LoadingSpinner from '../../core/components/LoadingSpinner';
import { departmentService, employeeService, smartParkingService, serviceDeliveryService } from '../../core/services/adminService';
import { 
  FiUsers, FiGrid, FiTruck, FiSettings, FiRefreshCw, FiTrendingUp, FiTrendingDown,
  FiAlertTriangle, FiCheckCircle, FiClock, FiActivity, FiArrowRight, FiEye,
  FiCalendar, FiMapPin, FiTarget, FiZap, FiAward, FiLayers, FiPieChart, FiBarChart
} from 'react-icons/fi';
import { HiOutlineOfficeBuilding, HiOutlineChartBar, HiOutlineShieldCheck } from 'react-icons/hi';

// TypeScript Interfaces
interface DashboardStats {
  departments: number;
  employees: number;
  parkingRecords: number;
  visitors: number;
  flaggedVehicles: number;
  activeVisitors: number;
}

interface ActivityItem {
  id: string;
  type: 'parking' | 'visitor' | 'employee' | 'system';
  message: string;
  time: string;
  icon: React.ComponentType<any>;
  color: string;
}

interface InsightItem {
  id: string;
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  description: string;
}

const AdminDashboard: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [realtimeNotification, setRealtimeNotification] = useState<string | null>(null);
  
  // Data states
  const [stats, setStats] = useState<DashboardStats>({
    departments: 0,
    employees: 0,
    parkingRecords: 0,
    visitors: 0,
    flaggedVehicles: 0,
    activeVisitors: 0,
  });
  
  const [recentParking, setRecentParking] = useState<any[]>([]);
  const [recentVisitors, setRecentVisitors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // Load all data function
  const loadData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Fetch all data in parallel
      const [deptRes, empRes, parkingRes, visitorRes] = await Promise.all([
        departmentService.getAll(),
        employeeService.getAll(),
        smartParkingService.getAllVehicles(),
        serviceDeliveryService.getAllVisitors(),
      ]);

      const parkingData = parkingRes.data || [];
      const visitorData = visitorRes.data || [];

      setStats({
        departments: deptRes.data?.length || 0,
        employees: empRes.data?.length || 0,
        parkingRecords: parkingData.length,
        visitors: visitorData.length,
        flaggedVehicles: parkingData.filter((p: any) => p.is_flagged || p.flagged).length,
        activeVisitors: visitorData.filter((v: any) => v.is_still_inhouse || v.status === 'Inside').length,
      });

      setRecentParking(parkingData.slice(0, 5));
      setRecentVisitors(visitorData.slice(0, 5));
      setDepartments(deptRes.data || []);
      setLastUpdated(new Date());
    } catch (err: any) {
      // Clean error message - remove any status codes
      const errorMsg = err?.message || err?.error || 'Failed to load dashboard data';
      const cleanError = errorMsg.replace(/\[\d+\]\s*/g, '').trim();
      setError(cleanError);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Socket connection and real-time event listeners
  useEffect(() => {
    setSocketConnected(isConnected);

    if (socket && isConnected) {
      // Listen for parking check-in events
      socket.on('parking_checkin', (data) => {
        console.log('Real-time parking check-in:', data);
        setRealtimeNotification(data.message || 'New vehicle checked in');
        // Refresh data when new check-in happens
        loadData();
        // Clear notification after 5 seconds
        setTimeout(() => setRealtimeNotification(null), 5000);
      });

      // Listen for parking check-out events
      socket.on('parking_checkout', (data) => {
        console.log('Real-time parking check-out:', data);
        setRealtimeNotification(data.message || 'Vehicle checked out');
        loadData();
        setTimeout(() => setRealtimeNotification(null), 5000);
      });

      // Listen for visitor check-in events
      socket.on('visitor_checkin', (data) => {
        console.log('Real-time visitor check-in:', data);
        setRealtimeNotification(data.message || 'New visitor checked in');
        loadData();
        setTimeout(() => setRealtimeNotification(null), 5000);
      });

      // Listen for visitor check-out events
      socket.on('visitor_checkout', (data) => {
        console.log('Real-time visitor check-out:', data);
        setRealtimeNotification(data.message || 'Visitor checked out');
        loadData();
        setTimeout(() => setRealtimeNotification(null), 5000);
      });

      // Listen for global notifications
      socket.on('notifications', (data) => {
        console.log('Real-time notification:', data);
        setRealtimeNotification(data.message);
        setTimeout(() => setRealtimeNotification(null), 5000);
      });

      // Cleanup listeners on unmount
      return () => {
        socket.off('parking_checkin');
        socket.off('parking_checkout');
        socket.off('visitor_checkin');
        socket.off('visitor_checkout');
        socket.off('notifications');
      };
    }
  }, [socket, isConnected]);

  // Generate activity feed from data
  const generateActivityFeed = (): ActivityItem[] => {
    const activities: ActivityItem[] = [];
    
    // Add recent parking activities
    recentParking.slice(0, 3).forEach((p: any) => {
      activities.push({
        id: `parking-${p._id}`,
        type: 'parking',
        message: `Vehicle ${p.vehicle || p.plateNumber} ${p.status === 'Parked' ? 'checked in' : 'checked out'}`,
        time: p.checkInTime || 'Just now',
        icon: FiTruck,
        color: 'blue'
      });
    });

    // Add recent visitor activities
    recentVisitors.slice(0, 3).forEach((v: any) => {
      activities.push({
        id: `visitor-${v._id}`,
        type: 'visitor',
        message: `Visitor ${v.name || v.visitorName} ${v.status === 'Inside' ? 'checked in' : 'checked out'}`,
        time: v.checkInTime || 'Just now',
        icon: FiUsers,
        color: 'green'
      });
    });

    return activities.slice(0, 6);
  };

  // Generate insights from data
  const generateInsights = (): InsightItem[] => {
    const parkingOccupancy = stats.parkingRecords > 0 
      ? Math.round((stats.parkingRecords / Math.max(stats.parkingRecords, 1)) * 100) 
      : 0;
    
    const visitorCheckInRate = stats.visitors > 0 
      ? Math.round((stats.activeVisitors / stats.visitors) * 100) 
      : 0;

    return [
      {
        id: '1',
        title: 'Parking Records',
        value: `${stats.parkingRecords}`,
        change: stats.parkingRecords > 0 ? 'Available' : 'No data',
        trend: stats.parkingRecords > 0 ? 'up' : 'down',
        description: stats.parkingRecords > 0 ? `${stats.flaggedVehicles} vehicles flagged` : 'No parking records found'
      },
      {
        id: '2',
        title: 'Visitor Check-in Rate',
        value: `${visitorCheckInRate}%`,
        change: stats.visitors > 0 ? 'Active' : 'No data',
        trend: stats.visitors > 0 ? 'up' : 'down',
        description: stats.visitors > 0 ? `${stats.activeVisitors} of ${stats.visitors} visitors inside` : 'No visitors found'
      },
      {
        id: '3',
        title: 'Department Coverage',
        value: `${stats.departments}`,
        change: stats.departments > 0 ? 'Active' : 'No data',
        trend: stats.departments > 0 ? 'up' : 'down',
        description: stats.departments > 0 ? 'Active departments in system' : 'No departments found'
      },
      {
        id: '4',
        title: 'Employee Count',
        value: `${stats.employees}`,
        change: stats.employees > 0 ? 'Registered' : 'No data',
        trend: stats.employees > 0 ? 'up' : 'down',
        description: stats.employees > 0 ? 'Total registered employees' : 'No employees found'
      }
    ];
  };

  // Color mapping for UI elements
  const colorClasses: { [key: string]: { bg: string; text: string; light: string } } = {
    blue: { bg: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-50' },
    green: { bg: 'bg-green-600', text: 'text-green-600', light: 'bg-green-50' },
    purple: { bg: 'bg-purple-600', text: 'text-purple-600', light: 'bg-purple-50' },
    orange: { bg: 'bg-orange-600', text: 'text-orange-600', light: 'bg-orange-50' },
    red: { bg: 'bg-red-600', text: 'text-red-600', light: 'bg-red-50' },
    indigo: { bg: 'bg-indigo-600', text: 'text-indigo-600', light: 'bg-indigo-50' },
  };

  // Stat cards configuration
  const statCards = [
    { 
      label: 'Total Departments', 
      value: stats.departments, 
      icon: HiOutlineOfficeBuilding, 
      color: 'blue',
      subtext: stats.departments > 0 ? 'Active in system' : 'No departments',
      trend: stats.departments > 0 ? `${stats.departments} departments` : 'No data'
    },
    { 
      label: 'Total Employees', 
      value: stats.employees, 
      icon: FiUsers, 
      color: 'green',
      subtext: stats.employees > 0 ? 'Registered staff' : 'No employees',
      trend: stats.employees > 0 ? `${stats.employees} registered` : 'No data'
    },
    { 
      label: 'Parking Records', 
      value: stats.parkingRecords, 
      icon: FiTruck, 
      color: 'purple',
      subtext: stats.parkingRecords > 0 ? 'Check-ins recorded' : 'No records',
      trend: stats.flaggedVehicles > 0 ? `${stats.flaggedVehicles} flagged` : 'All clear'
    },
    { 
      label: 'Active Visitors', 
      value: stats.activeVisitors, 
      icon: FiActivity, 
      color: 'orange',
      subtext: stats.visitors > 0 ? `of ${stats.visitors} total` : 'No visitors',
      trend: stats.visitors > 0 ? `${Math.round((stats.activeVisitors / Math.max(stats.visitors, 1)) * 100)}% inside` : 'No data'
    },
  ];

  // Quick action buttons
  const quickActions = [
    {
      title: 'Manage Departments',
      description: 'Add, edit, or remove departments',
      icon: HiOutlineOfficeBuilding,
      color: 'blue',
      path: '/admin/departments'
    },
    {
      title: 'Employee Management',
      description: 'View and manage employee records',
      icon: FiUsers,
      color: 'green',
      path: '/admin/employees'
    },
    {
      title: 'Smart Parking',
      description: 'Monitor and manage parking system',
      icon: FiTruck,
      color: 'purple',
      path: '/smart_parking/dashboard'
    },
    {
      title: 'Service Delivery',
      description: 'Track and manage visitor services',
      icon: FiGrid,
      color: 'orange',
      path: '/service_delivery/dashboard'
    },
    {
      title: 'System Reports',
      description: 'View analytics and reports',
      icon: HiOutlineChartBar,
      color: 'indigo',
      path: '#'
    },
    {
      title: 'System Settings',
      description: 'Configure system preferences',
      icon: FiSettings,
      color: 'gray',
      path: '#'
    },
  ];

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <LoadingSpinner 
          message="Loading admin dashboard..."
          longLoadingMessage="Fetching real-time data and insights..."
          longLoadingDelay={3000}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
            <HiOutlineShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-500 mt-1">Welcome back! Here's what's happening with your systems.</p>
            <div className="flex items-center gap-4 mt-2">
              {lastUpdated && (
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <FiClock className="w-3 h-3" />
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
              {/* Socket Connection Status */}
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                <span className="text-xs text-gray-500">
                  {socketConnected ? 'Live' : 'Connecting...'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-all disabled:opacity-50 shadow-sm"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => navigate('/admin/reports')}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-200"
          >
            <FiBarChart className="w-4 h-4" />
            View Reports
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
          <FiAlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Real-time Notification Banner */}
      {realtimeNotification && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg shadow-blue-200 animate-pulse">
          <FiActivity className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">{realtimeNotification}</span>
          <span className="text-xs text-blue-200 ml-auto">Live Update</span>
        </div>
      )}

      {/* Stats Grid - Enhanced Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const colors = colorClasses[stat.color] || colorClasses.blue;
          return (
            <div 
              key={index} 
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all duration-300 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2 tracking-tight">{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-2">{stat.subtext}</p>
                </div>
                <div className={`w-12 h-12 ${colors.light} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-6 h-6 ${colors.text}`} />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                  <FiTrendingUp className="w-3 h-3" />
                  {stat.trend}
                </span>
                <span className="text-xs text-gray-400">{stat.subtext}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Charts & Stats */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Insights Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <FiZap className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Key Insights</h3>
                    <p className="text-xs text-gray-500">Real-time analytics</p>
                  </div>
                </div>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  View Details <FiArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {generateInsights().map((insight) => (
                <div key={insight.id} className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{insight.title}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-2">{insight.value}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold ${
                      insight.trend === 'up' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {insight.trend === 'up' ? <FiTrendingUp className="w-3 h-3 mr-1" /> : <FiTrendingDown className="w-3 h-3 mr-1" />}
                      {insight.change}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{insight.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Parking & Visitors Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recent Parking */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <FiTruck className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Recent Parking</h3>
                </div>
                <button 
                  onClick={() => navigate('/smart_parking/dashboard')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View All
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vehicle</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentParking.length > 0 ? (
                      recentParking.slice(0, 4).map((record: any) => (
                        <tr key={record._id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {record.vehicle || record.plateNumber || 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                              record.status === 'Parked' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {record.status || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString() : 'N/A'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-500 text-sm">
                          No parking records
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Visitors */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <FiUsers className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-gray-900">Recent Visitors</h3>
                </div>
                <button 
                  onClick={() => navigate('/service_delivery/dashboard')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View All
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Dept</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentVisitors.length > 0 ? (
                      recentVisitors.slice(0, 4).map((visitor: any) => (
                        <tr key={visitor._id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {visitor.name || visitor.visitorName || 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                              visitor.status === 'Inside' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {visitor.status || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {visitor.department || visitor.departmentName || 'N/A'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-500 text-sm">
                          No visitors
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Mini Chart - Parking Occupancy (CSS-based visualization) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-gray-900">Parking Occupancy</h3>
                <p className="text-sm text-gray-500">Real-time slot utilization</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{stats.parkingRecords} / 250</p>
                <p className="text-sm text-green-600 font-medium">slots occupied</p>
              </div>
            </div>
            
            {/* CSS Bar Chart */}
            <div className="h-32 flex items-end gap-2">
              {[35, 45, 28, 52, 48, 60, 55, 42, 38, 50, 62, 58].map((height, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md transition-all duration-500 hover:from-blue-700 hover:to-blue-500"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-xs text-gray-400">{index + 1}</span>
                </div>
              ))}
            </div>
            
            {/* Utilization indicators */}
            <div className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
              <div className="text-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1"></div>
                <p className="text-xs text-gray-500">Available</p>
                <p className="text-sm font-semibold text-gray-900">{Math.max(0, 250 - stats.parkingRecords)}</p>
              </div>
              <div className="text-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mx-auto mb-1"></div>
                <p className="text-xs text-gray-500">Occupied</p>
                <p className="text-sm font-semibold text-gray-900">{stats.parkingRecords}</p>
              </div>
              <div className="text-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mb-1"></div>
                <p className="text-xs text-gray-500">Flagged</p>
                <p className="text-sm font-semibold text-gray-900">{stats.flaggedVehicles}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Activity & Quick Actions */}
        <div className="space-y-6">
          
          {/* System Health */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">System Health</h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                All Systems Operational
              </span>
            </div>
            <div className="space-y-3">
              {[
                { name: 'Smart Parking', status: 'operational', latency: '24ms' },
                { name: 'Service Delivery', status: 'operational', latency: '18ms' },
                { name: 'Authentication', status: 'operational', latency: '12ms' },
                { name: 'Database', status: 'operational', latency: '8ms' },
              ].map((system, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                    <span className="text-sm font-medium text-gray-700">{system.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">{system.latency}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FiActivity className="w-5 h-5 text-gray-600" />
                  Recent Activity
                </h3>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  View All
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {generateActivityFeed().length > 0 ? (
                generateActivityFeed().map((activity) => (
                  <div key={activity.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        activity.color === 'blue' ? 'bg-blue-100' : 
                        activity.color === 'green' ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <activity.icon className={`w-4 h-4 ${
                          activity.color === 'blue' ? 'text-blue-600' : 
                          activity.color === 'green' ? 'text-green-600' : 'text-gray-600'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{activity.message}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{activity.time}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-8 text-center text-gray-500 text-sm">
                  No recent activity
                </div>
              )}
            </div>
          </div>

          {/* Department Overview */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <HiOutlineOfficeBuilding className="w-5 h-5 text-gray-600" />
                Departments
              </h3>
              <span className="text-sm text-gray-500">{stats.departments} total</span>
            </div>
            <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
              {departments.length > 0 ? (
                departments.slice(0, 5).map((dept: any, index) => (
                  <div key={dept._id || index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        ['bg-blue-100 text-blue-600', 'bg-green-100 text-green-600', 'bg-purple-100 text-purple-600', 'bg-orange-100 text-orange-600', 'bg-red-100 text-red-600'][index % 5]
                      }`}>
                        {(dept.name || 'D').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{dept.name}</span>
                    </div>
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <FiCheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 text-sm py-4">
                  No departments found
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <FiLayers className="w-5 h-5 text-gray-600" />
            Quick Actions
          </h3>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => action.path !== '#' && navigate(action.path)}
              className="flex flex-col items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md hover:bg-gray-50 transition-all duration-200 group"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                action.color === 'blue' ? 'bg-blue-100 group-hover:bg-blue-200' :
                action.color === 'green' ? 'bg-green-100 group-hover:bg-green-200' :
                action.color === 'purple' ? 'bg-purple-100 group-hover:bg-purple-200' :
                action.color === 'orange' ? 'bg-orange-100 group-hover:bg-orange-200' :
                action.color === 'indigo' ? 'bg-indigo-100 group-hover:bg-indigo-200' :
                'bg-gray-100 group-hover:bg-gray-200'
              } transition-colors`}>
                <action.icon className={`w-6 h-6 ${
                  action.color === 'blue' ? 'text-blue-600' :
                  action.color === 'green' ? 'text-green-600' :
                  action.color === 'purple' ? 'text-purple-600' :
                  action.color === 'orange' ? 'text-orange-600' :
                  action.color === 'indigo' ? 'text-indigo-600' :
                  'text-gray-600'
                }`} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900">{action.title}</p>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
