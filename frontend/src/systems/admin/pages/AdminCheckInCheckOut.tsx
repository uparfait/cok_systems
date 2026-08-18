import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { useToast } from '../../../core/contexts/ToastContext';
import { FiSearch, FiRefreshCw, FiUserPlus, FiUserMinus, FiClock, FiDownload, FiLoader } from 'react-icons/fi';
import { HiOutlineClipboardList } from 'react-icons/hi';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Visitor { _id: string; full_name?: string; name?: string; visitorName?: string; telephone?: string; phone?: string; email?: string; identification?: { id_type?: string; number?: string }; badge_number?: string; department?: string; departmentName?: string; departments_assigned?: Array<{ department_id: string; department_name: string; assigned_time: Date; reached_in: boolean; provider_name: string; provider_id: string }>; purpose?: string; status?: string; checkInTime?: string; checkIn?: string; checkOutTime?: string; checkOut?: string; entry_date?: string; exist_date?: string; exit_date?: string; is_still_inhouse?: boolean; marked_as_out?: boolean; current_duration?: string; current_duration_hours?: number; services_status?: Array<{ s_type: string; status: string; notes?: string }>; }

// City of Kigali (CoK) institutional design constants — same set as the reservations tables
const PRIMARY = '#056daa';
const PRIMARY_HOVER = '#045d94';
const SUCCESS = '#4CAF50';
const SUCCESS_HOVER = '#388E3C';
const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const WARNING = '#F39C12';
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';

const initialsOf = (name: string) => (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

// Status chips in the reservations style: bold uppercase on a soft tint
const statusChipOf = (v: Visitor) =>
  v.is_still_inhouse
    ? (v.marked_as_out
      ? { bg: 'rgba(243,156,18,0.12)', text: WARNING, label: 'Pending Exit' }
      : { bg: 'rgba(76,175,80,0.12)', text: '#388E3C', label: 'Inside' })
    : { bg: 'rgba(51,51,51,0.08)', text: '#555555', label: 'Checked Out' };

const AdminCheckInCheckOut: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'inside' | 'left' | 'pending'>('inside');
  const [firstLoad, setFirstLoad] = useState(true);
  const [realInsideCount, setRealInsideCount] = useState(0);
  const [realPendingExitCount, setRealPendingExitCount] = useState(0);
  const [realLeftCount, setRealLeftCount] = useState(0);

  const fetchRealCounts = useCallback(async () => {
    try { const insideR = await serviceDeliveryService.getAll(1, 1, true); setRealInsideCount(insideR?.total || 0); const leftR = await serviceDeliveryService.getAll(1, 1, false); setRealLeftCount(leftR?.total || 0); }
    catch (error) { console.error(error); }
  }, []);

  const fetchVisitors = useCallback(async () => {
    setLoading(true);
    // 'all' is required — without it the backend defaults to in-house only and the Checked Out tab stays empty
    try { const r = await serviceDeliveryService.getAll(1, 1000, 'all'); const d = r?.data || []; const v = Array.isArray(d) ? d : []; setVisitors(v); setRealPendingExitCount(v.filter(x => x.is_still_inhouse && x.marked_as_out).length); }
    catch (error) { showError('Failed to load visitors'); }
    finally { setLoading(false); setFirstLoad(false); }
  }, [showError]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) { fetchVisitors(); return; }
    setLoading(true);
    try { const r = await serviceDeliveryService.searchVisitors(searchQuery, 1, 1000, 'all' as any); const d = r?.data || []; const v = Array.isArray(d) ? d : []; setVisitors(v); setRealPendingExitCount(v.filter(x => x.is_still_inhouse && x.marked_as_out).length); }
    catch (error) { showError('Search failed'); }
    finally { setLoading(false); }
  }, [searchQuery, fetchVisitors, showError]);

  const [filteredVisitors, setFilteredVisitors] = useState<Visitor[]>([]);
  useEffect(() => {
    let filtered = [...visitors];
    if (activeTab === 'inside') filtered = filtered.filter(v => (v.is_still_inhouse || v.status === 'Inside') && !v.marked_as_out);
    else if (activeTab === 'pending') filtered = filtered.filter(v => v.is_still_inhouse && v.marked_as_out);
    // Checked out = no longer in-house; marked_as_out may stay true after a full checkout, so it must not exclude here
    else filtered = filtered.filter(v => !v.is_still_inhouse && v.status !== 'Inside');
    if (searchQuery) filtered = filtered.filter(v => (v.full_name || v.name || v.visitorName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (v.telephone || v.phone || '').includes(searchQuery));
    setFilteredVisitors(filtered);
  }, [visitors, searchQuery, activeTab]);

  // Pagination in the reservations-table style
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  useEffect(() => setCurrentPage(1), [searchQuery, activeTab]);
  const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage);
  const paginatedVisitors = filteredVisitors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatDuration = (v: Visitor) => v.current_duration || '-';
  const formatDate = (d: string | Date | undefined) => d ? new Date(d).toLocaleString() : '-';
  const getDepartmentName = (v: Visitor) => v.department || v.departmentName || (v.departments_assigned?.[0]?.department_name) || 'Not Assigned';

  const downloadPDF = useCallback(() => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    let y = 15;
    try { doc.addImage('/LOGO_COK_report.png', 'PNG', 0, y, pw, 40); y += 48; } catch (e) { }
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text('REPUBLIC OF RWANDA', pw / 2, y, { align: 'center' }); y += 7;
    doc.setFontSize(12); doc.text('CITY OF KIGALI', pw / 2, y, { align: 'center' }); y += 12;
    const now = new Date();
    doc.setFontSize(9); doc.text(now.toLocaleDateString(), pw / 2, y, { align: 'center' }); y += 5;
    doc.text(now.toLocaleTimeString(), pw / 2, y, { align: 'center' }); y += 12;
    doc.setFontSize(16); doc.setTextColor(76, 175, 80);
    const t = 'VISITOR CHECK-IN / CHECK-OUT REPORT';
    doc.text(t, pw / 2, y, { align: 'center' }); doc.setDrawColor(76, 175, 80); doc.setLineWidth(0.8); doc.line((pw - doc.getTextWidth(t)) / 2 - 5, y + 2, (pw + doc.getTextWidth(t)) / 2 + 5, y + 2); y += 15;
    const insideVisitors = visitors.filter(v => (v.is_still_inhouse || v.status === 'Inside') && !v.marked_as_out);
    const pendingVisitors = visitors.filter(v => v.is_still_inhouse && v.marked_as_out);
    const checkedOutVisitors = visitors.filter(v => !v.is_still_inhouse && v.status !== 'Inside');
    const trunc = (t: string | undefined, m: number) => t ? (t.length > m ? t.substring(0, m) + '...' : t) : 'N/A';
    const fmt = (d: string | undefined) => d ? new Date(d).toLocaleString().substring(0, 16) : 'N/A';
    const addTable = (data: Visitor[], header: string[], color: [number, number, number]) => {
      if (data.length === 0) return;
      if (y > ph - 60) { doc.addPage(); y = 15; }
      const rows = data.map(v => [trunc(v.full_name || v.name || v.visitorName || 'N/A', 20), trunc(v.identification?.number || '-', 15), trunc(v.badge_number || '-', 10), fmt(v.entry_date), formatDuration(v), trunc(getDepartmentName(v), 20)]);
      autoTable(doc, { startY: y, head: [header], body: rows, theme: 'grid', headStyles: { fillColor: color, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' }, bodyStyles: { fontSize: 8 }, margin: { left: 10, right: 10 }, tableWidth: 'auto' });
      y = (doc as any).lastAutoTable.finalY + 10;
    };
    addTable(insideVisitors, ['Visitor Name', 'ID Number', 'Badge', 'Entry Time', 'Duration', 'Department'], [76, 175, 80]);
    addTable(pendingVisitors, ['Visitor Name', 'ID Number', 'Badge', 'Entry Time', 'Duration', 'Department'], [243, 156, 18]);
    addTable(checkedOutVisitors, ['Visitor Name', 'ID Number', 'Badge', 'Entry Time', 'Exit Time', 'Duration', 'Department'], [85, 85, 85]);
    doc.save(`visitor-report-${now.toISOString().split('T')[0]}.pdf`);
    showSuccess('Report downloaded');
  }, [visitors, showSuccess]);

  useEffect(() => { if (!authLoading && !isAuthenticated) navigate('/login'); }, [authLoading, isAuthenticated, navigate]);
  useEffect(() => { if (isAuthenticated && !authLoading) { fetchVisitors(); fetchRealCounts(); } }, [isAuthenticated, authLoading, fetchVisitors, fetchRealCounts]);

  if (authLoading) return <div className="flex items-center justify-center min-h-[600px]"><LoadingSpinner message="Loading..." /></div>;

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div><h1 className="text-sm font-bold text-[#333333] flex items-center gap-2"><HiOutlineClipboardList className="w-5 h-5 text-[#4CAF50]" />Manage visitor check-ins and check-outs</h1></div>
          <div className="flex gap-2">
            <button onClick={downloadPDF} className="flex items-center gap-1.5 px-3 py-1.5 text-white text-sm transition-colors" style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}><FiDownload className="w-3.5 h-3.5" />Download Report</button>
            <button onClick={() => fetchVisitors()} className="flex items-center gap-1.5 px-3 py-1.5 text-white text-sm transition-colors" style={{ backgroundColor: SUCCESS, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SUCCESS_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}><FiRefreshCw className="w-3.5 h-3.5" />Refresh</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[{ label: 'Currently Inside', value: realInsideCount, color: 'text-[#388E3C]', bg: 'bg-[rgba(76,175,80,0.12)]', icon: FiUserPlus }, { label: 'Pending Exit', value: realPendingExitCount, color: 'text-[#F39C12]', bg: 'bg-[rgba(243,156,18,0.12)]', icon: FiClock }, { label: 'Checked Out', value: realLeftCount, color: 'text-[#555555]', bg: 'bg-[rgba(51,51,51,0.08)]', icon: FiUserMinus }, { label: 'Total Records', value: visitors.length, color: 'text-[#056daa]', bg: 'bg-[rgba(5,109,170,0.1)]', icon: HiOutlineClipboardList }].map((s, i) => (
            <div key={i} className="bg-white border border-[#E0E0E0] p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-[#9E9E9E]">{s.label}</p>{loading && firstLoad ? <div className="h-7 w-14 bg-[#E0E0E0] animate-pulse mt-1" /> : <p className={`text-xl font-bold ${s.color} mt-0.5`}>{s.value}</p>}</div>
                <div className={`w-10 h-10 ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          {/* View switch in the reservations style — CoK square uppercase buttons */}
          <div className="px-6 pt-5 flex flex-wrap gap-3">
            {([['inside', 'Currently Inside', realInsideCount], ['pending', 'Pending Exit', realPendingExitCount], ['left', 'Checked Out', realLeftCount]] as Array<[typeof activeTab, string, number]>).map(([key, label, count]) => (
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
          {/* Search bar in the reservations-table style: full-width input with an attached solid Search button */}
          <div className="px-6 pt-4 pb-3 flex items-center gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
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
          <div className="overflow-x-auto px-6">
            <table className="w-full min-w-[900px]">
              {/* Solid CoK-blue header bar — same as the reservations tables */}
              <thead className="cok-bg-primary sticky top-0 z-10 shadow-sm">
                <tr>
                  {['Visitor Name', 'ID Number', 'Badge', 'Entry Time', 'Exit Time', 'Duration', 'Department', 'Status'].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs uppercase tracking-wider font-semibold text-white" style={{ fontFamily: fontHeading, letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(loading && firstLoad) ? (
                  <tr><td colSpan={8} className="py-10 text-center"><FiLoader className="animate-spin h-6 w-6 mx-auto" style={{ color: PRIMARY }} /></td></tr>
                ) : paginatedVisitors.length > 0 ? paginatedVisitors.map((v, i) => {
                  const chip = statusChipOf(v);
                  const name = v.full_name || v.name || v.visitorName || 'N/A';
                  return (
                    <tr key={v._id || i} className="h-14 hover:bg-[#F7F9FB]" style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: PRIMARY, fontFamily: fontHeading }}>
                            {initialsOf(name)}
                          </div>
                          <span className="text-[#333] text-[13px] font-medium">{name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[#555555] text-[13px] font-mono">{v.identification?.number || '—'}</td>
                      <td className="py-3 px-3 text-[#333] text-[13px] font-mono font-semibold">{v.badge_number || '—'}</td>
                      <td className="py-3 px-3 text-[#555555] text-[13px] whitespace-nowrap">{formatDate(v.entry_date)}</td>
                      <td className="py-3 px-3 text-[#555555] text-[13px] whitespace-nowrap">{formatDate(v.exist_date)}</td>
                      <td className="py-3 px-3 text-[#555555] text-[13px]">{formatDuration(v)}</td>
                      <td className="py-3 px-3 text-[#555555] text-[13px]">{getDepartmentName(v)}</td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-3 py-1 text-[12px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ backgroundColor: chip.bg, color: chip.text }}>
                          {chip.label}
                        </span>
                      </td>
                    </tr>
                  );
                }) : <tr><td colSpan={8} className="py-10 text-center text-[13px] text-[#9E9E9E]">No visitors found</td></tr>}
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
      </div>
    </MainLayout>
  );
};

export default AdminCheckInCheckOut;