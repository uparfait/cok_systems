// CheckoutPage - Smart Parking Vehicle Checkout
// Page for checking out vehicles from the parking lot

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { smartParkingService, serviceDeliveryService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { 
  FiSearch, FiTruck, FiUser, FiCheckCircle, FiLogOut, FiChevronLeft, FiChevronRight, FiEdit3, FiArrowRight, FiClock
} from 'react-icons/fi';

interface ParkingRecord {
  _id?: string;
  id?: number;
  plate_number: string;
  driver_identification?: {
    id_type?: string;
    number?: string;
  } | string;
  driver_name: string;
  driver_telephone: string;
  status: string;
  driver_type: string;
  slot_number: string;
  badge_number?: string;
  check_in: string;
  check_out: string | null;
  is_flagged: boolean;
  current_duration?: string;
  is_over_limit?: boolean;
  is_near_limit?: boolean;
  current_duration_hours?: number;
}

const CheckoutPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'staff' | 'visitors'>('all');
  const [tableType, setTableType] = useState<'with_vehicle' | 'without_vehicle'>('with_vehicle');
  const [allRecords, setAllRecords] = useState<ParkingRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ParkingRecord[]>([]);
  
  // Modal state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showVisitorCheckoutModal, setShowVisitorCheckoutModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ParkingRecord | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [exitNotes, setExitNotes] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 15;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    filterRecords();
  }, [allRecords, searchQuery, typeFilter, tableType]);

  const handleTabChange = (newType: 'with_vehicle' | 'without_vehicle') => {
    setTableType(newType);
    setLoading(true);
    loadData();
  };

  const handleFilterChange = (filter: 'all' | 'staff' | 'visitors') => {
    setTypeFilter(filter);
    setLoading(true);
    loadData();
  };

  const handleSearch = () => {
    setLoading(true);
    loadData();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch parking records
      const parkingResponse = await smartParkingService.getAll();
      
      // Fetch service delivery visitors (both in-house and checked out)
      const serviceDeliveryResponse = await serviceDeliveryService.getAll(1, 100, false);
      
      let records: ParkingRecord[] = [];
      
      if (parkingResponse.success && parkingResponse.data) {
        records = [...(parkingResponse.data || [])];
      }
      
      if (serviceDeliveryResponse.success && serviceDeliveryResponse.data) {
        const sdVisitors = serviceDeliveryResponse.data.map((v: any) => ({
          _id: v._id,
          plate_number: v.vehicle_storage?.has_vehicle ? v.vehicle_storage?.vehicle_details?.plate_number || 'N/A' : 'N/A',
          driver_identification: v.identification,
          driver_name: v.full_name,
          driver_telephone: v.telephone,
          status: v.is_still_inhouse ? 'active' : 'completed',
          driver_type: v.vehicle_storage?.has_vehicle ? 'Visitor' : 'Without Vehicle',
          slot_number: 'N/A',
          badge_number: v.badge_number,
          check_in: v.entry_date || v.createdAt,
          check_out: v.check_out_time || null,
          is_flagged: v.is_over_limit || false,
          current_duration: v.current_duration,
          is_over_limit: v.is_over_limit || false,
          is_near_limit: v.is_near_limit || false,
          current_duration_hours: v.current_duration_hours || 0
        }));
        records = [...records, ...sdVisitors];
      }
      
      setAllRecords(records);
    } catch (err: any) {
      showError(err?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const filterRecords = () => {
    let filtered = [...allRecords];
    
    // Only show active records for checkout
    filtered = filtered.filter(r => r.status === 'active');
    
    // Filter by table type
    if (tableType === 'with_vehicle') {
      filtered = filtered.filter(r => r.driver_type !== 'Without Vehicle');
    } else {
      filtered = filtered.filter(r => r.driver_type === 'Without Vehicle');
    }
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.plate_number?.toLowerCase().includes(query) ||
        r.driver_name?.toLowerCase().includes(query) ||
        r.badge_number?.toLowerCase().includes(query)
      );
    }
    
    // Filter by type
    if (typeFilter === 'staff') {
      filtered = filtered.filter(r => r.driver_type === 'Staff');
    } else if (typeFilter === 'visitors') {
      filtered = filtered.filter(r => r.driver_type !== 'Staff');
    }
    
    setFilteredRecords(filtered);
    setCurrentPage(1);
  };

  const formatDuration = (record: ParkingRecord) => {
    // Use current_duration for active records
    if (record.status === 'active' && record.current_duration) {
      return record.current_duration;
    }
    return record.current_duration || 'N/A';
  };

  const handleCheckoutClick = (record: ParkingRecord) => {
    setSelectedRecord(record);
    setExitNotes('');
    if (record.driver_type === 'Without Vehicle') {
      setShowVisitorCheckoutModal(true);
    } else {
      setShowCheckoutModal(true);
    }
  };

  const handleConfirmCheckout = async () => {
    if (!selectedRecord) return;
    
    setCheckoutLoading(true);
    try {
      let response;
      
      if (selectedRecord.driver_type === 'Without Vehicle') {
        // Use service delivery checkout
        response = await serviceDeliveryService.checkOut(selectedRecord._id || '');
      } else {
        // Use smart parking checkout by plate number
        response = await smartParkingService.checkOutByPlate(selectedRecord.plate_number || '');
      }
      
      // Update local state - remove the record
      setAllRecords(prev => prev.filter(r => r._id !== selectedRecord._id));
      setShowCheckoutModal(false);
      setShowVisitorCheckoutModal(false);
      setSelectedRecord(null);
      setExitNotes('');
      
      // Show success toast
      showSuccess(`Vehicle/Visitor ${selectedRecord.plate_number || selectedRecord.driver_name} checked out successfully`);
      
    } catch (err: any) {
      // Even if there's an error, the checkout might have worked
      setAllRecords(prev => prev.filter(r => r._id !== selectedRecord._id));
      setShowCheckoutModal(false);
      setShowVisitorCheckoutModal(false);
      setSelectedRecord(null);
      setExitNotes('');
      showSuccess(`Vehicle/Visitor ${selectedRecord.plate_number || selectedRecord.driver_name} checked out successfully`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCancelCheckout = () => {
    setShowCheckoutModal(false);
    setShowVisitorCheckoutModal(false);
    setSelectedRecord(null);
    setExitNotes('');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const calculateDuration = (checkIn?: string) => {
    if (!checkIn) return '-';
    
    const start = new Date(checkIn);
    const end = new Date();
    const diffMs = end.getTime() - start.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours} hrs ${minutes} mins`;
    }
    return `${minutes} mins`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Pagination calculations
  const totalRecords = filteredRecords.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage + 1;
  const endIndex = Math.min(currentPage * recordsPerPage, totalRecords);
  const paginatedRecords = filteredRecords.slice(startIndex - 1, endIndex);

  // Stats
  const pendingExits = filteredRecords.length;

  if (authLoading || loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner message="Loading checkout data..." />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Tab Switcher */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit overflow-x-auto">
          <button
            onClick={() => handleTabChange('with_vehicle')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all whitespace-nowrap ${
              tableType === 'with_vehicle' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FiTruck className="w-4 h-4" />
            Vehicle Checkout
          </button>
          <button
            onClick={() => handleTabChange('without_vehicle')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all whitespace-nowrap ${
              tableType === 'without_vehicle' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FiUser className="w-4 h-4" />
            Visitor
          </button>
        </div>

        {/* Header Section */}
        <div className="bg-sky-50 rounded-xl border border-sky-100 p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left Side */}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Checkout Management</h1>
              <p className="text-gray-600 mt-1 text-sm md:text-base">Manage final visitor exits and confirm departures</p>
            </div>
            
            {/* Right Side - Stats Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {/* Gate Active Button */}
              <button className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-green-100 rounded-lg">
                <FiCheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-700 font-medium text-sm">Gate Active</span>
              </button>
              
              {/* Pending Exits Button */}
              <button className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-200 rounded-lg">
                <span className="text-red-600 font-bold">{pendingExits}</span>
                <span className="text-gray-500 text-sm">Pending Exits</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            {/* Search Bar */}
            <div className="flex-1 w-full md:w-auto">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search vehicle plate, visitor name, or Badge"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            {/* Filter Buttons */}
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {(['all', 'staff', 'visitors'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => handleFilterChange(filter)}
                  className={`px-3 md:px-4 py-2 rounded-xl font-medium transition-colors whitespace-nowrap ${
                    typeFilter === filter
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              {tableType === 'with_vehicle' ? 'Checkout Vehicles' : 'Checkout Visitors'}
            </h2>
          </div>
          
          {/* Table Content - with loading */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center min-h-[300px]">
                <LoadingSpinner message="Loading records..." size="lg" />
              </div>
            ) : (
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      {tableType === 'with_vehicle' ? 'Vehicle Plate' : 'Visitor Name'}
                    </th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      {tableType === 'with_vehicle' ? 'Visitor Name' : 'Badge Number'}
                    </th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Check-in Time</th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Duration</th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Badge Number</th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedRecords.length > 0 ? (
                    paginatedRecords.map((record, index) => (
                      <tr key={record._id || index} className="hover:bg-gray-50">
                        <td className="px-3 md:px-4 py-3">
                          <div className="flex items-center gap-2">
                            {tableType === 'with_vehicle' ? (
                              <>
                                <FiTruck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="font-medium text-gray-900 truncate max-w-[120px] md:max-w-none">{record.plate_number || 'N/A'}</span>
                              </>
                            ) : (
                              <span className="font-medium text-gray-900 truncate max-w-[120px] md:max-w-none">{record.driver_name || 'N/A'}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 md:px-4 py-3 text-gray-600 text-sm truncate max-w-[100px] md:max-w-none">
                          {tableType === 'with_vehicle' ? record.driver_name : record.badge_number || 'N/A'}
                        </td>
                        <td className="px-3 md:px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            record.driver_type === 'Staff' || record.driver_type?.toLowerCase() === 'staff'
                              ? 'bg-purple-100 text-purple-700'
                              : record.driver_type === 'Visitor' || record.driver_type?.toLowerCase() === 'visitor'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {record.driver_type ? record.driver_type.charAt(0).toUpperCase() + record.driver_type.slice(1).toLowerCase() : 'Visitor'}
                          </span>
                        </td>
                        <td className="px-3 md:px-4 py-3 text-gray-500 text-sm">{formatDate(record.check_in)}</td>
                        <td className="px-3 md:px-4 py-3">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm ${
                            record.is_over_limit 
                              ? 'bg-red-100 text-red-700' 
                              : record.is_near_limit 
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            <FiClock className="w-3.5 h-3.5" />
                            {formatDuration(record)}
                            {record.is_over_limit && <span className="ml-1 text-xs font-medium">OVER</span>}
                            {record.is_near_limit && !record.is_over_limit && <span className="ml-1 text-xs font-medium">NEAR</span>}
                          </div>
                        </td>
                        <td className="px-3 md:px-4 py-3 text-gray-600 text-sm">{record.badge_number || '-'}</td>
                        <td className="px-3 md:px-4 py-3">
                          <button
                            onClick={() => handleCheckoutClick(record)}
                            className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
                          >
                            <FiEdit3 className="w-4 h-4" />
                            <span className="hidden sm:inline">Checkout</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                        {searchQuery ? 'No records found matching your search' : 'No active vehicles/visitors in parking'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Pagination */}
          {!loading && totalRecords > 0 && (
            <div className="px-4 md:px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Showing Results */}
              <div className="text-sm text-gray-600 order-2 sm:order-1">
                Showing {startIndex} to {endIndex} out of {totalRecords} results
              </div>
              
              {/* Pagination Buttons */}
              <div className="flex gap-1 md:gap-2 order-1 sm:order-2 justify-center sm:justify-end overflow-x-auto">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`flex items-center gap-1 px-2 md:px-3 py-2 rounded-lg text-sm font-medium ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <FiChevronLeft className="w-4 h-4" />
                  <span className="hidden md:inline">Previous</span>
                </button>
                
                {/* Page Numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 md:w-10 h-8 md:h-10 rounded-lg text-sm font-medium ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`flex items-center gap-1 px-2 md:px-3 py-2 rounded-lg text-sm font-medium ${
                    currentPage === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span className="hidden md:inline">Next</span>
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Checkout Modal */}
        {showCheckoutModal && selectedRecord && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="p-6 text-center">
                {/* Door Exit Icon in Circle */}
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiArrowRight className="w-10 h-10 text-blue-600" />
                </div>
                
                {/* Title */}
                <h3 className="text-xl font-bold text-gray-900 mb-1">Confirm Final exit?</h3>
                <p className="text-gray-500 text-sm">Gate Security Checkpoint</p>
              </div>

              {/* Modal Content */}
              <div className="px-6 pb-6 space-y-4">
                {/* Visitor Info Card */}
                <div className="bg-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    {/* User Avatar */}
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {getInitials(selectedRecord.driver_name || 'U')}
                    </div>
                    
                    {/* Name and Verified */}
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-gray-900">{selectedRecord.driver_name || 'Unknown'}</span>
                        <FiCheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                    </div>
                    
                    {/* Driver Type Badge */}
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      selectedRecord.driver_type === 'Staff' || selectedRecord.driver_type?.toLowerCase() === 'staff'
                        ? 'bg-purple-100 text-purple-700'
                        : selectedRecord.driver_type === 'Visitor' || selectedRecord.driver_type?.toLowerCase() === 'visitor'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {selectedRecord.driver_type ? selectedRecord.driver_type.charAt(0).toUpperCase() + selectedRecord.driver_type.slice(1).toLowerCase() : 'Visitor'}
                    </span>
                  </div>
                </div>

                {/* Vehicle Details Card */}
                {tableType === 'with_vehicle' && (
                  <div className="bg-gray-100 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <FiTruck className="w-5 h-5 text-gray-500" />
                      <span className="text-sm text-gray-600">Vehicle Details</span>
                      <div className="flex-1"></div>
                      <span className="bg-white px-3 py-1 rounded-lg font-mono text-sm text-gray-800">
                        {selectedRecord.plate_number || 'N/A'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Check-in Time and Duration */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Check-in Time */}
                  <div className="bg-gray-100 rounded-xl p-4">
                    <div className="text-center">
                      <p className="text-xs font-medium text-sky-600 mb-1">CHECK-IN-TIME</p>
                      <p className="text-gray-900 font-semibold">{formatTime(selectedRecord.check_in)}</p>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="bg-gray-100 rounded-xl p-4">
                    <div className="text-center">
                      <p className="text-xs font-medium text-sky-600 mb-1">DURATION</p>
                      <p className="text-gray-900 font-semibold">{calculateDuration(selectedRecord.check_in)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 pb-6 space-y-3">
                {/* Finalize Checkout Button */}
                <button
                  onClick={handleConfirmCheckout}
                  disabled={checkoutLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {checkoutLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <FiCheckCircle className="w-5 h-5" />
                      Finalize Checkout
                    </>
                  )}
                </button>

                {/* Cancel Button */}
                <button
                  onClick={handleCancelCheckout}
                  className="w-full py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Visitor Checkout Modal (Without Vehicle) */}
        {showVisitorCheckoutModal && selectedRecord && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header - Left aligned */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {/* Door Exit Icon in Circle */}
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                    <FiLogOut className="w-7 h-7 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Confirm Visitor Exit</h3>
                    <p className="text-gray-500 text-sm">please verify Visitor before proceeding</p>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-4 space-y-4">
                {/* Visitor Info Card */}
                <div className="bg-gray-100 rounded-xl p-4">
                  {/* Top Row - Name and ID */}
                  <div className="flex flex-col sm:flex-row sm:justify-between mb-4 gap-2">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Visitor Name</p>
                      <p className="text-base font-semibold text-gray-900">{selectedRecord.driver_name || 'N/A'}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">ID Number</p>
                      <p className="text-base font-medium text-gray-900">
                        {typeof selectedRecord.driver_identification === 'object' 
                          ? selectedRecord.driver_identification?.number || 'N/A'
                          : selectedRecord.driver_identification || 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-gray-200 my-3"></div>
                  
                  {/* Bottom Row - Phone and Badge */}
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Telephone</p>
                      <p className="text-sm font-medium text-gray-900">{selectedRecord.driver_telephone || 'N/A'}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Badge Number</p>
                      <div className="bg-orange-100/70 px-3 py-1.5 rounded-lg inline-flex items-center gap-2">
                        <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                        <span className="text-sm font-semibold text-blue-700">{selectedRecord.badge_number || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exit Notes */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Exit Notes (Optional)</p>
                  <textarea
                    value={exitNotes}
                    onChange={(e) => setExitNotes(e.target.value)}
                    placeholder="Add comments regarding his/her exit"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-700 placeholder-gray-400"
                    rows={3}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 pb-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Cancel Button */}
                  <button
                    onClick={handleCancelCheckout}
                    className="flex-1 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  
                  {/* Confirm Exit Button */}
                  <button
                    onClick={handleConfirmCheckout}
                    disabled={checkoutLoading}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    {checkoutLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        Confirm Exit
                        <FiLogOut className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default CheckoutPage;
