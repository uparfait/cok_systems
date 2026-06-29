import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  FiX, FiPlus, FiEdit2, FiTrash2, FiClock, FiCheckCircle,
  FiActivity, FiChevronDown, FiUser, FiCalendar, FiSearch,
  FiAlertCircle, FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';

const BASE_URL = '/cok/api/v1';

/* ── helpers ─────────────────────────────────────────────── */
const STATUS_META = {
  Pending:      { cls: 'bg-amber-100 text-amber-700 border-amber-200',  icon: <FiClock       className="w-3 h-3" /> },
  'In Progress':{ cls: 'bg-blue-100  text-blue-700  border-blue-200',   icon: <FiActivity    className="w-3 h-3" /> },
  Completed:    { cls: 'bg-green-100 text-green-700 border-green-200',  icon: <FiCheckCircle className="w-3 h-3" /> },
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
  assignedPerson: { name: '', role: '', institution: '' },
  dueDate: '',
  currentStatus: { status: 'Pending', description: '' },
  eventSpecialId,
});

/* ══════════════════════════════════════════════════════════ */
export default function EventActionsPanel({ eventSpecialId, onClose }) {
  const [actions, setActions]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  /* modal states */
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY(eventSpecialId));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  /* attendee picker */
  const [attendees, setAttendees]         = useState([]);
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [showPicker, setShowPicker]       = useState(false);

  /* ── fetch actions for this event ── */
  const fetchActions = useCallback(async (p = 1) => {
    setLoading(true); setError(null);
    try {
      const res = await axios.get(`${BASE_URL}/event-actions`, {
        params: { eventSpecialId, page: p, limit: 8 },
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

  /* ── fetch attendees (once, for the picker) ── */
  useEffect(() => {
    axios
      .get(`${BASE_URL}/attendance`, { params: { eventSpecialId, limit: 200 } })
      .then(r => setAttendees(r.data?.data || []))
      .catch(() => {});
  }, [eventSpecialId]);

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

  /* ── pick attendee → fill assignedPerson ── */
  function pickAttendee(att) {
    setField('assignedPerson.name',        att.attendeeFullName  || '');
    setField('assignedPerson.role',        att.attendeePosition  || '');
    setField('assignedPerson.institution', att.attendeeInstitution || '');
    setShowPicker(false);
    setAttendeeSearch('');
  }

  const filteredAttendees = attendees.filter(a => {
    const q = attendeeSearch.toLowerCase();
    return !q || a.attendeeFullName?.toLowerCase().includes(q) || a.attendeeInstitution?.toLowerCase().includes(q);
  });

  /* ── submit ── */
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

  /* ── delete ── */
  async function confirmDelete() {
    try {
      await axios.delete(`${BASE_URL}/event-actions/${deleteTarget._id}`);
      setDeleteTarget(null);
      fetchActions(page);
    } catch { setDeleteTarget(null); }
  }

  /* ══ RENDER ══════════════════════════════════════════════ */
  return (
    /* full-screen backdrop */
    <div className="fixed inset-0 z-[9999] flex items-stretch justify-end bg-black/40 backdrop-blur-sm">

      {/* slide-over panel */}
      <div className="w-full max-w-2xl h-full bg-white flex flex-col shadow-2xl overflow-hidden">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Event Actions</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{eventSpecialId}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <FiPlus className="w-4 h-4" /> New Action
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-12 text-red-500">
              <FiAlertCircle className="w-8 h-8" /><p className="text-sm">{error}</p>
            </div>
          ) : actions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-gray-400">
              <FiCheckCircle className="w-10 h-10 opacity-30" />
              <p className="font-medium">No actions yet</p>
              <p className="text-sm">Click "New Action" to create the first one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actions.map(a => (
                <div key={a._id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-200 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 truncate">{a.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{a.actionDescription}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setHistoryTarget(a)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        title="History"
                      ><FiActivity className="w-4 h-4" /></button>
                      <button
                        onClick={() => openEdit(a)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-yellow-50 hover:text-yellow-600 transition-colors"
                        title="Edit"
                      ><FiEdit2 className="w-4 h-4" /></button>
                      <button
                        onClick={() => setDeleteTarget(a)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Delete"
                      ><FiTrash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <FiUser className="w-3 h-3" />
                      <span className="font-medium text-gray-700">{a.assignedPerson?.name}</span>
                      {a.assignedPerson?.role && <span>· {a.assignedPerson.role}</span>}
                    </span>
                    <span className={`inline-flex items-center gap-1 ${overdue(a.dueDate, a.currentStatus?.status) ? 'text-red-500' : ''}`}>
                      <FiCalendar className="w-3 h-3" />
                      {fmt(a.dueDate)}
                      {overdue(a.dueDate, a.currentStatus?.status) && (
                        <span className="bg-red-100 text-red-600 border border-red-200 rounded-full px-1.5 text-[10px]">Overdue</span>
                      )}
                    </span>
                    <Badge status={a.currentStatus?.status} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              ><FiChevronLeft className="w-4 h-4" /></button>
              <span className="text-xs text-gray-500">Page {page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              ><FiChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </div>

      {/* ══ CREATE / EDIT MODAL ══════════════════════════════ */}
      {showForm && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/40">
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

              {/* Title */}
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

              {/* Description */}
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

              {/* Assigned person */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Assigned Person *
                  </label>
                  {/* pick from attendees */}
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

                {/* attendee picker dropdown */}
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
                            <p className="text-sm font-medium text-gray-800">{a.attendeeFullName}</p>
                            <p className="text-xs text-gray-400">{a.attendeePosition} · {a.attendeeInstitution}</p>
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

              {/* Due date */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Due Date *
                </label>
                <input
                  type="date" required
                  value={form.dueDate}
                  onChange={e => setField('dueDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
                />
              </div>

              {/* Status */}
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

      {/* ══ DELETE CONFIRM ════════════════════════════════════ */}
      {deleteTarget && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/40">
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

      {/* ══ STATUS HISTORY ════════════════════════════════════ */}
      {historyTarget && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/40">
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
                      <span className="absolute -left-2 w-4 h-4 bg-white border-2 border-blue-400 rounded-full flex items-center justify-center" />
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
