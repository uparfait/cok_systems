import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import  DashboardData from '../OverviewPage';

const HOURS = ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
const SERVICE_HOURS = ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'];

const formatHourLabel = (hour: number): string => {
  const h = parseInt(hour.toString());
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
};

const cokValueLabelsPlugin = {
  id: 'cokValueLabels',
  afterDatasetsDraw(chart: any) {
    const ctx = chart.ctx;
    ctx.save();
    ctx.font = "bold 10px 'Montserrat', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chart.data.datasets.forEach((dataset: any, di: number) => {
      const meta = chart.getDatasetMeta(di);
      if (!meta || meta.hidden) return;
      meta.data.forEach((element: any, i: number) => {
        const value = Number(dataset.data[i]);
        if (!value) return;
        if (meta.type === 'doughnut' || meta.type === 'pie') {
          const pos = element.tooltipPosition ? element.tooltipPosition() : element;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(String(value), pos.x, pos.y);
        } else if (meta.type === 'bar' && chart.options.indexAxis === 'y') {
          ctx.fillStyle = '#333333';
          ctx.textAlign = 'left';
          ctx.fillText(String(value), element.x + 4, element.y);
          ctx.textAlign = 'center';
        } else if (meta.type === 'bar') {
          ctx.fillStyle = '#333333';
          ctx.fillText(String(value), element.x, element.y - 7);
        } else {
          ctx.fillStyle = '#333333';
          ctx.fillText(String(value), element.x, element.y - 9);
        }
      });
    });
    ctx.restore();
  }
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
      y: { beginAtZero: true, min: 0, max: niceMax, grid: { color: '#E0E0E0' }, ticks: { stepSize, callback: (v: any) => Number(v).toString(), precision: 0 }, title: { display: true, text: 'count', color: '#9E9E9E', font: { size: 10 } } },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } }
    }
  };
};

interface OverviewChartsProps {
  data: typeof DashboardData;
}

const OverviewCharts: React.FC<any> = ({ data }) => {
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
            { label: 'Check-in', data: checkInData, borderColor: '#056daa', backgroundColor: 'rgba(5,109,170,0.05)', fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2, pointBackgroundColor: '#056daa', pointBorderColor: '#fff', pointBorderWidth: 1 },
            { label: 'Check-out', data: checkOutData, borderColor: '#F39C12', backgroundColor: 'rgba(243,156,18,0.05)', fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2, borderDash: [5, 3], pointBackgroundColor: '#F39C12', pointBorderColor: '#fff', pointBorderWidth: 1 }
          ]
        },
        options: getChartConfig(maxParking),
        plugins: [cokValueLabelsPlugin]
      }));
    }

    const svcCanvas = document.getElementById('chart-services') as HTMLCanvasElement;
    if (svcCanvas && deptNames.length) {
      const svcTotal = deptNames.map(name => data.serviceStats.by_department[name] || 0);
      const maxSvc = Math.max(...svcTotal, 1);
      chartsRef.current.set('services', new Chart(svcCanvas, {
        type: 'bar',
        data: { labels: deptNames, datasets: [{ label: 'Total Visitors', data: svcTotal, backgroundColor: '#056daa', barPercentage: 0.6, categoryPercentage: 0.8 }] },
        options: { ...getChartConfig(maxSvc), indexAxis: 'y', scales: { x: { ...getChartConfig(maxSvc).scales.x, ticks: { callback: (v: any) => Number(v).toString(), stepSize: 1 } }, y: { grid: { display: false } } } },
        plugins: [cokValueLabelsPlugin]
      }));
    }

    const empCanvas = document.getElementById('chart-employees') as HTMLCanvasElement;
    if (empCanvas && deptNames.length) {
      const empData = data.departments.map(d => d.staff);
      const maxEmp = Math.max(...empData, 1);
      chartsRef.current.set('employees', new Chart(empCanvas, {
        type: 'bar',
        data: { labels: deptNames, datasets: [{ data: empData, backgroundColor: '#2980B9', barPercentage: 0.6, label: 'Employees' }] },
        options: { ...getChartConfig(maxEmp), indexAxis: 'y', scales: { x: { ...getChartConfig(maxEmp).scales.x, ticks: { callback: (v: any) => Number(v).toString(), stepSize: 1 } }, y: { grid: { display: false } } } },
        plugins: [cokValueLabelsPlugin]
      }));
    }

    const donutCanvas = document.getElementById('chart-donut') as HTMLCanvasElement;
    if (donutCanvas) {
      const driverData = data.parkingStats.by_driver_type;
      chartsRef.current.set('donut', new Chart(donutCanvas, {
        type: 'doughnut',
        data: { labels: ['Staff', 'Visitor', 'Regular'], datasets: [{ data: [driverData.staff, driverData.visitor, driverData.regular], backgroundColor: ['#056daa', '#4CAF50', '#F39C12'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${Number(ctx.raw)}` } } } },
        plugins: [cokValueLabelsPlugin]
      }));
    }

    const fbCanvas = document.getElementById('chart-feedback') as HTMLCanvasElement;
    if (fbCanvas && deptNames.length) {
      const fbData = data.departments.map(d => d.feedback);
      const maxFb = Math.max(...fbData, 1);
      chartsRef.current.set('feedback', new Chart(fbCanvas, {
        type: 'bar',
        data: { labels: deptNames.map(n => n.length > 15 ? n.slice(0, 15) + '...' : n), datasets: [{ data: fbData, backgroundColor: '#2980B9', barPercentage: 0.6, label: 'Feedback' }] },
        options: getChartConfig(maxFb),
        plugins: [cokValueLabelsPlugin]
      }));
    }

    const svcHourCanvas = document.getElementById('chart-service-hourly') as HTMLCanvasElement;
    if (svcHourCanvas) {
      chartsRef.current.set('serviceHourly', new Chart(svcHourCanvas, {
        type: 'line',
        data: {
          labels: SERVICE_HOURS.map(h => formatHourLabel(parseInt(h))),
          datasets: [{ data: visitorData, borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.05)', fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2, pointBackgroundColor: '#4CAF50', pointBorderColor: '#fff', pointBorderWidth: 1, label: 'Visitors' }]
        },
        options: getChartConfig(maxVisitor),
        plugins: [cokValueLabelsPlugin]
      }));
    }

    const statusCanvas = document.getElementById('chart-status') as HTMLCanvasElement;
    if (statusCanvas) {
      chartsRef.current.set('status', new Chart(statusCanvas, {
        type: 'doughnut',
        data: { labels: ['Active', 'Inactive', 'Locked'], datasets: [{ data: [data.employeeStats.active, data.employeeStats.inactive, data.employeeStats.locked], backgroundColor: ['#056daa', '#F39C12', '#E74C3C'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${Number(ctx.raw)}` } } } },
        plugins: [cokValueLabelsPlugin]
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