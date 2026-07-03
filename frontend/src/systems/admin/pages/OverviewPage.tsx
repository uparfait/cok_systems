import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { statisticsService, employeeService, parkingService, serviceDeliveryService, feedbackService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import OverviewCharts from './sub/OverviewCharts';
import OverviewModal from './sub/OverviewModal';

export interface DashboardData {
  employeeStats: { total: number; active: number; inactive: number; locked: number };
  parkingStats: { total: number; by_driver_type: { staff: number; visitor: number; regular: number } };
  serviceStats: { total: number; completed: number; inhouse: number; by_department: Record<string, number> };
  flaggedVehicles: { currently_flagged: { count: number; min_minutes: number; max_minutes: number }; history: { count: number; min_minutes: number; max_minutes: number } };
  emergencyCars: { total: number; active: number; expired: number; active_vehicles_count: number; history_vehicles_count: number };
  feedbackTotals: { total: number; by_department: Record<string, number> };
  feedbackAvg: { overall_average: { average_rating: number }; by_department: Record<string, { average_rating: number }> };
  hourlyParking: { hour: number; check_in: number; check_out: number }[];
  hourlyService: { hour: number; visitors_checked_in: number }[];
  departments: Array<{ name: string; leader: string; staff: number; rating: number; feedback: number }>;
  employeePerformanceTasksDone: Array<{ employee_name: string; total_tasks: number; avg_expected_time: string; avg_actual_time: string; rating: string }>;
  waitingTimeAnalytics: Array<{ department_name: string; avg_wait_time: string; max_wait_time: string; min_wait_time: string; status: string; total_cases: number }>;
  employeePerformanceService: Array<{ employee_name: string; citizens_served: number; avg_service_time: string; rating: string }>;
}

const Overview: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [modalData, setModalData] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalPagination, setModalPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [employeesRes, parkingRes, servicesRes, flaggedStatsRes, emergencyRes, feedbackTotalsRes, feedbackAvgRes, hourlyParkingRes, hourlyServiceRes, departmentsRes, flaggedCountRes, tasksDoneRes, waitingRes, servicePerfRes] = await Promise.all([
        statisticsService.getEmployeeStats(), statisticsService.getCurrentlyParkedStats(), statisticsService.getServiceDeliveryStats(),
        statisticsService.getFlaggedVehiclesStats(), statisticsService.getEmergencyCarsStats(), statisticsService.getFeedbackTotals(),
        statisticsService.getFeedbackAverageByDepartment(), statisticsService.getHourlyParkingStats(), statisticsService.getHourlyServiceDeliveryStats(),
        statisticsService.getDepartmentsWithLeaders(), parkingService.getFlaggedActiveVehicles(1, 1000),
        statisticsService.getEmployeePerformanceByTasksDone(), statisticsService.getWaitingTimeAnalytics(), statisticsService.getEmployeePerformanceByService()
      ]);
      const employees: any = (employeesRes as any)?.data || employeesRes;
      const parking: any = (parkingRes as any)?.data || parkingRes;
      const services: any = (servicesRes as any)?.data || servicesRes;
      const flaggedStats: any = (flaggedStatsRes as any)?.data || flaggedStatsRes;
      const emergency: any = (emergencyRes as any)?.data || emergencyRes;
      const feedbackTotals: any = (feedbackTotalsRes as any)?.data || feedbackTotalsRes;
      const feedbackAvg: any = (feedbackAvgRes as any)?.data || feedbackAvgRes;
      const departmentsRaw: any = (departmentsRes as any)?.data?.departments || (departmentsRes as any)?.departments || [];
      const hourlyParkingRaw: any = (hourlyParkingRes as any)?.data?.hourly || (hourlyParkingRes as any) || [];
      const hourlyServiceRaw: any = (hourlyServiceRes as any)?.data?.hourly || (hourlyServiceRes as any) || [];
      const tasksDone: any = (tasksDoneRes as any)?.data || tasksDoneRes;
      const waiting: any = (waitingRes as any)?.data || waitingRes;
      const servicePerf: any = (servicePerfRes as any)?.data || servicePerfRes;

      const departments = departmentsRaw.map((d: any) => ({
        name: d.department_name, leader: d.department_leader?.full_name || 'Not assigned', staff: d.total_employees,
        rating: Number((feedbackAvg?.by_department?.[d.department_name]?.average_rating || 0)), feedback: feedbackTotals?.by_department?.[d.department_name] || 0
      }));

      setData({
        employeeStats: { total: employees?.total || 0, active: employees?.active || 0, inactive: employees?.inactive || 0, locked: employees?.locked || 0 },
        parkingStats: { total: parking?.total || 0, by_driver_type: { staff: Number(parking?.by_driver_type?.staff || 0), visitor: Number(parking?.by_driver_type?.visitor || 0), regular: Number(parking?.by_driver_type?.Regular || 0) } },
        serviceStats: { total: services?.total || 0, completed: services?.completed || 0, inhouse: services?.inhouse || 0, by_department: services?.by_department || {} },
        flaggedVehicles: { currently_flagged: { count: (flaggedCountRes as any)?.total || 0, min_minutes: flaggedStats?.currently_flagged?.min_minutes || 0, max_minutes: flaggedStats?.currently_flagged?.max_minutes || 0 }, history: flaggedStats?.history || { count: 0, min_minutes: 0, max_minutes: 0 } },
        emergencyCars: { total: emergency?.total || 0, active: emergency?.active || 0, expired: emergency?.expired || 0, active_vehicles_count: emergency?.active_vehicles_count || 0, history_vehicles_count: emergency?.history_vehicles_count || 0 },
        feedbackTotals: { total: feedbackTotals?.total || 0, by_department: feedbackTotals?.by_department || {} },
        feedbackAvg: { overall_average: feedbackAvg?.overall_average || { average_rating: 0 }, by_department: feedbackAvg?.by_department || {} },
        hourlyParking: Array.isArray(hourlyParkingRaw) ? hourlyParkingRaw : [],
        hourlyService: Array.isArray(hourlyServiceRaw) ? hourlyServiceRaw : [],
        departments, employeePerformanceTasksDone: tasksDone, waitingTimeAnalytics: waiting, employeePerformanceService: servicePerf
      });
    } catch (error) { console.error('Error:', error); showError('Failed to load dashboard data'); }
    finally { setLoading(false); }
  }, [showError]);

  const fetchModalData = useCallback(async (cardType: string, page = 1, limit = 10) => {
    setModalLoading(true);
    try {
      let response: any;
      switch (cardType) {
        case 'employees': response = await employeeService.getAll(page, limit); break;
        case 'parking': response = await parkingService.getAllPaginated(page, limit, 'active'); break;
        case 'services': response = await serviceDeliveryService.getAll(page, limit); break;
        case 'flagged': response = await parkingService.getFlaggedActiveVehicles(page, limit); break;
        case 'feedback': response = await feedbackService.getAll(page, limit); break;
        case 'employee-performance-tasks-done': response = await statisticsService.getEmployeePerformanceByTasksDone(); break;
        case 'waiting-time-analytics': response = await statisticsService.getWaitingTimeAnalytics(); break;
        case 'employee-performance-service': response = await statisticsService.getEmployeePerformanceByService(); break;
        case 'services-detail':
          response = await statisticsService.getServiceDeliveryStats();
          if (response?.success && response.data) { setModalData(Object.entries(response.data.by_department || {}).map(([dept, count]) => ({ department: dept, count }))); setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit }); setModalLoading(false); return; }
          break;
        case 'employees-detail':
          response = await statisticsService.getDepartmentsWithLeaders();
          if (response?.success && response.data?.departments) { setModalData(response.data.departments); setModalPagination({ currentPage: 1, totalPages: 1, totalItems: response.data.departments.length, limit }); setModalLoading(false); return; }
          break;
        case 'service-hourly':
          response = await statisticsService.getHourlyServiceDeliveryStats();
          if ((response as any)?.success && (response as any)?.data) { setModalData((response as any).data.hourly || []); setModalPagination({ currentPage: 1, totalPages: 1, totalItems: ((response as any).data.hourly || []).length, limit }); setModalLoading(false); return; }
          break;
        default: break;
      }
      if (response?.success && response.data) {
        const respData = response.data;
        setModalData(respData);
        setModalPagination({ currentPage: response.page || page, totalPages: Math.ceil((response.total || respData.length) / limit), totalItems: response.total || respData.length, limit });
      } else { setModalData([]); setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit }); }
    } catch (error) { setModalData([]); }
    finally { setModalLoading(false); }
  }, []);

  const handleCardClick = (cardType: string) => { setSelectedCard(cardType); fetchModalData(cardType); };

  useEffect(() => { if (!authLoading && !isAuthenticated) navigate('/login'); }, [isAuthenticated, authLoading, navigate]);
  useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated, fetchData]);

  if (loading || !data) return <MainLayout><div className="flex justify-center items-center h-96"><LoadingSpinner /></div></MainLayout>;

  const activeRate = data.employeeStats.total ? Number((data.employeeStats.active / data.employeeStats.total) * 100) : 0;
  const completionRate = data.serviceStats.total ? Number((data.serviceStats.completed / data.serviceStats.total) * 100) : 0;
  const avgRating = Number(data.feedbackAvg.overall_average.average_rating);
  const driverTotal = data.parkingStats.by_driver_type.staff + data.parkingStats.by_driver_type.visitor + data.parkingStats.by_driver_type.regular;

  const getStatusColor = (s: string) => s === 'Critical' ? 'bg-red-100 text-red-800' : s === 'Moderate' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
  const getPerfRatingColor = (r: string) => r === 'Excellent' ? 'text-emerald-600' : r === 'Good' ? 'text-blue-600' : r === 'Slow' ? 'text-yellow-600' : 'text-red-600';

  const statsCards = [
    { label: 'Employees', value: data.employeeStats.total, sub: `${data.employeeStats.active} active (${activeRate.toFixed(0)}%)`, icon: '👥', color: 'blue', modalKey: 'employees', key: 'employees' },
    { label: 'Parking', value: data.parkingStats.total, sub: `${driverTotal} by driver type`, icon: '🚗', color: 'green', modalKey: 'parking', key: 'parking' },
    { label: 'Services', value: data.serviceStats.total, sub: `${data.serviceStats.inhouse} in-house`, icon: '📋', color: 'purple', modalKey: 'services', key: 'services' },
    { label: 'Flagged', value: data.flaggedVehicles.currently_flagged.count, sub: `${data.flaggedVehicles.history.count} in history`, icon: '🚩', color: 'orange', modalKey: 'flagged', key: 'flagged' },
    { label: 'Feedback', value: data.feedbackTotals.total, sub: `Rating: ${avgRating.toFixed(1)}/5`, icon: '⭐', color: 'yellow', modalKey: 'feedback', key: 'feedback' },
  ];

  return (
    <MainLayout>
      <div className="p-4">
        <OverviewCharts data={data} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
          {statsCards.map(s => (
            <div key={s.key} onClick={() => handleCardClick(s.modalKey)} className="bg-white border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{s.label}</span>
                <span className="text-lg">{s.icon}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{s.value}</div>
              <div className="text-xs text-gray-500">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Service Completion', value: `${completionRate.toFixed(0)}%`, color: 'text-blue-600', desc: `${data.serviceStats.completed} of ${data.serviceStats.total} completed` },
            { label: 'Avg Rating', value: avgRating.toFixed(1), color: 'text-yellow-600', desc: `${data.feedbackTotals.total} reviews` },
            { label: 'Emergency Cars', value: data.emergencyCars.total, color: 'text-red-600', desc: `${data.emergencyCars.active} active, ${data.emergencyCars.expired} expired` },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 p-4">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">{s.label}</div>
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.desc}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Employee Performance (Tasks Done)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50">{['Employee', 'Tasks', 'Expected', 'Actual', 'Rating'].map(h => <th key={h} className="p-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {(data.employeePerformanceTasksDone || []).slice(0, 5).map((t, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="p-2 font-medium text-gray-900">{t.employee_name}</td>
                      <td className="p-2 text-gray-600">{t.total_tasks}</td>
                      <td className="p-2 text-gray-600">{t.avg_expected_time}</td>
                      <td className="p-2 text-gray-600">{t.avg_actual_time}</td>
                      <td className={`p-2 font-medium ${getPerfRatingColor(t.rating)}`}>{t.rating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data.employeePerformanceTasksDone || []).length > 5 && (
                <button onClick={() => handleCardClick('employee-performance-tasks-done')} className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">View All ({data.employeePerformanceTasksDone.length})</button>
              )}
            </div>
          </div>
          <div className="bg-white border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Employee Performance (Service)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50">{['Employee', 'Served', 'Avg Time', 'Rating'].map(h => <th key={h} className="p-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {(data.employeePerformanceService || []).slice(0, 5).map((e, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="p-2 font-medium text-gray-900">{e.employee_name}</td>
                      <td className="p-2 text-gray-600">{e.citizens_served}</td>
                      <td className="p-2 text-gray-600">{e.avg_service_time}</td>
                      <td className={`p-2 font-medium ${getPerfRatingColor(e.rating)}`}>{e.rating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data.employeePerformanceService || []).length > 5 && (
                <button onClick={() => handleCardClick('employee-performance-service')} className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">View All ({data.employeePerformanceService.length})</button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4 mb-6">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Waiting Time Analytics</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50">{['Department', 'Avg Wait', 'Max Wait', 'Min Wait', 'Cases', 'Status'].map(h => <th key={h} className="p-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {(data.waitingTimeAnalytics || []).slice(0, 5).map((w, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="p-2 font-medium text-gray-900">{w.department_name}</td>
                    <td className="p-2 text-gray-600">{w.avg_wait_time}</td>
                    <td className="p-2 text-gray-600">{w.max_wait_time}</td>
                    <td className="p-2 text-gray-600">{w.min_wait_time}</td>
                    <td className="p-2 text-gray-600">{w.total_cases}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 ${getStatusColor(w.status)}`}>{w.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data.waitingTimeAnalytics || []).length > 5 && (
              <button onClick={() => handleCardClick('waiting-time-analytics')} className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">View All ({data.waitingTimeAnalytics.length})</button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.departments.slice(0, 6).map((d, i) => (
            <div key={i} className="bg-white border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">{d.name}</span>
                <span className="text-xs text-gray-500">{d.staff} staff</span>
              </div>
              <div className="text-xs text-gray-600 mb-2">Leader: {d.leader}</div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-yellow-600 font-medium">Rating: {d.rating.toFixed(1)}</span>
                <span className="text-gray-500">Feedback: {d.feedback}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {['chart-hourly', 'chart-services', 'chart-employees', 'chart-donut', 'chart-feedback', 'chart-service-hourly', 'chart-status'].map((id, i) => (
            <div key={id} className="bg-white border border-gray-200 p-4">
              <div className="h-48"><canvas id={id}></canvas></div>
            </div>
          ))}
        </div>

        {selectedCard && (
          <OverviewModal
            title={`${selectedCard.replace(/-/g, ' ')} Details`}
            data={modalData}
            loading={modalLoading}
            pagination={modalPagination}
            onClose={() => setSelectedCard(null)}
            onPageChange={(page) => fetchModalData(selectedCard, page)}
            renderContent={() => (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    {modalData.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {Object.entries(item).slice(0, 5).map(([key, val]: [string, any]) => (
                          <td key={key} className="p-2 text-gray-700">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default Overview;