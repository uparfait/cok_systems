import React, { useCallback, useEffect, useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { departmentManagerService, departmentService, normalizeDepartments } from '@/core/services/adminService';
import { useAuth } from '@/core/contexts/AuthContext';
import { useToast } from '@/core/contexts/ToastContext';
import { useSocket } from '@/core/contexts/SocketContext';
import {
  COK, FONT, formatDateTime,
  HodPageHeader, HodCard, HodTabBar, HodPagination, HodModal, HodLabel, HodEmpty, HodChip,
} from './hodShared';

interface Announcement {
  _id: string;
  title: string;
  message: string;
  a_type: 'Announcement' | 'Notice' | 'Directive';
  department_id?: string;
  department_name?: string;
  created_by?: { _id?: string; name?: string; title?: string };
  created_at?: string;
}

interface DepartmentOption { _id: string; name: string; isUnit?: boolean }

const LIMIT = 10;
const ALL_DEPARTMENTS = 'all';

const TYPE_COLORS: Record<string, string> = {
  Announcement: COK.primary,
  Notice: COK.warning,
  Directive: COK.danger,
};

const HodAnnouncementsPage: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { showSuccess, showError } = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [form, setForm] = useState({ title: '', message: '', a_type: 'Announcement', department_id: ALL_DEPARTMENTS });
  const [saving, setSaving] = useState(false);

  const myId = user?.userId || '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await departmentManagerService.getAnnouncements(page, LIMIT, tab === 'all' ? undefined : tab);
      if (res?.success) {
        setItems(res.data || []);
        setTotal(res.total || 0);
      } else {
        showError(res?.message || 'Failed to load announcements');
      }
    } catch (err: any) {
      showError((err as any)?.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [page, tab, showError]);

  useEffect(() => { load(); }, [load]);

  // Real-time: when someone publishes an announcement addressed to this HOD,
  // the backend pushes 'new_announcement' into their private room — refresh the list live
  useEffect(() => {
    if (!socket) return;
    const onNewAnnouncement = (payload: any) => {
      showSuccess(payload?.message || 'New announcement received');
      load();
    };
    socket.on('new_announcement', onNewAnnouncement);
    return () => { socket.off('new_announcement', onNewAnnouncement); };
  }, [socket, load, showSuccess]);

  const openCreate = async () => {
    setShowCreate(true);
    if (departments.length === 0) {
      try {
        // Every department in the city is a valid destination
        const res = await departmentService.getAll();
        if (res?.success) {
          const mains = normalizeDepartments(res.data);
          const flat: DepartmentOption[] = [];
          mains.forEach(dept => {
            flat.push({ _id: dept._id, name: dept.name });
            (dept.sub_departments || []).forEach(sub => {
              flat.push({ _id: sub._id, name: `${dept.name} — ${sub.name}`, isUnit: true });
            });
          });
          setDepartments(flat);
        }
      } catch { /* dropdown keeps only the "All Departments" option */ }
    }
  };

  const submit = async () => {
    if (!form.title.trim()) { showError('Title is required'); return; }
    if (!form.message.trim()) { showError('Message is required'); return; }
    setSaving(true);
    try {
      const res = await departmentManagerService.createAnnouncement({
        title: form.title.trim(),
        message: form.message.trim(),
        a_type: form.a_type,
        department_id: form.department_id,
      });
      if (res?.success) {
        // Backend reports how many department heads were notified (and any skipped)
        showSuccess(res.message || 'Published successfully');
        setShowCreate(false);
        setForm(f => ({ ...f, title: '', message: '', a_type: 'Announcement' }));
        setPage(1);
        load();
      } else {
        showError(res?.message || 'Failed to publish');
      }
    } catch (err: any) {
      // apiClient throws {status:false, message} carrying the backend's actual reason
      showError(err?.message || 'Failed to publish');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      const res = await departmentManagerService.deleteAnnouncement(confirmDelete._id);
      if (res?.success) {
        showSuccess('Announcement retracted');
        setConfirmDelete(null);
        load();
      } else {
        showError(res?.message || 'Failed to retract');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to retract');
    }
  };

  const totalPages = Math.max(Math.ceil(total / LIMIT), 1);

  const tabs = [
    { key: 'all', label: 'All', color: COK.primary },
    { key: 'Announcement', label: 'Announcements', color: TYPE_COLORS.Announcement },
    { key: 'Notice', label: 'Notices', color: TYPE_COLORS.Notice },
    { key: 'Directive', label: 'Directives', color: TYPE_COLORS.Directive },
  ];

  return (
    <div className="p-4">
      <HodPageHeader
        title="Announcements & Directives"
        subtitle="Publish to any department (or all)  announcements addressed to your department appear here too"
        actions={
          <button className="cok-btn-primary px-4 py-2 text-xs flex items-center gap-1" style={{ borderRadius: 0 }} onClick={openCreate}>
            <FiPlus /> New Publication
          </button>
        }
      />

      <HodCard>
        <HodTabBar tabs={tabs} active={tab} onChange={key => { setTab(key); setPage(1); }} />

        {loading ? (
          <HodEmpty message="Loading..." />
        ) : items.length === 0 ? (
          <HodEmpty message="Nothing here yet. Publications addressed to your department, to all departments, or sent by you will appear here." />
        ) : (
          <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
            {items.map(item => {
              const mine = !!myId && item.created_by?._id === myId;
              return (
                <div key={item._id} className="px-4 py-3 bg-gray-50 hover:bg-gray-100 border-b border-gray-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <HodChip label={item.a_type} color={TYPE_COLORS[item.a_type] || COK.primary} />
                        <HodChip
                          label={item.department_id === ALL_DEPARTMENTS ? 'All Departments' : (item.department_name || 'Department')}
                          color={item.department_id === ALL_DEPARTMENTS ? COK.success : COK.gray}
                        />
                        {mine && <HodChip label="Sent by you" color={COK.pending} />}
                        <p className="text-sm font-bold" style={{ color: COK.primary, fontFamily: FONT }}>{item.title}</p>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: COK.textMid }}>{item.message}</p>
                      <p className="text-xs mt-1.5" style={{ color: COK.gray }}>
                        by {item.created_by?.name || '—'}{item.created_by?.title ? ` (${item.created_by.title})` : ''} · {formatDateTime(item.created_at)}
                      </p>
                    </div>
                    {mine && (
                      <button
                        className="p-2 shrink-0"
                        style={{ color: COK.danger }}
                        title="Retract"
                        onClick={() => setConfirmDelete(item)}
                      >
                        <FiTrash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <HodPagination page={page} totalPages={totalPages} onPage={setPage} />
      </HodCard>

      {showCreate && (
        <HodModal title="Publish Announcement" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <HodLabel>Type *</HodLabel>
                <select className="cok-auth-input w-full py-2.5 px-3 text-sm" value={form.a_type}
                  onChange={e => setForm(f => ({ ...f, a_type: e.target.value }))}>
                  <option value="Announcement">Announcement</option>
                  <option value="Notice">Notice</option>
                  <option value="Directive">Directive</option>
                </select>
              </div>
              <div>
                <HodLabel>Send To *</HodLabel>
                <select className="cok-auth-input w-full py-2.5 px-3 text-sm" value={form.department_id}
                  onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
                  <option value={ALL_DEPARTMENTS}>All Departments</option>
                  {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <HodLabel>Title *</HodLabel>
              <input className="cok-auth-input w-full py-2.5 px-3 text-sm" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Monthly coordination meeting" />
            </div>
            <div>
              <HodLabel>Message *</HodLabel>
              <textarea className="cok-auth-input w-full py-2.5 px-3 text-sm" rows={5} value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Write the full announcement, notice or directive..." />
            </div>
            <p className="text-xs" style={{ color: COK.gray }}>
              {form.department_id === ALL_DEPARTMENTS
                ? 'The system will find every department head and notify them. Departments without an assigned head are skipped and reported back to you.'
                : 'The system will find the selected department’s head and notify them. If that department has no head assigned, nothing is sent and you will be told.'}
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: COK.border }}>
              <button className="cok-btn-outlined px-4 py-2 text-xs" style={{ borderRadius: 0 }} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="cok-btn-primary px-4 py-2 text-xs" style={{ borderRadius: 0 }} disabled={saving} onClick={submit}>
                {saving ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </HodModal>
      )}

      {confirmDelete && (
        <HodModal title="Retract Publication" onClose={() => setConfirmDelete(null)} maxWidth="max-w-md">
          <p className="text-sm" style={{ color: COK.textMid }}>
            Retract “{confirmDelete.title}”? Recipients will no longer see it in their announcements.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <button className="cok-btn-outlined px-4 py-2 text-xs" style={{ borderRadius: 0 }} onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button
              className="px-4 py-2 text-xs font-semibold uppercase text-white"
              style={{ backgroundColor: COK.danger, borderRadius: 0, fontFamily: FONT, letterSpacing: '1px' }}
              onClick={doDelete}
            >
              Retract
            </button>
          </div>
        </HodModal>
      )}
    </div>
  );
};

export default HodAnnouncementsPage;
