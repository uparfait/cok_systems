import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import DataTable from '../../../core/components/table/DataTable';
import type { DataTableQuery } from '../../../core/components/table/dataTableTypes';
import { emptyQuery } from '../../../core/components/table/dataTableTypes';
import { useVisitorPanel } from '../../../core/components/visitor/VisitorPanelProvider';
import { failureOf, visitorApi } from '../../../core/components/visitor/visitorApi';
import type { VisitorRow } from '../../../core/components/visitor/visitorTypes';
import { useSocket } from '../../../core/contexts/SocketContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { getStoredNavigation } from '../../../core/services/navigationService';
import ExportVisitorsModal from '../../../core/components/requests/ExportVisitorsModal';
import type { ExportPresence } from '../../../core/components/requests/ExportVisitorsModal';
import RegisterVisitorOverlay from './visitors/RegisterVisitorOverlay';
import { toListParams, visitorsColumns } from './visitors/visitorsColumns';

const LIVE_EVENTS = ['visitor_updated', 'visitor_checkedin', 'visitor_checkedout', 'car_checkedin', 'car_checkedout', 'service_status_updated', 'visitor_assigned'];

const initialQuery = (): DataTableQuery => ({
  ...emptyQuery(20),
  filters: { presence: { value: 'in_house' } },
});

const VisitorsPage: React.FC = () => {
  const { openVisitor } = useVisitorPanel();
  const { visitorId: linkedVisitorId } = useParams();
  const { socket } = useSocket();
  const { showError } = useToast();
  const roleSlug = getStoredNavigation()?.role_slug || '';
  const canScope = roleSlug === 'employee' || roleSlug === 'department-manager';

  const [query, setQuery] = useState<DataTableQuery>(initialQuery);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mine, setMine] = useState(false);
  const [rows, setRows] = useState<VisitorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const sequence = useRef(0);
  const liveTimer = useRef<number | null>(null);

  const load = useCallback(async (silent = false) => {
    const current = ++sequence.current;
    if (!silent) setLoading(true);
    try {
      const response = await visitorApi.list(toListParams(query, { from, to, mine }));
      if (current !== sequence.current) return;
      setRows(response.data || []);
      setTotal(response.pagination?.total || 0);
    } catch (error) {
      if (current === sequence.current) showError(failureOf(error).message);
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [query, from, to, mine]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (linkedVisitorId) openVisitor(linkedVisitorId);
  }, [linkedVisitorId, openVisitor]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => {
      if (liveTimer.current) window.clearTimeout(liveTimer.current);
      liveTimer.current = window.setTimeout(() => load(true), 400);
    };
    LIVE_EVENTS.forEach((name) => socket.on(name, refresh));
    return () => {
      LIVE_EVENTS.forEach((name) => socket.off(name, refresh));
      if (liveTimer.current) window.clearTimeout(liveTimer.current);
    };
  }, [socket, load]);

  const presenceValue = query.filters.presence ? query.filters.presence.value : 'in_house';
  const exportPresence: ExportPresence = presenceValue === 'ALL' ? 'all' : presenceValue === 'not_in_house' ? 'not_in_house' : 'in_house';

  const applyRange = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    setQuery((q) => ({ ...q, page: 1 }));
  };

  const actions = (
    <>
      {canScope ? (
        <label className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-gray-700 cursor-pointer border border-gray-300 px-3 py-1.5 bg-white">
          <input type="checkbox" checked={mine} onChange={(e) => { setMine(e.target.checked); setQuery((q) => ({ ...q, page: 1 })); }} />
          {roleSlug === 'department-manager' ? 'My department and units' : 'My department'}
        </label>
      ) : null}
      <button type="button" className="cok-btn-outlined" onClick={() => setExporting(true)}>Export</button>
      <button type="button" className="cok-btn-primary w-auto! px-5! py-2!" onClick={() => setRegistering(true)}>New Visitor</button>
    </>
  );

  return (
    <div className="p-3 sm:p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Visitors</h1>
          <p className="text-xs text-gray-500">In-house visitors come first. Click a visitor to see details, send them to a department, serve them or add attachments.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            From
            <input type="date" value={from} max={to || undefined} onChange={(e) => applyRange(e.target.value, to)} className="border border-gray-300 bg-white px-2 py-1.5 text-sm font-normal normal-case" />
          </label>
          <label className="flex flex-col text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            To
            <input type="date" value={to} min={from || undefined} onChange={(e) => applyRange(from, e.target.value)} className="border border-gray-300 bg-white px-2 py-1.5 text-sm font-normal normal-case" />
          </label>
          {from || to ? (
            <button type="button" className="cok-btn-outlined" onClick={() => applyRange('', '')}>Any time</button>
          ) : null}
        </div>
      </div>

      <DataTable<VisitorRow>
        mode="server"
        columns={visitorsColumns}
        rows={rows}
        total={total}
        loading={loading}
        query={query}
        onQueryChange={setQuery}
        rowKey={(row) => row._id}
        onRowClick={(row) => openVisitor(row._id)}
        actions={actions}
        storageKey="visitors-page"
        minWidth={1500}
        emptyTitle="No visitor matches"
        emptyText="Change the filters in the column headers or the time range."
      />

      {registering ? (
        <RegisterVisitorOverlay
          onClose={() => setRegistering(false)}
          onRegistered={(visitorId) => {
            setRegistering(false);
            load(true);
            if (visitorId) openVisitor(visitorId);
          }}
        />
      ) : null}
      {exporting ? (
        <ExportVisitorsModal
          onClose={() => setExporting(false)}
          scope={mine ? 'mine' : undefined}
          presence={exportPresence}
          from={from || undefined}
          to={to || undefined}
        />
      ) : null}
    </div>
  );
};

export default VisitorsPage;
