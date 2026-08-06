import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { FiSearch } from 'react-icons/fi';
import MainLayout from '../../../core/components/Layout/MainLayout';
import {
  COK,
  CokLoadingOverlay,
  CokPageHeader,
  CokTab,
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

const initialsOf = (name?: string) =>
  (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

// Soft tint background from a 6-digit hex color (for status chips)
const tint = (hex: string) => `${hex}1F`;

// Flat donut chart: colored ring segments with % labels on the slices, the total in
// the center hole, and a legend row on top (reference-image style)
const ActionsDonut: React.FC<{
  total: number;
  segments: Array<{ label: string; value: number; color: string }>;
}> = ({ total, segments }) => {
  const data = segments.filter(s => s.value > 0);
  const sum = data.reduce((s, d) => s + d.value, 0);

  const cx = 110, cy = 110, rO = 96, rI = 58;
  const pt = (r: number, ang: number) => ({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  let angle = -Math.PI / 2;
  const slices = data.map(d => {
    const sweep = (d.value / sum) * Math.PI * 2;
    const a0 = angle, a1 = angle + sweep, mid = angle + sweep / 2;
    angle = a1;
    const o0 = pt(rO, a0), o1 = pt(rO, a1), i0 = pt(rI, a0), i1 = pt(rI, a1);
    const large = sweep > Math.PI ? 1 : 0;
    return {
      ...d,
      mid,
      pct: Math.round((d.value / sum) * 100),
      path: `M ${o0.x} ${o0.y} A ${rO} ${rO} 0 ${large} 1 ${o1.x} ${o1.y} L ${i1.x} ${i1.y} A ${rI} ${rI} 0 ${large} 0 ${i0.x} ${i0.y} Z`,
    };
  });

  return (
    <div className="flex flex-col items-center">
      {/* Legends */}
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mb-3">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs" style={{ fontFamily: COK.headingFont, color: COK.neutralDark }}>
            <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: s.color }}></span>
            {s.label} ({s.value})
          </div>
        ))}
      </div>
      {sum === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-gray-400">No actions recorded yet</div>
      ) : (
        <svg viewBox="0 0 220 220" className="w-full" style={{ maxWidth: 260 }}>
          {slices.map(s => <path key={s.label} d={s.path} fill={s.color} />)}
          {slices.map(s => {
            const lp = pt((rO + rI) / 2, s.mid);
            // Very thin slices keep their % just outside the ring instead of on it
            const outside = s.pct < 6;
            const op = pt(rO + 12, s.mid);
            return (
              <text
                key={`l${s.label}`}
                x={outside ? op.x : lp.x}
                y={outside ? op.y : lp.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="13"
                fontWeight="700"
                fill={outside ? COK.neutralDark : '#ffffff'}
              >
                {s.pct}%
              </text>
            );
          })}
          <text x={cx} y={cy - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="#6b7280" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Total Actions
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="26" fontWeight="800" fill={COK.neutralDark}>
            {total}
          </text>
        </svg>
      )}
    </div>
  );
};

export default function MayorActionsPage() {
  const [actions, setActions] = useState<EventAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

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
        <CokPageHeader title="Actions" />

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
            <div className="overflow-x-auto px-4">
              {/* Same table language as the System Admin reservation list: solid CoK-blue
                  header, hairline row dividers, avatar initials, soft-tint status chips */}
              <table className="w-full min-w-[720px]">
                <thead className="cok-bg-primary sticky top-0 z-10 shadow-sm">
                  <tr>
                    {['Action', 'Assigned To', 'Due Date', 'Status'].map((h) => (
                      <th key={h} className="text-left py-3 px-3 text-xs uppercase tracking-wider font-semibold text-white" style={{ fontFamily: COK.headingFont, letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((a) => {
                    const overdue = isOverdue(a);
                    const status = a.currentStatus?.status || 'Pending';
                    const statusColor = STATUS_COLORS[status] || COK.primary;
                    return (
                      <tr key={a._id} className="h-14" style={{ borderBottom: `1px solid ${COK.border}` }}>
                        <td className="py-3 px-3 max-w-xs">
                          <p style={{ fontFamily: COK.headingFont, fontSize: 13, fontWeight: 600, color: COK.neutralDark, margin: 0 }}>
                            {a.title}
                          </p>
                          {a.actionDescription && (
                            <p className="text-xs text-gray-500 truncate" style={{ margin: '2px 0 0 0', maxWidth: 320 }}>
                              {a.actionDescription}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {isAssigned(a) ? (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: COK.primary, fontFamily: COK.headingFont }}>
                                {initialsOf(a.assignedPerson?.name)}
                              </div>
                              <div>
                                <p className="text-[13px] font-medium" style={{ color: COK.neutralDark, margin: 0 }}>{a.assignedPerson!.name}</p>
                                {a.assignedPerson?.email && (
                                  <p className="text-xs text-gray-400" style={{ margin: 0 }}>{a.assignedPerson.email}</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-[13px] font-medium" style={{ color: overdue ? COK.danger : '#555555' }}>
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
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center px-3 py-1 text-[12px] font-bold uppercase tracking-wide" style={{ backgroundColor: tint(statusColor), color: statusColor }}>
                            {status}
                          </span>
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
            View only actions are managed by the Event Manager's office.
          </div>
        </div>

        {/* Actions overview donut — replaces the old stat cards, placed below the table */}
        <div className="bg-white p-4" style={{ border: `1px solid ${COK.border}` }}>
          <h3 style={{ fontFamily: COK.headingFont, fontSize: 15, fontWeight: 600, color: COK.neutralDark, margin: '0 0 12px 0' }}>
            Actions Overview
          </h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-xs text-gray-400">Loading…</div>
          ) : (
            <ActionsDonut
              total={counts.all}
              segments={[
                { label: 'Over Deadline', value: counts.overdue, color: COK.danger },
                { label: 'Assigned', value: counts.assigned, color: COK.warning },
                { label: 'Completed', value: counts.completed, color: COK.success },
              ]}
            />
          )}
        </div>
      </div>
    </MainLayout>
  );
}
