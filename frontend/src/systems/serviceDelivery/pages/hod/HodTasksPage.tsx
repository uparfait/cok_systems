import React, { useCallback, useEffect, useState } from 'react';
import { FiPlus, FiRefreshCw } from 'react-icons/fi';
import { departmentManagerService } from '@/core/services/adminService';
import { useToast } from '@/core/contexts/ToastContext';
import {
  COK, FONT, formatDate,
  HodPageHeader, HodCard, HodStatCard, HodTabBar, HodPagination, HodModal, HodLabel, HodEmpty, HodTh, HodAvatar, HodChip,
} from './hodShared';

interface TeamTask {
  _id: string;
  title: string;
  description?: string;
  status: 'Under-review' | 'In-progress' | 'Completed';
  priority?: string;
  dueDate?: string;
  completedAt?: string;
  incharge?: { _id: string; full_name?: string; email?: string; title?: string } | null;
  createdBy?: { full_name?: string } | null;
}

interface TeamMemberOption { _id: string; full_name?: string; title?: string }

const LIMIT = 20;

const STATUS_COLORS: Record<string, string> = {
  'Under-review': COK.pending,
  'In-progress': COK.warning,
  'Completed': COK.success,
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: COK.gray,
  Medium: COK.pending,
  High: COK.warning,
  Urgent: COK.danger,
};

const HodTasksPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [summary, setSummary] = useState({ 'Under-review': 0, 'In-progress': 0, 'Completed': 0, total: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [selected, setSelected] = useState<TeamTask | null>(null);

  // Assign form state
  const [members, setMembers] = useState<TeamMemberOption[]>([]);
  const [form, setForm] = useState({ title: '', description: '', incharge: '', priority: 'Medium', dueDate: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = tab === 'all' ? undefined : tab;
      const res = await departmentManagerService.getTeamTasks(page, LIMIT, status);
      if (res?.success) {
        setTasks(res.data || []);
        setTotal(res.total || 0);
        if (res.summary) setSummary(res.summary);
      } else {
        showError(res?.message || 'Failed to load team tasks');
      }
    } catch {
      showError('Failed to load team tasks');
    } finally {
      setLoading(false);
    }
  }, [page, tab, showError]);

  useEffect(() => { load(); }, [load]);

  const openAssign = async () => {
    setShowAssign(true);
    if (members.length === 0) {
      try {
        const res = await departmentManagerService.getTeamMembers(1, 100);
        if (res?.success) setMembers(res.data || []);
      } catch { /* member list failure surfaces as empty select */ }
    }
  };

  const submitAssign = async () => {
    if (!form.title.trim()) { showError('Task title is required'); return; }
    if (!form.incharge) { showError('Please select a team member'); return; }
    setSaving(true);
    try {
      const res = await departmentManagerService.createTeamTask({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        incharge: form.incharge,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
      });
      if (res?.success) {
        showSuccess('Task assigned successfully');
        setShowAssign(false);
        setForm({ title: '', description: '', incharge: '', priority: 'Medium', dueDate: '' });
        load();
      } else {
        showError(res?.message || 'Failed to assign task');
      }
    } catch {
      showError('Failed to assign task');
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(Math.ceil(total / LIMIT), 1);
  const completionRate = summary.total > 0 ? Math.round((summary.Completed / summary.total) * 100) : 0;

  const tabs = [
    { key: 'all', label: 'All', count: summary.total, color: COK.primary },
    { key: 'Under-review', label: 'Under Review', count: summary['Under-review'], color: COK.pending },
    { key: 'In-progress', label: 'In Progress', count: summary['In-progress'], color: COK.warning },
    { key: 'Completed', label: 'Completed', count: summary.Completed, color: COK.success },
  ];

  return (
    <div className="p-4">
      <HodPageHeader
        title="Team Tasks"
        subtitle="Assign tasks to your team members and monitor completion"
        actions={
          <>
            <button className="cok-btn-outlined px-3 py-2 text-xs flex items-center gap-1" style={{ borderRadius: 0 }} onClick={load}>
              <FiRefreshCw /> Refresh
            </button>
            <button className="cok-btn-primary px-4 py-2 text-xs flex items-center gap-1" style={{ borderRadius: 0 }} onClick={openAssign}>
              <FiPlus /> Assign Task
            </button>
          </>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <HodStatCard label="Total Tasks" value={summary.total} />
        <HodStatCard label="In Progress" value={summary['In-progress']} accent={COK.warning} />
        <HodStatCard label="Completed" value={summary.Completed} accent={COK.success} />
        <HodStatCard label="Completion Rate" value={`${completionRate}%`} accent={completionRate >= 70 ? COK.success : completionRate >= 40 ? COK.warning : COK.danger} />
      </div>

      <HodCard>
        <HodTabBar tabs={tabs} active={tab} onChange={key => { setTab(key); setPage(1); }} />

        {loading ? (
          <HodEmpty message="Loading tasks..." />
        ) : tasks.length === 0 ? (
          <HodEmpty message="No tasks found. Use “Assign Task” to create one for a team member." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <HodTh>Task</HodTh>
                  <HodTh>Assignee</HodTh>
                  <HodTh>Priority</HodTh>
                  <HodTh>Status</HodTh>
                  <HodTh>Due Date</HodTh>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#F3F4F6' }}>
                {tasks.map(task => (
                  <tr key={task._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(task)}>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-semibold" style={{ color: COK.primary, fontFamily: FONT }}>{task.title}</p>
                      {task.description && <p className="text-xs truncate max-w-[280px]" style={{ color: COK.gray }}>{task.description}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <HodAvatar name={task.incharge?.full_name} />
                        <span className="text-sm" style={{ color: COK.textDark }}>{task.incharge?.full_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <HodChip label={task.priority || 'Medium'} color={PRIORITY_COLORS[task.priority || 'Medium'] || COK.gray} />
                    </td>
                    <td className="px-3 py-2.5">
                      <HodChip label={task.status} color={STATUS_COLORS[task.status] || COK.gray} />
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: COK.gray }}>{formatDate(task.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <HodPagination page={page} totalPages={totalPages} onPage={setPage} />
      </HodCard>

      {showAssign && (
        <HodModal title="Assign Task to Team Member" onClose={() => setShowAssign(false)}>
          <div className="space-y-4">
            <div>
              <HodLabel>Task Title *</HodLabel>
              <input className="cok-auth-input w-full py-2.5 px-3 text-sm" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Prepare weekly service report" />
            </div>
            <div>
              <HodLabel>Description</HodLabel>
              <textarea className="cok-auth-input w-full py-2.5 px-3 text-sm" rows={3} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Details of the task..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <HodLabel>Assign To *</HodLabel>
                <select className="cok-auth-input w-full py-2.5 px-3 text-sm" value={form.incharge}
                  onChange={e => setForm(f => ({ ...f, incharge: e.target.value }))}>
                  <option value="">Select team member...</option>
                  {members.map(m => (
                    <option key={m._id} value={m._id}>{m.full_name}{m.title ? ` — ${m.title}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <HodLabel>Priority</HodLabel>
                <select className="cok-auth-input w-full py-2.5 px-3 text-sm" value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <HodLabel>Due Date</HodLabel>
              <input type="date" className="cok-auth-input w-full py-2.5 px-3 text-sm" value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: COK.border }}>
              <button className="cok-btn-outlined px-4 py-2 text-xs" style={{ borderRadius: 0 }} onClick={() => setShowAssign(false)}>Cancel</button>
              <button className="cok-btn-primary px-4 py-2 text-xs" style={{ borderRadius: 0 }} disabled={saving} onClick={submitAssign}>
                {saving ? 'Assigning...' : 'Assign Task'}
              </button>
            </div>
          </div>
        </HodModal>
      )}

      {selected && (
        <HodModal title="Task Details" onClose={() => setSelected(null)}>
          <table className="w-full">
            <tbody className="divide-y divide-gray-100">
              {[
                ['Title', selected.title],
                ['Description', selected.description || '—'],
                ['Assignee', selected.incharge?.full_name || '—'],
                ['Assigned By', selected.createdBy?.full_name || '—'],
                ['Priority', selected.priority || 'Medium'],
                ['Status', selected.status],
                ['Due Date', formatDate(selected.dueDate)],
                ['Completed At', formatDate(selected.completedAt)],
              ].map(([label, value]) => (
                <tr key={label as string} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide w-1/3" style={{ color: COK.textMid, fontFamily: FONT }}>{label}</td>
                  <td className="px-3 py-2.5 text-sm" style={{ color: COK.textDark }}>{value as string}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </HodModal>
      )}
    </div>
  );
};

export default HodTasksPage;
