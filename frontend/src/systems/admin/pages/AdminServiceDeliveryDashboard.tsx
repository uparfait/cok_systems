import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { statisticsService, serviceDeliveryService, departmentService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import OverlayShell from '../../../core/components/overlay/OverlayShell';
import { useVisitorPanel, visitorIdOf } from '../../../core/components/visitor/VisitorPanelProvider';
import { useToast } from '../../../core/contexts/ToastContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FiUsers, FiUserPlus, FiClock, FiCheckCircle, FiRefreshCw, FiSearch, FiDownload, FiLoader } from 'react-icons/fi';
import { HiOutlineClipboardList } from 'react-icons/hi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import EmployeeAccountStatusCard from './sub/EmployeeAccountStatusCard';
import MayorVisitorsTimeline from './sub/MayorVisitorsTimeline';
import { VISITOR_HEADERS, BANNER_RATIO, fetchAllPages, figuresOf, loadReportBanner, matchesVisitorText, useVisitorEvents, visitorValues } from './sdAdmin/sdVisits';
import type { SdVisit, VisitorFigures } from './sdAdmin/sdVisits';
import { VisitorCells, VisitorFiguresRow } from './sdAdmin/SdVisitorParts';

interface HourlyData { hour: number; visitors_checked_in: number; }
interface ServiceDeliveryStats { total: number; inhouse: number; completed: number; }

const PRIMARY = '#056daa';
const PRIMARY_HOVER = '#045d94';
const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const WARNING = '#F39C12';
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';
const TABLE_HEADERS = [...VISITOR_HEADERS, 'Department', 'Staff', 'Check-in', 'Check-out', 'Status'];

const getDeptName = (v: SdVisit) => v.departments_assigned?.length ? (v.departments_assigned.find(d => d.reached_in)?.department_name || v.departments_assigned[0]?.department_name || '-') : 'Not Yet Assigned';
const getStaff = (v: SdVisit) => {
  if (v.serving_by?.name) return v.serving_by.name;
  const s = v.services_status?.find(x => x.s_type === 'Inprogress');
  if (s?.provider_name) return s.provider_name;
  const c = v.services_status?.find(x => x.s_type === 'Completed');
  if (c?.provider_name) return c.provider_name;
  const r = v.departments_assigned?.find(d => d.reached_in);
  if (r?.provider_name) return r.provider_name;
  return v.departments_assigned?.length ? 'Not Yet Served' : 'Not Yet Assigned';
};
const getStatus = (v: SdVisit) => v.is_still_inhouse ? { text: 'Inside', color: 'green' } : { text: 'Checked Out', color: 'gray' };
const formatDate = (d?: string) => d ? new Date(d).toLocaleString() : '-';

const AdminServiceDeliveryDashboard: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { roleSlug } = useParams();
  const isMayor = roleSlug === 'mayor';
  const { showError } = useToast();
  const { openVisitor } = useVisitorPanel();
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [departmentCount, setDepartmentCount] = useState(0);
  const [stats, setStats] = useState<ServiceDeliveryStats>({ total: 0, inhouse: 0, completed: 0 });
  const [figures, setFigures] = useState<VisitorFigures>({});
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [todayVisits, setTodayVisits] = useState(0);
  const [visitors, setVisitors] = useState<SdVisit[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportMode, setExportMode] = useState<'all' | 'range'>('all');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const requestRef = useRef(0);

  const fetchData = useCallback(async (options: { silent?: boolean; withDepartments?: boolean } = {}) => {
    const { silent = false, withDepartments = true } = options;
    const requestId = ++requestRef.current;
    if (!silent) setLoading(true);
    try {
      const [hourlyRes, statsRes, deptRes, inside, leftRes] = await Promise.all([
        statisticsService.getHourlyServiceDeliveryStats(),
        statisticsService.getServiceDeliveryStats(),
        withDepartments ? departmentService.getAll() : Promise.resolve(null),
        fetchAllPages<SdVisit>((page) => serviceDeliveryService.getAll(page, 50, true), 40),
        serviceDeliveryService.getAll(1, 50, false),
      ]);
      if (requestId !== requestRef.current) return;
      const hourly = hourlyRes?.data || hourlyRes || {};
      setHourlyData(Array.isArray(hourly.hourly) ? hourly.hourly : []);
      setTodayVisits(Number(hourly.total_visitors) || 0);
      const statsData = statsRes?.data || statsRes || {};
      setStats({ total: Number(statsData.total) || 0, inhouse: Number(statsData.inhouse) || 0, completed: Number(statsData.completed) || 0 });
      setFigures({ ...figuresOf(statsData), unique_visitors: figuresOf(hourly).unique_visitors });
      if (deptRes) {
        const departments = deptRes?.data || deptRes || [];
        setDepartmentCount(Array.isArray(departments) ? departments.filter((d: any) => d.status !== 'inactive').length : 0);
      }
      const left: SdVisit[] = Array.isArray(leftRes?.data) ? leftRes.data : [];
      setVisitors([...inside, ...left]);
    } catch {
      if (requestId === requestRef.current && !silent) showError('Failed to load data');
    } finally {
      if (requestId === requestRef.current) { setLoading(false); setFirstLoad(false); }
    }
  }, [showError]);

  useEffect(() => { if (!authLoading && !isAuthenticated) navigate('/login'); }, [authLoading, isAuthenticated, navigate]);
  useEffect(() => { if (isAuthenticated && !authLoading && !isMayor) fetchData(); }, [isAuthenticated, authLoading, fetchData, isMayor]);
  useVisitorEvents(() => { fetchData({ silent: true, withDepartments: false }); }, isAuthenticated && !isMayor);

  const filteredVisitors = visitors.filter(v => {
    const matchesSearch = matchesVisitorText(v, searchQuery);
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'inside' && v.is_still_inhouse) || (statusFilter === 'left' && !v.is_still_inhouse);
    return matchesSearch && matchesStatus;
  });
  useEffect(() => setCurrentPage(1), [searchQuery, statusFilter]);
  const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage);
  const paginatedVisitors = filteredVisitors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExportPDF = useCallback(async (opts?: { from?: string; to?: string }) => {
    setExporting(true);
    try {
      const ranged = !!(opts?.from || opts?.to);
      const records = await fetchAllPages<SdVisit>((page) => serviceDeliveryService.getAll(
        page,
        50,
        'all',
        ranged ? 'range' : undefined,
        ranged ? (opts?.from || '1970-01-01') : undefined,
        ranged ? opts?.to : undefined,
      ), 200);

      const doc = new jsPDF('l', 'mm', 'a4');
      const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
      let y = 10;
      const banner = await loadReportBanner();
      if (banner) {
        const logoW = pw - 20;
        const logoH = logoW * BANNER_RATIO;
        doc.addImage(banner, 'PNG', 10, y, logoW, logoH);
        y += logoH + 10;
      }
      doc.setFont('helvetica', 'bold');
      const now = new Date();
      doc.setFontSize(9); doc.setTextColor(0, 0, 0); doc.text(now.toLocaleDateString(), pw / 2, y, { align: 'center' }); y += 5;
      doc.text(now.toLocaleTimeString(), pw / 2, y, { align: 'center' }); y += 10;
      doc.setFontSize(16); doc.setTextColor(5, 109, 170);
      const t = 'CURRENT VISITORS REPORT'; doc.text(t, pw / 2, y, { align: 'center' });
      doc.setDrawColor(5, 109, 170); doc.setLineWidth(0.8); doc.line((pw - doc.getTextWidth(t)) / 2 - 5, y + 2, (pw + doc.getTextWidth(t)) / 2 + 5, y + 2); y += 8;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
      const scope = ranged
        ? `Period: ${opts?.from || 'start'} to ${opts?.to || 'today'} (${records.length} visits)`
        : `All visits (${records.length})`;
      doc.text(scope, pw / 2, y, { align: 'center' }); y += 10;

      if (records.length > 0) {
        const rows = records.map(v => [
          ...visitorValues(v),
          getDeptName(v),
          getStaff(v),
          formatDate(v.entry_date),
          formatDate(v.exist_date),
          getStatus(v).text,
        ]);
        autoTable(doc, {
          startY: y,
          head: [TABLE_HEADERS],
          body: rows,
          theme: 'grid',
          headStyles: { fillColor: [5, 109, 170], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
          bodyStyles: { fontSize: 7, cellPadding: 2, halign: 'center' },
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
    } catch {
      showError('Failed to export visitors report');
    } finally {
      setExporting(false);
    }
  }, [showError]);

  if (authLoading) return <div className="flex items-center justify-center min-h-[600px]"><LoadingSpinner message="Loading..." /></div>;

  if (isMayor) {
    return (
      <MainLayout>
        <MayorVisitorsTimeline />
      </MainLayout>
    );
  }

  const openExport = () => { setExportMode('all'); setShowExportDialog(true); };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div><h1 className="text-sm font-bold text-[#333333] flex items-center gap-2"><HiOutlineClipboardList className="w-5 h-5 text-[#056daa]" />Manage and monitor visitor services</h1></div>
          <div className="flex gap-2">
            <button onClick={() => fetchData()} className="flex items-center gap-1.5 px-3 py-1.5 text-white text-sm transition-colors" style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}><FiRefreshCw className="w-3.5 h-3.5" />Refresh</button>
            <button onClick={openExport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors hover:bg-[rgba(5,109,170,0.08)]" style={{ backgroundColor: '#FFFFFF', border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}><FiDownload className="w-3.5 h-3.5" />Export PDF</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Visits', value: stats.total, icon: FiUsers, color: 'text-[#056daa]', bg: 'bg-[rgba(5,109,170,0.1)]' },
            { label: 'Currently Inside', value: stats.inhouse, icon: FiUserPlus, color: 'text-[#388E3C]', bg: 'bg-[rgba(76,175,80,0.12)]' },
            { label: 'Completed Visits', value: stats.completed, icon: FiCheckCircle, color: 'text-[#2980B9]', bg: 'bg-[rgba(41,128,185,0.1)]' },
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

        <VisitorFiguresRow figures={figures} loading={loading && firstLoad} uniqueHint="People checked in today" />

        <div className="bg-white border border-[#E0E0E0] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-[#333333]">Today's Visitor Activity</h2>
            {!(loading && firstLoad) && <span className="text-xs text-[#9E9E9E]">{todayVisits} visits today - {figures.unique_visitors ?? 0} unique visitors</span>}
          </div>
          {loading && firstLoad ? <div className="h-48 flex items-center justify-center"><FiLoader className='animate-spin h-6 w-6 text-[#056daa]' /></div>
            : <div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={hourlyData}><CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" vertical={false} /><XAxis dataKey="hour" tickFormatter={(v: number) => `${v}:00`} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 0 }} /><Area type="monotone" dataKey="visitors_checked_in" stroke="#056daa" fill="rgba(5,109,170,0.1)" name="Visits" dot={{ r: 3 }} label={{ position: 'top', fill: '#333333', fontSize: 10, fontWeight: 600 }} /></AreaChart></ResponsiveContainer></div>}
        </div>

        <div className="bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          <div className="px-6 pt-5 flex items-center justify-between">
            <h2 className="text-sm font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Current Visitors</h2>
            <button
              onClick={openExport}
              className="flex items-center gap-2 h-9 px-4 bg-transparent text-[12px] font-semibold uppercase transition-colors hover:bg-[rgba(5,109,170,0.08)]"
              style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
            >
              <FiDownload className="w-3.5 h-3.5" /> Export PDF
            </button>
          </div>
          <div className="px-6 pt-4 pb-3 flex items-center gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search name, phone, ID number, email..."
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
          <div className="px-6">
            <div className="cok-table-scroll">
              <table className="w-full">
                <thead className="cok-bg-primary">
                  <tr>
                    {TABLE_HEADERS.map(h => (
                      <th key={h} className="text-left py-3 px-3 text-xs uppercase tracking-wider font-semibold text-white cok-bg-primary" style={{ fontFamily: fontHeading, letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={TABLE_HEADERS.length} className="py-10 text-center"><FiLoader className="animate-spin h-6 w-6 mx-auto" style={{ color: PRIMARY }} /></td></tr>
                  ) : paginatedVisitors.length > 0 ? paginatedVisitors.map((v, i) => {
                    const st = getStatus(v);
                    const staff = getStaff(v);
                    const vid = visitorIdOf(v);
                    return (
                      <tr
                        key={v._id || i}
                        onClick={() => openVisitor(vid)}
                        title={vid ? 'Open visitor' : undefined}
                        className={`h-14 hover:bg-[#F7F9FB] [&>td]:border-b [&>td]:border-[#E0E0E0] ${vid ? 'cursor-pointer' : ''}`}
                      >
                        <VisitorCells visit={v} />
                        <td className="py-3 px-3 text-[#555555] text-[13px]">{getDeptName(v)}</td>
                        <td className="py-3 px-3 text-[13px]" style={{ color: staff.includes('Not') ? WARNING : '#555555' }}>{staff}</td>
                        <td className="py-3 px-3 text-[#555555] text-[13px]">{formatDate(v.entry_date)}</td>
                        <td className="py-3 px-3 text-[#555555] text-[13px]">{formatDate(v.exist_date)}</td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center px-3 py-1 text-[12px] font-bold uppercase tracking-wide" style={{ backgroundColor: st.color === 'green' ? 'rgba(76,175,80,0.12)' : 'rgba(51,51,51,0.08)', color: st.color === 'green' ? '#388E3C' : '#555555' }}>
                            {st.text}
                          </span>
                        </td>
                      </tr>
                    );
                  }) : <tr><td colSpan={TABLE_HEADERS.length} className="py-10 text-center text-[13px] text-[#9E9E9E]">No visitors found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="px-6 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${BORDER}` }}>
              <span className="text-[12px] text-[#555555]" style={{ fontFamily: fontHeading }}>
                Page {currentPage} of {totalPages} - {filteredVisitors.length} visits
              </span>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="px-3 py-1.5 text-[12px] font-semibold uppercase disabled:opacity-40 hover:bg-[rgba(5,109,170,0.08)]" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>Prev</button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="px-3 py-1.5 text-[12px] font-semibold uppercase disabled:opacity-40 hover:bg-[rgba(5,109,170,0.08)]" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>Next</button>
              </div>
            </div>
          )}
        </div>

        <EmployeeAccountStatusCard />

        <OverlayShell
          open={showExportDialog}
          title="Export Visitors Report"
          onClose={() => setShowExportDialog(false)}
          busy={exporting}
          width="sm"
          footer={
            <button
              type="button"
              onClick={() => handleExportPDF(exportMode === 'range' ? { from: exportFrom || undefined, to: exportTo || undefined } : undefined)}
              disabled={exporting || (exportMode === 'range' && !exportFrom && !exportTo)}
              className="cok-btn-primary w-auto! px-4! py-2! text-xs! flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? <FiLoader className="w-3.5 h-3.5 animate-spin" /> : <FiDownload className="w-3.5 h-3.5" />}
              {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
          }
        >
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[#555555]">
              <input type="radio" name="sd-export-mode" checked={exportMode === 'all'} onChange={() => setExportMode('all')} disabled={exporting} />
              All visitors
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[#555555]">
              <input type="radio" name="sd-export-mode" checked={exportMode === 'range'} onChange={() => setExportMode('range')} disabled={exporting} />
              Custom date range (check-in date)
            </label>
            {exportMode === 'range' && (
              <div className="flex flex-wrap items-center gap-3 pl-6">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#9E9E9E]" htmlFor="sd-export-from">From</label>
                  <input id="sd-export-from" type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} disabled={exporting} className="cok-auth-input pr-2 py-1 text-sm" style={{ paddingLeft: '10px' }} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#9E9E9E]" htmlFor="sd-export-to">To</label>
                  <input id="sd-export-to" type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} disabled={exporting} className="cok-auth-input pr-2 py-1 text-sm" style={{ paddingLeft: '10px' }} />
                </div>
              </div>
            )}
          </div>
        </OverlayShell>
      </div>
    </MainLayout>
  );
};

export default AdminServiceDeliveryDashboard;
