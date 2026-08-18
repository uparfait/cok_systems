import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import EmployeeAccountStatusCard from './sub/EmployeeAccountStatusCard';
import MayorVisitorsTimeline from './sub/MayorVisitorsTimeline';

interface Visitor { _id: string; full_name?: string; name?: string; visitorName?: string; telephone?: string; phone?: string; badge_number?: string; departments_assigned?: Array<{ department_id: string; department_name: string; assigned_time: Date; reached_in: boolean; provider_name?: string; provider_id?: string }>; services_status?: Array<{ department_name: string; department_id: string; provider_name?: string; provider_id?: string; s_type: string }>; entry_date?: string; exist_date?: string; is_still_inhouse?: boolean; }
interface HourlyData { hour: number; visitors_checked_in: number; }
interface ServiceDeliveryStats { total: number; inhouse: number; completed: number; by_status: { [key: string]: number }; by_department: { [key: string]: number }; }

// City of Kigali (CoK) institutional design constants — same set as the reservations tables
const PRIMARY = '#056daa';
const PRIMARY_HOVER = '#045d94';
const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const WARNING = '#F39C12';
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';

const initialsOf = (name: string) => (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

const AdminServiceDeliveryDashboard: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  // This dashboard is shared via /:roleSlug/service-delivery/dashboard — the mayor sees it too
  const { roleSlug } = useParams();
  const isMayor = roleSlug === 'mayor';
  const { showSuccess, showError } = useToast();
  const { socket, isConnected } = useSocket();
  const [loading, setLoading] = useState(true);
  const [firstLoad, setfirstLoad] = useState(true);
  const [departmentCount, setDepartmentCount] = useState(0);
  const [stats, setStats] = useState<ServiceDeliveryStats>({ total: 0, inhouse: 0, completed: 0, by_status: {}, by_department: {} });
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // Search box draft — applied on Enter or the Search button (clearing applies immediately)
  const [draftSearch, setDraftSearch] = useState('');
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
  // The mayor's view is only the timeline chart — skip the admin dashboard data fetches for it
  useEffect(() => { if (isAuthenticated && !authLoading && !isMayor) fetchData(); }, [isAuthenticated, authLoading, fetchData, isMayor]);
  useEffect(() => { if (!socket || !isConnected || isMayor) return; socket.on('visitor_checkedin', () => fetchData()); socket.on('visitor_checkedout', () => fetchData()); return () => { socket.off('visitor_checkedin'); socket.off('visitor_checkedout'); }; }, [socket, isConnected, fetchData, isMayor]);

  const filteredVisitors = visitors.filter(v => { const n = v.full_name || v.name || v.visitorName || ''; const ms = !searchQuery || n.toLowerCase().includes(searchQuery.toLowerCase()) || (v.telephone || v.phone || '').toLowerCase().includes(searchQuery.toLowerCase()); const ms2 = statusFilter === 'all' || (statusFilter === 'inside' && v.is_still_inhouse) || (statusFilter === 'left' && !v.is_still_inhouse); return ms && ms2; });
  useEffect(() => setCurrentPage(1), [searchQuery, statusFilter]);
  const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage);
  const paginatedVisitors = filteredVisitors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
      doc.setFontSize(16); doc.setTextColor(5, 109, 170);
      const t = 'CURRENT VISITORS REPORT'; doc.text(t, pw / 2, y, { align: 'center' });
      doc.setDrawColor(5, 109, 170); doc.setLineWidth(0.8); doc.line((pw - doc.getTextWidth(t)) / 2 - 5, y + 2, (pw + doc.getTextWidth(t)) / 2 + 5, y + 2); y += 8;
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
          headStyles: { fillColor: [5, 109, 170], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', halign: 'center', cellPadding: 4 },
          bodyStyles: { fontSize: 8, cellPadding: 3, halign: 'center' },
          margin: { left: (pw - 280) / 2, right: (pw - 280) / 2 },
          tableWidth: 280,
          didDrawPage: (data) => { doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(10, ph - 15, pw - 10, ph - 15); doc.setFontSize(7); doc.setTextColor(128, 128, 128); doc.text('City of Kigali  Service Delivery Management System', pw / 2, ph - 12, { align: 'center' }); doc.text(`Page ${data.pageNumber}`, pw - 10, ph - 12, { align: 'right' }); },
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

  // Mayor view: nothing but the filterable visitors timeline chart
  if (isMayor) {
    return (
      <MainLayout>
        <MayorVisitorsTimeline />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div><h1 className="text-sm font-bold text-[#333333] flex items-center gap-2"><HiOutlineClipboardList className="w-5 h-5 text-[#056daa]" />Manage and monitor visitor services</h1></div>
          <div className="flex gap-2">
            <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-1.5 text-white text-sm transition-colors" style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}><FiRefreshCw className="w-3.5 h-3.5" />Refresh</button>
            <button onClick={() => { setExportMode('all'); setShowExportDialog(true); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors hover:bg-[rgba(5,109,170,0.08)]" style={{ backgroundColor: '#FFFFFF', border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}><FiDownload className="w-3.5 h-3.5" />Export PDF</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Visitors', value: stats.total, icon: FiUsers, color: 'text-[#056daa]', bg: 'bg-[rgba(5,109,170,0.1)]' },
            { label: 'Currently Inside', value: stats.inhouse, icon: FiUserPlus, color: 'text-[#388E3C]', bg: 'bg-[rgba(76,175,80,0.12)]' },
            { label: 'Completed', value: stats.completed, icon: FiCheckCircle, color: 'text-[#2980B9]', bg: 'bg-[rgba(41,128,185,0.1)]' },
            { label: 'Departments', value: departmentCount, icon: FiClock, color: 'text-[#F39C12]', bg: 'bg-[rgba(243,156,18,0.12)]' },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-[#E0E0E0] p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-[#9E9E9E]">{s.label}</p>{loading && firstLoad ? <div className="h-7 w-14 bg-[#E0E0E0] animate-pulse mt-1" /> : <p className="text-xl font-bold text-[#333333] mt-0.5">{s.value}</p>}</div>
                <div className={`w-10 h-10 ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-[#E0E0E0] p-4">
          <h2 className="text-sm font-semibold text-[#333333] mb-3">Today's Visitor Activity</h2>
          {loading && firstLoad ? <div className="h-48 flex items-center justify-center"><div className="h-6 w-6 " /> <FiLoader className='animate-spin h-6 w-6 text-[#056daa]' /> </div>
            : <div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={hourlyData}><CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} /><XAxis dataKey="hour" tickFormatter={(v: number) => `${v}:00`} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 0 }} /><Area type="monotone" dataKey="visitors_checked_in" stroke="#056daa" fill="rgba(5,109,170,0.1)" name="Visitors" dot={{ r: 3 }} label={{ position: 'top', fill: '#333333', fontSize: 10, fontWeight: 600 }} /></AreaChart></ResponsiveContainer></div>}
        </div>

        <div className="bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          <div className="px-6 pt-5 flex items-center justify-between">
            <h2 className="text-sm font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Current Visitors</h2>
            <button
              onClick={() => { setExportMode('all'); setShowExportDialog(true); }}
              className="flex items-center gap-2 h-9 px-4 bg-transparent text-[12px] font-semibold uppercase transition-colors hover:bg-[rgba(5,109,170,0.08)]"
              style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
            >
              <FiDownload className="w-3.5 h-3.5" /> Export PDF
            </button>
          </div>
          {/* Search bar in the reservations-table style: full-width input with an attached solid Search button */}
          <div className="px-6 pt-4 pb-3 flex items-center gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search Name, Phone..."
                value={draftSearch}
                onChange={e => { setDraftSearch(e.target.value); if (e.target.value === '') setSearchQuery(''); }}
                onKeyDown={e => { if (e.key === 'Enter') setSearchQuery(draftSearch); }}
                className="w-full h-11 cok-auth-input pr-4 text-sm"
                style={{ fontFamily: fontHeading }}
              />
            </div>
            <button
              onClick={() => setSearchQuery(draftSearch)}
              className="h-11 px-6 text-white text-[13px] font-semibold uppercase transition-colors flex-shrink-0"
              style={{ fontFamily: fontHeading, backgroundColor: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
            >
              Search
            </button>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-11 cok-auth-input pr-3 py-2 text-sm flex-shrink-0 cursor-pointer"
              style={{ paddingLeft: '12px', fontFamily: fontHeading, color: NEUTRAL_DARK }}
            >
              <option value="all">All</option>
              <option value="inside">Inside</option>
              <option value="left">Checked Out</option>
            </select>
          </div>
          <div className="overflow-x-auto px-6">
            <table className="w-full min-w-[820px]">
              {/* Solid CoK-blue header bar — same as the reservations tables */}
              <thead className="cok-bg-primary sticky top-0 z-10 shadow-sm">
                <tr>
                  {['Visitor Name', 'Department', 'Staff', 'Badge', 'Check-in', 'Check-out', 'Status'].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs uppercase tracking-wider font-semibold text-white" style={{ fontFamily: fontHeading, letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {loading ? (
                  <tr><td colSpan={7} className="py-10 text-center"><FiLoader className="animate-spin h-6 w-6 mx-auto" style={{ color: PRIMARY }} /></td></tr>
                ) : paginatedVisitors.length > 0 ? paginatedVisitors.map((v, i) => {
                  const st = getStatus(v);
                  const name = v.full_name || v.name || v.visitorName || '___';
                  const staff = getStaff(v);
                  return (
                    <tr key={v._id || i} className="h-14 hover:bg-[#F7F9FB]">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: PRIMARY, fontFamily: fontHeading }}>
                            {initialsOf(name)}
                          </div>
                          <span className="text-[#333] text-[13px] font-medium">{name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[#555555] text-[13px]">{getDeptName(v)}</td>
                      <td className="py-3 px-3 text-[13px]" style={{ color: staff.includes('Not') ? WARNING : '#555555' }}>{staff}</td>
                      <td className="py-3 px-3 text-[#333] text-[13px] font-mono font-semibold">{v.badge_number || '—'}</td>
                      <td className="py-3 px-3 text-[#555555] text-[13px] whitespace-nowrap">{v.entry_date ? new Date(v.entry_date).toLocaleString() : '—'}</td>
                      <td className="py-3 px-3 text-[#555555] text-[13px] whitespace-nowrap">{v.exist_date ? new Date(v.exist_date).toLocaleString() : (v.is_still_inhouse ? '-' : '—')}</td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-3 py-1 text-[12px] font-bold uppercase tracking-wide" style={{ backgroundColor: st.color === 'green' ? 'rgba(76,175,80,0.12)' : 'rgba(51,51,51,0.08)', color: st.color === 'green' ? '#388E3C' : '#555555' }}>
                          {st.text}
                        </span>
                      </td>
                    </tr>
                  );
                }) : <tr><td colSpan={7} className="py-10 text-center text-[13px] text-[#9E9E9E]">No visitors found</td></tr>}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-6 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${BORDER}` }}>
              <span className="text-[12px] text-[#555555]" style={{ fontFamily: fontHeading }}>
                Page {currentPage} of {totalPages} · {filteredVisitors.length} visitors
              </span>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="px-3 py-1.5 text-[12px] font-semibold uppercase disabled:opacity-40 hover:bg-[rgba(5,109,170,0.08)]" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>Prev</button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="px-3 py-1.5 text-[12px] font-semibold uppercase disabled:opacity-40 hover:bg-[rgba(5,109,170,0.08)]" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>Next</button>
              </div>
            </div>
          )}
        </div>

        {/* Employee account status (activation / lock / online) — admin only, hidden on the mayor's view */}
        {!isMayor && <EmployeeAccountStatusCard />}

        {/* Export dialog: all visitors or a custom check-in date range */}
        {showExportDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(51,51,51,0.5)' }} onClick={() => !exporting && setShowExportDialog(false)}>
            <div className="bg-white w-full max-w-md border border-[#E0E0E0] shadow-lg" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Export visitors report">
              <div className="flex items-center justify-between p-4 border-b border-[#E0E0E0]">
                <h3 className="text-sm font-bold text-[#333333]" style={{ fontFamily: fontHeading }}>Export Visitors Report</h3>
                <button onClick={() => setShowExportDialog(false)} disabled={exporting} className="px-2 py-1 text-[#555555] hover:bg-[#F7F9FB] border border-[#E0E0E0] text-xs">✕</button>
              </div>
              <div className="p-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-[#555555]">
                  <input type="radio" name="sd-export-mode" checked={exportMode === 'all'} onChange={() => setExportMode('all')} />
                  All visitors
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-[#555555]">
                  <input type="radio" name="sd-export-mode" checked={exportMode === 'range'} onChange={() => setExportMode('range')} />
                  Custom date range (check-in date)
                </label>
                {exportMode === 'range' && (
                  <div className="flex flex-wrap items-center gap-3 pl-6">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[#9E9E9E]" htmlFor="sd-export-from">From</label>
                      <input id="sd-export-from" type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} className="cok-auth-input pr-2 py-1 text-sm" style={{ paddingLeft: '10px' }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[#9E9E9E]" htmlFor="sd-export-to">To</label>
                      <input id="sd-export-to" type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} className="cok-auth-input pr-2 py-1 text-sm" style={{ paddingLeft: '10px' }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 p-4 border-t border-[#E0E0E0]">
                <button onClick={() => setShowExportDialog(false)} disabled={exporting} className="px-4 py-2 text-xs disabled:opacity-50 hover:bg-[rgba(5,109,170,0.08)]" style={{ backgroundColor: '#FFFFFF', border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Cancel</button>
                <button
                  onClick={() => handleExportPDF(exportMode === 'range' ? { from: exportFrom || undefined, to: exportTo || undefined } : undefined)}
                  disabled={exporting || (exportMode === 'range' && !exportFrom && !exportTo)}
                  className="flex items-center gap-1.5 px-4 py-2 text-white text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
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