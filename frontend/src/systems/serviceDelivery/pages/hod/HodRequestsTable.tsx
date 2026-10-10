import React, { useCallback, useEffect, useRef, useState } from 'react';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import { departmentManagerService } from '@/core/services/adminService';
import { useSocket } from '@/core/contexts/SocketContext';
import { useVisitorPanel, visitorIdOf } from '@/core/components/visitor/VisitorPanelProvider';
import { formatDateTime } from '@/core/components/visitor/visitorApi';
import LiveTimer from '../sub/DeptManagerLiveTimer';

const PRIMARY = '#056daa';
const WARNING = '#F39C12';
const SUCCESS_TEXT = '#388E3C';
const INFO = '#2980B9';
const NEUTRAL_DARK = '#333333';
const GRAY_MID = '#555555';
const GRAY = '#9E9E9E';
const BORDER = '#E0E0E0';
const FONT = "'Montserrat', sans-serif";

const LIMIT = 20;
const LIVE_EVENTS = ['visitor_updated', 'service_status_updated', 'visitor_assigned', 'visitor_checkedout'];

type RequestStatus = 'pending' | 'active' | 'transferred' | 'completed' | 'not_served';

interface ScopeService {
  department_id?: string;
  department_name?: string;
  provider_id?: string | null;
  provider_name?: string;
  s_type?: string;
}

interface StatusLook { label: string; color: string; background: string }

const LOOKS: Record<string, StatusLook> = {
  not_started: { label: 'Not Started', color: WARNING, background: 'rgba(243,156,18,0.12)' },
  inprogress: { label: 'In Progress', color: PRIMARY, background: 'rgba(5,109,170,0.1)' },
  transferred: { label: 'Transferred', color: INFO, background: 'rgba(41,128,185,0.12)' },
  completed: { label: 'Completed', color: SUCCESS_TEXT, background: 'rgba(76,175,80,0.12)' },
  not_served: { label: 'Not Served', color: GRAY_MID, background: 'rgba(51,51,51,0.08)' },
};

const STATUS_DEFAULT: Record<RequestStatus, string> = {
  pending: 'not_started',
  active: 'inprogress',
  transferred: 'transferred',
  completed: 'completed',
  not_served: 'not_served',
};

const lookKeyOf = (sType: string | undefined, status: RequestStatus): string => {
  const text = String(sType || '').toLowerCase().replace(/\s+/g, '');
  if (status === 'not_served') return 'not_served';
  if (text === 'transfered' || text === 'transferred') return 'transferred';
  if (text === 'inprogress') return 'inprogress';
  if (text === 'completed') return 'completed';
  if (text === 'notstarted') return 'not_started';
  return STATUS_DEFAULT[status];
};

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

const cellOf = (value: unknown): string =>
  value === undefined || value === null || value === '' ? '-' : String(value);

interface HodRequestsTableProps {
  status: RequestStatus;
  title: string;
  from?: string;
  to?: string;
}

const HodRequestsTable: React.FC<HodRequestsTableProps> = ({ status, title, from, to }) => {
  const { socket } = useSocket();
  const { openVisitor } = useVisitorPanel();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageRef = useRef(1);
  pageRef.current = page;
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRequests = useCallback(async (targetPage: number, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await departmentManagerService.getVisitorsByStatus(status, targetPage, LIMIT, undefined, from, to);
      if (r?.success && r.data) {
        setRequests(r.data);
        setTotal(r.total || 0);
        setPage(targetPage);
      } else if (!silent) {
        setRequests([]);
        setTotal(0);
      }
    } catch {
      if (!silent) setRequests([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [status, from, to]);

  useEffect(() => { fetchRequests(1); }, [fetchRequests]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchRequests(pageRef.current, true);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => {
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
      liveTimerRef.current = setTimeout(() => fetchRequests(pageRef.current, true), 400);
    };
    LIVE_EVENTS.forEach(name => socket.on(name, refresh));
    return () => {
      LIVE_EVENTS.forEach(name => socket.off(name, refresh));
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    };
  }, [socket, fetchRequests]);

  const totalPages = Math.max(Math.ceil(total / LIMIT), 1);
  const headers = [
    'Full Name', 'ID Type', 'ID Number', 'Telephone', 'Email', 'Gender', 'Visits',
    'Department', 'Provider', 'Entry Time', 'Status', ...(status === 'active' ? ['Duration'] : []),
  ];

  return (
    <div className="bg-white flex flex-col" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
      <div className="flex flex-wrap items-center justify-between gap-2 p-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <h2 className="text-sm font-bold uppercase" style={{ fontFamily: FONT, color: PRIMARY, letterSpacing: '1px' }}>{title}</h2>
        <button
          className="cok-btn-outlined px-4 py-2 text-xs"
          style={{ borderRadius: 0, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: FONT }}
          onClick={() => fetchRequests(page)}
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <SpiralLoader />
        </div>
      ) : requests.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm" style={{ color: GRAY, fontFamily: FONT }}>No {status.replace('_', ' ')} requests for the selected filters</p>
        </div>
      ) : (
        <div className="cok-table-scroll">
          <table className="w-full min-w-[1400px]">
            <thead style={{ backgroundColor: PRIMARY }}>
              <tr>
                {headers.map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs uppercase tracking-wider text-white font-semibold" style={{ fontFamily: FONT, backgroundColor: PRIMARY }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E0E0]">
              {requests.map((r: any) => {
                const assignments: any[] = Array.isArray(r.departments_assigned) ? r.departments_assigned : [];
                const scope: ScopeService | null = r.scope_service || null;
                const assignment = scope
                  ? assignments.find(a => scope.department_id && String(a?.department_id) === String(scope.department_id)) || null
                  : assignments[0] || null;
                const look = LOOKS[lookKeyOf(scope?.s_type, status)] || LOOKS[STATUS_DEFAULT[status]];
                const identification = r.identification || r.visitor?.identification || {};
                const fullName = r.full_name || r.visitor?.full_name || 'Unknown';
                const department = scope?.department_name || assignment?.department_name || 'Unknown';
                const provider = scope?.provider_name || assignment?.provider_name || 'Unassigned';
                return (
                  <tr
                    key={r._id}
                    className="hover:bg-[#F7F9FB] cursor-pointer"
                    onClick={() => openVisitor(visitorIdOf(r))}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center justify-center w-7 h-7 text-xs font-bold shrink-0"
                          style={{ backgroundColor: 'rgba(5,109,170,0.12)', color: PRIMARY, fontFamily: FONT, borderRadius: 0 }}
                        >
                          {getInitials(fullName)}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: FONT }}>{fullName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{cellOf(identification.id_type)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{cellOf(identification.number)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{cellOf(r.telephone ?? r.visitor?.telephone)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{cellOf(r.email ?? r.visitor?.email)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{cellOf(r.gender ?? r.visitor?.gender)}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: NEUTRAL_DARK }}>{Number(r.N_visits ?? r.visitor?.N_visits ?? 0)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{department}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{provider}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{formatDateTime(r.entry_date)}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs px-2 py-0.5 font-bold uppercase" style={{ borderRadius: 0, backgroundColor: look.background, color: look.color, fontFamily: FONT }}>
                        {look.label}
                      </span>
                    </td>
                    {status === 'active' && (
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-bold px-2 py-0.5" style={{ backgroundColor: 'rgba(5,109,170,0.08)', color: PRIMARY, fontFamily: FONT }}>
                          <LiveTimer startTime={r.entry_date} />
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
        <span className="text-xs" style={{ color: GRAY_MID, fontFamily: FONT }}>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button
            className="cok-btn-outlined px-4 py-1.5 text-xs disabled:opacity-50"
            style={{ borderRadius: 0, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: FONT }}
            disabled={page <= 1 || loading}
            onClick={() => fetchRequests(page - 1)}
          >
            Back
          </button>
          <button
            className="cok-btn-outlined px-4 py-1.5 text-xs disabled:opacity-50"
            style={{ borderRadius: 0, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: FONT }}
            disabled={page >= totalPages || loading}
            onClick={() => fetchRequests(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default HodRequestsTable;
