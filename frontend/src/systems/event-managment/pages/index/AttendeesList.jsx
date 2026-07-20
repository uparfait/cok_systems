import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import SpiralLoader from '../../components/SpiralLoader';

const BASE_URL = '/cok/api/v1';
const POLL_INTERVAL = 5000;
const PRIMARY = '#056daa';
const PRIMARY_HOVER = '#248fc2';

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
      'Signed': a.attendeeSignature ? 'Yes' : 'No',
      'Submitted At': formatTime(a.createdAt),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [title],
      [`Total: ${filtered.length} attendee(s)   Exported: ${new Date().toLocaleString()}`],
      [],
    ]);
    XLSX.utils.sheet_add_json(ws, rows, { origin: 'A4' });
    ws['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 28 }, { wch: 25 }, { wch: 8 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `attendance-${title}.xlsx`);
  }

  const searchFocused = typeof window !== 'undefined' ? false : false;

  return (
    <div className="w-full min-h-screen flex justify-center" style={{ paddingTop: '80px', backgroundColor: '#F7F9FB' }}>
      <div className="w-full max-w-5xl px-4 sm:px-6 md:px-8 py-6">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 text-white text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
              style={{ backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif", cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Go Back
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-zinc-900 leading-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {eventName || 'Attendance Records'}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-zinc-500" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {filtered.length} attendee{filtered.length !== 1 ? 's' : ''}
                </p>
                {newCount > 0 && (
                  <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-none">
                    +{newCount} new
                  </span>
                )}
              </div>
            </div>
          </div>

          {filtered.length > 0 && (
            <button
              onClick={exportExcel}
              className="flex items-center gap-1.5 px-4 py-2.5 text-white text-xs font-semibold uppercase tracking-wider rounded-none transition-colors shrink-0"
              style={{ backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif", cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              <span className="hidden sm:inline">Export Excel</span>
              <span className="sm:hidden">Excel</span>
            </button>
          )}
        </div>

        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: PRIMARY }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input
            type="text"
            value={search}
            placeholder="Search by name, institution, position..."
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 text-sm outline-none"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: '14px',
              fontWeight: 500,
              letterSpacing: '0.2px',
              lineHeight: '1.4',
              color: '#333333',
              backgroundColor: '#F7F9FB',
              borderRadius: 0,
              border: '1px solid transparent',
              boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
              transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = PRIMARY;
              e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)';
            }}
          />
        </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <SpiralLoader color="#056daa" />
          <span className="ml-2 text-sm" style={{ fontFamily: "'Montserrat', sans-serif", color: '#888888' }}>Loading attendance records…</span>
        </div>
      )}

        {!loading && error && (
          <div className="p-4 text-sm" style={{ backgroundColor: '#FFEBEE', border: '1px solid #FFCDD2', color: '#C62828', fontFamily: "'Montserrat', sans-serif" }}>
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="p-8 text-center" style={{ backgroundColor: '#F7F9FB', border: '1px solid #E0E0E0' }}>
            <svg className="w-8 h-8 mx-auto mb-2" style={{ color: '#CCCCCC' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8z" />
            </svg>
            <p className="text-sm" style={{ color: '#888888', fontFamily: "'Montserrat', sans-serif" }}>
              {search ? 'No results match your search.' : 'No attendance records yet.'}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="block overflow-x-auto rounded-none">
              <table className="w-full text-sm rounded-none">
                <thead>
                  <tr style={{ backgroundColor: PRIMARY }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-12" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>S/N</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>Full Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>Institution</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>Position</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>Signature</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((a, i) => (
                    <tr key={a._id} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: '#888888' }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{a.attendeeFullName}</td>
                      <td className="px-4 py-3 text-zinc-600" style={{ fontFamily: "'Montserrat', sans-serif" }}>{a.attendeeInstitution || '—'}</td>
                      <td className="px-4 py-3 text-zinc-600" style={{ fontFamily: "'Montserrat', sans-serif" }}>{a.attendeePosition || '—'}</td>
                      <td className="px-4 py-3">
                        {a.attendeeSignature ? (
                          <img
                            src={a.attendeeSignature}
                            alt={`Signature of ${a.attendeeFullName}`}
                            className="h-8 max-w-[110px] object-contain"
                          />
                        ) : (
                          <span style={{ color: '#CCCCCC' }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#888888' }}>{formatTime(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-3 px-1">
                <span className="text-xs text-zinc-500" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  Page {page} of {totalPages} &nbsp;·&nbsp; {filtered.length} total
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs border border-gray-300 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-none"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`px-3 py-1.5 text-xs border transition-colors rounded-none ${
                        n === page
                          ? 'text-white font-semibold'
                          : 'border-gray-300 bg-white hover:bg-zinc-50 text-zinc-700'
                      }`}
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        backgroundColor: n === page ? PRIMARY : '#FFFFFF',
                        borderColor: n === page ? PRIMARY : '#E0E0E0',
                      }}
                      onMouseEnter={(e) => { if (n !== page) e.currentTarget.style.backgroundColor = '#F7F9FB'; }}
                      onMouseLeave={(e) => { if (n !== page) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs border border-gray-300 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-none"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
