// CheckOutVehiclePage - Smart Parking Vehicle Checkout
// Page for checking out vehicles from the parking lot - vehicles only

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { smartParkingService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { 
  FiSearch, FiTruck, FiCheckCircle, FiLogOut, FiClock
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
  const { showSuccess, showError } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'staff' | 'visitors' | 'regular'>('all');
  const [allRecords, setAllRecords] = useState<ParkingRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ParkingRecord[]>([]);
  
  // Modal state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ParkingRecord | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    filterRecords();
  }, [allRecords, searchQuery, typeFilter]);

  const handleFilterChange = (filter: 'all' | 'staff' | 'visitors' | 'regular') => {
    setTypeFilter(filter);
  };

  const handleSearch = () => {
    filterRecords();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const parkingResponse = await smartParkingService.getAll();
      
      if (parkingResponse.success && parkingResponse.data) {
        // Only get records that are still in (has vehicle)
        const inHouseRecords = (parkingResponse.data as ParkingRecord[]).filter(
          (record: ParkingRecord) => record.status === 'active' || record.is_still_inhouse
        );
        setAllRecords(inHouseRecords);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      showError('Failed to load parking records');
    } finally {
      setLoading(false);
    }
  };

  const filterRecords = () => {
    let filtered = [...allRecords];
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(record => 
        record.plate_number?.toLowerCase().includes(query) ||
        record.driver_name?.toLowerCase().includes(query) ||
        record.badge_number?.toLowerCase().includes(query)
      );
    }
    
    // Filter by type
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
    
    setCheckoutLoading(true);
    try {
      const response = await smartParkingService.checkOut(selectedRecord._id as string);
      
      if (response.success) {
        showSuccess('Vehicle checked out successfully!');
        setShowCheckoutModal(false);
        setSelectedRecord(null);
        loadData();
      } else {
        showError(response.message || 'Failed to checkout vehicle');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      showError(error.message || 'Failed to checkout vehicle');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const openCheckoutModal = (record: ParkingRecord) => {
    setSelectedRecord(record);
    setShowCheckoutModal(true);
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

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FiTruck className="w-8 h-8 text-blue-600" />
            Vehicle Check-out
          </h1>
          <p className="text-gray-600 mt-1">
            Manage vehicle checkouts
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search vehicle plate, visitor name, or Badge"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            {/* Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleFilterChange('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  typeFilter === 'all' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleFilterChange('staff')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  typeFilter === 'staff' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Staff
              </button>
              <button
                onClick={() => handleFilterChange('visitors')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  typeFilter === 'visitors' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Visitors
              </button>
              <button
                onClick={() => handleFilterChange('regular')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  typeFilter === 'regular' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Regular
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plate Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Visitor Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Badge Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check-in Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No records found
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, index) => (
                    <tr key={record._id || record.id || index} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900 uppercase">
                          {record.plate_number || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-gray-900">
                          {record.driver_name || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-gray-600">
                          {record.badge_number || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          record.driver_type === 'Staff' 
                            ? 'bg-blue-100 text-blue-800' 
                            : record.driver_type === 'Regular'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {record.driver_type || 'Visitor'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-600">
                        {formatDate(record.check_in)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${
                            record.is_over_limit ? 'text-red-600 font-medium' : 'text-gray-600'
                          }`}>
                            {formatDuration(record.current_duration)}
                          </span>
                          {record.is_over_limit && (
                            <FiClock className="w-4 h-4 text-red-500" title="Over time" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <button
                          onClick={() => openCheckoutModal(record)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <FiLogOut className="w-4 h-4" />
                          Checkout
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Results count */}
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing {filteredRecords.length} result{filteredRecords.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Checkout Modal */}
        {showCheckoutModal && selectedRecord && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <FiTruck className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Confirm Checkout</h3>
                  <p className="text-sm text-gray-500">{selectedRecord.plate_number}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Driver:</span>
                    <p className="font-medium">{selectedRecord.driver_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <p className="font-medium">{selectedRecord.driver_type}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Check-in:</span>
                    <p className="font-medium">{formatDate(selectedRecord.check_in)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Duration:</span>
                    <p className="font-medium">{selectedRecord.current_duration}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCheckoutModal(false);
                    setSelectedRecord(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {checkoutLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FiCheckCircle className="w-5 h-5" />
                  )}
                  Confirm Checkout
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
