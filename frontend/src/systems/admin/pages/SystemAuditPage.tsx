import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiFilter, FiDownload, FiActivity, FiUsers, FiAlertTriangle, FiTrendingUp } from 'react-icons/fi';
import Table from '../../../core/components/Table';
import type { TableHeader, TablePagination } from '../../../core/components/Table';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import MainLayout from '../../../core/components/Layout/MainLayout';

interface AuditLog { _id: string; action: 'GET' | 'READ' | 'UPDATE' | 'DELETE' | 'ERROR'; time: string; description: string; user_id?: string; user_name: string; user_email?: string; error?: string; status_code?: string; ip_address?: string; method?: string; endpoint?: string; error_message?: string; }
interface AuditStats { total_logs: number; action_breakdown: Array<{ _id: string; count: number }>; top_users: Array<{ _id: string; count: number; user_name: string; user_email: string }>; recent_errors: AuditLog[]; }

const SystemAuditPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
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

  const actionOptions = [{ value: '', label: 'All Actions' }, { value: 'GET', label: 'GET' }, { value: 'UPDATE', label: 'UPDATE' }, { value: 'DELETE', label: 'DELETE' }, { value: 'ERROR', label: 'ERROR' }, { value: 'PUT', label: 'PUT' }, { value: 'POST', label: 'POST' }];
  const getActionColor = (action: string) => { switch (action) { case 'UPDATE': return 'bg-blue-100 text-blue-800'; case 'DELETE': return 'bg-red-100 text-red-800'; case 'GET': return 'bg-gray-100 text-gray-800'; case 'ERROR': return 'bg-red-200 text-red-900'; case 'PUT': return 'bg-yellow-100 text-yellow-800'; default: return 'bg-gray-100 text-gray-800'; } };

  const fetchAuditLogs = useCallback(async (page = 1, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: pageSize.toString(), ...(selectedAction && { action: selectedAction }), ...(selectederror && { error: selectederror }), ...(startDate && { start_date: startDate }), ...(endDate && { end_date: endDate }) });
      const response = await fetch(`/cok/api/audit/logs?${params}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } });
      if (response.ok) { const data = await response.json(); setAuditLogs(data.data || []); setCurrentPage(data.pagination?.current_page || 1); setTotalPages(data.pagination?.total_pages || 1); setTotalCount(data.pagination?.total || 0); }
      else showError('Failed to fetch audit logs');
    } catch (error) { showError('Failed to fetch audit logs'); }
    finally { if (!silent) setLoading(false); }
  }, [selectedAction, selectederror, startDate, endDate, showError]);

  const fetchAuditStats = useCallback(async () => {
    try { const response = await fetch('/cok/api/audit/stats', { headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } }); if (response.ok) { const data = await response.json(); setStats(data.data); } }
    catch (error) { }
  }, []);

  const createTestLogs = async () => {
    try { const r = await fetch('/cok/api/audit/test', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } }); if (r.ok) { showSuccess('Test logs created'); fetchAuditLogs(1, false); fetchAuditStats(); } else showError('Failed'); }
    catch (error) { showError('Failed'); }
  };

  const exportToCSV = () => {
    if (auditLogs.length === 0) { showError('No data'); return; }
    const h = ['Time', 'Action', 'User', 'Description', 'error', 'IP Address', 'Method', 'Endpoint'];
    const rows = auditLogs.map(l => [new Date(l.time).toLocaleString(), l.action, l.user_name || 'System', l.description, l.error || '', l.ip_address || '', l.method || '', l.endpoint || '']);
    const csv = [h, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`; link.click();
    showSuccess('Exported');
  };

  useEffect(() => { fetchAuditLogs(1, false); fetchAuditStats(); }, [fetchAuditLogs, fetchAuditStats]);
  useEffect(() => { const t = setTimeout(() => fetchAuditLogs(1, false), 500); return () => clearTimeout(t); }, [searchTerm, fetchAuditLogs]);

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h1 className="text-base font-bold text-gray-900 flex items-center gap-2"><FiActivity className="w-5 h-5 text-blue-600" />System Audit</h1><p className="text-xs text-gray-500 mt-0.5">Monitor and track all system activities</p></div>
          <div className="flex gap-2">
            <button onClick={createTestLogs} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium">Create Test Logs</button>
            <button onClick={exportToCSV} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium flex items-center gap-1"><FiDownload className="w-3 h-3" />Export CSV</button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Logs', value: stats.total_logs.toLocaleString(), icon: FiActivity, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Top Action', value: stats.action_breakdown[0]?._id || 'N/A', sub: `${stats.action_breakdown[0]?.count || 0} times`, icon: FiTrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Active Users', value: stats.top_users.length, sub: 'Logged activities', icon: FiUsers, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Recent Errors', value: stats.recent_errors.length, sub: 'Last 30 days', icon: FiAlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs font-medium text-gray-600">{s.label}</p><p className="text-lg font-bold text-gray-900">{s.value}</p>{s.sub && <p className="text-xs text-gray-500">{s.sub}</p>}</div>
                  <div className={`w-10 h-10 ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white border border-gray-200 p-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative"><FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search audit logs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 border border-gray-300 text-sm" /></div>
            <button onClick={() => setShowFilters(!showFilters)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium flex items-center gap-1"><FiFilter className="w-3 h-3" />Filters</button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-200">
              <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">Action</label><select value={selectedAction} onChange={e => setSelectedAction(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 text-sm">{actionOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">Error</label><input type="text" placeholder="e.g., users" value={selectederror} onChange={e => setSelectederror(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">Start Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">End Date</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 text-sm" /></div>
            </div>
          )}
        </div>

        <Table headers={[{ key: 'time', label: 'Time' }, { key: 'action', label: 'Action' }, { key: 'user', label: 'User' }, { key: 'description', label: 'Description' }, { key: 'error', label: 'error' }, { key: 'details', label: 'Details' }]} data={auditLogs} loading={loading} emptyMessage="No audit logs found." maxHeight="600px" minWidth="1000px"
          renderCell={(header, log: any) => {
            switch (header.key) {
              case 'time': return <div className="text-xs"><div className="font-medium text-gray-900">{new Date(log.time).toLocaleDateString()}</div><div className="text-gray-500">{new Date(log.time).toLocaleTimeString()}</div></div>;
              case 'action': return <span className={`text-xs px-2 py-0.5 font-semibold ${getActionColor(log.action)}`}>{log.action}</span>;
              case 'user': return <div className="text-xs"><div className="font-medium text-gray-900">{log.user_name}</div>{log.user_email && <div className="text-gray-500 text-xs">{log.user_email}</div>}</div>;
              case 'description': return <div className="text-xs text-gray-900 max-w-xs">{log.description}</div>;
              case 'error': return <div className="text-xs">{log.error && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-800">{log.error}</span>}{log.status_code && <div className="text-xs text-gray-500 mt-0.5">ID: {log.status_code}</div>}</div>;
              case 'details': return <div className="text-xs text-gray-600 space-y-0.5">{log.method && log.endpoint && <div>{log.method} {log.endpoint}</div>}{log.ip_address && <div>IP: {log.ip_address}</div>}{log.error_message && <div className="text-red-600">Error: {log.error_message}</div>}</div>;
              default: return <span className="text-xs">{log[header.key] || '-'}</span>;
            }
          }}
          pagination={{ currentPage, totalPages, totalCount, itemsPerPage: pageSize, onPageChange: (page) => fetchAuditLogs(page, false), loading }}
        />
      </div>
    </MainLayout>
  );
};

export default SystemAuditPage;