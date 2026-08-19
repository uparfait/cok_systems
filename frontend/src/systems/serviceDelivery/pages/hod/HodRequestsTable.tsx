import React, { useCallback, useEffect, useRef, useState } from 'react';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import { departmentManagerService } from '@/core/services/adminService';
import LiveTimer from '../sub/DeptManagerLiveTimer';

const PRIMARY = '#056daa';
const WARNING = '#F39C12';
const SUCCESS_TEXT = '#388E3C';
const NEUTRAL_DARK = '#333333';
const GRAY_MID = '#555555';
const GRAY = '#9E9E9E';
const BORDER = '#E0E0E0';
const FONT = "'Montserrat', sans-serif";

const LIMIT = 20;

const getInitials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

interface HodRequestsTableProps {
  status: 'pending' | 'active' | 'completed';
  title: string;
  from?: string;
  to?: string;
}

const HodRequestsTable: React.FC<HodRequestsTableProps> = ({ status, title, from, to }) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const stateRef = useRef({ page: 1, from, to });
  stateRef.current = { page, from, to };

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
      fetchRequests(stateRef.current.page, true);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const totalPages = Math.max(Math.ceil(total / LIMIT), 1);
  const statusLabel = status === 'pending' ? 'Not Started' : status === 'active' ? 'In Progress' : 'Completed';
  const chipBg = status === 'pending' ? 'rgba(243,156,18,0.12)' : status === 'active' ? 'rgba(5,109,170,0.1)' : 'rgba(76,175,80,0.12)';
  const chipColor = status === 'pending' ? WARNING : status === 'active' ? PRIMARY : SUCCESS_TEXT;
  const headers = ['Visitor', 'Contact', 'Department', 'Provider', 'Entry Time', 'Status', ...(status === 'active' ? ['Duration'] : [])];

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
          <p className="text-sm" style={{ color: GRAY, fontFamily: FONT }}>No {status} requests for the selected filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead style={{ backgroundColor: PRIMARY }}>
              <tr>
                {headers.map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs uppercase tracking-wider text-white font-semibold" style={{ fontFamily: FONT }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E0E0]">
              {requests.map((r: any) => (
                <tr key={r._id} className="hover:bg-[#F7F9FB]">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 text-xs font-bold shrink-0"
                        style={{ backgroundColor: 'rgba(5,109,170,0.12)', color: PRIMARY, fontFamily: FONT, borderRadius: 0 }}
                      >
                        {getInitials(r.full_name || '?')}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: FONT }}>{r.full_name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{r.telephone || '-'}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{r.departments_assigned?.[0]?.department_name || 'Unknown'}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{r.departments_assigned?.[0]?.provider_name || 'Unassigned'}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{r.entry_date ? new Date(r.entry_date).toLocaleString() : 'N/A'}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs px-2 py-0.5 font-bold uppercase" style={{ borderRadius: 0, backgroundColor: chipBg, color: chipColor, fontFamily: FONT }}>
                      {statusLabel}
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
              ))}
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
