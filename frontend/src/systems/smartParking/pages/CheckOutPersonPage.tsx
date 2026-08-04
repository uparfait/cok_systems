// CheckOutPersonPage - Smart Parking Person Checkout (Without Vehicle)
// Page for checking out visitors without vehicles

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import {
  FiSearch, FiUser, FiCheckCircle, FiLogOut, FiClock, FiX, FiTruck, FiFilter
} from 'react-icons/fi';

// City of Kigali (CoK) institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#388E3C";
const WARNING = "#F39C12";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#056daa";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

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
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { socket } = useSocket();
  
  const [loading, setLoading] = useState(true);
  const [paginationLoading, setPaginationLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'staff' | 'visitors' | 'regular'>('all');
  const [allRecords, setAllRecords] = useState<VisitorRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<VisitorRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [firstLoad, setFirstLoad] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchQueryRef = useRef('');
  
  // Modal state
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<VisitorRecord | null>(null);
  const [actionType, setActionType] = useState<'checkout' | 'leave' | 'return' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [badgeInput, setBadgeInput] = useState('');

  // Memoized loadData function
  const loadData = useCallback(async (query: string = '', page: number = currentPage, filterType: string = typeFilter) => {
    const isInitialLoad = page === 1 && !query;
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setPaginationLoading(true);
    }
    
    try {
      let response;
      let searchTerm = query;
      
      // If no search query but filter is applied, use filter as search term
      if (!searchTerm && filterType !== 'all') {
        searchTerm = filterType;
      }
      
      if (searchTerm && searchTerm.trim()) {
        response = await serviceDeliveryService.search(searchTerm.trim(), page, 50, true);
      } else {
        response = await serviceDeliveryService.getAll(page, 50, true);
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
        
        // Apply client-side filtering if needed
        let filteredVisitors = visitorsWithDuration;
        if (filterType !== 'all' && !searchTerm) {
          filteredVisitors = visitorsWithDuration.filter(visitor => {
            if (filterType === 'staff') {
              return visitor.visitor_type?.toLowerCase() === 'staff';
            } else if (filterType === 'visitors') {
              return visitor.visitor_type?.toLowerCase() === 'visitor';
            } else if (filterType === 'regular') {
              return visitor.visitor_type?.toLowerCase() === 'regular';
            }
            return true;
          });
        }
        
        setAllRecords(filteredVisitors);
        setFilteredRecords(filteredVisitors);
        setTotalCount(response.total || filteredVisitors.length);
        setTotalPages(Math.ceil((response.total || filteredVisitors.length) / 50));
        setCurrentPage(page);
      } else {
        setAllRecords([]);
        setFilteredRecords([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      showError(error.message || 'Failed to load visitor records');
      setAllRecords([]);
      setFilteredRecords([]);
    } finally {
      setLoading(false);
      setPaginationLoading(false);
      setIsSearching(false);
      setFirstLoad(false);
    }
  }, [currentPage, typeFilter, showError]);

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

  // Handle socket event for car_checkedin
  const handleCarCheckedIn = useCallback((data: any) => {
    console.log('Car check-in detected, refreshing table silently...');
    // Load data silently without showing notification
    loadData(searchQuery, currentPage, typeFilter);
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
  }, [searchQuery, currentPage, typeFilter, loadData, showSuccess, showError, showWarning, showInfo]);

  // Initial load
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadData('', 1, 'all');
    }
  }, [isAuthenticated, authLoading, navigate, loadData]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('car_checkedin', handleCarCheckedIn);

    // Listen for visitor check-in events
    const handleVisitorCheckin = (data: any) => {
      console.log('🔔 [CheckOutPerson] visitor_checkedin event received:', data);
      
      if (data.show_notif === false) {
        const message = data.message || 'Visitor checked in';
        const type = data.type || 'info';
        
        if (type === 'success') showSuccess(message);
        else if (type === 'error') showError(message);
        else if (type === 'warning') showWarning(message);
        else showInfo(message);
      }
      
      loadData(searchQuery, currentPage, typeFilter);
      console.log('✅ [CheckOutPerson] Table data refetched');
    };

    socket.on('visitor_checkedin', handleVisitorCheckin);

    // Listen for visitor check-out events
    const handleVisitorCheckout = (data: any) => {
      console.log('🔔 [CheckOutPerson] visitor_checkedout event received:', data);
      
      if (data.show_notif === false) {
        const message = data.message || 'Visitor checked out';
        const type = data.type || 'info';
        
        if (type === 'success') showSuccess(message);
        else if (type === 'error') showError(message);
        else if (type === 'warning') showWarning(message);
        else showInfo(message);
      }
      
      loadData(searchQuery, currentPage, typeFilter);
      console.log('✅ [CheckOutPerson] Table data refetched after visitor checkout');
    };

    socket.on('visitor_checkedout', handleVisitorCheckout);

    // Listen for car check-out events
    const handleCarCheckout = (data: any) => {
      console.log('🔔 [CheckOutPerson] car_checkedout event received:', data);
      
      if (data.show_notif === false) {
        const message = data.message || 'Vehicle checked out';
        const type = data.type || 'info';
        
        if (type === 'success') showSuccess(message);
        else if (type === 'error') showError(message);
        else if (type === 'warning') showWarning(message);
        else showInfo(message);
      }
      
      loadData(searchQuery, currentPage, typeFilter);
      console.log('✅ [CheckOutPerson] Table data refetched after car checkout');
    };

    socket.on('car_checkedout', handleCarCheckout);

    return () => {
      socket.off('car_checkedin', handleCarCheckedIn);
      socket.off('visitor_checkedin', handleVisitorCheckin);
      socket.off('visitor_checkedout', handleVisitorCheckout);
      socket.off('car_checkedout', handleCarCheckout);
    };
  }, [socket, handleCarCheckedIn, showSuccess, showError, showWarning, showInfo, searchQuery, currentPage, typeFilter, loadData]);

  // Filter records based on type
  useEffect(() => {
    let filtered = [...allRecords];
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(record => {
        if (typeFilter === 'staff') {
          return record.visitor_type?.toLowerCase() === 'staff';
        } else if (typeFilter === 'visitors') {
          return record.visitor_type?.toLowerCase() === 'visitor';
        } else if (typeFilter === 'regular') {
          return record.visitor_type?.toLowerCase() === 'regular';
        }
        return true;
      });
    }
    
    setFilteredRecords(filtered);
  }, [allRecords, typeFilter]);

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
      const response = await serviceDeliveryService.checkoutWithBadge(
        selectedRecord._id as string,
        badgeInput || null,
        []
      );

      if (response.success) {
        showSuccess('Visitor checked out successfully!');
        setShowActionModal(false);
        setSelectedRecord(null);
        setActionType(null);
        setBadgeInput('');
        loadData(searchQuery, currentPage, typeFilter);
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
        loadData(searchQuery, currentPage, typeFilter);
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
        loadData(searchQuery, currentPage, typeFilter);
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
    setBadgeInput('');
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
    const hasVehicle = record.vehicle_storage?.has_vehicle;
    
    if (hasVehicle) {
      if (record.marked_as_out) {
        return (
          <button
            onClick={() => openMarkAsInModal(record)}
            className="inline-flex cursor-pointer items-center gap-1 px-3 py-1.5 text-xs transition-colors"
            style={{ backgroundColor: SUCCESS, color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SUCCESS_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = SUCCESS; }}
          >
            <FiLogOut className="w-3.5 h-3.5" />
            Returned
          </button>
        );
      } else {
        return (
          <button
            onClick={() => openMarkAsOutModal(record)}
            className="inline-flex cursor-pointer items-center gap-1 px-3 py-1.5 text-xs transition-colors"
            style={{ backgroundColor: WARNING, color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#D68910'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = WARNING; }}
          >
            <FiLogOut className="w-3.5 h-3.5" />
            Partial Exit
          </button>
        );
      }
    }

    return (
      <button
        onClick={() => openCheckoutModal(record)}
        className="inline-flex cursor-pointer items-center gap-1 px-3 py-1.5 text-xs transition-colors"
        style={{ backgroundColor: DANGER, color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#C0392B'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}
      >
        <FiLogOut className="w-3.5 h-3.5" />
        Checkout
      </button>
    );
  };

  const getFilterButtonClass = (filter: string) => {
    return 'px-4 py-2 transition-colors';
  };

  const getFilterButtonStyle = (filter: string): React.CSSProperties => {
    return typeFilter === filter
      ? { backgroundColor: PRIMARY, color: WHITE, border: `1px solid ${PRIMARY}`, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }
      : { backgroundColor: WHITE, color: NEUTRAL_DARK, border: `1px solid ${BORDER}`, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' };
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
                  placeholder="Search by name, badge, or phone..."
                  className="w-full pl-9 pr-3 py-2 cok-auth-input"

                />
              </div>
              <button
                onClick={handleSearch}
                className="px-4 py-2 flex items-center gap-2 transition-colors"
                style={{ backgroundColor: PRIMARY, color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
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
            <table className="w-full min-w-[1200px]">
              <thead className="sticky top-0 z-10 cok-primary-bg" >
                <tr>
                                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider" style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '0.5px', color: "#FFFFFF" }}>
                    Buttons
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider" style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '0.5px', color: "#FFFFFF" }}>
                    Visitor Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider" style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '0.5px', color: "#FFFFFF" }}>
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider" style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '0.5px', color: "#FFFFFF" }}>
                    Badge
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider" style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '0.5px', color: "#FFFFFF" }}>
                    Telephone
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider" style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '0.5px', color: "#FFFFFF" }}>
                    ID Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider" style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '0.5px', color: "#FFFFFF" }}>
                    Car Plate
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider" style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '0.5px', color: "#FFFFFF" }}>
                    Check-in
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider" style={{ fontFamily: fontHeading, fontWeight: 600, letterSpacing: '0.5px', color: "#FFFFFF" }}>
                    Duration
                  </th>
                  

                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {(loading && firstLoad) ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: GRAY_DISABLED }}>
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
                        Loading...
                      </div>
                    </td>
                  </tr>
                ) : isSearching ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm font-medium" style={{ color: PRIMARY }}>
                      Searching...
                    </td>
                  </tr>
                ) : paginationLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: GRAY_DISABLED }}>
                      Loading page...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: GRAY_DISABLED }}>
                      <div className="flex flex-col items-center gap-1">
                        <FiSearch className="w-6 h-6" style={{ color: GRAY_DISABLED }} />
                        <span>No records found</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, index) => (
                    <tr key={record._id || index} className="hover:bg-[rgba(5,109,170,0.06)]  transition-colors duration-200">
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                        {getActionButton(record)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 flex items-center justify-center" style={{ backgroundColor: 'rgba(76,175,80,0.1)', borderRadius: 0 }}>
                            <FiUser className="w-4 h-4" style={{ color: SUCCESS }} />
                          </div>
                          <span className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>
                            {record.full_name || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-sm" style={{ color: '#555555' }}>
                          {record.email || '_____'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: NEUTRAL_LIGHT, color: '#555555', border: `1px solid ${BORDER}`, borderRadius: 0 }}>
                          {record.badge_number || '_____'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-sm" style={{ color: '#555555' }}>
                          {record.telephone || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-sm" style={{ color: '#555555' }}>
                          {typeof record.driver_identification === 'object'
                            ? (record.driver_identification?.number || record.identification?.number || '_____')
                            : record.driver_identification || '_____'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-medium text-sm" style={{ color: record.vehicle_storage?.has_vehicle ? PRIMARY : GRAY_DISABLED }}>
                          {record.vehicle_storage?.has_vehicle
                            ? record.vehicle_storage?.vehicle_details?.plate_number || '_____'
                            : 'No vehicle'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-sm" style={{ color: '#555555' }}>
                        {formatDate(record.entry_date)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-xs font-medium px-2 py-0.5"
                            style={record.is_over_limit
                              ? { backgroundColor: 'rgba(231,76,60,0.1)', color: DANGER, borderRadius: 0 }
                              : { backgroundColor: NEUTRAL_LIGHT, color: '#555555', borderRadius: 0 }}
                          >
                            {formatDuration(record.current_duration)}
                          </span>
                          {record.is_over_limit && (
                            <FiClock className="w-3.5 h-3.5" style={{ color: DANGER }} title="Over time" />
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
          <div className="px-2 py-2 flex justify-between items-center" style={{ backgroundColor: NEUTRAL_LIGHT, borderTop: `1px solid ${BORDER}` }}>
            <p className="text-xs" style={{ color: '#555555' }}>
              Showing {filteredRecords.length} of {totalCount} results
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || paginationLoading}
                className="px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(5,109,170,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                Previous
              </button>
              <span className="text-sm py-1 px-3" style={{ color: '#555555' }}>
                Page {currentPage} of {totalPages || 1}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || paginationLoading}
                className="px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(5,109,170,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
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
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor:
                      actionType === 'checkout' ? 'rgba(231,76,60,0.1)' :
                      actionType === 'leave' ? 'rgba(243,156,18,0.1)' : 'rgba(76,175,80,0.1)'
                    }}
                  >
                    {actionType === 'checkout' ? (
                      <FiLogOut className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: DANGER }} />
                    ) : actionType === 'leave' ? (
                      <FiLogOut className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: WARNING }} />
                    ) : (
                      <FiCheckCircle className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: SUCCESS }} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                      {actionType === 'checkout' ? 'Confirm Checkout' :
                       actionType === 'leave' ? 'Partial Exit' : 'Returned'}
                    </h3>
                    <p className="text-sm truncate" style={{ color: GRAY_DISABLED }}>{selectedRecord.full_name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowActionModal(false);
                    setSelectedRecord(null);
                    setActionType(null);
                    setBadgeInput('');
                  }}
                  className="p-1 transition-colors"
                  style={{ color: GRAY_DISABLED }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = NEUTRAL_DARK; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = GRAY_DISABLED; }}
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 sm:p-4 mb-4 mx-4" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div>
                    <span style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>Phone:</span>
                    <p className="font-medium text-sm sm:text-base" style={{ color: NEUTRAL_DARK }}>{selectedRecord.telephone}</p>
                  </div>
                  <div>
                    <span style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>Badge:</span>
                    <p className="font-medium text-sm sm:text-base" style={{ color: NEUTRAL_DARK }}>{selectedRecord.badge_number || 'N/A'}</p>
                  </div>
                  <div>
                    <span style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>Check-in:</span>
                    <p className="font-medium text-sm sm:text-base" style={{ color: NEUTRAL_DARK }}>{formatDate(selectedRecord.entry_date)}</p>
                  </div>
                  <div>
                    <span style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>Duration:</span>
                    <p className="font-medium text-sm sm:text-base" style={{ color: NEUTRAL_DARK }}>{selectedRecord.current_duration || 'N/A'}</p>
                  </div>
                  {selectedRecord.vehicle_storage?.has_vehicle && (
                    <div className="col-span-2 mt-2 p-2" style={{ backgroundColor: 'rgba(243,156,18,0.08)', border: `1px solid ${WARNING}`, borderRadius: 0 }}>
                      <p className="text-xs font-medium" style={{ color: WARNING }}>
                        ⚠️ Warning: This visitor has a vehicle ({selectedRecord.vehicle_storage?.vehicle_details?.plate_number || 'N/A'}). The car is still parked.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <hr className="my-3" style={{ borderColor: BORDER }} />

              {actionType === 'checkout' && (
                <div className="mb-2 px-4">
                  <label className="block mb-1 text-sm" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>
                    Badge Number <span style={{ color: GRAY_DISABLED }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={badgeInput}
                    onChange={(e) => setBadgeInput(e.target.value)}
                    className="w-full cok-auth-input pr-3 py-2 text-sm"
                    placeholder="Enter badge number"
                  />
                </div>
              )}

              <div className="flex gap-2 sm:gap-3 p-4 pt-0">
                <button
                  onClick={() => {
                    setShowActionModal(false);
                    setSelectedRecord(null);
                    setActionType(null);
                    setBadgeInput('');
                  }}
                  className="flex-1 px-3 sm:px-4 py-2 transition-colors"
                  style={{ backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(5,109,170,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={actionLoading}
                  className="flex-1 px-3 sm:px-4 py-2 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  style={{
                    backgroundColor: actionType === 'checkout' ? DANGER : actionType === 'leave' ? WARNING : SUCCESS,
                    color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = actionType === 'checkout' ? '#C0392B' : actionType === 'leave' ? '#D68910' : SUCCESS_HOVER;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = actionType === 'checkout' ? DANGER : actionType === 'leave' ? WARNING : SUCCESS;
                  }}
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    actionType === 'checkout' ? <FiLogOut className="w-4 h-4 sm:w-5 sm:h-5" /> :
                    actionType === 'leave' ? <FiLogOut className="w-4 h-4 sm:w-5 sm:h-5" /> : <FiCheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                  <span className="hidden sm:inline">
                    {actionType === 'checkout' ? 'Confirm Checkout' : 
                     actionType === 'leave' ? 'Partial Exit' : 'Returned'}
                  </span>
                  <span className="sm:hidden">
                    {actionType === 'checkout' ? 'Confirm' : 
                     actionType === 'leave' ? 'Exit' : 'Confirm'}
                  </span>
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