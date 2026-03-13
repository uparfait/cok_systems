// ReportsPage - Smart Parking Reports
// Page for viewing parking reports and analytics

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { smartParkingService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { 
  FiTruck, FiAlertTriangle, FiClock, FiMapPin, FiDownload,
  FiCalendar, FiFilter, FiRefreshCw, FiFileText, FiUser
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
  checked_in_by?: string;
}

const ReportsPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ParkingRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [selectedRecord, setSelectedRecord] = useState<ParkingRecord | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    filterRecords();
  }, [records, statusFilter, dateFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await smartParkingService.getAll();
      if (response.success) {
        setRecords(response.data || []);
        showSuccess(response.message || 'Reports loaded successfully');
      } else {
        showError(response.message || 'Failed to load reports');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const filterRecords = () => {
    let filtered = [...records];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Date filter
    switch (dateFilter) {
      case 'today':
        filtered = filtered.filter(r => {
          const checkIn = r.check_in ? new Date(r.check_in) : null;
          return checkIn && checkIn >= today;
        });
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(r => {
          const checkIn = r.check_in ? new Date(r.check_in) : null;
          return checkIn && checkIn >= weekAgo;
        });
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filtered = filtered.filter(r => {
          const checkIn = r.check_in ? new Date(r.check_in) : null;
          return checkIn && checkIn >= monthAgo;
        });
        break;
      // 'all' - no date filter
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    setFilteredRecords(filtered);
  };

  // Calculate stats
  const totalRecords = filteredRecords.length;
  const completedRecords = filteredRecords.filter(r => r.status === 'completed').length;
  const activeRecords = filteredRecords.filter(r => r.status === 'active').length;
  const flaggedRecords = filteredRecords.filter(r => r.is_flagged).length;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const handleExport = () => {
    // Create CSV content
    const headers = ['Plate Number', 'Driver', 'Type', 'Status', 'Check In', 'Check Out', 'Duration', 'Flagged'];
    const rows = filteredRecords.map(r => [
      r.plate_number || '',
      r.driver_name || '',
      r.driver_type || '',
      r.status || '',
      r.check_in ? formatDate(r.check_in) : '',
      r.check_out ? formatDate(r.check_out) : '',
      r.duration || '',
      r.is_flagged ? 'Yes' : 'No'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `parking_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    showSuccess('Report exported successfully');
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <FiFileText className="w-8 h-8 text-blue-600" />
                Reports
              </h1>
              <p className="text-gray-500 mt-1">Parking reports and analytics</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium disabled:opacity-50"
              >
                <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                <FiDownload className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="flex items-center gap-2">
              <FiCalendar className="w-5 h-5 text-gray-400" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <FiFilter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Records</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{totalRecords}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FiFileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{activeRecords}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <FiTruck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{completedRecords}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <FiClock className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Flagged</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{flaggedRecords}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <FiAlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Parking Records</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vehicle</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Driver</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Slot</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Check In</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Check Out</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRecords.slice(0, 50).map((record, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FiTruck className="w-5 h-5 text-gray-400" />
                        <span className="font-medium text-gray-900">{record.plate_number || 'N/A'}</span>
                        {record.is_flagged && (
                          <FiAlertTriangle className="w-4 h-4 text-red-500" title="Flagged" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{record.driver_type || 'Visitor'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">{record.driver_name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{record.driver_telephone || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{record.slot_number || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <div className="text-gray-500 text-sm">{formatDate(record.check_in)}</div>
                      <div className="text-xs text-gray-400">{record.checked_in_by || 'System'}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {record.check_out ? formatDate(record.check_out) : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{record.duration || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                        record.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : record.status === 'completed'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {record.status === 'active' ? 'Active' : record.status === 'completed' ? 'Completed' : record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedRecord(record)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredRecords.length > 50 && (
            <div className="px-6 py-3 border-t border-gray-200 text-sm text-gray-500 text-center">
              Showing 50 of {filteredRecords.length} records. Export to see all.
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <RecordDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}
    </MainLayout>
  );
};

// Detail Modal Component
const RecordDetailModal: React.FC<{ record: ParkingRecord; onClose: () => void }> = ({ record, onClose }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Record Details</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">License Plate</p>
              <p className="font-semibold text-gray-900">{record.plate_number}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Driver Type</p>
              <p className="font-semibold text-gray-900">{record.driver_type || 'Visitor'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Driver Name</p>
              <p className="font-semibold text-gray-900">{record.driver_name || 'N/A'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Telephone</p>
              <p className="font-semibold text-gray-900">{record.driver_telephone || 'N/A'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Slot Number</p>
              <p className="font-semibold text-gray-900">{record.slot_number || 'N/A'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Status</p>
              <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                record.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {record.status === 'active' ? 'Active' : 'Completed'}
              </span>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Check In Time</p>
              <p className="font-semibold text-gray-900">{formatDate(record.check_in)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Check Out Time</p>
              <p className="font-semibold text-gray-900">{formatDate(record.check_out) || 'Not checked out'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Duration</p>
              <p className="font-semibold text-gray-900">{record.duration || 'N/A'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Checked In By</p>
              <p className="font-semibold text-gray-900">{record.checked_in_by || 'System'}</p>
            </div>
          </div>

          {record.is_flagged && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-700">
                <FiAlertTriangle className="w-5 h-5" />
                <span className="font-semibold">This vehicle is flagged</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
