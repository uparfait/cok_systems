import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { statisticsService, employeeService, parkingService, serviceDeliveryService, feedbackService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import Chart from 'chart.js/auto';

// ==================== TYPES ====================

interface DashboardData {
  employeeStats: { total: number; active: number; inactive: number; locked: number };
  parkingStats: { total: number; by_driver_type: { staff: number; visitor: number; regular: number } };
  serviceStats: { total: number; completed: number; inhouse: number; by_department: Record<string, number> };
  flaggedVehicles: { 
    currently_flagged: { count: number; min_minutes: number; max_minutes: number }; 
    history: { count: number; min_minutes: number; max_minutes: number } 
  };
  emergencyCars: { total: number; active: number; expired: number; active_vehicles_count: number; history_vehicles_count: number };
  feedbackTotals: { total: number; by_department: Record<string, number> };
  feedbackAvg: { overall_average: { average_rating: number }; by_department: Record<string, { average_rating: number }> };
  hourlyParking: { hour: number; check_in: number; check_out: number }[];
  hourlyService: { hour: number; visitors_checked_in: number }[];
  departments: Array<{ name: string; leader: string; staff: number; rating: number; feedback: number }>;
  // New data structures for requested features
  employeePerformanceTasksDone: Array<{ employee_name: string; total_tasks: number; avg_expected_time: string; avg_actual_time: string; rating: string }>;
  waitingTimeAnalytics: Array<{ department_name: string; avg_wait_time: string; max_wait_time: string; min_wait_time: string; status: string; total_cases: number }>;
  employeePerformanceService: Array<{ employee_name: string; citizens_served: number; avg_service_time: string; rating: string }>;
}

// ==================== CONSTANTS ====================

const HOURS = ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
const SERVICE_HOURS = ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'];

// Helper function to format hour labels with AM/PM
const formatHourLabel = (hour: number): string => {
  const hourNum = parseInt(hour.toString());
  if (hourNum === 0) return '12 AM';
  if (hourNum < 12) return `${hourNum} AM`;
  if (hourNum === 12) return '12 PM';
  return `${hourNum - 12} PM`;
};

// Helper to get chart config with dynamic Y-axis ticks
const getChartConfig = (maxValue: number, minValue: number = 0) => {
  // Calculate dynamic step size using "nice numbers" algorithm
  const range = maxValue - minValue;
  const targetSteps = 5; // Aim for about 5-7 ticks on Y-axis

  // Calculate rough step size
  const roughStep = range / targetSteps;

  // Find the magnitude (power of 10)
  const magnitude = Math.floor(Math.log10(roughStep));
  const magnitudePow = Math.pow(10, magnitude);

  // Normalize to get first digit
  const normalizedStep = roughStep / magnitudePow;

  // Choose nice step from {1, 2, 5, 10}
  let niceStep;
  if (normalizedStep < 1.5) {
    niceStep = 1;
  } else if (normalizedStep < 3.5) {
    niceStep = 2;
  } else if (normalizedStep < 7.5) {
    niceStep = 5;
  } else {
    niceStep = 10;
  }

  // Calculate final step size
  const stepSize = niceStep * magnitudePow;

  // Calculate nice min/max values
  const niceMin = Math.floor(minValue / stepSize) * stepSize;
  const niceMax = Math.ceil(maxValue / stepSize) * stepSize;
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = Number(context.raw);
            return `${context.dataset.label}: ${value}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        min: niceMin,
        max: niceMax,
        grid: { color: '#e5e7eb' },
        ticks: {
          stepSize: stepSize,
          callback: (value: any) => Number(Number(value)).toString(),
          precision: 0  // Force no decimal places
        },
        title: {
          display: true,
          text: 'count',
          color: '#9ca3af',
          font: { size: 10 }
        }
      }, 
      x: { 
        grid: { display: false },
        ticks: { font: { size: 10 } }
      }
    }
  };
};

// ==================== MAIN COMPONENT ====================

const Overview: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showAllDepartments, setShowAllDepartments] = useState(false);
  const [showAllRatings, setShowAllRatings] = useState(false);
  
  // Employee Performance pagination states
  const [showAllTasksDone, setShowAllTasksDone] = useState(false);
  const [showAllWaitingTime, setShowAllWaitingTime] = useState(false);
  const [showAllServicePerf, setShowAllServicePerf] = useState(false);
  
  const [departmentPage, setDepartmentPage] = useState(1);
  const [tasksDonePage, setTasksDonePage] = useState(1);
  const [waitingTimePage, setWaitingTimePage] = useState(1);
  const [servicePerfPage, setServicePerfPage] = useState(1);
  
  const departmentLimit = 5;
  const performanceLimit = 5;

  // Pagination states for modals
  const [modalData, setModalData] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalPagination, setModalPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 10
  });
  
  const chartsRef = useRef<Map<string, Chart>>(new Map());
  
   // Fetch real data
   const fetchData = useCallback(async () => {
     setLoading(true);
     try {
       const [
         employeesRes, parkingRes, servicesRes, flaggedStatsRes, emergencyRes,
         feedbackTotalsRes, feedbackAvgRes, hourlyParkingRes, hourlyServiceRes, departmentsRes,
         flaggedCountRes, employeePerfTasksDoneRes, waitingTimeAnalyticsRes, employeePerfServiceRes
       ] = await Promise.all([
         statisticsService.getEmployeeStats(),
         statisticsService.getCurrentlyParkedStats(),
         statisticsService.getServiceDeliveryStats(),
         statisticsService.getFlaggedVehiclesStats(),
         statisticsService.getEmergencyCarsStats(),
         statisticsService.getFeedbackTotals(),
         statisticsService.getFeedbackAverageByDepartment(),
         statisticsService.getHourlyParkingStats(),
         statisticsService.getHourlyServiceDeliveryStats(),
         statisticsService.getDepartmentsWithLeaders(),
         parkingService.getFlaggedActiveVehicles(1, 1000), // Get count for KPI
         statisticsService.getEmployeePerformanceByTasksDone(),
         statisticsService.getWaitingTimeAnalytics(),
         statisticsService.getEmployeePerformanceByService()
       ]);
       
       const employees = (employeesRes as any)?.data || employeesRes;
       const parking = (parkingRes as any)?.data || parkingRes;
       const services = (servicesRes as any)?.data || servicesRes;
       const flaggedStats = (flaggedStatsRes as any)?.data || flaggedStatsRes;
       const emergency = (emergencyRes as any)?.data || emergencyRes;
       const feedbackTotals = (feedbackTotalsRes as any)?.data || feedbackTotalsRes;
       const flaggedCount = flaggedCountRes;
       const feedbackAvg = (feedbackAvgRes as any)?.data || feedbackAvgRes;
       const employeePerfTasksDone = (employeePerfTasksDoneRes as any)?.data || employeePerfTasksDoneRes;
       const waitingTimeAnalytics = (waitingTimeAnalyticsRes as any)?.data || waitingTimeAnalyticsRes;
       const employeePerfService = (employeePerfServiceRes as any)?.data || employeePerfServiceRes;
       const hourlyParkingRaw = (hourlyParkingRes as any)?.data?.hourly || (hourlyParkingRes as any) || [];
       const hourlyServiceRaw = (hourlyServiceRes as any)?.data?.hourly || (hourlyServiceRes as any) || [];
       const departmentsRaw = (departmentsRes as any)?.data?.departments || (departmentsRes as any)?.departments || [];
       
       const departments = departmentsRaw.map((dept: any) => ({
         name: dept.department_name,
         leader: dept.department_leader?.full_name || 'Not assigned',
         staff: dept.total_employees,
         rating: Number((feedbackAvg?.by_department?.[dept.department_name]?.average_rating || 0)),
         feedback: feedbackTotals?.by_department?.[dept.department_name] || 0,
       }));
       
       setData({
         employeeStats: {
           total: employees?.total || 0,
           active: employees?.active || 0,
           inactive: employees?.inactive || 0,
           locked: employees?.locked || 0,
         },
         parkingStats: {
           total: parking?.total || 0,
           by_driver_type: {
             staff: Number(parking?.by_driver_type?.staff || parking?.by_driver_type?.Staff || 0),
             visitor: Number(parking?.by_driver_type?.visitor || parking?.by_driver_type?.Visitor || parking?.by_driver_type?.regular || 0),
             regular: Number(parking?.by_driver_type?.Regular || 0),
           },
         },
         serviceStats: {
           total: services?.total || 0,
           completed: services?.completed || 0,
           inhouse: services?.inhouse || 0,
           by_department: services?.by_department || {},
         },
         flaggedVehicles: {
           currently_flagged: {
             count: flaggedCount?.total || 0,
             min_minutes: flaggedStats?.currently_flagged?.min_minutes || 0,
             max_minutes: flaggedStats?.currently_flagged?.max_minutes || 0
           },
           history: flaggedStats?.history || { count: 0, min_minutes: 0, max_minutes: 0 }
         },
         emergencyCars: {
           total: emergency?.total || 0,
           active: emergency?.active || 0,
           expired: emergency?.expired || 0,
           active_vehicles_count: emergency?.active_vehicles_count || 0,
           history_vehicles_count: emergency?.history_vehicles_count || 0,
         },
         feedbackTotals: {
           total: feedbackTotals?.total || 0,
           by_department: feedbackTotals?.by_department || {},
         },
         feedbackAvg: {
           overall_average: feedbackAvg?.overall_average || { average_rating: 0 },
           by_department: feedbackAvg?.by_department || {},
         },
         hourlyParking: Array.isArray(hourlyParkingRaw) ? hourlyParkingRaw : [],
         hourlyService: Array.isArray(hourlyServiceRaw) ? hourlyServiceRaw : [],
         departments,
         // New data fields
         employeePerformanceTasksDone: employeePerfTasksDone,
         waitingTimeAnalytics: waitingTimeAnalytics,
         employeePerformanceService: employeePerfService
       });
       
       setLastRefresh(new Date());
     } catch (error) {
       console.error('Error fetching data:', error);
       showError('Failed to load dashboard data');
     } finally {
       setLoading(false);
     }
   }, [showError]);
  
  // Create all charts with whole number Y-axis
  const createCharts = useCallback(() => {
    if (!data) return;
    
    // Destroy existing charts
    chartsRef.current.forEach(chart => chart.destroy());
    chartsRef.current.clear();
    
    const deptNames = data.departments.map(d => d.name);
    const checkInData = data.hourlyParking.map(h => h.check_in);
    const checkOutData = data.hourlyParking.map(h => h.check_out);
    const visitorData = data.hourlyService.map(h => h.visitors_checked_in);
    const maxParking = Math.max(...checkInData, ...checkOutData, 1);
    const maxVisitor = Math.max(...visitorData, 1);
    
    // 1. Hourly Parking Chart (Line chart with whole numbers)
    const hourlyCanvas = document.getElementById('chart-hourly') as HTMLCanvasElement;
    if (hourlyCanvas) {
      const formattedHourLabels = HOURS.map(hour => formatHourLabel(parseInt(hour)));
      chartsRef.current.set('hourly', new Chart(hourlyCanvas, {
        type: 'line',
        data: {
          labels: formattedHourLabels,
          datasets: [
            { 
              label: 'Check-in', 
              data: checkInData, 
              borderColor: '#0078d4', 
              backgroundColor: 'rgba(0,120,212,0.05)', 
              fill: true, 
              tension: 0.4, 
              pointRadius: 3, 
              borderWidth: 2,
              pointBackgroundColor: '#0078d4',
              pointBorderColor: '#fff',
              pointBorderWidth: 1
            },
            { 
              label: 'Check-out', 
              data: checkOutData, 
              borderColor: '#e8a400', 
              backgroundColor: 'rgba(232,164,0,0.05)', 
              fill: true, 
              tension: 0.4, 
              pointRadius: 3, 
              borderWidth: 2,
              borderDash: [5, 3],
              pointBackgroundColor: '#e8a400',
              pointBorderColor: '#fff',
              pointBorderWidth: 1
            }
          ]
        },
        options: getChartConfig(maxParking)
      }));
    }
    
    // 2. Services Chart (Bar chart)
    const svcCanvas = document.getElementById('chart-services') as HTMLCanvasElement;
    if (svcCanvas && deptNames.length) {
      const svcTotal = deptNames.map(name => data.serviceStats.by_department[name] || 0);
      // For now, show Total Visitors per department (we don't have inhouse vs completed breakdown)
      const svcData = svcTotal;
      const maxSvc = Math.max(...svcTotal, 1);
      
      chartsRef.current.set('services', new Chart(svcCanvas, {
        type: 'bar',
        data: {
          labels: deptNames,
          datasets: [
            { label: 'Total Visitors', data: svcData, backgroundColor: '#0078d4', barPercentage: 0.6, categoryPercentage: 0.8 }
          ]
        },
        options: {
          ...getChartConfig(maxSvc),
          indexAxis: 'y',
          scales: {
            x: {
              ...getChartConfig(maxSvc).scales.x,
              ticks: { callback: (value: any) => Number(Number(value)).toString(), stepSize: 1 }
            },
            y: { grid: { display: false } }
          }
        }
      }));
    }
    
    // 3. Employees Chart (Bar chart)
    const empCanvas = document.getElementById('chart-employees') as HTMLCanvasElement;
    if (empCanvas && deptNames.length) {
      const empData = data.departments.map(d => d.staff);
      const maxEmp = Math.max(...empData, 1);
      
      chartsRef.current.set('employees', new Chart(empCanvas, {
        type: 'bar',
        data: { 
          labels: deptNames, 
          datasets: [{ 
            data: empData, 
            backgroundColor: '#5c2d91', 
            barPercentage: 0.6,
            borderRadius: 0,
            label: 'Employees'
          }] 
        },
        options: {
          ...getChartConfig(maxEmp),
          indexAxis: 'y',
          scales: {
            x: {
              ...getChartConfig(maxEmp).scales.x,
              ticks: { callback: (value: any) => Number(Number(value)).toString(), stepSize: 1 }
            },
            y: { grid: { display: false } }
          }
        }
      }));
    }
    
    // 4. Donut Chart (No Y-axis needed)
    const donutCanvas = document.getElementById('chart-donut') as HTMLCanvasElement;
    if (donutCanvas) {
      const driverData = data.parkingStats.by_driver_type;
      chartsRef.current.set('donut', new Chart(donutCanvas, {
        type: 'doughnut',
        data: { 
          labels: ['Staff', 'Visitor', 'Regular'], 
          datasets: [{ 
            data: [driverData.staff, driverData.visitor, driverData.regular], 
            backgroundColor: ['#0078d4', '#00b294', '#e8a400'], 
            borderWidth: 0 
          }] 
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: any) => `${ctx.label}: ${Number(ctx.raw)}`
              }
            }
          }
        }
      }));
    }
    
    // 5. Feedback Chart (Bar chart)
    const fbCanvas = document.getElementById('chart-feedback') as HTMLCanvasElement;
    if (fbCanvas && deptNames.length) {
      const fbData = data.departments.map(d => d.feedback);
      const maxFb = Math.max(...fbData, 1);
      
      chartsRef.current.set('feedback', new Chart(fbCanvas, {
        type: 'bar',
        data: { 
          labels: deptNames?.map(name => name.length > 15 ? name.slice(0, 15) + '...' : name),
          datasets: [{ 
            data: fbData, 
            backgroundColor: '#5c2d91', 
            barPercentage: 0.6,
            label: 'Feedback'
          }] 
        },
        options: getChartConfig(maxFb)
      }));
    }
    
    // 6. Hourly Service Check-ins (Line chart)
    const svcHourCanvas = document.getElementById('chart-service-hourly') as HTMLCanvasElement;
    if (svcHourCanvas) {
      const formattedServiceHourLabels = SERVICE_HOURS.map(hour => formatHourLabel(parseInt(hour)));
      chartsRef.current.set('serviceHourly', new Chart(svcHourCanvas, {
        type: 'line',
        data: {
          labels: formattedServiceHourLabels, 
          datasets: [{ 
            data: visitorData, 
            borderColor: '#00b294', 
            backgroundColor: 'rgba(0,178,148,0.05)', 
            fill: true, 
            tension: 0.4, 
            pointRadius: 3, 
            borderWidth: 2,
            pointBackgroundColor: '#00b294',
            pointBorderColor: '#fff',
            pointBorderWidth: 1,
            label: 'Visitors'
          }] 
        },
        options: getChartConfig(maxVisitor)
      }));
    }
    
    // 7. Employee Status Chart (Donut)
    const statusCanvas = document.getElementById('chart-status') as HTMLCanvasElement;
    if (statusCanvas) {
      chartsRef.current.set('status', new Chart(statusCanvas, {
        type: 'doughnut',
        data: { 
          labels: ['Active', 'Inactive', 'Locked'], 
          datasets: [{ 
            data: [data.employeeStats.active, data.employeeStats.inactive, data.employeeStats.locked], 
            backgroundColor: ['#0078d4', '#e8a400', '#e81123'], 
            borderWidth: 0 
          }] 
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: any) => `${ctx.label}: ${Number(ctx.raw)}`
              }
            }
          }
        }
      }));
    }
  }, [data]);
  
  // Initial fetch and chart creation
  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, fetchData]);
  
  useEffect(() => {
    if (data && !loading) {
      const timer = setTimeout(createCharts, 100);
      return () => clearTimeout(timer);
    }
  }, [data, loading, createCharts]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => chartsRef.current.forEach(chart => chart.resize());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login');
  }, [isAuthenticated, authLoading, navigate]);
  
// Fetch paginated data for modals
   const fetchModalData = useCallback(async (cardType: string, page: number = 1, limit: number = 8) => {
     setModalLoading(true);
     try {
       let response: any;
       console.log(`Fetching ${cardType} data for page ${page}, limit ${limit}`);

       switch (cardType) {
         case 'employees':
           // For employees, get detailed list with pagination
           response = await employeeService.getAll(page, limit);
           console.log('Employee response:', response);
           if (response && response.success && response.data) {
             setModalData(response.data);
             setModalPagination({
               currentPage: response.page || page,
               totalPages: Math.ceil((response.total || 0) / limit),
               totalItems: response.total || 0,
               limit
             });
           } else {
             setModalData([]);
             setModalPagination({ currentPage: page, totalPages: 1, totalItems: 0, limit });
           }
           break;

         case 'parking':
           // For parking modal, show only active records
           response = await parkingService.getAllPaginated(page, limit, 'active');
           console.log('Parking response:', response);
           if (response && response.success && response.data) {
             setModalData(response.data);
             setModalPagination({
               currentPage: page,
               totalPages: Math.ceil((response.total || 0) / limit),
               totalItems: response.total || 0,
               limit
             });
           } else {
             setModalData([]);
             setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
           }
           break;

         case 'services':
           // Show all visitors (not just in-house) to match KPI total
           response = await serviceDeliveryService.getAll(page, limit);
           console.log('Services response:', response);
           if (response && response.success && response.data) {
             setModalData(response.data);
             setModalPagination({
               currentPage: page,
               totalPages: Math.ceil((response.total || 0) / limit),
               totalItems: response.total || 0,
               limit
             });
           } else {
             setModalData([]);
             setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
           }
           break;

         case 'flagged':
           response = await parkingService.getFlaggedActiveVehicles(page, limit);
           console.log('Flagged response:', response);
           if (response && response.success && response.data) {
             setModalData(response.data);
             setModalPagination({
               currentPage: page,
               totalPages: Math.ceil((response.total || 0) / limit),
               totalItems: response.total || 0,
               limit
             });
           } else {
             setModalData([]);
             setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
           }
           break;

         case 'feedback':
           response = await feedbackService.getAll(page, limit);
           console.log('Feedback response:', response);

           if (response && (response as any).success && (response as any).data) {
             const data = (response as any).data;
             console.log('Feedback data found:', data.length, 'records, total:', (response as any).total);

             setModalData(data);
             setModalPagination({
               currentPage: (response as any).page || page,
               totalPages: Math.ceil(((response as any).total || 0) / limit),
               totalItems: (response as any).total || 0,
               limit
             });
           } else {
             console.log('No feedback data found. Response:', response);
             setModalData([]);
             setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
           }
           break;
           
         case 'employee-performance-tasks-done':
           // Employee performance based on completed tasks (using Task model)
           response = await statisticsService.getEmployeePerformanceByTasksDone();
           console.log('Employee performance tasks done response:', response);
           if (response && response.success && response.data) {
             setModalData(response.data);
             setModalPagination({
               currentPage: 1,
               totalPages: 1,
               totalItems: response.data.length,
               limit: response.data.length
             });
           } else {
             setModalData([]);
             setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
           }
           break;
           
         case 'waiting-time-analytics':
           // Waiting time analytics
           response = await statisticsService.getWaitingTimeAnalytics();
           console.log('Waiting time analytics response:', response);
           if (response && response.success && response.data) {
             setModalData(response.data);
             setModalPagination({
               currentPage: 1,
               totalPages: 1,
               totalItems: response.data.length,
               limit: response.data.length
             });
           } else {
             setModalData([]);
             setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
           }
           break;
           
         case 'employee-performance-service':
           // Employee performance based on service
           response = await statisticsService.getEmployeePerformanceByService();
           console.log('Employee performance service response:', response);
           if (response && response.success && response.data) {
             setModalData(response.data);
             setModalPagination({
               currentPage: 1,
               totalPages: 1,
               totalItems: response.data.length,
               limit: response.data.length
             });
           } else {
             setModalData([]);
             setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
           }
           break;

         case 'services-detail':
           // Services by department detailed view
           response = await statisticsService.getServiceDeliveryStats();
           console.log('Services detail response:', response);
           if (response && response.success && response.data) {
             // Transform department data for display
             const deptData = Object.entries(response.data.by_department || {}).map(([dept, count]) => ({
               department: dept,
               count: count as number
             }));
             setModalData(deptData);
             setModalPagination({ currentPage: 1, totalPages: 1, totalItems: deptData.length, limit });
           } else {
             setModalData([]);
             setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
           }
           break;

         case 'employees-detail':
           // Employees by department detailed view
           response = await statisticsService.getDepartmentsWithLeaders();
           console.log('Employees detail response:', response);
           if (response && response.success && response.data && response.data.departments) {
             setModalData(response.data.departments);
             setModalPagination({ currentPage: 1, totalPages: 1, totalItems: response.data.departments.length, limit });
           } else {
             setModalData([]);
             setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
           }
           break;

         case 'service-hourly':
           response = await statisticsService.getHourlyServiceDeliveryStats();
           console.log('Service hourly response:', response);
           if (response && (response as any).success && (response as any).data) {
             setModalData((response as any).data.hourly || []);
             setModalPagination({ currentPage: 1, totalPages: 1, totalItems: ((response as any).data.hourly || []).length, limit });
           } else {
             setModalData([]);
             setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
           }
           break;

         default:
           setModalData([]);
           setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
       }
     } catch (error) {
       console.error('Error fetching modal data:', error);
       setModalData([]);
       setModalPagination({ currentPage: 1, totalPages: 1, totalItems: 0, limit });
     } finally {
       setModalLoading(false);
     }
   }, []);

  // Handle card click to open modal with data
  const handleCardClick = useCallback((cardType: string) => {
    setSelectedCard(cardType);
    fetchModalData(cardType);
  }, [fetchModalData]);

  // Handle modal close and cleanup charts
  const handleModalClose = useCallback(() => {
    // Destroy modal-specific charts
    const chartsToDestroy = ['modal-service-hourly', 'modal-services-detail'];
    chartsToDestroy.forEach(chartId => {
      const chart = chartsRef.current.get(chartId);
      if (chart) {
        chart.destroy();
        chartsRef.current.delete(chartId);
      }
    });
    setSelectedCard(null);
  }, []);

  // Create modal charts when selectedCard changes
  useEffect(() => {
    if (selectedCard === 'services-detail' && modalData.length > 0) {
      const createServicesChart = () => {
        const modalCanvas = document.getElementById('modal-services-detail-chart') as HTMLCanvasElement;
        if (modalCanvas) {
          // Destroy existing chart
          const existingChart = chartsRef.current.get('modal-services-detail');
          if (existingChart) {
            existingChart.destroy();
          }

          const deptNames = modalData.map((dept: any) => dept.department);
          const deptCounts = modalData.map((dept: any) => dept.count);
          const maxCount = Math.max(...deptCounts, 1);

          const newChart = new Chart(modalCanvas, {
            type: 'bar',
            data: {
              labels: deptNames,
              datasets: [{
                data: deptCounts,
                backgroundColor: '#0078d4',
                barPercentage: 0.6,
                categoryPercentage: 0.8,
                label: 'Services'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context: any) => {
                      const value = Number(context.raw);
                      return `Total Visitors: ${value}`;
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  min: 0,
                  max: maxCount + 1,
                  grid: { color: '#e5e7eb' },
                  ticks: {
                    stepSize: Math.max(1, Math.ceil(maxCount / 5)),
                    callback: (value: any) => Number(Number(value)).toString(),
                    precision: 0
                  },
                  title: {
                    display: true,
                    text: 'count',
                    color: '#9ca3af',
                    font: { size: 10 }
                  }
                },
                x: {
                  grid: { display: false },
                  ticks: {
                    font: { size: 12 },
                    maxRotation: 45
                  }
                }
              }
            }
          });

          chartsRef.current.set('modal-services-detail', newChart);
        }
      };

      // Delay to ensure modal is fully rendered
      const timeoutId = setTimeout(createServicesChart, 300);
      return () => clearTimeout(timeoutId);
    }

    if (selectedCard === 'service-hourly' && modalData.length > 0) {
      const createModalChart = () => {
        const modalCanvas = document.getElementById('modal-service-hourly-chart') as HTMLCanvasElement;
        if (modalCanvas) {
          // Destroy existing chart
          const existingChart = chartsRef.current.get('modal-service-hourly');
          if (existingChart) {
            existingChart.destroy();
          }

          const formattedServiceHourLabels = SERVICE_HOURS.map(hour => formatHourLabel(parseInt(hour)));
          const visitorData = modalData.map((hour: any) => hour.visitors_checked_in || 0);
          const maxVisitor = Math.max(...visitorData, 1);

          const newChart = new Chart(modalCanvas, {
            type: 'line',
            data: {
              labels: formattedServiceHourLabels,
              datasets: [{
                data: visitorData,
                borderColor: '#00b294',
                backgroundColor: 'rgba(0,178,148,0.05)',
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                borderWidth: 3,
                pointBackgroundColor: '#00b294',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                label: 'Visitors'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context: any) => {
                      const value = Number(context.raw);
                      return `Visitors checked in: ${value}`;
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  min: 0,
                  max: Math.max(maxVisitor * 2, 10),
                  grid: { color: '#e5e7eb' },
                  ticks: {
                    stepSize: Math.max(1, Math.ceil((maxVisitor * 2) / 5)),
                    callback: (value: any) => Number(Number(value)).toString(),
                    precision: 0
                  },
                  title: {
                    display: true,
                    text: 'count',
                    color: '#9ca3af',
                    font: { size: 10 }
                  }
                },
                x: {
                  grid: { display: false },
                  ticks: {
                    font: { size: 12 },
                    maxRotation: 45
                  }
                }
              }
            }
          });

          chartsRef.current.set('modal-service-hourly', newChart);
        }
      };

      // Delay to ensure modal is fully rendered
      const timeoutId = setTimeout(createModalChart, 300);
      return () => {
        clearTimeout(timeoutId);
        // Clean up charts when component unmounts or selectedCard changes
        const chartsToDestroy = ['modal-service-hourly', 'modal-services-detail'];
        chartsToDestroy.forEach(chartId => {
          if (!selectedCard || !selectedCard.includes(chartId.split('-')[1])) {
            const chart = chartsRef.current.get(chartId);
            if (chart) {
              chart.destroy();
              chartsRef.current.delete(chartId);
            }
          }
        });
      };
    }
  }, [selectedCard, modalData]);

  // Handle pagination change
  const handlePageChange = useCallback((newPage: number) => {
    if (selectedCard) {
      fetchModalData(selectedCard, newPage, modalPagination.limit);
    }
  }, [selectedCard, modalPagination.limit, fetchModalData]);

  // Computed values (rounded, no decimals)
  const activeRate = data ? Number((data.employeeStats.active / data.employeeStats.total) * 100) : 0;
  const completionRate = data && data.serviceStats.total ? Number((data.serviceStats.completed / data.serviceStats.total) * 100) : 0;
  const avgRating = data ? Number(data.feedbackAvg.overall_average.average_rating) : 0;
  const driverTotal = data ? data.parkingStats.by_driver_type.staff + data.parkingStats.by_driver_type.visitor + data.parkingStats.by_driver_type.regular : 0;
  const maxStaff = data ? Math.max(...data.departments.map(d => d.staff), 1) : 1;
  const maxTasks = data?.employeePerformanceTasksDone?.length ? Math.max(...data.employeePerformanceTasksDone.map(t => t.total_tasks || 0), 1) : 1;
  const maxWaitingCases = data?.waitingTimeAnalytics?.length ? Math.max(...data.waitingTimeAnalytics.map(w => w.total_cases || 0), 1) : 1;
  const maxCitizensServed = data?.employeePerformanceService?.length ? Math.max(...data.employeePerformanceService.map(e => e.citizens_served || 0), 1) : 1;
  
  // Get color based on rating
  const getRatingColor = (rating: number) => {
    if (rating >= 9) return 'text-emerald-600';
    if (rating >= 7) return 'text-blue-600';
    if (rating >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  // Get status color for waiting time
  const getStatusColor = (status: string) => {
    if (status === 'Critical') return 'bg-red-100 text-red-800';
    if (status === 'Moderate') return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };
  
  // Get rating color for employee performance
  const getPerfRatingColor = (rating: string) => {
    if (rating === 'Excellent') return 'text-emerald-600';
    if (rating === 'Good') return 'text-blue-600';
    if (rating === 'Slow') return 'text-yellow-600';
    return 'text-red-600';
  };
  
  // Visible data for expandable tables
  const visibleDepartments = showAllDepartments
    ? data?.departments
    : data?.departments?.slice((departmentPage - 1) * departmentLimit, departmentPage * departmentLimit);
  const visibleRatings = showAllRatings ? data?.departments : data?.departments?.slice(0, 5);
  
  // Employee Performance pagination calculations
  const totalTasksDonePages = Math.ceil((data?.employeePerformanceTasksDone?.length || 0) / performanceLimit);
  const visibleTasksDone = showAllTasksDone
    ? data?.employeePerformanceTasksDone
    : data?.employeePerformanceTasksDone?.slice((tasksDonePage - 1) * performanceLimit, tasksDonePage * performanceLimit);
  
  const totalWaitingTimePages = Math.ceil((data?.waitingTimeAnalytics?.length || 0) / performanceLimit);
  const visibleWaitingTime = showAllWaitingTime
    ? data?.waitingTimeAnalytics
    : data?.waitingTimeAnalytics?.slice((waitingTimePage - 1) * performanceLimit, waitingTimePage * performanceLimit);
  
  const totalServicePerfPages = Math.ceil((data?.employeePerformanceService?.length || 0) / performanceLimit);
  const visibleServicePerf = showAllServicePerf
    ? data?.employeePerformanceService
    : data?.employeePerformanceService?.slice((servicePerfPage - 1) * performanceLimit, servicePerfPage * performanceLimit);
  
  if (loading || !data) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-500"><path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" strokeWidth="1.2"/></svg>
          <label className="font-medium">Department</label>
          <select className="text-xs px-2 py-1 border border-gray-300 rounded bg-white">
            <option>All departments</option>
            {data.departments.map(d => <option key={d.name}>{d.name}</option>)}
          </select>
        </div>
        <div className="w-px h-5 bg-gray-200 hidden sm:block"></div>
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <label className="font-medium">Status</label>
          <select className="text-xs px-2 py-1 border border-gray-300 rounded bg-white">
            <option>All statuses</option>
          </select>
        </div>
        <div className="w-px h-5 bg-gray-200 hidden sm:block"></div>
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <label className="font-medium">Period</label>
          <select className="text-xs px-2 py-1 border border-gray-300 rounded bg-white">
            <option>Today</option>
          </select>
        </div>
       <button
         onClick={fetchData}
         className="ml-auto text-xs px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
       >
         <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M13.65 2.35A7.958 7.958 0 008 0C4.69 0 1.99 2.24 1.25 5.4m-.9 5.25A7.958 7.958 0 008 16c3.31 0 6.01-2.24 6.75-5.4M16 6l-4-4-4 4M0 10l4 4 4-4" stroke="white" strokeWidth="1.5" fill="none"/></svg>
         Refresh
       </button>
       <span className="text-xs text-gray-500 hidden lg:inline">{lastRefresh.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
     </div>

    {/* Employee Performance Tables Section */}

   
   {/* Main Content */}
   <div className="p-3 space-y-2.5">
        
        {/* KPI Row 1 - Clickable Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div
            onClick={() => handleCardClick('employees')}
            className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
          >
            <div className="border-l-2 border-blue-600 pl-2">
              <div className="text-xs text-gray-500 font-medium">Total employees</div>
              <div className="text-2xl font-light text-gray-900">{data.employeeStats.total}</div>
              <div className="text-xs text-gray-400 mt-1">
                <span className="text-teal-600">▲ {activeRate}%</span> active rate
              </div>
            </div>
          </div>
          
          <div
            onClick={() => handleCardClick('parking')}
            className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
          >
            <div className="border-l-2 border-teal-600 pl-2">
              <div className="text-xs text-gray-500 font-medium">Currently parked</div>
              <div className="text-2xl font-light text-gray-900">{data.parkingStats.total}</div>
               <div className="text-xs text-gray-400 mt-1">
                 {data.parkingStats.by_driver_type.visitor} visitors · {data.parkingStats.by_driver_type.staff} staff · {data.parkingStats.by_driver_type.regular} regular
               </div>
            </div>
          </div>
          
          <div
            onClick={() => handleCardClick('services')}
            className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
          >
            <div className="border-l-2 border-yellow-500 pl-2">
              <div className="text-xs text-gray-500 font-medium">Total Visitors</div>
              <div className="text-2xl font-light text-gray-900">{data.serviceStats.total}</div>
              <div className="text-xs text-gray-400 mt-1">
                <span className="text-teal-600">▲ {completionRate}%</span> completed
              </div>
            </div>
          </div>
          
            <div
              onClick={() => handleCardClick('flagged')}
              className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
            >
              <div className="border-l-2 border-red-600 pl-2">
                <div className="text-xs text-gray-500 font-medium">Flagged vehicles</div>
                <div className="text-2xl font-light text-gray-900">{data.flaggedVehicles.currently_flagged.count}</div>
                <div className="text-xs text-gray-400 mt-1">
                  <span className="text-red-600">currently flagged</span>
                </div>
              </div>
            </div>
        </div>
        
{/* KPI Row 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="bg-white border border-gray-200 p-3">
            <div className="border-l-2 border-purple-600 pl-2">
              <div className="text-xs text-gray-500 font-medium">Satisfaction Score</div>
              <div className="text-xl font-light text-gray-900">{(avgRating * 100 / 10).toFixed(1)} <span className="text-sm text-gray-400">%</span></div>
              <div className="text-xs text-gray-400 mt-1">{data.feedbackTotals.total}  total feedbacks</div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 p-3">
            <div className="border-l-2 border-teal-600 pl-2">
              <div className="text-xs text-gray-500 font-medium">Active employees</div>
              <div className="text-2xl font-light text-gray-900">{data.employeeStats.active}</div>
              <div className="text-xs text-gray-400 mt-1"><span className="text-red-600">{data.employeeStats.inactive} inactive</span></div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 p-3">
            <div className="border-l-2 border-yellow-500 pl-2">
              <div className="text-xs text-gray-500 font-medium">Visitors Reserved cars</div>
              <div className="text-2xl font-light text-gray-900">{data.emergencyCars.total}</div>
              <div className="text-xs text-gray-400 mt-1"><span className="text-teal-600">{data.emergencyCars.active} active</span> · {data.emergencyCars.expired} expired</div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 p-3">
            <div className="border-l-2 border-blue-600 pl-2">
              <div className="text-xs text-gray-500 font-medium">Total departments</div>
              <div className="text-2xl font-light text-gray-900">{data.departments.length}</div>
              <div className="text-xs text-gray-400 mt-1">{data.employeeStats.total} staff total</div>
            </div>
          </div>
        </div>

        

                <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance </h3>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            
            {/* Employee Performance Tasks Done Table */}
            <div className="bg-white border border-gray-200   overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <span className="font-medium text-gray-900">Tasks Completed Performance</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Employee Name</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Tasks Completed</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Expected Time</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Actual Time</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTasksDone?.map((emp, idx) => {
                      const tasksPercent = Number(((emp.total_tasks || 0) / maxTasks) * 100);
                      return (
                        <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-2 font-medium text-gray-900 break-words max-w-[120px]">{emp.employee_name || 'Unknown'}</td>
                          <td className="py-2 px-2">
                            <div>{emp.total_tasks || 0}</div>
                            <div className="h-1 bg-gray-100 mt-1 w-12">
                              <div className="h-full bg-indigo-600" style={{ width: `${tasksPercent}%` }}></div>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{emp.avg_expected_time || '0h'}</td>
                          <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{emp.avg_actual_time || '0h'}</td>
                          <td className={`py-2 px-2 font-semibold ${getPerfRatingColor(emp.rating)} whitespace-nowrap`}>
                            {emp.rating || 'N/A'}
                          </td>
                         </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!showAllTasksDone && data.employeePerformanceTasksDone.length > performanceLimit && (
                <div className="mt-3 p-3 pt-0 flex flex-col sm:flex-row justify-between items-center gap-2 border-t border-gray-100">
                  <div className="text-xs text-gray-600 text-center sm:text-left">
                    Showing {visibleTasksDone?.length || 0} of {data.employeePerformanceTasksDone.length} employees
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setTasksDonePage(Math.max(1, tasksDonePage - 1))}
                      disabled={tasksDonePage <= 1}
                      className="px-2 py-1 text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setTasksDonePage(Math.min(totalTasksDonePages, tasksDonePage + 1))}
                      disabled={tasksDonePage >= totalTasksDonePages}
                      className="px-2 py-1 text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <button
                    onClick={() => setShowAllTasksDone(true)}
                    className="text-xs px-2 py-1 bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Show All
                  </button>
                </div>
              )}
              {showAllTasksDone && (
                <div className="mt-3 p-3 pt-0 text-center border-t border-gray-100">
                  <button
                    onClick={() => {
                      setShowAllTasksDone(false);
                      setTasksDonePage(1);
                    }}
                    className="text-xs px-3 py-1 bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Show Less
                  </button>
                </div>
              )}
              {data.employeePerformanceTasksDone.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No task performance data available
                </div>
              )}
            </div>
            
            {/* Waiting Time Analytics Table */}
            <div className="bg-white border border-gray-200   overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <span className="font-medium text-gray-900">Waiting Time Analytics</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Department</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Avg Wait</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Max Wait</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Min Wait</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Status</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Cases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleWaitingTime?.map((wt, idx) => {
                      const casesPercent = Number(((wt.total_cases || 0) / maxWaitingCases) * 100);
                      return (
                        <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-2 font-medium text-gray-900 break-words max-w-[100px]">{wt.department_name || 'Unknown'}</td>
                          <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{wt.avg_wait_time || '0m'}</td>
                          <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{wt.max_wait_time || '0m'}</td>
                          <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{wt.min_wait_time || '0m'}</td>
                          <td className="py-2 px-2">
                            <span className={`px-1.5 py-0.5 text-xs rounded ${getStatusColor(wt.status)} whitespace-nowrap`}>
                              {wt.status || 'Normal'}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            <div>{wt.total_cases || 0}</div>
                            <div className="h-1 bg-gray-100 mt-1 w-12">
                              <div className="h-full bg-orange-500" style={{ width: `${casesPercent}%` }}></div>
                            </div>
                          </td>
                         </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!showAllWaitingTime && data.waitingTimeAnalytics.length > performanceLimit && (
                <div className="mt-3 p-3 pt-0 flex flex-col sm:flex-row justify-between items-center gap-2 border-t border-gray-100">
                  <div className="text-xs text-gray-600 text-center sm:text-left">
                    Showing {visibleWaitingTime?.length || 0} of {data.waitingTimeAnalytics.length} departments
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setWaitingTimePage(Math.max(1, waitingTimePage - 1))}
                      disabled={waitingTimePage <= 1}
                      className="px-2 py-1 text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setWaitingTimePage(Math.min(totalWaitingTimePages, waitingTimePage + 1))}
                      disabled={waitingTimePage >= totalWaitingTimePages}
                      className="px-2 py-1 text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <button
                    onClick={() => setShowAllWaitingTime(true)}
                    className="text-xs px-2 py-1 bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Show All
                  </button>
                </div>
              )}
              {showAllWaitingTime && (
                <div className="mt-3 p-3 pt-0 text-center border-t border-gray-100">
                  <button
                    onClick={() => {
                      setShowAllWaitingTime(false);
                      setWaitingTimePage(1);
                    }}
                    className="text-xs px-3 py-1 bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Show Less
                  </button>
                </div>
              )}
              {data.waitingTimeAnalytics.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No waiting time data available
                </div>
              )}
            </div>
            
            {/* Employee Performance Service Table */}
            <div className="bg-white border border-gray-200   overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <span className="font-medium text-gray-900">Service Performance</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Employee Name</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Citizens Served</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Avg Service Time</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleServicePerf?.map((emp, idx) => {
                      const servedPercent = Number(((emp.citizens_served || 0) / maxCitizensServed) * 100);
                      return (
                        <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-2 font-medium text-gray-900 break-words max-w-[120px]">{emp.employee_name || 'Unknown'}</td>
                          <td className="py-2 px-2">
                            <div>{emp.citizens_served || 0}</div>
                            <div className="h-1 bg-gray-100 mt-1 w-12">
                              <div className="h-full bg-green-600" style={{ width: `${servedPercent}%` }}></div>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{emp.avg_service_time || '0m'}</td>
                          <td className={`py-2 px-2 font-semibold ${getPerfRatingColor(emp.rating)} whitespace-nowrap`}>
                            {emp.rating || 'N/A'}
                          </td>
                         </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!showAllServicePerf && data.employeePerformanceService.length > performanceLimit && (
                <div className="mt-3 p-3 pt-0 flex flex-col sm:flex-row justify-between items-center gap-2 border-t border-gray-100">
                  <div className="text-xs text-gray-600 text-center sm:text-left">
                    Showing {visibleServicePerf?.length || 0} of {data.employeePerformanceService.length} employees
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setServicePerfPage(Math.max(1, servicePerfPage - 1))}
                      disabled={servicePerfPage <= 1}
                      className="px-2 py-1 text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setServicePerfPage(Math.min(totalServicePerfPages, servicePerfPage + 1))}
                      disabled={servicePerfPage >= totalServicePerfPages}
                      className="px-2 py-1 text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <button
                    onClick={() => setShowAllServicePerf(true)}
                    className="text-xs px-2 py-1 bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Show All
                  </button>
                </div>
              )}
              {showAllServicePerf && (
                <div className="mt-3 p-3 pt-0 text-center border-t border-gray-100">
                  <button
                    onClick={() => {
                      setShowAllServicePerf(false);
                      setServicePerfPage(1);
                    }}
                    className="text-xs px-3 py-1 bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Show Less
                  </button>
                </div>
              )}
              {data.employeePerformanceService.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No service performance data available
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Overview Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-2.5">
                {/* Hourly Parking Chart */}
                <div className="bg-white border border-gray-200 p-3">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Hourly parking activity</div>
                      <div className="text-xs text-gray-500">Check-in vs check-out · today</div>
                    </div>
                    <button className="text-gray-400 text-lg leading-none">⋯</button>
                  </div>
                  <div className="flex gap-3 text-xs mb-2">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-600"></div>Check-in</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-500"></div>Check-out</div>
                  </div>
                  <div className="h-40 w-full">
                    <canvas id="chart-hourly"></canvas>
                  </div>
                </div>
                
                {/* Two Charts Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div
                    onClick={() => handleCardClick('services-detail')}
                    className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Services by department</div>
                        <div className="text-xs text-gray-500">Inhouse vs completed</div>
                      </div>
                      <button className="text-gray-400 text-lg">⋯</button>
                    </div>
                    <div className="flex gap-3 text-xs mb-2">
                      <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-600"></div>Inhouse</div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 bg-teal-600"></div>Completed</div>
                    </div>
                    <div className="h-40 w-full">
                      <canvas id="chart-services"></canvas>
                    </div>
                  </div>
                  
                  <div
                    onClick={() => handleCardClick('employees-detail')}
                    className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Employees per department</div>
                        <div className="text-xs text-gray-500">Staff headcount</div>
                      </div>
                      <button className="text-gray-400 text-lg">⋯</button>
                    </div>
                    <div className="flex gap-3 text-xs mb-2">
                      <div className="flex items-center gap-1"><div className="w-2 h-2 bg-purple-600"></div>Headcount</div>
                    </div>
                    <div className="h-40 w-full">
                      <canvas id="chart-employees"></canvas>
                    </div>
                  </div>
                </div>
                
                {/* Department Overview Table */}
                <div className="bg-white border border-gray-200 p-3">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">CITIZEN FEEDBACK</div>
                      <div className="text-xs text-gray-500">Leaders, staff, and feedback ratings</div>
                    </div>
                    <button className="text-gray-400 text-lg">⋯</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left py-2 px-2 font-semibold text-gray-600">Department</th>
                          <th className="text-left py-2 px-2 font-semibold text-gray-600">Leader</th>
                          <th className="text-left py-2 px-2 font-semibold text-gray-600">Staff</th>
                          <th className="text-left py-2 px-2 font-semibold text-gray-600">Rating</th>
                          <th className="text-left py-2 px-2 font-semibold text-gray-600">Feedback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleDepartments?.map((row, idx) => {
                          const staffPercent = Number((row.staff / maxStaff) * 100);
                          return (
                            <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-2 font-medium text-gray-900">{row.name}</td>
                              <td className="py-2 px-2 text-gray-500">{row.leader}</td>
                              <td className="py-2 px-2">
                                <div>{row.staff}</div>
                                <div className="h-1 bg-gray-100 mt-1 w-16">
                                  <div className="h-full bg-purple-600" style={{ width: `${staffPercent}%` }}></div>
                                </div>
                              </td>
                              <td className={`py-2 px-2 font-semibold ${getRatingColor(row.rating)}`}>{row.feedback ? (row.rating * 100 / 10).toFixed(1) + '%' : '___'}</td>
                              <td className="py-2 px-2 text-gray-500">{row.feedback}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!showAllDepartments && data.departments.length > departmentLimit && (
                    <div className="mt-3 flex flex-col sm:flex-row justify-between items-center gap-2">
                      <div className="text-xs text-gray-600 text-center sm:text-left">
                        Showing {visibleDepartments?.length || 0} of {data.departments.length} departments
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setDepartmentPage(Math.max(1, departmentPage - 1))}
                          disabled={departmentPage <= 1}
                          className="px-2 py-1 text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setDepartmentPage(Math.min(Math.ceil(data.departments.length / departmentLimit), departmentPage + 1))}
                          disabled={departmentPage >= Math.ceil(data.departments.length / departmentLimit)}
                          className="px-2 py-1 text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                      <button
                        onClick={() => setShowAllDepartments(true)}
                        className="text-xs px-2 py-1 bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Show All
                      </button>
                    </div>
                  )}
                  {showAllDepartments && (
                    <div className="mt-3 text-center">
                      <button
                        onClick={() => {
                          setShowAllDepartments(false);
                          setDepartmentPage(1);
                        }}
                        className="text-xs px-3 py-1 bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Show Less
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Right Column */}
              <div className="space-y-2.5">
                {/* Vehicles by Driver Type */}
                <div className="bg-white border border-gray-200 p-3">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Vehicles by driver type</div>
                      <div className="text-xs text-gray-500">Currently parked · {driverTotal} total</div>
                    </div>
                    <button className="text-gray-400 text-lg">⋯</button>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-32 h-32 flex-shrink-0">
                      <canvas id="chart-donut"></canvas>
                    </div>
                    <div className="flex-1 space-y-2 w-full">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-blue-600"></div>Staff</div>
                        <div className="font-semibold">{data.parkingStats.by_driver_type.staff} <span className="text-gray-400 text-xs">({driverTotal ? Number(data.parkingStats.by_driver_type.staff / driverTotal * 100) : 0}%)</span></div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-teal-600"></div>Visitor</div>
                        <div className="font-semibold">{data.parkingStats.by_driver_type.visitor} <span className="text-gray-400 text-xs">({driverTotal ? Number(data.parkingStats.by_driver_type.visitor / driverTotal * 100) : 0}%)</span></div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-yellow-500"></div>Regular</div>
                        <div className="font-semibold">{data.parkingStats.by_driver_type.regular} <span className="text-gray-400 text-xs">({driverTotal ? Number(data.parkingStats.by_driver_type.regular / driverTotal * 100) : 0}%)</span></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Flagged Vehicles */}
                <div className="bg-white border border-gray-200 p-3">
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-gray-900">Flagged vehicles</div>
                    <div className="text-xs text-gray-500">Currently flagged</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 p-4 text-center">
                    <div className="text-2xl font-light text-red-600 mb-1">{data.flaggedVehicles.currently_flagged.count}</div>
                    <div className="text-sm text-gray-600 mb-2">Currently flagged</div>
                    <div className="text-xs text-gray-500">
                      Duration: {data.flaggedVehicles.currently_flagged.min_minutes}–{data.flaggedVehicles.currently_flagged.max_minutes} min
                    </div>
                  </div>
                </div>
                
                {/* Visitors Reserved cars */}
                <div className="bg-white border border-gray-200 p-3">
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-gray-900">Visitors Reserved cars</div>
                    <div className="text-xs text-gray-500">Active vs expired status</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="text-xl font-light text-teal-600">{data.emergencyCars.active}</div>
                      <div className="text-xs text-gray-500">Active</div>
                      <div className="h-1 bg-gray-100 mt-1">
                        <div className="h-full bg-teal-600" style={{ width: `${data.emergencyCars.total > 0 ? Number(data.emergencyCars.active / data.emergencyCars.total * 100) : 0}%` }}></div>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">{data.emergencyCars.total > 0 ? Number(data.emergencyCars.active / data.emergencyCars.total * 100) : 0}% of fleet</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-light text-red-600">{data.emergencyCars.expired}</div>
                      <div className="text-xs text-gray-500">Expired</div>
                      <div className="h-1 bg-gray-100 mt-1">
                        <div className="h-full bg-red-600" style={{ width: `${data.emergencyCars.total > 0 ? Number(data.emergencyCars.expired / data.emergencyCars.total * 100) : 0}%` }}></div>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">{data.emergencyCars.total > 0 ? Number(data.emergencyCars.expired / data.emergencyCars.total * 100) : 0}% of fleet</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 text-center">
                    <div><div className="text-sm font-semibold">{data.emergencyCars.active_vehicles_count}</div><div className="text-[10px] text-gray-400">Active vehicles</div></div>
                    <div><div className="text-sm font-semibold">{data.emergencyCars.history_vehicles_count}</div><div className="text-[10px] text-gray-400">In history</div></div>
                    <div><div className="text-sm font-semibold">{data.emergencyCars.total}</div><div className="text-[10px] text-gray-400">Total</div></div>
                  </div>
                </div>
                
                {/* Satisfaction Score */}
                <div className="bg-white border border-gray-200 p-3">
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-gray-900">Satisfaction Score</div>
                    <div className="text-xs text-gray-500">By department · out of 10</div>
                  </div>
                  <div className="space-y-2">
                    {visibleRatings?.map((dept, idx) => {
                      const barWidth = Number(dept.rating / 10 * 100);
                      return (
                        <div key={idx}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">{dept.name}</span>
                            <span className={`font-semibold ${getRatingColor(dept.rating)}`}>{dept.rating}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100">
                            <div className={`h-full ${dept.rating >= 9 ? 'bg-emerald-600' : dept.rating >= 7 ? 'bg-blue-600' : dept.rating >= 5 ? 'bg-yellow-500' : 'bg-red-600'}`} style={{ width: `${barWidth}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {data.departments.length > 5 && (
                    <div className="mt-3 text-center">
                      <button
                        onClick={() => setShowAllRatings(!showAllRatings)}
                        className="text-xs px-3 py-1 bg-blue-600 text-white hover:bg-blue-700"
                      >
                        {showAllRatings ? 'Show Less' : `Show All (${data.departments.length})`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Bottom Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <div
                onClick={() => handleCardClick('feedback')}
                className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Feedback by department</div>
                    <div className="text-xs text-gray-500">Total submissions · {data.feedbackTotals.total}</div>
                  </div>
                  <button className="text-gray-400 text-lg">⋯</button>
                </div>
                <div className="flex gap-3 text-xs mb-2">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-purple-600"></div>Feedback count</div>
                </div>
                <div className="h-32 w-full">
                  <canvas id="chart-feedback"></canvas>
                </div>
              </div>
              
              <div
                onClick={() => handleCardClick('service-hourly')}
                className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Hourly service check-ins</div>
                    <div className="text-xs text-gray-500">Visitor arrivals · today</div>
                  </div>
                  <button className="text-gray-400 text-lg">⋯</button>
                </div>
                <div className="flex gap-3 text-xs mb-2">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-teal-600"></div>Visitors checked in</div>
                </div>
                <div className="h-32 w-full">
                  <canvas id="chart-service-hourly"></canvas>
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 p-3">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Employee account status</div>
                    <div className="text-xs text-gray-500">Activation and lock state</div>
                  </div>
                  <button className="text-gray-400 text-lg">⋯</button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs mb-3">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-600"></div>Active {data.employeeStats.active}</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-500"></div>Inactive {data.employeeStats.inactive}</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-600"></div>Locked {data.employeeStats.locked}</div>
                </div>
                <div className="h-32 w-full flex justify-center">
                  <canvas id="chart-status" className="max-w-[150px] max-h-[150px]"></canvas>
                </div>
              </div>
            </div>
        

      </div>
      
      {/* Modal for Card Details */}
      {selectedCard && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4"
            onClick={handleModalClose}
          >
          <div
            className="bg-white w-full max-w-4xl mx-2 sm:mx-4 max-h-[90vh] sm:max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedCard === 'employees' && 'Employee Details'}
                {selectedCard === 'parking' && 'Currently Parked Vehicles'}
                {selectedCard === 'services' && 'Service Delivery Visitors'}
                {selectedCard === 'flagged' && 'Flagged Vehicles Details'}
                {selectedCard === 'services-detail' && 'Services by Department - Detailed View'}
                {selectedCard === 'employees-detail' && 'Employees by Department'}
                {selectedCard === 'feedback' && 'Feedback Details'}
                {selectedCard === 'service-hourly' && 'Hourly Service Check-ins - Detailed View'}
              </h3>
              <button
                onClick={handleModalClose}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              {selectedCard === 'employees' && (
                <div className="space-y-4">


                  {modalLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                    <>
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-xs sm:text-sm border border-gray-200 min-w-[600px]">
                          <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Name</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Email</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Telephone</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Department</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalData.map((employee: any, idx: number) => (
                              <tr key={idx} className="border-b hover:bg-gray-50">
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">{employee.full_name || '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm break-all">{employee.email || '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{employee.telephone || '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">{employee.department_name || employee.department?.department_name || '____'}</td>
                                <td className="px-2 sm:px-4 py-2">
                                  <span className={`px-1 sm:px-2 py-1 text-xs rounded ${employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {employee.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
                        <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                          Showing {modalData.length} of {modalPagination.totalItems} records (Total: {modalPagination.totalItems})
                        </div>
                        <div className="flex gap-1 sm:gap-2">
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage - 1)}
                            disabled={modalPagination.currentPage <= 1}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage + 1)}
                            disabled={modalPagination.currentPage >= modalPagination.totalPages}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedCard === 'parking' && (
                <div className="space-y-4">


                  {modalLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                     <>
                       <div className="overflow-x-auto max-h-64 overflow-y-auto">
                         <table className="w-full text-xs sm:text-sm border border-gray-200 min-w-[700px]">
                           <thead className="bg-gray-50 sticky top-0 z-10">
                             <tr>
                               <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Plate Number</th>
                               <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Driver Name</th>
                               <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Driver Type</th>
                               <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Entry Time</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Duration</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalData.map((record: any, idx: number) => (
                              <tr key={idx} className="border-b hover:bg-gray-50">
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{record.plate_number || record.plate_no || '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">{record.driver_name || 'Unknown'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{record.driver_type || 'Unknown'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{record.check_in ? new Date(record.check_in).toLocaleString() : '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{record.current_duration || '____'}</td>
                                <td className="px-2 sm:px-4 py-2">
                                  <span className={`px-1 sm:px-2 py-1 text-xs rounded ${record.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {record.status || 'Unknown'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
                        <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                          Showing {modalData.length} of {modalPagination.totalItems} records (Total: {modalPagination.totalItems})
                        </div>
                        <div className="flex gap-1 sm:gap-2">
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage - 1)}
                            disabled={modalPagination.currentPage <= 1}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage + 1)}
                            disabled={modalPagination.currentPage >= modalPagination.totalPages}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedCard === 'services' && (
                <div className="space-y-4">

                  {modalLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                     <>
                       <div className="overflow-x-auto max-h-64 overflow-y-auto">
                         <table className="w-full text-xs sm:text-sm border border-gray-200 min-w-[700px]">
                           <thead className="bg-gray-50 sticky top-0 z-10">
                             <tr>
                               <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Name</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Telephone</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Entry Date</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Duration</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Status</th>
                              <th className="px-2 sm:px-4 py-2 text-left border-b">Current Department</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalData.map((visitor: any, idx: number) => (
                              <tr key={idx} className="border-b hover:bg-gray-50">
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">{visitor.full_name || '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{visitor.telephone || '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{visitor.entry_date ? new Date(visitor.entry_date).toLocaleDateString() : '____'}</td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">{visitor.current_duration || '____'}</td>
                                <td className="px-2 sm:px-4 py-2">
                                  <span className={`px-1 sm:px-2 py-1 text-xs rounded ${visitor.is_still_inhouse ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                    {visitor.is_still_inhouse ? 'In House' : 'Completed'}
                                  </span>
                                </td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">
                                  {visitor.departments_assigned && visitor.departments_assigned.length > 0
                                    ? visitor.departments_assigned[visitor.departments_assigned.length - 1].department_name
                                    : '____'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
                        <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                          Showing {modalData.length} of {modalPagination.totalItems} records (Total: {modalPagination.totalItems})
                        </div>
                        <div className="flex gap-1 sm:gap-2">
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage - 1)}
                            disabled={modalPagination.currentPage <= 1}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage + 1)}
                            disabled={modalPagination.currentPage >= modalPagination.totalPages}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedCard === 'flagged' && (
                <div className="space-y-4">

                  {modalLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                     <>
                       <div className="overflow-x-auto max-h-64 overflow-y-auto">
                         <table className="w-full text-sm border border-gray-200">
                           <thead className="bg-gray-50 sticky top-0 z-10">
                             <tr>
                               <th className="px-4 py-2 text-left border-b">Plate Number</th>
                              <th className="px-4 py-2 text-left border-b">Driver Name</th>
                              <th className="px-4 py-2 text-left border-b">Entry Time</th>
                              <th className="px-4 py-2 text-left border-b">Duration</th>
                              <th className="px-4 py-2 text-left border-b">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalData.map((vehicle: any, idx: number) => (
                              <tr key={idx} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-2">{vehicle.plate_number || vehicle.plate_no || '____'}</td>
                                <td className="px-4 py-2">{vehicle.driver_name || 'Unknown'}</td>
                                <td className="px-4 py-2">{vehicle.check_in ? new Date(vehicle.check_in).toLocaleString() : '____'}</td>
                                <td className="px-4 py-2">{vehicle.current_duration || '____'}</td>
                                <td className="px-4 py-2">
                                  <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                                    Flagged
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
                        <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                          Showing {modalData.length} of {modalPagination.totalItems} records (Total: {modalPagination.totalItems})
                        </div>
                        <div className="flex gap-1 sm:gap-2">
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage - 1)}
                            disabled={modalPagination.currentPage <= 1}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage + 1)}
                            disabled={modalPagination.currentPage >= modalPagination.totalPages}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedCard === 'feedback' && (
                <div className="space-y-4">

                  {modalLoading ? (
                    <div className="text-center py-8">Loading feedback data...</div>
                  ) : modalData.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 mb-2">No feedback records found</div>
                      <div className="text-sm text-gray-400">
                        Feedback data will appear here once visitors submit feedback through the service delivery system.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-sm border border-gray-200">
                          <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-2 text-left border-b">User Name</th>
                              <th className="px-4 py-2 text-left border-b">Telephone</th>
                              <th className="px-4 py-2 text-left border-b">Department</th>
                              <th className="px-4 py-2 text-left border-b">Rating</th>
                              <th className="px-4 py-2 text-left border-b">Message</th>
                              <th className="px-4 py-2 text-left border-b">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalData.map((feedback: any, idx: number) => (
                              <tr key={idx} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-2">{feedback.user_name || 'Anonymous'}</td>
                                <td className="px-4 py-2">{feedback.telephone || 'N/A'}</td>
                                <td className="px-4 py-2">{feedback.department_name || 'N/A'}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-1 text-xs rounded ${
                                    feedback.rate >= 4 ? 'bg-green-100 text-green-800' :
                                    feedback.rate >= 3 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {feedback.rate || 0}/{feedback.rate_out_of || 5}
                                  </span>
                                </td>
                                <td className="px-4 py-2 max-w-xs truncate" title={feedback.textmessage}>
                                  {feedback.textmessage || 'No message'}
                                </td>
                                <td className="px-4 py-2">{feedback.created_date ? new Date(feedback.created_date).toLocaleDateString() : 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
                        <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                          Showing {modalData.length} of {modalPagination.totalItems} records (Total: {modalPagination.totalItems})
                        </div>
                        <div className="flex gap-1 sm:gap-2">
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage - 1)}
                            disabled={modalPagination.currentPage <= 1}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => handlePageChange(modalPagination.currentPage + 1)}
                            disabled={modalPagination.currentPage >= modalPagination.totalPages}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedCard === 'services-detail' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      Services by department
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs mb-3">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-600"></div>Total Visitors</div>
                  </div>
                  <div className="h-[500px] w-full">
                    <canvas id="modal-services-detail-chart"></canvas>
                  </div>
                </div>
              )}

              {selectedCard === 'employees-detail' && (
                <div className="space-y-4">
                  {modalLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-xs sm:text-sm border border-gray-200 min-w-[500px]">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Department</th>
                            <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Leader</th>
                            <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Total Employees</th>
                            <th className="px-2 sm:px-4 py-2 text-left border-b whitespace-nowrap">Created Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalData.map((dept: any, idx: number) => (
                            <tr key={idx} className="border-b hover:bg-gray-50">
                              <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium">{dept.department_name}</td>
                              <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">
                                {dept.department_leader?.full_name || 'Not assigned'}
                              </td>
                              <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">{dept.total_employees || 0}</td>
                              <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap">
                                {dept.created_date ? new Date(dept.created_date).toLocaleDateString() : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

               {selectedCard === 'service-hourly' && (
                 <div className="space-y-4">
                   <div className="flex justify-between items-center">
                     <div className="text-sm text-gray-600">
                       Visitor arrivals · today
                     </div>
                   </div>

                   <div className="flex gap-3 text-xs mb-3">
                     <div className="flex items-center gap-1"><div className="w-2 h-2 bg-teal-600"></div>Visitors checked in</div>
                   </div>
                   <div className="h-48 sm:h-56 md:h-64 w-full">
                     <canvas id="modal-service-hourly-chart"></canvas>
                   </div>
                 </div>
               )}

               {/* Employee Performance by Tasks Done Modal */}
               {selectedCard === 'employee-performance-tasks-done' && (
                 <div className="space-y-4">
                   <div className="flex justify-between items-center">
                     <div className="text-sm text-gray-600">
                       Employee Performance (Based on Completed Tasks)
                     </div>
                   </div>

                   <div className="overflow-x-auto max-h-64 overflow-y-auto">
                     <table className="w-full text-sm border border-gray-200">
                       <thead className="bg-gray-50 sticky top-0 z-10">
                         <tr>
                           <th className="px-4 py-2 text-left border-b">Employee Name</th>
                           <th className="px-4 py-2 text-left border-b">Total Tasks Completed</th>
                           <th className="px-4 py-2 text-left border-b">Avg Expected Time</th>
                           <th className="px-4 py-2 text-left border-b">Avg Actual Time</th>
                           <th className="px-4 py-2 text-left border-b">Rating</th>
                         </tr>
                       </thead>
                       <tbody>
                         {modalData.map((emp: any, idx: number) => (
                           <tr key={idx} className="border-b hover:bg-gray-50">
                             <td className="px-4 py-2">{emp.employee_name || 'Unknown'}</td>
                             <td className="px-4 py-2">{emp.total_tasks || 0}</td>
                             <td className="px-4 py-2">{emp.avg_expected_time || '0 hours'}</td>
                             <td className="px-4 py-2">{emp.avg_actual_time || '0 hours'}</td>
                             <td className={`px-4 py-2 ${emp.rating === 'Excellent' ? 'text-emerald-600' : emp.rating === 'Good' ? 'text-blue-600' : emp.rating === 'Slow' ? 'text-yellow-600' : 'text-red-600'}`}>
                               {emp.rating || 'N/A'}
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 </div>
               )}

               {/* Waiting Time Analytics Modal */}
               {selectedCard === 'waiting-time-analytics' && (
                 <div className="space-y-4">
                   <div className="flex justify-between items-center">
                     <div className="text-sm text-gray-600">
                       Waiting Time Analytics by Department
                     </div>
                   </div>

                   <div className="overflow-x-auto max-h-64 overflow-y-auto">
                     <table className="w-full text-sm border border-gray-200">
                       <thead className="bg-gray-50 sticky top-0 z-10">
                         <tr>
                           <th className="px-4 py-2 text-left border-b">Department</th>
                           <th className="px-4 py-2 text-left border-b">Avg Wait Time</th>
                           <th className="px-4 py-2 text-left border-b">Max Wait Time</th>
                           <th className="px-4 py-2 text-left border-b">Min Wait Time</th>
                           <th className="px-4 py-2 text-left border-b">Status</th>
                           <th className="px-4 py-2 text-left border-b">Total Cases</th>
                         </tr>
                       </thead>
                       <tbody>
                         {modalData.map((wt: any, idx: number) => (
                           <tr key={idx} className="border-b hover:bg-gray-50">
                             <td className="px-4 py-2">{wt.department_name || 'Unknown'}</td>
                             <td className="px-4 py-2">{wt.avg_wait_time || '0 mins'}</td>
                             <td className="px-4 py-2">{wt.max_wait_time || '0 mins'}</td>
                             <td className="px-4 py-2">{wt.min_wait_time || '0 mins'}</td>
                             <td className={`px-4 py-2 ${wt.status === 'Critical' ? 'bg-red-100 text-red-800' : wt.status === 'Moderate' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'} rounded`}>
                               {wt.status || 'Normal'}
                             </td>
                             <td className="px-4 py-2">{wt.total_cases || 0}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 </div>
               )}

               {/* Employee Performance by Service Modal */}
               {selectedCard === 'employee-performance-service' && (
                 <div className="space-y-4">
                   <div className="flex justify-between items-center">
                     <div className="text-sm text-gray-600">
                       Employee Performance (Based on Service)
                     </div>
                   </div>

                   <div className="overflow-x-auto max-h-64 overflow-y-auto">
                     <table className="w-full text-sm border border-gray-200">
                       <thead className="bg-gray-50 sticky top-0 z-10">
                         <tr>
                           <th className="px-4 py-2 text-left border-b">Employee Name</th>
                           <th className="px-4 py-2 text-left border-b">Citizens Served</th>
                           <th className="px-4 py-2 text-left border-b">Avg Service Time</th>
                           <th className="px-4 py-2 text-left border-b">Rating</th>
                         </tr>
                       </thead>
                       <tbody>
                         {modalData.map((emp: any, idx: number) => (
                           <tr key={idx} className="border-b hover:bg-gray-50">
                             <td className="px-4 py-2">{emp.employee_name || 'Unknown'}</td>
                             <td className="px-4 py-2">{emp.citizens_served || 0}</td>
                             <td className="px-4 py-2">{emp.avg_service_time || '0 mins'}</td>
                             <td className={`px-4 py-2 ${emp.rating === 'Excellent' ? 'text-emerald-600' : emp.rating === 'Good' ? 'text-blue-600' : emp.rating === 'Slow' ? 'text-yellow-600' : 'text-red-600'}`}>
                               {emp.rating || 'N/A'}
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 </div>
               )}
             </div>
           </div>
         </div>
       )}
     </MainLayout>
   );
 };

 export default Overview;