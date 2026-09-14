import React, { useState, useEffect, useCallback } from 'react';
import Table from '../../../core/components/Table';
import { useToast } from '../../../core/contexts/ToastContext';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { get, del } from '../../../core/services/apiClient';

const PRIMARY = '#056daa';
const DANGER = '#E74C3C';
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';
const PAGE_SIZE = 20;
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

interface AuditLog {
  _id: string;
  time: string;
  status: number;
  method?: string;
  user_email?: string;
  user_name?: string;
  description?: string;
  message?: string;
  error?: string;
  endpoint?: string;
  ip_address?: string;
  source?: string;
}

interface StatusCount { status: number; count: number; }

interface AuditStats {
  period_days: number;
  total_logs: number;
  status_breakdown: StatusCount[];
  top_users: Array<{ user_email: string; user_name?: string; count: number }>;
  recent_server_errors: AuditLog[];
}

interface Filters { search: string; status: string; method: string; start_date: string; end_date: string; }

const EMPTY_FILTERS: Filters = { search: '', status: '', method: '', start_date: '', end_date: '' };

const statusTone = (status: number) => {
  if (status >= 500) return { bg: 'rgba(231,76,60,0.12)', color: DANGER };
  if (status === 401 || status === 403) return { bg: 'rgba(243,156,18,0.14)', color: '#B9770E' };
  if (status >= 400) return { bg: 'rgba(5,109,170,0.1)', color: PRIMARY };
  return { bg: 'rgba(51,51,51,0.08)', color: '#555555' };
};

const buildQuery = (filters: Filters, page: number) => {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.status) params.set('status', filters.status);
  if (filters.method) params.set('method', filters.method);
  if (filters.start_date) params.set('start_date', filters.start_date);
  if (filters.end_date) params.set('end_date', filters.end_date);
  return params.toString();
};

const SystemAuditPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [statuses, setStatuses] = useState<StatusCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [legacyCount, setLegacyCount] = useState(0);
  const [showLegacyConfirm, setShowLegacyConfirm] = useState(false);
  const [clearingLegacy, setClearingLegacy] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchAuditLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await get(`/audit/logs?${buildQuery(applied, page)}`);
      setAuditLogs(data.data || []);
      setCurrentPage(data.pagination?.current_page || 1);
      setTotalPages(data.pagination?.total_pages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch (error: any) {
      showError(error?.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  }, [applied, showError]);

  const fetchSummary = useCallback(async () => {
    try {
      const [statsRes, statusRes, legacyRes] = await Promise.all([get('/audit/stats'), get('/audit/statuses'), get('/audit/legacy')]);
      setStats(statsRes.data || null);
      setStatuses(statusRes.data || []);
      setLegacyCount(legacyRes.data?.legacy_count || 0);
    } catch (error: any) {
      showError(error?.message || 'Failed to load audit summary');
    }
  }, [showError]);

  useEffect(() => { fetchAuditLogs(1); }, [fetchAuditLogs]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const applyFilters = () => { setApplied({ ...filters }); };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); };

  const handleClearLegacy = async () => {
    setClearingLegacy(true);
    try {
      const res = await del('/audit/legacy');
      showSuccess(res.message || 'Old-format audit records removed');
      setShowLegacyConfirm(false);
      await Promise.all([fetchSummary(), fetchAuditLogs(1)]);
    } catch (error: any) {
      showError(error?.message || 'Failed to clear old-format audit records');
    } finally {
      setClearingLegacy(false);
    }
  };

  const handleExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportFrom || !exportTo) { showError('Please select both the From and To dates'); return; }
    if (exportTo < exportFrom) { showError('The To date must be after the From date'); return; }
    setExporting(true);
    try {
      const params = new URLSearchParams({ start_date: exportFrom, end_date: exportTo });
      if (applied.status) params.set('status', applied.status);
      if (applied.method) params.set('method', applied.method);
      if (applied.search.trim()) params.set('search', applied.search.trim());
      const response = await fetch(`/cok/api/audit/export?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });
      if (!response.ok) {
        let msg = 'Failed to export audit logs';
        try { const data = await response.json(); if (data?.message) msg = data.message; } catch { msg = 'Failed to export audit logs'; }
        showError(msg);
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_logs_${exportFrom}_to_${exportTo}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showSuccess('Audit logs exported');
      setShowExportModal(false);
    } catch {
      showError('Failed to export audit logs');
    } finally {
      setExporting(false);
    }
  };

  const topStatus = stats?.status_breakdown?.[0];
  const serverErrors = (stats?.status_breakdown || []).filter((row) => row.status >= 500).reduce((sum, row) => sum + row.count, 0);
  const forbidden = (stats?.status_breakdown || []).filter((row) => row.status === 401 || row.status === 403).reduce((sum, row) => sum + row.count, 0);

  const inputStyle = { paddingLeft: '10px', minHeight: '34px' } as React.CSSProperties;
  const labelClass = 'text-xs font-medium text-gray-700 mb-0.5 block';

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-base font-bold" style={{ color: '#333333', fontFamily: fontHeading }}>System Audit</h1>
            <p className="text-xs mt-0.5" style={{ color: '#9E9E9E', fontFamily: fontHeading }}>Every response the systems refused or failed to serve, across all backends</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowExportModal(true)} className="px-3 py-1.5 bg-[#4CAF50] hover:bg-[#388E3C] text-white text-xs font-medium uppercase cursor-pointer" style={{ letterSpacing: '1px' }}>Export CSV</button>
          </div>
        </div>

        {legacyCount > 0 && (
          <div className="bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ boxShadow: CARD_SHADOW, borderLeft: `4px solid ${DANGER}` }}>
            <div>
              <p className="text-sm font-bold" style={{ color: DANGER, fontFamily: fontHeading }}>Old audit structure detected</p>
              <p className="text-xs mt-0.5" style={{ color: '#555555', fontFamily: fontHeading }}>{legacyCount.toLocaleString()} records were stored by the previous audit design and no longer match this page. Clearing them is permanent.</p>
            </div>
            <button onClick={() => setShowLegacyConfirm(true)} className="px-3 py-1.5 text-white text-xs font-medium uppercase cursor-pointer" style={{ backgroundColor: DANGER, letterSpacing: '1px' }}>Clear {legacyCount.toLocaleString()} old records</button>
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: `Audits (last ${stats.period_days} days)`, value: stats.total_logs.toLocaleString(), sub: `${totalCount.toLocaleString()} matching current filters`, color: PRIMARY },
              { label: 'Most frequent status', value: topStatus ? String(topStatus.status) : 'N/A', sub: topStatus ? `${topStatus.count.toLocaleString()} times` : '', color: '#388E3C' },
              { label: 'Denied requests (401 / 403)', value: forbidden.toLocaleString(), sub: 'Login or role refused', color: '#B9770E' },
              { label: 'Server errors (5xx)', value: serverErrors.toLocaleString(), sub: `${stats.top_users.length} users involved`, color: DANGER },
            ].map((card) => (
              <div key={card.label} className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
                <p className="text-xs font-medium" style={{ color: card.color, fontFamily: fontHeading }}>{card.label}</p>
                <p className="text-lg font-bold" style={{ color: card.color, fontFamily: fontHeading }}>{card.value}</p>
                {card.sub && <p className="text-xs" style={{ color: '#555555' }}>{card.sub}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="bg-white p-3" style={{ boxShadow: CARD_SHADOW }}>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-2">
              <label className={labelClass}>Search</label>
              <input type="text" placeholder="Email, endpoint, message, error, IP" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }} className="cok-auth-input w-full text-sm" style={inputStyle} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="cok-auth-input w-full text-sm" style={inputStyle}>
                <option value="">All statuses</option>
                {statuses.map((row) => <option key={row.status} value={String(row.status)}>{row.status} ({row.count.toLocaleString()})</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Method</label>
              <select value={filters.method} onChange={(e) => setFilters((f) => ({ ...f, method: e.target.value }))} className="cok-auth-input w-full text-sm" style={inputStyle}>
                <option value="">All methods</option>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>From</label>
              <input type="date" value={filters.start_date} onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))} className="cok-auth-input w-full text-sm" style={inputStyle} />
            </div>
            <div>
              <label className={labelClass}>To</label>
              <input type="date" value={filters.end_date} onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))} className="cok-auth-input w-full text-sm" style={inputStyle} />
            </div>
          </div>
          <div className="flex gap-2 mt-3 pt-3 border-t border-[#E0E0E0]">
            <button onClick={applyFilters} className="cok-btn-primary px-4 py-1.5 text-xs cursor-pointer" style={{ width: 'auto' }}>Apply filters</button>
            <button onClick={clearFilters} className="cok-btn-outlined px-4 py-1.5 text-xs cursor-pointer" style={{ width: 'auto' }}>Clear</button>
          </div>
        </div>

        <Table
          headers={[
            { key: 'time', label: 'Time' },
            { key: 'status', label: 'Status' },
            { key: 'method', label: 'Method' },
            { key: 'user_email', label: 'User' },
            { key: 'description', label: 'Description' },
            { key: 'message', label: 'Message sent' },
            { key: 'error', label: 'Actual error' },
            { key: 'endpoint', label: 'Endpoint' },
            { key: 'ip_address', label: 'IP address' },
          ]}
          data={auditLogs}
          loading={loading}
          emptyMessage="No audit records match these filters."
          maxHeight="600px"
          minWidth="1300px"
          headerStyle={{ backgroundColor: PRIMARY }}
          onRowClick={(row) => setSelectedLog(row)}
          renderCell={(header, log: AuditLog) => {
            switch (header.key) {
              case 'time': return <div className="text-xs"><div className="font-medium text-gray-900">{new Date(log.time).toLocaleDateString()}</div><div className="text-gray-500">{new Date(log.time).toLocaleTimeString()}</div></div>;
              case 'status': { const tone = statusTone(log.status); return <span className="text-xs px-2 py-0.5 font-semibold" style={{ backgroundColor: tone.bg, color: tone.color }}>{log.status}</span>; }
              case 'method': return <span className="text-xs font-semibold text-gray-700">{log.method || '-'}</span>;
              case 'user_email': return <div className="text-xs"><div className="font-medium text-gray-900">{log.user_email || 'Anonymous'}</div>{log.user_name && <div className="text-gray-500">{log.user_name}</div>}</div>;
              case 'description': return <div className="text-xs text-gray-900 max-w-xs truncate" title={log.description || ''}>{log.description || '-'}</div>;
              case 'message': return <div className="text-xs text-gray-700 max-w-xs truncate" title={log.message || ''}>{log.message || '-'}</div>;
              case 'error': return <div className="text-xs max-w-xs truncate" style={{ color: log.error ? DANGER : '#9E9E9E' }} title={log.error || ''}>{log.error || '-'}</div>;
              case 'endpoint': return <div className="text-xs text-gray-700 max-w-xs truncate" title={log.endpoint || ''}>{log.endpoint || '-'}{log.source && <span className="ml-1 text-gray-400">[{log.source}]</span>}</div>;
              case 'ip_address': return <span className="text-xs text-gray-700">{log.ip_address || '-'}</span>;
              default: return <span className="text-xs">-</span>;
            }
          }}
          pagination={{ currentPage, totalPages, totalCount, itemsPerPage: PAGE_SIZE, onPageChange: (page) => fetchAuditLogs(page), loading }}
        />

        {selectedLog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedLog(null)}>
            <div className="bg-white w-full max-w-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900" style={{ fontFamily: fontHeading }}>Audit record</h2>
                <button type="button" onClick={() => setSelectedLog(null)} className="text-xs font-semibold cursor-pointer" style={{ color: PRIMARY }}>Close</button>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  ['Time', new Date(selectedLog.time).toLocaleString()],
                  ['Status', String(selectedLog.status)],
                  ['Method', selectedLog.method || '-'],
                  ['User email', selectedLog.user_email || 'Anonymous'],
                  ['IP address', selectedLog.ip_address || '-'],
                  ['Source', selectedLog.source || '-'],
                  ['Endpoint', selectedLog.endpoint || '-'],
                  ['Description', selectedLog.description || '-'],
                  ['Message sent to user', selectedLog.message || '-'],
                  ['Actual error', selectedLog.error || '-'],
                ].map(([label, value]) => (
                  <div key={label} className={label === 'Endpoint' || label === 'Description' || label === 'Message sent to user' || label === 'Actual error' ? 'sm:col-span-2' : ''}>
                    <p className="font-semibold text-gray-500 uppercase" style={{ fontFamily: fontHeading, letterSpacing: '0.5px' }}>{label}</p>
                    <p className="text-gray-900 break-words whitespace-pre-wrap">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showLegacyConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-sm shadow-2xl" style={{ borderTop: `4px solid ${DANGER}` }}>
              <div className="p-4 border-b bg-gray-50">
                <h2 className="text-sm font-bold text-gray-900" style={{ fontFamily: fontHeading }}>Clear old-format audit records</h2>
                <p className="text-xs text-gray-500 mt-1">{legacyCount.toLocaleString()} records stored by the previous audit design will be deleted permanently. Records in the new format are kept.</p>
              </div>
              <div className="p-4 flex gap-3">
                <button type="button" onClick={handleClearLegacy} disabled={clearingLegacy} className="flex-1 px-3 py-2 text-white text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: DANGER }}>{clearingLegacy ? 'Clearing...' : 'Yes, clear them'}</button>
                <button type="button" onClick={() => setShowLegacyConfirm(false)} disabled={clearingLegacy} className="flex-1 px-3 py-2 cok-btn-outlined text-sm font-medium cursor-pointer">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-sm shadow-2xl">
              <div className="p-4 border-b bg-gray-50">
                <h2 className="text-sm font-bold text-gray-900" style={{ fontFamily: fontHeading }}>Export Audit Logs</h2>
                <p className="text-xs text-gray-500">Choose the date range to export as CSV. The current status, method and search filters are applied too.</p>
              </div>
              <form onSubmit={handleExportSubmit} className="p-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">From <span className="text-red-500">*</span></label>
                  <input type="date" required value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="cok-auth-input w-full text-sm" style={{ paddingLeft: '10px', minHeight: '36px' }} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">To <span className="text-red-500">*</span></label>
                  <input type="date" required value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="cok-auth-input w-full text-sm" style={{ paddingLeft: '10px', minHeight: '36px' }} />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={exporting} className="flex-1 px-3 py-2 cok-btn-primary text-white text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{exporting ? 'Exporting...' : 'Export'}</button>
                  <button type="button" onClick={() => setShowExportModal(false)} disabled={exporting} className="flex-1 px-3 py-2 cok-btn-outlined text-sm font-medium cursor-pointer">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default SystemAuditPage;
