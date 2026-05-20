import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiFilter, FiDownload, FiActivity, FiUsers, FiAlertTriangle, FiTrendingUp } from 'react-icons/fi';
import Table from '../../../core/components/Table';
import type { TableHeader, TablePagination } from '../../../core/components/Table';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import MainLayout from '../../../core/components/Layout/MainLayout';

interface AuditLog {
  _id: string;
  action: 'GET' | 'READ' | 'UPDATE' | 'DELETE' | 'ERROR';
  time: string;
  description: string;
  user_id?: string;
  user_name: string;
  user_email?: string;
  error?: string;
  status_code?: string;
  ip_address?: string;
  method?: string;
  endpoint?: string;
  error_message?: string;
}

interface AuditStats {
  total_logs: number;
  action_breakdown: Array<{ _id: string; count: number }>;
  top_users: Array<{ _id: string; count: number; user_name: string; user_email: string }>;
  recent_errors: AuditLog[];
}

const SystemAuditPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  // State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectederror, setSelectederror] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const pageSize = 20;

  // Available actions for filtering
  const actionOptions = [
    { value: '', label: 'All Actions' },
    { value: 'GET', label: 'GET' },
    { value: 'UPDATE', label: 'UPDATE' },
    { value: 'DELETE', label: 'DELETE' },
    { value: 'ERROR', label: 'ERROR' },
    { value: 'PUT', label: 'PUT' }
  ];

  // Get action color
  const getActionColor = (action: string) => {
    switch (action) {
      case 'UPDATE': return 'bg-blue-100 text-blue-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      case 'GET': return 'bg-gray-100 text-gray-800';
      case 'ERROR': return 'bg-red-200 text-red-900';
      case 'PUT': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async (page = 1, silent = false) => {
    if (!silent) setLoading(true);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(selectedAction && { action: selectedAction }),
        ...(selectederror && { error: selectederror }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate })
      });

      const response = await fetch(`/cok/api/audit/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.data || []);
        setCurrentPage(data.pagination?.current_page || 1);
        setTotalPages(data.pagination?.total_pages || 1);
        setTotalCount(data.pagination?.total || 0);
      } else {
        showError('Failed to fetch audit logs');
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      showError('Failed to fetch audit logs');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedAction, selectederror, startDate, endDate, showError]);

  // Fetch audit statistics
  const fetchAuditStats = useCallback(async () => {
    try {
      const response = await fetch('/cok/api/audit/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching audit stats:', error);
    }
  }, []);

  // Create test audit logs (for development)
  const createTestLogs = async () => {
    try {
      const response = await fetch('/cok/api/audit/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        showSuccess('Test audit logs created successfully');
        fetchAuditLogs(1, false);
        fetchAuditStats();
      } else {
        showError('Failed to create test logs');
      }
    } catch (error) {
      showError('Failed to create test logs');
    }
  };

  // Export audit logs to CSV
  const exportToCSV = () => {
    if (auditLogs.length === 0) {
      showError('No data to export');
      return;
    }

    const headers = ['Time', 'Action', 'User', 'Description', 'error', 'IP Address', 'Method', 'Endpoint'];
    const csvData = auditLogs.map(log => [
      new Date(log.time).toLocaleString(),
      log.action,
      log.user_name || 'System',
      log.description,
      log.error || '',
      log.ip_address || '',
      log.method || '',
      log.endpoint || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccess('Audit logs exported successfully');
  };

  // Initialize data
  useEffect(() => {
    fetchAuditLogs(1, false);
    fetchAuditStats();
  }, [fetchAuditLogs, fetchAuditStats]);

  // Handle search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchAuditLogs(1, false);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, fetchAuditLogs]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <FiActivity className="w-8 h-8 text-blue-600" />
              System Audit
            </h1>
            <p className="text-gray-500 mt-1">Monitor and track all system activities and user actions</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={createTestLogs}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
              title="Create test audit logs"
            >
              Create Test Logs
            </button>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <FiDownload className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Logs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_logs.toLocaleString()}</p>
                </div>
                <FiActivity className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Top Action</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.action_breakdown[0]?._id || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stats.action_breakdown[0]?.count || 0} times
                  </p>
                </div>
                <FiTrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.top_users.length}</p>
                  <p className="text-xs text-gray-500">Logged activities</p>
                </div>
                <FiUsers className="w-8 h-8 text-purple-600" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Recent Errors</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.recent_errors.length}</p>
                  <p className="text-xs text-gray-500">Last 30 days</p>
                </div>
                <FiAlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search audit logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <FiFilter className="w-4 h-4" />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {actionOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">error</label>
                <input
                  type="text"
                  placeholder="e.g., users, vehicles"
                  value={selectederror}
                  onChange={(e) => setSelectederror(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Audit Logs Table */}
        <Table
          headers={[
            { key: 'time', label: 'Time' },
            { key: 'action', label: 'Action' },
            { key: 'user', label: 'User' },
            { key: 'description', label: 'Description' },
            { key: 'error', label: 'error' },
            { key: 'details', label: 'Details' }
          ]}
          data={auditLogs}
          loading={loading}
          emptyMessage="No audit logs found matching your criteria."
          maxHeight="600px"
          minWidth="1000px"
          renderCell={(header, log, index) => {
            switch (header.key) {
              case 'time':
                return (
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {new Date(log.time).toLocaleDateString()}
                    </div>
                    <div className="text-gray-500">
                      {new Date(log.time).toLocaleTimeString()}
                    </div>
                  </div>
                );
              case 'action':
                return (
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionColor(log.action)}`}>
                    {log.action}
                  </span>
                );
              case 'user':
                return (
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {log.user_name}
                    </div>
                    {log.user_email && (
                      <div className="text-gray-500 text-xs">
                        {log.user_email}
                      </div>
                    )}
                  </div>
                );
              case 'description':
                return (
                  <div className="text-sm text-gray-900 max-w-xs">
                    {log.description}
                  </div>
                );
              case 'error':
                return (
                  <div className="text-sm">
                    {log.error && (
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                        {log.error}
                      </span>
                    )}
                    {log.status_code && (
                      <div className="text-xs text-gray-500 mt-1">
                        ID: {log.status_code}
                      </div>
                    )}
                  </div>
                );
              case 'details':
                return (
                  <div className="text-xs text-gray-600 space-y-1">
                    {log.method && log.endpoint && (
                      <div>{log.method} {log.endpoint}</div>
                    )}
                    {log.ip_address && (
                      <div>IP: {log.ip_address}</div>
                    )}
                    {log.error_message && (
                      <div className="text-red-600">Error: {log.error_message}</div>
                    )}
                  </div>
                );
              default:
                return <span>{log[header.key] || '-'}</span>;
            }
          }}
          pagination={{
            currentPage,
            totalPages,
            totalCount,
            itemsPerPage: pageSize,
            onPageChange: (page) => fetchAuditLogs(page, false),
            loading
          }}
        />
      </div>
    </MainLayout>
  );
};

export default SystemAuditPage;