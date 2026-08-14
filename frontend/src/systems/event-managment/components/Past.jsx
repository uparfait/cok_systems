import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import TableContainer from './sub-components/TableContainer';
import { FiSearch } from 'react-icons/fi';
import SpiralLoader from './SpiralLoader';

const BASE_URL = '/cok/api/v1';

export default function Past() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
  });
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('new');

  // Debounce the search box so we don't hit the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchEvents = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 15, sort };
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }
      if (filter && filter !== 'all') params.filter = filter;

      const response = await axios.get(`${BASE_URL}/events/past`, { params });
      if (response.data?.success) {
        setEvents(response.data.data || []);
        setPagination({
          currentPage: response.data.currentPage || 1,
          totalPages: response.data.totalPages || 1,
          totalRecords: response.data.totalRecords || 0,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load past events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filter, sort]);

  useEffect(() => { fetchEvents(1); }, [fetchEvents]);

  const handleDelete = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this past event?')) return;
    try {
      await axios.delete(`${BASE_URL}/events/${eventId}`);
      fetchEvents(pagination.currentPage);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Past events are not editable
  const handleEdit = async () => {
    return;
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= pagination.totalPages) fetchEvents(page);
  };

  const getPageNumbers = () => {
    const pages = [];
    const total = pagination.totalPages;
    const current = pagination.currentPage;
    let start = Math.max(1, current - 2);
    let end = Math.min(total, current + 2);
    if (current <= 3) end = Math.min(5, total);
    if (current >= total - 2) start = Math.max(1, total - 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, room, organizer, email, phone, type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border  text-sm cok-auth-input"
              />
            </div>

          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 ppp-lg text-sm bg-white focus:ring-2 focus:ring-[#056daa] focus:border-[#056fdaa] outline-none"
          >
            <option value="all">All</option>
            <option value="thisWeek">This Week</option>
            <option value="thisMonth">This Month</option>
            <option value="thisYear">This Year</option>
            <option value="Internal">Internal</option>
            <option value="External">External</option>
            <option value="Joint">Joint</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 border border-gray-300 ppp-lg text-sm bg-white focus:ring-2 focus:ring-[#056daa] focus:border-[#056fdaa] outline-none"
          >
            <option value="new">Newest First</option>
            <option value="old">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <SpiralLoader />
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <div className="bg-red-50 border border-red-200 ppp-lg p-4 text-red-700">{error}</div>
          </div>
        ) : (
          <TableContainer
            data={events}
            allowToChangeRoom={false}
            onDelete={handleDelete}
            onEdit={handleEdit}
            eventType="past"
          />
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-gray-600">
          Total: <span className="font-medium">{pagination.totalRecords}</span> | 
          Page <span className="font-medium">{pagination.currentPage}</span> of{' '}
          <span className="font-medium">{pagination.totalPages}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage <= 1}
            className="px-3 py-1.5 text-sm border border-gray-300 ppp-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Back
          </button>
          {getPageNumbers().map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-3 py-1.5 text-sm border ppp-lg transition-colors ${
                page === pagination.currentPage
                  ? 'bg-[#056daa] text-white '
                  : 'border-gray-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={pagination.currentPage >= pagination.totalPages}
            className="px-3 py-1.5 text-sm border border-gray-300 ppp-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Forward
          </button>
        </div>
      </div>
    </div>
  );
}