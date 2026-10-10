import React, { useCallback, useEffect, useRef, useState } from 'react';
import OverlayShell from '../overlay/OverlayShell';
import { useSocket } from '../../contexts/SocketContext';
import VisitorInfoTab from './VisitorInfoTab';
import VisitorAddAttachmentTab from './VisitorAddAttachmentTab';
import VisitorAttachmentsTab from './VisitorAttachmentsTab';
import { failureOf, visitorApi } from './visitorApi';
import type { VisitorDetails } from './visitorTypes';

type TabKey = 'info' | 'add' | 'list';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'info', label: 'Info' },
  { key: 'add', label: 'Add attachment' },
  { key: 'list', label: 'Attachments' },
];

const REFRESH_EVENTS = ['visitor_updated', 'visitor_attachments_updated', 'service_status_updated', 'visitor_checkedout', 'visitor_checkedin', 'visitor_assigned'];

const payloadVisitor = (payload: unknown): string => {
  const p = (payload || {}) as { visitor_id?: string; data?: { visitor_id?: string } };
  return String(p.visitor_id || (p.data && p.data.visitor_id) || '');
};

interface VisitorPanelProps {
  visitorId: string;
  onClose: () => void;
}

const VisitorPanel: React.FC<VisitorPanelProps> = ({ visitorId, onClose }) => {
  const { socket } = useSocket();
  const [details, setDetails] = useState<VisitorDetails | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabKey>('info');
  const [busyCount, setBusyCount] = useState(0);
  const [attachmentsKey, setAttachmentsKey] = useState(0);
  const refreshTimer = useRef<number | null>(null);

  const setBusy = useCallback((busy: boolean) => setBusyCount((n) => Math.max(0, n + (busy ? 1 : -1))), []);

  const load = useCallback(async () => {
    try {
      const response = await visitorApi.get(visitorId);
      setDetails(response.data);
      setError('');
    } catch (failure) {
      setError(failureOf(failure).message);
    }
  }, [visitorId]);

  useEffect(() => {
    setDetails(null);
    setTab('info');
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const handler = (eventName: string) => (payload: unknown) => {
      if (payloadVisitor(payload) !== String(visitorId)) return;
      if (eventName === 'visitor_attachments_updated') setAttachmentsKey((k) => k + 1);
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(load, 300);
    };
    const handlers = REFRESH_EVENTS.map((eventName) => ({ eventName, fn: handler(eventName) }));
    handlers.forEach(({ eventName, fn }) => socket.on(eventName, fn));
    return () => {
      handlers.forEach(({ eventName, fn }) => socket.off(eventName, fn));
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    };
  }, [socket, visitorId, load]);

  const busy = busyCount > 0;
  const visitor = details?.visitor;

  const tabBar = (
    <div className="flex gap-1 px-4 sm:px-5 border-b border-gray-200 overflow-x-auto">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          disabled={busy && t.key !== tab}
          onClick={() => setTab(t.key)}
          className={`px-3 py-2 text-[12px] font-semibold uppercase tracking-wide border-b-2 -mb-px whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${tab === t.key ? 'border-[#056daa] text-[#056daa]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <OverlayShell
      title={visitor ? visitor.full_name : 'Visitor'}
      subtitle={visitor ? `${visitor.identification?.id_type || 'ID'} ${visitor.identification?.number || '-'} - ${visitor.telephone || '-'}` : undefined}
      onClose={onClose}
      busy={busy}
      width="lg"
      headerExtra={tabBar}
      zIndex={1200}
    >
      {error && !details ? <p className="text-sm text-red-600">{error}</p> : null}
      {!error && !details ? <p className="text-sm text-gray-500">Loading visitor...</p> : null}
      {details && tab === 'info' ? (
        <VisitorInfoTab
          details={details}
          setBusy={setBusy}
          onChanged={(next) => {
            if (next) setDetails(next);
            else load();
          }}
        />
      ) : null}
      {details && tab === 'add' ? (
        <VisitorAddAttachmentTab
          visitorId={visitorId}
          canAdd={details.permissions.can_add_attachment}
          setBusy={setBusy}
          onUploaded={() => {
            setAttachmentsKey((k) => k + 1);
            setTab('list');
          }}
        />
      ) : null}
      {details && tab === 'list' ? <VisitorAttachmentsTab visitorId={visitorId} refreshKey={attachmentsKey} setBusy={setBusy} /> : null}
    </OverlayShell>
  );
};

export default VisitorPanel;
