// MonitorPage - Smart Parking Monitoring
// Real-time monitoring of parking status and flagged vehicles

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { smartParkingService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { 
  FiTruck, FiAlertTriangle, FiClock, FiSearch, FiRefreshCw
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
}

type TabType = 'all' | 'active' | 'completed' | 'flagged';

const MonitorPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ParkingRecord[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(false);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterRecords();
  }, [records, activeTab, searchQuery]);

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await smartParkingService.getAll();
      if (response.success) {
        setRecords(response.data || []);
      } else {
        showError(response.message || 'Failed to load data');
      }
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
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.plate_number?.toLowerCase().includes(query) ||
        r.driver_name?.toLowerCase().includes(query)
      );
    }
    
    setFilteredRecords(filtered);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Calculate stats
  const totalVehicles = records.length;
  const activeCount = records.filter(r => r.status === 'active').length;
  const completedCount = records.filter(r => r.status === 'completed').length;
  const flaggedCount = records.filter(r => r.is_flagged).length;

  // Calculate total duration
  const totalDuration = records.reduce((acc, r) => {
    if (r.check_in && r.check_out) {
      const diff = new Date(r.check_out).getTime() - new Date(r.check_in).getTime();
      return acc + diff;
    }
    return acc;
  }, 0);
  const totalHours = Math.round(totalDuration / (1000 * 60 * 60));

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900">Monitor</h1>
          <p className="text-gray-500 mt-1">PARKING RECORDS</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Vehicles</p>
                <p className="text-2xl font-bold text-gray-900">{totalVehicles}</p>
              </div>
              <FiTruck className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Duration</p>
                <p className="text-2xl font-bold text-gray-900">{totalHours}h</p>
              </div>
              <FiClock className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              </div>
              <FiTruck className="w-8 h-8 text-green-400" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Flagged</p>
                <p className="text-2xl font-bold text-red-600">{flaggedCount}</p>
              </div>
              <FiAlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>

        {/* Tabs and Search */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            {/* Tabs */}
            <div className="flex gap-2">
              {(['all', 'active', 'completed', 'flagged'] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-xl font-medium transition-colors capitalize ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            {/* Search */}
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">License Plate</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Owner Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Check-in Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRecords.slice(0, 20).map((record, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FiTruck className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{record.plate_number || 'N/A'}</span>
                        {record.is_flagged && (
                          <FiAlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{record.driver_name || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(record.check_in)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                        record.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {record.status === 'active' ? 'Active' : record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate('/smart-parking/checkout')}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default MonitorPage;
