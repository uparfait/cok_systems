import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  FiPlus, FiSearch, FiX,
  FiClock, FiCheckCircle, FiAlertCircle, FiChevronDown,
  FiChevronLeft, FiChevronRight, FiUser, FiCalendar, FiActivity,
  FiSlash, FiFilter, FiPaperclip, FiFileText, FiDownload, FiEye,
  FiMaximize2,
} from 'react-icons/fi';
import SpiralLoader from './SpiralLoader';

/* ══════════════════════════════════════════════════════════
   IN-APP FILE VIEWER
   Opens images inline, PDFs in iframe, others as download card
═══════════════════════════════════════════════════════════ */
function FileViewer({ doc, onClose }) {
  if (!doc) return null;
  const mime = doc.mimetype || '';
  const url  = doc.url;
  const name = doc.originalName || doc.filename || 'Document';
  const isImage = mime.startsWith('image/');
  const isPdf   = mime === 'application/pdf';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white roundeded-2xl shadow-2xl flex flex-col overflow-hidden w-full max-w-4xl max-h-[92vh]">
        {/* header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 shrink-0">
          <FiPaperclip className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-800 truncate flex-1" title={name}>{name}</span>
          <a
            href={url}
            download={name}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 roundeded-lg hover:bg-gray-50 transition-colors"
          >
            <FiDownload className="w-3.5 h-3.5" /> Download
          </a>
          <button onClick={onClose} className="p-1.5 roundeded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* content */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center min-h-0">
          {isImage ? (
            <img
              src={url}
              alt={name}
              className="max-w-full max-h-full object-contain roundeded"
            />
          ) : isPdf ? (
            <iframe
              src={url}
              title={name}
              className="w-full h-full border-0"
              style={{ minHeight: '70vh' }}
            />
          ) : (
            /* Word / Excel / other — can't render in browser */
            <div className="text-center p-10">
              <div className="w-16 h-16 bg-blue-100 roundeded-2xl flex items-center justify-center mx-auto mb-4">
                <FiFileText className="w-8 h-8 text-blue-500" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">{name}</p>
              <p className="text-xs text-gray-400 mb-5">This file type cannot be previewed in the browser.</p>
              <a
                href={url}
                download={name}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold roundeded-lg transition-colors shadow"
              >
                <FiDownload className="w-4 h-4" /> Download file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── document attachment chip ────────────────────────────── */
function DocChip({ doc, onView }) {
  if (!doc?.url) return null;
  const name = doc.originalName || doc.filename || 'Document';
  const mime = doc.mimetype || '';
  const isImage = mime.startsWith('image/');
  const isPdf   = mime === 'application/pdf';
  const canPreview = isImage || isPdf;

  return (
    <button
      onClick={() => onView(doc)}
      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 roundeded-lg px-2.5 py-1.5 transition-colors"
    >
      <FiPaperclip className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate max-w-[180px]">{name}</span>
      {canPreview
        ? <FiEye className="w-3 h-3 shrink-0 opacity-60" />
        : <FiDownload className="w-3 h-3 shrink-0 opacity-60" />}
    </button>
  );
}

const BASE_URL = '/cok/api/v1';

/* ── status meta ──────────────────────────────────────────── */
const STATUS_META = {
  Pending:       { color: 'bg-amber-100 text-amber-700 border-amber-200',  icon: <FiClock        className="w-3 h-3" /> },
  'In Progress': { color: 'bg-blue-100  text-blue-700  border-blue-200',   icon: <FiActivity     className="w-3 h-3" /> },
  Completed:     { color: 'bg-green-100 text-green-700 border-green-200',  icon: <FiCheckCircle  className="w-3 h-3" /> },
  Cancelled:     { color: 'bg-red-100   text-red-700   border-red-200',    icon: <FiSlash        className="w-3 h-3" /> },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { color: 'bg-gray-100 text-gray-600 border-gray-200', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 roundeded-full text-xs font-medium border ${meta.color}`}>
      {meta.icon}{status}
    </span>
  );
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(dueDate, status) {
  return status !== 'Completed' && status !== 'Cancelled' && new Date(dueDate) < new Date();
}

const EMPTY_FORM = {
  title: '',
  actionDescription: '',
  assignedPerson: { name: '', role: '', institution: '' },
  dueDate: '',
  currentStatus: { status: 'Pending', description: '' },
  eventSpecialId: '',
};

/* ══════════════════════════════════════════════════════════ */
export default function EventActions() {
  const [actions, setActions]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  /* filters */
  const [search, setSearch]             = useState('');
  const [dateFilter, setDateFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null); // {eventSpecialId, eventName}

  /* pagination */
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(10);
  const [pagination, setPagination] = useState({ totalPages: 1, totalRecords: 0 });

  /* create modal */
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState(null);

  /* detail / history modal */
  const [detailAction, setDetailAction] = useState(null);

  /* in-app file viewer */
  const [viewingDoc, setViewingDoc] = useState(null);

  /* cancel modal */
  const [cancelTarget, setCancelTarget]         = useState(null);
  const [cancelReason, setCancelReason]         = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError]           = useState(null);

  /* event filter panel */
  const [allEvents, setAllEvents]       = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventSearch, setEventSearch]   = useState('');
  const [eventStatusTab, setEventStatusTab] = useState('all');
  const [eventNameMap, setEventNameMap] = useState({});
  const eventNameMapRef = useRef({});

  /* ── fetch ALL events once on mount ── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setEventsLoading(true);
      try {
        const [live, upcoming, past] = await Promise.allSettled([
          axios.get(`${BASE_URL}/events/live`,     { params: { limit: 500 } }),
          axios.get(`${BASE_URL}/events/upcoming`, { params: { limit: 500 } }),
          axios.get(`${BASE_URL}/events/past`,     { params: { limit: 500 } }),
        ]);
        if (cancelled) return;

        const extract = (r, statusLabel) => {
          if (r.status !== 'fulfilled') return [];
          return (r.value.data?.data || []).map(e => ({
            eventSpecialId:   e.eventSpecialId,
            eventName:        e.eventName,
            eventDescription: e.eventDescription || '',
            status:           statusLabel,
          }));
        };

        const combined = [
          ...extract(live,     'In Progress'),
          ...extract(upcoming, 'Pending'),
          ...extract(past,     'Completed'),
        ];

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

  /* ── resolve event names missing from the map after an actions page loads ── */
  const resolveEventNames = useCallback(async (ids) => {
    const missing = [...new Set(ids)].filter(id => id && !eventNameMapRef.current[id]);
    if (!missing.length) return;

    // For each unknown ID try a direct search across all collections
    const results = await Promise.allSettled(
      missing.flatMap(id => {
        const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return [
          axios.get(`${BASE_URL}/events/live`,     { params: { search: escaped, searchField: 'eventSpecialId', limit: 2 } }),
          axios.get(`${BASE_URL}/events/upcoming`, { params: { search: escaped, searchField: 'eventSpecialId', limit: 2 } }),
          axios.get(`${BASE_URL}/events/past`,     { params: { search: escaped, searchField: 'eventSpecialId', limit: 2 } }),
        ];
      })
    );

    const extra = {};
    results.forEach(r => {
      if (r.status !== 'fulfilled') return;
      (r.value.data?.data || []).forEach(e => {
        if (e.eventSpecialId && e.eventName) extra[e.eventSpecialId] = e.eventName;
      });
    });

    if (Object.keys(extra).length) {
      eventNameMapRef.current = { ...eventNameMapRef.current, ...extra };
      setEventNameMap(prev => ({ ...prev, ...extra }));
    }
  }, []);

  /* ── fetch actions ── */
  const fetchActions = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: p, limit: pageSize };
      if (search)                 params.search         = search;
      if (statusFilter !== 'all') params.status         = statusFilter;
      if (dateFilter)             params.date           = dateFilter;
      if (selectedEvent)          params.eventSpecialId = selectedEvent.eventSpecialId;
      const res = await axios.get(`${BASE_URL}/event-actions`, { params });
      if (res.data?.success) {
        const data = res.data.data || [];
        setActions(data);
        setPagination({ totalPages: res.data.totalPages || 1, totalRecords: res.data.totalRecords || 0 });
        resolveEventNames(data.map(a => a.eventSpecialId));
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load event actions.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, dateFilter, selectedEvent, pageSize, resolveEventNames]);

  useEffect(() => { fetchActions(page); }, [page, fetchActions]);

  /* ── form helpers ── */
  function setField(path, value) {
    setForm(prev => {
      const clone = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let cur = clone;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return clone;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await axios.post(`${BASE_URL}/event-actions`, form);
      setShowModal(false);
      fetchActions(page);
    } catch (e) {
      setFormError(e.response?.data?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  /* ── cancel ── */
  function openCancel(action) {
    setCancelTarget(action);
    setCancelReason('');
    setCancelError(null);
  }

  async function confirmCancel() {
    if (!cancelReason.trim()) { setCancelError('Please provide a reason.'); return; }
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      await axios.patch(`${BASE_URL}/event-actions/${cancelTarget._id}`, {
        currentStatus: { status: 'Cancelled', description: cancelReason.trim() },
      });
      setCancelTarget(null);
      fetchActions(page);
    } catch (e) {
      setCancelError(e.response?.data?.message || 'Failed to cancel action.');
    } finally {
      setCancelSubmitting(false);
    }
  }

  /* ── stats ── */
  const stats = {
    total:      pagination.totalRecords,
    pending:    actions.filter(a => a.currentStatus?.status === 'Pending').length,
    inProgress: actions.filter(a => a.currentStatus?.status === 'In Progress').length,
    completed:  actions.filter(a => a.currentStatus?.status === 'Completed').length,
  };

  /* ── event panel: filter client-side (all events already in memory) ── */
  const filteredEvents = allEvents.filter(ev => {
    const q = eventSearch.trim().toLowerCase();
    const matchSearch = !q ||
      ev.eventName.toLowerCase().includes(q) ||
      ev.eventDescription.toLowerCase().includes(q);
    const matchTab = eventStatusTab === 'all' || ev.status === eventStatusTab;
    return matchSearch && matchTab;
  });

  const anyFilter = search || dateFilter || selectedEvent || statusFilter !== 'all';

  /* ══ RENDER ══════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* ── header ── */}
      {/* <div className="mb-6">
        <button
          onClick={() => { setForm(EMPTY_FORM); setFormError(null); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold roundeded-lg shadow transition-colors"
        >
          <FiPlus className="w-4 h-4" /> New Action
        </button>
      </div> */}

      {/* ── stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total',       value: stats.total,      color: 'bg-white border-gray-200',     text: 'text-gray-700'  },
          { label: 'Pending',     value: stats.pending,    color: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
          { label: 'In Progress', value: stats.inProgress, color: 'bg-blue-50  border-blue-200',  text: 'text-blue-700'  },
          { label: 'Completed',   value: stats.completed,  color: 'bg-green-50 border-green-200', text: 'text-green-700' },
        ].map(s => (
          <div key={s.label} className={`${s.color} border roundeded-xl p-4 shadow-sm`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════
          TWO-COLUMN LAYOUT: Event Panel  |  Table
      ═══════════════════════════════════════════════════════ */}
      <div className="flex gap-5 items-start">

        {/* ── LEFT: Event filter panel (always visible) ── */}
        <div className="w-72 shrink-0 bg-white border border-gray-200 roundeded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <FiFilter className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-gray-700">Filter by Event</span>
            {selectedEvent && (
              <button
                onClick={() => { setSelectedEvent(null); setPage(1); }}
                className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <FiX className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {/* event search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search events…"
                value={eventSearch}
                onChange={e => setEventSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 roundeded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
              />
              {eventSearch && (
                <button onClick={() => setEventSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <FiX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* status tabs */}
          <div className="grid grid-cols-4 border-b border-gray-100 text-[11px] font-medium">
            {[
              { key: 'all',         label: 'All' },
              { key: 'Pending',     label: 'Pending' },
              { key: 'In Progress', label: 'Active' },
              { key: 'Completed',   label: 'Done' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setEventStatusTab(tab.key)}
                className={`py-2 transition-colors ${
                  eventStatusTab === tab.key
                    ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* event list */}
          <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
            {eventsLoading ? (
              <div className="flex justify-center py-8"><SpiralLoader /></div>
            ) : filteredEvents.length === 0 ? (
              <div className="py-10 text-center text-gray-400">
                <p className="text-sm">No events found</p>
              </div>
            ) : (
              filteredEvents.map(ev => {
                const isActive = selectedEvent?.eventSpecialId === ev.eventSpecialId;
                return (
                  <button
                    key={ev.eventSpecialId}
                    onClick={() => { setSelectedEvent({ eventSpecialId: ev.eventSpecialId, eventName: ev.eventName }); setPage(1); }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 transition-colors ${
                      isActive ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                      {ev.eventName}
                    </p>
                    {ev.eventDescription && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{ev.eventDescription}</p>
                    )}
                    <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 roundeded-full text-[10px] font-medium border ${STATUS_META[ev.status]?.color || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {ev.status}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT: Filters + Table ── */}
        <div className="flex-1 min-w-0">

          {/* filters bar */}
          <div className="bg-white roundeded-xl border border-gray-200 shadow-sm px-4 py-3 mb-4">
            <div className="flex flex-wrap items-center gap-3">

              {/* search */}
              <div className="relative w-44">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Search title, person…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 roundeded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
                />
                {search && (
                  <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <FiX className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* date filter */}
              <div className="flex items-center gap-1.5">
                <FiCalendar className="text-gray-400 w-3.5 h-3.5 shrink-0" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={e => { setDateFilter(e.target.value); setPage(1); }}
                  title="Filter by due date"
                  className="py-1.5 px-2 text-sm border border-gray-200 roundeded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
                />
                {dateFilter && (
                  <button onClick={() => { setDateFilter(''); setPage(1); }} className="text-gray-400 hover:text-gray-600">
                    <FiX className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* status */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                  className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-gray-200 roundeded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5 pointer-events-none" />
              </div>

              {anyFilter && (
                <button
                  onClick={() => { setSearch(''); setDateFilter(''); setSelectedEvent(null); setStatusFilter('all'); setPage(1); }}
                  className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <FiX className="w-3 h-3" /> Clear all
                </button>
              )}
            </div>

            {/* active event chip */}
            {selectedEvent && (
              <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
                <FiFilter className="w-3 h-3" />
                Showing actions for: <strong>{selectedEvent.eventName}</strong>
              </div>
            )}
          </div>

          {/* ── table ── */}
          {loading ? (
            <div className="flex justify-center py-20"><SpiralLoader /></div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 roundeded-xl p-6 text-center">
              <FiAlertCircle className="mx-auto mb-2 w-6 h-6" />{error}
            </div>
          ) : actions.length === 0 ? (
            <div className="bg-white border border-gray-200 roundeded-xl p-16 text-center text-gray-400">
              <FiCheckCircle className="mx-auto mb-3 w-10 h-10 opacity-30" />
              <p className="font-medium">No actions found</p>
              <p className="text-sm mt-1">Create one or adjust your filters</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 roundeded-xl shadow-sm overflow-hidden">

              {/* scrollable table body */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      {['#', 'Title', 'Assigned To', 'Due Date', 'Status', 'Event', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                </table>
                {/* separate scrollable body */}
                <div className="overflow-y-auto" style={{ maxHeight: '480px' }}>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {actions.map((action, idx) => (
                        <tr
                          key={action._id}
                          onClick={() => setDetailAction(action)}
                          className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                        >
                          {/* Row number */}
                          <td className="px-4 py-3 w-10 text-xs text-gray-400 font-mono">
                            {(page - 1) * pageSize + idx + 1}
                          </td>

                          {/* Title */}
                          <td className="px-4 py-3 max-w-[200px]">
                            <p className="font-semibold text-gray-900 truncate">{action.title}</p>
                            <p className="text-xs text-gray-400 truncate mt-0.5">{action.actionDescription}</p>
                          </td>

                          {/* Assigned */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-medium text-gray-800">{action.assignedPerson?.name}</p>
                            <p className="text-xs text-gray-400">{action.assignedPerson?.role}</p>
                            <p className="text-xs text-gray-400 italic">{action.assignedPerson?.institution}</p>
                          </td>

                          {/* Due date */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${isOverdue(action.dueDate, action.currentStatus?.status) ? 'text-red-600' : 'text-gray-600'}`}>
                              <FiCalendar className="w-3 h-3" />
                              {formatDate(action.dueDate)}
                            </span>
                            {isOverdue(action.dueDate, action.currentStatus?.status) && (
                              <span className="mt-0.5 block bg-red-100 text-red-600 border border-red-200 roundeded-full px-1.5 text-[10px] w-fit">Overdue</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <StatusBadge status={action.currentStatus?.status} />
                            <p className="text-xs text-gray-400 mt-0.5 max-w-[130px] truncate">{action.currentStatus?.description}</p>
                          </td>

                          {/* Event name */}
                          <td className="px-4 py-3 max-w-[160px]">
                            {eventNameMap[action.eventSpecialId] ? (
                              <p className="text-sm font-medium text-gray-800 truncate" title={eventNameMap[action.eventSpecialId]}>
                                {eventNameMap[action.eventSpecialId]}
                              </p>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Loading…</span>
                            )}
                          </td>

                          {/* Actions — stop propagation so cancel click doesn't open detail */}
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setDetailAction(action)}
                                title="View details"
                                className="p-1.5 roundeded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              >
                                <FiEye className="w-4 h-4" />
                              </button>
                              {action.currentStatus?.status !== 'Cancelled' && (
                                <button
                                  onClick={() => openCancel(action)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 roundeded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 transition-colors shadow-sm"
                                >
                                  <FiSlash className="w-3.5 h-3.5" /> Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Paginator ── */}
              <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">

                {/* left: record info + page-size picker */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {pagination.totalRecords === 0 ? 'No records' : (
                      <>
                        <span className="font-medium text-gray-700">
                          {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, pagination.totalRecords)}
                        </span>
                        {' '}of <span className="font-medium text-gray-700">{pagination.totalRecords}</span> records
                      </>
                    )}
                  </span>
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="text-xs border border-gray-200 roundeded-lg px-2 py-1 bg-gray-50 focus:outline-none focus:border-blue-400"
                  >
                    {[5, 10, 20, 50].map(n => (
                      <option key={n} value={n}>{n} / page</option>
                    ))}
                  </select>
                </div>

                {/* right: numbered page buttons */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    {/* Prev */}
                    <button
                      onClick={() => setPage(p => p - 1)}
                      disabled={page === 1}
                      className="p-1.5 roundeded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <FiChevronLeft className="w-4 h-4" />
                    </button>

                    {/* Page numbers */}
                    {(() => {
                      const total = pagination.totalPages;
                      const delta = 2;
                      const range = [];
                      for (let i = Math.max(1, page - delta); i <= Math.min(total, page + delta); i++) range.push(i);
                      const pages = [];
                      if (range[0] > 1) {
                        pages.push(1);
                        if (range[0] > 2) pages.push('…');
                      }
                      range.forEach(n => pages.push(n));
                      if (range[range.length - 1] < total) {
                        if (range[range.length - 1] < total - 1) pages.push('…');
                        pages.push(total);
                      }
                      return pages.map((n, i) =>
                        n === '…' ? (
                          <span key={`ellipsis-${i}`} className="px-1.5 text-gray-400 text-sm select-none">…</span>
                        ) : (
                          <button
                            key={n}
                            onClick={() => setPage(n)}
                            className={`min-w-[32px] h-8 px-2 roundeded-lg text-sm font-medium transition-colors ${
                              page === n
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {n}
                          </button>
                        )
                      );
                    })()}

                    {/* Next */}
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page === pagination.totalPages}
                      className="p-1.5 roundeded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ CREATE MODAL ═══════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white roundeded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">New Event Action</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 roundeded-lg hover:bg-gray-100 text-gray-400">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm roundeded-lg px-4 py-2">{formError}</div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Title *</label>
                <input type="text" required maxLength={200} value={form.title}
                  onChange={e => setField('title', e.target.value)} placeholder="Action title"
                  className="w-full px-3 py-2 text-sm border border-gray-200 roundeded-lg focus:outline-none focus:border-blue-400 bg-gray-50" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Description *</label>
                <textarea required maxLength={2000} rows={3} value={form.actionDescription}
                  onChange={e => setField('actionDescription', e.target.value)} placeholder="Describe the action…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 roundeded-lg focus:outline-none focus:border-blue-400 bg-gray-50 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  <FiUser className="inline w-3 h-3 mr-1" />Assigned Person *
                </label>
                <div className="space-y-2">
                  <input type="text" required maxLength={200} value={form.assignedPerson.name}
                    onChange={e => setField('assignedPerson.name', e.target.value)} placeholder="Full name"
                    className="w-full px-3 py-2 text-sm border border-gray-200 roundeded-lg focus:outline-none focus:border-blue-400 bg-gray-50" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" required maxLength={200} value={form.assignedPerson.role}
                      onChange={e => setField('assignedPerson.role', e.target.value)} placeholder="Role"
                      className="px-3 py-2 text-sm border border-gray-200 roundeded-lg focus:outline-none focus:border-blue-400 bg-gray-50" />
                    <input type="text" required maxLength={300} value={form.assignedPerson.institution}
                      onChange={e => setField('assignedPerson.institution', e.target.value)} placeholder="Institution"
                      className="px-3 py-2 text-sm border border-gray-200 roundeded-lg focus:outline-none focus:border-blue-400 bg-gray-50" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    <FiCalendar className="inline w-3 h-3 mr-1" />Due Date *
                  </label>
                  <input type="date" required value={form.dueDate}
                    onChange={e => setField('dueDate', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 roundeded-lg focus:outline-none focus:border-blue-400 bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Event ID *</label>
                  <input type="text" required value={form.eventSpecialId}
                    onChange={e => setField('eventSpecialId', e.target.value)} placeholder="EVT-001"
                    className="w-full px-3 py-2 text-sm border border-gray-200 roundeded-lg focus:outline-none focus:border-blue-400 bg-gray-50" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Status *</label>
                <div className="space-y-2">
                  <select value={form.currentStatus.status}
                    onChange={e => setField('currentStatus.status', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 roundeded-lg focus:outline-none focus:border-blue-400 bg-gray-50">
                    <option>Pending</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                  </select>
                  <textarea required maxLength={1000} rows={2} value={form.currentStatus.description}
                    onChange={e => setField('currentStatus.description', e.target.value)} placeholder="Status note…"
                    className="w-full px-3 py-2 text-sm border border-gray-200 roundeded-lg focus:outline-none focus:border-blue-400 bg-gray-50 resize-none" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 roundeded-lg transition-colors">
                  Discard
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white roundeded-lg transition-colors disabled:opacity-60">
                  {submitting ? 'Saving…' : 'Create Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ CANCEL MODAL ═══════════════════════════════════════ */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white roundeded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="p-2.5 bg-red-100 roundeded-xl shrink-0">
                <FiSlash className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Cancel Action</h3>
                <p className="text-sm text-gray-500 mt-1">
                  You are about to cancel <span className="font-semibold text-gray-800">"{cancelTarget.title}"</span>.
                  This action will be marked as cancelled.
                </p>
              </div>
            </div>

            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Reason for cancellation *
            </label>
            <textarea
              rows={4}
              autoFocus
              placeholder="Explain why this action is being cancelled…"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              maxLength={1000}
              className="w-full px-3 py-2 text-sm border border-gray-200 roundeded-lg focus:outline-none focus:border-red-400 bg-gray-50 resize-none mb-2"
            />
            <p className="text-xs text-gray-400 mb-4 text-right">{cancelReason.length}/1000</p>

            {cancelError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs roundeded-lg px-3 py-2 mb-4">
                {cancelError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 roundeded-lg transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelSubmitting || !cancelReason.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white roundeded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow"
              >
                <FiSlash className="w-4 h-4" />
                {cancelSubmitting ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ACTION DETAIL MODAL ════════════════════════════════ */}
      {detailAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white roundeded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

            {/* header */}
            <div className="flex items-start gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900 truncate">{detailAction.title}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {eventNameMap[detailAction.eventSpecialId] || <span className="italic">Loading event name…</span>}
                </p>
              </div>
              <StatusBadge status={detailAction.currentStatus?.status} />
              <button onClick={() => setDetailAction(null)} className="p-1.5 roundeded-lg hover:bg-gray-100 text-gray-400 shrink-0">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

              {/* description */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed">{detailAction.actionDescription}</p>
              </div>

              {/* meta grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 roundeded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <FiUser className="w-3 h-3" /> Assigned To
                  </p>
                  <p className="text-sm font-medium text-gray-800">{detailAction.assignedPerson?.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{detailAction.assignedPerson?.role}</p>
                  <p className="text-xs text-gray-400 italic">{detailAction.assignedPerson?.institution}</p>
                </div>
                <div className="bg-gray-50 roundeded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <FiCalendar className="w-3 h-3" /> Due Date
                  </p>
                  <p className={`text-sm font-semibold ${isOverdue(detailAction.dueDate, detailAction.currentStatus?.status) ? 'text-red-600' : 'text-gray-800'}`}>
                    {formatDate(detailAction.dueDate)}
                  </p>
                  {isOverdue(detailAction.dueDate, detailAction.currentStatus?.status) && (
                    <span className="mt-1 inline-block bg-red-100 text-red-600 border border-red-200 roundeded-full px-2 py-0.5 text-[10px] font-medium">Overdue</span>
                  )}
                </div>
              </div>

              {/* current status note */}
              {detailAction.currentStatus?.description && (
                <div className="bg-blue-50 border border-blue-100 roundeded-xl p-3">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Current Status Note</p>
                  <p className="text-sm text-blue-800">{detailAction.currentStatus.description}</p>
                </div>
              )}

              {/* status history timeline */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                  <FiActivity className="w-3 h-3" /> Status History
                </p>
                {detailAction.statusHistory?.length ? (
                  <ol className="relative border-l-2 border-gray-200 ml-2 space-y-5">
                    {[...detailAction.statusHistory].reverse().map((h, i) => (
                      <li key={i} className="ml-5 relative">
                        <span className="absolute -left-[1.45rem] top-1 w-4 h-4 bg-white border-2 border-blue-400 rounded-full" />
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <StatusBadge status={h.status} />
                          <span className="text-xs text-gray-400">
                            {h.changedAt ? new Date(h.changedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{h.description}</p>
                        {/* attached document */}
                        <DocChip doc={h.document} onView={setViewingDoc} />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4 italic">No history recorded yet.</p>
                )}
              </div>
            </div>

            {/* footer */}
            <div className="px-6 py-3 border-t border-gray-100 shrink-0 flex justify-between items-center">
              {detailAction.currentStatus?.status !== 'Cancelled' && (
                <button
                  onClick={() => { setDetailAction(null); openCancel(detailAction); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 roundeded-lg transition-colors shadow-sm"
                >
                  <FiSlash className="w-4 h-4" /> Cancel Action
                </button>
              )}
              <button onClick={() => setDetailAction(null)} className="ml-auto px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 roundeded-lg transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ IN-APP FILE VIEWER ═════════════════════════════════ */}
      <FileViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />
    </div>
  );
}
