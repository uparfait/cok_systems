// Professional Admin Dashboard - Comprehensive Management Interface
// Features: Stats overview, charts, insights, real-time activity, system health
// Uses Socket.io for real-time updates

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { departmentService, employeeService, smartParkingService, serviceDeliveryService, statisticsService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import {
  FiUsers, FiGrid, FiTruck, FiSettings, FiRefreshCw, FiTrendingUp,
  FiAlertTriangle, FiCheckCircle, FiClock, FiActivity, FiArrowRight,
  FiWifiOff, FiX
} from 'react-icons/fi';
import { HiOutlineOfficeBuilding, HiOutlineChartBar, HiOutlineShieldCheck } from 'react-icons/hi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ==================== CONSTANTS ====================
const NOTIFICATION_DURATION = 5000;
const RELOAD_DEBOUNCE_DELAY = 2000;
const LOADING_TIMEOUT = 15000;
const MAX_ACTIVITY_ITEMS = 8;
const MAX_DEPARTMENTS_DISPLAY = 6;
const MODAL_PAGE_SIZE = 20;
const DEFAULT_PARKING_CAPACITY = 200;

// ==================== TYPE DEFINITIONS ====================
interface DashboardStats {
  departments: number;
  employees: number;
  parkingRecords: number;
  visitors: number;
  flaggedVehicles: number;
  activeVisitors: number;
  parkingCapacity: number;
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

interface ParkingRecord {
  _id: string;
  vehicle?: string;
  plateNumber?: string;
  plate_number?: string;
  driver_name?: string;
  status?: string;
  checkInTime?: string;
  check_in?: string;
  check_out?: string;
  is_flagged?: boolean;
  flagged?: boolean;
}

interface VisitorRecord {
  _id: string;
  name?: string;
  visitorName?: string;
  visitor_name?: string;
  full_name?: string;
  badge_number?: string;
  status?: string;
  department?: string;
  departmentName?: string;
  department_assigned?: string;
  departments_assigned?: Array<{ department_name?: string; department_id?: string }>;
  checkInTime?: string;
  check_in?: string;
  entry_date?: string;
  is_still_inhouse?: boolean;
}

interface Department {
  _id: string;
  name?: string;
  department_name?: string;
  total_employees?: number;
  created_date?: string;
}

interface HourlyParkingData {
  hour: number;
  check_in: number;
  check_out: number;
}

interface LoadingStates {
  stats: boolean;
  parking: boolean;
  visitors: boolean;
  departments: boolean;
}

// ==================== UTILITY FUNCTIONS ====================
const extractDataFromResponse = (response: any): any[] => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.data?.data)) return response.data.data;
  return [];
};

const getRelativeTime = (date: Date | string | undefined): string => {
  if (!date) return 'Recently';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Recently';
    }
    
    const now = new Date();
    const diff = now.getTime() - dateObj.getTime();
    
    if (diff < 0) return 'Just now';
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return dateObj.toLocaleDateString();
  } catch {
    return 'Recently';
  }
};

// ==================== COMPONENTS ====================
const StatCard = React.memo(({ 
  stat, 
  onClick, 
  colorClasses,
  loading = false
}: { 
  stat: any; 
  onClick: () => void; 
  colorClasses: Record<string, any>;
  loading?: boolean;
}) => {
  const Icon = stat.icon;
  const colors = colorClasses[stat.color] || colorClasses.blue;
  
  return (
    <div 
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-300 group cursor-pointer relative overflow-hidden"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      aria-label={`View ${stat.label}: ${stat.value}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${colors.light} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{stat.label}</p>
          {loading ? (
            <div className="h-9 w-16 bg-gray-200 rounded animate-pulse mt-2" />
          ) : (
            <p className="text-3xl font-bold text-gray-900 mt-2 tracking-tight">{stat.value}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">{stat.subtext}</p>
        </div>
        <div className={`w-12 h-12 ${colors.light} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-6 h-6 ${colors.text}`} aria-hidden="true" />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between relative">
        <span className="text-xs font-medium flex items-center gap-1 text-gray-500">
          <FiTrendingUp className="w-3 h-3" aria-hidden="true" />
          {stat.trend}
        </span>
        <span className="text-xs text-gray-400">Click to view</span>
      </div>
    </div>
  );
});

StatCard.displayName = 'StatCard';

const ActivityItemComponent = React.memo(({ activity }: { activity: ActivityItem }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    gray: 'bg-gray-100 text-gray-600'
  };
  
  const typeColorMap: Record<string, string> = {
    parking: 'bg-blue-100 text-blue-700',
    visitor: 'bg-green-100 text-green-700',
    system: 'bg-purple-100 text-purple-700'
  };
  
  return (
    <div className="px-5 py-3 hover:bg-blue-50/50 transition-colors cursor-pointer">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[activity.color] || colorMap.gray}`}>
          <activity.icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 font-medium truncate">{activity.message}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${typeColorMap[activity.type] || 'bg-gray-100 text-gray-700'}`}>
              {activity.type}
            </span>
            <span className="text-xs text-gray-400">{activity.time}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

ActivityItemComponent.displayName = 'ActivityItemComponent';

// ==================== MAIN COMPONENT ====================
const AdminDashboard: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  
  // Refs
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [error, setError] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [realtimeNotification, setRealtimeNotification] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Data States
  const [stats, setStats] = useState<DashboardStats>({
    departments: 0,
    employees: 0,
    parkingRecords: 0,
    visitors: 0,
    flaggedVehicles: 0,
    activeVisitors: 0,
    parkingCapacity: DEFAULT_PARKING_CAPACITY
  });
  
  const [recentParking, setRecentParking] = useState<ParkingRecord[]>([]);
  const [recentVisitors, setRecentVisitors] = useState<VisitorRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [hourlyParkingData, setHourlyParkingData] = useState<HourlyParkingData[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
  // Modal States
  const [showParkingModal, setShowParkingModal] = useState(false);
  const [showVisitorsModal, setShowVisitorsModal] = useState(false);
  const [allParkingRecords, setAllParkingRecords] = useState<ParkingRecord[]>([]);
  const [allVisitorRecords, setAllVisitorRecords] = useState<VisitorRecord[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [parkingPage, setParkingPage] = useState(1);
  const [visitorsPage, setVisitorsPage] = useState(1);
  const [parkingTotal, setParkingTotal] = useState(0);
  const [visitorsTotal, setVisitorsTotal] = useState(0);
  
  // Individual loading states
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    stats: false,
    parking: false,
    visitors: false,
    departments: false
  });

  // ==================== DATA FETCHING ====================
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    // Set loading timeout
    loadingTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setFirstLoad(false);
      setLoadingStates({
        stats: false,
        parking: false,
        visitors: false,
        departments: false
      });
    }, LOADING_TIMEOUT);
    
    try {
      setLoadingStates({
        stats: true,
        parking: true,
        visitors: true,
        departments: true
      });
      
      // Fetch all data in parallel
      const [deptRes, empRes, parkingRes, visitorRes, serviceStatsRes, hourlyStatsRes] = await Promise.allSettled([
        departmentService.getAll(),
        employeeService.getAll(),
        smartParkingService.getAllPaginated(1, 50),
        serviceDeliveryService.getAllVisitors(1, 50),
        statisticsService.getServiceDeliveryStats(),
        statisticsService.getHourlyParkingStats(),
      ]);
      
      // Process departments
      let departmentsCount = 0;
      let departmentsData: Department[] = [];
      if (deptRes.status === 'fulfilled') {
        departmentsData = extractDataFromResponse(deptRes.value);
        departmentsCount = departmentsData.length;
        setDepartments(departmentsData);
      }
      setLoadingStates(prev => ({ ...prev, departments: false }));
      
      // Process employees
      let employeesCount = 0;
      if (empRes.status === 'fulfilled') {
        const empData = extractDataFromResponse(empRes.value);
        employeesCount = empData.length;
      }
      setLoadingStates(prev => ({ ...prev, stats: false }));
      
      // Process parking
      let parkingData: ParkingRecord[] = [];
      let parkingCount = 0;
      let flaggedCount = 0;
      
      if (parkingRes.status === 'fulfilled') {
        parkingData = extractDataFromResponse(parkingRes.value);
        
        // Get parking count from total in response, or hourly stats, or data length
        if (parkingRes.value?.total !== undefined) {
          parkingCount = parkingRes.value.total;
        } else if (hourlyStatsRes.status === 'fulfilled' && hourlyStatsRes.value?.hourly) {
          const hourlyData = hourlyStatsRes.value.hourly;
          parkingCount = hourlyData.reduce((sum: number, d: any) => sum + (d.check_in || 0), 0);
        } else {
          parkingCount = parkingData.length;
        }
        
        flaggedCount = parkingData.filter((p: ParkingRecord) => p.is_flagged || p.flagged).length;
        setRecentParking(parkingData.slice(0, 5));
      }
      setLoadingStates(prev => ({ ...prev, parking: false }));
      
      // Process visitors
      let visitorData: VisitorRecord[] = [];
      let visitorCount = 0;
      let activeVisitorCount = 0;
      
      if (visitorRes.status === 'fulfilled') {
        visitorData = extractDataFromResponse(visitorRes.value);
        
        // Get visitor count from total in response, or data length
        if (visitorRes.value?.total !== undefined) {
          visitorCount = visitorRes.value.total;
        } else if (visitorRes.value?.data?.total !== undefined) {
          visitorCount = visitorRes.value.data.total;
        } else {
          visitorCount = visitorData.length;
        }
        
        if (serviceStatsRes.status === 'fulfilled' && serviceStatsRes.value?.data?.inhouse) {
          activeVisitorCount = serviceStatsRes.value.data.inhouse;
        } else {
          activeVisitorCount = visitorData.filter((v: VisitorRecord) => v.is_still_inhouse || v.status === 'Inside').length;
        }
        
        setRecentVisitors(visitorData.slice(0, 5));
      }
      setLoadingStates(prev => ({ ...prev, visitors: false }));
      
      setStats({
        departments: departmentsCount,
        employees: employeesCount,
        parkingRecords: parkingCount,
        visitors: visitorCount,
        flaggedVehicles: flaggedCount,
        activeVisitors: activeVisitorCount,
        parkingCapacity: DEFAULT_PARKING_CAPACITY
      });
      
      setLastUpdated(new Date());
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      
      const errorMsg = err?.message || err?.error || 'Failed to load dashboard data';
      const cleanError = errorMsg.replace(/\[\d+\]\s*/g, '').trim();
      
      if (err?.code === 'ECONNRESET' || err?.message?.includes('network') || !navigator.onLine) {
        setError('Unable to connect to server. Please check your network connection.');
        setIsOffline(true);
      } else {
        setError(cleanError);
      }
    } finally {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      setLoading(false);
      setFirstLoad(false);
    }
  }, []);

  const fetchHourlyAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const response = await statisticsService.getHourlyParkingStats();
      
      let hourlyData: any[] = [];
      
      if (response?.hourly) {
        hourlyData = response.hourly;
      } else if (response?.data?.hourly) {
        hourlyData = response.data.hourly;
      } else if (response?.data?.data?.hourly) {
        hourlyData = response.data.data.hourly;
      }
      
      if (Array.isArray(hourlyData)) {
        setHourlyParkingData(hourlyData);
      }
    } catch (error) {
      console.error('Error fetching hourly analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // ==================== HELPER FUNCTIONS ====================
  const scheduleReload = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      loadData();
    }, RELOAD_DEBOUNCE_DELAY);
  }, [loadData]);

  const showNotification = useCallback((message: string) => {
    setRealtimeNotification(message);
    
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    notificationTimerRef.current = setTimeout(() => {
      setRealtimeNotification(null);
    }, NOTIFICATION_DURATION);
  }, []);

  // ==================== MODAL HANDLERS ====================
  const handleOpenParkingModal = useCallback(async () => {
    setShowParkingModal(true);
    setModalLoading(true);
    setParkingPage(1);
    try {
      const response = await smartParkingService.getAllPaginated(1, MODAL_PAGE_SIZE);
      const records = response?.data || [];
      setAllParkingRecords(Array.isArray(records) ? records : []);
      setParkingTotal(response?.total || 0);
    } catch (error) {
      console.error('Error fetching all parking records:', error);
      setAllParkingRecords([]);
    } finally {
      setModalLoading(false);
    }
  }, []);
  
  const fetchParkingPage = useCallback(async (page: number) => {
    if (modalLoading) return; // Prevent multiple requests
    
    setModalLoading(true);
    try {
      const response = await smartParkingService.getAllPaginated(page, MODAL_PAGE_SIZE);
      const records = response?.data || [];
      setAllParkingRecords(Array.isArray(records) ? records : []);
      setParkingPage(page);
    } catch (error) {
      console.error('Error fetching parking records:', error);
    } finally {
      setModalLoading(false);
    }
  }, [modalLoading]);
  
  const handleOpenVisitorsModal = useCallback(async () => {
    setShowVisitorsModal(true);
    setModalLoading(true);
    setVisitorsPage(1);
    try {
      const response = await serviceDeliveryService.getAll(1, MODAL_PAGE_SIZE, true);
      const records = response?.data?.data || response?.data || response || [];
      setAllVisitorRecords(Array.isArray(records) ? records : []);
      setVisitorsTotal(response?.total || 0);
    } catch (error) {
      console.error('Error fetching all visitor records:', error);
      setAllVisitorRecords([]);
    } finally {
      setModalLoading(false);
    }
  }, []);
  
  const fetchVisitorsPage = useCallback(async (page: number) => {
    if (modalLoading) return; // Prevent multiple requests
    
    setModalLoading(true);
    try {
      const response = await serviceDeliveryService.getAll(page, MODAL_PAGE_SIZE, true);
      const records = response?.data?.data || response?.data || response || [];
      setAllVisitorRecords(Array.isArray(records) ? records : []);
      setVisitorsPage(page);
    } catch (error) {
      console.error('Error fetching visitor records:', error);
    } finally {
      setModalLoading(false);
    }
  }, [modalLoading]);
  
  const handleCloseParkingModal = useCallback(() => {
    setShowParkingModal(false);
    setAllParkingRecords([]);
    setParkingPage(1);
    setParkingTotal(0);
  }, []);
  
  const handleCloseVisitorsModal = useCallback(() => {
    setShowVisitorsModal(false);
    setAllVisitorRecords([]);
    setVisitorsPage(1);
    setVisitorsTotal(0);
  }, []);

  // ==================== NAVIGATION ====================
  const handleStatClick = useCallback((path: string) => {
    if (path) navigate(path);
  }, [navigate]);
  
  const handleQuickAction = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);
  
  const handleRefresh = useCallback(() => {
    loadData();
    fetchHourlyAnalytics();
  }, [loadData, fetchHourlyAnalytics]);

  // ==================== MEMOIZED VALUES ====================
  const colorClasses = useMemo(() => ({
    blue: { bg: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-50' },
    green: { bg: 'bg-green-600', text: 'text-green-600', light: 'bg-green-50' },
    purple: { bg: 'bg-purple-600', text: 'text-purple-600', light: 'bg-purple-50' },
    orange: { bg: 'bg-orange-600', text: 'text-orange-600', light: 'bg-orange-50' },
    red: { bg: 'bg-red-600', text: 'text-red-600', light: 'bg-red-50' },
    indigo: { bg: 'bg-indigo-600', text: 'text-indigo-600', light: 'bg-indigo-50' },
  }), []);

  const statCards = useMemo(() => [
    { 
      label: 'Total Departments', 
      value: stats.departments, 
      icon: HiOutlineOfficeBuilding, 
      color: 'blue',
      subtext: stats.departments > 0 ? 'Active in system' : 'No departments',
      trend: stats.departments > 0 ? `${stats.departments} departments` : 'No data',
      path: '/admin/departments'
    },
    { 
      label: 'Total Employees', 
      value: stats.employees, 
      icon: FiUsers, 
      color: 'green',
      subtext: stats.employees > 0 ? 'Registered staff' : 'No employees',
      trend: stats.employees > 0 ? `${stats.employees} registered` : 'No data',
      path: '/admin/employees'
    },
    { 
      label: 'Active Visitors', 
      value: stats.activeVisitors, 
      icon: FiActivity, 
      color: 'orange',
      subtext: stats.activeVisitors > 0 ? 'Currently inside' : 'No active visitors',
      trend: stats.flaggedVehicles > 0 ? `${stats.flaggedVehicles} flagged` : 'All clear',
      path: ''
    },
    { 
      label: "Today's Check-ins", 
      value: stats.parkingRecords, 
      icon: FiTruck, 
      color: 'purple',
      subtext: stats.parkingRecords > 0 ? 'Check-ins recorded' : 'No records',
      trend: stats.activeVisitors > 0 ? `${stats.activeVisitors} inside` : 'No data',
      path: '/admin/smart-parking'
    },
  ], [stats]);

  const quickActions = useMemo(() => [
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
      path: '/admin/reports'
    },
    {
      title: 'System Settings',
      description: 'Configure system preferences',
      icon: FiSettings,
      color: 'gray',
      path: '/admin/settings'
    },
  ], []);

  const activityFeed = useMemo((): ActivityItem[] => {
    const activities: ActivityItem[] = [];
    const now = new Date();
    
    recentParking.slice(0, 3).forEach((p: ParkingRecord) => {
      const checkInTime = p.checkInTime || p.check_in;
      const time = checkInTime ? new Date(checkInTime) : now;
      const plateNumber = p.vehicle || p.plateNumber || p.plate_number || p.driver_name || 'Unknown';
      const statusText = p.status === 'active' || p.status === 'Parked' ? 'checked in' : 'checked out';
      activities.push({
        id: `parking-${p._id}`,
        type: 'parking',
        message: `Vehicle ${plateNumber} ${statusText}`,
        time: getRelativeTime(time),
        icon: FiTruck,
        color: 'blue'
      });
    });
    
    recentVisitors.slice(0, 3).forEach((v: VisitorRecord) => {
      const checkInTime = v.checkInTime || v.check_in;
      const time = checkInTime ? new Date(checkInTime) : now;
      const visitorName = v.full_name || v.name || v.visitorName || v.visitor_name;
      const badgeNumber = v.badge_number;
      const displayText = visitorName 
        ? `Visitor ${visitorName}` 
        : (badgeNumber ? `Visitor with badge ${badgeNumber}` : 'Visitor');
      const statusText = v.is_still_inhouse === true || v.status === 'Inside' ? 'checked in' : 'checked out';
      activities.push({
        id: `visitor-${v._id}`,
        type: 'visitor',
        message: `${displayText} ${statusText}`,
        time: getRelativeTime(time),
        icon: FiUsers,
        color: 'green'
      });
    });
    
    departments.slice(0, 2).forEach((d: Department) => {
      const deptName = d.name || d.department_name || 'Unknown';
      activities.push({
        id: `dept-${d._id}`,
        type: 'system',
        message: `Department "${deptName}" is active`,
        time: d.created_date ? getRelativeTime(new Date(d.created_date)) : 'Recently',
        icon: HiOutlineOfficeBuilding,
        color: 'purple'
      });
    });
    
    return activities.slice(0, MAX_ACTIVITY_ITEMS);
  }, [recentParking, recentVisitors, departments]);

  // ==================== EFFECTS ====================
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      loadData();
    };
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        navigate('/login');
      } else {
        loadData();
        fetchHourlyAnalytics();
      }
    }
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [isAuthenticated, authLoading, navigate, loadData, fetchHourlyAnalytics]);

  useEffect(() => {
    setSocketConnected(isConnected);
    
    if (socket && isConnected) {
      const events = ['car_checkedin', 'car_checkedout', 'visitor_checkedin', 'visitor_checkedout', 'notifications'];
      
      events.forEach(event => {
        socket.on(event, (data: any) => {
          showNotification(data.message || `${event.replace('_', ' ')} detected`);
          scheduleReload();
        });
      });
    }
    
    return () => {
      if (socket) {
        const events = ['car_checkedin', 'car_checkedout', 'visitor_checkedin', 'visitor_checkedout', 'notifications'];
        events.forEach(event => socket.off(event));
      }
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    };
  }, [socket, isConnected, showNotification, scheduleReload]);

  // ==================== RENDER ====================
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
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <HiOutlineShieldCheck className="w-7 h-7 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-500 mt-1">Welcome back! Here's what's happening with your systems.</p>
              <div className="flex items-center gap-4 mt-2">
                {lastUpdated && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <FiClock className="w-3 h-3" aria-hidden="true" />
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </p>
                )}
                <div className="flex items-center gap-1.5">
                  <span 
                    className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
                    aria-label={socketConnected ? 'Connected to real-time updates' : 'Connecting to real-time updates'}
                  />
                  <span className="text-xs text-gray-500">
                    {socketConnected ? 'Live' : 'Connecting...'}
                  </span>
                </div>
                {isOffline && (
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <FiWifiOff className="w-3 h-3" aria-hidden="true" />
                    <span className="text-xs">Offline Mode</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-all disabled:opacity-50 shadow-sm"
              aria-label="Refresh dashboard data"
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>
  
        {error && (
          <div 
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between"
            role="alert"
            aria-live="polite"
          >
            <div className="flex items-center gap-2">
              <FiAlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
            <button 
              onClick={handleRefresh}
              className="text-sm px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors"
              aria-label="Retry loading data"
            >
              Retry
            </button>
          </div>
        )}
  
        {realtimeNotification && (
          <div 
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg shadow-blue-200 animate-pulse"
            role="status"
            aria-live="polite"
          >
            <FiActivity className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span className="font-medium">{realtimeNotification}</span>
            <span className="text-xs text-blue-200 ml-auto">Live Update</span>
          </div>
        )}
  
        {isOffline && (
          <div 
            className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg shadow-amber-200"
            role="alert"
            aria-live="polite"
          >
            <FiWifiOff className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span className="font-medium">You are offline. Some features may not work properly.</span>
          </div>
        )}
  
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <StatCard
              key={index}
              stat={stat}
              onClick={() => handleStatClick(stat.path)}
              colorClasses={colorClasses}
              loading={loading && firstLoad}
            />
          ))}
        </div>
  
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="xl:col-span-2 space-y-6">
            {/* Parking & Visitors Tables */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recent Parking */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-center gap-2">
                    <FiTruck className="w-5 h-5 text-purple-600" aria-hidden="true" />
                    <h2 className="font-semibold text-gray-900">Recent Parking</h2>
                  </div>
                  <button 
                    onClick={handleOpenParkingModal}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    aria-label="View all parking records"
                  >
                    View All <FiArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
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
                      {(loadingStates.parking && firstLoad) ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                            <div className="flex justify-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent"></div>
                            </div>
                          </td>
                        </tr>
                      ) : recentParking.length > 0 ? (
                        recentParking.slice(0, 5).map((record: ParkingRecord) => (
                          <tr 
                            key={record._id} 
                            className="hover:bg-purple-50/30 transition-colors cursor-pointer"
                            onClick={() => handleQuickAction('/smart_parking/dashboard')}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                  <FiTruck className="w-4 h-4 text-purple-600" aria-hidden="true" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  {record.vehicle || record.plateNumber || record.plate_number || record.driver_name || '___'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                                record.status === 'active' || record.status === 'Parked'
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {record.status === 'active' ? 'Parked' : record.status === 'completed' ? 'Completed' : record.status || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {record.checkInTime || record.check_in ? new Date(record.checkInTime || record.check_in as string).toLocaleTimeString() : '___'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-gray-500 text-sm">
                            <FiTruck className="w-8 h-8 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                            <p>No parking records</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
  
              {/* Recent Visitors */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-center gap-2">
                    <FiUsers className="w-5 h-5 text-green-600" aria-hidden="true" />
                    <h2 className="font-semibold text-gray-900">Recent Visitors</h2>
                  </div>
                  <button 
                    onClick={handleOpenVisitorsModal}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    aria-label="View all visitors"
                  >
                    View All <FiArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
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
                      {(loadingStates.visitors && firstLoad) ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                            <div className="flex justify-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent"></div>
                            </div>
                          </td>
                        </tr>
                      ) : recentVisitors.length > 0 ? (
                        recentVisitors.slice(0, 5).map((visitor: VisitorRecord) => (
                          <tr 
                            key={visitor._id} 
                            className="hover:bg-green-50/30 transition-colors cursor-pointer"
                            onClick={() => handleQuickAction('/service_delivery/dashboard')}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                  <FiUsers className="w-4 h-4 text-green-600" aria-hidden="true" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  {visitor.full_name || visitor.name || visitor.visitorName || visitor.visitor_name || 'N/A'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                                visitor.is_still_inhouse === true || visitor.status === 'Inside'
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {visitor.is_still_inhouse === true ? 'Inside' : visitor.status === 'Inside' ? 'Inside' : 'Outside'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {visitor.department || visitor.departmentName || visitor.department_assigned || (visitor.departments_assigned && visitor.departments_assigned[0]?.department_name) || 'Not yet assigned'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-gray-500 text-sm">
                            <FiUsers className="w-8 h-8 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                            <p>No visitors</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
  
            {/* Hourly Parking Analytics Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center">
                    <FiTrendingUp className="w-5 h-5 text-blue-600" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Hourly Parking Analytics</h2>
                    <p className="text-sm text-gray-500">Today's check-ins and check-outs</p>
                  </div>
                </div>
                <button
                  onClick={fetchHourlyAnalytics}
                  disabled={analyticsLoading}
                  className="text-sm px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 rounded-full text-blue-600 font-medium transition-all flex items-center gap-1 disabled:opacity-50"
                  aria-label="Refresh analytics data"
                >
                  <FiActivity className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                  Refresh
                </button>
              </div>

              {(analyticsLoading && firstLoad) ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                </div>
              ) : hourlyParkingData.length > 0 ? (
                <>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={hourlyParkingData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 25 }}
                      >
                        <defs>
                          <linearGradient id="colorCheckInAdmin" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00aaff" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#00aaff" stopOpacity={0.02}/>
                          </linearGradient>
                          <linearGradient id="colorCheckOutAdmin" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis
                          dataKey="hour"
                          tickFormatter={(value: number) => `${value.toString().padStart(2, '0')}:00`}
                          stroke="#9ca3af"
                          tick={{ fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#9ca3af"
                          tick={{ fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          label={{
                            value: 'Number of Vehicles',
                            angle: -90,
                            position: 'insideLeft',
                            style: { fill: '#6b7280', fontSize: 12, fontWeight: 500, textAnchor: 'middle' },
                            offset: 20
                          }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="check_in" 
                          name="Check-ins" 
                          stroke="#00aaff" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorCheckInAdmin)" 
                          animationDuration={1500}
                          dot={false}
                          activeDot={{ r: 6, fill: '#00aaff', stroke: '#fff', strokeWidth: 2 }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="check_out" 
                          name="Check-outs" 
                          stroke="#ef4444" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorCheckOutAdmin)" 
                          animationDuration={1500}
                          dot={false}
                          activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Total Check-ins</p>
                      <p className="text-xl font-bold text-blue-600">
                        {hourlyParkingData.reduce((sum, d) => sum + d.check_in, 0)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Total Check-outs</p>
                      <p className="text-xl font-bold text-red-600">
                        {hourlyParkingData.reduce((sum, d) => sum + d.check_out, 0)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Currently Parked</p>
                      <p className="text-xl font-bold text-green-600">
                        {stats.activeVisitors}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <FiActivity className="w-12 h-12 mb-2 opacity-50" aria-hidden="true" />
                  <p>No parking data available</p>
                  <p className="text-xs text-gray-400">Check back later for analytics</p>
                </div>
              )}
            </div>
          </div>
  
          {/* Right Column */}
          <div className="space-y-6">
            {/* Recent Activity Feed */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <FiActivity className="w-5 h-5 text-blue-600" aria-hidden="true" />
                    Recent Activity
                  </h2>
                  <button 
                    onClick={handleRefresh}
                    disabled={loading}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 disabled:opacity-50"
                    aria-label="Refresh activity feed"
                  >
                    <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                    Refresh
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {activityFeed.length > 0 ? (
                  activityFeed.map((activity) => (
                    <ActivityItemComponent key={activity.id} activity={activity} />
                  ))
                ) : (
                  <div className="px-5 py-8 text-center text-gray-500 text-sm">
                    <FiActivity className="w-8 h-8 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                    <p>No recent activity</p>
                  </div>
                )}
              </div>
            </div>
  
            {/* Department Overview */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <HiOutlineOfficeBuilding className="w-5 h-5 text-blue-600" aria-hidden="true" />
                  Departments
                </h2>
                <button 
                  onClick={() => handleQuickAction('/admin/departments')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  aria-label="View all departments"
                >
                  View All <FiArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
                {loadingStates.departments ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                  </div>
                ) : departments.length > 0 ? (
                  departments.slice(0, MAX_DEPARTMENTS_DISPLAY).map((dept: Department, index) => {
                    const gradientClasses = [
                      'bg-gradient-to-br from-blue-500 to-blue-600',
                      'bg-gradient-to-br from-green-500 to-green-600',
                      'bg-gradient-to-br from-purple-500 to-purple-600',
                      'bg-gradient-to-br from-orange-500 to-orange-600',
                      'bg-gradient-to-br from-red-500 to-red-600',
                      'bg-gradient-to-br from-indigo-500 to-indigo-600'
                    ];
                    
                    return (
                      <div 
                        key={dept._id || index} 
                        onClick={() => handleQuickAction('/admin/departments')}
                        className="flex items-center justify-between p-3 hover:bg-blue-50/50 rounded-xl transition-all cursor-pointer group"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleQuickAction('/admin/departments')}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-sm ${gradientClasses[index % gradientClasses.length]}`}>
                            {(dept.name || dept.department_name || 'D').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-gray-800">{dept.name || dept.department_name}</span>
                            <p className="text-xs text-gray-400">{dept.total_employees || 0} employees</p>
                          </div>
                        </div>
                        <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium flex items-center gap-1 group-hover:bg-green-200">
                          <FiCheckCircle className="w-3 h-3" aria-hidden="true" />
                          Active
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-gray-500 text-sm py-6">
                    <HiOutlineOfficeBuilding className="w-10 h-10 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                    <p>No departments found</p>
                    <button 
                      onClick={() => handleQuickAction('/admin/departments')}
                      className="text-blue-600 hover:text-blue-700 text-sm mt-2"
                      aria-label="Add new department"
                    >
                      Add Department
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Parking Records Modal with Fixed Pagination */}
      {showParkingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseParkingModal}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <FiTruck className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">All Parking Records</h2>
                  <p className="text-sm text-gray-500">{parkingTotal.toLocaleString()} total records</p>
                </div>
              </div>
              <button 
                onClick={handleCloseParkingModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto min-h-0">
              {modalLoading && allParkingRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div>
                  <p className="text-gray-500">Loading parking records...</p>
                </div>
              ) : allParkingRecords.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vehicle</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Driver</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Check-in</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Check-out</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {allParkingRecords.map((record) => (
                        <tr key={record._id} className="hover:bg-purple-50/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">
                              {record.plate_number || record.plateNumber || record.vehicle || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {record.driver_name || 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                              record.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {record.status === 'active' ? 'Parked' : record.status === 'completed' ? 'Completed' : record.status || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {record.check_in ? new Date(record.check_in).toLocaleString() : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {record.check_out ? new Date(record.check_out).toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Loading indicator for page changes */}
                  {modalLoading && allParkingRecords.length > 0 && (
                    <div className="flex items-center justify-center py-4 bg-gray-50">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent mr-2"></div>
                      <span className="text-sm text-gray-500">Loading page {parkingPage}...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <FiTruck className="w-12 h-12 mb-2 opacity-50" />
                  <p>No parking records found</p>
                </div>
              )}
            </div>
            
            {/* Pagination Controls */}
            {parkingTotal > MODAL_PAGE_SIZE && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
                <div className="text-sm text-gray-500">
                  Showing {((parkingPage - 1) * MODAL_PAGE_SIZE) + 1} to {Math.min(parkingPage * MODAL_PAGE_SIZE, parkingTotal)} of {parkingTotal.toLocaleString()} records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchParkingPage(parkingPage - 1)}
                    disabled={parkingPage === 1 || modalLoading}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {(() => {
                      const totalPages = Math.ceil(parkingTotal / MODAL_PAGE_SIZE);
                      const currentPage = parkingPage;
                      const maxVisible = 5;
                      let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                      let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                      
                      if (endPage - startPage + 1 < maxVisible) {
                        startPage = Math.max(1, endPage - maxVisible + 1);
                      }
                      
                      const pages = [];
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(i);
                      }
                      
                      return (
                        <>
                          {startPage > 1 && (
                            <>
                              <button
                                onClick={() => fetchParkingPage(1)}
                                disabled={modalLoading}
                                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                              >
                                1
                              </button>
                              {startPage > 2 && <span className="px-2 text-gray-400">...</span>}
                            </>
                          )}
                          
                          {pages.map(page => (
                            <button
                              key={page}
                              onClick={() => fetchParkingPage(page)}
                              disabled={modalLoading}
                              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                page === currentPage
                                  ? 'bg-purple-600 text-white border border-purple-600'
                                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                              } disabled:opacity-50`}
                            >
                              {page}
                            </button>
                          ))}
                          
                          {endPage < totalPages && (
                            <>
                              {endPage < totalPages - 1 && <span className="px-2 text-gray-400">...</span>}
                              <button
                                onClick={() => fetchParkingPage(totalPages)}
                                disabled={modalLoading}
                                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                              >
                                {totalPages}
                              </button>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => fetchParkingPage(parkingPage + 1)}
                    disabled={parkingPage >= Math.ceil(parkingTotal / MODAL_PAGE_SIZE) || modalLoading}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visitors Modal with Fixed Pagination */}
      {showVisitorsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseVisitorsModal}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-green-50 to-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <FiUsers className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">All Visitor Records</h2>
                  <p className="text-sm text-gray-500">{visitorsTotal.toLocaleString()} total records</p>
                </div>
              </div>
              <button 
                onClick={handleCloseVisitorsModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto min-h-0">
              {modalLoading && allVisitorRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mb-4"></div>
                  <p className="text-gray-500">Loading visitor records...</p>
                </div>
              ) : allVisitorRecords.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Badge</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Department</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Check-in</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {allVisitorRecords.map((visitor) => (
                        <tr key={visitor._id} className="hover:bg-green-50/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">
                              {visitor.full_name || visitor.name || visitor.visitorName || visitor.visitor_name || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {visitor.badge_number || 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                              visitor.is_still_inhouse === true ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {visitor.is_still_inhouse === true ? 'Inside' : 'Outside'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {visitor.departments_assigned?.[0]?.department_name || visitor.department || visitor.departmentName || 'Not assigned'}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {visitor.entry_date ? new Date(visitor.entry_date).toLocaleString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Loading indicator for page changes */}
                  {modalLoading && allVisitorRecords.length > 0 && (
                    <div className="flex items-center justify-center py-4 bg-gray-50">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent mr-2"></div>
                      <span className="text-sm text-gray-500">Loading page {visitorsPage}...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <FiUsers className="w-12 h-12 mb-2 opacity-50" />
                  <p>No visitor records found</p>
                </div>
              )}
            </div>
            
            {/* Pagination Controls */}
            {visitorsTotal > MODAL_PAGE_SIZE && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
                <div className="text-sm text-gray-500">
                  Showing {((visitorsPage - 1) * MODAL_PAGE_SIZE) + 1} to {Math.min(visitorsPage * MODAL_PAGE_SIZE, visitorsTotal)} of {visitorsTotal.toLocaleString()} records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchVisitorsPage(visitorsPage - 1)}
                    disabled={visitorsPage === 1 || modalLoading}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {(() => {
                      const totalPages = Math.ceil(visitorsTotal / MODAL_PAGE_SIZE);
                      const currentPage = visitorsPage;
                      const maxVisible = 5;
                      let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                      let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                      
                      if (endPage - startPage + 1 < maxVisible) {
                        startPage = Math.max(1, endPage - maxVisible + 1);
                      }
                      
                      const pages = [];
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(i);
                      }
                      
                      return (
                        <>
                          {startPage > 1 && (
                            <>
                              <button
                                onClick={() => fetchVisitorsPage(1)}
                                disabled={modalLoading}
                                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                              >
                                1
                              </button>
                              {startPage > 2 && <span className="px-2 text-gray-400">...</span>}
                            </>
                          )}
                          
                          {pages.map(page => (
                            <button
                              key={page}
                              onClick={() => fetchVisitorsPage(page)}
                              disabled={modalLoading}
                              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                page === currentPage
                                  ? 'bg-green-600 text-white border border-green-600'
                                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                              } disabled:opacity-50`}
                            >
                              {page}
                            </button>
                          ))}
                          
                          {endPage < totalPages && (
                            <>
                              {endPage < totalPages - 1 && <span className="px-2 text-gray-400">...</span>}
                              <button
                                onClick={() => fetchVisitorsPage(totalPages)}
                                disabled={modalLoading}
                                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                              >
                                {totalPages}
                              </button>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => fetchVisitorsPage(visitorsPage + 1)}
                    disabled={visitorsPage >= Math.ceil(visitorsTotal / MODAL_PAGE_SIZE) || modalLoading}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default AdminDashboard;