// MonitorPage - Smart Parking Monitoring
// Real-time monitoring of parking status and flagged vehicles

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { smartParkingService, serviceDeliveryService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { 
  FiTruck, FiAlertTriangle, FiClock, FiSearch, FiRefreshCw,
  FiLogIn, FiLogOut, FiUser, FiMapPin, FiChevronLeft, FiChevronRight,
  FiPhone, FiCalendar, FiCheckCircle, FiXCircle
} from 'react-icons/fi';

interface ParkingRecord {
  _id?: string;
  plate_number?: string;
  driver_name?: string;
  driver_telephone?: string;
  driver_type?: string;
  status?: string;
  check_in?: string;
  check_out?: string;
  slot_number?: string;
  is_flagged?: boolean;
  duration?: string;
  current_duration?: string;
  current_duration_hours?: number;
  is_near_limit?: boolean;
  is_over_limit?: boolean;
  checked_in_by?: string;
  badge_number?: string;
}

type TabType = 'all' | 'active' | 'completed' | 'flagged' | 'visitors';

const MonitorPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ParkingRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ParkingRecord | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Auto-refresh every 30 seconds (silent - no loading indicator, no error toasts)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Fetch parking records
        const parkingResponse = await smartParkingService.getAll();
        
        // Fetch service delivery visitors
        const serviceDeliveryResponse = await serviceDeliveryService.getAll(1, 100, false);
        
        let allRecords: ParkingRecord[] = [];
        
        if (parkingResponse.success && parkingResponse.data) {
          allRecords = [...(parkingResponse.data || [])];
        }
        
        if (serviceDeliveryResponse.success && serviceDeliveryResponse.data) {
          const sdVisitors = serviceDeliveryResponse.data.map((v: any) => ({
            _id: v._id,
            plate_number: v.vehicle_storage?.has_vehicle ? v.vehicle_storage?.vehicle_details?.plate_number || 'N/A' : 'N/A',
            driver_name: v.full_name,
            driver_telephone: v.telephone,
            status: v.is_still_inhouse ? 'active' : 'completed',
            driver_type: v.vehicle_storage?.has_vehicle ? 'Visitor' : 'Without Vehicle',
            slot_number: 'N/A',
            badge_number: v.badge_number,
            check_in: v.entry_date || v.createdAt,
            check_out: v.check_out_time || undefined,
            is_flagged: v.is_over_limit || false,
            current_duration: v.current_duration,
            is_over_limit: v.is_over_limit || false,
            is_near_limit: v.is_near_limit || false,
            current_duration_hours: v.current_duration_hours || 0
          }));
          allRecords = [...allRecords, ...sdVisitors];
        }
        
        setRecords(allRecords);
      } catch (err) {
        // Silent fail for auto-refresh - don't show error toasts
        console.warn('Auto-refresh failed:', err);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterRecords();
  }, [records, activeTab, searchQuery]);

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // Fetch parking records
      const parkingResponse = await smartParkingService.getAll();
      
      // Fetch service delivery visitors (both in-house and checked out)
      const serviceDeliveryResponse = await serviceDeliveryService.getAll(1, 100, false);
      
      let allRecords: ParkingRecord[] = [];
      
      if (parkingResponse.success && parkingResponse.data) {
        allRecords = [...(parkingResponse.data || [])];
      }
      
      if (serviceDeliveryResponse.success && serviceDeliveryResponse.data) {
        const sdVisitors = serviceDeliveryResponse.data.map((v: any) => ({
          _id: v._id,
          plate_number: v.vehicle_storage?.has_vehicle ? v.vehicle_storage?.vehicle_details?.plate_number || 'N/A' : 'N/A',
          driver_name: v.full_name,
          driver_telephone: v.telephone,
          status: v.is_still_inhouse ? 'active' : 'completed',
          driver_type: v.vehicle_storage?.has_vehicle ? 'Visitor' : 'Without Vehicle',
          slot_number: 'N/A',
          badge_number: v.badge_number,
          check_in: v.entry_date || v.createdAt,
          check_out: v.check_out_time || undefined,
          is_flagged: v.is_over_limit || false,
          current_duration: v.current_duration,
          is_over_limit: v.is_over_limit || false,
          is_near_limit: v.is_near_limit || false,
          current_duration_hours: v.current_duration_hours || 0
        }));
        allRecords = [...allRecords, ...sdVisitors];
      }
      
      setRecords(allRecords);
    } catch (err: any) {
      showError(err?.message || 'Failed to load data');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const filterRecords = () => {
    let filtered = [...records];
    
    // Apply tab filter
    switch (activeTab) {
      case 'active':
        filtered = filtered.filter(r => r.status === 'active');
        break;
      case 'completed':
        filtered = filtered.filter(r => r.status === 'completed');
        break;
      case 'flagged':
        filtered = filtered.filter(r => r.is_flagged);
        break;
      case 'visitors':
        filtered = filtered.filter(r => r.driver_type === 'Without Vehicle');
        break;
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.plate_number?.toLowerCase().includes(query) ||
        r.driver_name?.toLowerCase().includes(query) ||
        r.driver_telephone?.toLowerCase().includes(query) ||
        r.slot_number?.toLowerCase().includes(query) ||
        r.badge_number?.toLowerCase().includes(query)
      );
    }
    
    setFilteredRecords(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleCheckout = async (record: ParkingRecord) => {
    if (!record.plate_number) {
      showError('Plate number not found for this record');
      return;
    }
    
    setCheckoutLoading(true);
    try {
      const response = await smartParkingService.checkOutByPlate(record.plate_number);
      if (response.success) {
        showSuccess('Vehicle checked out successfully');
        setSelectedRecord(null);
        loadData();
      } else {
        showError(response.message || 'Failed to checkout vehicle');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to checkout vehicle');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRecords = filteredRecords.slice(startIndex, endIndex);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (record: ParkingRecord) => {
    // Use current_duration for active records, duration for completed
    if (record.status === 'active' && record.current_duration) {
      return record.current_duration;
    }
    return record.duration || 'N/A';
  };

  // Calculate stats
  const totalVehicles = records.length;
  const activeCount = records.filter(r => r.status === 'active').length;
  const completedCount = records.filter(r => r.status === 'completed').length;
  const flaggedCount = records.filter(r => r.is_flagged).length;
  const visitorCount = records.filter(r => r.driver_type === 'Without Vehicle').length;

  // Calculate total duration
  const totalDuration = records.reduce((acc, r) => {
    if (r.check_in && r.check_out) {
      const diff = new Date(r.check_out).getTime() - new Date(r.check_in).getTime();
      return acc + diff;
    }
    return acc;
  }, 0);
  const totalHours = Math.round(totalDuration / (1000 * 60 * 60));

  const getStatusBadge = (record: ParkingRecord) => {
    const { status, is_flagged, is_over_limit, is_near_limit } = record;
    
    if (is_flagged) {
      return (
        <span className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
          Flagged
        </span>
      );
    }
    
    if (status === 'active') {
      return (
        <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
          is_over_limit 
            ? 'bg-red-100 text-red-700' 
            : is_near_limit 
            ? 'bg-orange-100 text-orange-700'
            : 'bg-green-100 text-green-700'
        }`}>
          {is_over_limit ? 'Over Time' : is_near_limit ? 'Near Limit' : 'Active'}
        </span>
      );
    }
    
    return (
      <span className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
        Completed
      </span>
    );
  };

  const getSlotDisplay = (slotNumber?: string) => {
    if (!slotNumber || slotNumber === 'Not Specified' || slotNumber === '-') {
      return <span className="text-gray-400">-</span>;
    }
    return (
      <div className="flex items-center gap-1">
        <FiMapPin className="w-3 h-3 text-blue-500" />
        <span className="font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{slotNumber}</span>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Monitor</h1>
              <p className="text-gray-500 mt-1">PARKING RECORDS</p>
            </div>
            <button
              onClick={() => loadData()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Vehicles</p>
                <p className="text-3xl font-bold mt-1">{totalVehicles}</p>
                <p className="text-blue-200 text-xs mt-1">All time records</p>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <FiTruck className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Total Duration</p>
                <p className="text-3xl font-bold mt-1">{totalHours}h</p>
                <p className="text-purple-200 text-xs mt-1">Combined hours</p>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <FiClock className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Active Now</p>
                <p className="text-3xl font-bold mt-1">{activeCount}</p>
                <p className="text-green-200 text-xs mt-1">Currently parked</p>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <FiLogIn className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm font-medium">Flagged</p>
                <p className="text-3xl font-bold mt-1">{flaggedCount}</p>
                <p className="text-red-200 text-xs mt-1">Vehicles flagged</p>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <FiAlertTriangle className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">Visitors without vehicle</p>
                <p className="text-3xl font-bold mt-1">{visitorCount}</p>
                <p className="text-amber-200 text-xs mt-1">Visitors without vehicle</p>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <FiUser className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs and Search */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                {(['all', 'active', 'completed', 'flagged', 'visitors'] as TabType[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 capitalize ${
                      activeTab === tab
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                    }`}
                  >
                    {tab === 'visitors' ? 'Visitors without vehicle' : tab}
                    {tab === 'active' && activeCount > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                        {activeCount}
                      </span>
                    )}
                    {tab === 'flagged' && flaggedCount > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                        {flaggedCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              
              {/* Search */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by plate, name, phone, slot, badge..."
                  className="block w-full lg:w-80 pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <FiTruck className="w-4 h-4" />
                      Vehicle
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <FiUser className="w-4 h-4" />
                      {activeTab === 'visitors' ? 'Visitor' : 'Driver'}
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Badge
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <FiLogIn className="w-4 h-4" />
                      Check In
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <FiLogOut className="w-4 h-4" />
                      Check Out
                    </div>
                  </th>
                  {activeTab !== 'visitors' && (
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <FiClock className="w-4 h-4" />
                      Duration
                    </div>
                  </th>
                  )}
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={activeTab === 'visitors' ? 6 : 8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-gray-500 font-medium">Loading records...</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {currentRecords.length === 0 ? (
                      <tr>
                        <td colSpan={activeTab === 'visitors' ? 6 : 8} className="px-4 py-16 text-center">
                          <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                              <FiTruck className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500 font-medium">No records found</p>
                            <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filter</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentRecords.map((record, index) => (
                        <tr key={index} className="hover:bg-blue-50/50 transition-colors duration-150 group">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${record.is_flagged ? 'bg-red-100' : 'bg-blue-100'}`}>
                          <FiTruck className={`w-5 h-5 ${record.is_flagged ? 'text-red-600' : 'text-blue-600'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {record.plate_number || 'N/A'}
                            </span>
                            {record.is_flagged && (
                              <FiAlertTriangle className="w-4 h-4 text-red-500" title="Flagged Vehicle" />
                            )}
                          </div>
                          <span className="text-xs text-gray-500">{record.driver_type || 'Visitor'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-gray-900 font-medium">
                        {record.driver_name || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <FiPhone className="w-3 h-3" />
                        {record.driver_telephone || 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {record.badge_number ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 rounded-lg text-sm font-medium text-orange-700">
                          <FiUser className="w-3.5 h-3.5" />
                          {record.badge_number}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-gray-700 text-sm">{formatDate(record.check_in)}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                        <FiUser className="w-3 h-3" />
                        {record.checked_in_by && record.checked_in_by !== 'Not specified' ? record.checked_in_by : 'Unknown'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {record.check_out ? (
                        <div className="text-gray-700 text-sm">{formatDate(record.check_out)}</div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-600 text-sm">
                          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                          {record.driver_type === 'Without Vehicle' ? 'Still inside' : 'Still parked'}
                        </div>
                      )}
                    </td>
                    {activeTab !== 'visitors' && (
                      <td className="px-4 py-4">
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
                    )}
                    <td className="px-4 py-4">
                      {getStatusBadge(record)}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setSelectedRecord(record)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors duration-200"
                      >
                        <FiCalendar className="w-3.5 h-3.5" />
                        View
                      </button>
                    </td>
                  </tr>
                )))}
                </>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredRecords.length > itemsPerPage && (
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50/50 border-t border-gray-100">
              <div className="text-sm text-gray-500">
                Showing <span className="font-medium text-gray-900">{startIndex + 1}</span> to <span className="font-medium text-gray-900">{Math.min(endIndex, filteredRecords.length)}</span> of <span className="font-medium text-gray-900">{filteredRecords.length}</span> entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-white hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:shadow-none transition-all duration-200 text-sm font-medium"
                >
                  <FiChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-all duration-200 ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-gray-600 hover:bg-white hover:shadow-sm'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-white hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:shadow-none transition-all duration-200 text-sm font-medium"
                >
                  Next
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-xl">
                    <FiTruck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Parking Record Details</h2>
                    <p className="text-blue-100 text-sm">{selectedRecord.plate_number}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <FiXCircle className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-100">
                  <p className="text-sm text-gray-500">License Plate</p>
                  <p className="font-bold text-gray-900 text-lg">{selectedRecord.plate_number || 'N/A'}</p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-100">
                  <p className="text-sm text-gray-500">Driver Type</p>
                  <p className="font-bold text-gray-900 text-lg">{selectedRecord.driver_type || 'Visitor'}</p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-100">
                  <p className="text-sm text-gray-500">Driver Name</p>
                  <p className="font-bold text-gray-900 text-lg">{selectedRecord.driver_name || 'N/A'}</p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-100">
                  <p className="text-sm text-gray-500">Telephone</p>
                  <p className="font-bold text-gray-900 text-lg">{selectedRecord.driver_telephone || 'N/A'}</p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-100">
                  <p className="text-sm text-gray-500">Slot Number</p>
                  <div className="mt-1">{getSlotDisplay(selectedRecord.slot_number)}</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-100">
                  <p className="text-sm text-orange-700">Badge Number</p>
                  <p className="font-bold text-orange-900 text-lg">{selectedRecord.badge_number || 'N/A'}</p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-100">
                  <p className="text-sm text-gray-500">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedRecord)}</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-100">
                  <div className="flex items-center gap-2 mb-1">
                    <FiLogIn className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-green-700">Check In Time</p>
                  </div>
                  <p className="font-bold text-green-900">{formatDate(selectedRecord.check_in)}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-100">
                  <div className="flex items-center gap-2 mb-1">
                    <FiLogOut className="w-4 h-4 text-purple-600" />
                    <p className="text-sm text-purple-700">Check Out Time</p>
                  </div>
                  <p className="font-bold text-purple-900">{selectedRecord.check_out ? formatDate(selectedRecord.check_out) : 'Not checked out'}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-100">
                  <div className="flex items-center gap-2 mb-1">
                    <FiClock className="w-4 h-4 text-amber-600" />
                    <p className="text-sm text-amber-700">Duration</p>
                  </div>
                  <p className="font-bold text-amber-900">{formatDuration(selectedRecord)}</p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <FiUser className="w-4 h-4 text-gray-600" />
                    <p className="text-sm text-gray-500">Checked In By</p>
                  </div>
                  <p className="font-bold text-gray-900">{selectedRecord.checked_in_by && selectedRecord.checked_in_by !== 'Not specified' ? selectedRecord.checked_in_by : 'Unknown'}</p>
                </div>
              </div>

              {selectedRecord.is_flagged && (
                <div className="mt-5 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <FiAlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <span className="font-semibold text-red-800">This vehicle is flagged</span>
                      <p className="text-red-600 text-sm">Please contact security for more information</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between">
                <div>
                  {selectedRecord.status === 'active' && !selectedRecord.is_flagged && (
                    <button
                      onClick={() => handleCheckout(selectedRecord)}
                      disabled={checkoutLoading}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {checkoutLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <FiLogOut className="w-4 h-4" />
                          Check Out Vehicle
                        </>
                      )}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default MonitorPage;
