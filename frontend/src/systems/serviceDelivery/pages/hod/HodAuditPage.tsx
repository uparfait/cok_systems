import React, { useCallback, useEffect, useState } from 'react';
import { FiDownload, FiRefreshCw } from 'react-icons/fi';
import { departmentManagerService } from '@/core/services/adminService';
import { useToast } from '@/core/contexts/ToastContext';
import {
  COK, FONT, formatDateTime,
  HodPageHeader, HodCard, HodStatCard, HodPagination, HodEmpty, HodTh, HodChip,
} from './hodShared';

interface AuditLog {
  _id: string;
  action: string;
  time?: string;
  description?: string;
  user_name?: string;
  user_email?: string;
  resource?: string;
  method?: string;
  endpoint?: string;
  status_code?: number;
}

interface AuditStats {
  period_days: number;
  total_logs: number;
  action_breakdown: { _id: string; count: number }[];
  resource_breakdown: { _id: string | null; count: number }[];
  top_users: { _id: string; user_name?: string; user_email?: string; count: number }[];
  recent_errors: AuditLog[];
}

const LIMIT = 20;

const ACTION_COLORS: Record<string, string> = {
  CREATE: COK.success,
  READ: COK.pending,
  UPDATE: COK.warning,
  DELETE: COK.danger,
  ERROR: COK.danger,
};

const HodAuditPage: React.FC = () => {
  const { showError } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', start_date: '', end_date: '' });
  const [applied, setApplied] = useState({ action: '', start_date: '', end_date: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        departmentManagerService.getAuditLogs(page, LIMIT, {
          action: applied.action || undefined,
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
    const header = ['Time', 'Action', 'User', 'Email', 'Resource', 'Description'];
    const rows = logs.map(l => [
      formatDateTime(l.time), l.action, l.user_name || '', l.user_email || '', l.resource || '',
      (l.description || '').replace(/"/g, '""'),
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
  const topAction = stats?.action_breakdown?.[0];
  const errorCount = stats?.action_breakdown?.find(a => a._id === 'ERROR')?.count || 0;

  return (
    <div className="p-4">
      <HodPageHeader
        title="Audit Trail & Compliance"
        subtitle="Activity recorded for your department members (last 30 days summary)"
        actions={
          <>
            <button className="cok-btn-outlined px-3 py-2 text-xs flex items-center gap-1" style={{ borderRadius: 0 }} onClick={load}>
              <FiRefreshCw /> Refresh
            </button>
            <button className="cok-btn-primary px-4 py-2 text-xs flex items-center gap-1" style={{ borderRadius: 0 }} onClick={exportCsv} disabled={logs.length === 0}>
              <FiDownload /> Export Report (CSV)
            </button>
          </>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <HodStatCard label="Total Activities" value={stats?.total_logs ?? '—'} hint={`last ${stats?.period_days || 30} days`} />
        <HodStatCard label="Top Action" value={topAction ? `${topAction._id}` : '—'} accent={COK.pending} hint={topAction ? `${topAction.count} times` : ''} />
        <HodStatCard label="Active Members" value={stats?.top_users?.length ?? '—'} accent={COK.success} />
        <HodStatCard label="Errors" value={errorCount} accent={errorCount > 0 ? COK.danger : COK.success} />
      </div>

      <HodCard className="mb-4">
        <div className="flex flex-wrap items-end gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase mb-1" style={{ color: COK.textMid, fontFamily: FONT }}>Action</p>
            <select className="cok-auth-input py-2 px-3 text-sm" value={filters.action}
              onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}>
              <option value="">All actions</option>
              {['CREATE', 'READ', 'UPDATE', 'DELETE', 'ERROR'].map(a => <option key={a} value={a}>{a}</option>)}
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
            onClick={() => { setFilters({ action: '', start_date: '', end_date: '' }); setApplied({ action: '', start_date: '', end_date: '' }); setPage(1); }}>
            Clear
          </button>
        </div>
      </HodCard>

      <HodCard>
        {loading ? (
          <HodEmpty message="Loading audit trail..." />
        ) : logs.length === 0 ? (
          <HodEmpty message="No audit records found for your department members yet. Records appear here as staff use the system." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr>
                  <HodTh>Time</HodTh>
                  <HodTh>Action</HodTh>
                  <HodTh>Member</HodTh>
                  <HodTh>Resource</HodTh>
                  <HodTh>Description</HodTh>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#F3F4F6' }}>
                {logs.map(log => (
                  <tr key={log._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: COK.gray }}>{formatDateTime(log.time)}</td>
                    <td className="px-3 py-2.5">
                      <HodChip label={log.action} color={ACTION_COLORS[log.action] || COK.primary} />
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-semibold" style={{ color: COK.textDark, fontFamily: FONT }}>{log.user_name || '—'}</p>
                      <p className="text-xs" style={{ color: COK.gray }}>{log.user_email || ''}</p>
                    </td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: COK.textMid }}>{log.resource || '—'}</td>
                    <td className="px-3 py-2.5 text-sm max-w-[320px] truncate" style={{ color: COK.textMid }} title={log.description}>{log.description || '—'}</td>
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
