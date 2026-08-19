import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { departmentService, employeeService, smartParkingService, serviceDeliveryService, statisticsService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { FiUsers, FiTruck, FiSettings, FiRefreshCw, FiTrendingUp, FiAlertTriangle, FiClock, FiActivity, FiWifiOff, FiGrid } from 'react-icons/fi';
import { HiOutlineOfficeBuilding, HiOutlineShieldCheck, HiOutlineChartBar } from 'react-icons/hi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StatCard from './sub/AdminDashboardStats';
import ActivityFeed from './sub/AdminDashboardActivity';
import LoadingInline from './sub/LoadingSpinner';


const PRIMARY = "#056daa";
const DANGER = "#E74C3C";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const NOTIFICATION_DURATION = 5000, RELOAD_DEBOUNCE_DELAY = 2000, LOADING_TIMEOUT = 15000, SILENT_REFRESH_INTERVAL = 10000, DEFAULT_PARKING_CAPACITY = 200;

interface DashboardStats { departments: number; units: number; employees: number; parkingRecords: number; visitors: number; flaggedVehicles: number; activeVisitors: number; parkingCapacity: number; }

const extractDataFromResponse = (response: any): any[] => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.data?.data)) return response.data.data;
  return [];
};

const AdminDashboard: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [realtimeNotification, setRealtimeNotification] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [stats, setStats] = useState<DashboardStats>({ departments: 0, units: 0, employees: 0, parkingRecords: 0, visitors: 0, flaggedVehicles: 0, activeVisitors: 0, parkingCapacity: DEFAULT_PARKING_CAPACITY });
  const [recentParking, setRecentParking] = useState<any[]>([]);
  const [recentVisitors, setRecentVisitors] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [hourlyParkingData, setHourlyParkingData] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [loadingStates, setLoadingStates] = useState({ stats: false, parking: false, visitors: false, departments: false });

  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true); setError('');
      loadingTimeoutRef.current = setTimeout(() => { setLoading(false); setFirstLoad(false); }, LOADING_TIMEOUT);
    }
    try {
      if (!silent) setLoadingStates({ stats: true, parking: true, visitors: true, departments: true });
      const [deptRes, empRes, parkingRes, visitorRes, serviceStatsRes, hourlyStatsRes] = await Promise.allSettled([
        departmentService.getAll(), employeeService.getAll(), smartParkingService.getAllPaginated(1, 50), serviceDeliveryService.getAllVisitors(1, 50), statisticsService.getServiceDeliveryStats(), statisticsService.getHourlyParkingStats()
      ]);
      let departmentsCount = 0, unitsCount = 0, departmentsData: any[] = [];
      if (deptRes.status === 'fulfilled') { departmentsData = extractDataFromResponse(deptRes.value); departmentsCount = departmentsData.length; unitsCount = departmentsData.reduce((sum: number, d: any) => sum + (Array.isArray(d.sub_departments) ? d.sub_departments.length : 0), 0); setDepartments(departmentsData); }
      setLoadingStates(prev => ({ ...prev, departments: false }));
      let employeesCount = 0;
      if (empRes.status === 'fulfilled') { employeesCount = extractDataFromResponse(empRes.value).length; }
      setLoadingStates(prev => ({ ...prev, stats: false }));
      let parkingData: any[] = [], parkingCount = 0, flaggedCount = 0;
      if (parkingRes.status === 'fulfilled') {
        parkingData = extractDataFromResponse(parkingRes.value);
        parkingCount = parkingRes.value?.total !== undefined ? parkingRes.value.total : (hourlyStatsRes.status === 'fulfilled' && hourlyStatsRes.value?.hourly ? hourlyStatsRes.value.hourly.reduce((sum: number, d: any) => sum + (d.check_in || 0), 0) : parkingData.length);
        flaggedCount = parkingData.filter((p: any) => p.is_flagged || p.flagged).length;
        setRecentParking([...parkingData].sort((a: any, b: any) => new Date(b.check_in || b.checkInTime || 0).getTime() - new Date(a.check_in || a.checkInTime || 0).getTime()).slice(0, 5));
      }
      setLoadingStates(prev => ({ ...prev, parking: false }));
      let visitorData: any[] = [], visitorCount = 0, activeVisitorCount = 0;
      if (visitorRes.status === 'fulfilled') {
        visitorData = extractDataFromResponse(visitorRes.value);
        visitorCount = visitorRes.value?.total !== undefined ? visitorRes.value.total : (visitorRes.value?.data?.total !== undefined ? visitorRes.value.data.total : visitorData.length);
        activeVisitorCount = serviceStatsRes.status === 'fulfilled' && serviceStatsRes.value?.data?.inhouse ? serviceStatsRes.value.data.inhouse : visitorData.filter((v: any) => v.is_still_inhouse || v.status === 'Inside').length;
        setRecentVisitors([...visitorData].sort((a: any, b: any) => new Date(b.entry_date || b.check_in || 0).getTime() - new Date(a.entry_date || a.check_in || 0).getTime()).slice(0, 5));
      }
      setLoadingStates(prev => ({ ...prev, visitors: false }));
      try {
        const auditResp = await fetch('/cok/api/audit/logs?page=1&limit=40', { headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } });
        if (auditResp.ok) {
          const auditData = await auditResp.json();
          setAuditLogs(Array.isArray(auditData?.data) ? auditData.data : []);
        }
      } catch { }
      setStats({ departments: departmentsCount, units: unitsCount, employees: employeesCount, parkingRecords: parkingCount, visitors: visitorCount, flaggedVehicles: flaggedCount, activeVisitors: activeVisitorCount, parkingCapacity: DEFAULT_PARKING_CAPACITY });
      setLastUpdated(new Date());
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      if (silent) return;
      const cleanError = (err?.message || err?.error || 'Failed to load dashboard data').replace(/\[\d+\]\s*/g, '').trim();
      if (err?.code === 'ECONNRESET' || err?.message?.includes('network') || !navigator.onLine) { setError('Unable to connect to server.'); setIsOffline(true); }
      else setError(cleanError);
    } finally {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      if (!silent) { setLoading(false); setFirstLoad(false); }
    }
  }, []);

  const fetchHourlyAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try { const response = await statisticsService.getHourlyParkingStats(); const hourlyData = response?.hourly || response?.data?.hourly || response?.data?.data?.hourly || []; if (Array.isArray(hourlyData)) setHourlyParkingData(hourlyData); }
    catch (error) { console.error(error); } finally { setAnalyticsLoading(false); }
  }, []);

  const scheduleReload = useCallback(() => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); debounceTimerRef.current = setTimeout(() => loadData(), RELOAD_DEBOUNCE_DELAY); }, [loadData]);
  const showNotification = useCallback((message: string) => { setRealtimeNotification(message); if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current); notificationTimerRef.current = setTimeout(() => setRealtimeNotification(null), NOTIFICATION_DURATION); }, []);

  const handleRefresh = useCallback(() => { loadData(); fetchHourlyAnalytics(); }, [loadData, fetchHourlyAnalytics]);

  const colorClasses = useMemo(() => ({ blue: { bg: 'cok-bg-primary', text: 'text-[#056daa]', light: 'bg-[rgba(5,109,170,0.1)]' }, green: { bg: 'bg-[#4CAF50]', text: 'text-[#388E3C]', light: 'bg-[rgba(76,175,80,0.12)]' }, purple: { bg: 'bg-[#2980B9]', text: 'text-[#2980B9]', light: 'bg-[rgba(41,128,185,0.1)]' }, orange: { bg: 'bg-[#F39C12]', text: 'text-[#F39C12]', light: 'bg-[rgba(243,156,18,0.12)]' }, red: { bg: 'bg-[#E74C3C]', text: 'text-[#E74C3C]', light: 'bg-[rgba(231,76,60,0.12)]' }, indigo: { bg: 'bg-[#2980B9]', text: 'text-[#2980B9]', light: 'bg-[rgba(41,128,185,0.1)]' } }), []);
  const quickActions = useMemo(() => [
    { title: 'Manage Departments', description: 'Add, edit, or remove departments', icon: HiOutlineOfficeBuilding, color: 'blue', path: '/admin/departments' },
    { title: 'Employee Management', description: 'View and manage employee records', icon: FiUsers, color: 'green', path: '/admin/employees' },
    { title: 'Smart Parking', description: 'Monitor  parking system', icon: FiTruck, color: 'purple', path: '/system-admin/smart-parking' },
    { title: 'Service Delivery', description: 'Track visitor services', icon: FiGrid, color: 'orange', path: '/system-admin/service-delivery/analytics' },
  ], []);
  const statCards = useMemo(() => [
    { label: 'Total Departments', value: stats.departments, icon: HiOutlineOfficeBuilding, color: 'blue', subtext: stats.departments > 0 ? `${stats.units} total units` : 'No departments', trend: stats.departments > 0 ? `${stats.departments} departments, ${stats.units} units` : 'No data', path: '/admin/departments' },
    { label: 'Total Employees', value: stats.employees, icon: FiUsers, color: 'green', subtext: stats.employees > 0 ? 'Registered staff' : 'No employees', trend: stats.employees > 0 ? `${stats.employees} registered` : 'No data', path: '/admin/employees' },
    { label: 'Active Visitors', value: stats.activeVisitors, icon: FiActivity, color: 'orange', subtext: stats.activeVisitors > 0 ? 'Currently inside' : 'No active visitors', trend: stats.flaggedVehicles > 0 ? `${stats.flaggedVehicles} flagged` : 'All clear', path: '' },
    { label: "Today's Check-ins", value: stats.parkingRecords, icon: FiTruck, color: 'purple', subtext: stats.parkingRecords > 0 ? 'Check-ins recorded' : 'No records', trend: stats.activeVisitors > 0 ? `${stats.activeVisitors} inside` : 'No data', path: '/admin/smart-parking' },
  ], [stats]);

  useEffect(() => { const handleOnline = () => { setIsOffline(false); loadData(); }; const handleOffline = () => setIsOffline(true); window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline); return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); }; }, [loadData]);
  useEffect(() => { if (!authLoading) { if (!isAuthenticated) navigate('/login'); else { loadData(); fetchHourlyAnalytics(); } } return () => { if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current); }; }, [isAuthenticated, authLoading, navigate, loadData, fetchHourlyAnalytics]);
  useEffect(() => { if (!isAuthenticated || authLoading) return; const interval = setInterval(() => loadData(true), SILENT_REFRESH_INTERVAL); return () => clearInterval(interval); }, [isAuthenticated, authLoading, loadData]);
  useEffect(() => { setSocketConnected(isConnected); if (socket && isConnected) { const events = ['car_checkedin', 'car_checkedout', 'visitor_checkedin', 'visitor_checkedout', 'notifications']; events.forEach(event => { socket.on(event, (data: any) => { showNotification(data.message || `${event.replace('_', ' ')} detected`); scheduleReload(); }); }); } return () => { if (socket) { ['car_checkedin', 'car_checkedout', 'visitor_checkedin', 'visitor_checkedout', 'notifications'].forEach(event => socket.off(event)); } if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current); }; }, [socket, isConnected, showNotification, scheduleReload]);

  if (authLoading) return <div className="flex items-center justify-center min-h-[600px]"><LoadingSpinner message="Loading..." /></div>;

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
             </div>
          <button onClick={handleRefresh} disabled={loading} className="flex cursor-pointer items-center gap-2 px-3 py-2 bg-white border border-[#056daa] text-[#056daa] hover:bg-[rgba(5,109,170,0.06)] text-sm font-medium transition-all disabled:opacity-50"><FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
        </div>

        {error && <div className="bg-[rgba(231,76,60,0.08)] border border-[#E0E0E0] text-[#E74C3C] px-4 py-3 flex items-center justify-between"><div className="flex items-center gap-2"><FiAlertTriangle className="w-5 h-5 flex-shrink-0" /><span className="text-sm">{error}</span></div><button onClick={handleRefresh} className="text-xs cursor-pointer px-3 py-1 bg-[rgba(231,76,60,0.12)] hover:bg-[rgba(231,76,60,0.2)] text-[#E74C3C] font-medium">Retry</button></div>}
       
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{statCards.map((stat, index) => <StatCard key={index} stat={stat} onClick={() => stat.path && navigate(stat.path)} colorClasses={colorClasses} loading={loading && firstLoad} />)}</div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
                <div className="px-4 py-3 border-b border-[#E0E0E0] bg-[#F7F9FB]">
                  <div className="flex items-center gap-2"><FiTruck className="w-4 h-4 text-[#2980B9]" /><h2 className="text-sm font-semibold text-[#333333]">Recent Parking</h2></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="cok-bg-primary text-white"><tr><th className="px-3 py-2 text-left text-xs font-semibold  uppercase">Vehicle</th><th className="px-3 py-2 text-left text-xs font-semibold  uppercase">Status</th><th className="px-3 py-2 text-left text-xs font-semibold  uppercase">Time</th></tr></thead>
                    <tbody className="divide-y divide-[#E0E0E0]">
                      {(loadingStates.parking && firstLoad) ? <LoadingInline message="Loading parking..." />
                        : recentParking.length > 0 ? recentParking.slice(0, 5).map((r: any) => (
                            <tr key={r._id} className="hover:bg-[#F7F9FB] transition-colors cursor-pointer" onClick={() => navigate('/smart_parking/dashboard')}>
                              <td className="px-3 py-2.5"><div className="flex items-center gap-2"><div className="w-7 h-7 bg-[rgba(41,128,185,0.1)] flex items-center justify-center"><FiTruck className="w-3.5 h-3.5 text-[#2980B9]" /></div><span className="text-sm font-medium text-[#333333]">{r.vehicle || r.plateNumber || r.plate_number || r.driver_name || '___'}</span></div></td>
                              <td className="px-3 py-2.5"><span className={`text-xs font-semibold px-2 py-0.5 ${r.status === 'active' || r.status === 'Parked' ? 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]' : 'bg-[rgba(51,51,51,0.08)] text-[#555555]'}`}>{r.status === 'active' ? 'Parked' : r.status === 'completed' ? 'Completed' : r.status || 'Unknown'}</span></td>
                              <td className="px-3 py-2.5 text-xs text-[#555555]">{r.checkInTime || r.check_in ? new Date(r.checkInTime || r.check_in as string).toLocaleTimeString() : '___'}</td>
                            </tr>
                          )) : <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-[#555555]"><FiTruck className="w-6 h-6 mx-auto mb-1 text-[#9E9E9E]" /><p>No parking records</p></td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
                <div className="px-4 py-3 border-b border-[#E0E0E0] bg-[#F7F9FB]">
                  <div className="flex items-center gap-2"><FiUsers className="w-4 h-4 text-[#388E3C]" /><h2 className="text-sm font-semibold text-[#333333]">Recent Visitors</h2></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="cok-bg-primary text-white"><tr><th className="px-3 py-2 text-left text-xs font-semibold uppercase">Name</th><th className="px-3 py-2 text-left text-xs font-semibold uppercase">Status</th><th className="px-3 py-2 text-left text-xs font-semibold  uppercase">Department</th></tr></thead>
                    <tbody className="divide-y divide-[#E0E0E0]">
                      {(loadingStates.visitors && firstLoad) ? <LoadingInline message="Loading visitors..." />
                        : recentVisitors.length > 0 ? recentVisitors.slice(0, 5).map((v: any) => (
                            <tr key={v._id} className="hover:bg-[#F7F9FB] transition-colors" onClick={() => navigate('/service_delivery/dashboard')}>
                              <td className="px-3 py-2.5"><div className="flex items-center gap-2"><div className="w-7 h-7 bg-[rgba(76,175,80,0.12)] flex items-center justify-center"><FiUsers className="w-3.5 h-3.5 text-[#388E3C]" /></div><span className="text-sm font-medium text-[#333333]">{v.full_name || v.name || v.visitorName || '___'}</span></div></td>
                              <td className="px-3 py-2.5"><span className={`text-xs font-semibold px-2 py-0.5 ${v.is_still_inhouse ? 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]' : 'bg-[rgba(51,51,51,0.08)] text-[#555555]'}`}>{v.is_still_inhouse ? 'Inside' : 'Left'}</span></td>
                              <td className="px-3 py-2.5 text-xs text-[#555555]">{v.department_name || (v.departments_assigned?.[0]?.department_name) || '___'}</td>
                            </tr>
                          )) : <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-[#555555]"><FiUsers className="w-6 h-6 mx-auto mb-1 text-[#9E9E9E]" /><p>No visitors</p></td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            {hourlyParkingData.length > 0 && <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}><h2 className="text-sm font-semibold text-[#333333] mb-3">Parking Activity (Hourly)</h2><div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={hourlyParkingData} margin={{ top: 15, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} /><XAxis dataKey="hour" tickFormatter={(v: number) => `${v}:00`} tick={{ fontSize: 11, fill: GRAY_DISABLED }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: GRAY_DISABLED }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0, boxShadow: CARD_SHADOW }} /><Legend wrapperStyle={{ fontSize: '11px' }} /><Area type="monotone" dataKey="check_in" stroke={PRIMARY} fill="rgba(5,109,170,0.1)" name="Check-ins" dot={{ r: 3 }} label={{ position: 'top', fill: NEUTRAL_DARK, fontSize: 10, fontWeight: 600 }} /><Area type="monotone" dataKey="check_out" stroke={DANGER} fill="rgba(231,76,60,0.1)" name="Check-outs" dot={{ r: 3 }} label={{ position: 'top', fill: NEUTRAL_DARK, fontSize: 10, fontWeight: 600 }} /></AreaChart></ResponsiveContainer></div></div>}
          </div>

          <div className="space-y-4">
            <ActivityFeed auditLogs={auditLogs} />
            <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}><h2 className="text-sm font-semibold text-[#333333] mb-3">Quick Actions</h2><div className="grid grid-cols-1 gap-2">{quickActions.map((action, i) => { const Icon = action.icon; const colors = colorClasses[action.color] || colorClasses.blue; return (<button key={i} onClick={() => navigate(action.path)} className="flex items-center gap-3 p-2.5 hover:bg-[#F7F9FB] transition-colors text-left"><div className={`w-8 h-8 ${colors.light} flex items-center justify-center flex-shrink-0`}><Icon className={`w-4 h-4 ${colors.text}`} /></div><div className="flex-1 min-w-0"><p className="text-sm font-medium text-[#333333] truncate">{action.title}</p><p className="text-xs text-[#555555] truncate">{action.description}</p></div></button>); })}</div></div>
          </div>
        </div>

      </div>
    </MainLayout>
  );
};

export default AdminDashboard;