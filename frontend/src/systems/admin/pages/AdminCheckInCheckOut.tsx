import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { useToast } from '../../../core/contexts/ToastContext';
import { FiSearch, FiRefreshCw, FiUserPlus, FiUserMinus, FiClock, FiDownload } from 'react-icons/fi';
import { HiOutlineClipboardList } from 'react-icons/hi';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Visitor { _id: string; full_name?: string; name?: string; visitorName?: string; telephone?: string; phone?: string; email?: string; identification?: { id_type?: string; number?: string }; badge_number?: string; department?: string; departmentName?: string; departments_assigned?: Array<{ department_id: string; department_name: string; assigned_time: Date; reached_in: boolean; provider_name: string; provider_id: string }>; purpose?: string; status?: string; checkInTime?: string; checkIn?: string; checkOutTime?: string; checkOut?: string; entry_date?: string; exist_date?: string; exit_date?: string; is_still_inhouse?: boolean; marked_as_out?: boolean; current_duration?: string; current_duration_hours?: number; services_status?: Array<{ s_type: string; status: string; notes?: string }>; }

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
    try { const r = await serviceDeliveryService.getAll(1, 1000); const d = r?.data || []; const v = Array.isArray(d) ? d : []; setVisitors(v); setRealPendingExitCount(v.filter(x => x.is_still_inhouse && x.marked_as_out).length); }
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
    else filtered = filtered.filter(v => !v.is_still_inhouse && v.status !== 'Inside' && !v.marked_as_out);
    if (searchQuery) filtered = filtered.filter(v => (v.full_name || v.name || v.visitorName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (v.telephone || v.phone || '').includes(searchQuery));
    setFilteredVisitors(filtered);
  }, [visitors, searchQuery, activeTab]);

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
    doc.setFontSize(16); doc.setTextColor(34, 197, 94);
    const t = 'VISITOR CHECK-IN / CHECK-OUT REPORT';
    doc.text(t, pw / 2, y, { align: 'center' }); doc.setDrawColor(34, 197, 94); doc.setLineWidth(0.8); doc.line((pw - doc.getTextWidth(t)) / 2 - 5, y + 2, (pw + doc.getTextWidth(t)) / 2 + 5, y + 2); y += 15;
    const insideVisitors = visitors.filter(v => (v.is_still_inhouse || v.status === 'Inside') && !v.marked_as_out);
    const pendingVisitors = visitors.filter(v => v.is_still_inhouse && v.marked_as_out);
    const checkedOutVisitors = visitors.filter(v => !v.is_still_inhouse && v.status !== 'Inside' && !v.marked_as_out);
    const trunc = (t: string | undefined, m: number) => t ? (t.length > m ? t.substring(0, m) + '...' : t) : 'N/A';
    const fmt = (d: string | undefined) => d ? new Date(d).toLocaleString().substring(0, 16) : 'N/A';
    const addTable = (data: Visitor[], header: string[], color: [number, number, number]) => {
      if (data.length === 0) return;
      if (y > ph - 60) { doc.addPage(); y = 15; }
      const rows = data.map(v => [trunc(v.full_name || v.name || v.visitorName || 'N/A', 20), trunc(v.identification?.number || '-', 15), trunc(v.badge_number || '-', 10), fmt(v.entry_date), formatDuration(v), trunc(getDepartmentName(v), 20)]);
      autoTable(doc, { startY: y, head: [header], body: rows, theme: 'grid', headStyles: { fillColor: color, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' }, bodyStyles: { fontSize: 8 }, margin: { left: 10, right: 10 }, tableWidth: 'auto' });
      y = (doc as any).lastAutoTable.finalY + 10;
    };
    addTable(insideVisitors, ['Visitor Name', 'ID Number', 'Badge', 'Entry Time', 'Duration', 'Department'], [34, 197, 94]);
    addTable(pendingVisitors, ['Visitor Name', 'ID Number', 'Badge', 'Entry Time', 'Duration', 'Department'], [249, 115, 22]);
    addTable(checkedOutVisitors, ['Visitor Name', 'ID Number', 'Badge', 'Entry Time', 'Exit Time', 'Duration', 'Department'], [107, 114, 128]);
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
          <div><h1 className="text-sm font-bold text-gray-900 flex items-center gap-2"><HiOutlineClipboardList className="w-5 h-5 text-green-600" />Manage visitor check-ins and check-outs</h1></div>
          <div className="flex gap-2">
            <button onClick={downloadPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"><FiDownload className="w-3.5 h-3.5" />Download Report</button>
            <button onClick={() => fetchVisitors()} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium hover:bg-green-700"><FiRefreshCw className="w-3.5 h-3.5" />Refresh</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[{ label: 'Currently Inside', value: realInsideCount, color: 'text-green-600', bg: 'bg-green-100', icon: FiUserPlus }, { label: 'Pending Exit', value: realPendingExitCount, color: 'text-orange-600', bg: 'bg-orange-100', icon: FiClock }, { label: 'Checked Out', value: realLeftCount, color: 'text-gray-900', bg: 'bg-gray-100', icon: FiUserMinus }, { label: 'Total Records', value: visitors.length, color: 'text-gray-900', bg: 'bg-blue-100', icon: HiOutlineClipboardList }].map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-gray-500">{s.label}</p>{loading && firstLoad ? <div className="h-7 w-14 bg-gray-200 animate-pulse mt-1" /> : <p className={`text-xl font-bold ${s.color} mt-0.5`}>{s.value}</p>}</div>
                <div className={`w-10 h-10 ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 max-h-[600px] flex flex-col">
          <div className="border-b border-gray-100">
            <nav className="flex -mb-px">
              {[['inside', 'Currently Inside', realInsideCount, 'border-green-500 text-green-600'], ['pending', 'Pending Exit', realPendingExitCount, 'border-orange-500 text-orange-600'], ['left', 'Checked Out', realLeftCount, 'border-gray-500 text-gray-600']].map(([key, label, count, color]) => (
                <button key={key} onClick={() => setActiveTab(key as any)} className={`py-3 px-4 text-xs font-medium border-b-2 ${activeTab === key ? color : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label} ({count})</button>
              ))}
            </nav>
          </div>
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div className="relative max-w-md flex-1"><FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" /><input type="text" placeholder="Search by name, phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSearch()} className="w-full pl-8 pr-3 py-1.5 border border-gray-300 text-sm" /></div>
              <button onClick={handleSearch} className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium hover:bg-green-700">Search</button>
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm"><tr>{['Visitor Name', 'ID Number', 'Badge', 'Entry Time', 'Exit Time', 'Duration', 'Department', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {(loading && firstLoad) ? <tr><td colSpan={8} className="px-3 py-6 text-center"><div className="animate-spin h-6 w-6 border-2 border-green-500 border-t-transparent mx-auto" /></td></tr>
                  : filteredVisitors.length > 0 ? filteredVisitors.map((v, i) => (
                      <tr key={v._id || i} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5"><div className="flex items-center"><div className="w-7 h-7 bg-green-100 flex items-center justify-center mr-2"><span className="text-green-600 font-medium text-xs">{(v.full_name || v.name || v.visitorName || 'V').charAt(0).toUpperCase()}</span></div><span className="text-sm font-medium text-gray-900">{v.full_name || v.name || v.visitorName || 'N/A'}</span></div></td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">{v.identification?.number || '-'}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">{v.badge_number || '-'}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">{formatDate(v.entry_date)}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">{formatDate(v.exist_date)}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">{formatDuration(v)}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">{getDepartmentName(v)}</td>
                        <td className="px-3 py-2.5"><span className={`text-xs px-2 py-0.5 font-medium ${v.is_still_inhouse ? (v.marked_as_out ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800') : 'bg-gray-100 text-gray-800'}`}>{v.is_still_inhouse ? (v.marked_as_out ? 'Pending Exit' : 'Inside') : 'Checked Out'}</span></td>
                      </tr>
                    )) : <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-500">No visitors found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AdminCheckInCheckOut;