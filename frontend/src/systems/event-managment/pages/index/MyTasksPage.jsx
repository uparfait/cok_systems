import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';
import {
  FiArrowLeft, FiMail, FiAlertCircle,
  FiClock, FiActivity, FiCheckCircle, FiCalendar, FiUser, FiChevronRight,
} from 'react-icons/fi';

const BASE_URL    = '/cok/api/v1';
const SESSION_KEY = 'my_tasks_cache';

const STATUSES = ['Pending', 'In Progress', 'Completed'];

const STATUS_META = {
  Pending:       { header: 'bg-amber-500',  text: 'text-amber-700',  light: 'bg-amber-50',  border: 'border-amber-200', badge: 'bg-amber-100  text-amber-700  border-amber-200',  Icon: FiClock },
  'In Progress': { header: 'bg-blue-500',   text: 'text-blue-700',   light: 'bg-blue-50',   border: 'border-blue-200',  badge: 'bg-blue-100   text-blue-700   border-blue-200',   Icon: FiActivity },
  Completed:     { header: 'bg-green-500',  text: 'text-green-700',  light: 'bg-green-50',  border: 'border-green-200', badge: 'bg-green-100  text-green-700  border-green-200',  Icon: FiCheckCircle },
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function isOverdue(due, status) {
  return status !== 'Completed' && new Date(due) < new Date();
}

export default function MyTasksPage() {
  const navigate = useNavigate();

  const [step, setStep]               = useState('email');
  const [email, setEmail]             = useState('');
  const [tokenInput, setTokenInput]   = useState('');
  const [tasks, setTasks]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [sent, setSent]               = useState(false);

  /* Restore cached session so Back from detail returns to board */
  useEffect(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (cached?.email && Array.isArray(cached.tasks)) {
        setEmail(cached.email);
        setTasks(cached.tasks);
        setStep('board');
      }
    } catch {}
  }, []);

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await axios.post(`${BASE_URL}/event-actions/my-tasks/request-token`, { email });
      if (res.data.success) {
        setSent(true);
        setStep('token');
      } else {
        setError(res.data.message || 'Something went wrong.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    } finally { setLoading(false); }
  }

  async function handleResendToken() {
    setLoading(true); setError('');
    try {
      const res = await axios.post(`${BASE_URL}/event-actions/my-tasks/request-token`, { email });
      if (res.data.success) {
        setSent(true);
      } else {
        setError(res.data.message || 'Failed to resend token.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend token.');
    } finally { setLoading(false); }
  }

  async function handleTokenSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await axios.post(`${BASE_URL}/event-actions/my-tasks/verify-token`, { email, token: tokenInput });
      const fetched = res.data.data || [];
      setTasks(fetched);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email, tasks: fetched }));
      setStep('board');
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect token.');
    } finally { setLoading(false); }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setStep('email'); setEmail(''); setTokenInput(''); setTasks([]); setSent(false);
  }

  const byStatus = (s) => tasks.filter(t => t.currentStatus?.status === s);

  return (
    <div className="min-h-screen w-ful items-centerl bg-gray-50 flex flex-col">
      <Helmet>
        <title>My Tasks</title>
      </Helmet>

      {/* Top bar */}
      <div className="bg-white  px-4 sm:px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
         
          {/* up card */}
          <div className="flex-1 flex items-start justify-center px-8 pt-12"></div>
        <div className="flex-1 min-w-0">
        
          {email && step === 'board' && (
            <p className="text-xs text-gray-400 truncate">{email} · {tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        {step === 'board' && (
          <button onClick={logout} className="text-xs text-gray-400 hover:text-red-500 shrink-0 transition-colors">
            Sign out
          </button>
        )}
      </div>

      {/* ── Email step ── */}
      {step === 'email' && (
        <div className="flex-1 flex items-start justify-center px-6 pt-10">
          
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <FiMail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Enter your email</p>
                <p className="text-xs text-gray-400 mt-0.5">We'll find tasks assigned to you</p>
              </div>
            </div>
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              {error && <ErrorBox>{error}</ErrorBox>}
              <input type="email" required value={email}  onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-gray-50" />
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                {loading ? 'Checking…' : 'Find My Tasks'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Token step ── */}
      {step === 'token' && (
        <div className="flex-1 flex h-max w-max justify-center p-6">
          <div className="w-full max-w-sm">

            <div className="flex flex-col items-center gap-2 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center">
                <FiMail className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Check your email</h2>
              <p className="text-xs text-gray-500 text-center">We sent a 6-character access token to <strong>{email}</strong></p>
            </div>

            <form onSubmit={handleTokenSubmit} className="space-y-3">
              {error && <ErrorBox>{error}</ErrorBox>}
              <input type="text" required maxLength={6} value={tokenInput}
                onChange={e => setTokenInput(e.target.value.toUpperCase())}
                placeholder="Enter 6-character token"
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.4em] border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-gray-50" />
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                {loading ? 'Verifying…' : 'View My Tasks'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button type="button" onClick={handleResendToken} disabled={loading}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-60">
                {loading ? 'Sending…' : 'Resend token'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Board ── */}
      {step === 'board' && (
        <div className="flex-1 p-4 sm:p-6">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
              <FiCheckCircle className="w-14 h-14 mb-3" />
              <p className="text-base font-semibold text-gray-400">No tasks assigned to you</p>
              <p className="text-xs text-gray-400 mt-1">{email}</p>
            </div>
          ) : (
            /* Stack on mobile, 3 columns on md+ */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {STATUSES.map(status => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={byStatus(status)}
                  onOpen={t => navigate(`/my-tasks/${t._id}`, { state: { task: t, email } })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ status, tasks, onOpen }) {
  const { header, Icon, text } = STATUS_META[status];
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
      {/* Column header */}
      <div className={`${header} px-4 py-3 flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-2 text-white">
          <Icon className="w-4 h-4" />
          <span className="text-sm font-semibold">{status}</span>
        </div>
        <span className="bg-white/25 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="p-3 space-y-2 flex-1">
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-200">
            <Icon className="w-7 h-7 mb-1.5" />
            <p className="text-xs italic text-gray-300">No tasks here</p>
          </div>
        )}
        {tasks.map(t => (
          <button
            key={t._id}
            onClick={() => onOpen(t)}
            className="w-full text-left border border-gray-100 rounded-xl p-3 hover:border-gray-300 hover:shadow-sm transition-all group bg-gray-50 hover:bg-white"
          >
            <div className="flex items-start gap-2 justify-between">
              <p className="text-sm font-semibold text-gray-800 line-clamp-2 flex-1">{t.title}</p>
              <FiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 mt-0.5 transition-colors" />
            </div>
            {t.actionDescription && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-1">{t.actionDescription}</p>
            )}
            <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-gray-100">
              {t.assignedPerson?.name && (
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <FiUser className="w-3 h-3 shrink-0" />
                  <span className="truncate max-w-[80px]">{t.assignedPerson.name}</span>
                </span>
              )}
              <span className={`flex items-center gap-1 text-[11px] ml-auto ${isOverdue(t.dueDate, t.currentStatus?.status) ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                <FiCalendar className="w-3 h-3 shrink-0" />
                {fmt(t.dueDate)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ErrorBox({ children }) {
  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-3 py-2">
      <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />{children}
    </div>
  );
}
