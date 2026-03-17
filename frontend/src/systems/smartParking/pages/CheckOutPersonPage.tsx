// CheckOutPersonPage - Smart Parking Person Checkout (Without Vehicle)
// Page for checking out visitors without vehicles

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { 
  FiSearch, FiUser, FiCheckCircle, FiLogOut, FiClock
} from 'react-icons/fi';

interface VisitorRecord {
  _id?: string;
  full_name: string;
  telephone: string;
  badge_number?: string;
  identification?: {
    id_type?: string;
    number?: string;
  };
  visitor_type?: string;
  entry_date?: string;
  exist_date?: string | null;
  is_still_inhouse?: boolean;
  current_duration?: string;
  is_over_limit?: boolean;
  current_duration_hours?: number;
}

const CheckOutPersonPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'staff' | 'visitors' | 'regular'>('all');
  const [allRecords, setAllRecords] = useState<VisitorRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<VisitorRecord[]>([]);
  
  // Modal state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<VisitorRecord | null>(null);
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
      const response = await serviceDeliveryService.getAll(1, 100);
      
      if (response.success && response.data) {
        // Only get visitors that are still in-house (without vehicles - marked by is_still_inhouse)
        const inHouseVisitors = (response.data as VisitorRecord[]).filter(
          (record: VisitorRecord) => record.is_still_inhouse
        );
        setAllRecords(inHouseVisitors);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      showError('Failed to load visitor records');
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
        record.full_name?.toLowerCase().includes(query) ||
        record.telephone?.toLowerCase().includes(query) ||
        record.badge_number?.toLowerCase().includes(query)
      );
    }
    
    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(record => {
        const recordType = record.visitor_type?.toLowerCase() || 'visitor';
        if (typeFilter === 'staff') {
          return recordType === 'staff';
        } else if (typeFilter === 'visitors') {
          return recordType === 'visitor';
        } else if (typeFilter === 'regular') {
          return recordType === 'regular';
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
      const response = await serviceDeliveryService.checkOut(selectedRecord._id as string);
      
      if (response.success) {
        showSuccess('Visitor checked out successfully!');
        setShowCheckoutModal(false);
        setSelectedRecord(null);
        loadData();
      } else {
        showError(response.message || 'Failed to checkout visitor');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      showError(error.message || 'Failed to checkout visitor');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const openCheckoutModal = (record: VisitorRecord) => {
    setSelectedRecord(record);
    setShowCheckoutModal(true);
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

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FiUser className="w-8 h-8 text-blue-600" />
            Person Check-out
          </h1>
          <p className="text-gray-600 mt-1">
            Manage visitor checkouts (without vehicles)
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
                  placeholder="Search visitor name, phone, or Badge"
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
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No records found
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, index) => (
                    <tr key={record._id || index} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-gray-900">
                          {record.full_name || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-gray-600">
                          {record.badge_number || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          record.visitor_type === 'Staff' 
                            ? 'bg-blue-100 text-blue-800' 
                            : record.visitor_type === 'Regular'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {record.visitor_type || 'Visitor'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-600">
                        {formatDate(record.entry_date)}
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
                  <FiUser className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Confirm Checkout</h3>
                  <p className="text-sm text-gray-500">{selectedRecord.full_name}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Phone:</span>
                    <p className="font-medium">{selectedRecord.telephone}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <p className="font-medium">{selectedRecord.visitor_type || 'Visitor'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Check-in:</span>
                    <p className="font-medium">{formatDate(selectedRecord.entry_date)}</p>
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

export default CheckOutPersonPage;
