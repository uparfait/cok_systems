import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import TableContainer from './sub-components/TableContainer';
import { FiSearch } from 'react-icons/fi';
import SpiralLoader from './SpiralLoader';

const BASE_URL = '/cok/api/v1';

export default function Live() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
  });
  
  // Filters
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('new');

  const fetchEvents = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 15,
        sort,
      };
      if (search && searchField) {
        params.search = search;
        params.searchField = searchField;
      }
      if (filter && filter !== 'all') {
        params.filter = filter;
      }

      const response = await axios.get(`${BASE_URL}/events/live`, { params });
      if (response.data?.success) {
        setEvents(response.data.data || []);
        setPagination({
          currentPage: response.data.currentPage || 1,
          totalPages: response.data.totalPages || 1,
          totalRecords: response.data.totalRecords || 0,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load live events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [search, searchField, filter, sort]);

  useEffect(() => {
    fetchEvents(1);
  }, [fetchEvents]);

  const handleDelete = async (eventId, status) => {
    if (!window.confirm(`Are you sure you want to delete this ${status} event?`)) return;
    try {
      await axios.delete(`${BASE_URL}/events/${eventId}`);
      fetchEvents(pagination.currentPage);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleEdit = async (eventId, field, value) => {
    const data = { [field]: value };
    await axios.put(`${BASE_URL}/events/live/${eventId}`, data);
    fetchEvents(pagination.currentPage);
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchEvents(page);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const total = pagination.totalPages;
    const current = pagination.currentPage;
    
    let start = Math.max(1, current - 2);
    let end = Math.min(total, current + 2);
    
    if (current <= 3) end = Math.min(5, total);
    if (current >= total - 2) start = Math.max(1, total - 4);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="bg-red-50 border border-red-200 ppp-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search live events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border  text-sm cok-auth-input"
              />
            </div>
          </div>

          {/* Filter */}
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

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 border border-gray-300 ppp-lg text-sm bg-white focus:ring-2 focus:ring-[#056daa] focus:[#056daa] outline-none"
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
        ) : (
          <TableContainer
            data={events}
            allowToChangeRoom={true}
            onDelete={handleDelete}
            onEdit={handleEdit}
            eventType="live"
          />
        )}
      </div>

      {/* Footer - Pagination */}
      <div className="bg-white border-t border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-gray-600">
          Total: <span className="font-medium">{pagination.totalRecords}</span> | 
          Page <span className="font-medium">{pagination.currentPage}</span> of{' '}
          <span className="font-medium">{pagination.totalPages}</span>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Previous */}
          <button
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage <= 1}
            className="px-3 py-1.5 text-sm border border-gray-300 ppp-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Back
          </button>

          {/* Page Numbers */}
          {getPageNumbers().map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-3 py-1.5 text-sm border ppp-lg transition-colors ${
                page === pagination.currentPage
                  ? 'bg-blue-600 text-white '
                  : 'border-gray-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              {page}
            </button>
          ))}

          {/* Next */}
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