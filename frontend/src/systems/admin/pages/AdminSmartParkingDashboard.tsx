import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { smartParkingService, statisticsService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import Table from '../../../core/components/Table';
import { FiTruck, FiRefreshCw, FiFlag, FiCheckCircle, FiMapPin, FiEdit } from 'react-icons/fi';
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
interface ParkingStats { todayVehicles: number; currentlyParked: number; availableSlots: number; flaggedInside: number; flaggedTotal: number; totalCapacity: number; }
interface FlaggedVehicle { _id: string; plate_no: string; driver_name: string; driver_type: string; entry_time: string; exit_time: string | null; duration: string; status: string; }
type FlaggedScope = 'active' | 'completed' | 'all';

const AdminSmartParkingDashboard: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const { socket, isConnected } = useSocket();

  const [loading, setLoading] = useState(true);
  const [firstLoad, setfirstLoad] = useState(true);
  const [stats, setStats] = useState<ParkingStats>({ todayVehicles: 0, currentlyParked: 0, availableSlots: 0, flaggedInside: 0, flaggedTotal: 0, totalCapacity: 0 });
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [allRecords, setAllRecords] = useState<ParkingRecord[]>([]);
  // Flagged vehicles list, opened from the flag card
  const [showFlaggedModal, setShowFlaggedModal] = useState(false);
  const [flaggedRecords, setFlaggedRecords] = useState<FlaggedVehicle[]>([]);
  const [flaggedLoading, setFlaggedLoading] = useState(false);
  const [flaggedPage, setFlaggedPage] = useState(1);
  const [flaggedTotal, setFlaggedTotal] = useState(0);
  const [flaggedScope, setFlaggedScope] = useState<FlaggedScope>('active');
  const [modalLoading, setModalLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rangePreset, setRangePreset] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('month');
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
      const flaggedTotal = flaggedData?.flagged_records_total || 0;
      const slotsRes = await statisticsService.getParkingSlots();
      const slotsData = slotsRes?.data?.available_slots || {};
      const totalCap = slotsData?.totalSlots || 0;
      setSlotConfig({ totalSlots: slotsData?.totalSlots || 0, staffReservedSlots: slotsData?.staffReservedSlots || 0, visitorReservedSlots: slotsData?.visitorsReservedSlots || 0 });
      setStats({ todayVehicles: todayCheckIns, currentlyParked, availableSlots: Math.max(0, totalCap - currentlyParked), flaggedInside, flaggedTotal, totalCapacity: totalCap });
    } catch (error) { console.error(error); }
    finally { setLoading(false); setfirstLoad(false); }
  }, []);

  const getRangeDates = useCallback((): { from?: string; to?: string } => {
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const now = new Date();
    if (rangePreset === 'today') { const t = fmt(now); return { from: t, to: t }; }
    if (rangePreset === 'week') { const start = new Date(now); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); return { from: fmt(start), to: fmt(now) }; }
    if (rangePreset === 'month') { return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) }; }
    if (rangePreset === 'custom') { return { from: dateFrom || undefined, to: dateTo || undefined }; }
    return {};
  }, [rangePreset, dateFrom, dateTo]);

  const fetchAllRecords = useCallback(async (page = 1) => {
    setModalLoading(true);
    try {
      const range = getRangeDates();
      const r = await smartParkingService.getAllPaginated(page, PAGE_SIZE, statusFilter, { ...range, search: searchQuery.trim() || undefined });
      let records: ParkingRecord[] = [], total = 0;
      if (r?.data && Array.isArray(r.data)) { records = r.data; total = r.total || 0; }
      else if (Array.isArray(r)) { records = r; total = r.length; }
      setAllRecords(records); setTotalRecords(total); setTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE))); setCurrentPage(page);
    } catch (error) { setAllRecords([]); } finally { setModalLoading(false); }
  }, [searchQuery, statusFilter, getRangeDates]);

  const fetchFlagged = useCallback(async (page = 1, scope: FlaggedScope = flaggedScope) => {
    setFlaggedLoading(true);
    try {
      const r = await smartParkingService.getFlaggedActiveVehicles(page, PAGE_SIZE, scope);
      setFlaggedRecords(r?.success ? r.data : []); setFlaggedTotal(r?.total || 0); setFlaggedPage(page);
    } catch (error) { setFlaggedRecords([]); } finally { setFlaggedLoading(false); }
  }, [flaggedScope]);

  // Open on "inside now"; if nothing is inside, show the full history so the admin is not met by an empty table
  const openFlagged = (scope: FlaggedScope = stats.flaggedInside > 0 ? 'active' : 'all') => { setFlaggedScope(scope); setShowFlaggedModal(true); fetchFlagged(1, scope); };
  const changeFlaggedScope = (scope: FlaggedScope) => { setFlaggedScope(scope); fetchFlagged(1, scope); };

  useEffect(() => { if (!authLoading && !isAuthenticated) navigate('/login'); }, [authLoading, isAuthenticated, navigate]);
  useEffect(() => { if (isAuthenticated && !authLoading) fetchData(); }, [isAuthenticated, authLoading, fetchData]);

  useEffect(() => {
    if (!socket || !isConnected) return;
    const events = ['car_checkedin', 'car_checkedout', 'visitor_checkedin', 'visitor_checkedout'];
    events.forEach(ev => socket.on(ev, (data: any) => { setRealtimeUpdate(data?.message || `${ev} detected`); if (!showRecordsModal) fetchData(); }));
    return () => { events.forEach(ev => socket.off(ev)); };
  }, [socket, isConnected, fetchData, showRecordsModal]);

  useEffect(() => { if (realtimeUpdate) { const t = setTimeout(() => setRealtimeUpdate(null), 3000); return () => clearTimeout(t); } }, [realtimeUpdate]);



  if (authLoading) return <div className="flex items-center justify-center min-h-[600px]"><LoadingSpinner message="Loading dashboard..." /></div>;

  return (
    <MainLayout>
      <div className="space-y-4">
        {realtimeUpdate && <div className="bg-[rgba(5,109,170,0.08)] border border-[#E0E0E0] p-3 flex items-center gap-2"><div className="w-2 h-2 bg-[#056daa] animate-ping"></div><p className="text-sm text-[#056daa] font-medium">{realtimeUpdate}</p></div>}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div><h1 className="text-sm font-bold text-[#333333]">Manage and monitor parking operations in real-time</h1></div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setShowRecordsModal(true); fetchAllRecords(1); }} className="px-3 py-1.5 bg-white border border-[#056daa] text-[#056daa] text-xs font-medium hover:bg-[rgba(5,109,170,0.06)] cursor-pointer">View All Records</button>
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#056daa] text-[#056daa] text-sm font-medium hover:bg-[rgba(5,109,170,0.06)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Today's Vehicles", value: stats.todayVehicles, icon: FiTruck, color: 'text-[#056daa]', bg: 'bg-[rgba(5,109,170,0.1)]' },
            { label: 'Currently Parked', value: stats.currentlyParked, icon: FiCheckCircle, color: 'text-[#388E3C]', bg: 'bg-[rgba(76,175,80,0.12)]', sub: stats.totalCapacity > 0 ? `${((stats.currentlyParked / stats.totalCapacity) * 100).toFixed(1)}% occupied` : '' },
            { label: 'Available Slots', value: stats.availableSlots, icon: FiMapPin, color: 'text-[#2980B9]', bg: 'bg-[rgba(41,128,185,0.1)]' },
            { label: 'Flagged Vehicles', value: stats.flaggedInside, icon: FiFlag, color: 'text-[#F39C12]', bg: 'bg-[rgba(243,156,18,0.12)]', sub: 'Currently inside', subOnTop: true, onClick: () => openFlagged(), hint: 'View flagged vehicles',
              extra: <button type="button" onClick={(e) => { e.stopPropagation(); openFlagged('all'); }} className="text-xs text-[#056daa] hover:underline mt-0.5 cursor-pointer">{stats.flaggedTotal} flagged in total</button> },
          ].map((s: any, i) => (
            <div key={i} className={`bg-white p-4 ${s.onClick ? 'cursor-pointer hover:ring-1 hover:ring-[#F39C12]' : ''}`} style={{ boxShadow: CARD_SHADOW }} onClick={s.onClick} title={s.hint} role={s.onClick ? 'button' : undefined}>
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-[#555555]">{s.label}</p>{loading && firstLoad ? <div className="h-7 w-14 bg-[#E0E0E0] animate-pulse mt-1" /> : <>{s.sub && s.subOnTop && <p className="text-xs text-[#9E9E9E] mt-0.5">{s.sub}</p>}<p className="text-xl font-bold text-[#333333] mt-0.5">{s.value}</p>{s.sub && !s.subOnTop && <p className="text-xs text-[#9E9E9E] mt-0.5">{s.sub}</p>}{s.extra}</>}</div>
                {s.onClick
                  ? <button type="button" onClick={(e) => { e.stopPropagation(); s.onClick(); }} aria-label={s.hint} className={`w-10 h-10 ${s.bg} flex items-center justify-center cursor-pointer hover:bg-[rgba(243,156,18,0.25)]`}><s.icon className={`w-5 h-5 ${s.color}`} /></button>
                  : <div className={`w-10 h-10 ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>}
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

        {showFlaggedModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" onClick={() => setShowFlaggedModal(false)}>
            <div className="bg-white w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-3 sm:p-4 flex items-center justify-between gap-2 bg-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[rgba(243,156,18,0.12)] flex items-center justify-center"><FiFlag className="w-4 h-4 text-[#F39C12]" /></div>
                  <div>
                    <h3 className="text-sm font-bold text-[#333333]">Flagged Vehicles</h3>
                    <p className="text-xs text-[#9E9E9E]">{flaggedTotal} vehicle{flaggedTotal === 1 ? '' : 's'} {flaggedScope === 'active' ? 'flagged and still parked' : flaggedScope === 'completed' ? 'flagged and already checked out' : 'flagged in total'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select value={flaggedScope} onChange={e => changeFlaggedScope(e.target.value as FlaggedScope)} className="cok-auth-input text-xs w-40 cursor-pointer" style={{ paddingLeft: '10px', minHeight: '32px' }}>
                    <option value="active">Inside now</option>
                    <option value="completed">Checked out</option>
                    <option value="all">All flagged</option>
                  </select>
                  <button onClick={() => fetchFlagged(flaggedPage)} disabled={flaggedLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#056daa] text-[#056daa] text-xs font-medium hover:bg-[rgba(5,109,170,0.06)] cursor-pointer disabled:opacity-50"><FiRefreshCw className={`w-3.5 h-3.5 ${flaggedLoading ? 'animate-spin' : ''}`} />Refresh</button>
                  <button onClick={() => setShowFlaggedModal(false)} className="p-1.5 hover:bg-gray-200 cursor-pointer shrink-0">X</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <Table
                  headers={[{ key: 'plate', label: 'Plate' }, { key: 'driver', label: 'Driver' }, { key: 'type', label: 'Type' }, { key: 'entry', label: 'Entry Time' }, { key: 'exit', label: 'Check-out' }, { key: 'duration', label: 'Time Parked' }, { key: 'status', label: 'Status' }]}
                  data={flaggedRecords}
                  loading={flaggedLoading}
                  emptyMessage={flaggedScope === 'active' ? 'No flagged vehicles are inside the parking right now. Switch to "All flagged" to see the history.' : 'No flagged vehicles found.'}
                  maxHeight="none"
                  minWidth="820px"
                  headerStyle={{ backgroundColor: '#F39C12' }}
                  renderCell={(header, r: any) => {
                    switch (header.key) {
                      case 'plate': return <span className="text-sm font-mono font-bold text-[#E74C3C] whitespace-nowrap">{r.plate_no || '-'}</span>;
                      case 'driver': return <span className="text-sm text-[#333333] whitespace-nowrap truncate max-w-[160px] inline-block align-middle" title={r.driver_name}>{r.driver_name || '-'}</span>;
                      case 'type': return <span className="text-xs px-2 py-0.5 bg-[rgba(51,51,51,0.08)] text-[#333333] whitespace-nowrap">{r.driver_type || '-'}</span>;
                      case 'entry': return <span className="text-xs text-[#555555] whitespace-nowrap">{r.entry_time ? new Date(r.entry_time).toLocaleString() : '-'}</span>;
                      case 'exit': return <span className="text-xs text-[#555555] whitespace-nowrap">{r.exit_time ? new Date(r.exit_time).toLocaleString() : <em className="text-[#388E3C]">still inside</em>}</span>;
                      case 'duration': return <span className="text-xs px-2 py-0.5 bg-[rgba(243,156,18,0.12)] text-[#B9770E] whitespace-nowrap">{r.duration || '-'}</span>;
                      case 'status': return <span className={`text-xs px-2 py-0.5 whitespace-nowrap ${r.status === 'active' ? 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]' : 'bg-[rgba(51,51,51,0.08)] text-[#555555]'}`}>{r.status === 'active' ? 'inside' : r.status === 'completed' ? 'checked out' : r.status || '-'}</span>;
                      default: return <span className="text-sm">{r[header.key] || '-'}</span>;
                    }
                  }}
                  pagination={flaggedTotal > PAGE_SIZE ? { currentPage: flaggedPage, totalPages: Math.max(1, Math.ceil(flaggedTotal / PAGE_SIZE)), totalCount: flaggedTotal, itemsPerPage: PAGE_SIZE, onPageChange: (page) => fetchFlagged(page), loading: flaggedLoading } : undefined}
                />
              </div>
            </div>
          </div>
        )}

        {showRecordsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" onClick={() => setShowRecordsModal(false)}>
            <div className="bg-white w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-3 sm:p-4 flex flex-col gap-3 bg-gray-50">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#333333]">All Parking Records</h3>
                  <button onClick={() => setShowRecordsModal(false)} className="p-1.5 hover:bg-gray-200 cursor-pointer shrink-0">X</button>
                </div>
                <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                  <input type="text" placeholder="Search plate, driver, phone, badge..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') fetchAllRecords(1); }} className="cok-auth-input pr-3 py-2 text-sm w-full sm:w-56" style={{ paddingLeft: '12px', minHeight: '36px' }} />
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="cok-auth-input text-sm w-full sm:w-36 cursor-pointer" style={{ paddingLeft: '10px', minHeight: '36px' }}>
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                  <select value={rangePreset} onChange={e => setRangePreset(e.target.value as any)} className="cok-auth-input text-sm w-full sm:w-36 cursor-pointer" style={{ paddingLeft: '10px', minHeight: '36px' }}>
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="custom">Custom Range</option>
                  </select>
                  {rangePreset === 'custom' && (
                    <>
                      <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="cok-auth-input text-sm w-full sm:w-40" style={{ paddingLeft: '10px', minHeight: '36px' }} />
                      <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="cok-auth-input text-sm w-full sm:w-40" style={{ paddingLeft: '10px', minHeight: '36px' }} />
                    </>
                  )}
                  <button onClick={() => fetchAllRecords(1)} className="px-4 py-1.5 text-white text-xs font-medium cursor-pointer w-full sm:w-auto" style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', minHeight: '36px' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}>Apply</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <Table
                  headers={[{ key: 'plate', label: 'Plate' }, { key: 'driver', label: 'Driver' }, { key: 'phone', label: 'Phone' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'checkin', label: 'Check-in' }, { key: 'checkout', label: 'Check-out' }]}
                  data={allRecords}
                  loading={modalLoading}
                  emptyMessage="No parking records found for the selected filters."
                  maxHeight="none"
                  minWidth="800px"
                  headerStyle={{ backgroundColor: PRIMARY }}
                  renderCell={(header, r: any) => {
                    switch (header.key) {
                      case 'plate': return <span className="text-sm font-medium text-[#333333] whitespace-nowrap">{r.plate_number || '-'}</span>;
                      case 'driver': return <span className="text-sm text-[#333333] whitespace-nowrap truncate max-w-[160px] inline-block align-middle" title={r.driver_name}>{r.driver_name || '-'}</span>;
                      case 'phone': return <span className="text-sm text-[#555555] whitespace-nowrap">{r.driver_telephone || '-'}</span>;
                      case 'type': return <span className="text-sm text-[#555555] whitespace-nowrap">{r.driver_type || '-'}</span>;
                      case 'status': return <span className={`text-xs px-2 py-0.5 whitespace-nowrap ${r.status === 'active' ? 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]' : 'bg-[rgba(51,51,51,0.08)] text-[#555555]'}`}>{r.status || '-'}</span>;
                      case 'checkin': return <span className="text-xs text-[#555555] whitespace-nowrap">{r.check_in ? new Date(r.check_in).toLocaleString() : '-'}</span>;
                      case 'checkout': return <span className="text-xs text-[#555555] whitespace-nowrap">{r.check_out ? new Date(r.check_out).toLocaleString() : '-'}</span>;
                      default: return <span className="text-sm">{r[header.key] || '-'}</span>;
                    }
                  }}
                  pagination={totalPages > 1 ? { currentPage, totalPages, totalCount: totalRecords, itemsPerPage: PAGE_SIZE, onPageChange: (page) => fetchAllRecords(page), loading: modalLoading } : undefined}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminSmartParkingDashboard;
