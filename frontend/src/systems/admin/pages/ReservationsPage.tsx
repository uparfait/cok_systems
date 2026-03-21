// ReservationsPage - Smart Parking Reservation Management
// Redesigned with modern UI matching the image specification

import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import ConfirmModal from '../../../core/components/Modals/ConfirmModal';
import { reservationService } from '../../../core/services/adminService';
import { 
  FiCalendar, FiUpload, FiUser, FiTruck, FiPhone, FiFileText, 
  FiCheck, FiAlertCircle, FiSearch, FiEdit2, FiTrash2,
  FiClock, FiMapPin, FiUsers, FiBriefcase, FiDownload,
  FiPlus, FiX, FiChevronLeft, FiChevronRight, FiInfo, FiRefreshCw
} from 'react-icons/fi';

interface ReservationFormData {
  plate_number: string;
  driver_name: string;
  id_type: string;
  id_number: string;
  telephone_number: string;
  slot_number: string;
  arrival_time?: string;
}

interface StaffBookingData {
  staff_name: string;
  phone: string;
  plate_number: string;
  department_name?: string;
  owner_title?: string;
  id_type?: string;
  identification?: string;
}

interface Reservation {
  id: string;
  visitor_name: string;
  plate_number: string;
  telephone: string;
  expected_arrival: string;
  type: 'visitor' | 'staff';
  status: 'active' | 'expired' | 'cancelled';
  created_at?: string;
}

const ReservationsPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  // Visitor form state
  const [visitorFormData, setVisitorFormData] = useState<ReservationFormData>({
    plate_number: '',
    driver_name: '',
    id_type: 'NID',
    id_number: '',
    telephone_number: '',
    slot_number: '',
    arrival_time: ''
  });
  
  // Staff booking form state
  const [staffFormData, setStaffBookingData] = useState<StaffBookingData>({
    staff_name: '',
    phone: '',
    plate_number: '',
    department_name: '',
    owner_title: '',
    id_type: 'NID',
    identification: ''
  });
  
  // Bulk upload states
  const [visitorBulkFile, setVisitorBulkFile] = useState<File | null>(null);
  const [staffBulkFile, setStaffBulkFile] = useState<File | null>(null);
  const [activeUploadType, setActiveUploadType] = useState<'visitor' | 'staff'>('visitor');

  // Cancel confirmation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Fetch reservations on mount
  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    try {
      const response = await reservationService.getAll();
      if (response.success) {
        setReservations(response.reservations || []);
      }
    } catch (error) {
      console.error('Error fetching reservations:', error);
    }
  };

  const handleVisitorInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setVisitorFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleStaffInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setStaffBookingData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleVisitorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await reservationService.createVisitorReservation(visitorFormData);

      if (response.success) {
        showSuccess(response.message || 'Visitor reservation created successfully!');
        setVisitorFormData({
          plate_number: '',
          driver_name: '',
          id_type: 'NID',
          id_number: '',
          telephone_number: '',
          slot_number: '',
          arrival_time: ''
        });
        fetchReservations();
      } else {
        showError(response.message || 'Failed to create reservation');
      }
    } catch (error) {
      showError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await reservationService.createStaffBooking(staffFormData);

      if (response.success) {
        showSuccess(response.message || 'Staff slot allocated successfully!');
        setStaffBookingData({
          staff_name: '',
          phone: '',
          plate_number: '',
          department_name: '',
          owner_title: '',
          id_type: 'NID',
          identification: ''
        });
        fetchReservations();
      } else {
        showError(response.message || 'Failed to allocate staff slot');
      }
    } catch (error) {
      showError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVisitorBulkUpload = async () => {
    if (!visitorBulkFile) {
      showError('Please select a file to upload');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', visitorBulkFile);

    try {
      const data = await reservationService.bulkUploadVisitors(formData);
      if (data.success) {
        showSuccess(data.message || 'Bulk visitor reservations uploaded successfully!');
        setVisitorBulkFile(null);
        fetchReservations();
      } else {
        showError(data.message || 'Upload failed');
      }
    } catch (error) {
      showError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffBulkUpload = async () => {
    if (!staffBulkFile) {
      showError('Please select a file to upload');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', staffBulkFile);

    try {
      const data = await reservationService.bulkUploadStaff(formData);
      if (data.success) {
        showSuccess(data.message || 'Bulk staff allocations uploaded successfully!');
        setStaffBulkFile(null);
        fetchReservations();
      } else {
        showError(data.message || 'Upload failed');
      }
    } catch (error) {
      showError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = (reservation: Reservation) => {
    setReservationToCancel(reservation);
    setShowCancelModal(true);
  };

  const confirmCancelReservation = async () => {
    if (!reservationToCancel) return;
    
    try {
      const data = await reservationService.cancelReservation(reservationToCancel.id);
      if (data.success) {
        showSuccess(data.message || 'Reservation cancelled successfully');
        // Small delay to ensure backend completes the operation
        setTimeout(() => {
          fetchReservations();
        }, 100);
      } else {
        showError(data.message || 'Failed to cancel');
      }
    } catch (error) {
      showError('Network error');
    } finally {
      setShowCancelModal(false);
      setReservationToCancel(null);
    }
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setReservationToCancel(null);
  };

  const handleDownloadHistory = () => {
    // Create CSV content with proper escaping
    const headers = ['Name', 'Plate Number', 'Telephone', 'Type', 'Status'];
    const csvRows: string[] = [headers.join(',')];
    
    reservations.forEach(res => {
      const row = [
        `"${res.visitor_name.replace(/"/g, '""')}"`, // Escape quotes
        `"${res.plate_number.replace(/"/g, '""')}"`,
        `"${res.telephone?.replace(/"/g, '""') || ''}"`,
        res.type,
        res.status
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    
    // Add BOM for Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reservations_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleReactivateClick = async (reservation: Reservation) => {
    try {
      const data = await reservationService.reactivateReservation(reservation.id);
      if (data.success) {
        showSuccess(data.message || 'Reservation reactivated successfully');
        setTimeout(() => {
          fetchReservations();
        }, 100);
      } else {
        showError(data.message || 'Failed to reactivate');
      }
    } catch (error) {
      showError('Network error');
    }
  };

  // Get cancelled staff reservations for reactivation
  const cancelledStaffReservations = reservations.filter(
    res => res.type === 'staff' && res.status === 'cancelled'
  );

  // Filter and paginate reservations
  const filteredReservations = reservations.filter(res => 
    res.visitor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    res.plate_number.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);
  const paginatedReservations = filteredReservations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <FiInfo className="w-6 h-6 text-yellow-500"/>
                <span>Parking Reservation Management</span>
              </h1>
              <p className="text-sm text-gray-600 mt-2">
                Manage visitor and staff parking slot allocations for the City of Kigali facilities.
              </p>
            </div>
          </div>
        </div>

        {/* Two Column Layout - Visitor & Staff Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Visitor Reservations Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <FiUsers className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Visitor Reservations</h2>
              </div>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleVisitorSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        name="driver_name"
                        value={visitorFormData.driver_name}
                        onChange={handleVisitorInputChange}
                        required
                        placeholder="Enter full name"
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      Plate Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FiTruck className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        name="plate_number"
                        value={visitorFormData.plate_number}
                        onChange={handleVisitorInputChange}
                        required
                        placeholder="e.g., RAD 302H"
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      Arrival Time
                    </label>
                    <div className="relative">
                      <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="datetime-local"
                        name="arrival_time"
                        value={visitorFormData.arrival_time}
                        onChange={handleVisitorInputChange}
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      Phone Number
                    </label>
                    <div className="relative">
                      <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="tel"
                        name="telephone_number"
                        value={visitorFormData.telephone_number}
                        onChange={handleVisitorInputChange}
                        placeholder="+250 791 783 308"
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FiCheck className="w-4 h-4" />
                    )}
                    Reserve Slot
                  </button>
                </div>
              </form>
              
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Bulk Visitor Upload</label>
                  <span className="text-xs text-gray-400">Excel (.xlsx, .csv)</span>
                </div>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-blue-400 transition-colors bg-gray-50/30">
                  <input
                    type="file"
                    id="visitor-bulk-upload"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setVisitorBulkFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label htmlFor="visitor-bulk-upload" className="cursor-pointer block">
                    <FiUpload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                    {visitorBulkFile ? (
                      <div className="text-sm font-medium text-gray-700">{visitorBulkFile.name}</div>
                    ) : (
                      <>
                        <div className="text-sm text-gray-600">Click to upload or drag and drop</div>
                        <div className="text-xs text-gray-400 mt-1">Supported formats: .xlsx, .csv</div>
                      </>
                    )}
                  </label>
                </div>
                {visitorBulkFile && (
                  <button
                    onClick={handleVisitorBulkUpload}
                    disabled={loading}
                    className="mt-3 w-full py-2 border border-blue-200 text-blue-600 rounded-xl font-medium hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                  >
                    <FiUpload className="w-4 h-4" />
                    Upload List
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Permanent Staff Booking Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50/50 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <FiBriefcase className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Permanent Staff Booking</h2>
              </div>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleStaffSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      Staff Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        name="staff_name"
                        value={staffFormData.staff_name}
                        onChange={handleStaffInputChange}
                        required
                        placeholder="e.g., MUHIRE Kenny"
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      Staff Plate Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FiTruck className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        name="plate_number"
                        value={staffFormData.plate_number}
                        onChange={handleStaffInputChange}
                        required
                        placeholder="e.g., RAF 100S"
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      Phone Number
                    </label>
                    <div className="relative">
                      <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="tel"
                        name="phone"
                        value={staffFormData.phone}
                        onChange={handleStaffInputChange}
                        placeholder="+250 791 783 308"
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      Identity Number
                    </label>
                    <div className="relative">
                      <FiFileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        name="identification"
                        value={staffFormData.identification}
                        onChange={handleStaffInputChange}
                        placeholder="National ID Number"
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                      Department
                    </label>
                    <div className="relative">
                      <FiBriefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        name="department_name"
                        value={staffFormData.department_name}
                        onChange={handleStaffInputChange}
                        placeholder="e.g., Finance, IT, HR"
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FiMapPin className="w-4 h-4" />
                    )}
                    Allocate Permanent Slot
                  </button>
                </div>
              </form>
              
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Staff Directory Sync</label>
                  <span className="text-xs text-gray-400">Upload spreadsheet</span>
                </div>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-indigo-400 transition-colors bg-gray-50/30">
                  <input
                    type="file"
                    id="staff-bulk-upload"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setStaffBulkFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label htmlFor="staff-bulk-upload" className="cursor-pointer block">
                    <FiUpload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                    {staffBulkFile ? (
                      <div className="text-sm font-medium text-gray-700">{staffBulkFile.name}</div>
                    ) : (
                      <>
                        <div className="text-sm text-gray-600">Choose file for staff reservation</div>
                        <div className="text-xs text-gray-400 mt-1">Excel or CSV format</div>
                      </>
                    )}
                  </label>
                </div>
                {staffBulkFile && (
                  <button
                    onClick={handleStaffBulkUpload}
                    disabled={loading}
                    className="mt-3 w-full py-2 border border-indigo-200 text-indigo-600 rounded-xl font-medium hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                  >
                    <FiUpload className="w-4 h-4" />
                    Upload List
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Reservations Table Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Reservation List</h2>
              <p className="text-sm text-gray-500 mt-0.5">View and manage all parking reservations</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all"
              >
                <FiClock className="w-4 h-4" />
                View History
              </button>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by name or plate..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full sm:w-64 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Visitor Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Plate Number</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Telephone</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Expected Arrival</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedReservations.length > 0 ? (
                  paginatedReservations.map((reservation) => (
                    <tr key={reservation.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{reservation.visitor_name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{reservation.plate_number}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{reservation.telephone}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          <FiClock className="w-3 h-3 mr-1" />
                          {reservation.expected_arrival}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          reservation.type === 'staff' 
                            ? 'bg-purple-50 text-purple-700' 
                            : 'bg-green-50 text-green-700'
                        }`}>
                          {reservation.type === 'staff' ? 'Staff' : 'Visitor'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          reservation.status === 'active' 
                            ? 'bg-green-50 text-green-700' 
                            : reservation.status === 'cancelled'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-gray-50 text-gray-700'
                        }`}>
                          {reservation.status === 'active' ? 'Active' : reservation.status === 'cancelled' ? 'Cancelled' : 'Expired'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button className="text-blue-600 hover:text-blue-800 transition-colors">
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                          {reservation.status === 'cancelled' && reservation.type === 'staff' ? (
                            <button 
                              onClick={() => handleReactivateClick(reservation)}
                              className="text-green-500 hover:text-green-700 transition-colors"
                              title="Reactivate reservation"
                            >
                              <FiCheck className="w-4 h-4" />
                            </button>
                          ) : reservation.status !== 'cancelled' ? (
                            <button 
                              onClick={() => handleCancelClick(reservation)}
                              className="text-red-500 hover:text-red-700 transition-colors"
                              title="Cancel reservation"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No reservations found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredReservations.length)} of {filteredReservations.length} reservations
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  <FiChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cancelled Staff Reservations - For Reactivation */}
        {cancelledStaffReservations && cancelledStaffReservations.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-red-100 bg-gradient-to-r from-red-50/50 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-xl">
                  <FiRefreshCw className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Cancelled Staff Reservations</h2>
                <span className="ml-auto bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                  {cancelledStaffReservations.length} cancelled
                </span>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                These staff reservations have been cancelled. Click reactivate when they return to work.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cancelledStaffReservations.map((reservation) => (
                  <div 
                    key={reservation.id} 
                    className="border border-red-200 bg-red-50 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{reservation.visitor_name}</h3>
                        <p className="text-sm text-gray-500">{reservation.plate_number}</p>
                        <p className="text-sm text-gray-500">{reservation.telephone}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-2 bg-red-100 text-red-700">
                          Cancelled
                        </span>
                      </div>
                      <button
                        onClick={() => handleReactivateClick(reservation)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                      >
                        <FiCheck className="w-3 h-3" />
                        Reactivate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={showCancelModal}
        onCancel={closeCancelModal}
        onConfirm={confirmCancelReservation}
        title="Cancel Reservation"
        confirmText="Cancel Reservation"
        type="danger"
        message={`Are you sure you want to cancel the reservation for plate number ${reservationToCancel?.plate_number || reservationToCancel?.visitor_name || 'this reservation'}? This action cannot be undone.`}
      />

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setShowHistoryModal(false)}
            />
            
            {/* Modal Content */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden transform">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Reservation History</h2>
                  <p className="text-sm text-gray-500">All reservations (active, cancelled, expired)</p>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Plate</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reservations.map((res) => (
                      <tr key={res.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{res.visitor_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{res.plate_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{res.telephone}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            res.type === 'staff' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {res.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            res.status === 'active' ? 'bg-green-100 text-green-700' : 
                            res.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {res.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                <span className="text-sm text-gray-500">
                  Total: {reservations.length} reservations
                </span>
                <button
                  onClick={handleDownloadHistory}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  <FiDownload className="w-4 h-4" />
                  Download CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default ReservationsPage;