import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FiPlus, FiSlash } from 'react-icons/fi';
import EventActionsEventPanel from './EventActionsEventPanel';
import EventActionsTable from './EventActionsTable';
import EventActionsCreateModal from './EventActionsCreateModal';
import EventActionsCancelModal from './EventActionsCancelModal';
import EventActionsDetailModal from './EventActionsDetailModal';

const BASE_URL = '/cok/api/v1';
const PRIMARY = '#056daa';
const PRIMARY_HOVER = '#248fc2';

const EMPTY_FORM = {
  title: '',
  actionDescription: '',
  assignedPerson: { name: '', role: '', institution: '' },
  dueDate: '',
  currentStatus: { status: 'Pending', description: '' },
  eventSpecialId: '',
};

export default function EventActions() {
  const navigate = useNavigate();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ totalPages: 1, totalRecords: 0 });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [detailAction, setDetailAction] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [allEvents, setAllEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventSearch, setEventSearch] = useState('');
  const [eventStatusTab, setEventStatusTab] = useState('all');
  const [eventNameMap, setEventNameMap] = useState({});
  const eventNameMapRef = useRef({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setEventsLoading(true);
      try {
        const [live, upcoming, past] = await Promise.allSettled([
          axios.get(`${BASE_URL}/events/live`, { params: { limit: 500 } }),
          axios.get(`${BASE_URL}/events/upcoming`, { params: { limit: 500 } }),
          axios.get(`${BASE_URL}/events/past`, { params: { limit: 500 } }),
        ]);
        if (cancelled) return;
        const extract = (r, statusLabel) => {
          if (r.status !== 'fulfilled') return [];
          return (r.value.data?.data || []).map(e => ({ eventSpecialId: e.eventSpecialId, eventName: e.eventName, eventDescription: e.eventDescription || '', status: statusLabel }));
        };
        const combined = [...extract(live, 'In Progress'), ...extract(upcoming, 'Pending'), ...extract(past, 'Completed')];
        setAllEvents(combined);
        const additions = {};
        combined.forEach(e => { if (e.eventSpecialId && e.eventName) additions[e.eventSpecialId] = e.eventName; });
        eventNameMapRef.current = { ...eventNameMapRef.current, ...additions };
        setEventNameMap(prev => ({ ...prev, ...additions }));
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const resolveEventNames = useCallback(async (ids) => {
    const missing = [...new Set(ids)].filter(id => id && !eventNameMapRef.current[id]);
    if (!missing.length) return;
    const results = await Promise.allSettled(
      missing.flatMap(id => {
        const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return [axios.get(`${BASE_URL}/events/live`, { params: { search: escaped, searchField: 'eventSpecialId', limit: 2 } }), axios.get(`${BASE_URL}/events/upcoming`, { params: { search: escaped, searchField: 'eventSpecialId', limit: 2 } }), axios.get(`${BASE_URL}/events/past`, { params: { search: escaped, searchField: 'eventSpecialId', limit: 2 } })];
      })
    );
    const extra = {};
    results.forEach(r => { if (r.status !== 'fulfilled') return; (r.value.data?.data || []).forEach(e => { if (e.eventSpecialId && e.eventName) extra[e.eventSpecialId] = e.eventName; }); });
    if (Object.keys(extra).length) { eventNameMapRef.current = { ...eventNameMapRef.current, ...extra }; setEventNameMap(prev => ({ ...prev, ...extra })); }
  }, []);

  const fetchActions = useCallback(async (p = 1) => {
    setLoading(true); setError(null);
    try {
      const params = { page: p, limit: pageSize };
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;
      if (selectedEvent) params.eventSpecialId = selectedEvent.eventSpecialId;
      const res = await axios.get(`${BASE_URL}/event-actions`, { params });
      if (res.data?.success) {
        const data = res.data.data || [];
        setActions(data);
        setPagination({ totalPages: res.data.totalPages || 1, totalRecords: res.data.totalRecords || 0 });
        resolveEventNames(data.map(a => a.eventSpecialId));
      }
    } catch (e) { setError(e.response?.data?.message || 'Failed to load event actions.'); }
    finally { setLoading(false); }
  }, [search, statusFilter, dateFilter, selectedEvent, pageSize, resolveEventNames]);

  useEffect(() => { fetchActions(page); }, [page, fetchActions]);

  function setField(path, value) {
    setForm(prev => { const clone = JSON.parse(JSON.stringify(prev)); const keys = path.split('.'); let cur = clone; for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]]; cur[keys[keys.length - 1]] = value; return clone; });
  }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setFormError(null);
    try { await axios.post(`${BASE_URL}/event-actions`, form); setShowModal(false); setForm(EMPTY_FORM); fetchActions(page); }
    catch (e) { setFormError(e.response?.data?.message || 'Something went wrong.'); }
    finally { setSubmitting(false); }
  }

  function openCancel(action) { setCancelTarget(action); setCancelReason(''); setCancelError(null); }

  async function confirmCancel() {
    if (!cancelReason.trim()) { setCancelError('Please provide a reason.'); return; }
    setCancelSubmitting(true); setCancelError(null);
    try { await axios.patch(`${BASE_URL}/event-actions/${cancelTarget._id}`, { currentStatus: { status: 'Cancelled', description: cancelReason.trim() } }); setCancelTarget(null); fetchActions(page); }
    catch (e) { setCancelError(e.response?.data?.message || 'Failed to cancel action.'); }
    finally { setCancelSubmitting(false); }
  }

  const stats = {
    total: pagination.totalRecords,
    pending: actions.filter(a => a.currentStatus?.status === 'Pending').length,
    inProgress: actions.filter(a => a.currentStatus?.status === 'In Progress').length,
    completed: actions.filter(a => a.currentStatus?.status === 'Completed').length,
  };

  return (
    <div className="w-full min-h-screen flex justify-center" style={{ paddingTop: '80px', backgroundColor: '#F7F9FB' }}>
      <div className="w-full max-w-7xl px-4 sm:px-6 md:px-8 py-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="px-5 py-2.5 text-white text-xs font-semibold uppercase tracking-wider rounded-none transition-colors" style={{ backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif", cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }} onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }} onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
              Go Back
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-zinc-900 uppercase tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>Event Actions</h1>
              <p className="text-xs sm:text-sm text-zinc-500 mt-0.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>Manage and track event actions</p>
            </div>
          </div>
          <button onClick={() => { setForm(EMPTY_FORM); setFormError(null); setShowModal(true); }} className="px-5 py-2.5 text-white text-xs font-semibold uppercase tracking-wider rounded-none transition-colors shrink-0" style={{ backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif", cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }} onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }} onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
            <FiPlus className="w-4 h-4 inline mr-2" /> New Action
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[{ label: 'Total', value: stats.total, text: 'text-zinc-700' }, { label: 'Pending', value: stats.pending, text: 'text-amber-700' }, { label: 'In Progress', value: stats.inProgress, text: 'text-blue-700' }, { label: 'Completed', value: stats.completed, text: 'text-green-700' }].map(s => (
            <div key={s.label} className="bg-white border p-4" style={{ borderColor: '#E0E0E0' }}>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.text}`} style={{ fontFamily: "'Montserrat', sans-serif" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Event filter + Table */}
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <EventActionsEventPanel
            allEvents={allEvents}
            eventsLoading={eventsLoading}
            eventSearch={eventSearch}
            setEventSearch={setEventSearch}
            eventStatusTab={eventStatusTab}
            setEventStatusTab={setEventStatusTab}
            selectedEvent={selectedEvent}
            setSelectedEvent={setSelectedEvent}
            setPage={setPage}
          />

          <EventActionsTable
            actions={actions}
            loading={loading}
            error={error}
            page={page}
            pageSize={pageSize}
            pagination={pagination}
            search={search}
            setSearch={setSearch}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            selectedEvent={selectedEvent}
            anyFilter={search || dateFilter || selectedEvent || statusFilter !== 'all'}
            setDetailAction={setDetailAction}
            openCancel={openCancel}
            eventNameMap={eventNameMap}
          />
        </div>
      </div>

      <EventActionsCreateModal
        showModal={showModal}
        setShowModal={setShowModal}
        form={form}
        setForm={setForm}
        setField={setField}
        formError={formError}
        submitting={submitting}
        handleSubmit={handleSubmit}
      />

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
        eventNameMap={eventNameMap}
        setViewingDoc={setViewingDoc}
        openCancel={openCancel}
      />
    </div>
  );
}
