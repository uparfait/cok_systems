import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FiSearch, FiChevronLeft, FiChevronRight, FiDroplet, FiTrash2, FiAlertTriangle } from "react-icons/fi";
import SpiralLoader from "./SpiralLoader";
import { useToast } from "@/core/contexts/ToastContext";

const BASE_URL = "/cok/api/v1";

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const DANGER = "#E74C3C";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";

const COLUMNS = [
  { key: "trackingCode", label: "Tracking Code" },
  { key: "type", label: "Type" },
  { key: "name", label: "Name" },
  { key: "room", label: "Room" },
  { key: "organizerName", label: "Organizer Name" },
  { key: "organizerEmail", label: "Organizer Email" },
  { key: "organizerTel", label: "Organizer Tel" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time (From — To)" },
  { key: "status", label: "Status" },
];

const STATUS_COLORS = {
  Pending: WARNING,
  Accepted: SUCCESS,
  Rejected: DANGER,
  Cancelled: GRAY_DISABLED,
};

const toDateStr = (iso) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const toTimeStr = (iso) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// waterOnly narrows the list to requests where the organizer asked for water
// (the sidebar's "Water Requests" view under Booking Requests)
export default function BookingRequestsList({ waterOnly = false }) {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { showSuccess, showError } = useToast();

  // Bulk delete (requests only — never the events created from them)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [delStatus, setDelStatus] = useState("");
  const [delRange, setDelRange] = useState("today");
  const [delStart, setDelStart] = useState("");
  const [delEnd, setDelEnd] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Debounce the search box so we don't hit the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchRequests = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 10 };
      if (waterOnly) params.water = "true";
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await axios.get(`${BASE_URL}/booking-requests`, { params });
      if (res.data.success) {
        setRequests(res.data.data);
        setCurrentPage(res.data.currentPage || 1);
        setTotalPages(res.data.totalPages || 1);
        setTotalRecords(res.data.totalRecords || 0);
      } else {
        setError("Failed to load booking requests");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, startDate, endDate, waterOnly, debouncedSearch]);

  useEffect(() => {
    fetchRequests(currentPage);
  }, [currentPage, fetchRequests]);

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setSearch("");
    setCurrentPage(1);
  };

  const handleBulkDelete = async () => {
    if (!delStatus) { showError("Select a status — Pending requests cannot be deleted"); return; }
    if (delRange === "custom" && (!delStart || !delEnd)) { showError("Select the custom date range"); return; }
    setDeleting(true);
    try {
      const params = { status: delStatus, range: delRange };
      if (delRange === "custom") { params.startDate = delStart; params.endDate = delEnd; }
      const res = await axios.delete(`${BASE_URL}/booking-requests/bulk`, { params });
      if (res.data.success) {
        showSuccess(res.data.message || "Requests deleted");
        setDeleteModalOpen(false);
        setDelStatus(""); setDelRange("today"); setDelStart(""); setDelEnd("");
        setCurrentPage(1);
        fetchRequests(1);
      } else {
        showError(res.data.message || "Failed to delete requests");
      }
    } catch (err) {
      showError(err.response?.data?.message || err.message);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status) => {
    const color = STATUS_COLORS[status] || GRAY_DISABLED;
    return (
      <span
        className="inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white whitespace-nowrap"
        style={{ backgroundColor: color, fontFamily: fontHeading }}
      >
        {status}
      </span>
    );
  };

  const renderCell = (req, columnKey) => {
    const org = req.eventOrganizer || {};
    switch (columnKey) {
      case "trackingCode":
        return (
          <span className="text-xs font-mono font-semibold px-2 py-0.5 whitespace-nowrap" style={{ color: PRIMARY, backgroundColor: "#E3F2FD" }}>
            {req.trackingCode}
          </span>
        );
      case "type":
        return req.eventMeetingType === "meet"
          ? <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">Meeting</span>
          : <span className="inline-block bg-blue-50 cok-primary-color border border-blue-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">Event</span>;
      case "name":
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-bold text-sm" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{req.eventName || "—"}</span>
            {req.waterRequest?.requested && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold uppercase bg-sky-100 text-sky-800 border border-sky-300 whitespace-nowrap"
                title={`Water requested${req.expectedAudience ? ` for ${req.expectedAudience} people` : ""}${req.waterRequest.requestedAt ? ` on ${new Date(req.waterRequest.requestedAt).toLocaleString()}` : ""}`}
              >
                <FiDroplet className="w-3 h-3" /> Water{req.expectedAudience ? ` · ${req.expectedAudience}` : ""}
              </span>
            )}
          </span>
        );
      case "room":
        return <span className="text-sm font-medium capitalize whitespace-nowrap" style={{ color: NEUTRAL_DARK }}>{req.eventRoom || "—"}</span>;
      case "organizerName":
        return <span className="text-sm whitespace-nowrap" style={{ color: NEUTRAL_DARK }}>{org.fullNames || "—"}</span>;
      case "organizerEmail":
        return <span className="text-sm whitespace-nowrap" style={{ color: NEUTRAL_DARK }}>{org.email || "—"}</span>;
      case "organizerTel":
        return <span className="text-sm whitespace-nowrap" style={{ color: NEUTRAL_DARK }}>{org.phone || "—"}</span>;
      case "date":
        return <span className="text-sm whitespace-nowrap" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{req.startTime ? toDateStr(req.startTime) : "—"}</span>;
      case "time":
        return (
          <span className="text-sm whitespace-nowrap" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
            {req.startTime && req.endTime ? `${toTimeStr(req.startTime)} — ${toTimeStr(req.endTime)}` : "—"}
          </span>
        );
      case "status":
        return getStatusBadge(req.status);
      default:
        return "—";
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4 sm:p-6">
        <div className="p-6 text-center w-full max-w-md" style={{ backgroundColor: "#FDECEA", border: "1px solid #F5B7B1" }}>
          <p className="text-sm font-medium mb-3" style={{ color: DANGER, fontFamily: fontHeading }}>{error}</p>
          <button
            onClick={() => fetchRequests(currentPage)}
            className="px-4 py-2 text-white text-xs font-semibold uppercase tracking-wide cursor-pointer"
            style={{ backgroundColor: DANGER, fontFamily: fontHeading }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      {/* Search + Filters Bar */}
      <div className="flex-shrink-0 bg-white p-3 sm:p-4 space-y-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5" style={{ color: GRAY_DISABLED }} />
            <input
              type="text"
              placeholder="Search by tracking code, name, room, organizer, email, phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full cok-auth-input pr-3 py-2 text-sm"
              style={{ minHeight: "42px" }}
            />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <input type="date" value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              className="cok-auth-input text-xs px-2"
              style={{ minHeight: "42px", paddingLeft: "10px" }} />
            <span className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>to</span>
            <input type="date" value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              className="cok-auth-input text-xs px-2"
              style={{ minHeight: "42px", paddingLeft: "10px" }} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {waterOnly && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wide bg-sky-100 text-sky-800 border border-sky-300" style={{ fontFamily: fontHeading }}>
              <FiDroplet className="w-3.5 h-3.5" /> Other Requests
            </span>
          )}
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className="cok-auth-input text-xs"
            style={{ minHeight: "38px", paddingLeft: "10px", width: "auto", fontFamily: fontHeading }}
          >
            <option value="">All statuses</option>
            {Object.keys(STATUS_COLORS).map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
          {(statusFilter || startDate || endDate || search) && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide cursor-pointer"
              style={{ color: DANGER, border: "1px solid #F5B7B1", backgroundColor: "#FFFFFF", fontFamily: fontHeading }}
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setDeleteModalOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white cursor-pointer transition-colors"
            style={{ backgroundColor: DANGER, fontFamily: fontHeading }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#C0392B")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = DANGER)}
          >
            <FiTrash2 className="w-3.5 h-3.5" /> Delete Requests
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <SpiralLoader />
          </div>
        ) : requests.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center p-4">
            <div className="flex flex-col items-center gap-3">
              <FiSearch className="w-12 h-12" style={{ color: BORDER }} />
              <span className="text-sm font-medium uppercase tracking-wide" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                {waterOnly ? "No other requests yet" : "No booking requests found"}
              </span>
              {(statusFilter || startDate || endDate || search) && (
                <button onClick={clearFilters} className="text-sm font-medium cursor-pointer hover:underline" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                  Clear filters to see all requests
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full w-full overflow-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="cok-primary-bg text-white px-3 py-3 sm:px-4 sm:py-3.5 text-left text-[11px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap"
                      style={{ fontFamily: fontHeading }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((req, rowIndex) => (
                  <tr
                    key={req._id}
                    onClick={() => navigate(`/event-manager/booking-requests/${req._id}`)}
                    className={`cursor-pointer transition-colors duration-100 ${rowIndex % 2 === 0 ? "bg-white hover:bg-blue-50" : "bg-gray-50/50 hover:bg-blue-50"}`}
                  >
                    {COLUMNS.map((col, colIndex) => (
                      <td
                        key={`${req._id}-${col.key}`}
                        className={`px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap ${colIndex === 0 ? "" : "border-l"} ${rowIndex < requests.length - 1 ? "border-b" : ""}`}
                        style={{ borderColor: BORDER }}
                      >
                        {renderCell(req, col.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk delete modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => { if (!deleting) setDeleteModalOpen(false); }} />
          <div className="relative bg-white w-full max-w-md p-5 sm:p-6 space-y-4" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-3">
              <FiAlertTriangle className="w-5 h-5 shrink-0" style={{ color: DANGER }} />
              <h3 className="text-base sm:text-lg font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Delete Booking Requests</h3>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                Status <span style={{ color: DANGER }}>*</span>
              </label>
              <select
                value={delStatus}
                onChange={(e) => setDelStatus(e.target.value)}
                className="w-full cok-auth-input pr-3 py-2 text-sm"
                style={{ paddingLeft: "10px" }}
              >
                <option value="">Select status</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                Requested Period <span style={{ color: DANGER }}>*</span>
              </label>
              <select
                value={delRange}
                onChange={(e) => setDelRange(e.target.value)}
                className="w-full cok-auth-input pr-3 py-2 text-sm"
                style={{ paddingLeft: "10px" }}
              >
                <option value="today">Today</option>
                <option value="thisMonth">This Month</option>
                <option value="thisYear">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {delRange === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                    From <span style={{ color: DANGER }}>*</span>
                  </label>
                  <input type="date" value={delStart} onChange={(e) => setDelStart(e.target.value)}
                    className="w-full cok-auth-input pr-3 py-2 text-sm" style={{ paddingLeft: "10px" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                    To <span style={{ color: DANGER }}>*</span>
                  </label>
                  <input type="date" value={delEnd} onChange={(e) => setDelEnd(e.target.value)}
                    min={delStart || undefined}
                    className="w-full cok-auth-input pr-3 py-2 text-sm" style={{ paddingLeft: "10px" }} />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                className="cok-btn-outlined flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleting || !delStatus}
                className="flex-1 py-2.5 text-white text-xs font-semibold uppercase tracking-wide cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: DANGER, fontFamily: fontHeading }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#C0392B")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = DANGER)}
              >
                <FiTrash2 className="w-4 h-4" />
                {deleting ? "Deleting..." : "Delete Requests"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-4 py-3 bg-white" style={{ borderTop: `1px solid ${BORDER}` }}>
          <p className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
            Page {currentPage} of {totalPages} ({totalRecords} records)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ border: `1px solid ${BORDER}`, color: NEUTRAL_DARK }}
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium px-2" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{currentPage}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ border: `1px solid ${BORDER}`, color: NEUTRAL_DARK }}
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
