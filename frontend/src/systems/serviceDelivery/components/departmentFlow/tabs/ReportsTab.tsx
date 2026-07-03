import React, { useRef, useEffect, useState } from 'react';
import { statisticsService, employeeService, serviceDeliveryService } from '../../../../../core/services/adminService';
import LoadingSpinner from '../../../../../core/components/LoadingSpinner';
import { FiFilter, FiTrendingUp, FiUsers, FiClock, FiCheckCircle, FiAlertTriangle, FiBarChart, FiPieChart, FiCalendar, FiDownload, FiSearch } from 'react-icons/fi';

interface ReportsTabProps { departmentId?: string; departmentName?: string; }

const ReportsTab: React.FC<ReportsTabProps> = ({ departmentId, departmentName }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState('this_month');
  const [searchTerm, setSearchTerm] = useState('');
  const [reportData, setReportData] = useState({
    departmentName: departmentName || 'Department',
    currentMonth: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    totalServices: 0, employeePerformance: [] as { name: string; services: number; avgTime: number }[],
    overloadedEmployees: [] as { id: number; name: string; title: string; avatar: string; activeTasks: number; status: string }[],
    serviceDistribution: [] as { name: string; percentage: number; color: string }[],
    checkedInToday: 0, pendingServices: 0, completedServices: 0, avgWaitTime: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const statsRes = await statisticsService.getServiceDeliveryStats();
        const empStatsRes = await statisticsService.getEmployeeStats();
        let visitorsData = [];
        if (departmentId) { const r = await serviceDeliveryService.getVisitorsByDepartment(departmentId); if (r.data) visitorsData = r.data; }
        else { const r = await serviceDeliveryService.getAll(); if (r.data) visitorsData = r.data; }
        let filtered = [...visitorsData];
        if (dateRange !== 'all') { const now = new Date(); let sd: Date; switch (dateRange) { case 'today': sd = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break; case 'this_week': sd = new Date(now.setDate(now.getDate() - now.getDay())); break; case 'this_month': sd = new Date(now.getFullYear(), now.getMonth(), 1); break; case 'last_month': sd = new Date(now.getFullYear(), now.getMonth() - 1, 1); break; default: sd = new Date(0); } filtered = filtered.filter((v: any) => v.createdAt && new Date(v.createdAt) >= sd); }
        if (searchTerm) { const q = searchTerm.toLowerCase(); filtered = filtered.filter((v: any) => (v.full_name || v.name || '').toLowerCase().includes(q) || (v.department_name || v.department || '').toLowerCase().includes(q)); }
        const total = filtered.length;
        const completed = filtered.filter((v: any) => v.status === 'Completed' || v.is_still_inhouse === false).length;
        const pending = total - completed;
        const checkedInToday = filtered.filter((v: any) => { const d = new Date(v.createdAt || v.entry_date); const today = new Date(); return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear(); }).length;
        const deptMap: Record<string, { count: number; totalTime: number }> = {};
        filtered.forEach((v: any) => { if (v.departments_assigned) v.departments_assigned.forEach((d: any) => { const n = d.department_name || 'Unknown'; if (!deptMap[n]) deptMap[n] = { count: 0, totalTime: 0 }; deptMap[n].count++; }); });
        const employeePerf = Object.entries(deptMap).map(([name, data]) => ({ name, services: data.count, avgTime: Math.round(data.totalTime / Math.max(data.count, 1)) }));
        setReportData(prev => ({ ...prev, totalServices: total, pendingServices: pending, completedServices: completed, checkedInToday, employeePerformance: employeePerf, avgWaitTime: pending > 0 ? Math.round(pending / Math.max(total, 1) * 30) : 0 }));
      } catch (error) { } finally { setIsLoading(false); }
    }; fetchData();
  }, [departmentId, dateRange, searchTerm]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><LoadingSpinner /></div>;

  return (
    <div ref={reportRef} className="space-y-4 p-4">
      <div className="flex items-center justify-between"><div><h1 className="text-base font-bold text-gray-800">Reports: {reportData.departmentName}</h1><p className="text-xs text-gray-500 mt-0.5">{reportData.currentMonth}</p></div>
        <div className="flex gap-2"><select value={dateRange} onChange={e => setDateRange(e.target.value)} className="px-2.5 py-1.5 border text-sm"><option value="today">Today</option><option value="this_week">This Week</option><option value="this_month">This Month</option><option value="last_month">Last Month</option><option value="all">All Time</option></select>
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 px-3 py-1.5 border text-sm hover:bg-gray-50"><FiFilter className="w-3.5 h-3.5" />Filters</button></div></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ label: 'Total Services', value: reportData.totalServices, icon: FiBarChart, bg: 'bg-blue-100', color: 'text-blue-600' },{ label: 'Checked In Today', value: reportData.checkedInToday, icon: FiUsers, bg: 'bg-green-100', color: 'text-green-600' },{ label: 'Pending', value: reportData.pendingServices, icon: FiClock, bg: 'bg-yellow-100', color: 'text-yellow-600' },{ label: 'Completed', value: reportData.completedServices, icon: FiCheckCircle, bg: 'bg-purple-100', color: 'text-purple-600' }].map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 p-4"><div className="flex items-start justify-between"><div><p className="text-xs text-gray-500">{s.label}</p><p className="text-xl font-bold text-gray-800 mt-0.5">{s.value}</p></div><div className={`w-10 h-10 ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div></div></div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 p-4">
        <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><FiTrendingUp className="w-4 h-4 text-blue-600" />Employee Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full"><thead className="bg-blue-50"><tr>{['Employee','Services','Avg Time'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-700 uppercase px-3 py-2">{h}</th>)}</tr></thead>
            <tbody className="divide-y">{reportData.employeePerformance.slice(0, 10).map((e, i) => <tr key={i} className="hover:bg-gray-50"><td className="px-3 py-2 text-sm text-gray-800">{e.name}</td><td className="px-3 py-2 text-sm text-gray-600">{e.services}</td><td className="px-3 py-2 text-sm text-gray-600">{e.avgTime} min</td></tr>)}
              {reportData.employeePerformance.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-500">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 p-4"><h3 className="text-xs font-bold text-gray-700 uppercase mb-3 flex items-center gap-2"><FiAlertTriangle className="w-4 h-4 text-orange-500" />Workload Analysis</h3>
          {reportData.overloadedEmployees.length > 0 ? <div className="space-y-2">{reportData.overloadedEmployees.map((e, i) => <div key={i} className="flex items-center justify-between p-2 bg-gray-50"><div className="flex items-center gap-2"><div className="w-7 h-7 bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">{e.name.charAt(0)}</div><div><p className="text-xs font-medium text-gray-800">{e.name}</p><p className="text-xs text-gray-500">{e.title}</p></div></div><span className={`text-xs px-2 py-0.5 ${e.status === 'overloaded' ? 'bg-red-100 text-red-700' : e.status === 'at-risk' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{e.activeTasks} tasks</span></div>)}</div> : <p className="text-xs text-gray-500 py-4 text-center">No workload data</p>}
        </div>
        <div className="bg-white border border-gray-200 p-4"><h3 className="text-xs font-bold text-gray-700 uppercase mb-3 flex items-center gap-2"><FiPieChart className="w-4 h-4 text-purple-500" />Service Distribution</h3>
          {reportData.serviceDistribution.length > 0 ? <div className="space-y-2">{reportData.serviceDistribution.map((s, i) => <div key={i}><div className="flex justify-between text-xs mb-1"><span className="text-gray-700">{s.name}</span><span className="text-gray-500">{s.percentage}%</span></div><div className="w-full bg-gray-200 h-2"><div className="h-2" style={{ width: `${s.percentage}%`, backgroundColor: s.color }}></div></div></div>)}</div> : <p className="text-xs text-gray-500 py-4 text-center">No distribution data</p>}
        </div>
      </div>
    </div>
  );
};

export default ReportsTab;