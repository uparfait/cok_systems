// Page for checking out vehicles from the parking lot

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { smartParkingService } from '../../../core/services/adminService';
import { useParkingEvents } from '../../../core/hooks/useParkingEvents';
import MainLayout from '../../../core/components/Layout/MainLayout';
import {
  FiSearch, FiTruck, FiCheckCircle, FiLogOut, FiClock, FiX, FiFilter
} from 'react-icons/fi';

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const PURE_WHITE = "#FFFFFF";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const ACCENT_DARK_BLUE = "#2980B9";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

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
  const [paginationLoading, setPaginationLoading] = useState(false);
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

  // Load data function with proper error handling
  const loadData = useCallback(async (query: string = '', page: number = 1, filterType: string = typeFilter) => {
    const isLoadingNew = page === 1 && !query;
    if (isLoadingNew) {
      setLoading(true);
    } else {
      setPaginationLoading(true);
    }
    
    try {
      let response;
      
      // Build search query based on filter type
      let searchTerm = query;
      if (filterType !== 'all' && !searchTerm) {
        searchTerm = filterType;
      }
      
      if (searchTerm && searchTerm.trim()) {
        response = await smartParkingService.search(searchTerm.trim(), page, 50);
      } else {
        response = await smartParkingService.getAllPaginated(page, 50);
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
        
        // Apply client-side filtering if needed (for type filter)
        let filteredRecords = recordsWithDuration;
        if (filterType !== 'all' && !searchTerm) {
          filteredRecords = recordsWithDuration.filter(record => {
            if (filterType === 'staff') {
              return record.driver_type?.toLowerCase() === 'staff';
            } else if (filterType === 'visitors') {
              return record.driver_type?.toLowerCase() === 'visitor';
            } else if (filterType === 'regular') {
              return record.driver_type?.toLowerCase() === 'regular';
            }
            return true;
          });
        }
        
        setAllRecords(filteredRecords);
        setFilteredRecords(filteredRecords);
        setTotalCount(response.total || filteredRecords.length);
        setTotalPages(Math.ceil((response.total || filteredRecords.length) / 50));
        setCurrentPage(page);
      } else {
        setAllRecords([]);
        setFilteredRecords([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      showError(error.message || 'Failed to load parking records');
      setAllRecords([]);
      setFilteredRecords([]);
    } finally {
      setLoading(false);
      setPaginationLoading(false);
      setIsSearching(false);
      setFirstLoad(false);
    }
  }, [typeFilter, showError]);

  // Handle filter change
  const handleFilterChange = useCallback((filter: 'all' | 'staff' | 'visitors' | 'regular') => {
    setTypeFilter(filter);
    setCurrentPage(1);
    setSearchQuery(''); // Clear search when filtering
    lastSearchQueryRef.current = '';
    loadData('', 1, filter);
  }, [loadData]);

  // Handle search
  const handleSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setIsSearching(true);
    setCurrentPage(1);
    setTypeFilter('all'); // Reset filter when searching
    loadData(searchQuery, 1, 'all');
  }, [searchQuery, loadData]);

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
    
    // If search query is empty, load all data
    if (!searchQuery.trim()) {
      loadData('', 1, 'all');
      setTypeFilter('all');
      return;
    }
    
    // Set new timeout for debounced search (300ms delay)
    searchTimeoutRef.current = setTimeout(() => {
      setIsSearching(true);
      setCurrentPage(1);
      setTypeFilter('all');
      loadData(searchQuery, 1, 'all');
    }, 300);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, firstLoad, loadData]);

  // Initial load
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadData('', 1, 'all');
    }
  }, [isAuthenticated, authLoading, navigate, loadData]);

  // Debug: Track socket changes
  useEffect(() => {
    console.log('🔌 [CheckOutVehicle] Socket changed:', socket?.id, 'connected:', socket?.connected);
  }, [socket]);

  // Socket events handled by useParkingEvents hook (universal)
  useParkingEvents({ 
    refetch: () => {
      setCurrentPage(1);
      loadData('', 1, typeFilter);
    }
  });

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    loadData(searchQuery, newPage, typeFilter);
  }, [searchQuery, typeFilter, totalPages, loadData]);

  const handleCheckout = async () => {
    if (!selectedRecord) return;
    
    setActionLoading(true);
    try {
      const response = await smartParkingService.checkOutByPlate(selectedRecord.plate_number);
      
      if (response.success) {
        showSuccess('Vehicle checked out successfully!');
        setShowActionModal(false);
        setSelectedRecord(null);
        loadData(searchQuery, currentPage, typeFilter);
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
        className="inline-flex cursor-pointer items-center gap-1 px-3 py-1.5 transition-colors"
        style={{
          backgroundColor: DANGER,
          color: WHITE,
          borderRadius: 0,
          fontFamily: fontHeading,
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '1px',
          textTransform: 'uppercase'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#C0392B'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}
      >
        <FiLogOut className="w-4 h-4" />
        Checkout
      </button>
    );
  };

  const getFilterButtonClass = (filter: string) => {
    return `px-4 py-2 transition-all ${
      typeFilter === filter ? 'shadow-md' : ''
    }`;
  };

  return (
    <MainLayout>
      <div className="p-2" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        {/* Search and Filters */}
        <div className="p-3 mb-3" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
          <div className="flex flex-col md:flex-row gap-3 items-center">
            {/* Search Input */}
            <div className="flex-1 flex gap-2 w-full">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by plate, name, or badge..."
                  className="w-full pl-9 pr-3 py-2 cok-auth-input"
                  
                  
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-4 py-2 flex items-center gap-2 shadow-md transition-all"
                style={{
                  backgroundColor: PRIMARY,
                  color: WHITE,
                  borderRadius: 0,
                  fontFamily: fontHeading,
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
              >
                <FiSearch className="w-4 h-4" />
                Search
              </button>
            </div>

            
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 140px)', backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
          <div className="overflow-auto flex-1">
            <table className="w-full min-w-[1100px]">
              <thead className="sticky top-0 z-10 shadow-sm cok-bg-primary">
                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: fontHeading, color: PURE_WHITE }}>
                    Buttons
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: fontHeading, color: PURE_WHITE }}>
                    Plate Number
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: fontHeading, color: PURE_WHITE }}>
                    Driver Name
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: fontHeading, color: PURE_WHITE }}>
                    Badge
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: fontHeading, color: PURE_WHITE }}>
                    Telephone
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: fontHeading, color: PURE_WHITE }}>
                    ID Number
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: fontHeading, color: PURE_WHITE }}>
                    Type
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: fontHeading, color: PURE_WHITE }}>
                    Check-in
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: fontHeading, color: PURE_WHITE }}>
                    Duration
                  </th>

                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(loading && firstLoad) ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm" style={{ color: GRAY_DISABLED }}>
                      Loading...
                    </td>
                  </tr>
                ) : isSearching ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm font-medium" style={{ color: PRIMARY }}>
                      Searching...
                    </td>
                  </tr>
                ) : paginationLoading ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm" style={{ color: GRAY_DISABLED }}>
                      Loading page...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm" style={{ color: GRAY_DISABLED }}>
                      No records found
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, index) => (
                    <tr key={record._id || index} className="hover:bg-gray-50 transition-colors duration-200">
                                            <td className="px-3 py-3 whitespace-nowrap">
                        {getActionButton(record)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="font-medium text-sm" style={{ color: record.is_flagged ? DANGER : PRIMARY }}>
                          {record.plate_number || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-sm" style={{ color: PURE_WHITE }}>
                          {record.driver_name || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-sm" style={{ color: '#555555' }}>
                          {record.badge_number || '_____'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-sm" style={{ color: '#555555' }}>
                          {record.driver_telephone || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-sm" style={{ color: '#555555' }}>
                          {typeof record.driver_identification === 'object'
                            ? record.driver_identification?.number || '_____'
                            : record.driver_identification || '_____'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="px-2.5 py-1 text-xs font-medium" style={{
                          borderRadius: 0,
                          backgroundColor: record.driver_type === 'Staff'
                            ? 'rgba(5,109,170,0.1)'
                            : record.driver_type === 'Regular'
                            ? 'rgba(41,128,185,0.1)'
                            : 'rgba(76,175,80,0.1)',
                          color: record.driver_type === 'Staff'
                            ? PRIMARY
                            : record.driver_type === 'Regular'
                            ? ACCENT_DARK_BLUE
                            : SUCCESS
                        }}>
                          {record.driver_type || 'Visitor'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm" style={{ color: '#555555' }}>
                        {formatDate(record.check_in)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className={`text-xs ${record.is_over_limit ? 'font-medium' : ''}`} style={{
                            color: record.is_over_limit ? DANGER : '#555555'
                          }}>
                            {formatDuration(record.current_duration)}
                          </span>
                          {record.is_over_limit && (
                            <FiClock className="w-3 h-3" style={{ color: DANGER }} title="Over time" />
                          )}
                        </div>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination - Fixed: Proper page navigation */}
          <div className="px-2 py-2 flex justify-between items-center" style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: NEUTRAL_LIGHT }}>
            <p className="text-xs" style={{ color: '#555555' }}>
              Showing {filteredRecords.length} of {totalCount} results
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || paginationLoading}
                className="px-3 py-1 bg-transparent hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{
                  border: `1px solid ${PRIMARY}`,
                  color: PRIMARY,
                  borderRadius: 0,
                  fontFamily: fontHeading,
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}
              >
                Previous
              </button>
              <span className="text-sm py-1 px-3" style={{ color: '#555555' }}>
                Page {currentPage} of {totalPages || 1}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || paginationLoading}
                className="px-3 py-1 bg-transparent hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{
                  border: `1px solid ${PRIMARY}`,
                  color: PRIMARY,
                  borderRadius: 0,
                  fontFamily: fontHeading,
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Action Modal */}
        {showActionModal && selectedRecord && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
              <div className="flex items-center justify-between mb-4 p-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(231,76,60,0.1)', borderRadius: 0 }}>
                    <FiLogOut className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: DANGER }} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg" style={{ fontFamily: fontHeading, fontWeight: 700, color: PURE_WHITE }}>Confirm Checkout</h3>
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

              <div className="p-3 sm:p-4 mb-4 mx-4" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div>
                    <span style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>Plate Number:</span>
                    <p className="font-medium text-sm sm:text-base" style={{ color: PURE_WHITE }}>{selectedRecord.plate_number}</p>
                  </div>
                  <div>
                    <span style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>Driver:</span>
                    <p className="font-medium text-sm sm:text-base" style={{ color: PURE_WHITE }}>{selectedRecord.driver_name}</p>
                  </div>
                  <div>
                    <span style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>Phone:</span>
                    <p className="font-medium text-sm sm:text-base" style={{ color: PURE_WHITE }}>{selectedRecord.driver_telephone}</p>
                  </div>
                  <div>
                    <span style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>Type:</span>
                    <p className="font-medium text-sm sm:text-base" style={{ color: PURE_WHITE }}>{selectedRecord.driver_type || 'Visitor'}</p>
                  </div>
                  <div className="col-span-2">
                    <span style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>Check-in:</span>
                    <p className="font-medium text-sm sm:text-base" style={{ color: PURE_WHITE }}>{formatDate(selectedRecord.check_in)}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3 p-4 pt-0">
                <button
                  onClick={() => {
                    setShowActionModal(false);
                    setSelectedRecord(null);
                  }}
                  className="flex-1 px-3 sm:px-4 py-2 bg-transparent hover:bg-gray-100 transition-colors"
                  style={{
                    border: `1px solid ${PRIMARY}`,
                    color: PRIMARY,
                    borderRadius: 0,
                    fontFamily: fontHeading,
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={actionLoading}
                  className="flex-1 px-3 sm:px-4 py-2 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  style={{
                    backgroundColor: DANGER,
                    color: WHITE,
                    borderRadius: 0,
                    fontFamily: fontHeading,
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#C0392B'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}
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