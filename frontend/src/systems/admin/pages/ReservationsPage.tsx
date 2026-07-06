import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { reservationService } from '../../../core/services/adminService';
import { FiInfo, FiSearch, FiEdit2, FiTrash2, FiClock, FiCheck, FiDownload, FiLoader } from 'react-icons/fi';
import { VisitorReservationForm, StaffBookingForm } from './sub/ReservationForms';

interface Reservation { id: string; visitor_name: string; plate_number: string; telephone: string; id_type?: string; id_number?: string; expected_arrival: string; type: 'visitor' | 'staff'; status: 'active' | 'expired' | 'cancelled'; created_at?: string; }
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
  const visitorFileInputRef = useRef<HTMLInputElement>(null);
  const staffFileInputRef = useRef<HTMLInputElement>(null);

  const [visitorFormData, setVisitorFormData] = useState<ReservationFormData>({ plate_number: '', driver_name: '', id_type: 'NID', id_number: '', telephone_number: '', slot_number: '', arrival_time: '' });
  const [staffFormData, setStaffBookingData] = useState<StaffBookingData>({ staff_name: '', phone: '', plate_number: '', department_name: '', owner_title: '', id_type: 'NID', identification: '' });
  const [visitorBulkFile, setVisitorBulkFile] = useState<File | null>(null);
  const [staffBulkFile, setStaffBulkFile] = useState<File | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null);

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

  const downloadVisitorTemplate = () => {
    const h = ['Name', 'Plate Number', 'ID Type', 'ID Number', 'Phone', 'Slot Number'];
    const csvRows = [h.join(',')];
    csvRows.push(['', '', 'NID', '', '', ''].join(','));
    const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'visitor_reservation_template.csv'; link.click();
    showSuccess('Template downloaded');
  };

  const downloadStaffTemplate = () => {
    const h = ['Staff Name', 'Plate Number', 'Phone', 'Department', 'Title', 'ID Type', 'ID Number'];
    const csvRows = [h.join(',')];
    csvRows.push(['', '', '', '', '', 'NID', ''].join(','));
    const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'staff_booking_template.csv'; link.click();
    showSuccess('Template downloaded');
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
    try { const d = await reservationService.cancelReservation(reservationToCancel.id); if (d.success) { showSuccess('Cancelled'); setTimeout(fetchReservations, 500); } else showError(d.message || 'Failed'); }
    catch (error) { showError(error.message); } finally { setShowCancelModal(false); setReservationToCancel(null); }
  };

  const filteredReservations = useMemo(() => reservations.filter(r => r.status !== 'cancelled' && (r.visitor_name.toLowerCase().includes(searchTerm.toLowerCase()) || r.plate_number.toLowerCase().includes(searchTerm.toLowerCase()))), [reservations, searchTerm]);
  const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);
  const paginated = filteredReservations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (authLoading) return <div className="flex items-center justify-center min-h-[600px]"><LoadingSpinner message="Loading..." /></div>;

  return (
    <MainLayout>
      <div className="px-4 py-4">
        <div className="mb-4"><h1 className="text-base font-bold text-gray-900 flex items-center gap-2"><FiInfo className="w-4 h-4 text-yellow-500" />Parking Reservation Management</h1><p className="text-xs text-gray-600 mt-0.5">Manage visitor and staff parking slot allocations</p></div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <VisitorReservationForm formData={visitorFormData} loading={loading} onChange={setVisitorFormData} onSubmit={handleVisitorSubmit} onDownloadTemplate={downloadVisitorTemplate} bulkFile={visitorBulkFile} onFileSelect={handleVisitorFileSelect} onFileRemove={() => setVisitorBulkFile(null)} onBulkUpload={handleVisitorBulkUpload} fileInputRef={visitorFileInputRef as any} />
          <StaffBookingForm formData={staffFormData} loading={loading} onChange={setStaffBookingData} onSubmit={handleStaffSubmit} onDownloadTemplate={downloadStaffTemplate} bulkFile={staffBulkFile} onFileSelect={handleStaffFileSelect} onFileRemove={() => setStaffBulkFile(null)} onBulkUpload={handleStaffBulkUpload} fileInputRef={staffFileInputRef as any} />
        </div>

        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="px-4 py-3  flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div><h2 className="text-sm font-semibold text-gray-900">Reservation List</h2><p className="text-xs text-gray-500 mt-0.5">View and manage all parking reservations</p></div>
            <div className="flex items-center gap-2">
              <button onClick={downloadHistoryCSV} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 flex items-center gap-1"><FiClock className="w-3 h-3" />History</button>
              <div className="relative"><FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 pr-3 py-1.5 w-48 border border-gray-200 text-sm" /></div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-blue-600"><tr>{['Visitor Name', 'Plate Number', 'Telephone', 'Type', 'Status', 'Action'].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.length > 0 ? paginated.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.visitor_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.plate_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.telephone}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 font-medium ${r.type === 'staff' ? 'bg-purple-50 text-purple-700' : 'bg-green-50 text-green-700'}`}>{r.type}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 font-medium ${r.status === 'active' ? 'bg-green-50 text-green-700' : r.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>{r.status}</span></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2">{r.status !== 'cancelled' ? <button onClick={() => handleCancelClick(r)} className="text-red-500 hover:text-red-700"><FiTrash2 className="w-3.5 h-3.5" /></button> : <button onClick={async () => { const d = await reservationService.reactivateReservation(r.id); if (d.success) { showSuccess('Reactivated'); fetchReservations(); } }} className="text-green-500"><FiCheck className="w-3.5 h-3.5" /></button>}</div></td>
                  </tr>
                )) : <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No reservations found</td></tr>}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && <div className="p-3  flex items-center justify-between text-sm"><span className="text-gray-600">Page {currentPage} of {totalPages}</span><div className="flex gap-2"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="px-3 py-1 border hover:bg-gray-50 disabled:opacity-50">Prev</button><button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="px-3 py-1 border hover:bg-gray-50 disabled:opacity-50">Next</button></div></div>}
        </div>

        {showCancelModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md p-6 shadow-2xl">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Cancel Reservation</h3>
              <p className="text-sm text-gray-600 mb-4">Are you sure you want to cancel the reservation for <strong>{reservationToCancel?.visitor_name}</strong>?</p>
              <div className="flex gap-3"><button onClick={() => setShowCancelModal(false)} className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">No</button><button onClick={confirmCancel} className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium hover:bg-red-700">Yes, Cancel</button></div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ReservationsPage;