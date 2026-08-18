import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import EventActionsTable from './EventActionsTable';
import EventActionsCancelModal from './EventActionsCancelModal';
import EventActionsDetailModal from './EventActionsDetailModal';
import { useToast } from '@/core/contexts/ToastContext';

const BASE_URL = '/cok/api/v1';

export default function EventActions() {
  const { showSuccess, showError } = useToast();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [pagination, setPagination] = useState({ totalPages: 1, totalRecords: 0 });
  const [detailAction, setDetailAction] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  const fetchActions = useCallback(async (p = 1) => {
    setLoading(true); setError(null);
    try {
      const params = { page: p, limit: pageSize };
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to;
      const res = await axios.get(`${BASE_URL}/event-actions`, { params });
      if (res.data?.success) {
        setActions(res.data.data || []);
        setPagination({ totalPages: res.data.totalPages || 1, totalRecords: res.data.totalRecords || 0 });
      }
    } catch (e) { setError(e.response?.data?.message || 'Failed to load event actions.'); }
    finally { setLoading(false); }
  }, [search, statusFilter, dateRange, pageSize]);

  useEffect(() => { fetchActions(page); }, [page, fetchActions]);

  function openCancel(action) { setCancelTarget(action); setCancelReason(''); setCancelError(null); }

  async function confirmCancel() {
    if (!cancelReason.trim()) { setCancelError('Please provide a reason.'); return; }
    setCancelSubmitting(true); setCancelError(null);
    try {
      const res = await axios.patch(`${BASE_URL}/event-actions/${cancelTarget._id}`, { currentStatus: { status: 'Cancelled', description: cancelReason.trim() } });
      showSuccess(res.data?.message || 'Action cancelled successfully');
      setCancelTarget(null); fetchActions(page);
    } catch (e) {
      const msg = e.response?.data?.message || e.message;
      setCancelError(msg);
      showError(msg);
    } finally { setCancelSubmitting(false); }
  }

  const stats = {
    total: pagination.totalRecords,
    pending: actions.filter(a => a.currentStatus?.status === 'Pending').length,
    inProgress: actions.filter(a => a.currentStatus?.status === 'In Progress').length,
    completed: actions.filter(a => a.currentStatus?.status === 'Completed').length,
  };

  return (
    <div className="w-full min-h-screen flex justify-center" style={{ backgroundColor: '#F7F9FB' }}>
      <div className="w-full max-w-7xl px-3 sm:px-6 md:px-8 py-4 sm:py-6">

        <div className="mb-4 sm:mb-6">
          <h1 className="text-base sm:text-lg font-bold text-zinc-900 uppercase tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>Event Actions (Follow ups)</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>Track follow-up actions</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {[{ label: 'Total', value: stats.total, text: 'text-zinc-700' }, { label: 'Pending', value: stats.pending, text: 'text-amber-700' }, { label: 'In Progress', value: stats.inProgress, text: 'text-blue-700' }, { label: 'Completed', value: stats.completed, text: 'text-green-700' }].map(s => (
            <div key={s.label} className="bg-white border p-4" style={{ borderColor: '#E0E0E0' }}>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.text}`} style={{ fontFamily: "'Montserrat', sans-serif" }}>{s.value}</p>
            </div>
          ))}
        </div>

        <EventActionsTable
          actions={actions}
          loading={loading}
          error={error}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          pagination={pagination}
          search={search}
          setSearch={setSearch}
          dateRange={dateRange}
          setDateRange={setDateRange}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          anyFilter={search || dateRange.from || dateRange.to || statusFilter !== 'all'}
          setDetailAction={setDetailAction}
          openCancel={openCancel}
        />
      </div>

      <EventActionsCancelModal
        cancelTarget={cancelTarget}
        setCancelTarget={setCancelTarget}
        cancelReason={cancelReason}
        setCancelReason={setCancelReason}
        cancelSubmitting={cancelSubmitting}
        cancelError={cancelError}
        confirmCancel={confirmCancel}
      />

      <EventActionsDetailModal
        detailAction={detailAction}
        setDetailAction={setDetailAction}
        setViewingDoc={setViewingDoc}
        openCancel={openCancel}
      />
    </div>
  );
}
