import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FiArrowLeft, FiPlus, FiEdit2, FiTrash2, FiClock, FiCheckCircle,
  FiActivity, FiChevronDown, FiUser, FiCalendar, FiSearch,
  FiAlertCircle, FiChevronLeft, FiChevronRight, FiX, FiSlash,
} from 'react-icons/fi';
import SystemAlert from '@/core/components/SystemAlert';

const BASE_URL = '/cok/api/v1';
const PRIMARY = '#056daa';
const PRIMARY_HOVER = '#248fc2';
const NEUTRAL_LIGHT = '#F7F9FB';
const DANGER = '#E53935';

const STATUS_META = {
  Pending:       { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <FiClock className="w-3 h-3" /> },
  'In Progress': { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <FiActivity className="w-3 h-3" /> },
  Completed:     { color: 'bg-green-100 text-green-700 border-green-200', icon: <FiCheckCircle className="w-3 h-3" /> },
  Cancelled:     { color: 'bg-red-100 text-red-700 border-red-200', icon: <FiSlash className="w-3 h-3" /> },
};

function Badge({ status }) {
  const m = STATUS_META[status] || { color: 'bg-gray-100 text-gray-600 border-gray-200', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-none text-xs font-medium border ${m.color}`}>
      {m.icon}{status}
    </span>
  );
}

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function overdue(due, status) {
  return status !== 'Completed' && new Date(due) < new Date();
}

const EMPTY = (eventSpecialId) => ({
  title: '',
  actionDescription: '',
  assignedPerson: { name: '', email: '', role: '', institution: '' },
  createdBy: { name: '', email: '', role: '', institution: '' },
  dueDate: '',
  currentStatus: { status: 'Pending', description: '' },
  eventSpecialId,
});

export default function EventActionsPage() {
  const { id: eventSpecialId } = useParams();
  const navigate = useNavigate();

  const [eventTitle, setEventTitle]  = useState('');

  const [actions, setActions]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(EMPTY(eventSpecialId));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState(null);
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [viewTarget, setViewTarget]       = useState(null);
  const [systemAlert, setSystemAlert] = useState({ isOpen: false, type: 'success', message: '' });

  const [attendees, setAttendees]           = useState([]);
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [showPicker, setShowPicker]         = useState(false);

  const fetchActions = useCallback(async (p = 1) => {
    setLoading(true); setError(null);
    try {
      const res = await axios.get(`${BASE_URL}/event-actions`, {
        params: { eventSpecialId, page: p, limit: 10 },
      });
      if (res.data?.success) {
        setActions(res.data.data || []);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load actions.');
    } finally { setLoading(false); }
  }, [eventSpecialId]);

  useEffect(() => { fetchActions(page); }, [page, fetchActions]);

  useEffect(() => {
    axios
      .get(`${BASE_URL}/attendance`, { params: { eventSpecialId, limit: 200 } })
      .then(r => setAttendees(r.data?.data || []))
      .catch(() => {});
  }, [eventSpecialId]);

  /* fetch event title */
  useEffect(() => {
    const statuses = ['live', 'upcoming', 'recurring', 'past'];
    (async () => {
      for (const status of statuses) {
        try {
          const res = await axios.get(`${BASE_URL}/events/${status}`, {
            params: { search: eventSpecialId, searchField: 'eventSpecialId', limit: 1 },
          });
          const found = res.data?.data?.[0];
          if (res.data?.success && found) {
            setEventTitle(found.eventName || found.eventTitle || found.title || '');
            return;
          }
        } catch { /* try next status */ }
      }
    })();
  }, [eventSpecialId]);

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

  function openCreate() {
    setEditing(null);
    setForm(EMPTY(eventSpecialId));
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(a) {
    setEditing(a);
    setForm({
      title: a.title,
      actionDescription: a.actionDescription,
      assignedPerson: { ...a.assignedPerson },
      dueDate: a.dueDate?.slice(0, 10) ?? '',
      currentStatus: { ...a.currentStatus },
      eventSpecialId,
    });
    setFormError(null);
    setShowForm(true);
  }

  function pickAttendee(att) {
    setField('assignedPerson.name',        att.attendeeFullName   || '');
    setField('assignedPerson.role',        att.attendeePosition   || '');
    setField('assignedPerson.institution', att.attendeeInstitution || '');
    setField('assignedPerson.email',       att.attendeeEmail      || '');
    setShowPicker(false);
    setAttendeeSearch('');
  }

  const filteredAttendees = attendees.filter(a => {
    const q = attendeeSearch.toLowerCase();
    const matchesSearch = !q || a.attendeeFullName?.toLowerCase().includes(q) || a.attendeeInstitution?.toLowerCase().includes(q);
    return matchesSearch;
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true); setFormError(null);
    try {
      if (editing) {
        await axios.patch(`${BASE_URL}/event-actions/${editing._id}`, form);
      } else {
        await axios.post(`${BASE_URL}/event-actions`, form);
      }
      setShowForm(false);
      fetchActions(page);
    } catch (e) {
      setFormError(e.response?.data?.message || 'Something went wrong.');
    } finally { setSubmitting(false); }
  }

  async function confirmDelete() {
    try {
      await axios.delete(`${BASE_URL}/event-actions/${deleteTarget._id}`);
      setDeleteTarget(null);
      fetchActions(page);
    } catch { setDeleteTarget(null); }
  }

  return (
    <div className="w-full min-h-screen flex justify-center" style={{ paddingTop: '80px', backgroundColor: '#F7F9FB' }}>
      <div className="w-full max-w-5xl px-4 sm:px-6 md:px-8 py-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
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
              <h1 className="text-base sm:text-lg font-bold text-zinc-900 uppercase tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Event Actions
              </h1>
              {eventTitle && (
                <p className="text-xs sm:text-sm text-zinc-500 mt-0.5 truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {eventTitle}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={openCreate}
            className="px-5 py-2.5 text-white text-xs font-semibold uppercase tracking-wider rounded-none transition-colors shrink-0"
            style={{ backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif", cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <FiPlus className="w-4 h-4 inline mr-2" />
            New Action
          </button>
        </div>

      {/* ── Content ── */}
      <div>
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <svg className="w-10 h-10 animate-spin" style={{ color: PRIMARY }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-sm" style={{ color: '#888888', fontFamily: "'Montserrat', sans-serif" }}>Loading actions...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <FiAlertCircle className="w-10 h-10" style={{ color: DANGER }} />
            <p className="text-sm" style={{ color: '#C62828', fontFamily: "'Montserrat', sans-serif" }}>{error}</p>
          </div>
        ) : actions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24">
            <FiCheckCircle className="w-12 h-12" style={{ color: '#CCCCCC' }} />
            <p className="text-lg font-medium" style={{ color: '#888888', fontFamily: "'Montserrat', sans-serif" }}>No actions yet</p>
            <p className="text-sm" style={{ color: '#AAAAAA' }}>Click "New Action" above to create the first one.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {actions.map(a => (
                <div
                  key={a._id}
                  onClick={() => setViewTarget(a)}
                  className="bg-white border p-5 cursor-pointer transition-all"
                  style={{ borderColor: '#E0E0E0' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 12px rgba(5,109,170,0.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E0E0E0'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-zinc-900 text-base" style={{ fontFamily: "'Montserrat', sans-serif" }}>{a.title}</p>
                      <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{a.actionDescription}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setHistoryTarget(a)}
                        className="p-2 transition-colors"
                        style={{ color: '#888888' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = PRIMARY; e.currentTarget.style.backgroundColor = '#E3F2FD'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#888888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                        title="Status History"
                      ><FiActivity className="w-4 h-4" /></button>
                      <button
                        onClick={() => openEdit(a)}
                        className="p-2 transition-colors"
                        style={{ color: '#888888' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#F59E0B'; e.currentTarget.style.backgroundColor = '#FFFBEB'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#888888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                        title="Edit"
                      ><FiEdit2 className="w-4 h-4" /></button>
                      <button
                        onClick={() => setDeleteTarget(a)}
                        className="p-2 transition-colors"
                        style={{ color: '#888888' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#C62828'; e.currentTarget.style.backgroundColor = '#FFEBEE'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#888888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                        title="Delete"
                      ><FiTrash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-zinc-500 border-t pt-3" style={{ borderColor: '#E0E0E0' }}>
                    <span className="inline-flex items-center gap-1.5">
                      <FiUser className="w-3.5 h-3.5" />
                      <span className="font-medium text-zinc-700">{a.assignedPerson?.name}</span>
                      {a.assignedPerson?.role && <span className="text-zinc-400">· {a.assignedPerson.role}</span>}
                      {a.assignedPerson?.institution && <span className="text-zinc-400">· {a.assignedPerson.institution}</span>}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 ${overdue(a.dueDate, a.currentStatus?.status) ? 'text-red-500' : ''}`}>
                      <FiCalendar className="w-3.5 h-3.5" />
                      {fmt(a.dueDate)}
                      {overdue(a.dueDate, a.currentStatus?.status) && (
                        <span className="bg-red-100 text-red-600 border border-red-200 rounded-none px-2 text-xs">Overdue</span>
                      )}
                    </span>
                    <Badge status={a.currentStatus?.status} />
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-3 px-1">
                <span className="text-xs text-zinc-500" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-none"
                    style={{ borderColor: '#E0E0E0', color: '#666666' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F7F9FB'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <FiChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className="min-w-[32px] h-8 px-2 rounded-none text-sm font-medium transition-colors border"
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        backgroundColor: n === page ? PRIMARY : '#FFFFFF',
                        color: n === page ? '#FFFFFF' : '#666666',
                        borderColor: n === page ? PRIMARY : '#E0E0E0',
                      }}
                      onMouseEnter={(e) => { if (n !== page) e.currentTarget.style.backgroundColor = '#F7F9FB'; }}
                      onMouseLeave={(e) => { if (n !== page) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-none"
                    style={{ borderColor: '#E0E0E0', color: '#666666' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F7F9FB'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ borderRadius: 0 }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E0E0E0' }}>
              <h3 className="text-lg font-bold text-zinc-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {editing ? 'Edit Action' : 'New Action'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 transition-colors" style={{ color: '#888888' }}>
                <FiX className="w-5 h-5" />
              </button>
            </div>

              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                {formError && (
                  <p className="p-3 text-sm" style={{ backgroundColor: '#FFEBEE', border: '1px solid #FFCDD2', color: '#C62828', fontFamily: "'Montserrat', sans-serif" }}>{formError}</p>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>Title *</label>
                  <input
                    type="text" required maxLength={200}
                    value={form.title}
                    onChange={e => setField('title', e.target.value)}
                    placeholder="Action title"
                    className="w-full px-4 py-3 text-sm outline-none"
                    style={{
                      fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                      backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>Description *</label>
                  <textarea
                    required maxLength={2000} rows={3}
                    value={form.actionDescription}
                    onChange={e => setField('actionDescription', e.target.value)}
                    placeholder="Describe the action…"
                    className="w-full px-4 py-3 text-sm outline-none resize-none"
                    style={{
                      fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                      backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>
                      Assigned Person *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPicker(p => !p)}
                      className="inline-flex items-center gap-1 text-xs font-medium transition-colors"
                      style={{ color: PRIMARY }}
                    >
                      <FiUser className="w-3 h-3" />
                      Pick from attendees
                      <FiChevronDown className={`w-3 h-3 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {showPicker && (
                    <div className="mb-2 border overflow-hidden shadow-md" style={{ borderColor: '#E0E0E0' }}>
                      <div className="p-2 border-b" style={{ borderColor: '#E0E0E0' }}>
                        <div className="relative">
                          <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#888888' }} />
                          <input
                            type="text"
                            placeholder="Search attendees…"
                            value={attendeeSearch}
                            onChange={e => setAttendeeSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs outline-none"
                            style={{
                              fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                              backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                              boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
                            }}
                          />
                        </div>
                      </div>
                      <ul className="max-h-44 overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
                        {filteredAttendees.length === 0 ? (
                          <li className="px-4 py-3 text-xs text-center" style={{ color: '#888888' }}>
                            {attendees.length === 0 ? 'No attendance records yet' : 'No matches'}
                          </li>
                        ) : filteredAttendees.map(a => (
                          <li key={a._id}>
                            <button
                              type="button"
                              onClick={() => pickAttendee(a)}
                              className="w-full text-left px-4 py-2.5 transition-colors"
                              style={{ borderBottom: '1px solid #E0E0E0' }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F7F9FB'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-zinc-800">{a.attendeeFullName}</p>
                                {a.attendeeEmail
                                  ? <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 rounded-none px-1.5 py-0.5 shrink-0">has email</span>
                                  : <span className="text-[10px] border border-gray-200 px-1.5 py-0.5 shrink-0" style={{ backgroundColor: '#F7F9FB', color: '#888888' }}>no email</span>
                                }
                              </div>
                              <p className="text-xs text-zinc-500">{a.attendeePosition} · {a.attendeeInstitution}</p>
                              {a.attendeeEmail && <p className="text-xs mt-0.5" style={{ color: PRIMARY }}>{a.attendeeEmail}</p>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-2">
                    <input
                      type="text" required maxLength={200}
                      value={form.assignedPerson.name}
                      onChange={e => setField('assignedPerson.name', e.target.value)}
                      placeholder="Full name"
                      className="w-full px-4 py-3 text-sm outline-none"
                      style={{
                        fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                        backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
                    />
                    <input
                      type="email" maxLength={300}
                      value={form.assignedPerson.email || ''}
                      onChange={e => setField('assignedPerson.email', e.target.value)}
                      placeholder="Email address (required for My Tasks access)"
                      className="w-full px-4 py-3 text-sm outline-none"
                      style={{
                        fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                        backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text" required maxLength={200}
                        value={form.assignedPerson.role}
                        onChange={e => setField('assignedPerson.role', e.target.value)}
                        placeholder="Role / Position"
                        className="px-4 py-3 text-sm outline-none"
                        style={{
                          fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                          backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
                      />
                      <input
                        type="text" required maxLength={300}
                        value={form.assignedPerson.institution}
                        onChange={e => setField('assignedPerson.institution', e.target.value)}
                        placeholder="Institution"
                        className="px-4 py-3 text-sm outline-none"
                        style={{
                          fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                          backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>Created By (your info) *</label>
                  <div className="space-y-2">
                    <input
                      type="text" required maxLength={200}
                      value={form.createdBy?.name || ''}
                      onChange={e => setField('createdBy.name', e.target.value)}
                      placeholder="Your full name"
                      className="w-full px-4 py-3 text-sm outline-none"
                      style={{
                        fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                        backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
                    />
                    <input
                      type="email" maxLength={300}
                      value={form.createdBy?.email || ''}
                      onChange={e => setField('createdBy.email', e.target.value)}
                      placeholder="Your email address"
                      className="w-full px-4 py-3 text-sm outline-none"
                      style={{
                        fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                        backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text" maxLength={200}
                        value={form.createdBy?.role || ''}
                        onChange={e => setField('createdBy.role', e.target.value)}
                        placeholder="Your role"
                        className="px-4 py-3 text-sm outline-none"
                        style={{
                          fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                          backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
                      />
                      <input
                        type="text" maxLength={300}
                        value={form.createdBy?.institution || ''}
                        onChange={e => setField('createdBy.institution', e.target.value)}
                        placeholder="Your institution"
                        className="px-4 py-3 text-sm outline-none"
                        style={{
                          fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                          backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
                      />
                    </div>
                  </div>
                </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>Due Date *</label>
                <input
                  type="date" required
                  value={form.dueDate}
                  onChange={e => setField('dueDate', e.target.value)}
                  className="w-full px-4 py-3 text-sm outline-none"
                  style={{
                    fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                    backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>Status *</label>
                <div className="space-y-2">
                  <select
                    value={form.currentStatus.status}
                    onChange={e => setField('currentStatus.status', e.target.value)}
                    className="w-full px-4 py-3 text-sm outline-none"
                    style={{
                      fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                      backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
                  >
                    <option>Pending</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                  </select>
                  <textarea
                    required maxLength={1000} rows={2}
                    value={form.currentStatus.description}
                    onChange={e => setField('currentStatus.description', e.target.value)}
                    placeholder="Status note…"
                    className="w-full px-4 py-3 text-sm outline-none resize-none"
                    style={{
                      fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: 500, color: '#333333',
                      backgroundColor: NEUTRAL_LIGHT, borderRadius: 0, border: '1px solid transparent',
                      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)'; }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: '#E0E0E0' }}>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium border transition-colors"
                  style={{ borderColor: '#E0E0E0', color: '#666666', fontFamily: "'Montserrat', sans-serif" }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold text-white rounded-none transition-colors disabled:opacity-60"
                  style={{ backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>
                  {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[99999999999999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white shadow-2xl w-full max-w-sm p-6" style={{ borderRadius: 0 }}>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 border" style={{ backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' }}><FiTrash2 className="w-5 h-5" style={{ color: DANGER }} /></div>
              <div>
                <h3 className="font-bold text-zinc-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Delete Action</h3>
                <p className="text-sm text-zinc-500 mt-1">
                  Delete <span className="font-semibold">"{deleteTarget.title}"</span>? This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium border transition-colors" style={{ borderColor: '#E0E0E0', color: '#666666', fontFamily: "'Montserrat', sans-serif" }}>Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm font-semibold text-white rounded-none transition-colors" style={{ backgroundColor: DANGER, fontFamily: "'Montserrat', sans-serif" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION DETAIL MODAL */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setViewTarget(null)}>
          <div
            className="bg-white shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            style={{ borderRadius: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10" style={{ borderColor: '#E0E0E0' }}>
              <h2 className="text-base font-bold text-zinc-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Action Details</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { openEdit(viewTarget); setViewTarget(null); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border transition-colors"
                  style={{ borderColor: '#F59E0B33', color: '#B45309', backgroundColor: '#FFFBEB' }}
                >
                  <FiEdit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => { setDeleteTarget(viewTarget); setViewTarget(null); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border transition-colors"
                  style={{ borderColor: '#FFCDD2', color: '#C62828', backgroundColor: '#FFEBEE' }}
                >
                  <FiTrash2 className="w-3.5 h-3.5" /> Delete
                </button>
                <button onClick={() => setViewTarget(null)} className="p-2 transition-colors" style={{ color: '#888888' }}>
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-6 space-y-5">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 leading-snug" style={{ fontFamily: "'Montserrat', sans-serif" }}>{viewTarget.title}</h3>
                <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{viewTarget.actionDescription}</p>
              </div>

              <div className="flex items-start justify-between gap-3 p-4 border" style={{ backgroundColor: NEUTRAL_LIGHT, borderColor: '#E0E0E0' }}>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY }}>Current Status</p>
                  <Badge status={viewTarget.currentStatus?.status} />
                  {viewTarget.currentStatus?.description && (
                    <p className="text-sm text-zinc-600 mt-2">{viewTarget.currentStatus.description}</p>
                  )}
                </div>
                {overdue(viewTarget.dueDate, viewTarget.currentStatus?.status) && (
                  <span className="border px-3 py-1 text-xs font-semibold shrink-0" style={{ borderColor: '#FFCDD2', color: '#C62828', backgroundColor: '#FFEBEE' }}>Overdue</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border" style={{ backgroundColor: NEUTRAL_LIGHT, borderColor: '#E0E0E0' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY }}>Assigned To</p>
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 flex items-center justify-center shrink-0 border" style={{ backgroundColor: '#E3F2FD', borderColor: '#B3E5FC' }}>
                      <FiUser className="w-3.5 h-3.5" style={{ color: PRIMARY }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-800 text-sm truncate">{viewTarget.assignedPerson?.name || '—'}</p>
                      {viewTarget.assignedPerson?.role && <p className="text-xs text-zinc-500 truncate">{viewTarget.assignedPerson.role}</p>}
                      {viewTarget.assignedPerson?.institution && <p className="text-xs text-zinc-400 truncate">{viewTarget.assignedPerson.institution}</p>}
                    </div>
                  </div>
                </div>

                <div className="p-4 border" style={{ backgroundColor: NEUTRAL_LIGHT, borderColor: '#E0E0E0' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: PRIMARY }}>Due Date</p>
                  <div className="flex items-center gap-2">
                    <FiCalendar className={`w-4 h-4 shrink-0 ${overdue(viewTarget.dueDate, viewTarget.currentStatus?.status) ? '' : ''}`} style={{ color: overdue(viewTarget.dueDate, viewTarget.currentStatus?.status) ? DANGER : '#888888' }} />
                    <span className={`font-semibold text-sm ${overdue(viewTarget.dueDate, viewTarget.currentStatus?.status) ? '' : ''}`} style={{ color: overdue(viewTarget.dueDate, viewTarget.currentStatus?.status) ? '#C62828' : '#333333' }}>
                      {fmt(viewTarget.dueDate)}
                    </span>
                  </div>
                </div>
              </div>

              {viewTarget.statusHistory?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: PRIMARY }}>Status History</p>
                  <ol className="relative ml-2 space-y-4" style={{ borderLeft: '2px solid #E0E0E0' }}>
                    {[...viewTarget.statusHistory].reverse().map((h, i) => (
                      <li key={i} className="ml-5">
                        <span className="absolute -left-2 w-4 h-4 border-2 bg-white" style={{ borderColor: PRIMARY }} />
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge status={h.status} />
                          <span className="text-xs text-zinc-500">{fmt(h.changedAt)}</span>
                        </div>
                        <p className="text-sm text-zinc-600">{h.description}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: PRIMARY }}>Event</p>
                <p className="text-sm text-zinc-700 px-3 py-2 border" style={{ backgroundColor: NEUTRAL_LIGHT, borderColor: '#E0E0E0' }}>{eventTitle || viewTarget.eventSpecialId}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATUS HISTORY */}
      {historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto" style={{ borderRadius: 0 }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E0E0E0' }}>
              <h3 className="font-bold text-zinc-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Status History</h3>
              <button onClick={() => setHistoryTarget(null)} className="p-1.5 transition-colors" style={{ color: '#888888' }}>
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm font-semibold text-zinc-700 mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>{historyTarget.title}</p>
              {historyTarget.statusHistory?.length ? (
                <ol className="relative ml-2 space-y-5" style={{ borderLeft: '2px solid #E0E0E0' }}>
                  {[...historyTarget.statusHistory].reverse().map((h, i) => (
                    <li key={i} className="ml-5">
                      <span className="absolute -left-2 w-4 h-4 border-2 bg-white" style={{ borderColor: PRIMARY }} />
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge status={h.status} />
                        <span className="text-xs text-zinc-500">{fmt(h.changedAt)}</span>
                      </div>
                      <p className="text-sm text-zinc-600">{h.description}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-center py-8" style={{ color: '#888888' }}>No history recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
