import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import ConfirmModal from '../../../core/components/Modals/ConfirmModal';
import { reservationService } from '../../../core/services/adminService';
import { FiInfo, FiSearch, FiEdit2, FiTrash2, FiClock, FiCheck, FiDownload, FiLoader, FiXCircle, FiCalendar, FiArrowLeft } from 'react-icons/fi';
import { VisitorReservationForm, StaffBookingForm } from './sub/ReservationForms';

interface Reservation { id: string; visitor_name: string; plate_number: string; telephone: string; id_type?: string; id_number?: string; expected_arrival: string; type: 'visitor' | 'staff'; status: 'active' | 'expired' | 'cancelled' | 'checked_in' | 'used'; valid_from?: string | null; valid_until?: string | null; created_at?: string; }

// City of Kigali (CoK) institutional design constants — same set as the receptionist dashboard
const PRIMARY = '#056daa';
const PRIMARY_HOVER = '#045d94';
const ACCENT_DARK_BLUE = '#2980B9';
const TERTIARY = '#CDB896';
const NEUTRAL_DARK = '#333333';
const NEUTRAL_LIGHT = '#F7F9FB';
const BORDER = '#E0E0E0';
const DANGER = '#E74C3C';
const WARNING = '#F39C12';
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';

// Status chips in the assigned-visitors style: bold uppercase on a soft tint
const STATUS_CHIP: Record<Reservation['status'], { bg: string; text: string; label: string }> = {
  active: { bg: 'rgba(76,175,80,0.12)', text: '#388E3C', label: 'Active' },
  checked_in: { bg: 'rgba(5,109,170,0.12)', text: PRIMARY, label: 'Checked In' },
  used: { bg: 'rgba(205,184,150,0.28)', text: '#8A6D3B', label: 'Used' },
  cancelled: { bg: 'rgba(231,76,60,0.12)', text: DANGER, label: 'Cancelled' },
  expired: { bg: 'rgba(51,51,51,0.08)', text: '#555555', label: 'Expired' },
};

const initialsOf = (name: string) => (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

// A reservation can be cancelled while it still has validity: active ones always;
// checked-in/used ones only while the End Date has not passed (null = open-ended)
const isCancellable = (r: Reservation) =>
  r.status === 'active' ? true
  : (r.status === 'checked_in' || r.status === 'used')
    ? (!r.valid_until || new Date(r.valid_until) >= new Date())
    : false;

// One uploaded file = one batch, named after the file — cancel/reschedule it as a whole
interface ReservationBatch { id: string; type: 'visitor' | 'staff'; batch_name: string; uploaded_at?: string | null; total: number; active: number; used: number; cancelled: number; start_date?: string | null; end_date?: string | null; }
interface ReservationFormData { plate_number: string; driver_name: string; id_type: string; id_number: string; telephone_number: string; slot_number: string; arrival_time?: string; }
interface StaffBookingData { staff_name: string; phone: string; plate_number: string; department_name?: string; owner_title?: string; id_type?: string; identification?: string; }

const ReservationsPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  // Search box draft — applied on Enter or the Search button (clearing applies immediately)
  const [draftSearch, setDraftSearch] = useState('');

  // Page shows one view at a time: forms (default), the reservation list, uploaded batches, or history
  const [view, setView] = useState<'management' | 'list' | 'batches' | 'history'>('management');

  // Reservation history: search + pagination (all statuses, download as CSV)
  const [historySearch, setHistorySearch] = useState('');
  const [draftHistorySearch, setDraftHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);

  // Uploaded-file batches: list + search + pagination + action modals
  const [batches, setBatches] = useState<ReservationBatch[]>([]);
  const [batchSearch, setBatchSearch] = useState('');
  const [draftBatchSearch, setDraftBatchSearch] = useState('');
  const [batchPage, setBatchPage] = useState(1);
  const [batchToCancel, setBatchToCancel] = useState<ReservationBatch | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<ReservationBatch | null>(null);
  const [batchToReschedule, setBatchToReschedule] = useState<ReservationBatch | null>(null);
  const [resStart, setResStart] = useState('');
  const [resEnd, setResEnd] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const visitorFileInputRef = useRef<HTMLInputElement>(null);
  const staffFileInputRef = useRef<HTMLInputElement>(null);

  const [visitorFormData, setVisitorFormData] = useState<ReservationFormData>({ plate_number: '', driver_name: '', id_type: 'NID', id_number: '', telephone_number: '', slot_number: '', arrival_time: '' });
  const [staffFormData, setStaffBookingData] = useState<StaffBookingData>({ staff_name: '', phone: '', plate_number: '', department_name: '', owner_title: '', id_type: 'NID', identification: '' });
  const [visitorBulkFile, setVisitorBulkFile] = useState<File | null>(null);
  const [staffBulkFile, setStaffBulkFile] = useState<File | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null);
  const [reservationToReschedule, setReservationToReschedule] = useState<Reservation | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState<Reservation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Multi-select for bulk cancel/delete — keyed by `${type}:${id}` since visitor and staff ids come from different collections
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'cancel' | 'delete' | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const keyOf = (r: Reservation) => `${r.type}:${r.id}`;
  const toggleSelected = (r: Reservation) => setSelectedKeys(prev => {
    const next = new Set(prev);
    const k = keyOf(r);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  useEffect(() => { fetchReservations(); fetchBatches(); }, []);

  const fetchReservations = async () => {
    try { const r = await reservationService.getAll(); if (r.success) setReservations(r.reservations || []); }
    catch (error) { console.error(error); }
  };

  const fetchBatches = async () => {
    try { const r: any = await reservationService.getBatches(); if (r.success) setBatches(r.batches || []); }
    catch (error) { console.error(error); }
  };

  const confirmBatchCancel = async () => {
    if (!batchToCancel) return;
    setBatchLoading(true);
    try {
      const d: any = await reservationService.cancelBatch(batchToCancel.id, batchToCancel.type);
      if (d.success) { showSuccess(d.message || 'Batch cancelled'); fetchBatches(); fetchReservations(); }
      else showError(d.message || 'Failed');
    } catch (error) { showError(error.message); } finally { setBatchLoading(false); setBatchToCancel(null); }
  };

  // Permanently removes the whole uploaded file and every reservation in it
  const confirmBatchDelete = async () => {
    if (!batchToDelete) return;
    setBatchLoading(true);
    try {
      const d: any = await reservationService.deleteBatch(batchToDelete.id, batchToDelete.type);
      if (d.success) { showSuccess(d.message || 'Batch deleted'); fetchBatches(); fetchReservations(); }
      else showError(d.message || 'Failed');
    } catch (error) { showError(error.message); } finally { setBatchLoading(false); setBatchToDelete(null); }
  };

  // Reschedule replaces the dates of every not-yet-used reservation in the batch
  // (cancelled/expired ones are revived for the new window)
  const confirmBatchReschedule = async () => {
    if (!batchToReschedule) return;
    if (!resStart && !resEnd) { showError('Set a start date, an end date, or both'); return; }
    setBatchLoading(true);
    try {
      const d: any = await reservationService.rescheduleBatch(batchToReschedule.id, batchToReschedule.type, resStart, resEnd);
      if (d.success) { showSuccess(d.message || 'Batch rescheduled'); fetchBatches(); fetchReservations(); setBatchToReschedule(null); setResStart(''); setResEnd(''); }
      else showError(d.message || 'Failed');
    } catch (error) { showError(error.message); } finally { setBatchLoading(false); }
  };

  // Same rules as the batch version, applied to one reservation (cancelled/expired ones are revived)
  const confirmReservationReschedule = async () => {
    if (!reservationToReschedule) return;
    if (!resStart && !resEnd) { showError('Set a start date, an end date, or both'); return; }
    setRescheduleLoading(true);
    try {
      const d: any = await reservationService.rescheduleReservation(reservationToReschedule.id, reservationToReschedule.type, resStart, resEnd);
      if (d.success) { showSuccess(d.message || 'Reservation rescheduled'); fetchReservations(); setReservationToReschedule(null); setResStart(''); setResEnd(''); }
      else showError(d.message || 'Failed');
    } catch (error) { showError(error.message); } finally { setRescheduleLoading(false); }
  };

  const handleVisitorSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try { const r = await reservationService.createVisitorReservation(visitorFormData);
      if (r.success) { showSuccess(r.message || 'Visitor reservation created!'); setVisitorFormData({ plate_number: '', driver_name: '', id_type: 'NID', id_number: '', telephone_number: '', slot_number: '', arrival_time: '' }); fetchReservations(); }
      else showError(r.message || 'Failed');
    } catch (error) { showError(error.message); } finally { setLoading(false); }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try { const r = await reservationService.createStaffBooking(staffFormData);
      if (r.success) { showSuccess(r.message || 'Staff slot allocated!'); setStaffBookingData({ staff_name: '', phone: '', plate_number: '', department_name: '', owner_title: '', id_type: 'NID', identification: '' }); fetchReservations(); }
      else showError(r.message || 'Failed');
    } catch (error) { showError(error.message); } finally { setLoading(false); }
  };

  const handleVisitorFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const ext = '.' + file.name.split('.').pop()?.toLowerCase(); if (['.xlsx', '.xls', '.csv'].includes(ext)) { setVisitorBulkFile(file); showSuccess(`File "${file.name}" selected`); } else showError('Invalid file type'); e.target.value = ''; }
  };

  const handleStaffFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const ext = '.' + file.name.split('.').pop()?.toLowerCase(); if (['.xlsx', '.xls', '.csv'].includes(ext)) { setStaffBulkFile(file); showSuccess(`File "${file.name}" selected`); } else showError('Invalid file type'); e.target.value = ''; }
  };

  const handleVisitorBulkUpload = async () => {
    if (!visitorBulkFile) { showError('Select a file'); return; }
    setLoading(true); const fd = new FormData(); fd.append('file', visitorBulkFile);
    try { const d = await reservationService.bulkUploadVisitors(fd); if (d.success) { showSuccess(d.message || 'Uploaded!'); setVisitorBulkFile(null); fetchReservations(); } else showError(d.message || 'Failed'); }
    catch (error) { showError(error.message); } finally { setLoading(false); }
  };

  const handleStaffBulkUpload = async () => {
    if (!staffBulkFile) { showError('Select a file'); return; }
    setLoading(true); const fd = new FormData(); fd.append('file', staffBulkFile);
    try { const d = await reservationService.bulkUploadStaff(fd); if (d.success) { showSuccess(d.message || 'Uploaded!'); setStaffBulkFile(null); fetchReservations(); } else showError(d.message || 'Failed'); }
    catch (error) { showError(error.message); } finally { setLoading(false); }
  };

  // Build an .xlsx template where the given columns are pre-formatted as TEXT for the
  // first 100 data rows \u2014 long ID numbers keep their digits (no scientific notation)
  // and dates typed as day/month/year stay literal instead of being auto-converted.
  const buildTemplate = (headers: string[], example: string[], textCols: number[], sheetName: string, fileName: string) => {
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    for (let r = 1; r <= 100; r++) {
      for (const c of textCols) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: 's', v: '' };
        ws[addr].t = 's';
        ws[addr].z = '@';
      }
    }
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 100, c: headers.length - 1 } });
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    // Download via a plain anchor (like the old CSV path) so the file saves immediately
    // with its name instead of opening a save-as dialog
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
    showSuccess('Template downloaded');
  };

  const downloadVisitorTemplate = () => {
    // Start Date / End Date (day/month/year) define the reservation window; the vehicle
    // is only received as reserved between those days. Leave a date empty for open-ended.
    buildTemplate(
      ['Name', 'Plate Number', 'ID Type', 'ID Number', 'Phone', 'Start Date', 'End Date'],
      ['', '', 'NID', '', '', '10/08/2026', '31/12/2026'],
      [3, 4, 5, 6], // ID Number, Phone and both dates stay text
      'Visitors',
      'visitor_reservation_template.xlsx'
    );
  };

  const downloadStaffTemplate = () => {
    // Same window rules as visitor uploads: Start/End Date in day/month/year;
    // leave both empty for a permanent allocation
    buildTemplate(
      ['Staff Name', 'Plate Number', 'Phone', 'Department', 'Title', 'ID Type', 'ID Number', 'Start Date', 'End Date'],
      ['', '', '', '', '', 'NID', '', '10/08/2026', '31/12/2026'],
      [2, 6, 7, 8], // Phone, ID Number and both dates stay text
      'Staff',
      'staff_booking_template.xlsx'
    );
  };

  // Exports what the history view currently shows (search filter applied, all statuses)
  const downloadHistoryCSV = () => {
    const h = ['Name', 'Plate Number', 'ID Number', 'Telephone', 'Type', 'Status', 'Start Date', 'End Date', 'Created'];
    const rows = filteredHistory.map(r => [
      `"${r.visitor_name}"`, `"${r.plate_number}"`, `"${r.id_number || ''}"`, `"${r.telephone || ''}"`, r.type, r.status,
      `"${r.valid_from ? new Date(r.valid_from).toLocaleDateString() : ''}"`,
      `"${r.valid_until ? new Date(r.valid_until).toLocaleDateString() : ''}"`,
      `"${r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}"`
    ].join(','));
    const blob = new Blob(['\ufeff' + [h.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `reservation_history_${new Date().toISOString().split('T')[0]}.csv`; link.click();
    showSuccess('History downloaded');
  };

  const handleCancelClick = (r: Reservation) => { setReservationToCancel(r); setShowCancelModal(true); };
  const confirmCancel = async () => {
    if (!reservationToCancel) return;
    try { const d = await reservationService.cancelReservation(reservationToCancel.id, reservationToCancel.type); if (d.success) { showSuccess('Cancelled'); setTimeout(fetchReservations, 500); } else showError(d.message || 'Failed'); }
    catch (error) { showError(error.message); } finally { setShowCancelModal(false); setReservationToCancel(null); }
  };

  // Permanent single-row delete — reuses the bulk-delete endpoint with one item
  const confirmDelete = async () => {
    if (!reservationToDelete) return;
    setDeleteLoading(true);
    try {
      const d = await reservationService.bulkDeleteReservations([{ id: reservationToDelete.id, type: reservationToDelete.type }]);
      if (d.success) {
        showSuccess('Reservation deleted');
        setSelectedKeys(prev => { const next = new Set(prev); next.delete(keyOf(reservationToDelete)); return next; });
        fetchReservations();
      } else showError(d.message || 'Failed');
    } catch (error) { showError(error.message); } finally { setDeleteLoading(false); setReservationToDelete(null); }
  };

  // Bulk cancel/delete of every selected reservation
  const confirmBulkAction = async () => {
    if (!bulkAction || selectedKeys.size === 0) return;
    const items = reservations.filter(r => selectedKeys.has(keyOf(r))).map(r => ({ id: r.id, type: r.type }));
    setBulkLoading(true);
    try {
      const d = bulkAction === 'delete'
        ? await reservationService.bulkDeleteReservations(items)
        : await reservationService.bulkCancelReservations(items);
      if (d.success) { showSuccess(d.message || 'Done'); setSelectedKeys(new Set()); fetchReservations(); }
      else showError(d.message || 'Failed');
    } catch (error) { showError(error.message); } finally { setBulkLoading(false); setBulkAction(null); }
  };

  const filteredReservations = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return reservations.filter(r => r.status !== 'cancelled' && (
      (r.visitor_name || '').toLowerCase().includes(q)
      || (r.plate_number || '').toLowerCase().includes(q)
      || (r.telephone || '').toLowerCase().includes(q)
    ));
  }, [reservations, searchTerm]);
  const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);
  const paginated = filteredReservations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // History keeps every status (cancelled/expired/used included) — the list view hides cancelled
  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase();
    return reservations.filter(r =>
      (r.visitor_name || '').toLowerCase().includes(q)
      || (r.plate_number || '').toLowerCase().includes(q)
      || (r.telephone || '').toLowerCase().includes(q)
    );
  }, [reservations, historySearch]);
  const historyTotalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage);

  const filteredBatches = useMemo(
    () => batches.filter(b => (b.batch_name || '').toLowerCase().includes(batchSearch.toLowerCase())),
    [batches, batchSearch]
  );
  const batchTotalPages = Math.ceil(filteredBatches.length / itemsPerPage);
  const paginatedBatches = filteredBatches.slice((batchPage - 1) * itemsPerPage, batchPage * itemsPerPage);

  if (authLoading) return <div className="flex items-center justify-center min-h-[600px]"><LoadingSpinner message="Loading..." /></div>;

  return (
    <MainLayout>
      <div className="px-4 py-4">
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
              <FiInfo className="w-4 h-4" style={{ color: PRIMARY }} />
              {view === 'management' ? 'Parking Reservation Management' : view === 'list' ? 'Reservation List' : view === 'history' ? 'Reservation History' : 'Uploaded Files'}
            </h1>
            <p className="text-xs mt-0.5 text-[#555555]">
              {view === 'management' ? 'Manage visitor and staff parking slot allocations'
              : view === 'list' ? 'View and manage all parking reservations'
              : view === 'history' ? 'Full record of every reservation — including cancelled and used'
              : 'Cancel or reschedule a whole uploaded file at once'}
            </p>
          </div>
          {/* View switch: forms (default) or the reservation list — CoK square uppercase buttons */}
          <div className="flex gap-3 self-start sm:self-auto">
            <button
              onClick={() => setView('management')}
              className="px-4 py-2 text-xs font-semibold uppercase transition-colors"
              style={{ fontFamily: fontHeading, letterSpacing: '1px', borderRadius: 0, border: `1px solid ${PRIMARY}`, backgroundColor: view === 'management' ? PRIMARY : 'transparent', color: view === 'management' ? '#fff' : PRIMARY }}
            >
              Reservation Management
            </button>
            <button
              onClick={() => setView('list')}
              className="px-4 py-2 text-xs font-semibold uppercase transition-colors"
              style={{ fontFamily: fontHeading, letterSpacing: '1px', borderRadius: 0, border: `1px solid ${PRIMARY}`, backgroundColor: view === 'list' ? PRIMARY : 'transparent', color: view === 'list' ? '#fff' : PRIMARY }}
            >
              View Reservation List ({filteredReservations.length})
            </button>
            <button
              onClick={() => { setView('batches'); fetchBatches(); }}
              className="px-4 py-2 text-xs font-semibold uppercase transition-colors"
              style={{ fontFamily: fontHeading, letterSpacing: '1px', borderRadius: 0, border: `1px solid ${PRIMARY}`, backgroundColor: view === 'batches' ? PRIMARY : 'transparent', color: view === 'batches' ? '#fff' : PRIMARY }}
            >
              Uploaded Files ({batches.length})
            </button>
          </div>
        </div>

        {view === 'management' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <VisitorReservationForm formData={visitorFormData} loading={loading} onChange={setVisitorFormData} onSubmit={handleVisitorSubmit} onDownloadTemplate={downloadVisitorTemplate} bulkFile={visitorBulkFile} onFileSelect={handleVisitorFileSelect} onFileRemove={() => setVisitorBulkFile(null)} onBulkUpload={handleVisitorBulkUpload} fileInputRef={visitorFileInputRef as any} />
          <StaffBookingForm formData={staffFormData} loading={loading} onChange={setStaffBookingData} onSubmit={handleStaffSubmit} onDownloadTemplate={downloadStaffTemplate} bulkFile={staffBulkFile} onFileSelect={handleStaffFileSelect} onFileRemove={() => setStaffBulkFile(null)} onBulkUpload={handleStaffBulkUpload} fileInputRef={staffFileInputRef as any} />
        </div>
        )}

        {view === 'list' && (
        <div className="bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          {/* Search bar directly above the table: full-width input with an attached solid Search button */}
          <div className="px-6 pt-5 pb-3 flex items-center gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search Plate, Name, Phone..."
                value={draftSearch}
                onChange={e => { setDraftSearch(e.target.value); if (e.target.value === '') { setSearchTerm(''); setCurrentPage(1); } }}
                onKeyDown={e => { if (e.key === 'Enter') { setSearchTerm(draftSearch); setCurrentPage(1); } }}
                className="cok-auth-input w-full text-sm"
                style={{ fontFamily: fontHeading }}
              />
            </div>
            <button
              onClick={() => { setSearchTerm(draftSearch); setCurrentPage(1); }}
              className="h-11 px-6 text-white text-[13px] font-semibold uppercase transition-colors flex-shrink-0"
              style={{ fontFamily: fontHeading, backgroundColor: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
            >
              Search
            </button>
            <button
              onClick={() => { setView('history'); setDraftHistorySearch(''); setHistorySearch(''); setHistoryPage(1); }}
              className="flex items-center gap-2 h-11 px-4 bg-transparent text-[13px] font-semibold uppercase transition-colors hover:bg-[rgba(5,109,170,0.08)] flex-shrink-0"
              style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
            >
              <FiClock className="w-4 h-4" /> History
            </button>
            {/* Deletes the checked rows — prompts to tick some first when nothing is selected */}
            <button
              onClick={() => { if (selectedKeys.size === 0) { showError('Tick the reservations you want to delete first'); return; } setBulkAction('delete'); }}
              className="flex items-center gap-2 h-11 px-4 bg-transparent text-[13px] font-semibold uppercase transition-colors hover:bg-[rgba(231,76,60,0.08)] flex-shrink-0"
              style={{ fontFamily: fontHeading, border: `1px solid ${DANGER}`, color: DANGER, letterSpacing: '1px', borderRadius: 0 }}
            >
              <FiTrash2 className="w-4 h-4" /> Delete{selectedKeys.size > 0 ? ` (${selectedKeys.size})` : ''}
            </button>
          </div>
          {selectedKeys.size > 0 && (() => {
            // "Cancel Selected" only appears when EVERY selected reservation can still be
            // cancelled — checked-in ones qualify only while their End Date has days left
            const selectedRows = reservations.filter(r => selectedKeys.has(keyOf(r)));
            const canCancelSelection = selectedRows.length > 0 && selectedRows.every(isCancellable);
            return (
            <div className="px-6 py-2.5 flex items-center justify-between gap-3" style={{ backgroundColor: 'rgba(5,109,170,0.06)', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
              <span className="text-[13px] font-semibold" style={{ fontFamily: fontHeading, color: PRIMARY }}>{selectedKeys.size} selected</span>
              <div className="flex items-center gap-2">
                {canCancelSelection && (
                  <button onClick={() => setBulkAction('cancel')} disabled={bulkLoading} className="px-3 py-1.5 text-white text-xs font-semibold uppercase disabled:opacity-50" style={{ fontFamily: fontHeading, backgroundColor: WARNING, letterSpacing: '1px', borderRadius: 0 }}>Cancel Selected</button>
                )}
                <button onClick={() => setBulkAction('delete')} disabled={bulkLoading} className="px-3 py-1.5 text-white text-xs font-semibold uppercase disabled:opacity-50" style={{ fontFamily: fontHeading, backgroundColor: DANGER, letterSpacing: '1px', borderRadius: 0 }}>Delete Selected</button>
                <button onClick={() => setSelectedKeys(new Set())} className="px-3 py-1.5 text-xs font-semibold uppercase hover:bg-[rgba(5,109,170,0.08)]" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>Clear</button>
              </div>
            </div>
            );
          })()}
          <div className="overflow-x-auto px-6">
            <table className="w-full min-w-[720px]">
              {/* Solid CoK-blue header bar — same as the receptionist Assigned Visitors table */}
              <thead className="cok-bg-primary sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="text-left py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={paginated.length > 0 && paginated.every(r => selectedKeys.has(keyOf(r)))}
                      onChange={e => setSelectedKeys(prev => {
                        const next = new Set(prev);
                        paginated.forEach(r => { if (e.target.checked) next.add(keyOf(r)); else next.delete(keyOf(r)); });
                        return next;
                      })}
                      className="w-3.5 h-3.5 cursor-pointer"
                    />
                  </th>
                  {['Visitor Name', 'Plate Number', 'Telephone', 'Period', 'Type', 'Status', 'Action'].map(h => (
                    <th key={h} className="text-left py-3 px-0 text-xs uppercase tracking-wider font-semibold text-white" style={{ fontFamily: fontHeading, letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length > 0 ? paginated.map(r => (
                  <tr key={keyOf(r)} className="h-14" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: selectedKeys.has(keyOf(r)) ? 'rgba(5,109,170,0.05)' : 'transparent' }}>
                    <td className="py-3 px-3">
                      <input type="checkbox" checked={selectedKeys.has(keyOf(r))} onChange={() => toggleSelected(r)} className="w-3.5 h-3.5 cursor-pointer" />
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: r.type === 'staff' ? ACCENT_DARK_BLUE : PRIMARY, fontFamily: fontHeading }}>
                          {initialsOf(r.visitor_name)}
                        </div>
                        <span className="text-[#333] text-[13px] font-medium">{r.visitor_name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-[#333] text-[13px] font-mono font-semibold">{r.plate_number}</td>
                    <td className="py-3 text-[#555555] text-[13px]">{r.telephone || '—'}</td>
                    <td className="py-3 text-[#555555] text-[13px] font-medium whitespace-nowrap">
                      {(r.valid_from || r.valid_until)
                        ? `${r.valid_from ? new Date(r.valid_from).toLocaleDateString() : 'Any'} → ${r.valid_until ? new Date(r.valid_until).toLocaleDateString() : 'No expiry'}`
                        : '—'}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-3 py-1 text-[12px] font-bold uppercase tracking-wide" style={{ backgroundColor: r.type === 'staff' ? 'rgba(41,128,185,0.12)' : 'rgba(76,175,80,0.12)', color: r.type === 'staff' ? ACCENT_DARK_BLUE : '#388E3C' }}>
                        {r.type}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-3 py-1 text-[12px] font-bold uppercase tracking-wide" style={{ backgroundColor: STATUS_CHIP[r.status]?.bg, color: STATUS_CHIP[r.status]?.text }}>
                        {STATUS_CHIP[r.status]?.label || r.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {r.status === 'cancelled' && (
                          <button onClick={async () => { const d = await reservationService.reactivateReservation(r.id); if (d.success) { showSuccess('Reactivated'); fetchReservations(); } }} title="Reactivate" className="p-1.5 transition-colors hover:bg-[rgba(76,175,80,0.1)]" style={{ color: '#388E3C', borderRadius: 0 }}><FiCheck className="w-4 h-4" /></button>
                        )}
                        {/* Reschedule replaces this reservation's dates — hidden once the vehicle arrived */}
                        {r.status !== 'used' && r.status !== 'checked_in' && (
                          <button onClick={() => { setReservationToReschedule(r); setResStart(''); setResEnd(''); }} title="Reschedule reservation" className="p-1.5 transition-colors hover:bg-[rgba(5,109,170,0.1)]" style={{ color: PRIMARY, borderRadius: 0 }}><FiCalendar className="w-4 h-4" /></button>
                        )}
                        {r.status !== 'cancelled' && isCancellable(r) && (
                          <button onClick={() => handleCancelClick(r)} title="Cancel reservation" className="p-1.5 transition-colors hover:bg-[rgba(243,156,18,0.12)]" style={{ color: WARNING, borderRadius: 0 }}><FiXCircle className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => setReservationToDelete(r)} title="Delete reservation" className="p-1.5 transition-colors hover:bg-[rgba(231,76,60,0.1)]" style={{ color: DANGER, borderRadius: 0 }}><FiTrash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={8} className="py-10 text-center text-[13px] text-[#9E9E9E]">No reservations found</td></tr>}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-6 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${BORDER}` }}>
              <span className="text-[12px] text-[#555555]" style={{ fontFamily: fontHeading }}>
                Page {currentPage} of {totalPages} · {filteredReservations.length} reservations
              </span>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="px-3 py-1.5 text-[12px] font-semibold uppercase disabled:opacity-40 hover:bg-[rgba(5,109,170,0.08)]" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>Prev</button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="px-3 py-1.5 text-[12px] font-semibold uppercase disabled:opacity-40 hover:bg-[rgba(5,109,170,0.08)]" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>Next</button>
              </div>
            </div>
          )}
        </div>
        )}

        {view === 'batches' && (
        <div className="bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          {/* Search by uploaded file name */}
          <div className="px-6 pt-5 pb-3 flex items-center gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by file name..."
                value={draftBatchSearch}
                onChange={e => { setDraftBatchSearch(e.target.value); if (e.target.value === '') { setBatchSearch(''); setBatchPage(1); } }}
                onKeyDown={e => { if (e.key === 'Enter') { setBatchSearch(draftBatchSearch); setBatchPage(1); } }}
                className="cok-auth-input w-full text-sm"
                style={{ fontFamily: fontHeading }}
              />
            </div>
            <button
              onClick={() => { setBatchSearch(draftBatchSearch); setBatchPage(1); }}
              className="h-11 px-6 text-white text-[13px] font-semibold uppercase transition-colors flex-shrink-0"
              style={{ fontFamily: fontHeading, backgroundColor: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
            >
              Search
            </button>
          </div>
          <div className="overflow-x-auto px-6">
            <table className="w-full min-w-[820px]">
              <thead className="cok-bg-primary sticky top-0 z-10 shadow-sm">
                <tr>
                  {['File Name', 'Type', 'Uploaded', 'Reservations', 'Period', 'Action'].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs uppercase tracking-wider font-semibold text-white" style={{ fontFamily: fontHeading, letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedBatches.length > 0 ? paginatedBatches.map(b => (
                  <tr key={`${b.type}:${b.id}`} className="h-14" style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td className="py-3 px-3 text-[#333] text-[13px] font-medium">{b.batch_name}</td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-3 py-1 text-[12px] font-bold uppercase tracking-wide" style={{ backgroundColor: b.type === 'staff' ? 'rgba(41,128,185,0.12)' : 'rgba(76,175,80,0.12)', color: b.type === 'staff' ? ACCENT_DARK_BLUE : '#388E3C' }}>
                        {b.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#555555] text-[13px]">{b.uploaded_at ? new Date(b.uploaded_at).toLocaleDateString() : '—'}</td>
                    <td className="py-3 px-3 text-[#555555] text-[13px] whitespace-nowrap">
                      {b.total} total · <span style={{ color: '#388E3C' }}>{b.active} active</span> · {b.used} used · <span style={{ color: DANGER }}>{b.cancelled} cancelled</span>
                    </td>
                    <td className="py-3 px-3 text-[#555555] text-[13px] font-medium whitespace-nowrap">
                      {(b.start_date || b.end_date)
                        ? `${b.start_date ? new Date(b.start_date).toLocaleDateString() : 'Any'} → ${b.end_date ? new Date(b.end_date).toLocaleDateString() : 'No expiry'}`
                        : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setBatchToReschedule(b); setResStart(''); setResEnd(''); }}
                          className="px-3 py-1.5 text-white text-[11px] font-semibold uppercase"
                          style={{ fontFamily: fontHeading, backgroundColor: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
                        >
                          Reschedule
                        </button>
                        {b.active > 0 && (
                          <button
                            onClick={() => setBatchToCancel(b)}
                            className="px-3 py-1.5 text-[11px] font-semibold uppercase hover:bg-[rgba(231,76,60,0.08)]"
                            style={{ fontFamily: fontHeading, border: `1px solid ${DANGER}`, color: DANGER, letterSpacing: '1px', borderRadius: 0 }}
                          >
                            Cancel Batch
                          </button>
                        )}
                        <button
                          onClick={() => setBatchToDelete(b)}
                          className="px-3 py-1.5 text-white text-[11px] font-semibold uppercase"
                          style={{ fontFamily: fontHeading, backgroundColor: DANGER, letterSpacing: '1px', borderRadius: 0 }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={6} className="py-10 text-center text-[13px] text-[#9E9E9E]">No uploaded files found</td></tr>}
              </tbody>
            </table>
          </div>
          {batchTotalPages > 1 && (
            <div className="px-6 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${BORDER}` }}>
              <span className="text-[12px] text-[#555555]" style={{ fontFamily: fontHeading }}>
                Page {batchPage} of {batchTotalPages} · {filteredBatches.length} files
              </span>
              <div className="flex gap-2">
                <button onClick={() => setBatchPage(p => Math.max(1, p - 1))} disabled={batchPage <= 1} className="px-3 py-1.5 text-[12px] font-semibold uppercase disabled:opacity-40 hover:bg-[rgba(5,109,170,0.08)]" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>Prev</button>
                <button onClick={() => setBatchPage(p => Math.min(batchTotalPages, p + 1))} disabled={batchPage >= batchTotalPages} className="px-3 py-1.5 text-[12px] font-semibold uppercase disabled:opacity-40 hover:bg-[rgba(5,109,170,0.08)]" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>Next</button>
              </div>
            </div>
          )}
        </div>
        )}

        {view === 'history' && (
        <div className="bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          {/* Back to the manageable list + search + CSV download of what is shown */}
          <div className="px-6 pt-5 pb-3 flex items-center gap-3">
            <button
              onClick={() => setView('list')}
              className="flex items-center gap-2 h-11 px-4 bg-transparent text-[13px] font-semibold uppercase transition-colors hover:bg-[rgba(5,109,170,0.08)] flex-shrink-0"
              style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
            >
              <FiArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search Plate, Name, Phone..."
                value={draftHistorySearch}
                onChange={e => { setDraftHistorySearch(e.target.value); if (e.target.value === '') { setHistorySearch(''); setHistoryPage(1); } }}
                onKeyDown={e => { if (e.key === 'Enter') { setHistorySearch(draftHistorySearch); setHistoryPage(1); } }}
                className="cok-auth-input w-full text-sm"
                style={{ fontFamily: fontHeading }}
              />
            </div>
            <button
              onClick={() => { setHistorySearch(draftHistorySearch); setHistoryPage(1); }}
              className="h-11 px-6 text-white text-[13px] font-semibold uppercase transition-colors flex-shrink-0"
              style={{ fontFamily: fontHeading, backgroundColor: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
            >
              Search
            </button>
            <button
              onClick={downloadHistoryCSV}
              className="flex items-center gap-2 h-11 px-4 bg-transparent text-[13px] font-semibold uppercase transition-colors hover:bg-[rgba(5,109,170,0.08)] flex-shrink-0"
              style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
            >
              <FiDownload className="w-4 h-4" /> Download CSV
            </button>
          </div>
          <div className="overflow-x-auto px-6">
            <table className="w-full min-w-[760px]">
              <thead className="cok-bg-primary sticky top-0 z-10 shadow-sm">
                <tr>
                  {['Visitor Name', 'Plate Number', 'Telephone', 'Period', 'Type', 'Status', 'Created'].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs uppercase tracking-wider font-semibold text-white" style={{ fontFamily: fontHeading, letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.length > 0 ? paginatedHistory.map(r => (
                  <tr key={keyOf(r)} className="h-14" style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: r.type === 'staff' ? ACCENT_DARK_BLUE : PRIMARY, fontFamily: fontHeading }}>
                          {initialsOf(r.visitor_name)}
                        </div>
                        <span className="text-[#333] text-[13px] font-medium">{r.visitor_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-[#333] text-[13px] font-mono font-semibold">{r.plate_number}</td>
                    <td className="py-3 px-3 text-[#555555] text-[13px]">{r.telephone || '—'}</td>
                    <td className="py-3 px-3 text-[#555555] text-[13px] font-medium whitespace-nowrap">
                      {(r.valid_from || r.valid_until)
                        ? `${r.valid_from ? new Date(r.valid_from).toLocaleDateString() : 'Any'} → ${r.valid_until ? new Date(r.valid_until).toLocaleDateString() : 'No expiry'}`
                        : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-3 py-1 text-[12px] font-bold uppercase tracking-wide" style={{ backgroundColor: r.type === 'staff' ? 'rgba(41,128,185,0.12)' : 'rgba(76,175,80,0.12)', color: r.type === 'staff' ? ACCENT_DARK_BLUE : '#388E3C' }}>
                        {r.type}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-3 py-1 text-[12px] font-bold uppercase tracking-wide" style={{ backgroundColor: STATUS_CHIP[r.status]?.bg, color: STATUS_CHIP[r.status]?.text }}>
                        {STATUS_CHIP[r.status]?.label || r.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#555555] text-[13px] whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                )) : <tr><td colSpan={7} className="py-10 text-center text-[13px] text-[#9E9E9E]">No reservation history found</td></tr>}
              </tbody>
            </table>
          </div>
          {historyTotalPages > 1 && (
            <div className="px-6 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${BORDER}` }}>
              <span className="text-[12px] text-[#555555]" style={{ fontFamily: fontHeading }}>
                Page {historyPage} of {historyTotalPages} · {filteredHistory.length} reservations
              </span>
              <div className="flex gap-2">
                <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage <= 1} className="px-3 py-1.5 text-[12px] font-semibold uppercase disabled:opacity-40 hover:bg-[rgba(5,109,170,0.08)]" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>Prev</button>
                <button onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))} disabled={historyPage >= historyTotalPages} className="px-3 py-1.5 text-[12px] font-semibold uppercase disabled:opacity-40 hover:bg-[rgba(5,109,170,0.08)]" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>Next</button>
              </div>
            </div>
          )}
        </div>
        )}

        <ConfirmModal
          isOpen={!!batchToCancel}
          title="Cancel Whole Upload"
          message={<>Cancel all <strong>{batchToCancel?.active}</strong> active reservation(s) from <strong>{batchToCancel?.batch_name}</strong>?</>}
          confirmText="Yes, Cancel All"
          cancelText="No"
          type="warning"
          isLoading={batchLoading}
          onConfirm={confirmBatchCancel}
          onCancel={() => setBatchToCancel(null)}
        />

        <ConfirmModal
          isOpen={!!batchToDelete}
          title="Delete Whole Upload"
          message={<>Permanently delete <strong>{batchToDelete?.batch_name}</strong> and all its <strong>{batchToDelete?.total}</strong> reservation(s)? This cannot be undone.</>}
          confirmText="Yes, Delete All"
          cancelText="No"
          type="danger"
          isLoading={batchLoading}
          onConfirm={confirmBatchDelete}
          onCancel={() => setBatchToDelete(null)}
        />

        {batchToReschedule && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md p-6" style={{ boxShadow: CARD_SHADOW, borderRadius: 0 }}>
              <h3 className="text-[16px] font-bold mb-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Reschedule Upload</h3>
              <p className="text-sm text-[#555555] mb-4">
                Set a new reservation window for every pending reservation in <strong>{batchToReschedule.batch_name}</strong>. The dates from the file are replaced; cancelled or expired entries become active again.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="cok-auth-label">Start Date</label>
                  <input type="date" value={resStart} onChange={e => setResStart(e.target.value)} className="cok-auth-input w-full text-sm" style={{ fontFamily: fontHeading, paddingLeft: '12px' }} />
                </div>
                <div>
                  <label className="cok-auth-label">End Date</label>
                  <input type="date" value={resEnd} onChange={e => setResEnd(e.target.value)} className="cok-auth-input w-full text-sm" style={{ fontFamily: fontHeading, paddingLeft: '12px' }} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setBatchToReschedule(null); setResStart(''); setResEnd(''); }} disabled={batchLoading} className="flex-1 px-3 py-2 text-sm font-semibold uppercase hover:bg-[rgba(5,109,170,0.08)] disabled:opacity-50" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>Close</button>
                <button onClick={confirmBatchReschedule} disabled={batchLoading} className="flex-1 px-3 py-2 text-white text-sm font-semibold uppercase disabled:opacity-50" style={{ fontFamily: fontHeading, backgroundColor: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>
                  {batchLoading ? 'Working…' : 'Apply New Dates'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Same modal as the batch reschedule, scoped to one reservation */}
        {reservationToReschedule && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md p-6" style={{ boxShadow: CARD_SHADOW, borderRadius: 0 }}>
              <h3 className="text-[16px] font-bold mb-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Reschedule Reservation</h3>
              <p className="text-sm text-[#555555] mb-4">
                Set a new reservation window for <strong>{reservationToReschedule.visitor_name}</strong> ({reservationToReschedule.plate_number}). The current dates are replaced; a cancelled or expired reservation becomes active again.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="cok-auth-label">Start Date</label>
                  <input type="date" value={resStart} onChange={e => setResStart(e.target.value)} className="cok-auth-input w-full text-sm" style={{ fontFamily: fontHeading, paddingLeft: '12px' }} />
                </div>
                <div>
                  <label className="cok-auth-label">End Date</label>
                  <input type="date" value={resEnd} onChange={e => setResEnd(e.target.value)} className="cok-auth-input w-full text-sm" style={{ fontFamily: fontHeading, paddingLeft: '12px' }} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setReservationToReschedule(null); setResStart(''); setResEnd(''); }} disabled={rescheduleLoading} className="flex-1 px-3 py-2 text-sm font-semibold uppercase hover:bg-[rgba(5,109,170,0.08)] disabled:opacity-50" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>Close</button>
                <button onClick={confirmReservationReschedule} disabled={rescheduleLoading} className="flex-1 px-3 py-2 text-white text-sm font-semibold uppercase disabled:opacity-50" style={{ fontFamily: fontHeading, backgroundColor: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>
                  {rescheduleLoading ? 'Working…' : 'Apply New Dates'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={!!bulkAction}
          title={bulkAction === 'delete' ? 'Delete Reservations' : 'Cancel Reservations'}
          message={bulkAction === 'delete'
            ? <>Permanently delete <strong>{selectedKeys.size}</strong> selected reservation(s)? This cannot be undone.</>
            : <>Cancel <strong>{selectedKeys.size}</strong> selected reservation(s)?</>}
          confirmText={bulkAction === 'delete' ? 'Yes, Delete' : 'Yes, Cancel'}
          cancelText="No"
          type={bulkAction === 'delete' ? 'danger' : 'warning'}
          isLoading={bulkLoading}
          onConfirm={confirmBulkAction}
          onCancel={() => setBulkAction(null)}
        />

        <ConfirmModal
          isOpen={!!reservationToDelete}
          title="Delete Reservation"
          message={<>Permanently delete the reservation for <strong>{reservationToDelete?.visitor_name}</strong> ({reservationToDelete?.plate_number})? This cannot be undone.</>}
          confirmText="Yes, Delete"
          cancelText="No"
          type="danger"
          isLoading={deleteLoading}
          onConfirm={confirmDelete}
          onCancel={() => setReservationToDelete(null)}
        />

        <ConfirmModal
          isOpen={showCancelModal}
          title="Cancel Reservation"
          message={<>Are you sure you want to cancel the reservation for <strong>{reservationToCancel?.visitor_name}</strong>?</>}
          confirmText="Yes, Cancel"
          cancelText="No"
          type="warning"
          onConfirm={confirmCancel}
          onCancel={() => setShowCancelModal(false)}
        />
      </div>
    </MainLayout>
  );
};

export default ReservationsPage;