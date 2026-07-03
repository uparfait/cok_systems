import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import type { DashboardData } from '../OverviewPage';

const HOURS = ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
const SERVICE_HOURS = ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'];

const formatHourLabel = (hour: number): string => {
  const h = parseInt(hour.toString());
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
};

const getChartConfig = (maxValue: number) => {
  const range = maxValue;
  const targetSteps = 5;
  const roughStep = range / targetSteps;
  const magnitude = Math.floor(Math.log10(roughStep || 1));
  const magnitudePow = Math.pow(10, magnitude);
  const normalizedStep = (roughStep || 1) / magnitudePow;
  let niceStep = normalizedStep < 1.5 ? 1 : normalizedStep < 3.5 ? 2 : normalizedStep < 7.5 ? 5 : 10;
  const stepSize = niceStep * magnitudePow;
  const niceMax = Math.ceil(maxValue / stepSize) * stepSize;
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${Number(ctx.raw)}` } } },
    scales: {
      y: { beginAtZero: true, min: 0, max: niceMax, grid: { color: '#e5e7eb' }, ticks: { stepSize, callback: (v: any) => Number(v).toString(), precision: 0 }, title: { display: true, text: 'count', color: '#9ca3af', font: { size: 10 } } },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } }
    }
  };
};

interface OverviewChartsProps {
  data: DashboardData;
}

const OverviewCharts: React.FC<OverviewChartsProps> = ({ data }) => {
  const chartsRef = useRef<Map<string, Chart>>(new Map());

  useEffect(() => {
    chartsRef.current.forEach(c => c.destroy());
    chartsRef.current.clear();

    const deptNames = data.departments.map(d => d.name);
    const checkInData = data.hourlyParking.map(h => h.check_in);
    const checkOutData = data.hourlyParking.map(h => h.check_out);
    const visitorData = data.hourlyService.map(h => h.visitors_checked_in);
    const maxParking = Math.max(...checkInData, ...checkOutData, 1);
    const maxVisitor = Math.max(...visitorData, 1);

    const hourlyCanvas = document.getElementById('chart-hourly') as HTMLCanvasElement;
    if (hourlyCanvas) {
      chartsRef.current.set('hourly', new Chart(hourlyCanvas, {
        type: 'line',
        data: {
          labels: HOURS.map(h => formatHourLabel(parseInt(h))),
          datasets: [
            { label: 'Check-in', data: checkInData, borderColor: '#0078d4', backgroundColor: 'rgba(0,120,212,0.05)', fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2, pointBackgroundColor: '#0078d4', pointBorderColor: '#fff', pointBorderWidth: 1 },
            { label: 'Check-out', data: checkOutData, borderColor: '#e8a400', backgroundColor: 'rgba(232,164,0,0.05)', fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2, borderDash: [5, 3], pointBackgroundColor: '#e8a400', pointBorderColor: '#fff', pointBorderWidth: 1 }
          ]
        },
        options: getChartConfig(maxParking)
      }));
    }

    const svcCanvas = document.getElementById('chart-services') as HTMLCanvasElement;
    if (svcCanvas && deptNames.length) {
      const svcTotal = deptNames.map(name => data.serviceStats.by_department[name] || 0);
      const maxSvc = Math.max(...svcTotal, 1);
      chartsRef.current.set('services', new Chart(svcCanvas, {
        type: 'bar',
        data: { labels: deptNames, datasets: [{ label: 'Total Visitors', data: svcTotal, backgroundColor: '#0078d4', barPercentage: 0.6, categoryPercentage: 0.8 }] },
        options: { ...getChartConfig(maxSvc), indexAxis: 'y', scales: { x: { ...getChartConfig(maxSvc).scales.x, ticks: { callback: (v: any) => Number(v).toString(), stepSize: 1 } }, y: { grid: { display: false } } } }
      }));
    }

    const empCanvas = document.getElementById('chart-employees') as HTMLCanvasElement;
    if (empCanvas && deptNames.length) {
      const empData = data.departments.map(d => d.staff);
      const maxEmp = Math.max(...empData, 1);
      chartsRef.current.set('employees', new Chart(empCanvas, {
        type: 'bar',
        data: { labels: deptNames, datasets: [{ data: empData, backgroundColor: '#5c2d91', barPercentage: 0.6, label: 'Employees' }] },
        options: { ...getChartConfig(maxEmp), indexAxis: 'y', scales: { x: { ...getChartConfig(maxEmp).scales.x, ticks: { callback: (v: any) => Number(v).toString(), stepSize: 1 } }, y: { grid: { display: false } } } }
      }));
    }

    const donutCanvas = document.getElementById('chart-donut') as HTMLCanvasElement;
    if (donutCanvas) {
      const driverData = data.parkingStats.by_driver_type;
      chartsRef.current.set('donut', new Chart(donutCanvas, {
        type: 'doughnut',
        data: { labels: ['Staff', 'Visitor', 'Regular'], datasets: [{ data: [driverData.staff, driverData.visitor, driverData.regular], backgroundColor: ['#0078d4', '#00b294', '#e8a400'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${Number(ctx.raw)}` } } } }
      }));
    }

    const fbCanvas = document.getElementById('chart-feedback') as HTMLCanvasElement;
    if (fbCanvas && deptNames.length) {
      const fbData = data.departments.map(d => d.feedback);
      const maxFb = Math.max(...fbData, 1);
      chartsRef.current.set('feedback', new Chart(fbCanvas, {
        type: 'bar',
        data: { labels: deptNames.map(n => n.length > 15 ? n.slice(0, 15) + '...' : n), datasets: [{ data: fbData, backgroundColor: '#5c2d91', barPercentage: 0.6, label: 'Feedback' }] },
        options: getChartConfig(maxFb)
      }));
    }

    const svcHourCanvas = document.getElementById('chart-service-hourly') as HTMLCanvasElement;
    if (svcHourCanvas) {
      chartsRef.current.set('serviceHourly', new Chart(svcHourCanvas, {
        type: 'line',
        data: {
          labels: SERVICE_HOURS.map(h => formatHourLabel(parseInt(h))),
          datasets: [{ data: visitorData, borderColor: '#00b294', backgroundColor: 'rgba(0,178,148,0.05)', fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2, pointBackgroundColor: '#00b294', pointBorderColor: '#fff', pointBorderWidth: 1, label: 'Visitors' }]
        },
        options: getChartConfig(maxVisitor)
      }));
    }

    const statusCanvas = document.getElementById('chart-status') as HTMLCanvasElement;
    if (statusCanvas) {
      chartsRef.current.set('status', new Chart(statusCanvas, {
        type: 'doughnut',
        data: { labels: ['Active', 'Inactive', 'Locked'], datasets: [{ data: [data.employeeStats.active, data.employeeStats.inactive, data.employeeStats.locked], backgroundColor: ['#0078d4', '#e8a400', '#e81123'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${Number(ctx.raw)}` } } } }
      }));
    }

    return () => { chartsRef.current.forEach(c => c.destroy()); };
  }, [data]);

  useEffect(() => {
    const handleResize = () => chartsRef.current.forEach(c => c.resize());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return null;
};

export default OverviewCharts;