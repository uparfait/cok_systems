import { useState, useRef } from 'react';
import axios from 'axios';
import {
  FiX, FiMail, FiKey, FiCheckCircle, FiClock, FiActivity,
  FiCalendar, FiArrowLeft, FiUpload, FiAlertCircle, FiPaperclip,
} from 'react-icons/fi';

const BASE_URL = '/cok/api/v1';

const STATUSES = ['Pending', 'In Progress', 'Completed'];

const STATUS_META = {
  Pending:       { header: 'bg-amber-500',  text: 'text-amber-700',  light: 'bg-amber-50',  border: 'border-amber-300',  icon: <FiClock       className="w-3.5 h-3.5" /> },
  'In Progress': { header: 'bg-blue-500',   text: 'text-blue-700',   light: 'bg-blue-50',   border: 'border-blue-300',   icon: <FiActivity    className="w-3.5 h-3.5" /> },
  Completed:     { header: 'bg-green-500',  text: 'text-green-700',  light: 'bg-green-50',  border: 'border-green-300',  icon: <FiCheckCircle className="w-3.5 h-3.5" /> },
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function overdue(due, status) {
  return status !== 'Completed' && new Date(due) < new Date();
}

export default function MyTasksPanel({ onClose }) {
  const [step, setStep]               = useState('email');
  const [email, setEmail]             = useState('');
  const [tokenInput, setTokenInput]   = useState('');
  const [generatedToken, setGeneratedToken] = useState('');
  const [tasks, setTasks]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  // Inline status-change form per card: { taskId, newStatus, desc, file, saving, error }
  const [pending, setPending] = useState(null);

  const dragTask = useRef(null);
  const fileRef  = useRef();

  /* ── email step ── */
  async function handleEmailSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await axios.post(`${BASE_URL}/event-actions/my-tasks/request-token`, { email });
      setGeneratedToken(res.data.token);
      setStep('token');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    } finally { setLoading(false); }
  }

  /* ── token step ── */
  async function handleTokenSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await axios.post(`${BASE_URL}/event-actions/my-tasks/verify-token`, { email, token: tokenInput });
      setTasks(res.data.data || []);
      setStep('board');
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect token.');
    } finally { setLoading(false); }
  }

  /* ── drag ── */
  function onDragStart(task) { dragTask.current = task; }
  function onDragOver(e) { e.preventDefault(); }
  function onDrop(newStatus) {
    const task = dragTask.current;
    dragTask.current = null;
    if (!task || task.currentStatus?.status === newStatus) return;
    setPending({ taskId: task._id, newStatus, desc: '', file: null, saving: false, error: '' });
  }

  /* ── save inline status change ── */
  async function saveStatus(e) {
    e.preventDefault();
    if (!pending.desc.trim()) {
      setPending(p => ({ ...p, error: 'Description is required.' }));
      return;
    }
    setPending(p => ({ ...p, saving: true, error: '' }));
    try {
      const fd = new FormData();
      fd.append('currentStatus[status]', pending.newStatus);
      fd.append('currentStatus[description]', pending.desc.trim());
      if (pending.file) fd.append('document', pending.file);

      const res = await axios.patch(
        `${BASE_URL}/event-actions/${pending.taskId}`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      const updated = res.data.data;
      setTasks(prev => prev.map(t => t._id === pending.taskId ? updated : t));
      setPending(null);
    } catch (err) {
      setPending(p => ({ ...p, saving: false, error: err.response?.data?.message || 'Failed to update.' }));
    }
  }

  const tasksByStatus = (status) => tasks.filter(t => t.currentStatus?.status === status);

  return (
    <div className="fixed inset-0 z-[9990] flex items-stretch">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div style={{ width: '900px', maxWidth: '100vw', height: '100vh' }} className="bg-white flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            {(step === 'token' || step === 'board') && (
              <button
                onClick={() => { setError(''); setPending(null); setStep(step === 'board' ? 'token' : 'email'); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <FiArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-gray-900">My Tasks</h2>
              {email && step !== 'email' && <p className="text-xs text-gray-400">{email}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* ── STEP 1: Email ── */}
          {step === 'email' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-5 w-full max-w-xs">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <FiMail className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-800">Enter your email</p>
                </div>
                <form onSubmit={handleEmailSubmit} className="space-y-2">
                  {error && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-1.5">
                      <FiAlertCircle className="w-3 h-3 shrink-0" />{error}
                    </div>
                  )}
                  <input
                    type="email" required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50"
                  />
                  <button type="submit" disabled={loading}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                    {loading ? 'Checking…' : 'Find Tasks'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── STEP 2: Token ── */}
          {step === 'token' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <div className="w-full max-w-sm">
                <div className="flex flex-col items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                    <FiKey className="w-7 h-7 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Enter your token</h3>
                </div>
                <div className="bg-gray-900 rounded-2xl p-6 mb-6 text-center">
                  <p className="text-xs text-gray-400 mb-2 uppercase tracking-widest">Your access token</p>
                  <p className="text-4xl font-mono font-bold text-white tracking-[0.3em]">{generatedToken}</p>
                  <p className="text-xs text-gray-500 mt-3">Valid for 15 minutes</p>
                </div>
                <form onSubmit={handleTokenSubmit} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
                      <FiAlertCircle className="w-4 h-4 shrink-0" />{error}
                    </div>
                  )}
                  <input
                    type="text" required maxLength={6}
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value.toUpperCase())}
                    placeholder="Enter token above"
                    className="w-full px-4 py-3 text-center text-xl font-mono tracking-[0.3em] border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-gray-50"
                  />
                  <button type="submit" disabled={loading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                    {loading ? 'Verifying…' : 'View My Tasks'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── STEP 3: Kanban board ── */}
          {step === 'board' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-800">{tasks.length}</span> task{tasks.length !== 1 ? 's' : ''} assigned to you
                </p>
                <p className="text-xs text-gray-400 italic">Drag a card to another column to update its status</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', flex: 1, minHeight: 0 }}>
                {STATUSES.map(status => {
                  const meta = STATUS_META[status];
                  const col  = tasksByStatus(status);
                  const showUpload = status === 'In Progress' || status === 'Completed';

                  return (
                    <div
                      key={status}
                      onDragOver={onDragOver}
                      onDrop={() => onDrop(status)}
                      className="flex flex-col rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden"
                    >
                      {/* Column header */}
                      <div className={`${meta.header} px-4 py-3 flex items-center justify-between shrink-0`}>
                        <div className="flex items-center gap-2 text-white">
                          {meta.icon}
                          <span className="text-sm font-semibold">{status}</span>
                        </div>
                        <span className="bg-white/30 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                          {col.length}
                        </span>
                      </div>

                      {/* Cards */}
                      <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {col.length === 0 && (
                          <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center text-xs text-gray-400 italic mt-1">
                            Drop here
                          </div>
                        )}
                        {col.map(t => {
                          const sm = STATUS_META[t.currentStatus?.status] || {};
                          const isPendingThis = pending?.taskId === t._id;

                          return (
                            <div
                              key={t._id}
                              draggable={!isPendingThis}
                              onDragStart={() => !isPendingThis && onDragStart(t)}
                              className={`bg-white border rounded-xl overflow-hidden transition-all select-none ${
                                isPendingThis
                                  ? `border-2 ${sm.border} shadow-lg`
                                  : 'border-gray-200 hover:shadow-md cursor-grab active:cursor-grabbing'
                              }`}
                            >
                              {/* Top color bar */}
                              <div className={`h-1 w-full ${sm.header}`} />

                              <div className="p-3">
                                {/* Status dot + title */}
                                <div className="flex items-start gap-2">
                                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${sm.header}`} />
                                  <p className="text-sm font-semibold text-gray-900 line-clamp-2">{t.title}</p>
                                </div>
                                <p className="text-xs text-gray-400 mt-1 ml-4 line-clamp-2">{t.actionDescription}</p>
                                <div className="flex items-center gap-1.5 mt-2 ml-4 text-xs text-gray-400">
                                  <FiCalendar className={`w-3 h-3 shrink-0 ${overdue(t.dueDate, t.currentStatus?.status) ? 'text-red-400' : ''}`} />
                                  <span className={overdue(t.dueDate, t.currentStatus?.status) ? 'text-red-500 font-semibold' : ''}>
                                    {fmt(t.dueDate)}
                                  </span>
                                  {overdue(t.dueDate, t.currentStatus?.status) && <span className="text-red-400">· Overdue</span>}
                                </div>

                                {/* Attach button — visible on In Progress & Completed cards (not while pending form is open) */}
                                {showUpload && !isPendingThis && (
                                  <div className="mt-3 ml-4">
                                    <label className={`flex items-center gap-1.5 w-max text-xs font-medium px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${sm.text} ${sm.light} ${sm.border} hover:opacity-80`}>
                                      <FiPaperclip className="w-3 h-3" />
                                      Attach document
                                      <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" />
                                    </label>
                                  </div>
                                )}

                                {/* Inline status-change form — shown after drag-drop */}
                                {isPendingThis && (
                                  <form onSubmit={saveStatus} className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                                    <p className={`text-xs font-semibold uppercase tracking-wide ${sm.text}`}>
                                      Moving to {pending.newStatus}
                                    </p>

                                    {pending.error && (
                                      <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                                        {pending.error}
                                      </p>
                                    )}

                                    {/* Description (required) */}
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">
                                        Description <span className="text-red-500">*</span>
                                      </label>
                                      <textarea
                                        required rows={2}
                                        value={pending.desc}
                                        onChange={e => setPending(p => ({ ...p, desc: e.target.value }))}
                                        placeholder="What was done or reason for this change…"
                                        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50 resize-none"
                                      />
                                    </div>

                                    {/* Upload (optional) — only for In Progress & Completed */}
                                    {(pending.newStatus === 'In Progress' || pending.newStatus === 'Completed') && (
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                          Attach document <span className="text-gray-400">(optional)</span>
                                        </label>
                                        <label className={`flex items-center gap-1.5 w-full text-xs font-medium px-2.5 py-2 rounded-lg border border-dashed cursor-pointer transition-colors ${
                                          pending.file
                                            ? `${sm.light} ${sm.border} ${sm.text}`
                                            : 'border-gray-200 text-gray-400 hover:border-blue-300 hover:bg-blue-50'
                                        }`}>
                                          <FiUpload className="w-3 h-3 shrink-0" />
                                          {pending.file ? pending.file.name : 'Click to upload a file'}
                                          <input
                                            ref={fileRef} type="file" className="hidden"
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                            onChange={e => setPending(p => ({ ...p, file: e.target.files[0] || null }))}
                                          />
                                        </label>
                                      </div>
                                    )}

                                    {/* Confirm / Cancel */}
                                    <div className="flex gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => setPending(null)}
                                        className="flex-1 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="submit"
                                        disabled={pending.saving}
                                        className={`flex-1 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-60 ${sm.header}`}
                                      >
                                        {pending.saving ? 'Saving…' : 'Confirm'}
                                      </button>
                                    </div>
                                  </form>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
