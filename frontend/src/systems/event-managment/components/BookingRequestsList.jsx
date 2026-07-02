import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FiSearch, FiEye, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import SpiralLoader from "./SpiralLoader";

const BASE_URL = "/cok/api/v1";

const COLUMNS = [
  { key: "trackingCode", label: "Tracking Code" },
  { key: "eventName", label: "Event / Meeting" },
  { key: "organizer", label: "Organizer" },
  { key: "eventRoom", label: "Room" },
  { key: "schedule", label: "Schedule" },
  { key: "status", label: "Status" },
];

const STATUS_STYLES = {
  Pending: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
  Accepted: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
  Rejected: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
  Cancelled: { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" },
};

export default function BookingRequestsList() {
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

  const fetchRequests = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

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
      setError(err.response?.data?.message || "Failed to load booking requests");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, startDate, endDate]);

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
    setCurrentPage(1);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const getStatusBadge = (status) => {
    const style = STATUS_STYLES[status] || STATUS_STYLES.Pending;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium ${style.bg} ${style.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        {status}
      </span>
    );
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="bg-red-50 border-2 border-red-200 p-6 text-center">
          <p className="text-red-700 text-sm font-medium mb-3">{error}</p>
          <button onClick={() => fetchRequests(currentPage)} className="px-4 py-2 bg-red-600 text-white text-sm font-bold hover:bg-red-700">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters Bar */}
      <div className="flex-shrink-0 bg-white border-b-2 border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status:</span>
            <button
              onClick={() => handleStatusFilter("")}
              className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                !statusFilter ? "bg-[#1255e5] text-white border-[#1255e5]" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              All
            </button>
            {Object.keys(STATUS_STYLES).map((key) => (
              <button
                key={key}
                onClick={() => handleStatusFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                  statusFilter === key
                    ? `${STATUS_STYLES[key].bg} ${STATUS_STYLES[key].text} border-transparent`
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs text-gray-500">From:</label>
            <input type="date" value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              className="px-2 py-1.5 border-2 border-gray-300 text-xs outline-none focus:border-[#1255e5]" />
            <label className="text-xs text-gray-500">To:</label>
            <input type="date" value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              className="px-2 py-1.5 border-2 border-gray-300 text-xs outline-none focus:border-[#1255e5]" />
            {(statusFilter || startDate || endDate) && (
              <button onClick={clearFilters}
                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <SpiralLoader />
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <FiSearch className="w-12 h-12 text-gray-300" />
              <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">No booking requests found</span>
              {(statusFilter || startDate || endDate) && (
                <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Clear filters to see all requests
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full w-full overflow-auto">
            <table className="w-full border-collapse table-auto">
              <thead className="sticky top-0 z-10">
                <tr>
                  {COLUMNS.map((col) => (
                    <th key={col.key} className="bg-[#1255e5] text-white px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest border-r border-blue-400 last:border-r-0">
                      {col.label}
                    </th>
                  ))}
                  <th className="bg-[#1255e5] text-white px-4 py-3.5 text-center text-xs font-bold uppercase tracking-widest">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req, rowIndex) => (
                  <tr key={req._id}
                    className={`transition-colors duration-100 cursor-pointer ${
                      rowIndex % 2 === 0 ? "bg-white hover:bg-blue-50/30" : "bg-gray-50/50 hover:bg-blue-50/30"
                    }`}
                    onClick={() => navigate(`/event-manager/booking-requests/${req._id}`)}
                  >
                    <td className="px-4 py-3 border-r border-gray-200">
                      <span className="text-xs font-mono font-medium text-[#1255e5] bg-blue-50 px-2 py-0.5">
                        {req.trackingCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200">
                      <div className="text-sm font-medium text-gray-900">{req.eventName}</div>
                      <div className="text-xs text-gray-400 capitalize">{req.eventMeetingType}</div>
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200">
                      <div className="text-sm text-gray-700">{req.eventOrganizer?.fullNames}</div>
                      <div className="text-xs text-gray-400">{req.eventOrganizer?.email}</div>
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200">
                      <span className="text-sm text-gray-700 capitalize">{req.eventRoom}</span>
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200">
                      <div className="text-xs text-gray-600">{formatDate(req.startTime)}</div>
                      <div className="text-xs text-gray-400">to {formatDate(req.endTime)}</div>
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200">
                      {getStatusBadge(req.status)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/event-manager/booking-requests/${req._id}`); }}
                        className="p-2 text-gray-400 hover:text-[#1255e5] hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all"
                        title="View Details"
                      >
                        <FiEye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t-2 border-gray-200 bg-white">
          <p className="text-xs text-gray-500">
            Page {currentPage} of {totalPages} ({totalRecords} records)
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border-2 border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
              <FiChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-700 px-2">{currentPage}</span>
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border-2 border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}