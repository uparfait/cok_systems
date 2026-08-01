import React, { useCallback, useEffect, useState } from 'react';
import { FiRefreshCw, FiCheck, FiX as FiReject } from 'react-icons/fi';
import { useAuth } from '@/core/contexts/AuthContext';
import { useToast } from '@/core/contexts/ToastContext';
import {
  COK, FONT, formatDate, formatDateTime,
  HodPageHeader, HodCard, HodTabBar, HodModal, HodEmpty, HodTh, HodAvatar, HodChip,
} from './hodShared';

// Event actions live in the event-management backend (separate service, /cok/api/v1)
const EM_BASE = '/cok/api/v1';

interface EventAction {
  _id: string;
  title: string;
  actionDescription?: string;
  assignedPerson?: { name?: string; email?: string; role?: string; institution?: string };
  dueDate?: string;
  currentStatus?: { status: string; description?: string };
  statusHistory?: { status: string; description?: string; changedAt?: string }[];
  eventSpecialId?: string;
  createdBy?: { name?: string; email?: string };
  createdAt?: string;
}

const STATUS_COLORS: Record<string, string> = {
  'Pending': COK.pending,
  'In Progress': COK.warning,
  'Completed': COK.success,
  'Cancelled': COK.gray,
};

const LIMIT = 10;

const HodApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [actions, setActions] = useState<EventAction[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('Pending');
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [decision, setDecision] = useState<{ action: EventAction; approve: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const myEmail = (user?.email || '').toLowerCase();

  const load = useCallback(async () => {
    if (!myEmail) return;
    setLoading(true);
    setUnavailable(false);
    try {
      const statusParam = tab === 'all' ? '' : `&status=${encodeURIComponent(tab)}`;
      // Only approval requests addressed to this head of department
      const resp = await fetch(
        `${EM_BASE}/event-actions?page=${page}&limit=${LIMIT}&assignedEmail=${encodeURIComponent(myEmail)}${statusParam}`
      );
      if (!resp.ok) throw new Error('bad status');
      const json = await resp.json();
      if (json?.success) {
        // Safety net in case the event service is an older build that ignores assignedEmail
        const mine = (json.data || []).filter(
          (a: EventAction) => (a.assignedPerson?.email || '').toLowerCase() === myEmail
        );
        setActions(mine);
        setTotalPages(json.totalPages || 1);
      } else {
        setActions([]);
      }
    } catch {
      setUnavailable(true);
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, [page, tab, myEmail]);

  useEffect(() => { load(); }, [load]);

  const submitDecision = async () => {
    if (!decision) return;
    const { action, approve } = decision;
    if (!approve && !reason.trim()) { showError('Please provide a reason for rejection'); return; }
    setSaving(true);
    try {
      const resp = await fetch(`${EM_BASE}/event-actions/${action._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStatus: {
            status: approve ? 'In Progress' : 'Cancelled',
            description: approve
              ? (reason.trim() || 'Approved by head of department')
              : `Rejected by head of department: ${reason.trim()}`,
          },
        }),
      });
      const json = await resp.json();
      if (json?.success) {
        showSuccess(approve ? 'Request approved' : 'Request rejected');
        setDecision(null);
        setReason('');
        load();
      } else {
        showError(json?.message || 'Failed to update the request');
      }
    } catch {
      showError('Failed to update the request');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { key: 'Pending', label: 'Pending Approval', color: COK.pending },
    { key: 'In Progress', label: 'Approved / In Progress', color: COK.warning },
    { key: 'Completed', label: 'Completed', color: COK.success },
    { key: 'Cancelled', label: 'Rejected', color: COK.gray },
    { key: 'all', label: 'All', color: COK.primary },
  ];

  return (
    <div className="p-4">
      <HodPageHeader
        title="Approvals"
        subtitle="Approval requests addressed to you — only items where you are the destination appear here"
        actions={
          <button className="cok-btn-outlined px-3 py-2 text-xs flex items-center gap-1" style={{ borderRadius: 0 }} onClick={load}>
            <FiRefreshCw /> Refresh
          </button>
        }
      />

      <HodCard>
        <HodTabBar tabs={tabs} active={tab} onChange={key => { setTab(key); setPage(1); }} />

        {loading ? (
          <HodEmpty message="Loading approval requests..." />
        ) : unavailable ? (
          <HodEmpty message="The event management service is not reachable right now. Start it and press Refresh." />
        ) : actions.length === 0 ? (
          <HodEmpty message="No approval requests addressed to you in this status." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr>
                  <HodTh>Request</HodTh>
                  <HodTh>Submitted By</HodTh>
                  <HodTh>Due Date</HodTh>
                  <HodTh>Status</HodTh>
                  <HodTh>Decision</HodTh>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#F3F4F6' }}>
                {actions.map(action => {
                  const status = action.currentStatus?.status || 'Pending';
                  const submitter = action.createdBy?.name || action.createdBy?.email || '—';
                  return (
                    <tr key={action._id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-semibold" style={{ color: COK.primary, fontFamily: FONT }}>{action.title}</p>
                        <p className="text-xs truncate max-w-[300px]" style={{ color: COK.gray }} title={action.actionDescription}>{action.actionDescription || ''}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <HodAvatar name={submitter} />
                          <div>
                            <p className="text-sm" style={{ color: COK.textDark }}>{submitter}</p>
                            <p className="text-xs" style={{ color: COK.gray }}>{action.createdBy?.email || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: COK.gray }}>{formatDate(action.dueDate)}</td>
                      <td className="px-3 py-2.5">
                        <HodChip label={status} color={STATUS_COLORS[status] || COK.primary} />
                      </td>
                      <td className="px-3 py-2.5">
                        {status === 'Pending' ? (
                          <div className="flex gap-2">
                            <button
                              className="px-3 py-1.5 text-xs font-semibold uppercase text-white flex items-center gap-1"
                              style={{ backgroundColor: COK.success, borderRadius: 0, fontFamily: FONT }}
                              onClick={() => { setDecision({ action, approve: true }); setReason(''); }}
                            >
                              <FiCheck /> Approve
                            </button>
                            <button
                              className="px-3 py-1.5 text-xs font-semibold uppercase text-white flex items-center gap-1"
                              style={{ backgroundColor: COK.danger, borderRadius: 0, fontFamily: FONT }}
                              onClick={() => { setDecision({ action, approve: false }); setReason(''); }}
                            >
                              <FiReject /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: COK.gray }}>
                            {action.statusHistory?.length ? formatDateTime(action.statusHistory[action.statusHistory.length - 1]?.changedAt) : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: COK.border }}>
          <span className="text-xs" style={{ color: COK.textMid, fontFamily: FONT }}>Page {page} of {Math.max(totalPages, 1)}</span>
          <div className="flex gap-2">
            <button className="cok-btn-primary disabled:opacity-50 px-3 py-1.5 text-xs" style={{ borderRadius: 0 }} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <button className="cok-btn-primary disabled:opacity-50 px-3 py-1.5 text-xs" style={{ borderRadius: 0 }} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      </HodCard>

      {decision && (
        <HodModal title={decision.approve ? 'Approve Request' : 'Reject Request'} onClose={() => setDecision(null)} maxWidth="max-w-md">
          <p className="text-sm mb-3" style={{ color: COK.textMid }}>
            {decision.approve ? 'Approve' : 'Reject'} “{decision.action.title}”?
          </p>
          <textarea
            className="cok-auth-input w-full py-2.5 px-3 text-sm"
            rows={3}
            placeholder={decision.approve ? 'Optional note...' : 'Reason for rejection (required)...'}
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-4">
            <button className="cok-btn-outlined px-4 py-2 text-xs" style={{ borderRadius: 0 }} onClick={() => setDecision(null)}>Cancel</button>
            <button
              className="px-4 py-2 text-xs font-semibold uppercase text-white"
              style={{ backgroundColor: decision.approve ? COK.success : COK.danger, borderRadius: 0, fontFamily: FONT, letterSpacing: '1px' }}
              disabled={saving}
              onClick={submitDecision}
            >
              {saving ? 'Saving...' : decision.approve ? 'Approve' : 'Reject'}
            </button>
          </div>
        </HodModal>
      )}
    </div>
  );
};

export default HodApprovalsPage;
