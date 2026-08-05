import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { FiX, FiDownload, FiSearch, FiChevronLeft, FiChevronRight } from "react-icons/fi";

const BASE_URL = "/cok/api/v1";
const PAGE_SIZE = 10;

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

// Drawn signatures live in attendeeSignature (base64); uploaded ones are stored
// in digitalCertificate as a served file URL — display whichever exists
function signatureImageSrc(a) {
  if (a?.attendeeSignature) return a.attendeeSignature;
  if (a?.digitalCertificate && /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(a.digitalCertificate)) return a.digitalCertificate;
  return null;
}

export default function AttendeesOverlay({ eventSpecialId, eventName, onClose }) {
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exportLoading, setExportLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchAttendees = useCallback(async () => {
    if (!eventSpecialId) return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${BASE_URL}/attendance`, {
        params: { eventSpecialId, limit: 500, _t: Date.now() },
      });
      const data = res.data?.data || [];
      setAttendees(data);
    } catch {
      setError("Failed to load attendance records.");
    } finally {
      setLoading(false);
    }
  }, [eventSpecialId]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchAttendees();
    }
  }, [fetchAttendees]);

  const filtered = attendees.filter((a) => {
    const q = search.toLowerCase();
    return (
      !q ||
      a.attendeeFullName?.toLowerCase().includes(q) ||
      a.attendeeInstitution?.toLowerCase().includes(q) ||
      a.attendeePosition?.toLowerCase().includes(q) ||
      a.attendeeEmail?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = async (type) => {
    setExportLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/attendance/export`, {
        params: { eventSpecialId, eventName, type },
        responseType: "blob",
      });
      const safeName = (eventName || "attendance").replace(/[^a-zA-Z0-9]/g, "_");
      const ext = type === "excel" ? "xlsx" : "pdf";
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}-attendees.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export attendance records.");
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 w-full max-w-4xl max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-base font-bold text-gray-900">Attendees</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {eventName} &middot; {filtered.length} attendee{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleExport("excel")}
                  disabled={exportLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-xs font-medium transition-colors"
                >
                  <FiDownload className="w-3.5 h-3.5" />
                  {exportLoading ? "..." : "Excel"}
                </button>
                <button
                  onClick={() => handleExport("pdf")}
                  disabled={exportLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-medium transition-colors"
                >
                  <FiDownload className="w-3.5 h-3.5" />
                  {exportLoading ? "..." : "PDF"}
                </button>
              </div>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-200">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              placeholder="Search by name, institution, position, email..."
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white transition-all"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-sm text-gray-500">Loading attendance records...</span>
            </div>
          )}

          {!loading && error && (
            <div className="mx-6 my-4 bg-red-50 border border-red-200 p-3 text-sm text-red-600">{error}</div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
              <p className="text-sm text-gray-500">{search ? "No results match your search." : "No attendance records yet."}</p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1255e5] text-white">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-12">S/N</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Full Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Institution</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Position</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Signature</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap">Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((a, i) => (
                    <tr key={a._id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{a.attendeeFullName}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{a.attendeeEmail || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{a.attendeePhoneNumber || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{a.attendeeInstitution || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{a.attendeePosition}</td>
                      <td className="px-4 py-3">
                        {signatureImageSrc(a) ? (
                          <img
                            src={signatureImageSrc(a)}
                            alt={`Signature of ${a.attendeeFullName}`}
                            className="h-8 max-w-[110px] object-contain"
                          />
                        ) : a.digitalCertificate ? (
                          <a href={a.digitalCertificate} target="_blank" rel="noopener noreferrer" className="text-xs underline text-sky-700">
                            View file
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatTime(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-xs text-gray-500">
              Page {page} of {totalPages} &middot; {filtered.length} total
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-gray-700 px-2">{page}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}