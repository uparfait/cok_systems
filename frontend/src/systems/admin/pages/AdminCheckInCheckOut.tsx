import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { serviceDeliveryService, statisticsService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { useVisitorPanel, visitorIdOf } from '../../../core/components/visitor/VisitorPanelProvider';
import { useToast } from '../../../core/contexts/ToastContext';
import { FiSearch, FiRefreshCw, FiUserPlus, FiUserMinus, FiClock, FiDownload, FiLoader } from 'react-icons/fi';
import { HiOutlineClipboardList } from 'react-icons/hi';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { VISITOR_HEADERS, BANNER_RATIO, fetchAllPages, figuresOf, loadReportBanner, matchesVisitorText, useVisitorEvents, visitorValues } from './sdAdmin/sdVisits';
import type { SdVisit, VisitorFigures } from './sdAdmin/sdVisits';
import { VisitorCells, VisitorFiguresRow } from './sdAdmin/SdVisitorParts';

const PRIMARY = '#056daa';
const PRIMARY_HOVER = '#045d94';
const SUCCESS = '#4CAF50';
const SUCCESS_HOVER = '#388E3C';
const BORDER = '#E0E0E0';
const WARNING = '#F39C12';
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';
const TABLE_HEADERS = [...VISITOR_HEADERS, 'Entry Time', 'Exit Time', 'Duration', 'Department', 'Status'];

const statusChipOf = (v: SdVisit) =>
  v.is_still_inhouse
    ? (v.marked_as_out
      ? { bg: 'rgba(243,156,18,0.12)', text: WARNING, label: 'Pending Exit' }
      : { bg: 'rgba(76,175,80,0.12)', text: '#388E3C', label: 'Inside' })
    : { bg: 'rgba(51,51,51,0.08)', text: '#555555', label: 'Checked Out' };

const formatDuration = (v: SdVisit) => v.current_duration || '-';
const formatDate = (d?: string) => d ? new Date(d).toLocaleString() : '-';
const getDepartmentName = (v: SdVisit) => v.departments_assigned?.[0]?.department_name || 'Not Assigned';
const isInside = (v: SdVisit) => !!v.is_still_inhouse && !v.marked_as_out;
const isPending = (v: SdVisit) => !!v.is_still_inhouse && !!v.marked_as_out;
const isCheckedOut = (v: SdVisit) => !v.is_still_inhouse;

const AdminCheckInCheckOut: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const { openVisitor } = useVisitorPanel();

  const [loading, setLoading] = useState(true);
  const [visitors, setVisitors] = useState<SdVisit[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [serverQuery, setServerQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'inside' | 'left' | 'pending'>('inside');
  const [firstLoad, setFirstLoad] = useState(true);
  const [realInHouseCount, setRealInHouseCount] = useState(0);
  const [realPendingExitCount, setRealPendingExitCount] = useState(0);
  const [realLeftCount, setRealLeftCount] = useState(0);
  const [figures, setFigures] = useState<VisitorFigures>({});
  const [countsLoaded, setCountsLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const requestRef = useRef(0);
  const serverQueryRef = useRef('');

  const fetchRealCounts = useCallback(async () => {
    try {
      const [insideR, leftR, hourlyR] = await Promise.all([
        serviceDeliveryService.getAll(1, 1, true),
        serviceDeliveryService.getAll(1, 1, false),
        statisticsService.getHourlyServiceDeliveryStats(),
      ]);
      setRealInHouseCount(insideR?.total || 0);
      setRealLeftCount(leftR?.total || 0);
      setFigures(figuresOf(hourlyR?.data || hourlyR));
    } catch (error) {
      console.error(error);
    } finally {
      setCountsLoaded(true);
    }
  }, []);

  const fetchVisitors = useCallback(async (silent = false) => {
    const requestId = ++requestRef.current;
    if (!silent) setLoading(true);
    try {
      const [inside, left] = await Promise.all([
        fetchAllPages<SdVisit>((page) => serviceDeliveryService.getAll(page, 50, true), 40),
        fetchAllPages<SdVisit>((page) => serviceDeliveryService.getAll(page, 50, false), silent ? 1 : 20),
      ]);
      if (requestId !== requestRef.current) return;
      if (silent && !serverQueryRef.current) {
        const fresh = new Set([...inside, ...left].map(v => v._id));
        setVisitors(prev => [...inside, ...left, ...prev.filter(v => !v.is_still_inhouse && !fresh.has(v._id))]);
      } else {
        setVisitors([...inside, ...left]);
      }
      setRealPendingExitCount(inside.filter(isPending).length);
      serverQueryRef.current = '';
      setServerQuery('');
    } catch {
      if (requestId === requestRef.current && !silent) showError('Failed to load visitors');
    } finally {
      if (requestId === requestRef.current) { setLoading(false); setFirstLoad(false); }
    }
  }, [showError]);

  const runSearch = useCallback(async (query: string, silent = false) => {
    const requestId = ++requestRef.current;
    if (!silent) setLoading(true);
    try {
      const rows = await fetchAllPages<SdVisit>((page) => serviceDeliveryService.searchVisitors(query, page, 20, 'all' as any), 50);
      if (requestId !== requestRef.current) return;
      setVisitors(rows);
      serverQueryRef.current = query;
      setServerQuery(query);
    } catch {
      if (requestId === requestRef.current && !silent) showError('Search failed');
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [showError]);

  const handleSearch = useCallback(() => {
    const query = searchQuery.trim();
    if (!query) { fetchVisitors(); return; }
    runSearch(query);
  }, [searchQuery, fetchVisitors, runSearch]);

  const refresh = useCallback((silent = false) => {
    if (serverQueryRef.current) runSearch(serverQueryRef.current, silent);
    else fetchVisitors(silent);
    fetchRealCounts();
  }, [runSearch, fetchVisitors, fetchRealCounts]);

  const filteredVisitors = useMemo(() => {
    let rows = visitors;
    if (activeTab === 'inside') rows = rows.filter(isInside);
    else if (activeTab === 'pending') rows = rows.filter(isPending);
    else rows = rows.filter(isCheckedOut);
    const typed = searchQuery.trim();
    if (typed && typed !== serverQuery) rows = rows.filter(v => matchesVisitorText(v, typed));
    return rows;
  }, [visitors, activeTab, searchQuery, serverQuery]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  useEffect(() => setCurrentPage(1), [searchQuery, activeTab]);
  const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage);
  const paginatedVisitors = filteredVisitors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const insideCount = Math.max(0, realInHouseCount - realPendingExitCount);

  const downloadPDF = useCallback(async () => {
    setDownloading(true);
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
      let y = 10;
      const banner = await loadReportBanner();
      if (banner) {
        const logoW = pw - 20;
        const logoH = logoW * BANNER_RATIO;
        doc.addImage(banner, 'PNG', 10, y, logoW, logoH);
        y += logoH + 10;
      } else {
        y = 15;
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text('REPUBLIC OF RWANDA', pw / 2, y, { align: 'center' }); y += 7;
        doc.setFontSize(12); doc.text('CITY OF KIGALI', pw / 2, y, { align: 'center' }); y += 12;
      }
      doc.setFont('helvetica', 'bold');
      const now = new Date();
      doc.setFontSize(9); doc.setTextColor(0, 0, 0); doc.text(now.toLocaleDateString(), pw / 2, y, { align: 'center' }); y += 5;
      doc.text(now.toLocaleTimeString(), pw / 2, y, { align: 'center' }); y += 12;
      doc.setFontSize(16); doc.setTextColor(76, 175, 80);
      const t = 'VISITOR CHECK-IN / CHECK-OUT REPORT';
      doc.text(t, pw / 2, y, { align: 'center' }); doc.setDrawColor(76, 175, 80); doc.setLineWidth(0.8); doc.line((pw - doc.getTextWidth(t)) / 2 - 5, y + 2, (pw + doc.getTextWidth(t)) / 2 + 5, y + 2); y += 15;
      const addTable = (data: SdVisit[], header: string[], rowOf: (v: SdVisit) => string[], color: [number, number, number]) => {
        if (data.length === 0) return;
        if (y > ph - 60) { doc.addPage(); y = 15; }
        autoTable(doc, { startY: y, head: [header], body: data.map(rowOf), theme: 'grid', headStyles: { fillColor: color, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' }, bodyStyles: { fontSize: 7 }, margin: { left: 10, right: 10 }, tableWidth: 'auto' });
        y = (doc as any).lastAutoTable.finalY + 10;
      };
      const openRow = (v: SdVisit) => [...visitorValues(v), formatDate(v.entry_date), formatDuration(v), getDepartmentName(v)];
      const closedRow = (v: SdVisit) => [...visitorValues(v), formatDate(v.entry_date), formatDate(v.exist_date), formatDuration(v), getDepartmentName(v)];
      addTable(visitors.filter(isInside), [...VISITOR_HEADERS, 'Entry Time', 'Duration', 'Department'], openRow, [76, 175, 80]);
      addTable(visitors.filter(isPending), [...VISITOR_HEADERS, 'Entry Time', 'Duration', 'Department'], openRow, [243, 156, 18]);
      addTable(visitors.filter(isCheckedOut), [...VISITOR_HEADERS, 'Entry Time', 'Exit Time', 'Duration', 'Department'], closedRow, [85, 85, 85]);
      doc.save(`visitor-report-${now.toISOString().split('T')[0]}.pdf`);
      showSuccess('Report downloaded');
    } catch {
      showError('Failed to create the report');
    } finally {
      setDownloading(false);
    }
  }, [visitors, showSuccess, showError]);

  useEffect(() => { if (!authLoading && !isAuthenticated) navigate('/login'); }, [authLoading, isAuthenticated, navigate]);
  useEffect(() => { if (isAuthenticated && !authLoading) { fetchVisitors(); fetchRealCounts(); } }, [isAuthenticated, authLoading, fetchVisitors, fetchRealCounts]);
  useVisitorEvents(() => refresh(true), isAuthenticated);

  if (authLoading) return <div className="flex items-center justify-center min-h-[600px]"><LoadingSpinner message="Loading..." /></div>;

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div><h1 className="text-sm font-bold text-[#333333] flex items-center gap-2"><HiOutlineClipboardList className="w-5 h-5 text-[#4CAF50]" />Manage visitor check-ins and check-outs</h1></div>
          <div className="flex gap-2">
            <button onClick={downloadPDF} disabled={downloading} className="flex items-center gap-1.5 px-3 py-1.5 text-white text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed" style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}>{downloading ? <FiLoader className="w-3.5 h-3.5 animate-spin" /> : <FiDownload className="w-3.5 h-3.5" />}Download Report</button>
            <button onClick={() => refresh()} className="flex items-center gap-1.5 px-3 py-1.5 text-white text-sm transition-colors" style={{ backgroundColor: SUCCESS, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SUCCESS_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}><FiRefreshCw className="w-3.5 h-3.5" />Refresh</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[{ label: 'Currently Inside', value: insideCount, color: 'text-[#388E3C]', bg: 'bg-[rgba(76,175,80,0.12)]', icon: FiUserPlus }, { label: 'Pending Exit', value: realPendingExitCount, color: 'text-[#F39C12]', bg: 'bg-[rgba(243,156,18,0.12)]', icon: FiClock }, { label: 'Checked Out', value: realLeftCount, color: 'text-[#555555]', bg: 'bg-[rgba(51,51,51,0.08)]', icon: FiUserMinus }, { label: 'Total Records', value: visitors.length, color: 'text-[#056daa]', bg: 'bg-[rgba(5,109,170,0.1)]', icon: HiOutlineClipboardList }].map((s, i) => (
            <div key={i} className="bg-white border border-[#E0E0E0] p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-[#9E9E9E]">{s.label}</p>{loading && firstLoad ? <div className="h-7 w-14 bg-[#E0E0E0] animate-pulse mt-1" /> : <p className={`text-xl font-bold ${s.color} mt-0.5`}>{s.value}</p>}</div>
                <div className={`w-10 h-10 ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
              </div>
            </div>
          ))}
        </div>

        <VisitorFiguresRow figures={figures} loading={!countsLoaded} uniqueHint="People checked in today" />

        <div className="bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          <div className="px-6 pt-5 flex flex-wrap gap-3">
            {([['inside', 'Currently Inside', insideCount], ['pending', 'Pending Exit', realPendingExitCount], ['left', 'Checked Out', realLeftCount]] as Array<[typeof activeTab, string, number]>).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="px-4 py-2 text-xs font-semibold uppercase transition-colors"
                style={{ fontFamily: fontHeading, letterSpacing: '1px', borderRadius: 0, border: `1px solid ${PRIMARY}`, backgroundColor: activeTab === key ? PRIMARY : 'transparent', color: activeTab === key ? '#fff' : PRIMARY }}
              >
                {label} ({count})
              </button>
            ))}
          </div>
          <div className="px-6 pt-4 pb-3 flex items-center gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, phone, ID number, email, plate..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); if (!e.target.value.trim() && serverQueryRef.current) fetchVisitors(); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                className="w-full h-11 cok-auth-input pr-4 text-sm"
                style={{ fontFamily: fontHeading }}
              />
            </div>
            <button
              onClick={handleSearch}
              className="h-11 px-6 text-white text-[13px] font-semibold uppercase transition-colors flex-shrink-0"
              style={{ fontFamily: fontHeading, backgroundColor: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
            >
              Search
            </button>
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
                  {(loading && firstLoad) ? (
                    <tr><td colSpan={TABLE_HEADERS.length} className="py-10 text-center"><FiLoader className="animate-spin h-6 w-6 mx-auto" style={{ color: PRIMARY }} /></td></tr>
                  ) : paginatedVisitors.length > 0 ? paginatedVisitors.map((v, i) => {
                    const chip = statusChipOf(v);
                    const vid = visitorIdOf(v);
                    return (
                      <tr
                        key={v._id || i}
                        onClick={() => openVisitor(vid)}
                        title={vid ? 'Open visitor' : undefined}
                        className={`h-14 hover:bg-[#F7F9FB] [&>td]:border-b [&>td]:border-[#E0E0E0] ${vid ? 'cursor-pointer' : ''}`}
                      >
                        <VisitorCells visit={v} />
                        <td className="py-3 px-3 text-[#555555] text-[13px]">{formatDate(v.entry_date)}</td>
                        <td className="py-3 px-3 text-[#555555] text-[13px]">{formatDate(v.exist_date)}</td>
                        <td className="py-3 px-3 text-[#555555] text-[13px]">{formatDuration(v)}</td>
                        <td className="py-3 px-3 text-[#555555] text-[13px]">{getDepartmentName(v)}</td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center px-3 py-1 text-[12px] font-bold uppercase tracking-wide" style={{ backgroundColor: chip.bg, color: chip.text }}>
                            {chip.label}
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
      </div>
    </MainLayout>
  );
};

export default AdminCheckInCheckOut;
