import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';
import { FiArrowLeft, FiAlertCircle } from 'react-icons/fi';
import TaskFileViewer from './components/TaskFileViewer';
import TaskProgressIndicator from './components/TaskProgressIndicator';
import TaskTools from './components/TaskTools';
import TaskTopBar from './components/TaskTopBar';
import TaskInfoCard from './components/TaskInfoCard';
import TaskBadge from './components/TaskBadge';
import {
  PRIMARY, BORDER, STATUS_META, fmt, fmtFull, isOverdue
} from './components/TaskDesignTokens';

const BASE_URL = '/cok/api/v1';
const SESSION_KEY = 'my_tasks_cache';

export default function MyTasksTaskPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [task, setTask] = useState(() => location.state?.task || null);
  const [loading, setLoading] = useState(!task);
  const [error, setError] = useState('');
  const [viewingDoc, setViewingDoc] = useState(null);
  const [taskEmail, setTaskEmail] = useState(() => location.state?.email || '');

  const fetchTask = () => {
    if (task) return;
    setLoading(true);
    axios.get(`${BASE_URL}/event-actions/${taskId}`)
      .then(r => setTask(r.data.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load task.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!task) fetchTask();
  }, [taskId, task]);

  async function handleUpdate(newStatus, description, file) {
    const fd = new FormData();
    fd.append('currentStatus[status]', newStatus);
    fd.append('currentStatus[description]', description);
    if (file) fd.append('document', file);

    const res = await axios.patch(`${BASE_URL}/event-actions/${taskId}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const updated = res.data.data;
    setTask(updated);

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
      <div style={{ minHeight: '100vh', backgroundColor: '#F7F9FB', display: 'flex', flexDirection: 'column' }}>
        <TaskTopBar onBack={goBack} title="Task Details" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid #E0F2FE', borderTopColor: PRIMARY, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F7F9FB', display: 'flex', flexDirection: 'column' }}>
        <TaskTopBar onBack={goBack} title="Task Details" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px' }}>
          <FiAlertCircle style={{ width: '40px', height: '40px', color: '#E74C3C' }} />
          <p style={{ fontSize: '14px', textAlign: 'center', color: '#C62828', fontFamily: "'Montserrat', sans-serif" }}>{error || 'Task not found.'}</p>
          <button onClick={goBack} style={{ fontSize: '14px', color: PRIMARY, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: "'Montserrat', sans-serif" }}>Go to My Tasks</button>
        </div>
      </div>
    );
  }

  const od = isOverdue(task.dueDate, task.currentStatus?.status);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F9FB', display: 'flex', flexDirection: 'column' }}>
      <Helmet>
        <title>My Tasks · {task.title || 'Task'}</title>
      </Helmet>
      <TaskTopBar onBack={goBack} title={task.title} />

      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: '1152px', margin: '0 auto', padding: '24px' }}>

          <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: '1fr' }} className="task-main-grid">

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

              <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 0, padding: '20px 24px', boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '12px', justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#333333', lineHeight: '1.4', flex: 1, minWidth: 0, margin: 0, fontFamily: "'Montserrat', sans-serif" }}>{task.title}</h2>
                  <TaskBadge status={task.currentStatus?.status} />
                </div>
                <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '12px', lineHeight: '1.6' }}>{task.actionDescription}</p>
                {task.currentStatus?.description && (
                  <p style={{ fontSize: '12px', color: '#9E9E9E', marginTop: '12px', fontStyle: 'italic', borderLeft: `2px solid #E5E7EB`, paddingLeft: '12px', lineHeight: '1.6' }}>
                    {task.currentStatus.description}
                  </p>
                )}
              </div>

              <TaskTools task={task} />

              <TaskProgressIndicator current={task.currentStatus?.status} onUpdate={handleUpdate} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', borderRadius: 0, border: `1px solid ${od ? '#FCA5A5' : BORDER}`, backgroundColor: od ? '#FEF2F2' : '#FFFFFF' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: od ? '#FECACA' : '#F3F4F6' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={od ? '#DC2626' : '#9E9E9E'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9E9E9E', marginBottom: '4px', fontFamily: "'Montserrat', sans-serif" }}>Due Date</p>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: od ? '#DC2626' : '#333333', margin: 0, fontFamily: "'Montserrat', sans-serif" }}>{fmt(task.dueDate)}</p>
                </div>
                {od && <span style={{ fontSize: '12px', backgroundColor: '#FECACA', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: 0, padding: '4px 12px', fontWeight: 600, flexShrink: 0, fontFamily: "'Montserrat', sans-serif" }}>Overdue</span>}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              <TaskInfoCard
                label="Assigned To"
                color="blue"
                person={task.assignedPerson}
                extra={task.assignedPerson?.email && (
                  <a href={`mailto:${task.assignedPerson.email}`} style={{ fontSize: '12px', color: PRIMARY, textDecoration: 'underline', wordBreak: 'break-all' }}>
                    {task.assignedPerson.email}
                  </a>
                )}
              />

              {task.createdBy?.name && (
                <TaskInfoCard
                  label="Created By"
                  color="gray"
                  person={task.createdBy}
                  extra={<p style={{ fontSize: '10px', color: '#9E9E9E' }}>Created {fmtFull(task.createdAt)}</p>}
                />
              )}

              <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 0, padding: '20px', boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)' }}>
                <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9E9E9E', marginBottom: '16px', fontFamily: "'Montserrat', sans-serif" }}>Status History</p>
                {task.statusHistory?.length > 0 ? (
                  <ol style={{ position: 'relative', borderLeft: `2px solid #F3F4F6`, marginLeft: '8px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {[...task.statusHistory].reverse().map((h, i) => {
                      const hm = STATUS_META[h.status] || {};
                      const Icon = hm.icon;
                      return (
                        <li key={i} style={{ marginLeft: '24px', position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '-28px', top: '2px', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: hm.header || '#9E9E9E' }}>
                            {Icon && <Icon style={{ width: '10px', height: '10px', color: '#FFFFFF' }} />}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <TaskBadge status={h.status} />
                            <span style={{ fontSize: '10px', color: '#9E9E9E' }}>{fmtFull(h.changedAt)}</span>
                          </div>
                          <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.6', margin: 0 }}>{h.description}</p>
                          {h.document?.url && (
                            <button
                              onClick={() => setViewingDoc(h.document)}
                              style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: PRIMARY, backgroundColor: '#E6F4F9', border: '1px solid #BFDBFE', borderRadius: 0, padding: '8px 12px', cursor: 'pointer', transition: 'background-color 0.2s' }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#CCF2FF'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#E6F4F9'; }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{h.document.originalName}</span>
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p style={{ fontSize: '14px', color: '#9E9E9E', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>No history recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <TaskFileViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (min-width: 1024px) {
          .task-main-grid { grid-template-columns: 1fr 360px !important; }
        }
      `}</style>
    </div>
  );
}
