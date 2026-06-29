import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';

const BASE_URL = '/cok/api/v1';
const POLL_INTERVAL = 5000; // 5 seconds

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AttendeesList() {
  const { id: eventSpecialId } = useParams();
  const navigate = useNavigate();

  const [attendees, setAttendees] = useState([]);
  const [eventName, setEventName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [newCount, setNewCount] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;
  const prevIdsRef = useRef(new Set());
  const eventSpecialIdRef = useRef(eventSpecialId);
  eventSpecialIdRef.current = eventSpecialId;

  function fetchAttendees(isInitial = false) {
    return axios
      .get(`${BASE_URL}/attendance`, {
        params: { eventSpecialId: eventSpecialIdRef.current, limit: 200, _t: Date.now() },
      })
      .then((res) => {
        const data = res.data?.data || [];
        if (!isInitial) {
          const incoming = data.filter((a) => !prevIdsRef.current.has(a._id));
          if (incoming.length > 0) setNewCount((c) => c + incoming.length);
        }
        prevIdsRef.current = new Set(data.map((a) => a._id));
        setAttendees(data);
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (!eventSpecialId) return;
    setLoading(true);
    prevIdsRef.current = new Set();

    Promise.all([
      fetchAttendees(true),
      axios.get(`${BASE_URL}/live-events`, { params: { eventSpecialId } }).catch(() => null),
    ]).then(([, evRes]) => {
      const name = evRes?.data?.data?.[0]?.eventName || '';
      setEventName(name);
    }).catch(() => setError('Failed to load attendance records.'))
      .finally(() => setLoading(false));

    const timer = setInterval(() => fetchAttendees(false), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [eventSpecialId]);

  const filtered = attendees.filter((a) => {
    const q = search.toLowerCase();
    return (
      !q ||
      a.attendeeFullName?.toLowerCase().includes(q) ||
      a.attendeeInstitution?.toLowerCase().includes(q) ||
      a.attendeePosition?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportExcel() {
    const title = eventName || 'Attendance Report';
    const rows = filtered.map((a, i) => ({
      'S/N': i + 1,
      'Full Name': a.attendeeFullName || '',
      'Institution': a.attendeeInstitution || '',
      'Position': a.attendeePosition || '',
      'Submitted At': formatTime(a.createdAt),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [title],
      [`Total: ${filtered.length} attendee(s)   Exported: ${new Date().toLocaleString()}`],
      [],
    ]);
    XLSX.utils.sheet_add_json(ws, rows, { origin: 'A4' });
    ws['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 28 }, { wch: 25 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `attendance-${title}.xlsx`);
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 py-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-zinc-100 transition-colors shrink-0"
            aria-label="Go back"
          >
            <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-zinc-900 leading-tight">
              {eventName || 'Attendance Records'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-zinc-500">{filtered.length} attendee{filtered.length !== 1 ? 's' : ''}</p>
              {newCount > 0 && (
                <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-full">
                  +{newCount} new
                </span>
              )}
            </div>
          </div>
        </div>

        {filtered.length > 0 && (
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            <span className="hidden sm:inline">Export Excel</span>
            <span className="sm:hidden">Excel</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
        </svg>
        <input
          type="text"
          value={search}
          placeholder="Search by name, institution, position..."
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white transition-all"
        />
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-zinc-400">
          <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">Loading attendance records…</span>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 p-4 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="bg-zinc-50 border border-zinc-200 p-8 text-center">
          <svg className="w-8 h-8 text-zinc-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8z" />
          </svg>
          <p className="text-sm text-zinc-500">{search ? 'No results match your search.' : 'No attendance records yet.'}</p>
        </div>
      )}

      {/* Table — desktop */}
      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="hidden md:block border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-12">S/N</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Full Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Institution</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap">Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((a, i) => (
                  <tr key={a._id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                    <td className="px-4 py-3 text-xs text-zinc-400 font-mono">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3 font-medium text-zinc-900">{a.attendeeFullName}</td>
                    <td className="px-4 py-3 text-zinc-600">{a.attendeeInstitution || '—'}</td>
                    <td className="px-4 py-3 text-zinc-600">{a.attendeePosition}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{formatTime(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards — mobile / tablet */}
          <div className="md:hidden space-y-2">
            {paginated.map((a, i) => (
              <div key={a._id} className="bg-white border border-gray-200 rounded p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">#{(page - 1) * PAGE_SIZE + i + 1}</span>
                  <span className="text-[11px] text-zinc-400">{formatTime(a.createdAt)}</span>
                </div>
                <p className="font-semibold text-zinc-900 text-sm mb-2">{a.attendeeFullName}</p>
                <div className="grid grid-cols-1 gap-1 text-xs text-zinc-600">
                  {a.attendeeInstitution && (
                    <div className="flex gap-1">
                      <span className="text-zinc-400 shrink-0">Institution:</span>
                      <span className="font-medium">{a.attendeeInstitution}</span>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <span className="text-zinc-400 shrink-0">Position:</span>
                    <span className="font-medium">{a.attendeePosition}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <span className="text-xs text-zinc-500">
                Page {page} of {totalPages} &nbsp;·&nbsp; {filtered.length} total
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs border border-gray-300 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`px-3 py-1.5 text-xs border transition-colors ${
                      n === page
                        ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                        : 'border-gray-300 bg-white hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs border border-gray-300 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
