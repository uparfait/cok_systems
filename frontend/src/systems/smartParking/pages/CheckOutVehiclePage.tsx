// Page for checking out vehicles from the parking lot

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { smartParkingService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { 
  FiSearch, FiTruck, FiCheckCircle, FiLogOut, FiClock, FiX
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
  current_duration_hours?: number;
  is_still_inhouse?: boolean;
}

const CheckOutVehiclePage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { socket } = useSocket();
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'staff' | 'visitors' | 'regular'>('all');
  const [allRecords, setAllRecords] = useState<ParkingRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ParkingRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [firstLoad, setFirstLoad] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchQueryRef = useRef('');
  
  // Modal state
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ParkingRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Handle socket event for car_checkedin
  const handleCarCheckedIn = useCallback((data: any) => {
    console.log('Car check-in detected, refreshing table silently...');
    loadData(searchQuery);
    // Show toaster with type and message
    switch (data.type) {
      case 'success':
        showSuccess(data.message);
        break;
      case 'error':
        showError(data.message);
        break;
      case 'warning':
        showWarning(data.message);
        break;
      default:
        showInfo(data.message);
    }
  }, [searchQuery, showSuccess, showError, showWarning, showInfo]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadData('');
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

  const handleFilterChange = (filter: 'all' | 'staff' | 'visitors' | 'regular') => {
    setTypeFilter(filter);
    // Build query based on filter type
    let query = '';
    if (filter === 'staff') {
      query = 'staff';
    } else if (filter === 'visitors') {
      query = 'visitor';
    } else if (filter === 'regular') {
      query = 'regular';
    }
    // Reload data with filter query
    loadData(query);
  };

  const handleSearch = () => {
    // Clear any pending debounced search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setIsSearching(true);
    loadData(searchQuery);
  };

  // Debounced search as user types
  useEffect(() => {
    // Don't search on initial load
    if (firstLoad) return;
    
    // Don't search if query hasn't changed
    if (searchQuery === lastSearchQueryRef.current) return;
    
    lastSearchQueryRef.current = searchQuery;
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for debounced search (300ms delay)
    searchTimeoutRef.current = setTimeout(() => {
      setIsSearching(true);
      loadData(searchQuery);
    }, 300);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, firstLoad]);

  const loadData = async (query: string = '') => {
    setLoading(true);
    try {
      let response;
      if (query && query.trim()) {
        response = await smartParkingService.search(query.trim());
      } else {
        response = await smartParkingService.getAll();
      }
      
      if (response.success && response.data) {
        // Only get records that are still in (has vehicle)
        const inHouseRecords = (response.data as ParkingRecord[]).filter(
          (record: ParkingRecord) => record.status === 'active' || record.is_still_inhouse
        );
        
        // Calculate durations
        const recordsWithDuration = inHouseRecords.map(record => {
          const recordObj = { ...record };
          if (record.status === 'active' && record.check_in) {
            const entryTime = new Date(record.check_in).getTime();
            const currentTime = new Date().getTime();
            const durationMs = currentTime - entryTime;
            const hours = Math.floor(durationMs / (1000 * 60 * 60));
            const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
            
            if (hours > 0) {
              recordObj.current_duration = `${hours}h ${minutes}m`;
            } else {
              recordObj.current_duration = `${minutes} mins`;
            }
            
            const hoursInside = hours + (minutes / 60);
            recordObj.is_over_limit = hoursInside >= 8;
          }
          return recordObj;
        });
        
        setAllRecords(recordsWithDuration);
        setTotalCount(response.total || 0);
        setTotalPages(Math.ceil((response.total || 0) / 20));
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      showError('Failed to load parking records');
    } finally {
      setLoading(false);
      setIsSearching(false);
      setFirstLoad(false);
    }
  };

  const filterRecords = () => {
    let filtered = [...allRecords];
    
    // Type filter is done on backend for search, but we keep client-side filtering for type buttons
    if (typeFilter !== 'all') {
      filtered = filtered.filter(record => {
        if (typeFilter === 'staff') {
          return record.driver_type?.toLowerCase() === 'staff';
        } else if (typeFilter === 'visitors') {
          return record.driver_type?.toLowerCase() === 'visitor';
        } else if (typeFilter === 'regular') {
          return record.driver_type?.toLowerCase() === 'regular';
        }
        return true;
      });
    }
    
    setFilteredRecords(filtered);
  };

  const handleCheckout = async () => {
    if (!selectedRecord) return;
    
    setActionLoading(true);
    try {
      // Use checkOutByPlate to send plate_number instead of ID
      const response = await smartParkingService.checkOutByPlate(selectedRecord.plate_number);
      
      if (response.success) {
        showSuccess('Vehicle checked out successfully!');
        setShowActionModal(false);
        setSelectedRecord(null);
        loadData(searchQuery);
      } else {
        showError(response.message || 'Failed to checkout vehicle');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      showError(error.message || 'Failed to checkout vehicle');
    } finally {
      setActionLoading(false);
    }
  };

  const openCheckoutModal = (record: ParkingRecord) => {
    setSelectedRecord(record);
    setShowActionModal(true);
  };

  const formatDate = (dateString: string | null) => {
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

  const getActionButton = (record: ParkingRecord) => {
    return (
      <button
        onClick={() => openCheckoutModal(record)}
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
      >
        <FiLogOut className="w-4 h-4" />
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
                  placeholder="Search by plate, name, or badge..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200/50 rounded-lg bg-white/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all backdrop-blur-sm"
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
              {(['all',] as const).map((filter) => (
                <button
                   onClick={() => handleFilterChange('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  typeFilter === 'all' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-white/50 text-gray-700 hover:bg-white/80 backdrop-blur-sm border border-gray-200/50'
                }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="backdrop-blur-xl bg-white/80 rounded-2xl shadow-lg border border-white/30 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
          <div className="overflow-auto flex-1">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-gradient-to-r from-gray-500/10 to-gray-500/5 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Plate Number
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Driver Name
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Badge
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Telephone
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    ID Number
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Type
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Check-in
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Duration
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/50">
                {(loading && firstLoad) ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-gray-500 text-sm">
                      Loading...
                    </td>
                  </tr>
                ) : isSearching ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-blue-600 text-sm font-medium">
                      searching.......
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-gray-500 text-sm">
                      No records found
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, index) => (
                    <tr key={record._id || index} className="hover:bg-blue-50/50 transition-colors duration-200">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`font-medium text-sm ${record.is_flagged ? 'text-red-600' : 'text-blue-600'}`}>
                          {record.plate_number || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-gray-800 text-sm">
                          {record.driver_name || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-gray-600 text-sm">
                          {record.badge_number || '_____'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-gray-600 text-sm">
                          {record.driver_telephone || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-gray-600 text-sm">
                          {typeof record.driver_identification === 'object' 
                            ? record.driver_identification?.number || '_____' 
                            : record.driver_identification || '_____'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                          record.driver_type === 'Staff' 
                            ? 'bg-blue-100 text-blue-800' 
                            : record.driver_type === 'Regular'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {record.driver_type || 'Visitor'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-gray-600 text-sm">
                        {formatDate(record.check_in)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className={`text-xs ${
                            record.is_over_limit ? 'text-red-600 font-medium' : 'text-gray-600'
                          }`}>
                            {formatDuration(record.current_duration)}
                          </span>
                          {record.is_over_limit && (
                            <FiClock className="w-3 h-3 text-red-500" title="Over time" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
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
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Action Modal */}
        {showActionModal && selectedRecord && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 p-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FiLogOut className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">Confirm Checkout</h3>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowActionModal(false);
                    setSelectedRecord(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 mx-4">
                <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div>
                    <span className="text-gray-500 text-xs sm:text-sm">Plate Number:</span>
                    <p className="font-medium text-sm sm:text-base">{selectedRecord.plate_number}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs sm:text-sm">Driver:</span>
                    <p className="font-medium text-sm sm:text-base">{selectedRecord.driver_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs sm:text-sm">Phone:</span>
                    <p className="font-medium text-sm sm:text-base">{selectedRecord.driver_telephone}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs sm:text-sm">Type:</span>
                    <p className="font-medium text-sm sm:text-base">{selectedRecord.driver_type || 'Visitor'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500 text-xs sm:text-sm">Check-in:</span>
                    <p className="font-medium text-sm sm:text-base">{formatDate(selectedRecord.check_in)}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3 p-4 pt-0">
                <button
                  onClick={() => {
                    setShowActionModal(false);
                    setSelectedRecord(null);
                  }}
                  className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={actionLoading}
                  className="flex-1 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FiCheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                  <span className="hidden sm:inline">Confirm Checkout</span>
                  <span className="sm:hidden">Confirm</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default CheckOutVehiclePage;
