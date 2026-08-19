import React, { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { smartParkingService, statisticsService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { FiTruck, FiSearch,FiLoader, FiFlag, FiCheckCircle, FiX, FiDownload, FiFilter, FiCalendar, FiRefreshCw, FiMapPin, FiEdit } from 'react-icons/fi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ParkingSlotConfigModal from './sub/ParkingSlotConfigModal';

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#388E3C";
const DANGER = "#E74C3C";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

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

  // Export dialog: all records or a custom check-in date range
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportMode, setExportMode] = useState<'all' | 'range'>('all');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exporting, setExporting] = useState(false);

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

  // Fetches records fresh at export time (the dashboard doesn't keep the full
  // list in memory), optionally filtered to a check-in date range
  const fetchExportRecords = useCallback(async (opts?: { from?: string; to?: string }) => {
    const r = await smartParkingService.getAllPaginated(1, 1000, 'all');
    let records: ParkingRecord[] = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
    if (opts?.from) records = records.filter(rec => rec.check_in && new Date(rec.check_in) >= new Date(opts.from!));
    if (opts?.to) records = records.filter(rec => rec.check_in && new Date(rec.check_in) <= new Date(opts.to + 'T23:59:59'));
    return records;
  }, []);

  // Official report banner (Republic of Rwanda · City of Kigali) as a base64 data URL
  const loadReportBanner = async (): Promise<string | null> => {
    try {
      const res = await fetch('/LOGO_COK_report.png');
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const handleDownloadReport = useCallback(async (opts?: { from?: string; to?: string }) => {
    setExporting(true);
    try {
      const records = await fetchExportRecords(opts);

      const doc = new jsPDF('l', 'mm', 'a4');
      const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
      let y = 10;
      // Full-width report banner (Republic of Rwanda · City of Kigali), same as the attendance reports
      const banner = await loadReportBanner();
      if (banner) {
        try {
          const logoW = pw - 20;
          const logoH = logoW * (221 / 1116); // original banner is 1116x221 px
          doc.addImage(banner, 'PNG', 10, y, logoW, logoH);
          y += logoH + 10;
        } catch (e) { /* render without the banner if it fails to load */ }
      }
      doc.setFont('helvetica', 'bold');
      const now = new Date();
      doc.setFontSize(9); doc.setTextColor(0, 0, 0); doc.text(formatDateForPDF(now), pw / 2, y, { align: 'center' }); y += 5;
      doc.text(now.toLocaleTimeString(), pw / 2, y, { align: 'center' }); y += 10;
      doc.setFontSize(16); doc.setTextColor(5, 109, 170);
      const t = 'RECENT PARKING RECORDS'; doc.text(t, pw / 2, y, { align: 'center' });
      doc.setDrawColor(5, 109, 170); doc.setLineWidth(0.8); doc.line((pw - doc.getTextWidth(t)) / 2 - 5, y + 2, (pw + doc.getTextWidth(t)) / 2 + 5, y + 2); y += 8;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
      // ASCII only — jsPDF's built-in fonts garble unsupported unicode chars
      const scope = opts?.from || opts?.to
        ? `Period: ${opts?.from || 'start'} to ${opts?.to || 'today'} (${records.length} records)`
        : `All records (${records.length})`;
      doc.text(scope, pw / 2, y, { align: 'center' }); y += 10;

      if (records.length > 0) {
        const rows = records.map(rec => [
          truncateText(rec.plate_number || 'N/A', 12),
          truncateText(rec.driver_name || 'N/A', 24),
          truncateText(rec.driver_type || 'N/A', 12),
          rec.status === 'active' ? 'Active' : rec.status === 'completed' ? 'Completed' : 'N/A',
          rec.check_in ? new Date(rec.check_in).toLocaleString() : 'N/A',
        ]);
        autoTable(doc, {
          startY: y,
          head: [['Plate', 'Driver', 'Type', 'Status', 'Time']],
          body: rows,
          theme: 'grid',
          headStyles: { fillColor: [5, 109, 170], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', halign: 'center', cellPadding: 4 },
          bodyStyles: { fontSize: 8, cellPadding: 3, halign: 'center' },
          columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 75, halign: 'left' }, 2: { cellWidth: 45 }, 3: { cellWidth: 40 }, 4: { cellWidth: 80 } },
          margin: { left: (pw - 280) / 2, right: (pw - 280) / 2 },
          tableWidth: 280,
          didDrawPage: (data) => { doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(10, ph - 15, pw - 10, ph - 15); doc.setFontSize(7); doc.setTextColor(128, 128, 128); doc.text('City of Kigali - Smart Parking Management System', pw / 2, ph - 12, { align: 'center' }); doc.text(`Page ${data.pageNumber}`, pw - 10, ph - 12, { align: 'right' }); },
        });
      } else {
        doc.setFontSize(11); doc.setTextColor(100, 100, 100);
        doc.text('No parking records found for this period', pw / 2, y + 30, { align: 'center' });
      }
      doc.save(`Parking_Records_${now.toISOString().split('T')[0]}.pdf`);
      setShowExportDialog(false);
    } catch (e) {
      showError('Failed to export parking records');
    } finally {
      setExporting(false);
    }
  }, [showError, fetchExportRecords]);

  // Excel export — same records, dialog, and banner as the PDF report
  const handleDownloadExcel = useCallback(async (opts?: { from?: string; to?: string }) => {
    setExporting(true);
    try {
      const records = await fetchExportRecords(opts);
      const now = new Date();

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Parking Records');
      ws.columns = [{ width: 6 }, { width: 18 }, { width: 30 }, { width: 16 }, { width: 14 }, { width: 24 }];

      // Banner floats over the first rows, sized to span the table width
      let rowCursor = 1;
      const banner = await loadReportBanner();
      if (banner) {
        const imgId = wb.addImage({ base64: banner, extension: 'png' });
        const logoWidth = 660;
        const logoHeight = logoWidth * (221 / 1116);
        ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: logoWidth, height: logoHeight } });
        rowCursor = Math.ceil(logoHeight / 15) + 2;
      }

      const titleRow = ws.getRow(rowCursor);
      titleRow.getCell(1).value = 'RECENT PARKING RECORDS';
      titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF056DAA' } };
      rowCursor += 1;

      const scopeRow = ws.getRow(rowCursor);
      scopeRow.getCell(1).value = opts?.from || opts?.to
        ? `Period: ${opts?.from || 'start'} to ${opts?.to || 'today'} (${records.length} records)`
        : `All records (${records.length})`;
      scopeRow.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF888888' } };
      rowCursor += 2;

      const headers = ['S/N', 'Plate', 'Driver', 'Type', 'Status', 'Check-in Time'];
      const headerRow = ws.getRow(rowCursor);
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF056DAA' } };
      });
      rowCursor += 1;

      records.forEach((rec, i) => {
        const row = ws.getRow(rowCursor + i);
        [
          i + 1,
          rec.plate_number || 'N/A',
          rec.driver_name || 'N/A',
          rec.driver_type || 'N/A',
          rec.status === 'active' ? 'Active' : rec.status === 'completed' ? 'Completed' : 'N/A',
          rec.check_in ? new Date(rec.check_in).toLocaleString() : 'N/A',
        ].forEach((v, j) => { row.getCell(j + 1).value = v; });
      });

      const footerRow = ws.getRow(rowCursor + records.length + 1);
      footerRow.getCell(1).value =
        `City of Kigali - Smart Parking Management System   Exported: ${now.toLocaleString()}`;
      footerRow.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF888888' } };

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Parking_Records_${now.toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setShowExportDialog(false);
    } catch (e) {
      showError('Failed to export parking records');
    } finally {
      setExporting(false);
    }
  }, [showError, fetchExportRecords]);

  if (authLoading) return <div className="flex items-center justify-center min-h-[600px]"><LoadingSpinner message="Loading dashboard..." /></div>;

  return (
    <MainLayout>
      <div className="space-y-4">
        {realtimeUpdate && <div className="bg-[rgba(5,109,170,0.08)] border border-[#E0E0E0] p-3 flex items-center gap-2"><div className="w-2 h-2 bg-[#056daa] animate-ping"></div><p className="text-sm text-[#056daa] font-medium">{realtimeUpdate}</p></div>}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div><h1 className="text-sm font-bold text-[#333333]">Manage and monitor parking operations in real-time</h1></div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setExportMode('all'); setShowExportDialog(true); }} className="flex items-center gap-1 px-3 py-1.5 text-white text-xs font-medium" style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}><FiDownload className="w-3 h-3" />Export</button>
            <button onClick={() => { setShowRecordsModal(true); fetchAllRecords(1); }} className="px-3 py-1.5 bg-white border border-[#056daa] text-[#056daa] text-xs font-medium hover:bg-[rgba(5,109,170,0.06)]">View All Records</button>
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#056daa] text-[#056daa] text-sm font-medium hover:bg-[rgba(5,109,170,0.06)] disabled:opacity-50"><FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Today's Vehicles", value: stats.todayVehicles, icon: FiTruck, color: 'text-[#056daa]', bg: 'bg-[rgba(5,109,170,0.1)]' },
            { label: 'Currently Parked', value: stats.currentlyParked, icon: FiCheckCircle, color: 'text-[#388E3C]', bg: 'bg-[rgba(76,175,80,0.12)]', sub: stats.totalCapacity > 0 ? `${((stats.currentlyParked / stats.totalCapacity) * 100).toFixed(1)}% occupied` : '' },
            { label: 'Available Slots', value: stats.availableSlots, icon: FiMapPin, color: 'text-[#2980B9]', bg: 'bg-[rgba(41,128,185,0.1)]' },
            { label: 'Flagged Vehicles', value: stats.flaggedInside, icon: FiFlag, color: 'text-[#F39C12]', bg: 'bg-[rgba(243,156,18,0.12)]', sub: 'Currently' },
          ].map((s, i) => (
            <div key={i} className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-[#555555]">{s.label}</p>{loading && firstLoad ? <div className="h-7 w-14 bg-[#E0E0E0] animate-pulse mt-1" /> : <><p className="text-xl font-bold text-[#333333] mt-0.5">{s.value}</p>{s.sub && <p className="text-xs text-[#9E9E9E] mt-0.5">{s.sub}</p>}</>}</div>
                <div className={`w-10 h-10 ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <button onClick={() => setShowSlotConfig(true)} className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium cursor-pointer" style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}><FiEdit className="w-4 h-4" />Click To Set Slots</button>
        </div>

        <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
          <h2 className="text-sm font-semibold text-[#333333] mb-3">Parking Usage Trends</h2>
          {loading && firstLoad ? <div className="h-48 flex items-center justify-center"><LoadingSpinner /></div>
            : <div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={hourlyData} margin={{ top: 15, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} /><XAxis dataKey="hour" tickFormatter={(v: number) => `${v}:00`} tick={{ fontSize: 11, fill: GRAY_DISABLED }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: GRAY_DISABLED }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0, boxShadow: CARD_SHADOW }} /><Legend /><Area type="monotone" dataKey="check_in" stroke={PRIMARY} fill="rgba(5,109,170,0.1)" name="Check-ins" dot={{ r: 3 }} label={{ position: 'top', fill: NEUTRAL_DARK, fontSize: 10, fontWeight: 600 }} /><Area type="monotone" dataKey="check_out" stroke={DANGER} fill="rgba(231,76,60,0.1)" name="Check-outs" dot={{ r: 3 }} label={{ position: 'top', fill: NEUTRAL_DARK, fontSize: 10, fontWeight: 600 }} /></AreaChart></ResponsiveContainer></div>}
        </div>

        <ParkingSlotConfigModal show={showSlotConfig} slotConfig={slotConfig} saving={savingSlot} onClose={() => setShowSlotConfig(false)} onChange={(e) => { const { name, value } = e.target; setSlotConfig(p => ({ ...p, [name]: value === '' ? 0 : parseInt(value) || 0 })); }} onSave={async () => { setSavingSlot(true); try { const r = await smartParkingService.updateSlotConfig(slotConfig); if (r.success) { showSuccess('Slot config updated'); setShowSlotConfig(false); fetchData(); } else showError(r.message || 'Failed'); } catch (err: any) { showError(err?.message || 'Failed'); } finally { setSavingSlot(false); } }} />

        {/* Export dialog: all records or a custom check-in date range */}
        {showExportDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(51,51,51,0.5)' }} onClick={() => !exporting && setShowExportDialog(false)}>
            <div className="bg-white w-full max-w-md border border-gray-200 shadow-lg" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Export parking records">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-sm font-bold text-[#333333]">Export Parking Records</h3>
                <button onClick={() => setShowExportDialog(false)} disabled={exporting} className="w-7 h-7 flex items-center justify-center border border-gray-200 hover:bg-[#F7F9FB]"><FiX className="w-4 h-4 text-[#555555]" /></button>
              </div>
              <div className="p-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-[#333333]">
                  <input type="radio" name="export-mode" checked={exportMode === 'all'} onChange={() => setExportMode('all')} />
                  All records
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-[#333333]">
                  <input type="radio" name="export-mode" checked={exportMode === 'range'} onChange={() => setExportMode('range')} />
                  Custom date range (check-in date)
                </label>
                {exportMode === 'range' && (
                  <div className="flex flex-wrap items-center gap-3 pl-6">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[#555555]" htmlFor="export-from">From</label>
                      <input id="export-from" type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} className="cok-auth-input h-8 pr-2 py-1 text-sm" style={{ paddingLeft: '10px' }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[#555555]" htmlFor="export-to">To</label>
                      <input id="export-to" type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} className="cok-auth-input h-8 pr-2 py-1 text-sm" style={{ paddingLeft: '10px' }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
                <button onClick={() => setShowExportDialog(false)} disabled={exporting} className="px-4 py-2 text-xs font-medium bg-white border border-[#056daa] text-[#056daa] hover:bg-[rgba(5,109,170,0.06)] disabled:opacity-50">Cancel</button>
                <button
                  onClick={() => handleDownloadExcel(exportMode === 'range' ? { from: exportFrom || undefined, to: exportTo || undefined } : undefined)}
                  disabled={exporting || (exportMode === 'range' && !exportFrom && !exportTo)}
                  className="flex items-center gap-1.5 px-4 py-2 text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: SUCCESS, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SUCCESS_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}
                >
                  {exporting ? <FiLoader className="w-3.5 h-3.5 animate-spin" /> : <FiDownload className="w-3.5 h-3.5" />}
                  {exporting ? 'Exporting…' : 'Export Excel'}
                </button>
                <button
                  onClick={() => handleDownloadReport(exportMode === 'range' ? { from: exportFrom || undefined, to: exportTo || undefined } : undefined)}
                  disabled={exporting || (exportMode === 'range' && !exportFrom && !exportTo)}
                  className="flex items-center gap-1.5 px-4 py-2 text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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

        {showRecordsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRecordsModal(false)}>
            <div className="bg-white w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-4  flex items-center justify-between bg-gray-50">
                <h3 className="text-sm font-bold text-[#333333]">All Parking Records</h3>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="cok-auth-input pr-3 py-2 text-sm w-40" style={{ paddingLeft: '12px' }} />
                  <button onClick={() => fetchAllRecords(1)} className="px-3 py-1.5 text-white text-xs font-medium" style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}>Search</button>
                  <button onClick={() => setShowRecordsModal(false)} className="p-1.5 hover:bg-gray-200">✕</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {modalLoading ? <div className="flex justify-center py-8"><div className="h-8 w-8" /><FiLoader className='h-8 w-8 animate-spin text-[#056daa]' /></div>
                  : <table className="w-full"><thead className="sticky top-0" style={{ backgroundColor: PRIMARY }}><tr>{['Plate', 'Driver', 'Phone', 'Type', 'Status', 'Check-in', 'Check-out'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-white/95 uppercase">{h}</th>)}</tr></thead>
                    <tbody className="divide-y">{(allRecords || []).map((r: any) => <tr key={r._id} className="hover:bg-[#F7F9FB]"><td className="px-3 py-2 text-sm font-medium">{r.plate_number || '___'}</td><td className="px-3 py-2 text-sm">{r.driver_name || '___'}</td><td className="px-3 py-2 text-sm">{r.driver_telephone || '___'}</td><td className="px-3 py-2 text-sm">{r.driver_type || '___'}</td><td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 ${r.status === 'active' ? 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]' : 'bg-[rgba(51,51,51,0.08)] text-[#555555]'}`}>{r.status}</span></td><td className="px-3 py-2 text-xs">{r.check_in ? new Date(r.check_in).toLocaleString() : '___'}</td><td className="px-3 py-2 text-xs">{r.check_out ? new Date(r.check_out).toLocaleString() : '___'}</td></tr>)}
                    </tbody></table>}
              </div>
              {totalPages > 1 && <div className="p-3 border-t flex items-center justify-between text-sm"><span>{totalRecords} records</span><div className="flex gap-2"><button onClick={() => fetchAllRecords(currentPage - 1)} disabled={currentPage <= 1} className="px-3 py-1 bg-white border border-[#056daa] text-[#056daa] hover:bg-[rgba(5,109,170,0.06)] disabled:opacity-50">Prev</button><button onClick={() => fetchAllRecords(currentPage + 1)} disabled={currentPage >= totalPages} className="px-3 py-1 bg-white border border-[#056daa] text-[#056daa] hover:bg-[rgba(5,109,170,0.06)]">Next</button></div></div>}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminSmartParkingDashboard;