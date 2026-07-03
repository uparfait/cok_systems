import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { statisticsService, serviceDeliveryService, departmentService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { useToast } from '../../../core/contexts/ToastContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FiUsers, FiUserPlus, FiClock, FiCheckCircle, FiRefreshCw, FiSearch, FiDownload } from 'react-icons/fi';
import { HiOutlineClipboardList } from 'react-icons/hi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Visitor { _id: string; full_name?: string; name?: string; visitorName?: string; telephone?: string; phone?: string; badge_number?: string; departments_assigned?: Array<{ department_id: string; department_name: string; assigned_time: Date; reached_in: boolean; provider_name?: string; provider_id?: string }>; services_status?: Array<{ department_name: string; department_id: string; provider_name?: string; provider_id?: string; s_type: string }>; entry_date?: string; exist_date?: string; is_still_inhouse?: boolean; }
interface HourlyData { hour: number; visitors_checked_in: number; }
interface ServiceDeliveryStats { total: number; inhouse: number; completed: number; by_status: { [key: string]: number }; by_department: { [key: string]: number }; }

const AdminServiceDeliveryDashboard: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const { socket, isConnected } = useSocket();
  const [loading, setLoading] = useState(true);
  const [firstLoad, setfirstLoad] = useState(true);
  const [departmentCount, setDepartmentCount] = useState(0);
  const [stats, setStats] = useState<ServiceDeliveryStats>({ total: 0, inhouse: 0, completed: 0, by_status: {}, by_department: {} });
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const hourlyRes = await statisticsService.getHourlyServiceDeliveryStats();
      setHourlyData(hourlyRes?.data?.hourly || hourlyRes?.hourly || []);
      const statsRes = await statisticsService.getServiceDeliveryStats();
      setStats(statsRes?.data || statsRes || {});
      const deptRes = await departmentService.getAll();
      const departments = deptRes?.data || deptRes || [];
      setDepartmentCount(Array.isArray(departments) ? departments.filter((d: any) => d.status !== 'inactive').length : 0);
      const [insideRes, leftRes] = await Promise.all([serviceDeliveryService.getAll(1, 100, true), serviceDeliveryService.getAll(1, 100, false)]);
      setVisitors([...(insideRes?.data || []), ...(leftRes?.data || [])]);
    } catch (error) { showError('Failed to load data'); }
    finally { setLoading(false); setfirstLoad(false); }
  }, [showError]);

  useEffect(() => { if (!authLoading && !isAuthenticated) navigate('/login'); }, [authLoading, isAuthenticated, navigate]);
  useEffect(() => { if (isAuthenticated && !authLoading) fetchData(); }, [isAuthenticated, authLoading, fetchData]);
  useEffect(() => { if (!socket || !isConnected) return; socket.on('visitor_checkedin', () => fetchData()); socket.on('visitor_checkedout', () => fetchData()); return () => { socket.off('visitor_checkedin'); socket.off('visitor_checkedout'); }; }, [socket, isConnected, fetchData]);

  const filteredVisitors = visitors.filter(v => { const n = v.full_name || v.name || v.visitorName || ''; const ms = !searchQuery || n.toLowerCase().includes(searchQuery.toLowerCase()) || (v.telephone || v.phone || '').toLowerCase().includes(searchQuery.toLowerCase()); const ms2 = statusFilter === 'all' || (statusFilter === 'inside' && v.is_still_inhouse) || (statusFilter === 'left' && !v.is_still_inhouse); return ms && ms2; });
  useEffect(() => setCurrentPage(1), [searchQuery, statusFilter]);

  const getDeptName = (v: Visitor) => v.departments_assigned?.length ? (v.departments_assigned.find(d => d.reached_in)?.department_name || v.departments_assigned[0]?.department_name || '___') : 'Not Yet Assigned';
  const getStaff = (v: Visitor) => { const s = v.services_status?.find(s => s.s_type === 'Inprogress'); if (s?.provider_name) return s.provider_name; const c = v.services_status?.find(s => s.s_type === 'Completed'); if (c?.provider_name) return c.provider_name; const r = v.departments_assigned?.find(d => d.reached_in); if (r?.provider_name) return r.provider_name; return v.departments_assigned?.length ? 'Not Yet Served' : 'Not Yet Assigned'; };
  const getStatus = (v: Visitor) => v.is_still_inhouse ? { text: 'Inside', color: 'green' } : { text: 'Checked Out', color: 'gray' };

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    let y = 15;
    try { doc.addImage('/LOGO_COK.png', 'PNG', (pw - 40) / 2, y, 40, 40); y += 48; } catch (e) { }
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text('REPUBLIC OF RWANDA', pw / 2, y, { align: 'center' }); y += 7;
    doc.setFontSize(12); doc.text('CITY OF KIGALI', pw / 2, y, { align: 'center' }); y += 12;
    const now = new Date();
    doc.setFontSize(9); doc.text(now.toLocaleDateString(), pw / 2, y, { align: 'center' }); y += 5;
    doc.text(now.toLocaleTimeString(), pw / 2, y, { align: 'center' }); y += 12;
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 255);
    doc.text('SERVICE DELIVERY VISITORS REPORT', pw / 2, y, { align: 'center' }); y += 15;
    if (filteredVisitors.length > 0) {
      const rows = filteredVisitors.slice(0, 200).map(v => [v.full_name || v.name || v.visitorName || '___', getDeptName(v), getStaff(v), v.badge_number || '___', v.entry_date ? new Date(v.entry_date).toLocaleString() : '___', v.exist_date ? new Date(v.exist_date).toLocaleString() : '___', getStatus(v).text]);
      autoTable(doc, { startY: y, head: [['Visitor Name', 'Department', 'Staff', 'Badge', 'Check-in', 'Check-out', 'Status']], body: rows, theme: 'grid', headStyles: { fillColor: [34, 139, 34], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', halign: 'center' }, bodyStyles: { fontSize: 8, halign: 'center' }, margin: { left: (pw - 280) / 2, right: (pw - 280) / 2 }, tableWidth: 280 });
    }
    doc.save(`Service_Delivery_Visitors_${now.toISOString().split('T')[0]}.pdf`);
  }, [filteredVisitors]);

  if (authLoading) return <div className="flex items-center justify-center min-h-[600px]"><LoadingSpinner message="Loading..." /></div>;

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div><h1 className="text-sm font-bold text-gray-900 flex items-center gap-2"><HiOutlineClipboardList className="w-5 h-5 text-green-600" />Manage and monitor visitor services</h1></div>
          <div className="flex gap-2">
            <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium hover:bg-green-700"><FiRefreshCw className="w-3.5 h-3.5" />Refresh</button>
            <button onClick={handleExportPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"><FiDownload className="w-3.5 h-3.5" />Export PDF</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Visitors', value: stats.total, icon: FiUsers, color: 'text-blue-600', bg: 'bg-blue-100' },
            { label: 'Currently Inside', value: stats.inhouse, icon: FiUserPlus, color: 'text-green-600', bg: 'bg-green-100' },
            { label: 'Completed', value: stats.completed, icon: FiCheckCircle, color: 'text-purple-600', bg: 'bg-purple-100' },
            { label: 'Departments', value: departmentCount, icon: FiClock, color: 'text-orange-600', bg: 'bg-orange-100' },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-gray-500">{s.label}</p>{loading && firstLoad ? <div className="h-7 w-14 bg-gray-200 animate-pulse mt-1" /> : <p className="text-xl font-bold text-gray-900 mt-0.5">{s.value}</p>}</div>
                <div className={`w-10 h-10 ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Today's Visitor Activity</h2>
          {loading && firstLoad ? <div className="h-48 flex items-center justify-center"><div className="animate-spin h-6 w-6 border-2 border-green-500 border-t-transparent" /></div>
            : <div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={hourlyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hour" tickFormatter={(v: number) => `${v}:00`} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="visitors_checked_in" stroke="#10b981" fill="rgba(16,185,129,0.1)" name="Visitors" /></AreaChart></ResponsiveContainer></div>}
        </div>

        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Current Visitors</h2>
            <button onClick={handleExportPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium hover:bg-green-700"><FiDownload className="w-3 h-3" />Export PDF</button>
          </div>
          <div className="px-4 py-2 bg-gray-50 flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px] relative"><FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" /><input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 border border-gray-300 text-sm" /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 text-sm"><option value="all">All</option><option value="inside">Inside</option><option value="left">Checked Out</option></select>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full"><thead className="bg-gray-50 sticky top-0 z-10"><tr>{['Visitor Name', 'Department', 'Staff', 'Badge', 'Check-in', 'Check-out', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y">{loading ? <tr><td colSpan={7} className="px-3 py-6 text-center"><div className="animate-spin h-6 w-6 border-2 border-green-500 border-t-transparent mx-auto" /></td></tr>
                : filteredVisitors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((v, i) => { const st = getStatus(v); return <tr key={v._id || i} className="hover:bg-gray-50"><td className="px-3 py-2.5 text-sm font-medium text-gray-900">{v.full_name || v.name || v.visitorName || '___'}</td><td className="px-3 py-2.5 text-xs text-gray-600">{getDeptName(v)}</td><td className="px-3 py-2.5 text-xs"><span className={getStaff(v).includes('Not') ? 'text-orange-500' : 'text-gray-600'}>{getStaff(v)}</span></td><td className="px-3 py-2.5 text-xs text-gray-600">{v.badge_number || '___'}</td><td className="px-3 py-2.5 text-xs text-gray-600">{v.entry_date ? new Date(v.entry_date).toLocaleString() : '___'}</td><td className="px-3 py-2.5 text-xs text-gray-600">{v.exist_date ? new Date(v.exist_date).toLocaleString() : (v.is_still_inhouse ? '-' : '___')}</td><td className="px-3 py-2.5"><span className={`text-xs px-2 py-0.5 font-medium ${st.color === 'green' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{st.text}</span></td></tr>; })}
              </tbody>
            </table>
          </div>
          {filteredVisitors.length > 0 && <div className="px-4 py-3 border-t flex items-center justify-between text-xs"><span>Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredVisitors.length)} of {filteredVisitors.length}</span><div className="flex gap-1">{Array.from({ length: Math.ceil(filteredVisitors.length / itemsPerPage) }, (_, i) => i + 1).slice(Math.max(0, currentPage - 3), Math.min(Math.ceil(filteredVisitors.length / itemsPerPage), currentPage + 2)).map(p => <button key={p} onClick={() => setCurrentPage(p)} className={`px-2.5 py-1 border text-xs ${currentPage === p ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 hover:bg-gray-50'}`}>{p}</button>)}</div></div>}
        </div>
      </div>
    </MainLayout>
  );
};

export default AdminServiceDeliveryDashboard;