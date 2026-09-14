import React, { useCallback, useEffect, useState } from 'react';
import { departmentManagerService } from '@/core/services/adminService';
import { useToast } from '@/core/contexts/ToastContext';
import {
  COK, FONT, formatDateTime,
  HodPageHeader, HodCard, HodStatCard, HodPagination, HodEmpty, HodTh, HodChip,
} from './hodShared';

interface AuditLog {
  _id: string;
  time?: string;
  status: number;
  method?: string;
  description?: string;
  message?: string;
  error?: string;
  user_name?: string;
  user_email?: string;
  endpoint?: string;
  ip_address?: string;
}

interface AuditStats {
  period_days: number;
  total_logs: number;
  status_breakdown: { status: number; count: number }[];
  top_users: { _id: string; user_name?: string; user_email?: string; count: number }[];
  recent_errors: AuditLog[];
}

const LIMIT = 5;
const EMPTY = { status: '', start_date: '', end_date: '' };

const statusColor = (status: number) => {
  if (status >= 500) return COK.danger;
  if (status === 401 || status === 403) return COK.warning;
  if (status >= 400) return COK.pending;
  return COK.primary;
};

const HodAuditPage: React.FC = () => {
  const { showError } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        departmentManagerService.getAuditLogs(page, LIMIT, {
          status: applied.status || undefined,
          start_date: applied.start_date || undefined,
          end_date: applied.end_date || undefined,
        }),
        departmentManagerService.getAuditStats(30),
      ]);
      if (logsRes?.success) {
        setLogs(logsRes.data || []);
        setTotal(logsRes.total || 0);
      } else {
        showError(logsRes?.message || 'Failed to load audit logs');
      }
      if (statsRes?.success) setStats(statsRes.data);
    } catch {
      showError('Failed to load audit data');
    } finally {
      setLoading(false);
    }
  }, [page, applied, showError]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const header = ['Time', 'Status', 'Method', 'User', 'Email', 'Endpoint', 'Description', 'Message', 'Error', 'IP Address'];
    const rows = logs.map(l => [
      formatDateTime(l.time), String(l.status), l.method || '', l.user_name || '', l.user_email || '', l.endpoint || '',
      (l.description || '').replace(/"/g, '""'), (l.message || '').replace(/"/g, '""'), (l.error || '').replace(/"/g, '""'), l.ip_address || '',
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `department-compliance-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(Math.ceil(total / LIMIT), 1);
  const topStatus = stats?.status_breakdown?.[0];
  const errorCount = (stats?.status_breakdown || []).filter(s => s.status >= 500).reduce((sum, s) => sum + s.count, 0);
  const statusOptions = (stats?.status_breakdown || []).map(s => s.status).sort((a, b) => a - b);

  return (
    <div className="p-4">
      <HodPageHeader
        title="Audit Trail & Compliance"
        subtitle="Refused or failed requests recorded for your department members (last 30 days summary)"
        actions={
          <>
            <button className="cok-btn-outlined px-3 py-2 text-xs" style={{ borderRadius: 0 }} onClick={load}>
              Refresh
            </button>
            <button className="cok-btn-primary px-4 py-2 text-xs" style={{ borderRadius: 0 }} onClick={exportCsv} disabled={logs.length === 0}>
              Export Report (CSV)
            </button>
          </>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <HodStatCard label="Total Records" value={stats?.total_logs ?? '-'} hint={`last ${stats?.period_days || 30} days`} />
        <HodStatCard label="Most Frequent Status" value={topStatus ? `${topStatus.status}` : '-'} accent={COK.pending} hint={topStatus ? `${topStatus.count} times` : ''} />
        <HodStatCard label="Members Involved" value={stats?.top_users?.length ?? '-'} accent={COK.success} />
        <HodStatCard label="Server Errors" value={errorCount} accent={errorCount > 0 ? COK.danger : COK.success} />
      </div>

      <HodCard className="mb-4">
        <div className="flex flex-wrap items-end gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase mb-1" style={{ color: COK.textMid, fontFamily: FONT }}>Status</p>
            <select className="cok-auth-input py-2 px-3 text-sm" value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              {statusOptions.map(s => <option key={s} value={String(s)}>{s}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase mb-1" style={{ color: COK.textMid, fontFamily: FONT }}>From</p>
            <input type="date" className="cok-auth-input py-2 px-3 text-sm" value={filters.start_date}
              onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase mb-1" style={{ color: COK.textMid, fontFamily: FONT }}>To</p>
            <input type="date" className="cok-auth-input py-2 px-3 text-sm" value={filters.end_date}
              onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} />
          </div>
          <button className="cok-btn-primary px-4 py-2 text-xs" style={{ borderRadius: 0 }}
            onClick={() => { setPage(1); setApplied({ ...filters }); }}>
            Apply
          </button>
          <button className="cok-btn-outlined px-3 py-2 text-xs" style={{ borderRadius: 0 }}
            onClick={() => { setFilters(EMPTY); setApplied(EMPTY); setPage(1); }}>
            Clear
          </button>
        </div>
      </HodCard>

      <HodCard>
        {loading ? (
          <HodEmpty message="Loading audit trail..." />
        ) : logs.length === 0 ? (
          <HodEmpty message="No audit records found for your department members yet. Records appear here when a request by a member is refused or fails." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr>
                  <HodTh>Time</HodTh>
                  <HodTh>Status</HodTh>
                  <HodTh>Member</HodTh>
                  <HodTh>Endpoint</HodTh>
                  <HodTh>Message</HodTh>
                  <HodTh>IP</HodTh>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#F3F4F6' }}>
                {logs.map(log => (
                  <tr key={log._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: COK.gray }}>{formatDateTime(log.time)}</td>
                    <td className="px-3 py-2.5">
                      <HodChip label={String(log.status)} color={statusColor(log.status)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-semibold" style={{ color: COK.textDark, fontFamily: FONT }}>{log.user_name || log.user_email || '-'}</p>
                      <p className="text-xs" style={{ color: COK.gray }}>{log.user_email || ''}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs max-w-[260px] truncate" style={{ color: COK.textMid }} title={log.endpoint}>{log.method} {log.endpoint || '-'}</td>
                    <td className="px-3 py-2.5 text-sm max-w-[320px] truncate" style={{ color: COK.textMid }} title={log.error || log.message || log.description}>{log.message || log.description || '-'}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: COK.gray }}>{log.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <HodPagination page={page} totalPages={totalPages} onPage={setPage} />
      </HodCard>
    </div>
  );
};

export default HodAuditPage;
