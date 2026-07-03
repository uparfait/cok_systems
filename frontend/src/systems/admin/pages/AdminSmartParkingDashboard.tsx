import React, { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { smartParkingService, statisticsService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { FiTruck, FiSearch, FiFlag, FiCheckCircle, FiX, FiDownload, FiFilter, FiCalendar, FiRefreshCw, FiMapPin, FiEdit } from 'react-icons/fi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ParkingSlotConfigModal from './sub/ParkingSlotConfigModal';

interface ParkingRecord { _id: string; plate_number?: string; driver_name?: string; driver_telephone?: string; driver_type?: string; status?: string; check_in?: string; check_out?: string; slot_number?: string; is_flagged?: boolean; }
interface HourlyData { hour: number; check_in: number; check_out: number; }
interface ParkingStats { todayVehicles: number; currentlyParked: number; availableSlots: number; flaggedInside: number; totalCapacity: number; }

const AdminSmartParkingDashboard: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const { socket, isConnected } = useSocket();

  const [loading, setLoading] = useState(true);
  const [firstLoad, setfirstLoad] = useState(true);
  const [stats, setStats] = useState<ParkingStats>({ todayVehicles: 0, currentlyParked: 0, availableSlots: 0, flaggedInside: 0, totalCapacity: 0 });
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [recentRecords, setRecentRecords] = useState<ParkingRecord[]>([]);
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [allRecords, setAllRecords] = useState<ParkingRecord[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [realtimeUpdate, setRealtimeUpdate] = useState<string | null>(null);
  const [showSlotConfig, setShowSlotConfig] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);
  const [slotConfig, setSlotConfig] = useState({ totalSlots: 0, staffReservedSlots: 0, visitorReservedSlots: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const PAGE_SIZE = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const hourlyRes = await statisticsService.getHourlyParkingStats();
      const hourly = hourlyRes?.data?.hourly || [];
      setHourlyData(hourly);
      const todayCheckIns = hourly.reduce((s: number, h: HourlyData) => s + h.check_in, 0);
      const parkedRes = await statisticsService.getCurrentlyParkedStats();
      const currentlyParked = parkedRes?.data?.total || 0;
      const flaggedRes = await statisticsService.getFlaggedVehiclesStats();
      const flaggedData = flaggedRes?.data;
      const flaggedInside = flaggedData?.currently_flagged?.count || 0;
      const slotsRes = await statisticsService.getParkingSlots();
      const slotsData = slotsRes?.data?.available_slots || {};
      const totalCap = slotsData?.totalSlots || 0;
      setSlotConfig({ totalSlots: slotsData?.totalSlots || 0, staffReservedSlots: slotsData?.staffReservedSlots || 0, visitorReservedSlots: slotsData?.visitorsReservedSlots || 0 });
      setStats({ todayVehicles: todayCheckIns, currentlyParked, availableSlots: Math.max(0, totalCap - currentlyParked), flaggedInside, totalCapacity: totalCap });
      const recordsRes = await smartParkingService.getAll();
      const records = recordsRes?.data || recordsRes || [];
      setRecentRecords(Array.isArray(records) ? records.slice(0, 10) : []);
    } catch (error) { console.error(error); }
    finally { setLoading(false); setfirstLoad(false); }
  }, []);

  const fetchAllRecords = useCallback(async (page = 1) => {
    setModalLoading(true);
    try {
      const r = await smartParkingService.getAllPaginated(page, PAGE_SIZE);
      let records: ParkingRecord[] = [], total = 0;
      if (r?.data && Array.isArray(r.data)) { records = r.data; total = r.total || 0; }
      else if (Array.isArray(r)) { records = r; total = r.length; }
      if (records.length > 0) {
        if (searchQuery) records = records.filter(r => r.plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) || r.driver_name?.toLowerCase().includes(searchQuery.toLowerCase()) || r.driver_telephone?.includes(searchQuery));
        if (statusFilter !== 'all') records = records.filter(r => r.status === statusFilter);
        if (dateFrom) records = records.filter(r => r.check_in && new Date(r.check_in) >= new Date(dateFrom));
        if (dateTo) records = records.filter(r => r.check_in && new Date(r.check_in) <= new Date(dateTo + 'T23:59:59'));
      }
      setAllRecords(records); setTotalRecords(total); setTotalPages(Math.ceil(total / PAGE_SIZE)); setCurrentPage(page);
    } catch (error) { setAllRecords([]); } finally { setModalLoading(false); }
  }, [searchQuery, statusFilter, dateFrom, dateTo]);

  useEffect(() => { if (!authLoading && !isAuthenticated) navigate('/login'); }, [authLoading, isAuthenticated, navigate]);
  useEffect(() => { if (isAuthenticated && !authLoading) fetchData(); }, [isAuthenticated, authLoading, fetchData]);

  useEffect(() => {
    if (!socket || !isConnected) return;
    const events = ['car_checkedin', 'car_checkedout', 'visitor_checkedin', 'visitor_checkedout'];
    events.forEach(ev => socket.on(ev, (data: any) => { setRealtimeUpdate(data?.message || `${ev} detected`); if (!showRecordsModal) fetchData(); }));
    return () => { events.forEach(ev => socket.off(ev)); };
  }, [socket, isConnected, fetchData, showRecordsModal]);

  useEffect(() => { if (realtimeUpdate) { const t = setTimeout(() => setRealtimeUpdate(null), 3000); return () => clearTimeout(t); } }, [realtimeUpdate]);

  const formatDateForPDF = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const truncateText = (t: string | undefined, m: number) => t ? (t.length > m ? t.substring(0, m - 3) + '...' : t) : 'N/A';

  const handleDownloadReport = useCallback(() => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    let y = 15;
    try { doc.addImage('/LOGO_COK.png', 'PNG', (pw - 40) / 2, y, 40, 40); y += 48; } catch (e) { }
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text('REPUBLIC OF RWANDA', pw / 2, y, { align: 'center' }); y += 7;
    doc.setFontSize(12); doc.text('CITY OF KIGALI', pw / 2, y, { align: 'center' }); y += 12;
    const now = new Date();
    doc.setFontSize(9); doc.text(formatDateForPDF(now), pw / 2, y, { align: 'center' }); y += 5;
    doc.text(now.toLocaleTimeString(), pw / 2, y, { align: 'center' }); y += 12;
    doc.setFontSize(16); doc.setTextColor(41, 95, 115);
    const t = 'PARKING RECORDS REPORT'; doc.text(t, pw / 2, y, { align: 'center' });
    doc.setDrawColor(41, 95, 115); doc.setLineWidth(0.8); doc.line((pw - doc.getTextWidth(t)) / 2 - 5, y + 2, (pw + doc.getTextWidth(t)) / 2 + 5, y + 2); y += 15;
    if (allRecords.length > 0) {
      const rows = allRecords.slice(0, 200).map(r => [truncateText(r.plate_number || 'N/A', 12), truncateText(r.driver_name || 'N/A', 20), truncateText(r.driver_telephone || 'N/A', 15), truncateText(r.driver_type || 'N/A', 12), r.status === 'active' ? 'Active' : r.status === 'completed' ? 'Completed' : 'N/A', r.check_in ? new Date(r.check_in).toLocaleString().substring(0, 16) : 'N/A', r.check_out ? new Date(r.check_out).toLocaleString().substring(0, 16) : 'N/A']);
      autoTable(doc, { startY: y, head: [['Plate No.', 'Driver Name', 'Phone', 'Type', 'Status', 'Check-in', 'Check-out']], body: rows, theme: 'grid', headStyles: { fillColor: [41, 95, 115], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', halign: 'center', cellPadding: 4 }, bodyStyles: { fontSize: 8, cellPadding: 3, halign: 'center' }, columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 52, halign: 'left' }, 2: { cellWidth: 38 }, 3: { cellWidth: 32 }, 4: { cellWidth: 30 }, 5: { cellWidth: 48 }, 6: { cellWidth: 48 } }, margin: { left: (pw - 280) / 2, right: (pw - 280) / 2 }, tableWidth: 280, didDrawPage: (data) => { doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(10, ph - 15, pw - 10, ph - 15); doc.setFontSize(7); doc.setTextColor(128, 128, 128); doc.text('City of Kigali - Smart Parking Management System', pw / 2, ph - 12, { align: 'center' }); doc.text(`Page ${data.pageNumber}`, pw - 10, ph - 12, { align: 'right' }); } });
    } else { doc.setFontSize(11); doc.text('No parking records found', pw / 2, y + 30, { align: 'center' }); }
    doc.save(`Parking_Records_${now.toISOString().split('T')[0]}.pdf`);
  }, [allRecords]);

  if (authLoading) return <div className="flex items-center justify-center min-h-[600px]"><LoadingSpinner message="Loading dashboard..." /></div>;

  return (
    <MainLayout>
      <div className="space-y-4">
        {realtimeUpdate && <div className="bg-blue-50 border border-blue-200 p-3 flex items-center gap-2"><div className="w-2 h-2 bg-blue-500 animate-ping"></div><p className="text-sm text-blue-700 font-medium">{realtimeUpdate}</p></div>}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div><h1 className="text-sm font-bold text-gray-900">Manage and monitor parking operations in real-time</h1></div>
          <button onClick={fetchData} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 disabled:opacity-50"><FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Today's Vehicles", value: stats.todayVehicles, icon: FiTruck, color: 'text-blue-600', bg: 'bg-blue-100' },
            { label: 'Currently Parked', value: stats.currentlyParked, icon: FiCheckCircle, color: 'text-green-600', bg: 'bg-green-100', sub: stats.totalCapacity > 0 ? `${((stats.currentlyParked / stats.totalCapacity) * 100).toFixed(1)}% occupied` : '' },
            { label: 'Available Slots', value: stats.availableSlots, icon: FiMapPin, color: 'text-purple-600', bg: 'bg-purple-100' },
            { label: 'Flagged Vehicles', value: stats.flaggedInside, icon: FiFlag, color: 'text-orange-600', bg: 'bg-orange-100', sub: 'Currently' },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-gray-500">{s.label}</p>{loading && firstLoad ? <div className="h-7 w-14 bg-gray-200 animate-pulse mt-1" /> : <><p className="text-xl font-bold text-gray-900 mt-0.5">{s.value}</p>{s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}</>}</div>
                <div className={`w-10 h-10 ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <button onClick={() => setShowSlotConfig(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 hover:from-indigo-500/30 hover:to-blue-500/30 border border-indigo-200/30 text-sm font-medium text-indigo-700"><FiEdit className="w-4 h-4" />Slot Configuration</button>
        </div>

        <div className="bg-white border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Parking Usage Trends</h2>
          {loading && firstLoad ? <div className="h-48 flex items-center justify-center"><LoadingSpinner /></div>
            : <div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={hourlyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hour" tickFormatter={(v: number) => `${v}:00`} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Area type="monotone" dataKey="check_in" stroke="#3b82f6" fill="rgba(59,130,246,0.1)" name="Check-ins" /><Area type="monotone" dataKey="check_out" stroke="#ef4444" fill="rgba(239,68,68,0.1)" name="Check-outs" /></AreaChart></ResponsiveContainer></div>}
        </div>

        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent Parking Records</h2>
            <div className="flex gap-2">
              <button onClick={handleDownloadReport} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"><FiDownload className="w-3 h-3" />PDF</button>
              <button onClick={() => { setShowRecordsModal(true); fetchAllRecords(1); }} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200">View All</button>
            </div>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Plate</th><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Driver</th><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Type</th><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Time</th></tr></thead>
            <tbody className="divide-y">{(recentRecords || []).slice(0, 5).map((r: any) => <tr key={r._id} className="hover:bg-gray-50"><td className="px-3 py-2.5 text-sm font-medium text-gray-900">{r.plate_number || '___'}</td><td className="px-3 py-2.5 text-sm text-gray-600">{r.driver_name || '___'}</td><td className="px-3 py-2.5 text-sm text-gray-600">{r.driver_type || '___'}</td><td className="px-3 py-2.5"><span className={`text-xs px-2 py-0.5 font-medium ${r.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{r.status}</span></td><td className="px-3 py-2.5 text-xs text-gray-600">{r.check_in ? new Date(r.check_in).toLocaleString() : '___'}</td></tr>)}
            </tbody>
          </table>
        </div>

        <ParkingSlotConfigModal show={showSlotConfig} slotConfig={slotConfig} saving={savingSlot} onClose={() => setShowSlotConfig(false)} onChange={(e) => { const { name, value } = e.target; setSlotConfig(p => ({ ...p, [name]: value === '' ? 0 : parseInt(value) || 0 })); }} onSave={async () => { setSavingSlot(true); try { const r = await smartParkingService.updateSlotConfig(slotConfig); if (r.success) { showSuccess('Slot config updated'); setShowSlotConfig(false); fetchData(); } else showError(r.message || 'Failed'); } catch (err: any) { showError(err?.message || 'Failed'); } finally { setSavingSlot(false); } }} />

        {showRecordsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRecordsModal(false)}>
            <div className="bg-white w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                <h3 className="text-sm font-bold text-gray-900">All Parking Records</h3>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="px-2.5 py-1.5 border text-sm w-40" />
                  <button onClick={() => fetchAllRecords(1)} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium">Filter</button>
                  <button onClick={() => setShowRecordsModal(false)} className="p-1.5 hover:bg-gray-200">✕</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {modalLoading ? <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>
                  : <table className="w-full"><thead className="bg-gray-50 sticky top-0"><tr>{['Plate', 'Driver', 'Phone', 'Type', 'Status', 'Check-in', 'Check-out'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
                    <tbody className="divide-y">{(allRecords || []).map((r: any) => <tr key={r._id} className="hover:bg-gray-50"><td className="px-3 py-2 text-sm font-medium">{r.plate_number || '___'}</td><td className="px-3 py-2 text-sm">{r.driver_name || '___'}</td><td className="px-3 py-2 text-sm">{r.driver_telephone || '___'}</td><td className="px-3 py-2 text-sm">{r.driver_type || '___'}</td><td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 ${r.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{r.status}</span></td><td className="px-3 py-2 text-xs">{r.check_in ? new Date(r.check_in).toLocaleString() : '___'}</td><td className="px-3 py-2 text-xs">{r.check_out ? new Date(r.check_out).toLocaleString() : '___'}</td></tr>)}
                    </tbody></table>}
              </div>
              {totalPages > 1 && <div className="p-3 border-t flex items-center justify-between text-sm"><span>{totalRecords} records</span><div className="flex gap-2"><button onClick={() => fetchAllRecords(currentPage - 1)} disabled={currentPage <= 1} className="px-3 py-1 border hover:bg-gray-50 disabled:opacity-50">Prev</button><button onClick={() => fetchAllRecords(currentPage + 1)} disabled={currentPage >= totalPages} className="px-3 py-1 border hover:bg-gray-50">Next</button></div></div>}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminSmartParkingDashboard;