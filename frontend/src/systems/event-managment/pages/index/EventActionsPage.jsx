import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { employeeService } from '@/core/services/employeeService';
import axios from 'axios';
import {
  FiPlus, FiEdit2, FiTrash2, FiClock, FiCheckCircle,
  FiActivity, FiChevronDown, FiUser, FiCalendar, FiSearch,
  FiAlertCircle, FiX, FiSlash,
} from 'react-icons/fi';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import { useToast } from '@/core/contexts/ToastContext';
import { useAuth } from '@/core/contexts/AuthContext';
import FollowUpDetailModal from '../../../taskManagement/components/FollowUpDetailModal';

const BASE_URL = '/cok/api/v1';
const PRIMARY = '#056daa';
const DANGER = '#E74C3C';
const BORDER = '#E0E0E0';
const NEUTRAL_DARK = '#333333';
const GRAY_DISABLED = '#9E9E9E';
const NEUTRAL_LIGHT = '#F7F9FB';
const fontHeading = "'Montserrat', sans-serif";

const inputClassName = 'w-full cok-auth-input pr-3 py-2 text-sm';
const inputStyle = { paddingLeft: '12px' };

const labelStyle = {
  fontFamily: fontHeading,
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: NEUTRAL_DARK,
  display: 'block',
  marginBottom: '6px',
};

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
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function overdue(due, status) {
  return status !== 'Completed' && new Date(due) < new Date();
}

const EMPTY = (eventSpecialId) => ({
  title: '',
  actionDescription: '',
  assignedPerson: { name: '', email: '', role: '', department: '' },
  createdBy: { name: '', email: '', role: '', department: '' },
  dueDate: '',
  currentStatus: { status: 'Pending', description: '' },
  eventSpecialId,
});

export default function EventActionsPage({ overlayEventId = null }) {
  const { id: routeEventId } = useParams();
  const eventSpecialId = overlayEventId || routeEventId;
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();

  const loggedInCreator = () => ({
    name: user?.fullName || '',
    email: user?.email || '',
    role: user?.role || '',
    department: user?.departmentName || user?.department_name || '',
  });

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
  const [deleting, setDeleting]           = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [viewTarget, setViewTarget]       = useState(null);

  const [attendees, setAttendees]           = useState([]);
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [showPicker, setShowPicker]         = useState(false);

  const [showEmpPicker, setShowEmpPicker]   = useState(false);
  const [empSearch, setEmpSearch]           = useState('');
  const [empResults, setEmpResults]         = useState([]);
  const [empSearching, setEmpSearching]     = useState(false);
  const empTimerRef = useRef(null);

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
    setForm({ ...EMPTY(eventSpecialId), createdBy: loggedInCreator() });
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(a) {
    setEditing(a);
    setForm({
      title: a.title,
      actionDescription: a.actionDescription,
      assignedPerson: { ...a.assignedPerson, department: a.assignedPerson?.department || a.assignedPerson?.institution || '' },
      createdBy: a.createdBy
        ? { ...a.createdBy, department: a.createdBy?.department || a.createdBy?.institution || '' }
        : loggedInCreator(),
      dueDate: a.dueDate?.slice(0, 16) ?? '',
      currentStatus: { ...a.currentStatus },
      eventSpecialId,
    });
    setFormError(null);
    setShowForm(true);
  }

  function pickAttendee(att) {
    setField('assignedPerson.name',        att.attendeeFullName   || '');
    setField('assignedPerson.role',        att.attendeePosition   || '');
    setField('assignedPerson.department', att.attendeeInstitution || '');
    setField('assignedPerson.email',       att.attendeeEmail      || '');
    setShowPicker(false);
    setAttendeeSearch('');
  }

  useEffect(() => {
    if (!showEmpPicker) return;
    if (empTimerRef.current) clearTimeout(empTimerRef.current);
    const q = empSearch.trim();
    if (!q) { setEmpResults([]); return; }
    empTimerRef.current = setTimeout(async () => {
      setEmpSearching(true);
      try {
        const res = await employeeService.search(q, 1, 20);
        setEmpResults(res?.data || []);
      } catch {
        setEmpResults([]);
      } finally {
        setEmpSearching(false);
      }
    }, 350);
    return () => { if (empTimerRef.current) clearTimeout(empTimerRef.current); };
  }, [empSearch, showEmpPicker]);

  function pickEmployee(emp) {
    setField('assignedPerson.name',        emp.full_name || '');
    setField('assignedPerson.email',       emp.email     || '');
    setField('assignedPerson.role',        emp.title     || '');
    const dep = typeof emp.department === 'object' ? emp.department?.department_name : emp.department;
    setField('assignedPerson.department', emp.department_name || dep || '');
    setShowEmpPicker(false);
    setEmpSearch('');
    setEmpResults([]);
  }

  const filteredAttendees = attendees.filter(a => {
    const q = attendeeSearch.toLowerCase();
    return !q || a.attendeeFullName?.toLowerCase().includes(q) || a.attendeeInstitution?.toLowerCase().includes(q);
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true); setFormError(null);
    try {
      let res;
      if (editing) {
        res = await axios.patch(`${BASE_URL}/event-actions/${editing._id}`, form);
      } else {
        res = await axios.post(`${BASE_URL}/event-actions`, form);
      }
      setShowForm(false);
      showSuccess(res.data?.message || (editing ? 'Action updated' : 'Action created'));
      fetchActions(page);
    } catch (e) {
      const message = e.response?.data?.message || e.message || 'Something went wrong.';
      setFormError(message);
      showError(message);
    } finally { setSubmitting(false); }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await axios.delete(`${BASE_URL}/event-actions/${deleteTarget._id}`);
      showSuccess(res.data?.message || 'Action deleted');
      setDeleteTarget(null);
      fetchActions(page);
    } catch (e) {
      showError(e.response?.data?.message || e.message || 'Failed to delete action');
      setDeleteTarget(null);
    } finally { setDeleting(false); }
  }

  return (
    <div className="w-full min-h-screen flex justify-center" style={{ paddingTop: '10px', backgroundColor: NEUTRAL_LIGHT }}>
      <div className="w-full max-w-5xl px-3 sm:px-6 md:px-8 py-6">

        <div className="mb-5">
          <button
            onClick={openCreate}
            className="cok-btn-primary"
            style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '11px' }}
          >
            New Action (FollowUps)
          </button>
        </div>

        {/* Content */}
        <div>
          {loading ? (
            <div className="bg-white flex flex-col items-center gap-4 py-20" style={{ border: `1px solid ${BORDER}` }}>
              <SpiralLoader color={PRIMARY} />
              <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Loading actions...</p>
            </div>
          ) : error ? (
            <div className="bg-white flex flex-col items-center gap-3 py-16 px-4 text-center" style={{ border: `1px solid ${BORDER}` }}>
              <FiAlertCircle className="w-10 h-10" style={{ color: DANGER }} />
              <p className="text-sm" style={{ color: DANGER, fontFamily: fontHeading }}>{error}</p>
            </div>
          ) : actions.length === 0 ? (
            <div className="bg-white flex flex-col items-center gap-2 py-20 px-4 text-center" style={{ border: `1px solid ${BORDER}` }}>
              <FiCheckCircle className="w-12 h-12" style={{ color: '#CCCCCC' }} />
              <p className="text-base font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>No actions yet</p>
              <p className="text-sm" style={{ color: GRAY_DISABLED }}>Click "New Action (FollowUps)" above to create the first one.</p>
            </div>
          ) : (
            <>
              <div className="bg-white border overflow-x-auto" style={{ borderColor: BORDER, WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr style={{ backgroundColor: PRIMARY }}>
                      {['Title', 'Assigned Name', 'Assigned Title', 'Assigned Email', 'Due Date', 'Status'].map(h => (
                        <th key={h} className="px-3 py-3 sm:px-4 sm:py-3.5 text-left text-[11px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: '#FFFFFF', fontFamily: fontHeading }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {actions.map((a, idx) => (
                      <tr
                        key={a._id}
                        onClick={() => setViewTarget(a)}
                        className={`cursor-pointer transition-colors duration-100 ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50/50 hover:bg-blue-50'}`}
                      >
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b" style={{ borderColor: BORDER }}>
                          <p className="font-semibold text-zinc-900" style={{ fontFamily: fontHeading }}>{a.title}</p>
                        </td>
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l" style={{ borderColor: BORDER }}>
                          <p className="font-medium text-sm text-zinc-900" style={{ fontFamily: fontHeading }}>{a.assignedPerson?.name || '-'}</p>
                        </td>
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l text-xs" style={{ borderColor: BORDER, color: '#555555' }}>
                          {a.assignedPerson?.role || '-'}
                        </td>
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l text-xs" style={{ borderColor: BORDER, color: '#555555' }}>
                          {a.assignedPerson?.email || '-'}
                        </td>
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l" style={{ borderColor: BORDER }}>
                          <span className="text-xs font-medium" style={{ fontFamily: fontHeading, color: overdue(a.dueDate, a.currentStatus?.status) ? DANGER : '#555555' }}>
                            {fmt(a.dueDate)}
                          </span>
                          {overdue(a.dueDate, a.currentStatus?.status) && (
                            <span className="mt-0.5 block px-1.5 text-[10px] w-fit" style={{ backgroundColor: '#FDECEA', border: '1px solid #F5B7B1', color: DANGER }}>Overdue</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap border-b border-l" style={{ borderColor: BORDER }}>
                          <Badge status={a.currentStatus?.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-3 px-1">
                  <span className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1 flex-wrap justify-center">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="cok-btn-outlined disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ padding: '0.4rem 0.8rem' }}
                    >
                      Back
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className="px-3 py-1.5 text-xs cursor-pointer transition-colors"
                        style={{
                          fontFamily: fontHeading,
                          borderRadius: 0,
                          border: `1px solid ${n === page ? PRIMARY : BORDER}`,
                          backgroundColor: n === page ? PRIMARY : '#FFFFFF',
                          color: n === page ? '#FFFFFF' : NEUTRAL_DARK,
                          fontWeight: n === page ? 600 : 400,
                        }}
                        onMouseEnter={(e) => { if (n !== page) e.currentTarget.style.backgroundColor = NEUTRAL_LIGHT; }}
                        onMouseLeave={(e) => { if (n !== page) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="cok-btn-outlined disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ padding: '0.4rem 0.8rem' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {showForm && createPortal(
          <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ backgroundColor: NEUTRAL_LIGHT, zIndex: 2000000000000 }}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0 text-white" style={{ backgroundColor: PRIMARY }}>
              <h3 className="text-base sm:text-lg font-bold" style={{ fontFamily: fontHeading }}>
                {editing ? 'Edit Action (FollowUps)' : 'New Action (FollowUps)'}
              </h3>
              <button onClick={() => setShowForm(false)} disabled={submitting} className="cok-btn-outlined-reverse disabled:opacity-50" style={{ padding: '0.4rem 0.8rem' }}>
                <FiX className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="bg-white w-full max-w-2xl mx-auto my-6" style={{ border: `1px solid ${BORDER}` }}>
              <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-5 space-y-4">
                <p className="text-center text-xs" style={{ color: '#9E9E9E', fontFamily: fontHeading }}>
                  Fields marked with <span style={{ color: DANGER }}>*</span> are required</p>
                {formError && (
                  <p className="p-3 text-sm" style={{ backgroundColor: '#FDECEA', border: '1px solid #F5B7B1', color: DANGER, fontFamily: fontHeading }}>{formError}</p>
                )}

                <div>
                  <label style={labelStyle}>Title <span style={{ color: DANGER }}>*</span></label>
                  <input
                    type="text" required maxLength={200}
                    value={form.title}
                    onChange={e => setField('title', e.target.value)}
                    placeholder="Action title"
                    className={inputClassName} style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Description <span style={{ color: DANGER }}>*</span></label>
                  <textarea
                    required maxLength={2000} rows={3}
                    value={form.actionDescription}
                    onChange={e => setField('actionDescription', e.target.value)}
                    placeholder="Describe the action"
                    className={inputClassName}
                    style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
                  />
                </div>

                {/* Assigned Person */}
                <div style={{ border: `1px solid ${BORDER}` }}>
                  <div className="px-3 sm:px-4 py-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderBottom: `1px solid ${BORDER}` }}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                        Assigned Person <span style={{ color: DANGER }}>*</span>
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => { setShowPicker(p => !p); setShowEmpPicker(false); }}
                          className="inline-flex items-center gap-1 text-xs font-medium cursor-pointer"
                          style={{ color: PRIMARY, fontFamily: fontHeading }}
                        >
                          <FiUser className="w-3 h-3" />
                          Pick from attendees
                          <FiChevronDown className={`w-3 h-3 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowEmpPicker(p => !p); setShowPicker(false); }}
                          className="inline-flex items-center gap-1 text-xs font-medium cursor-pointer"
                          style={{ color: PRIMARY, fontFamily: fontHeading }}
                        >
                          <FiUser className="w-3 h-3" />
                          Pick from employees
                          <FiChevronDown className={`w-3 h-3 transition-transform ${showEmpPicker ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 sm:p-4 space-y-4">
                    {showPicker && (
                      <div style={{ border: `1px solid ${BORDER}` }}>
                        <div className="p-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: PRIMARY }} />
                            <input
                              type="text"
                              placeholder="Search attendees"
                              value={attendeeSearch}
                              onChange={e => setAttendeeSearch(e.target.value)}
                              className="w-full cok-auth-input pr-3 py-1.5 text-xs"
                            />
                          </div>
                        </div>
                        <ul className="max-h-44 overflow-y-auto bg-white">
                          {filteredAttendees.length === 0 ? (
                            <li className="px-4 py-3 text-xs text-center" style={{ color: GRAY_DISABLED }}>
                              {attendees.length === 0 ? 'No attendance records yet' : 'No matches'}
                            </li>
                          ) : filteredAttendees.map(a => (
                            <li key={a._id}>
                              <button
                                type="button"
                                onClick={() => pickAttendee(a)}
                                className="w-full text-left px-3 sm:px-4 py-2.5 cursor-pointer transition-colors hover:bg-[#F7F9FB]"
                                style={{ borderBottom: `1px solid ${BORDER}` }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium break-words" style={{ color: NEUTRAL_DARK }}>{a.attendeeFullName}</p>
                                  {a.attendeeEmail
                                    ? <span className="text-[10px] px-1.5 py-0.5 shrink-0" style={{ backgroundColor: '#E8F5E9', border: '1px solid #C8E6C9', color: '#2E7D32' }}>has email</span>
                                    : <span className="text-[10px] px-1.5 py-0.5 shrink-0" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}`, color: GRAY_DISABLED }}>no email</span>
                                  }
                                </div>
                                <p className="text-xs" style={{ color: GRAY_DISABLED }}>{[a.attendeePosition, a.attendeeInstitution].filter(Boolean).join(', ')}</p>
                                {a.attendeeEmail && <p className="text-xs mt-0.5 break-all" style={{ color: PRIMARY }}>{a.attendeeEmail}</p>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {showEmpPicker && (
                      <div style={{ border: `1px solid ${BORDER}` }}>
                        <div className="p-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <input
                            type="text"
                            placeholder="Search employee by email or phone"
                            value={empSearch}
                            onChange={e => setEmpSearch(e.target.value)}
                            autoFocus
                            className="w-full cok-auth-input pr-3 py-1.5 text-xs"
                            style={{ paddingLeft: '12px' }}
                          />
                        </div>
                        <ul className="max-h-44 overflow-y-auto bg-white">
                          {empSearching ? (
                            <li className="px-4 py-3 text-xs text-center" style={{ color: GRAY_DISABLED }}>Searching...</li>
                          ) : empResults.length === 0 ? (
                            <li className="px-4 py-3 text-xs text-center" style={{ color: GRAY_DISABLED }}>
                              {empSearch.trim() ? 'No employees found' : 'Type an email or phone number to search'}
                            </li>
                          ) : empResults.map(emp => (
                            <li key={emp._id || emp.email}>
                              <button
                                type="button"
                                onClick={() => pickEmployee(emp)}
                                className="w-full text-left px-3 sm:px-4 py-2.5 cursor-pointer transition-colors hover:bg-[#F7F9FB]"
                                style={{ borderBottom: `1px solid ${BORDER}` }}
                              >
                                <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{emp.full_name}</p>
                                <p className="text-xs" style={{ color: GRAY_DISABLED }}>
                                  {[emp.title, emp.telephone].filter(Boolean).join(', ')}
                                </p>
                                <p className="text-xs mt-0.5 break-all" style={{ color: PRIMARY }}>{emp.email}</p>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label style={labelStyle}>Full Name <span style={{ color: DANGER }}>*</span></label>
                        <input
                          type="text" required maxLength={200}
                          value={form.assignedPerson.name}
                          onChange={e => setField('assignedPerson.name', e.target.value)}
                          placeholder="Full name"
                          className={inputClassName} style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Email Address</label>
                        <input
                          type="email" maxLength={300}
                          value={form.assignedPerson.email || ''}
                          onChange={e => setField('assignedPerson.email', e.target.value)}
                          placeholder="Email address"
                          className={inputClassName} style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Role / Position <span style={{ color: DANGER }}>*</span></label>
                        <input
                          type="text" required maxLength={200}
                          value={form.assignedPerson.role}
                          onChange={e => setField('assignedPerson.role', e.target.value)}
                          placeholder="Role / Position"
                          className={inputClassName} style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Department / Unit <span style={{ color: DANGER }}>*</span></label>
                        <input
                          type="text" required maxLength={300}
                          value={form.assignedPerson.department}
                          onChange={e => setField('assignedPerson.department', e.target.value)}
                          placeholder="Department / Unit"
                          className={inputClassName} style={inputStyle}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Created By */}
                <div style={{ border: `1px solid ${BORDER}` }}>
                  <div className="px-3 sm:px-4 py-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderBottom: `1px solid ${BORDER}` }}>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                      Created By (your info)
                    </p>
                  </div>
                  <div className="p-3 sm:p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label style={labelStyle}>Full Name</label>
                        <input
                          type="text" readOnly
                          value={form.createdBy?.name || ''}
                          className={`${inputClassName} cursor-not-allowed`}
                          style={{ ...inputStyle, backgroundColor: NEUTRAL_LIGHT, color: GRAY_DISABLED }}
                          tabIndex={-1}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Email Address</label>
                        <input
                          type="email" readOnly
                          value={form.createdBy?.email || ''}
                          className={`${inputClassName} cursor-not-allowed`}
                          style={{ ...inputStyle, backgroundColor: NEUTRAL_LIGHT, color: GRAY_DISABLED }}
                          tabIndex={-1}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Your Role</label>
                        <input
                          type="text" readOnly
                          value={form.createdBy?.role || ''}
                          className={`${inputClassName} cursor-not-allowed`}
                          style={{ ...inputStyle, backgroundColor: NEUTRAL_LIGHT, color: GRAY_DISABLED }}
                          tabIndex={-1}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Department / Unit</label>
                        <input
                          type="text" readOnly
                          value={form.createdBy?.department || ''}
                          className={`${inputClassName} cursor-not-allowed`}
                          style={{ ...inputStyle, backgroundColor: NEUTRAL_LIGHT, color: GRAY_DISABLED }}
                          tabIndex={-1}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Due Date <span style={{ color: DANGER }}>*</span></label>
                  <input
                    type="datetime-local" required
                    value={form.dueDate}
                    onChange={e => setField('dueDate', e.target.value)}
                    className={inputClassName} style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Status <span style={{ color: DANGER }}>*</span></label>
                  <select
                    value={form.currentStatus.status}
                    onChange={e => setField('currentStatus.status', e.target.value)}
                    className={`${inputClassName} cursor-pointer`}
                    style={inputStyle}
                  >
                    <option>Pending</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Status Note <span style={{ color: DANGER }}>*</span></label>
                  <textarea
                    required maxLength={1000} rows={2}
                    value={form.currentStatus.description}
                    onChange={e => setField('currentStatus.description', e.target.value)}
                    placeholder="Status note"
                    className={inputClassName}
                    style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }}
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    disabled={submitting}
                    className="cok-btn-outlined sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ padding: '0.6rem 1.2rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="cok-btn-primary sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ width: '100%', padding: '0.6rem 1.4rem' }}
                  >
                    {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Create Action'}
                  </button>
                </div>
              </form>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* DELETE CONFIRM */}
        {deleteTarget && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white w-full max-w-sm p-5 sm:p-6" style={{ border: `1px solid ${BORDER}` }}>
              <div className="flex items-start gap-3 mb-5">
                <div className="p-2.5 shrink-0" style={{ backgroundColor: '#FDECEA' }}>
                  <FiTrash2 className="w-6 h-6" style={{ color: DANGER }} />
                </div>
                <div>
                  <h3 className="font-bold text-base" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Delete Action</h3>
                  <p className="text-sm mt-1 break-words" style={{ color: GRAY_DISABLED }}>
                    Delete <span className="font-semibold" style={{ color: NEUTRAL_DARK }}>"{deleteTarget.title}"</span>? This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="cok-btn-outlined flex-1 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white cursor-pointer transition-colors disabled:opacity-60"
                  style={{ backgroundColor: DANGER, fontFamily: fontHeading, borderRadius: 0, border: 0 }}
                  onMouseEnter={(e) => { if (!deleting) e.currentTarget.style.backgroundColor = '#C0392B'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {viewTarget && createPortal(
          <div style={{ position: 'relative', zIndex: 2000000000 }}>
            <FollowUpDetailModal
              followup={viewTarget}
              allowFullEdit
              onClose={() => { setViewTarget(null); fetchActions(page); }}
              onUpdate={() => fetchActions(page)}
              onDelete={() => { setViewTarget(null); fetchActions(page); }}
            />
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
