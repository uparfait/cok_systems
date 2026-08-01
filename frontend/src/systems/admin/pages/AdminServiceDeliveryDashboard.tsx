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
import { FiUsers, FiUserPlus, FiClock, FiCheckCircle, FiRefreshCw, FiSearch, FiDownload, FiLoader } from 'react-icons/fi';
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

  // Export dialog: all visitors or a custom check-in date range
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportMode, setExportMode] = useState<'all' | 'range'>('all');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exporting, setExporting] = useState(false);

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

  // Fetches its own visitors at export time (dashboard state only holds the first
  // pages), optionally filtered to a check-in date range
  const handleExportPDF = useCallback(async (opts?: { from?: string; to?: string }) => {
    setExporting(true);
    try {
      const r: any = await serviceDeliveryService.getAll(1, 1000, 'all');
      let records: Visitor[] = Array.isArray(r?.data) ? r.data : [];
      if (opts?.from) records = records.filter(v => v.entry_date && new Date(v.entry_date) >= new Date(opts.from!));
      if (opts?.to) records = records.filter(v => v.entry_date && new Date(v.entry_date) <= new Date(opts.to + 'T23:59:59'));

      const doc = new jsPDF('l', 'mm', 'a4');
      const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
      let y = 10;
      // Full-width report banner (Republic of Rwanda · City of Kigali), same as the attendance reports
      try {
        const res = await fetch('/LOGO_COK_report.png');
        if (res.ok) {
          const blob = await res.blob();
          const dataUrl: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const logoW = pw - 20;
          const logoH = logoW * (221 / 1116); // original banner is 1116x221 px
          doc.addImage(dataUrl, 'PNG', 10, y, logoW, logoH);
          y += logoH + 10;
        }
      } catch (e) { /* render without the banner if it fails to load */ }
      doc.setFont('helvetica', 'bold');
      const now = new Date();
      doc.setFontSize(9); doc.setTextColor(0, 0, 0); doc.text(now.toLocaleDateString(), pw / 2, y, { align: 'center' }); y += 5;
      doc.text(now.toLocaleTimeString(), pw / 2, y, { align: 'center' }); y += 10;
      doc.setFontSize(16); doc.setTextColor(41, 95, 115);
      const t = 'CURRENT VISITORS REPORT'; doc.text(t, pw / 2, y, { align: 'center' });
      doc.setDrawColor(41, 95, 115); doc.setLineWidth(0.8); doc.line((pw - doc.getTextWidth(t)) / 2 - 5, y + 2, (pw + doc.getTextWidth(t)) / 2 + 5, y + 2); y += 8;
      // ASCII only — jsPDF's built-in fonts garble unsupported unicode chars
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
      const scope = opts?.from || opts?.to
        ? `Period: ${opts?.from || 'start'} to ${opts?.to || 'today'} (${records.length} visitors)`
        : `All visitors (${records.length})`;
      doc.text(scope, pw / 2, y, { align: 'center' }); y += 10;

      if (records.length > 0) {
        const rows = records.map(v => [
          v.full_name || v.name || v.visitorName || '___',
          getDeptName(v),
          getStaff(v),
          v.badge_number || '___',
          v.entry_date ? new Date(v.entry_date).toLocaleString() : '___',
          v.exist_date ? new Date(v.exist_date).toLocaleString() : '___',
          getStatus(v).text,
        ]);
        autoTable(doc, {
          startY: y,
          head: [['Visitor Name', 'Department', 'Staff', 'Badge', 'Check-in', 'Check-out', 'Status']],
          body: rows,
          theme: 'grid',
          headStyles: { fillColor: [41, 95, 115], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', halign: 'center', cellPadding: 4 },
          bodyStyles: { fontSize: 8, cellPadding: 3, halign: 'center' },
          margin: { left: (pw - 280) / 2, right: (pw - 280) / 2 },
          tableWidth: 280,
          didDrawPage: (data) => { doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(10, ph - 15, pw - 10, ph - 15); doc.setFontSize(7); doc.setTextColor(128, 128, 128); doc.text('City of Kigali - Service Delivery Management System', pw / 2, ph - 12, { align: 'center' }); doc.text(`Page ${data.pageNumber}`, pw - 10, ph - 12, { align: 'right' }); },
        });
      } else {
        doc.setFontSize(11); doc.setTextColor(100, 100, 100);
        doc.text('No visitors found for this period', pw / 2, y + 30, { align: 'center' });
      }
      doc.save(`Service_Delivery_Visitors_${now.toISOString().split('T')[0]}.pdf`);
      setShowExportDialog(false);
    } catch (e) {
      showError('Failed to export visitors report');
    } finally {
      setExporting(false);
    }
  }, [showError]);

  if (authLoading) return <div className="flex items-center justify-center min-h-[600px]"><LoadingSpinner message="Loading..." /></div>;

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div><h1 className="text-sm font-bold text-gray-900 flex items-center gap-2"><HiOutlineClipboardList className="w-5 h-5 text-blue-600" />Manage and monitor visitor services</h1></div>
          <div className="flex gap-2">
            <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"><FiRefreshCw className="w-3.5 h-3.5" />Refresh</button>
            <button onClick={() => { setExportMode('all'); setShowExportDialog(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"><FiDownload className="w-3.5 h-3.5" />Export PDF</button>
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
          {loading && firstLoad ? <div className="h-48 flex items-center justify-center"><div className="h-6 w-6 " /> <FiLoader className='animate-spin h-6 w-6 text-blue-600' /> </div>
            : <div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={hourlyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hour" tickFormatter={(v: number) => `${v}:00`} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="visitors_checked_in" stroke="#10b981" fill="rgba(16,185,129,0.1)" name="Visitors" /></AreaChart></ResponsiveContainer></div>}
        </div>

        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="px-4 py-3  flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Current Visitors</h2>
            <button onClick={() => { setExportMode('all'); setShowExportDialog(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"><FiDownload className="w-3 h-3" />Export PDF</button>
          </div>
          <div className="px-4 py-2 bg-gray-50 flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px] relative"><FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" /><input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 border border-gray-300 text-sm" /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 text-sm"><option value="all">All</option><option value="inside">Inside</option><option value="left">Checked Out</option></select>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full"><thead className="bg-blue-600 sticky top-0 z-10"><tr>{['Visitor Name', 'Department', 'Staff', 'Badge', 'Check-in', 'Check-out', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-white/95 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y">{loading ? <tr><td colSpan={7} className="px-3 py-6 text-center"><div className="h-6 w-6 mx-auto" >< FiLoader className='animate-spin h-6 w-6 text-blue-600' /> </div></td></tr>
                : filteredVisitors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((v, i) => { const st = getStatus(v); return <tr key={v._id || i} className="hover:bg-gray-50"><td className="px-3 py-2.5 text-sm font-medium text-gray-900">{v.full_name || v.name || v.visitorName || '___'}</td><td className="px-3 py-2.5 text-xs text-gray-600">{getDeptName(v)}</td><td className="px-3 py-2.5 text-xs"><span className={getStaff(v).includes('Not') ? 'text-orange-500' : 'text-gray-600'}>{getStaff(v)}</span></td><td className="px-3 py-2.5 text-xs text-gray-600">{v.badge_number || '___'}</td><td className="px-3 py-2.5 text-xs text-gray-600">{v.entry_date ? new Date(v.entry_date).toLocaleString() : '___'}</td><td className="px-3 py-2.5 text-xs text-gray-600">{v.exist_date ? new Date(v.exist_date).toLocaleString() : (v.is_still_inhouse ? '-' : '___')}</td><td className="px-3 py-2.5"><span className={`text-xs px-2 py-0.5 font-medium ${st.color === 'green' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{st.text}</span></td></tr>; })}
              </tbody>
            </table>
          </div>
          {filteredVisitors.length > 0 && <div className="px-4 py-3 border-t flex items-center justify-between text-xs"><span>Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredVisitors.length)} of {filteredVisitors.length}</span><div className="flex gap-1">{Array.from({ length: Math.ceil(filteredVisitors.length / itemsPerPage) }, (_, i) => i + 1).slice(Math.max(0, currentPage - 3), Math.min(Math.ceil(filteredVisitors.length / itemsPerPage), currentPage + 2)).map(p => <button key={p} onClick={() => setCurrentPage(p)} className={`px-2.5 py-1 border text-xs ${currentPage === p ? 'bg-blue-600 text-white border-green-600' : 'border-gray-300 hover:bg-gray-50'}`}>{p}</button>)}</div></div>}
        </div>

        {/* Export dialog: all visitors or a custom check-in date range */}
        {showExportDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(51,51,51,0.5)' }} onClick={() => !exporting && setShowExportDialog(false)}>
            <div className="bg-white w-full max-w-md border border-gray-200 shadow-lg" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Export visitors report">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-900">Export Visitors Report</h3>
                <button onClick={() => setShowExportDialog(false)} disabled={exporting} className="px-2 py-1 text-gray-500 hover:bg-gray-50 border border-gray-200 text-xs">✕</button>
              </div>
              <div className="p-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="sd-export-mode" checked={exportMode === 'all'} onChange={() => setExportMode('all')} />
                  All visitors
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="sd-export-mode" checked={exportMode === 'range'} onChange={() => setExportMode('range')} />
                  Custom date range (check-in date)
                </label>
                {exportMode === 'range' && (
                  <div className="flex flex-wrap items-center gap-3 pl-6">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500" htmlFor="sd-export-from">From</label>
                      <input id="sd-export-from" type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} className="h-8 px-2 text-sm border border-gray-300" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500" htmlFor="sd-export-to">To</label>
                      <input id="sd-export-to" type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} className="h-8 px-2 text-sm border border-gray-300" />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
                <button onClick={() => setShowExportDialog(false)} disabled={exporting} className="px-4 py-2 text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button
                  onClick={() => handleExportPDF(exportMode === 'range' ? { from: exportFrom || undefined, to: exportTo || undefined } : undefined)}
                  disabled={exporting || (exportMode === 'range' && !exportFrom && !exportTo)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? <FiLoader className="w-3.5 h-3.5 animate-spin" /> : <FiDownload className="w-3.5 h-3.5" />}
                  {exporting ? 'Exporting…' : 'Export PDF'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminServiceDeliveryDashboard;