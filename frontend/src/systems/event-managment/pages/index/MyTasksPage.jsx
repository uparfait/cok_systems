import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';
import {
  FiMail, FiClock, FiActivity, FiCheckCircle,
  FiCalendar, FiUser, FiChevronRight,
} from 'react-icons/fi';
import { ErrorBox, PRIMARY, PRIMARY_DARK, BORDER, WHITE, fontHeading, cokInputStyle, cokLabelStyle, cokBtnStyle, STATUSES, STATUS_META, fmt, isOverdue } from './components/TaskDesignTokens';

const BASE_URL = '/cok/api/v1';
const SESSION_KEY = 'my_tasks_cache';

export default function MyTasksPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

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
    setLoading(true);
    setError('');
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
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${BASE_URL}/event-actions/my-tasks/request-token`, { email });
      setSent(res.data.success);
      if (!res.data.success) setError(res.data.message || 'Failed to resend token.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend token.');
    } finally { setLoading(false); }
  }

  async function handleTokenSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
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
    setStep('email');
    setEmail('');
    setTokenInput('');
    setTasks([]);
    setSent(false);
  }

  const byStatus = (s) => tasks.filter(t => t.currentStatus?.status === s);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F9FB', display: 'flex', flexDirection: 'column', width: '100%', paddingTop: '80px' }}>
      <Helmet><title>My Tasks</title></Helmet>

      <div style={{ backgroundColor: 'transparent', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: '11px', color: '#9E9E9E', fontFamily: fontHeading }}>
          {email && step === 'board' && (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email} · {tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        {step === 'board' && (
          <button onClick={logout} style={{ fontSize: '11px', color: PRIMARY, background: '#FFFFFF', border: `1px solid ${PRIMARY}`, cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600, fontFamily: fontHeading, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 12px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.color = PRIMARY; }}>
            Sign out
          </button>
        )}
      </div>

      {step === 'email' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 24px' }}>
          <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 0, padding: '40px', width: '100%', maxWidth: '400px', boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: '#E6F4F9' }}>
                <FiMail style={{ width: '20px', height: '20px', color: PRIMARY }} />
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#333333', margin: 0, fontFamily: fontHeading }}>Enter your email</p>
                <p style={{ fontSize: '12px', color: '#9E9E9E', marginTop: '2px' }}>We'll find tasks assigned to you</p>
              </div>
            </div>
            <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {error && <ErrorBox>{error}</ErrorBox>}
              <div>
                <label style={cokLabelStyle()} htmlFor="my-tasks-email">Email Address</label>
                 <input
                   id="my-tasks-email"
                   type="email"
                   required
                   value={email}
                   onChange={e => setEmail(e.target.value)}
                   placeholder="your@email.com"
                   style={cokInputStyle()}
                   className="task-input"
                 />
              </div>
              <button type="submit" disabled={loading} style={cokBtnStyle('primary', loading)} onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = PRIMARY_DARK; }} onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = PRIMARY; }}>
                {loading ? 'Checking…' : 'Find My Tasks'}
              </button>
            </form>
          </div>
        </div>
      )}

      {step === 'token' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#D1FAE5' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#333333', margin: 0, fontFamily: fontHeading, textAlign: 'center' }}>Check your email</h2>
              <p style={{ fontSize: '12px', color: '#6B7280', textAlign: 'center', margin: 0 }}>We sent a 6-character access token to <strong>{email}</strong></p>
            </div>

            <form onSubmit={handleTokenSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {error && <ErrorBox>{error}</ErrorBox>}
              <div>
                <label style={cokLabelStyle()} htmlFor="my-tasks-token">Access Token</label>
                <input
                  id="my-tasks-token"
                  type="text"
                  required
                  maxLength={6}
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value.toUpperCase())}
                  placeholder="Enter 6-character token"
                   style={{ ...cokInputStyle(), textAlign: 'center', fontSize: '20px', fontFamily: "'Courier New', monospace", letterSpacing: '0.4em', padding: '16px' }}
                   className="task-input"
                 />
              </div>
              <button type="submit" disabled={loading} style={cokBtnStyle('primary', loading)} onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = PRIMARY_DARK; }} onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = PRIMARY; }}>
                {loading ? 'Verifying…' : 'View My Tasks'}
              </button>
            </form>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button type="button" onClick={handleResendToken} disabled={loading} style={{ fontSize: '12px', color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: fontHeading, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                {loading ? 'Sending…' : 'Resend token'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'board' && (
        <div style={{ flex: 1, padding: '24px' }}>
          {tasks.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', color: '#D1D5DB' }}>
              <FiCheckCircle style={{ width: '56px', height: '56px', marginBottom: '12px' }} />
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#9E9E9E', margin: 0, fontFamily: fontHeading }}>No tasks assigned to you</p>
              <p style={{ fontSize: '12px', color: '#9E9E9E', marginTop: '4px' }}>{email}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(3, 1fr)' }} className="board-grid">
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
      <style>{`
        .task-input {
          border: 1px solid transparent !important;
          box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.1) !important;
          transition: border-color 0.3s ease, box-shadow 0.3s ease !important;
        }
        .task-input:hover {
          border-color: #B0BEC5 !important;
        }
        .task-input:focus {
          border-color: #056daa !important;
          box-shadow: 0px 4px 8px rgba(7, 142, 206, 0.25) !important;
        }
        .board-grid {
          grid-template-columns: repeat(3, 1fr) !important;
        }
        @media (max-width: 767px) {
          .board-grid {
            display: flex !important;
            gap: 16px !important;
            overflow-x: auto !important;
            padding-bottom: 12px !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .board-grid > * {
            flex: 0 0 280px !important;
            min-width: 280px !important;
          }
        }
      `}</style>
    </div>
  );
}

function KanbanColumn({ status, tasks, onOpen }) {
  const m = STATUS_META[status] || { header: '#9E9E9E', text: '#FFFFFF', light: '#F3F4F6', border: '#E5E7EB', bg: '#F3F4F6', icon: FiClock };

  return (
    <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ backgroundColor: m.header, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
          <m.icon style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: fontHeading, letterSpacing: '0.3px' }}>{status}</span>
        </div>
        <span style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, borderRadius: 0, width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fontHeading }}>
          {tasks.length}
        </span>
      </div>

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {tasks.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', color: '#E5E7EB' }}>
            <m.icon style={{ width: '28px', height: '28px', marginBottom: '8px' }} />
            <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#D1D5DB' }}>No tasks here</p>
          </div>
        )}
        {tasks.map(t => (
          <button
            key={t._id}
            onClick={() => onOpen(t)}
            style={{
              width: '100%',
              textAlign: 'left',
              border: `1px solid #F3F4F6`,
              borderRadius: 0,
              padding: '12px',
              backgroundColor: '#F7F9FB',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#E5E7EB';
              e.currentTarget.style.backgroundColor = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#F3F4F6';
              e.currentTarget.style.backgroundColor = '#F7F9FB';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#333333', lineHeight: '1.4', flex: 1, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.title}</p>
              <FiChevronRight style={{ width: '16px', height: '16px', color: '#D1D5DB', flexShrink: 0, marginTop: '2px', transition: 'color 0.2s' }} />
            </div>
            {t.actionDescription && (
              <p style={{ fontSize: '12px', color: '#9E9E9E', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{t.actionDescription}</p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid #F3F4F6' }}>
              {t.assignedPerson?.name && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9E9E9E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                  <FiUser style={{ width: '12px', height: '12px', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.assignedPerson.name}</span>
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', marginLeft: 'auto', color: isOverdue(t.dueDate, t.currentStatus?.status) ? '#DC2626' : '#9E9E9E', fontWeight: isOverdue(t.dueDate, t.currentStatus?.status) ? 600 : 400 }}>
                <FiCalendar style={{ width: '12px', height: '12px', flexShrink: 0 }} />
                {fmt(t.dueDate)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
