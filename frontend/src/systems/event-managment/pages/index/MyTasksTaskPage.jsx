import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';
import {
  FiArrowLeft, FiClock, FiActivity, FiCheckCircle,
  FiCalendar, FiUser, FiBriefcase, FiMapPin,
  FiAlertCircle, FiUpload, FiPaperclip, FiX,
  FiDownload, FiFileText, FiEye,
} from 'react-icons/fi';

/* ── in-app file viewer ─────────────────────────────────── */
function FileViewer({ doc, onClose }) {
  if (!doc) return null;
  const mime = doc.mimetype || '';
  const url  = doc.url;
  const name = doc.originalName || doc.filename || 'Document';
  const isImage = mime.startsWith('image/');
  const isPdf   = mime === 'application/pdf';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden w-full max-w-4xl max-h-[92vh]">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 shrink-0">
          <FiPaperclip className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-800 truncate flex-1" title={name}>{name}</span>
          <a href={url} download={name}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <FiDownload className="w-3.5 h-3.5" /> Download
          </a>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center min-h-0">
          {isImage ? (
            <img src={url} alt={name} className="max-w-full max-h-full object-contain rounded" />
          ) : isPdf ? (
            <iframe src={url} title={name} className="w-full h-full border-0" style={{ minHeight: '70vh' }} />
          ) : (
            <div className="text-center p-10">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FiFileText className="w-8 h-8 text-blue-500" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">{name}</p>
              <p className="text-xs text-gray-400 mb-5">This file type cannot be previewed in the browser.</p>
              <a href={url} download={name}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow">
                <FiDownload className="w-4 h-4" /> Download file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const BASE_URL = '/cok/api/v1';
const SESSION_KEY = 'my_tasks_cache';

const STATUSES = ['Pending', 'In Progress', 'Completed'];

const STATUS_META = {
  Pending:       { header: 'bg-amber-500',  text: 'text-amber-700',  light: 'bg-amber-50',  border: 'border-amber-300',  ring: 'ring-amber-400',  badge: 'bg-amber-100  text-amber-700  border-amber-200',  icon: FiClock,       line: 'bg-amber-300' },
  'In Progress': { header: 'bg-blue-500',   text: 'text-blue-700',   light: 'bg-blue-50',   border: 'border-blue-300',   ring: 'ring-blue-400',   badge: 'bg-blue-100   text-blue-700   border-blue-200',   icon: FiActivity,    line: 'bg-blue-300' },
  Completed:     { header: 'bg-green-500',  text: 'text-green-700',  light: 'bg-green-50',  border: 'border-green-300',  ring: 'ring-green-400',  badge: 'bg-green-100  text-green-700  border-green-200',  icon: FiCheckCircle, line: 'bg-green-300' },
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtFull(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function isOverdue(due, status) {
  return status !== 'Completed' && new Date(due) < new Date();
}

function Badge({ status }) {
  const m = STATUS_META[status] || { badge: 'bg-gray-100 text-gray-600 border-gray-200' };
  const Icon = STATUS_META[status]?.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${m.badge}`}>
      {Icon && <Icon className="w-3 h-3" />} {status}
    </span>
  );
}

/* ── Progress indicator ── */
function ProgressIndicator({ current, onUpdate }) {
  const currentIdx = STATUSES.indexOf(current);
  const [open, setOpen]       = useState(false);
  const [chosen, setChosen]   = useState(current);
  const [desc, setDesc]       = useState('');
  const [file, setFile]       = useState(null);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  function toggle() {
    setOpen(o => !o);
    setChosen(current);
    setDesc('');
    setFile(null);
    setErr('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!desc.trim()) { setErr('Description is required.'); return; }
    if (chosen === current) { setErr('Please choose a different status.'); return; }
    setSaving(true); setErr('');
    try {
      await onUpdate(chosen, desc.trim(), file);
      setOpen(false);
      setDesc('');
      setFile(null);
    } catch (e) {
      setErr(e.message || 'Failed to update.');
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Steps row */}
      <div className="px-4 sm:px-6 pt-5 pb-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">Progress</p>

        <div className="flex items-center">
          {STATUSES.map((s, i) => {
            const m     = STATUS_META[s];
            const Icon  = m.icon;
            const done  = i < currentIdx;
            const active = i === currentIdx;

            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                {/* Step circle */}
                <button
                  onClick={toggle}
                  className={`flex flex-col items-center gap-1 group focus:outline-none`}
                  title={`Click to update status`}
                >
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    done   ? `${m.header} border-transparent text-white` :
                    active ? `${m.light} ${m.border} ${m.text} ring-2 ${m.ring} ring-offset-1` :
                             'bg-gray-100 border-gray-200 text-gray-300'
                  } group-hover:scale-110`}>
                    {done ? <FiCheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
                    active ? m.text : done ? 'text-gray-500' : 'text-gray-300'
                  }`}>{s}</span>
                </button>

                {/* Connector line */}
                {i < STATUSES.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 sm:mx-2 rounded-full transition-colors ${
                    i < currentIdx ? STATUS_META[STATUSES[i + 1]]?.header || 'bg-gray-200' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 text-center mt-3 italic">Click any step above to update the status</p>
      </div>

      {/* Expandable form */}
      {open && (
        <form onSubmit={handleSubmit} className="border-t border-gray-100 px-4 sm:px-6 py-4 bg-gray-50 space-y-4">
          <p className="text-sm font-bold text-gray-800">Update Status</p>

          {err && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2">
              <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />{err}
            </div>
          )}

          {/* Radio buttons */}
          <div className="space-y-2">
            {STATUSES.map(s => {
              const m = STATUS_META[s];
              const Icon = m.icon;
              const checked = chosen === s;
              return (
                <label
                  key={s}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    checked ? `${m.light} ${m.border}` : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio" name="status" value={s}
                    checked={checked}
                    onChange={() => setChosen(s)}
                    className="sr-only"
                  />
                  {/* Custom radio */}
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    checked ? `${m.border} ${m.header}` : 'border-gray-300'
                  }`}>
                    {checked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <Icon className={`w-4 h-4 shrink-0 ${checked ? m.text : 'text-gray-400'}`} />
                  <span className={`text-sm font-semibold ${checked ? m.text : 'text-gray-600'}`}>{s}</span>
                  {s === current && (
                    <span className="ml-auto text-[10px] bg-gray-200 text-gray-500 rounded-full px-2 py-0.5">Current</span>
                  )}
                </label>
              );
            })}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required rows={3}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Describe what was done or reason for this change…"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-white resize-none"
            />
          </div>

          {/* Document upload (optional) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Attach Document <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            {file ? (
              <div className="flex items-center gap-3 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                <FiPaperclip className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-sm text-blue-700 truncate flex-1">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1 rounded-lg hover:bg-blue-100 text-blue-400 shrink-0"
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 px-3 py-2.5 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all group">
                <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                  <FiUpload className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-500 group-hover:text-blue-600 transition-colors">Click to upload a file</p>
                  <p className="text-xs text-gray-400">PDF, Word, Excel, Images</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={e => setFile(e.target.files[0] || null)}
                />
              </label>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={toggle}
              className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-60 ${
                STATUS_META[chosen]?.header || 'bg-blue-600'
              }`}>
              {saving ? 'Saving…' : `Set to ${chosen}`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */

export default function MyTasksTaskPage() {
  const { taskId }  = useParams();
  const navigate    = useNavigate();

  const [task, setTask]       = useState(null);
  const [loading, setLoading] = useState(!task);
  const [error, setError]     = useState('');
  const [viewingDoc, setViewingDoc] = useState(null);

  /* Fetch if no state (direct URL or refresh) */
  useEffect(() => {
    if (task) return;
    setLoading(true);
    axios.get(`${BASE_URL}/event-actions/${taskId}`)
      .then(r => setTask(r.data.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load task.'))
      .finally(() => setLoading(false));
  }, [taskId, task]);

  async function handleUpdate(newStatus, description, file) {
    const fd = new FormData();
    fd.append('currentStatus[status]', newStatus);
    fd.append('currentStatus[description]', description);
    if (file) fd.append('document', file);

    const res = await axios.patch(`${BASE_URL}/event-actions/${taskId}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    // Use the full updated doc returned by the server so document URLs are correct
    const updated = res.data.data;
    setTask(updated);

    // sync session cache
    try {
      const cached = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      if (cached.tasks) {
        cached.tasks = cached.tasks.map(t => t._id === taskId ? updated : t);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(cached));
      }
    } catch {}
  }

  function goBack() { navigate('/my-tasks'); }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopBar onBack={goBack} title="Task Details" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopBar onBack={goBack} title="Task Details" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-red-400 p-6">
          <FiAlertCircle className="w-10 h-10" />
          <p className="text-sm text-center">{error || 'Task not found.'}</p>
          <button onClick={goBack} className="text-sm text-blue-600 underline">Go to My Tasks</button>
        </div>
      </div>
    );
  }

  const od = isOverdue(task.dueDate, task.currentStatus?.status);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Helmet>
        <title>{task ? `My Tasks · ${task.title}` : 'My Tasks'}</title>
      </Helmet>
      <TopBar onBack={goBack} title={task.title} />

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

          {/* Two-column on lg+, single column on mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">

            {/* ── LEFT column ── */}
            <div className="space-y-4 min-w-0">

              {/* Title + badge */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  <h2 className="text-xl font-bold text-gray-900 leading-snug flex-1 min-w-0">{task.title}</h2>
                  <Badge status={task.currentStatus?.status} />
                </div>
                <p className="text-sm text-gray-500 mt-3 leading-relaxed">{task.actionDescription}</p>
                {task.currentStatus?.description && (
                  <p className="text-xs text-gray-400 mt-3 italic border-l-2 border-gray-200 pl-3 leading-relaxed">
                    {task.currentStatus.description}
                  </p>
                )}
              </div>

              {/* Progress indicator */}
              <ProgressIndicator current={task.currentStatus?.status} onUpdate={handleUpdate} />

              {/* Due date */}
              <div className={`flex items-center gap-4 px-5 py-4 rounded-2xl border ${od ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${od ? 'bg-red-100' : 'bg-gray-100'}`}>
                  <FiCalendar className={`w-5 h-5 ${od ? 'text-red-500' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Due Date</p>
                  <p className={`text-sm font-bold ${od ? 'text-red-600' : 'text-gray-800'}`}>{fmt(task.dueDate)}</p>
                </div>
                {od && <span className="text-xs bg-red-100 text-red-600 border border-red-200 rounded-full px-3 py-1 font-semibold shrink-0">Overdue</span>}
              </div>

            </div>

            {/* ── RIGHT column ── */}
            <div className="space-y-4">

              {/* Assigned to */}
              <InfoCard
                label="Assigned To"
                color="blue"
                person={task.assignedPerson}
                extra={task.assignedPerson?.email && (
                  <a href={`mailto:${task.assignedPerson.email}`} className="text-xs text-blue-600 hover:underline break-all">
                    {task.assignedPerson.email}
                  </a>
                )}
              />

              {/* Created by */}
              {task.createdBy?.name && (
                <InfoCard
                  label="Created By"
                  color="gray"
                  person={task.createdBy}
                  extra={<p className="text-[10px] text-gray-400">Created {fmtFull(task.createdAt)}</p>}
                />
              )}

              {/* Status history */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">Status History</p>
                {task.statusHistory?.length > 0 ? (
                  <ol className="relative border-l-2 border-gray-100 ml-2 space-y-5">
                    {[...task.statusHistory].reverse().map((h, i) => {
                      const hm = STATUS_META[h.status] || {};
                      const Icon = hm.icon;
                      return (
                        <li key={i} className="ml-6 relative">
                          <div className={`absolute -left-[1.75rem] top-0.5 w-5 h-5 rounded-full flex items-center justify-center ${hm.header || 'bg-gray-300'}`}>
                            {Icon && <Icon className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Badge status={h.status} />
                            <span className="text-[10px] text-gray-400">{fmtFull(h.changedAt)}</span>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">{h.description}</p>
                          {h.document?.url && (
                            <button
                              onClick={() => setViewingDoc(h.document)}
                              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-2.5 py-1.5 transition-colors"
                            >
                              <FiPaperclip className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[200px]">{h.document.originalName}</span>
                              {(h.document.mimetype?.startsWith('image/') || h.document.mimetype === 'application/pdf')
                                ? <FiEye className="w-3 h-3 opacity-60 shrink-0" />
                                : <FiDownload className="w-3 h-3 opacity-60 shrink-0" />}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="text-sm text-gray-400 italic text-center py-4">No history recorded yet.</p>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>
      <FileViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />
    </div>
  );
}

function TopBar({ onBack, title }) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center gap-3 shrink-0 sticky top-0 z-10">
      <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
        <FiArrowLeft className="w-5 h-5" />
      </button>
      <h1 className="text-sm sm:text-base font-bold text-gray-900 truncate">{title}</h1>
    </div>
  );
}

function InfoCard({ label, color, person, extra }) {
  const colors = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-100', avatar: 'bg-blue-200 text-blue-700', label: 'text-blue-400' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-100', avatar: 'bg-gray-200 text-gray-500', label: 'text-gray-400' },
  };
  const c = colors[color] || colors.gray;

  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl p-4 sm:p-5`}>
      <p className={`text-[10px] font-semibold uppercase tracking-widest ${c.label} mb-3`}>{label}</p>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full ${c.avatar} flex items-center justify-center shrink-0 text-sm font-bold`}>
          {person?.name?.[0]?.toUpperCase() || <FiUser className="w-4 h-4" />}
        </div>
        <div className="min-w-0 space-y-1 flex-1">
          <p className="text-sm font-bold text-gray-900 truncate">{person?.name || '—'}</p>
          {extra}
          {person?.role && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <FiBriefcase className="w-3 h-3 shrink-0" />
              <span className="truncate">{person.role}</span>
            </div>
          )}
          {person?.institution && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <FiMapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{person.institution}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
