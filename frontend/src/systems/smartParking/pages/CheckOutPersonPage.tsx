// CheckOutPersonPage - Smart Parking Person Checkout (Without Vehicle)
// Page for checking out visitors without vehicles

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { 
  FiSearch, FiUser, FiCheckCircle, FiLogOut, FiClock, FiX, FiTruck
} from 'react-icons/fi';

interface VisitorRecord {
  _id?: string;
  full_name: string;
  telephone: string;
  email?: string;
  badge_number?: string;
  identification?: {
    id_type?: string;
    number?: string;
  };
  driver_identification?: any;
  vehicle_storage?: {
    has_vehicle: boolean;
    vehicle_details?: {
      plate_number?: string;
      entered_time?: Date;
      exited_time?: Date;
      duration?: string;
    };
  };
  visitor_type?: string;
  entry_date?: string;
  exist_date?: string | null;
  is_still_inhouse?: boolean;
  marked_as_out?: boolean;
  current_duration?: string;
  is_over_limit?: boolean;
  current_duration_hours?: number;
}

const CheckOutPersonPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, showInfo } = useToast();
  const { socket } = useSocket();
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'staff' | 'visitors' | 'regular'>('all');
  const [allRecords, setAllRecords] = useState<VisitorRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<VisitorRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [firstLoad, setFirstLoad] = useState(true);
  
  // Modal state
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<VisitorRecord | null>(null);
  const [actionType, setActionType] = useState<'checkout' | 'leave' | 'return' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Handle socket event for car_checkedin
  const handleCarCheckedIn = useCallback(() => {
    console.log('Car check-in detected, refreshing table silently...');
    // Load data silently without showing notification
    loadData(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (!socket) return;

    socket.on('car_checkedin', handleCarCheckedIn);

    return () => {
      socket.off('car_checkedin', handleCarCheckedIn);
    };
  }, [socket, handleCarCheckedIn]);

  useEffect(() => {
    filterRecords();
  }, [allRecords]);

  const handleFilterChange = (filter: 'all') => {
    setTypeFilter(filter);
    // Build query based on filter type
    let query = '';
    // Reload data with filter query
    loadData(query);
  };

  const handleSearch = () => {
    loadData(searchQuery);
  };

  const loadData = async (query: string = '') => {
    setLoading(true);
    try {
      let response;
      if (query && query.trim()) {
        response = await serviceDeliveryService.search(query.trim(), currentPage,20, true);
      } else {
        response = await serviceDeliveryService.getAll(currentPage, 20, true);
      }
      
      if (response.success && response.data) {
        // Calculate durations for in-house visitors
        const visitorsWithDuration = (response.data as VisitorRecord[]).map(visitor => {
          const visitorObj = { ...visitor };
          if (visitor.is_still_inhouse && visitor.entry_date) {
            const entryTime = new Date(visitor.entry_date).getTime();
            const currentTime = new Date().getTime();
            const durationMs = currentTime - entryTime;
            const hours = Math.floor(durationMs / (1000 * 60 * 60));
            const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
            
            if (hours > 0) {
              visitorObj.current_duration = `${hours}h ${minutes}m`;
            } else {
              visitorObj.current_duration = `${minutes} mins`;
            }
            
            const hoursInside = hours + (minutes / 60);
            visitorObj.is_over_limit = hoursInside >= 8;
          }
          return visitorObj;
        });
        
        // Show ALL in-house visitors (both with and without vehicles)
        setAllRecords(visitorsWithDuration);
        setTotalCount(response.total || 0);
        setTotalPages(Math.ceil((response.total || 0) / 20));
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      showError('Failed to load visitor records');
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  };

  const filterRecords = () => {
    let filtered = [...allRecords];
    
    setFilteredRecords(filtered);
  };

  const handleCheckout = async () => {
    if (!selectedRecord) return;
    
    setActionLoading(true);
    try {
      const response = await serviceDeliveryService.checkOut(selectedRecord._id as string);
      
      if (response.success) {
        showSuccess('Visitor checked out successfully!');
        setShowActionModal(false);
        setSelectedRecord(null);
        setActionType(null);
        loadData(searchQuery);
      } else {
        showError(response.message || 'Failed to checkout visitor');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      showError(error.message || 'Failed to checkout visitor');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAsOut = async () => {
    if (!selectedRecord) return;
    
    setActionLoading(true);
    try {
      const response = await serviceDeliveryService.emergencyLeaveReturn(selectedRecord._id as string, {
        action: 'leave'
      });
      
      if (response.success) {
        showSuccess('Visitor marked as outside!');
        setShowActionModal(false);
        setSelectedRecord(null);
        setActionType(null);
        loadData(searchQuery);
      } else {
        showError(response.message || 'Failed to mark visitor as outside');
      }
    } catch (error: any) {
      console.error('Mark as out error:', error);
      showError(error.message || 'Failed to mark visitor as outside');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAsIn = async () => {
    if (!selectedRecord) return;
    
    setActionLoading(true);
    try {
      const response = await serviceDeliveryService.emergencyLeaveReturn(selectedRecord._id as string, {
        action: 'return'
      });
      
      if (response.success) {
        showSuccess('Visitor marked as returned inside!');
        setShowActionModal(false);
        setSelectedRecord(null);
        setActionType(null);
        loadData(searchQuery);
      } else {
        showError(response.message || 'Failed to mark visitor as returned');
      }
    } catch (error: any) {
      console.error('Mark as in error:', error);
      showError(error.message || 'Failed to mark visitor as returned');
    } finally {
      setActionLoading(false);
    }
  };

  const openCheckoutModal = (record: VisitorRecord) => {
    setSelectedRecord(record);
    setActionType('checkout');
    setShowActionModal(true);
  };

  const openMarkAsOutModal = (record: VisitorRecord) => {
    setSelectedRecord(record);
    setActionType('leave');
    setShowActionModal(true);
  };

  const openMarkAsInModal = (record: VisitorRecord) => {
    setSelectedRecord(record);
    setActionType('return');
    setShowActionModal(true);
  };

  const handleAction = () => {
    if (actionType === 'checkout') {
      handleCheckout();
    } else if (actionType === 'leave') {
      handleMarkAsOut();
    } else if (actionType === 'return') {
      handleMarkAsIn();
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (duration: string | undefined) => {
    if (!duration) return '-';
    return duration;
  };

  const getActionButton = (record: VisitorRecord) => {
    // Check if visitor has a vehicle
    const hasVehicle = record.vehicle_storage?.has_vehicle;
    
    if (hasVehicle) {
      // Visitor has a vehicle - show Partial Exit / Returned based on marked_as_out
      if (record.marked_as_out) {
        return (
          <button
            onClick={() => openMarkAsInModal(record)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-all shadow-sm"
          >
            <FiLogOut className="w-3.5 h-3.5" />
            Returned
          </button>
        );
      } else {
        return (
          <button
            onClick={() => openMarkAsOutModal(record)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition-all shadow-sm"
          >
            <FiLogOut className="w-3.5 h-3.5" />
            Partial Exit
          </button>
        );
      }
    }
    
    // Visitor doesn't have a vehicle - show Checkout button
    return (
      <button
        onClick={() => openCheckoutModal(record)}
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-all shadow-sm"
      >
        <FiLogOut className="w-3.5 h-3.5" />
        Checkout
      </button>
    );
  };

  return (
    <MainLayout>
      <div className="p-2">
        {/* Search and Filters */}
        <div className="backdrop-blur-xl bg-white/80 rounded-2xl shadow-lg border border-white/30 p-3 mb-3">
          <div className="flex flex-col md:flex-row gap-3 items-center">
            {/* Search Input */}
            <div className="flex-1 flex gap-2 w-full">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200/50 rounded-lg bg-white/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 shadow-md transition-all"
              >
                <FiSearch className="w-4 h-4" />
                Search
              </button>
            </div>
            
            {/* Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleFilterChange('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  typeFilter === 'all' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-white/50 text-gray-700 hover:bg-white/80 backdrop-blur-sm border border-gray-200/50'
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="backdrop-blur-xl bg-white/80 rounded-2xl shadow-lg border border-white/30 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>

          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-500/10 to-gray-500/5 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Visitor Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Badge
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Telephone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    ID Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Car Plate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Check-in
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/50">
                {(loading && firstLoad) ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500 text-sm">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        Loading...
                      </div>
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500 text-sm">
                      <div className="flex flex-col items-center gap-1">
                        <FiSearch className="w-6 h-6 text-gray-400" />
                        <span>No records found</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, index) => (
                    <tr key={record._id || index} className="hover:bg-blue-50/50 transition-colors duration-200">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <FiUser className="w-4 h-4 text-emerald-600" />
                          </div>
                          <span className="text-gray-900 text-sm font-medium">
                            {record.full_name || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-gray-600 text-sm">
                          {record.email || '_____'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                          {record.badge_number || '_____'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-gray-600 text-sm">
                          {record.telephone || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-gray-600 text-sm">
                          {typeof record.driver_identification === 'object' 
                            ? (record.driver_identification?.number || record.identification?.number || '_____') 
                            : record.driver_identification || '_____'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`font-medium text-sm ${record.vehicle_storage?.has_vehicle ? 'text-blue-600' : 'text-gray-500'}`}>
                          {record.vehicle_storage?.has_vehicle 
                            ? record.vehicle_storage?.vehicle_details?.plate_number || '_____' 
                            : 'No vehicle'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-600 text-sm">
                        {formatDate(record.entry_date)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            record.is_over_limit 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {formatDuration(record.current_duration)}
                          </span>
                          {record.is_over_limit && (
                            <FiClock className="w-3.5 h-3.5 text-red-500" title="Over time" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {getActionButton(record)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Results count */}
          <div className="px-2 py-2 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
            <p className="text-xs text-gray-600">
              Showing {filteredRecords.length} of {totalCount} results
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  if (currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                    loadData(searchQuery);
                  }
                }}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="text-xs text-gray-600 py-1">
                {currentPage}/{totalPages}
              </span>
              <button
                onClick={() => {
                  if (currentPage < totalPages) {
                    setCurrentPage(currentPage + 1);
                    loadData(searchQuery);
                  }
                }}
                disabled={currentPage >= totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Action Modal */}
        {showActionModal && selectedRecord && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    actionType === 'checkout' ? 'bg-red-100' : 
                    actionType === 'leave' ? 'bg-orange-100' : 'bg-green-100'
                  }`}>
                    {actionType === 'checkout' ? (
                      <FiLogOut className="w-6 h-6 text-red-600" />
                    ) : actionType === 'leave' ? (
                      <FiLogOut className="w-6 h-6 text-orange-600" />
                    ) : (
                      <FiCheckCircle className="w-6 h-6 text-green-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {actionType === 'checkout' ? 'Confirm Checkout' : 
                       actionType === 'leave' ? 'Partial Exit' : 'Returned'}
                    </h3>
                    <p className="text-sm text-gray-500">{selectedRecord.full_name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowActionModal(false);
                    setSelectedRecord(null);
                    setActionType(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Phone:</span>
                    <p className="font-medium">{selectedRecord.telephone}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Badge:</span>
                    <p className="font-medium">{selectedRecord.badge_number || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Check-in:</span>
                    <p className="font-medium">{formatDate(selectedRecord.entry_date)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Duration:</span>
                    <p className="font-medium">{selectedRecord.current_duration}</p>
                  </div>
                  {selectedRecord.vehicle_storage?.has_vehicle && (
                    <div className="col-span-2 mt-2 p-2 bg-orange-50 border border-orange-200 rounded">
                      <p className="text-orange-700 text-xs font-medium">
                        ⚠️ Warning: This visitor has a vehicle ({selectedRecord.vehicle_storage?.vehicle_details?.plate_number || 'N/A'}). The car is still parked.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowActionModal(false);
                    setSelectedRecord(null);
                    setActionType(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={actionLoading}
                  className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 font-medium flex items-center justify-center gap-2 ${
                    actionType === 'checkout' ? 'bg-red-600 hover:bg-red-700' :
                    actionType === 'leave' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {actionLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    actionType === 'checkout' ? <FiLogOut className="w-5 h-5" /> :
                    actionType === 'leave' ? <FiLogOut className="w-5 h-5" /> : <FiCheckCircle className="w-5 h-5" />
                  )}
                  {actionType === 'checkout' ? 'Confirm Checkout' : 
                   actionType === 'leave' ? 'Partial Exit' : 'Returned'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default CheckOutPersonPage;

