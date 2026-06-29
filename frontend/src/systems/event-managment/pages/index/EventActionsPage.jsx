import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FiArrowLeft, FiPlus, FiEdit2, FiTrash2, FiClock, FiCheckCircle,
  FiActivity, FiChevronDown, FiUser, FiCalendar, FiSearch,
  FiAlertCircle, FiChevronLeft, FiChevronRight, FiX,
} from 'react-icons/fi';

const BASE_URL = '/cok/api/v1';

const STATUS_META = {
  Pending:       { cls: 'bg-amber-100 text-amber-700 border-amber-200',  icon: <FiClock        className="w-3 h-3" /> },
  'In Progress': { cls: 'bg-blue-100  text-blue-700  border-blue-200',   icon: <FiActivity     className="w-3 h-3" /> },
  Completed:     { cls: 'bg-green-100 text-green-700 border-green-200',  icon: <FiCheckCircle  className="w-3 h-3" /> },
};

function Badge({ status }) {
  const m = STATUS_META[status] || { cls: 'bg-gray-100 text-gray-600 border-gray-200', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${m.cls}`}>
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
    const sources = [
      axios.get(`${BASE_URL}/live-events`),
      axios.get(`${BASE_URL}/upcoming-events`),
      axios.get(`${BASE_URL}/past-events`),
    ];
    Promise.allSettled(sources).then(results => {
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        const list = r.value?.data?.data || [];
        const found = list.find(e => e.eventSpecialId === eventSpecialId);
        if (found) { setEventTitle(found.eventTitle || found.title || ''); return; }
      }
    });
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
    <div className="min-h-screen bg-gray-50">
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            {/* BUTTON REMOVED */}
            <div className="h-5 w-px bg-gray-200 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900">Event Actions</h1>
              {eventTitle && (
                <p className="text-sm text-gray-500 mt-0.5 truncate">{eventTitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={openCreate}
            className="ml-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
          >
            <FiPlus className="w-4 h-4" />
            New Action
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-20 text-red-500">
            <FiAlertCircle className="w-10 h-10" />
            <p className="text-sm">{error}</p>
          </div>
        ) : actions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-gray-400">
            <FiCheckCircle className="w-12 h-12 opacity-30" />
            <p className="text-lg font-medium text-gray-500">No actions yet</p>
            <p className="text-sm">Click "New Action" above to create the first one.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {actions.map(a => (
                <div
                  key={a._id}
                  onClick={() => setViewTarget(a)}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-base">{a.title}</p>
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed line-clamp-2">{a.actionDescription}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setHistoryTarget(a)}
                        className="p-2 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        title="Status History"
                      ><FiActivity className="w-4 h-4" /></button>
                      <button
                        onClick={() => openEdit(a)}
                        className="p-2 rounded-lg text-gray-400 hover:bg-yellow-50 hover:text-yellow-600 transition-colors"
                        title="Edit"
                      ><FiEdit2 className="w-4 h-4" /></button>
                      <button
                        onClick={() => setDeleteTarget(a)}
                        className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Delete"
                      ><FiTrash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500 border-t border-gray-100 pt-3">
                    <span className="inline-flex items-center gap-1.5">
                      <FiUser className="w-3.5 h-3.5" />
                      <span className="font-medium text-gray-700">{a.assignedPerson?.name}</span>
                      {a.assignedPerson?.role && <span className="text-gray-400">· {a.assignedPerson.role}</span>}
                      {a.assignedPerson?.institution && <span className="text-gray-400">· {a.assignedPerson.institution}</span>}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 ${overdue(a.dueDate, a.currentStatus?.status) ? 'text-red-500' : ''}`}>
                      <FiCalendar className="w-3.5 h-3.5" />
                      {fmt(a.dueDate)}
                      {overdue(a.dueDate, a.currentStatus?.status) && (
                        <span className="bg-red-100 text-red-600 border border-red-200 rounded-full px-2 text-xs">Overdue</span>
                      )}
                    </span>
                    <Badge status={a.currentStatus?.status} />
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                ><FiChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                ><FiChevronRight className="w-4 h-4" /></button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ CREATE / EDIT MODAL ══════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center z-[9999999999] justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">
                {editing ? 'Edit Action' : 'New Action'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {formError && (
                <p className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{formError}</p>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title *</label>
                <input
                  type="text" required maxLength={200}
                  value={form.title}
                  onChange={e => setField('title', e.target.value)}
                  placeholder="Action title"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description *</label>
                <textarea
                  required maxLength={2000} rows={3}
                  value={form.actionDescription}
                  onChange={e => setField('actionDescription', e.target.value)}
                  placeholder="Describe the action…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50 resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Assigned Person *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPicker(p => !p)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <FiUser className="w-3 h-3" />
                    Pick from attendees
                    <FiChevronDown className={`w-3 h-3 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {showPicker && (
                  <div className="mb-2 border border-blue-200 rounded-lg overflow-hidden shadow-md bg-white">
                    <div className="p-2 border-b border-gray-100">
                      <div className="relative">
                        <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                        <input
                          type="text"
                          placeholder="Search attendees…"
                          value={attendeeSearch}
                          onChange={e => setAttendeeSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
                        />
                      </div>
                    </div>
                    <ul className="max-h-44 overflow-y-auto divide-y divide-gray-50">
                      {filteredAttendees.length === 0 ? (
                        <li className="px-4 py-3 text-xs text-gray-400 text-center">
                          {attendees.length === 0 ? 'No attendance records yet' : 'No matches'}
                        </li>
                      ) : filteredAttendees.map(a => (
                        <li key={a._id}>
                          <button
                            type="button"
                            onClick={() => pickAttendee(a)}
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-gray-800">{a.attendeeFullName}</p>
                              {a.attendeeEmail
                                ? <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 rounded-full px-1.5 py-0.5 shrink-0">has email</span>
                                : <span className="text-[10px] bg-gray-100 text-gray-400 border border-gray-200 rounded-full px-1.5 py-0.5 shrink-0">no email</span>
                              }
                            </div>
                            <p className="text-xs text-gray-400">{a.attendeePosition} · {a.attendeeInstitution}</p>
                            {a.attendeeEmail && <p className="text-xs text-blue-500 mt-0.5">{a.attendeeEmail}</p>}
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
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
                  />
                  <input
                    type="email" maxLength={300}
                    value={form.assignedPerson.email || ''}
                    onChange={e => setField('assignedPerson.email', e.target.value)}
                    placeholder="Email address (required for My Tasks access)"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text" required maxLength={200}
                      value={form.assignedPerson.role}
                      onChange={e => setField('assignedPerson.role', e.target.value)}
                      placeholder="Role / Position"
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
                    />
                    <input
                      type="text" required maxLength={300}
                      value={form.assignedPerson.institution}
                      onChange={e => setField('assignedPerson.institution', e.target.value)}
                      placeholder="Institution"
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Created By (your info) *</label>
                <div className="space-y-2">
                  <input
                    type="text" required maxLength={200}
                    value={form.createdBy?.name || ''}
                    onChange={e => setField('createdBy.name', e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
                  />
                  <input
                    type="email" maxLength={300}
                    value={form.createdBy?.email || ''}
                    onChange={e => setField('createdBy.email', e.target.value)}
                    placeholder="Your email address"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text" maxLength={200}
                      value={form.createdBy?.role || ''}
                      onChange={e => setField('createdBy.role', e.target.value)}
                      placeholder="Your role"
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
                    />
                    <input
                      type="text" maxLength={300}
                      value={form.createdBy?.institution || ''}
                      onChange={e => setField('createdBy.institution', e.target.value)}
                      placeholder="Your institution"
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Due Date *</label>
                <input
                  type="date" required
                  value={form.dueDate}
                  onChange={e => setField('dueDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status *</label>
                <div className="space-y-2">
                  <select
                    value={form.currentStatus.status}
                    onChange={e => setField('currentStatus.status', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
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
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-60">
                  {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ DELETE CONFIRM ══════════════════════════════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[99999999999999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg"><FiTrash2 className="w-5 h-5 text-red-600" /></div>
              <div>
                <h3 className="font-bold text-gray-900">Delete Action</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Delete <span className="font-semibold">"{deleteTarget.title}"</span>? This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ACTION DETAIL MODAL (centered) ══════════════════════ */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setViewTarget(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-base font-bold text-gray-900">Action Details</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { openEdit(viewTarget); setViewTarget(null); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded-lg transition-colors"
                >
                  <FiEdit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => { setDeleteTarget(viewTarget); setViewTarget(null); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                >
                  <FiTrash2 className="w-3.5 h-3.5" /> Delete
                </button>
                <button onClick={() => setViewTarget(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* body */}
            <div className="px-6 py-6 space-y-5">
              {/* Title & description */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 leading-snug">{viewTarget.title}</h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">{viewTarget.actionDescription}</p>
              </div>

              {/* Status */}
              <div className="flex items-start justify-between gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Current Status</p>
                  <Badge status={viewTarget.currentStatus?.status} />
                  {viewTarget.currentStatus?.description && (
                    <p className="text-sm text-gray-600 mt-2">{viewTarget.currentStatus.description}</p>
                  )}
                </div>
                {overdue(viewTarget.dueDate, viewTarget.currentStatus?.status) && (
                  <span className="bg-red-100 text-red-600 border border-red-200 rounded-full px-3 py-1 text-xs font-semibold shrink-0">Overdue</span>
                )}
              </div>

              {/* Assigned person + Due date side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Assigned To</p>
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <FiUser className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{viewTarget.assignedPerson?.name || '—'}</p>
                      {viewTarget.assignedPerson?.role && <p className="text-xs text-gray-500 truncate">{viewTarget.assignedPerson.role}</p>}
                      {viewTarget.assignedPerson?.institution && <p className="text-xs text-gray-400 truncate">{viewTarget.assignedPerson.institution}</p>}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Due Date</p>
                  <div className="flex items-center gap-2">
                    <FiCalendar className={`w-4 h-4 shrink-0 ${overdue(viewTarget.dueDate, viewTarget.currentStatus?.status) ? 'text-red-500' : 'text-gray-400'}`} />
                    <span className={`font-semibold text-sm ${overdue(viewTarget.dueDate, viewTarget.currentStatus?.status) ? 'text-red-600' : 'text-gray-700'}`}>
                      {fmt(viewTarget.dueDate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status history */}
              {viewTarget.statusHistory?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Status History</p>
                  <ol className="relative border-l-2 border-gray-200 ml-2 space-y-4">
                    {[...viewTarget.statusHistory].reverse().map((h, i) => (
                      <li key={i} className="ml-5">
                        <span className="absolute -left-2 w-4 h-4 bg-white border-2 border-blue-400 rounded-full" />
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge status={h.status} />
                          <span className="text-xs text-gray-400">{fmt(h.changedAt)}</span>
                        </div>
                        <p className="text-sm text-gray-600">{h.description}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Event */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Event</p>
                <p className="text-sm text-gray-700 bg-gray-100 px-3 py-2 rounded-lg">{eventTitle || viewTarget.eventSpecialId}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ STATUS HISTORY ══════════════════════════════════════ */}
      {historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Status History</h3>
              <button onClick={() => setHistoryTarget(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm font-semibold text-gray-700 mb-4">{historyTarget.title}</p>
              {historyTarget.statusHistory?.length ? (
                <ol className="relative border-l-2 border-gray-200 ml-2 space-y-5">
                  {[...historyTarget.statusHistory].reverse().map((h, i) => (
                    <li key={i} className="ml-5">
                      <span className="absolute -left-2 w-4 h-4 bg-white border-2 border-blue-400 rounded-full" />
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge status={h.status} />
                        <span className="text-xs text-gray-400">{fmt(h.changedAt)}</span>
                      </div>
                      <p className="text-sm text-gray-600">{h.description}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">No history recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
