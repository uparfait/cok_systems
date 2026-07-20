import React, { useRef, useEffect, useState } from 'react';
import { statisticsService, employeeService, serviceDeliveryService } from '../../../../../core/services/adminService';
import LoadingSpinner from '../../../../../core/components/LoadingSpinner';
import { FiFilter, FiTrendingUp, FiUsers, FiClock, FiCheckCircle, FiAlertTriangle, FiBarChart, FiPieChart, FiCalendar, FiDownload, FiSearch } from 'react-icons/fi';

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const TERTIARY = "#CDB896";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

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
      <div className="flex items-center justify-between"><div><h1 className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Reports: {reportData.departmentName}</h1><p className="text-xs mt-0.5" style={{ color: GRAY_DISABLED }}>{reportData.currentMonth}</p></div>
        <div className="flex gap-2"><select value={dateRange} onChange={e => setDateRange(e.target.value)} className="px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#056daa]" style={{ fontFamily: fontHeading, fontSize: '14px', background: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}><option value="today">Today</option><option value="this_week">This Week</option><option value="this_month">This Month</option><option value="last_month">Last Month</option><option value="all">All Time</option></select>
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 px-3 py-1.5 bg-transparent text-[13px] font-semibold uppercase transition-colors hover:bg-[rgba(5,109,170,0.08)]" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}><FiFilter className="w-3.5 h-3.5" />Filters</button></div></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ label: 'Total Services', value: reportData.totalServices, icon: FiBarChart, bg: 'bg-[rgba(5,109,170,0.1)]', color: 'text-[#056daa]' },{ label: 'Checked In Today', value: reportData.checkedInToday, icon: FiUsers, bg: 'bg-[rgba(76,175,80,0.12)]', color: 'text-[#4CAF50]' },{ label: 'Pending', value: reportData.pendingServices, icon: FiClock, bg: 'bg-[rgba(243,156,18,0.12)]', color: 'text-[#F39C12]' },{ label: 'Completed', value: reportData.completedServices, icon: FiCheckCircle, bg: 'bg-[rgba(41,128,185,0.12)]', color: 'text-[#2980B9]' }].map((s, i) => (
          <div key={i} className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}><div className="flex items-start justify-between"><div><p className={`text-xs ${s.color}`} style={{ fontFamily: fontHeading }}>{s.label}</p><p className={`text-xl font-bold mt-0.5 ${s.color}`} style={{ fontFamily: fontHeading }}>{s.value}</p></div><div className={`w-10 h-10 ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div></div></div>
        ))}
      </div>

      <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
        <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}><FiTrendingUp className="w-4 h-4 text-[#056daa]" />Employee Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full"><thead className="bg-[#F7F9FB]"><tr>{['Employee','Services','Avg Time'].map(h => <th key={h} className="text-left text-[13px] font-semibold uppercase px-3 py-2 tracking-[0.5px]" style={{ fontFamily: fontHeading, color: TERTIARY }}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-[#E0E0E0]">{reportData.employeePerformance.slice(0, 10).map((e, i) => <tr key={i} className="hover:bg-gray-50"><td className="px-3 py-2 text-sm text-[#333333]">{e.name}</td><td className="px-3 py-2 text-sm text-[#555555]">{e.services}</td><td className="px-3 py-2 text-sm text-[#555555]">{e.avgTime} min</td></tr>)}
              {reportData.employeePerformance.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-[#9E9E9E]">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}><h3 className="text-[13px] font-semibold uppercase mb-3 flex items-center gap-2 tracking-[0.5px]" style={{ fontFamily: fontHeading, color: TERTIARY }}><FiAlertTriangle className="w-4 h-4 text-[#F39C12]" />Workload Analysis</h3>
          {reportData.overloadedEmployees.length > 0 ? <div className="space-y-2">{reportData.overloadedEmployees.map((e, i) => <div key={i} className="flex items-center justify-between p-2 bg-[#F7F9FB]"><div className="flex items-center gap-2"><div className="w-7 h-7 bg-[rgba(5,109,170,0.1)] flex items-center justify-center text-[#056daa] text-xs font-bold">{e.name.charAt(0)}</div><div><p className="text-xs font-medium text-[#333333]">{e.name}</p><p className="text-xs text-[#9E9E9E]">{e.title}</p></div></div><span className={`text-xs px-2 py-0.5 ${e.status === 'overloaded' ? 'bg-[rgba(231,76,60,0.12)] text-[#E74C3C]' : e.status === 'at-risk' ? 'bg-[rgba(243,156,18,0.12)] text-[#F39C12]' : 'bg-[rgba(76,175,80,0.12)] text-[#4CAF50]'}`}>{e.activeTasks} tasks</span></div>)}</div> : <p className="text-xs text-[#9E9E9E] py-4 text-center">No workload data</p>}
        </div>
        <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}><h3 className="text-[13px] font-semibold uppercase mb-3 flex items-center gap-2 tracking-[0.5px]" style={{ fontFamily: fontHeading, color: TERTIARY }}><FiPieChart className="w-4 h-4 text-[#2980B9]" />Service Distribution</h3>
          {reportData.serviceDistribution.length > 0 ? <div className="space-y-2">{reportData.serviceDistribution.map((s, i) => <div key={i}><div className="flex justify-between text-xs mb-1"><span className="text-[#555555]">{s.name}</span><span className="text-[#9E9E9E]">{s.percentage}%</span></div><div className="w-full bg-[#E0E0E0] h-2"><div className="h-2" style={{ width: `${s.percentage}%`, backgroundColor: s.color }}></div></div></div>)}</div> : <p className="text-xs text-[#9E9E9E] py-4 text-center">No distribution data</p>}
        </div>
      </div>
    </div>
  );
};

export default ReportsTab;