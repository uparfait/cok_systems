import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { reservationService } from '../../../core/services/adminService';
import { FiInfo, FiSearch, FiEdit2, FiTrash2, FiClock, FiCheck, FiDownload, FiLoader } from 'react-icons/fi';
import { VisitorReservationForm, StaffBookingForm } from './sub/ReservationForms';

interface Reservation { id: string; visitor_name: string; plate_number: string; telephone: string; id_type?: string; id_number?: string; expected_arrival: string; type: 'visitor' | 'staff'; status: 'active' | 'expired' | 'cancelled' | 'checked_in' | 'used'; valid_until?: string | null; created_at?: string; }

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
interface ReservationFormData { plate_number: string; driver_name: string; id_type: string; id_number: string; telephone_number: string; slot_number: string; arrival_time?: string; }
interface StaffBookingData { staff_name: string; phone: string; plate_number: string; department_name?: string; owner_title?: string; id_type?: string; identification?: string; }

const ReservationsPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Page shows one view at a time: the reservation forms (default) or the reservation list
  const [view, setView] = useState<'management' | 'list'>('management');
  const visitorFileInputRef = useRef<HTMLInputElement>(null);
  const staffFileInputRef = useRef<HTMLInputElement>(null);

  const [visitorFormData, setVisitorFormData] = useState<ReservationFormData>({ plate_number: '', driver_name: '', id_type: 'NID', id_number: '', telephone_number: '', slot_number: '', arrival_time: '' });
  const [staffFormData, setStaffBookingData] = useState<StaffBookingData>({ staff_name: '', phone: '', plate_number: '', department_name: '', owner_title: '', id_type: 'NID', identification: '' });
  const [visitorBulkFile, setVisitorBulkFile] = useState<File | null>(null);
  const [staffBulkFile, setStaffBulkFile] = useState<File | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null);

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

  useEffect(() => { fetchReservations(); }, []);

  const fetchReservations = async () => {
    try { const r = await reservationService.getAll(); if (r.success) setReservations(r.reservations || []); }
    catch (error) { console.error(error); }
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
    // Date = last day the reservation is valid, written as day/month/year; leave empty for no expiry
    buildTemplate(
      ['Name', 'Plate Number', 'ID Type', 'ID Number', 'Phone', 'Date'],
      ['', '', 'NID', '', '', '31/12/2026'],
      [3, 4, 5], // ID Number, Phone, Date stay text
      'Visitors',
      'visitor_reservation_template.xlsx'
    );
  };

  const downloadStaffTemplate = () => {
    buildTemplate(
      ['Staff Name', 'Plate Number', 'Phone', 'Department', 'Title', 'ID Type', 'ID Number'],
      ['', '', '', '', '', 'NID', ''],
      [2, 6], // Phone, ID Number stay text
      'Staff',
      'staff_booking_template.xlsx'
    );
  };

  const downloadHistoryCSV = () => {
    const h = ['Name', 'Plate Number', 'ID Number', 'Telephone', 'Type', 'Status'];
    const rows = reservations.map(r => [`"${r.visitor_name}"`, `"${r.plate_number}"`, `"${r.id_number || ''}"`, `"${r.telephone || ''}"`, r.type, r.status].join(','));
    const blob = new Blob(['\ufeff' + [h.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `reservations_${new Date().toISOString().split('T')[0]}.csv`; link.click();
  };

  const handleCancelClick = (r: Reservation) => { setReservationToCancel(r); setShowCancelModal(true); };
  const confirmCancel = async () => {
    if (!reservationToCancel) return;
    try { const d = await reservationService.cancelReservation(reservationToCancel.id, reservationToCancel.type); if (d.success) { showSuccess('Cancelled'); setTimeout(fetchReservations, 500); } else showError(d.message || 'Failed'); }
    catch (error) { showError(error.message); } finally { setShowCancelModal(false); setReservationToCancel(null); }
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

  const filteredReservations = useMemo(() => reservations.filter(r => r.status !== 'cancelled' && (r.visitor_name.toLowerCase().includes(searchTerm.toLowerCase()) || r.plate_number.toLowerCase().includes(searchTerm.toLowerCase()))), [reservations, searchTerm]);
  const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);
  const paginated = filteredReservations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (authLoading) return <div className="flex items-center justify-center min-h-[600px]"><LoadingSpinner message="Loading..." /></div>;

  return (
    <MainLayout>
      <div className="px-4 py-4">
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
              <FiInfo className="w-4 h-4" style={{ color: PRIMARY }} />
              {view === 'management' ? 'Parking Reservation Management' : 'Reservation List'}
            </h1>
            <p className="text-xs mt-0.5 text-[#555555]">{view === 'management' ? 'Manage visitor and staff parking slot allocations' : 'View and manage all parking reservations'}</p>
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
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Reservation List</h2>
              <p className="text-xs text-[#555555] mt-0.5">View and manage all parking reservations</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={downloadHistoryCSV}
                className="flex items-center gap-2 h-9 px-4 bg-transparent text-[13px] font-semibold uppercase transition-colors hover:bg-[rgba(5,109,170,0.08)]"
                style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
              >
                <FiClock className="w-4 h-4" /> History
              </button>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search visitor or plate..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-[220px] h-9 pl-10 pr-4 text-[12px] focus:outline-none"
                  style={{ fontFamily: fontHeading, background: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}
                  onFocus={(e) => { e.currentTarget.style.border = `1px solid ${PRIMARY}`; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                  onBlur={(e) => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}
                />
              </div>
            </div>
          </div>
          {selectedKeys.size > 0 && (
            <div className="px-6 py-2.5 flex items-center justify-between gap-3" style={{ backgroundColor: 'rgba(5,109,170,0.06)', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
              <span className="text-[13px] font-semibold" style={{ fontFamily: fontHeading, color: PRIMARY }}>{selectedKeys.size} selected</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setBulkAction('cancel')} disabled={bulkLoading} className="px-3 py-1.5 text-white text-xs font-semibold uppercase disabled:opacity-50" style={{ fontFamily: fontHeading, backgroundColor: WARNING, letterSpacing: '1px', borderRadius: 0 }}>Cancel Selected</button>
                <button onClick={() => setBulkAction('delete')} disabled={bulkLoading} className="px-3 py-1.5 text-white text-xs font-semibold uppercase disabled:opacity-50" style={{ fontFamily: fontHeading, backgroundColor: DANGER, letterSpacing: '1px', borderRadius: 0 }}>Delete Selected</button>
                <button onClick={() => setSelectedKeys(new Set())} className="px-3 py-1.5 text-xs font-semibold uppercase hover:bg-[rgba(5,109,170,0.08)]" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>Clear</button>
              </div>
            </div>
          )}
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
                  {['Visitor Name', 'Plate Number', 'Telephone', 'Valid Until', 'Type', 'Status', 'Action'].map(h => (
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
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: r.type === 'staff' ? ACCENT_DARK_BLUE : PRIMARY, fontFamily: fontHeading }}>
                          {initialsOf(r.visitor_name)}
                        </div>
                        <span className="text-[#333] text-[13px] font-medium">{r.visitor_name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-[#333] text-[13px] font-mono font-semibold">{r.plate_number}</td>
                    <td className="py-3 text-[#555555] text-[13px]">{r.telephone || '—'}</td>
                    <td className="py-3 text-[#555555] text-[13px] font-medium">{r.valid_until ? new Date(r.valid_until).toLocaleDateString() : '—'}</td>
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
                        {r.status !== 'cancelled'
                          ? <button onClick={() => handleCancelClick(r)} title="Cancel reservation" className="p-1.5 transition-colors hover:bg-[rgba(231,76,60,0.1)]" style={{ color: DANGER, borderRadius: 0 }}><FiTrash2 className="w-4 h-4" /></button>
                          : <button onClick={async () => { const d = await reservationService.reactivateReservation(r.id); if (d.success) { showSuccess('Reactivated'); fetchReservations(); } }} title="Reactivate" className="p-1.5 transition-colors hover:bg-[rgba(76,175,80,0.1)]" style={{ color: '#388E3C', borderRadius: 0 }}><FiCheck className="w-4 h-4" /></button>}
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

        {bulkAction && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md p-6" style={{ boxShadow: CARD_SHADOW, borderRadius: 0 }}>
              <h3 className="text-[16px] font-bold mb-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{bulkAction === 'delete' ? 'Delete Reservations' : 'Cancel Reservations'}</h3>
              <p className="text-sm text-[#555555] mb-5">
                {bulkAction === 'delete'
                  ? <>Permanently delete <strong>{selectedKeys.size}</strong> selected reservation(s)? This cannot be undone.</>
                  : <>Cancel <strong>{selectedKeys.size}</strong> selected reservation(s)?</>}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setBulkAction(null)} disabled={bulkLoading} className="flex-1 px-3 py-2 text-sm font-semibold uppercase hover:bg-[rgba(5,109,170,0.08)] disabled:opacity-50" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>No</button>
                <button onClick={confirmBulkAction} disabled={bulkLoading} className="flex-1 px-3 py-2 text-white text-sm font-semibold uppercase disabled:opacity-50" style={{ fontFamily: fontHeading, backgroundColor: bulkAction === 'delete' ? DANGER : WARNING, letterSpacing: '1px', borderRadius: 0 }}>
                  {bulkLoading ? 'Working…' : bulkAction === 'delete' ? 'Yes, Delete' : 'Yes, Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showCancelModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md p-6" style={{ boxShadow: CARD_SHADOW, borderRadius: 0 }}>
              <h3 className="text-[16px] font-bold mb-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Cancel Reservation</h3>
              <p className="text-sm text-[#555555] mb-5">Are you sure you want to cancel the reservation for <strong>{reservationToCancel?.visitor_name}</strong>?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowCancelModal(false)} className="flex-1 px-3 py-2 text-sm font-semibold uppercase hover:bg-[rgba(5,109,170,0.08)]" style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}>No</button>
                <button onClick={confirmCancel} className="flex-1 px-3 py-2 text-white text-sm font-semibold uppercase" style={{ fontFamily: fontHeading, backgroundColor: DANGER, letterSpacing: '1px', borderRadius: 0 }}>Yes, Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ReservationsPage;