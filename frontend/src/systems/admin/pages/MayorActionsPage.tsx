import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  FiAlertTriangle,
  FiClipboard,
  FiCheck,
  FiUser,
  FiSearch,
} from 'react-icons/fi';
import MainLayout from '../../../core/components/Layout/MainLayout';
import {
  COK,
  CokLoadingOverlay,
  CokPageHeader,
  CokStatCard,
  CokBadge,
  CokTab,
  CokTh,
  CokTableEmpty,
  CokPagination,
} from './mayorCok';

const EVENT_ACTIONS_API = '/cok/api/v1/event-actions';

interface EventAction {
  _id: string;
  title: string;
  actionDescription?: string;
  assignedPerson?: { name?: string; email?: string; role?: string; institution?: string };
  dueDate?: string;
  currentStatus?: { status?: string; description?: string };
  createdBy?: { name?: string; email?: string };
  eventSpecialId?: string;
  createdAt?: string;
}

const STATUS_COLORS: Record<string, string> = {
  Pending: COK.warning,
  'In Progress': COK.primary,
  Completed: COK.success,
  Cancelled: '#9E9E9E',
};

function isOverdue(action: EventAction): boolean {
  const status = action.currentStatus?.status;
  if (status === 'Completed' || status === 'Cancelled') return false;
  if (!action.dueDate) return false;
  return new Date(action.dueDate).getTime() < Date.now();
}

function isAssigned(action: EventAction): boolean {
  return !!action.assignedPerson?.name?.trim();
}

type TabKey = 'all' | 'overdue' | 'assigned' | 'pending' | 'inProgress' | 'completed';

export default function MayorActionsPage() {
  const [actions, setActions] = useState<EventAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const all: EventAction[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const res = await axios.get(`${EVENT_ACTIONS_API}?limit=100&page=${page}`);
          if (!res.data?.success) break;
          all.push(...(res.data.data || []));
          totalPages = res.data.totalPages || 1;
          page += 1;
        } while (page <= totalPages && page <= 5);
        if (!cancelled) setActions(all);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load actions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(
    () => ({
      all: actions.length,
      overdue: actions.filter(isOverdue).length,
      assigned: actions.filter(isAssigned).length,
      pending: actions.filter((a) => a.currentStatus?.status === 'Pending').length,
      inProgress: actions.filter((a) => a.currentStatus?.status === 'In Progress').length,
      completed: actions.filter((a) => a.currentStatus?.status === 'Completed').length,
    }),
    [actions]
  );

  const filtered = useMemo(() => {
    let list = actions;
    if (tab === 'overdue') list = list.filter(isOverdue);
    else if (tab === 'assigned') list = list.filter(isAssigned);
    else if (tab === 'pending') list = list.filter((a) => a.currentStatus?.status === 'Pending');
    else if (tab === 'inProgress') list = list.filter((a) => a.currentStatus?.status === 'In Progress');
    else if (tab === 'completed') list = list.filter((a) => a.currentStatus?.status === 'Completed');

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          (a.title || '').toLowerCase().includes(q) ||
          (a.actionDescription || '').toLowerCase().includes(q) ||
          (a.assignedPerson?.name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [actions, tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  const selectTab = (key: TabKey) => {
    setTab(key);
    setPage(1);
  };

  const onSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const TABS: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'overdue', label: 'Over Deadline', count: counts.overdue },
    { key: 'assigned', label: 'Assigned', count: counts.assigned },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'inProgress', label: 'In Progress', count: counts.inProgress },
    { key: 'completed', label: 'Completed', count: counts.completed },
  ];

  return (
    <MainLayout>
      <div className="p-4 space-y-4" style={{ backgroundColor: COK.neutralLight, minHeight: '100%' }}>
        <CokPageHeader title="Actions" subtitle="Event action items — deadlines, assignments and progress" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <CokStatCard
            label="Total Actions"
            value={counts.all}
            accent={COK.primary}
            loading={loading}
            icon={<FiClipboard className="w-5 h-5" style={{ color: COK.primary }} />}
          />
          <CokStatCard
            label="Over Deadline"
            value={counts.overdue}
            accent={COK.danger}
            loading={loading}
            icon={<FiAlertTriangle className="w-5 h-5" style={{ color: COK.danger }} />}
          />
          <CokStatCard
            label="Assigned"
            value={counts.assigned}
            accent={COK.warning}
            loading={loading}
            icon={<FiUser className="w-5 h-5" style={{ color: COK.warning }} />}
          />
          <CokStatCard
            label="Completed"
            value={counts.completed}
            accent={COK.success}
            loading={loading}
            icon={<FiCheck className="w-5 h-5" style={{ color: COK.success }} />}
          />
        </div>

        <div className="bg-white relative" style={{ border: `1px solid ${COK.border}` }}>
          {loading && <CokLoadingOverlay />}

          <div
            className="flex flex-wrap items-center gap-1 px-2 pt-2"
            style={{ borderBottom: `1px solid ${COK.border}` }}
          >
            {TABS.map((t) => (
              <CokTab key={t.key} label={t.label} count={t.count} active={tab === t.key} onClick={() => selectTab(t.key)} />
            ))}
            <div className="ml-auto flex items-center gap-1 pb-2 pr-1">
              <FiSearch className="w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search actions..."
                className="h-8 px-2 text-sm text-gray-700 focus:outline-none w-44"
                style={{ border: `1px solid ${COK.border}` }}
              />
            </div>
          </div>

          {error && (
            <p className="p-4 text-sm" style={{ color: COK.danger, fontFamily: COK.bodyFont }}>
              Failed to load actions: {error}
            </p>
          )}

          {!error && !loading && filtered.length === 0 && <CokTableEmpty message="No actions found" />}

          {paged.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-auto">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <CokTh>Action</CokTh>
                    <CokTh>Assigned To</CokTh>
                    <CokTh>Due Date</CokTh>
                    <CokTh center>Status</CokTh>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((a, rowIndex) => {
                    const overdue = isOverdue(a);
                    const status = a.currentStatus?.status || 'Pending';
                    return (
                      <tr
                        key={a._id}
                        className={`transition-colors duration-100 ${
                          rowIndex % 2 === 0 ? 'bg-white hover:bg-blue-50/30' : 'bg-gray-50/50 hover:bg-blue-50/30'
                        }`}
                      >
                        <td className="px-4 py-3 border-r border-gray-200 align-top max-w-xs">
                          <p
                            style={{ fontFamily: COK.headingFont, fontSize: 13, fontWeight: 600, color: COK.neutralDark, margin: 0 }}
                          >
                            {a.title}
                          </p>
                          {a.actionDescription && (
                            <p className="text-xs text-gray-500 truncate" style={{ margin: '2px 0 0 0', maxWidth: 320 }}>
                              {a.actionDescription}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 border-r border-gray-200 align-top">
                          {isAssigned(a) ? (
                            <>
                              <p className="text-sm" style={{ color: COK.neutralDark, margin: 0 }}>{a.assignedPerson!.name}</p>
                              {a.assignedPerson?.email && (
                                <p className="text-xs text-gray-400" style={{ margin: 0 }}>{a.assignedPerson.email}</p>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 border-r border-gray-200 align-top whitespace-nowrap">
                          <span className="text-sm" style={{ color: overdue ? COK.danger : COK.neutralDark, fontWeight: overdue ? 600 : 400 }}>
                            {a.dueDate
                              ? new Date(a.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : '—'}
                          </span>
                          {overdue && (
                            <p className="text-[10px] uppercase" style={{ color: COK.danger, fontFamily: COK.headingFont, fontWeight: 700, margin: 0 }}>
                              Overdue
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-center">
                          <CokBadge label={status} color={STATUS_COLORS[status] || COK.primary} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <CokPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={filtered.length}
              onPageChange={setPage}
            />
          )}

          <div
            className="px-4 py-3 text-xs text-gray-400"
            style={{ borderTop: `1px solid ${COK.border}`, fontFamily: COK.bodyFont }}
          >
            View only — actions are managed by the Event Manager's office.
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
