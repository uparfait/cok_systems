// Overview.tsx - Fixed Y-axis to show whole numbers only
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
            const value = Math.round(context.raw);
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
          callback: (value: any) => Math.round(Number(value)).toString(),
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

// Inline plugin: draws values on column caps. Set `valueLabels: 'all' | 'max'`
// on a bar dataset to opt in ('max' labels only the peak column).
const barValueLabels = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart: any) {
    const ctx = chart.ctx;
    chart.data.datasets.forEach((ds: any, di: number) => {
      const mode = ds.valueLabels;
      if (!mode) return;
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden || meta.type !== 'bar') return;
      const values = (ds.data || []).map((v: any) => Number(v) || 0);
      const maxIdx = values.indexOf(Math.max(...values));
      const horizontal = chart.options.indexAxis === 'y';
      ctx.save();
      ctx.fillStyle = '#6b7280';
      ctx.font = '600 10px sans-serif';
      if (horizontal) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
      } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
      }
      meta.data.forEach((el: any, i: number) => {
        if (mode === 'max' && (i !== maxIdx || values[i] <= 0)) return;
        const text = String(Math.round(values[i]));
        if (horizontal) ctx.fillText(text, el.x + 5, el.y);
        else ctx.fillText(text, el.x, el.y - 4);
      });
      ctx.restore();
    });
  },
};

// ==================== MAIN COMPONENT ====================

const Overview: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();

  // Mayor accounts use the City of Kigali design-rule palette for charts
  const isMayor = (user?.role || '').toLowerCase().includes('mayor');
  const CC = useMemo(
    () =>
      isMayor
        ? {
            blue: '#34A8DB',
            teal: '#4CAF50',
            amber: '#F39C12',
            purple: '#2980B9',
            red: '#E53935',
            blueSoft: 'rgba(52,168,219,0.05)',
            tealSoft: 'rgba(76,175,80,0.05)',
            amberSoft: 'rgba(243,156,18,0.05)',
          }
        : {
            blue: '#2563EB',
            teal: '#0D9488',
            amber: '#EAB308',
            purple: '#9333EA',
            red: '#DC2626',
            blueSoft: 'rgba(37,99,235,0.05)',
            tealSoft: 'rgba(13,148,136,0.05)',
            amberSoft: 'rgba(234,179,8,0.05)',
          },
    [isMayor]
  );
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  // Top-5 departments by service volume, tail folded into "Other" (feeds donut + its legend)
  const serviceShare = useMemo(() => {
    if (!data) return [] as Array<{ name: string; value: number }>;
    const entries = Object.entries(data.serviceStats.by_department)
      .map(([name, value]) => ({ name, value: Number(value) || 0 }))
      .sort((a, b) => b.value - a.value);
    const top = entries.slice(0, 5);
    const other = entries.slice(5).reduce((sum, e) => sum + e.value, 0);
    if (other > 0) top.push({ name: 'Other', value: other });
    return top;
  }, [data]);

  // Departments vs services mirrored chart: staff headcount (left) against
  // services handled per employee (right), largest departments first
  const deptVsServices = useMemo(() => {
    if (!data) return [] as Array<{ name: string; staff: number; services: number; avg: number }>;
    return data.departments
      .map(d => {
        const services = Number(data.serviceStats.by_department[d.name]) || 0;
        return {
          name: d.name,
          staff: d.staff,
          services,
          avg: Math.round((services / Math.max(d.staff, 1)) * 10) / 10,
        };
      })
      .sort((a, b) => b.staff - a.staff)
      .slice(0, 8);
  }, [data]);
  const maxDeptStaff = Math.max(...deptVsServices.map(r => r.staff), 1);
  const maxDeptAvg = Math.max(...deptVsServices.map(r => r.avg), 1);

  // Empty-state flags so cards show a message instead of a blank chart
  const hasServiceByDept = !!data && Object.values(data.serviceStats.by_department).some(v => Number(v) > 0);
  const hasHourlyService = !!data && data.hourlyService.some(h => (h.visitors_checked_in || 0) > 0);
  const hasFeedbackByDept = !!data && Object.values(data.feedbackTotals.by_department).some(v => Number(v) > 0);

  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showAllDepartments, setShowAllDepartments] = useState(false);
  const [showAllRatings, setShowAllRatings] = useState(false);
  const [departmentPage, setDepartmentPage] = useState(1);
  const departmentLimit = 5;

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

  // Donut slot order is CVD-validated: green → blue → amber → dark blue → red, gray for "Other"
  const DONUT_COLORS = useMemo(
    () => [CC.teal, CC.blue, CC.amber, CC.purple, CC.red, '#9CA3AF'],
    [CC]
  );
  
  // Fetch real data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        employeesRes, parkingRes, servicesRes, flaggedStatsRes, emergencyRes,
        feedbackTotalsRes, feedbackAvgRes, hourlyParkingRes, hourlyServiceRes, departmentsRes,
        flaggedCountRes
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
      ]);
      
      const employees = (employeesRes as any)?.data || employeesRes;
      const parking = (parkingRes as any)?.data || parkingRes;
      const services = (servicesRes as any)?.data || servicesRes;
      const flaggedStats = (flaggedStatsRes as any)?.data || flaggedStatsRes;
      const emergency = (emergencyRes as any)?.data || emergencyRes;
      const feedbackTotals = (feedbackTotalsRes as any)?.data || feedbackTotalsRes;
      const flaggedCount = flaggedCountRes;
      const feedbackAvg = (feedbackAvgRes as any)?.data || feedbackAvgRes;
      const hourlyParkingRaw = (hourlyParkingRes as any)?.data?.hourly || (hourlyParkingRes as any) || [];
      const hourlyServiceRaw = (hourlyServiceRes as any)?.data?.hourly || (hourlyServiceRes as any) || [];
      const departmentsRaw = (departmentsRes as any)?.data?.departments || (departmentsRes as any)?.departments || [];
      
      const departments = departmentsRaw.map((dept: any) => ({
        name: dept.department_name,
        leader: dept.department_leader?.full_name || 'Not assigned',
        staff: dept.total_employees,
        rating: Math.round((feedbackAvg?.by_department?.[dept.department_name]?.average_rating || 0)),
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
            staff: Number(parking?.by_driver_type?.staff || 0),
            visitor: Number(parking?.by_driver_type?.visitor || 0),
            regular: Number(parking?.by_driver_type?.regular || 0),
          },
        },
        serviceStats: {
          total: services?.total || 0,
          completed: services?.completed || 0,
          inhouse: services?.inhouse || 0,
          // Prefer the all-services breakdown; by_department only counts in-house visitors
          by_department: services?.by_department_total || services?.by_department || {},
        },
        flaggedVehicles: {
          currently_flagged: {
            count: flaggedCount?.total || 0,
            min_minutes: flaggedStats?.currently_flagged?.min_minutes || 0,
            max_minutes: flaggedStats?.currently_flagged?.max_minutes || 0
          },
          history: flaggedStats?.history || { count: 0, min_minutes: 0, max_minutes: 0 },
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
              borderColor: CC.blue, 
              backgroundColor: CC.blueSoft, 
              fill: true, 
              tension: 0.4, 
              pointRadius: 3, 
              borderWidth: 2,
              pointBackgroundColor: CC.blue,
              pointBorderColor: '#fff',
              pointBorderWidth: 1
            },
            { 
              label: 'Check-out', 
              data: checkOutData, 
              borderColor: CC.amber, 
              backgroundColor: CC.amberSoft, 
              fill: true, 
              tension: 0.4, 
              pointRadius: 3, 
              borderWidth: 2,
              borderDash: [5, 3],
              pointBackgroundColor: CC.amber,
              pointBorderColor: '#fff',
              pointBorderWidth: 1
            }
          ]
        },
        options: getChartConfig(maxParking)
      }));
    }
    
    // 2. Services Chart (columns with rounded caps + value labels)
    // Built from departments that actually have services, largest first  not the full department list
    const svcCanvas = document.getElementById('chart-services') as HTMLCanvasElement;
    if (svcCanvas) {
      const svcEntries = Object.entries(data.serviceStats.by_department)
        .map(([name, value]) => ({ name, value: Number(value) || 0 }))
        .filter(e => e.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
      const svcLabels = svcEntries.map(e => e.name);
      const svcData = svcEntries.map(e => e.value);
      const maxSvc = Math.max(...svcData, 1);
      const svcConfig = getChartConfig(maxSvc);

      chartsRef.current.set('services', new Chart(svcCanvas, {
        type: 'bar',
        data: {
          labels: svcLabels,
          datasets: [
            {
              label: 'Total services',
              data: svcData,
              backgroundColor: CC.blue,
              borderRadius: 4,
              borderSkipped: 'start',
              maxBarThickness: 24,
              barPercentage: 0.6,
              categoryPercentage: 0.8,
              valueLabels: 'all',
            } as any,
          ]
        },
        options: {
          ...svcConfig,
          layout: { padding: { top: 14 } },
          scales: {
            ...svcConfig.scales,
            x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } }
          }
        },
        plugins: [barValueLabels]
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
            backgroundColor: CC.purple, 
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
              ticks: { callback: (value: any) => Math.round(Number(value)).toString(), stepSize: 1 }
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
            backgroundColor: [CC.blue, CC.teal, CC.amber], 
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
                label: (ctx: any) => `${ctx.label}: ${Math.round(ctx.raw)}`
              }
            }
          }
        }
      }));
    }
    
    // 5. Feedback Chart (columns + trend line, same style as hourly check-ins)
    // Built from departments that actually received feedback, largest first
    const fbCanvas = document.getElementById('chart-feedback') as HTMLCanvasElement;
    if (fbCanvas) {
      const fbEntries = Object.entries(data.feedbackTotals.by_department)
        .map(([name, value]) => ({ name, value: Number(value) || 0 }))
        .filter(e => e.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
      const fbLabels = fbEntries.map(e => e.name);
      const fbData = fbEntries.map(e => e.value);
      const fbTrend = fbData.map((_, i) => {
        const windowVals = fbData.slice(Math.max(0, i - 2), i + 1);
        return windowVals.reduce((a, b) => a + b, 0) / windowVals.length;
      });
      const maxFb = Math.max(...fbData, 1);
      const fbConfig = getChartConfig(maxFb);

      chartsRef.current.set('feedback', new Chart(fbCanvas, {
        type: 'bar',
        data: {
          labels: fbLabels,
          datasets: [
            {
              type: 'bar',
              label: 'Feedback',
              data: fbData,
              backgroundColor: CC.teal,
              borderRadius: 4,
              borderSkipped: 'start',
              maxBarThickness: 18,
              barPercentage: 0.6,
              categoryPercentage: 0.8,
              valueLabels: 'all',
            } as any,
            {
              type: 'line',
              label: 'Trend',
              data: fbTrend,
              borderColor: CC.purple,
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 4,
              pointBackgroundColor: CC.purple,
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              tension: 0.4,
              fill: false,
            } as any,
          ]
        },
        options: {
          ...fbConfig,
          layout: { padding: { top: 12 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: any) => {
                  const base = `${ctx.dataset.label}: ${Math.round(ctx.raw)}`;
                  const rating = data.feedbackAvg.by_department[ctx.label]?.average_rating;
                  return rating ? `${base} · Avg rating ${Math.round(rating)}/10` : base;
                }
              }
            }
          },
          scales: {
            ...fbConfig.scales,
            x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } }
          }
        },
        plugins: [barValueLabels]
      }));
    }
    
    // 6. Hourly Service Check-ins (columns + 3-hour moving-average trend line, one shared axis)
    const svcHourCanvas = document.getElementById('chart-service-hourly') as HTMLCanvasElement;
    if (svcHourCanvas) {
      const formattedServiceHourLabels = SERVICE_HOURS.map(hour => formatHourLabel(parseInt(hour)));
      const movingAvg = visitorData.map((_, i) => {
        const windowVals = visitorData.slice(Math.max(0, i - 2), i + 1);
        return windowVals.reduce((a, b) => a + b, 0) / windowVals.length;
      });
      chartsRef.current.set('serviceHourly', new Chart(svcHourCanvas, {
        type: 'bar',
        data: {
          labels: formattedServiceHourLabels,
          datasets: [
            {
              type: 'bar',
              label: 'Visitors',
              data: visitorData,
              backgroundColor: CC.teal,
              borderRadius: 4,
              borderSkipped: 'start',
              maxBarThickness: 18,
              barPercentage: 0.6,
              categoryPercentage: 0.8,
              valueLabels: 'max',
            } as any,
            {
              type: 'line',
              label: '3-hr average',
              data: movingAvg,
              borderColor: CC.purple,
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 4,
              pointBackgroundColor: CC.purple,
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              tension: 0.4,
              fill: false,
            } as any,
          ]
        },
        options: {
          ...getChartConfig(maxVisitor),
          layout: { padding: { top: 12 } },
        },
        plugins: [barValueLabels]
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
            backgroundColor: [CC.blue, CC.amber, CC.red], 
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
                label: (ctx: any) => `${ctx.label}: ${Math.round(ctx.raw)}`
              }
            }
          }
        }
      }));
    }

    // 8. Services Distribution Donut (share by department)
    const svcDonutCanvas = document.getElementById('chart-services-donut') as HTMLCanvasElement;
    if (svcDonutCanvas && serviceShare.length) {
      const svcTotal = serviceShare.reduce((sum, s) => sum + s.value, 0) || 1;
      chartsRef.current.set('servicesDonut', new Chart(svcDonutCanvas, {
        type: 'doughnut',
        data: {
          labels: serviceShare.map(s => s.name),
          datasets: [{
            data: serviceShare.map(s => s.value),
            backgroundColor: serviceShare.map((_, i) => DONUT_COLORS[i]),
            // 2px surface-color gap between segments instead of a drawn border
            borderWidth: 2,
            borderColor: '#ffffff',
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
                label: (ctx: any) => `${ctx.label}: ${Math.round(ctx.raw)} (${Math.round((ctx.raw / svcTotal) * 100)}%)`
              }
            }
          }
        }
      }));
    }
  }, [data, CC, serviceShare, DONUT_COLORS]);
  
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
          break;

        case 'services-detail':
          // Services by department detailed view
          response = await statisticsService.getServiceDeliveryStats();
          console.log('Services detail response:', response);
          if (response && response.success && response.data) {
            // Transform department data for display (all services, not just in-house)
            const deptData = Object.entries(response.data.by_department_total || response.data.by_department || {}).map(([dept, count]) => ({
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
                backgroundColor: CC.blue,
                borderRadius: 4,
                borderSkipped: 'start',
                maxBarThickness: 24,
                barPercentage: 0.6,
                categoryPercentage: 0.8,
                label: 'Services',
                valueLabels: 'all',
              } as any]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context: any) => {
                      const value = Math.round(context.raw);
                      return `Total services: ${value}`;
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
                    callback: (value: any) => Math.round(Number(value)).toString(),
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
            },
            plugins: [barValueLabels]
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
                borderColor: CC.teal,
                backgroundColor: CC.tealSoft,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                borderWidth: 3,
                pointBackgroundColor: CC.teal,
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
                      const value = Math.round(context.raw);
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
                    callback: (value: any) => Math.round(Number(value)).toString(),
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
  const avgRating = data ? Math.round(data.feedbackAvg.overall_average.average_rating) : 0;
  const driverTotal = data ? data.parkingStats.by_driver_type.staff + data.parkingStats.by_driver_type.visitor + data.parkingStats.by_driver_type.regular : 0;
  const maxStaff = data ? Math.max(...data.departments.map(d => d.staff), 1) : 1;
  
  // Get color based on rating
  const getRatingColor = (rating: number) => {
    if (rating >= 9) return 'text-emerald-600';
    if (rating >= 7) return 'text-blue-600';
    if (rating >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  // Visible data for expandable tables
  const visibleDepartments = showAllDepartments
    ? data?.departments
    : data?.departments?.slice((departmentPage - 1) * departmentLimit, departmentPage * departmentLimit);
  const visibleRatings = showAllRatings ? data?.departments : data?.departments?.slice(0, 5);
  
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
      {/* Scopes the soft rounded dashboard theme to this page only (globals.css .cok-mayor-dash) */}
      <div className="cok-mayor-dash">
      {/* CoK design-rule page header for the mayor account */}
      {isMayor && (
        <div className="px-4 pt-4 pb-3">
          <h1
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: '-0.5px',
              color: '#34A8DB',
              margin: 0,
            }}
          >
            Dashboard
          </h1>
          <p
            className="text-sm text-gray-500"
            style={{ fontFamily: "'Merriweather', serif", margin: '4px 0 0 0' }}
          >
            City overview  services, parking, employees and feedback
          </p>
        </div>
      )}

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
      
      {/* Main Content */}
      <div className="p-3 space-y-2.5">
        
        {/* Departments vs services  mirrored comparison of staff headcount and workload per employee */}
        <div className="bg-white border border-gray-200 p-4 sm:p-5 rounded-lg shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-base font-bold text-gray-900">Departments vs services</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Staff headcount against services handled per employee · today
              </div>
            </div>
            <button className="text-gray-400 text-lg leading-none">⋯</button>
          </div>

          {deptVsServices.length === 0 ? (
            <div className="h-40 w-full flex items-center justify-center text-xs text-gray-400">
              No department data available yet
            </div>
          ) : (
            <div>
              {/* Column headers, underlined in their series color like the reference design */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="flex-1 flex items-center gap-2 pb-2 border-b-[3px]"
                  style={{ borderColor: CC.amber }}
                >
                  <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: CC.amber }}>
                    Departments
                  </span>
                  <span className="text-xs text-gray-500">(employees)</span>
                </div>
                <div
                  className="flex-1 flex items-center justify-end gap-2 pb-2 border-b-[3px]"
                  style={{ borderColor: CC.blue }}
                >
                  <span className="text-xs text-gray-500">(avg # per employee)</span>
                  <span className="text-sm font-extrabold tracking-wide uppercase" style={{ color: CC.blue }}>
                    Services
                  </span>
                </div>
              </div>

              {/* Mirrored rows: orange bars grow left from the center divider, blue bars grow right.
                  Bars sit on a soft full-width track; a white-fade gradient gives them depth. */}
              <div className="space-y-3">
                {deptVsServices.map(row => (
                  <div
                    key={row.name}
                    className="flex items-center py-0.5 rounded-md hover:bg-gray-50 transition-colors"
                    title={`${row.name}: ${row.staff} employees · ${row.services} services · ${row.avg} per employee`}
                  >
                    <div className="flex-1 flex items-center gap-2.5 min-w-0">
                      <span className="w-40 sm:w-48 flex-shrink-0 text-right text-[13px] font-medium text-gray-700 truncate">
                        {row.name} <span className="text-gray-400 font-normal">({row.staff})</span>
                      </span>
                      <div className="flex-1 h-6 bg-gray-100/80 rounded-l-lg flex justify-end overflow-hidden">
                        <div
                          className="h-full flex items-center pl-2 shadow-sm"
                          style={{
                            width: `${Math.round((row.staff / maxDeptStaff) * 100)}%`,
                            minWidth: row.staff > 0 ? 26 : 0,
                            backgroundColor: CC.amber,
                            backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.08), rgba(255,255,255,0.28))',
                            borderRadius: '6px 0 0 6px',
                          }}
                        >
                          {row.staff > 0 && (
                            <span className="text-[11px] font-bold text-white leading-none drop-shadow-sm">{row.staff}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className="w-[3px] self-stretch rounded-full mx-1 flex-shrink-0"
                      style={{ background: `linear-gradient(to bottom, ${CC.amber}, ${CC.blue})` }}
                    ></div>

                    <div className="flex-1 flex items-center gap-2.5 min-w-0">
                      <div className="flex-1 h-6 bg-gray-100/80 rounded-r-lg flex justify-start overflow-hidden">
                        <div
                          className="h-full flex items-center justify-end pr-2 shadow-sm"
                          style={{
                            width: `${Math.round((row.avg / maxDeptAvg) * 100)}%`,
                            minWidth: row.avg > 0 ? 30 : 0,
                            backgroundColor: CC.blue,
                            backgroundImage: 'linear-gradient(to left, rgba(0,0,0,0.08), rgba(255,255,255,0.28))',
                            borderRadius: '0 6px 6px 0',
                          }}
                        >
                          {row.avg > 0 && (
                            <span className="text-[11px] font-bold text-white leading-none drop-shadow-sm">{row.avg}</span>
                          )}
                        </div>
                      </div>
                      <span className="w-40 sm:w-48 flex-shrink-0 text-[13px] font-medium text-gray-700 truncate">
                        {row.services} services <span className="text-gray-400 font-normal">({row.avg}/emp)</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Services row — the three service visualizations side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
          <div
            onClick={() => handleCardClick('services-detail')}
            className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Services by department</div>
                <div className="text-xs text-gray-500">Total services · today</div>
              </div>
              <button className="text-gray-400 text-lg">⋯</button>
            </div>
            {hasServiceByDept ? (
              <div className="h-44 w-full">
                <canvas id="chart-services"></canvas>
              </div>
            ) : (
              <div className="h-44 w-full flex items-center justify-center text-xs text-gray-400">
                No services assigned to departments yet
              </div>
            )}
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
              <div className="flex items-center gap-1"><div className="w-2 h-2" style={{ backgroundColor: CC.teal }}></div>Visitors checked in</div>
              <div className="flex items-center gap-1"><div className="w-3 h-0.5 rounded" style={{ backgroundColor: CC.purple }}></div>3-hr average</div>
            </div>
            {hasHourlyService ? (
              <div className="h-36 w-full">
                <canvas id="chart-service-hourly"></canvas>
              </div>
            ) : (
              <div className="h-36 w-full flex items-center justify-center text-xs text-gray-400">
                No visitor check-ins recorded today
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 p-3">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Service distribution</div>
                <div className="text-xs text-gray-500">Share by department · {data.serviceStats.total} total</div>
              </div>
              <button className="text-gray-400 text-lg">⋯</button>
            </div>
            {serviceShare.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-8">No services recorded yet</div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-32 h-32 flex-shrink-0">
                  <canvas id="chart-services-donut"></canvas>
                </div>
                <div className="flex-1 space-y-2 w-full">
                  {serviceShare.map((s, i) => {
                    const shareTotal = serviceShare.reduce((sum, e) => sum + e.value, 0) || 1;
                    return (
                      <div key={s.name} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 flex-shrink-0" style={{ backgroundColor: DONUT_COLORS[i] }}></div>
                          <span className="truncate text-gray-600">{s.name}</span>
                        </div>
                        <div className="font-semibold text-gray-900 whitespace-nowrap">
                          {s.value} <span className="text-gray-400 font-normal">({Math.round((s.value / shareTotal) * 100)}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
                
                {/* Employees per department */}
                <div className="grid grid-cols-1 gap-2.5">
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
                      <div className="text-sm font-semibold text-gray-900">Department overview</div>
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
                          const staffPercent = Math.round((row.staff / maxStaff) * 100);
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
                              <td className={`py-2 px-2 font-semibold ${getRatingColor(row.rating)}`}>{row.rating}/10</td>
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
                        <div className="font-semibold">{data.parkingStats.by_driver_type.staff} <span className="text-gray-400 text-xs">({driverTotal ? Math.round(data.parkingStats.by_driver_type.staff / driverTotal * 100) : 0}%)</span></div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-teal-600"></div>Visitor</div>
                        <div className="font-semibold">{data.parkingStats.by_driver_type.visitor} <span className="text-gray-400 text-xs">({driverTotal ? Math.round(data.parkingStats.by_driver_type.visitor / driverTotal * 100) : 0}%)</span></div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-yellow-500"></div>Regular</div>
                        <div className="font-semibold">{data.parkingStats.by_driver_type.regular} <span className="text-gray-400 text-xs">({driverTotal ? Math.round(data.parkingStats.by_driver_type.regular / driverTotal * 100) : 0}%)</span></div>
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
                
                {/* Emergency Cars */}
                <div className="bg-white border border-gray-200 p-3">
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-gray-900">Emergency cars</div>
                    <div className="text-xs text-gray-500">Active vs expired status</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="text-xl font-light text-teal-600">{data.emergencyCars.active}</div>
                      <div className="text-xs text-gray-500">Active</div>
                      <div className="h-1 bg-gray-100 mt-1">
                        <div className="h-full bg-teal-600" style={{ width: `${data.emergencyCars.total > 0 ? Math.round(data.emergencyCars.active / data.emergencyCars.total * 100) : 0}%` }}></div>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">{data.emergencyCars.total > 0 ? Math.round(data.emergencyCars.active / data.emergencyCars.total * 100) : 0}% of fleet</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-light text-red-600">{data.emergencyCars.expired}</div>
                      <div className="text-xs text-gray-500">Expired</div>
                      <div className="h-1 bg-gray-100 mt-1">
                        <div className="h-full bg-red-600" style={{ width: `${data.emergencyCars.total > 0 ? Math.round(data.emergencyCars.expired / data.emergencyCars.total * 100) : 0}%` }}></div>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">{data.emergencyCars.total > 0 ? Math.round(data.emergencyCars.expired / data.emergencyCars.total * 100) : 0}% of fleet</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 text-center">
                    <div><div className="text-sm font-semibold">{data.emergencyCars.active_vehicles_count}</div><div className="text-[10px] text-gray-400">Active vehicles</div></div>
                    <div><div className="text-sm font-semibold">{data.emergencyCars.history_vehicles_count}</div><div className="text-[10px] text-gray-400">In history</div></div>
                    <div><div className="text-sm font-semibold">{data.emergencyCars.total}</div><div className="text-[10px] text-gray-400">Total</div></div>
                  </div>
                </div>
                
                {/* Avg Feedback Rating */}
                <div className="bg-white border border-gray-200 p-3">
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-gray-900">Avg feedback rating</div>
                    <div className="text-xs text-gray-500">By department · out of 10</div>
                  </div>
                  <div className="space-y-2">
                    {visibleRatings?.map((dept, idx) => {
                      const barWidth = Math.round(dept.rating / 10 * 100);
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                  <div className="flex items-center gap-1"><div className="w-2 h-2" style={{ backgroundColor: CC.teal }}></div>Feedback count</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-0.5 rounded" style={{ backgroundColor: CC.purple }}></div>Trend</div>
                </div>
                {hasFeedbackByDept ? (
                  <div className="h-40 w-full">
                    <canvas id="chart-feedback"></canvas>
                  </div>
                ) : (
                  <div className="h-40 w-full flex items-center justify-center text-xs text-gray-400">
                    No feedback submitted yet
                  </div>
                )}
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
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4"
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
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-600"></div>Total services</div>
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
            </div>
          </div>
        </div>
      )}
      </div>
    </MainLayout>
  );
};

export default Overview;