import React, { useState, useEffect, useMemo } from 'react';
import { statisticsService, employeeService } from '../../../../core/services/adminService';

// Chart colors — the admin variant of the overview page's CC palette
const CC = { blue: '#056daa', teal: '#2980B9', amber: '#F39C12', red: '#E74C3C' };

interface EmployeeStats { total: number; active: number; inactive: number; locked: number; online: number; offline: number }

// 3D-style exploded pie (SVG) — separated slices with extruded depth, % labels on slices, callout lines to names
const StatusPie3D: React.FC<{ slices: Array<{ label: string; value: number; color: string }> }> = ({ slices }) => {
  const data = slices.filter(s => s.value > 0);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (!total) return <div className="h-40 flex items-center justify-center text-xs text-gray-400">No employee accounts yet</div>;

  // Geometry: squashed ellipse pie with per-slice explode offset and a darker extruded side wall
  const cx = 280, cy = 112, rx = 104, squash = 0.55, ry = rx * squash, depth = 24, explode = 13;
  const shade = (hex: string, f: number) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
  };

  let angle = -Math.PI / 2;
  const parts = data.map(d => {
    const sweep = (d.value / total) * Math.PI * 2;
    const p = { ...d, a0: angle, a1: angle + sweep, mid: angle + sweep / 2 };
    angle += sweep;
    return p;
  });

  const off = (p: { mid: number }) => ({ ox: Math.cos(p.mid) * explode, oy: Math.sin(p.mid) * explode * squash });
  const pt = (ang: number, ox: number, oy: number) => ({ x: cx + ox + rx * Math.cos(ang), y: cy + oy + ry * Math.sin(ang) });

  const topPath = (p: typeof parts[0]) => {
    const { ox, oy } = off(p);
    const s = pt(p.a0, ox, oy), e = pt(p.a1, ox, oy);
    const large = p.a1 - p.a0 > Math.PI ? 1 : 0;
    return `M ${cx + ox} ${cy + oy} L ${s.x} ${s.y} A ${rx} ${ry} 0 ${large} 1 ${e.x} ${e.y} Z`;
  };

  // Side wall only for the front-facing rim (angles between 0 and PI in screen space)
  const wallPath = (p: typeof parts[0]) => {
    const lo = Math.max(p.a0, 0), hi = Math.min(p.a1, Math.PI);
    if (lo >= hi) return null;
    const { ox, oy } = off(p);
    const s = pt(lo, ox, oy), e = pt(hi, ox, oy);
    const large = hi - lo > Math.PI ? 1 : 0;
    return `M ${s.x} ${s.y} A ${rx} ${ry} 0 ${large} 1 ${e.x} ${e.y} L ${e.x} ${e.y + depth} A ${rx} ${ry} 0 ${large} 0 ${s.x} ${s.y + depth} Z`;
  };

  return (
    <svg viewBox="0 0 560 235" className="w-full" style={{ maxWidth: 640, margin: '0 auto', display: 'block' }}>
      {parts.map(p => { const w = wallPath(p); return w ? <path key={`w${p.label}`} d={w} fill={shade(p.color, 0.72)} /> : null; })}
      {parts.map(p => <path key={`t${p.label}`} d={topPath(p)} fill={p.color} />)}
      {parts.map(p => {
        const { ox, oy } = off(p);
        const lx = cx + ox + rx * 0.58 * Math.cos(p.mid);
        const ly = cy + oy + ry * 0.58 * Math.sin(p.mid);
        const pct = Math.round((p.value / total) * 100);
        return (
          <text key={`p${p.label}`} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="19" fontWeight="800" fill="#fff" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
            {pct}%
          </text>
        );
      })}
      {parts.map(p => {
        const right = Math.cos(p.mid) >= 0;
        const sx = cx + Math.cos(p.mid) * (rx + explode + 2);
        const sy = cy + Math.sin(p.mid) * (ry + explode * squash + 2) + (Math.sin(p.mid) > 0 ? depth : 0);
        const ex = cx + (right ? 1 : -1) * (rx + 46);
        const ey = sy + (Math.sin(p.mid) > 0 ? 14 : -14);
        return (
          <g key={`c${p.label}`}>
            <polyline points={`${sx},${sy} ${ex},${ey} ${ex + (right ? 22 : -22)},${ey}`} fill="none" stroke="#9E9E9E" strokeWidth="1" />
            <text x={ex + (right ? 26 : -26)} y={ey} textAnchor={right ? 'start' : 'end'} dominantBaseline="middle" fontSize="11" fontWeight="600" fill="#333333">
              {p.label} ({p.value})
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/**
 * "Employee account status" card (activation / lock / online) with its
 * click-to-view employees modal. Moved here from the mayor overview page.
 */
const EmployeeAccountStatusCard: React.FC = () => {
  const [stats, setStats] = useState<EmployeeStats>({ total: 0, active: 0, inactive: 0, locked: 0, online: 0, offline: 0 });
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'locked' | 'online' | 'offline'>('all');

  // The employee list is only needed by the modal's table — fetched 50 per page while it is open
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res: any = await statisticsService.getEmployeeStats();
        const s = res?.data || res || {};
        // is_active only tracks who is online right now; account status
        // comes from is_account_activated (activated / not_activated)
        if (!ignore) setStats({
          total: s.total || 0,
          active: s.activated || 0,
          inactive: s.not_activated || 0,
          locked: s.locked || 0,
          online: s.active || 0,
          offline: s.inactive || 0,
        });
      } catch { /* the card keeps its zero counts */ }
    })();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    (async () => {
      try {
        const res: any = await employeeService.getAll(page, PAGE_SIZE);
        if (!ignore && (res?.status || res?.success)) {
          setEmployees(Array.isArray(res.data) ? res.data : []);
          setTotal(res.total || 0);
        }
      } catch { /* the modal shows its empty state */ }
    })();
    return () => { ignore = true; };
  }, [open, page]);

  const filtered = useMemo(
    () => employees.filter((e: any) =>
      filter === 'all' ? true
      : filter === 'locked' ? !!e.access_control?.is_locked
      : filter === 'active' ? !!e.is_account_activated
      : filter === 'online' ? !!e.is_active
      : filter === 'offline' ? !e.is_active
      : !e.is_account_activated
    ),
    [employees, filter]
  );

  return (
    <>
      <div
        onClick={() => { setFilter('all'); setPage(1); setOpen(true); }}
        className="bg-white border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all"
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">Employee account status</div>
            <div className="text-xs text-gray-500">Activation, lock and online state</div>
          </div>
          <span className="text-xs text-gray-400">Click to view employees</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs mb-3">
          <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#056daa]"></div>Activated {stats.active}</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#F39C12]"></div>Not activated {stats.inactive}</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#E74C3C]"></div>Locked {stats.locked}</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#4CAF50]"></div>Online {stats.online}</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#9E9E9E]"></div>Offline {stats.offline}</div>
        </div>
        <StatusPie3D
          slices={[
            { label: 'Activated', value: stats.active, color: CC.blue },
            { label: 'Not activated', value: stats.inactive, color: CC.amber },
            { label: 'Locked', value: stats.locked, color: CC.red },
            { label: 'Online', value: stats.online, color: CC.teal },
            { label: 'Offline', value: stats.offline, color: '#9E9E9E' },
          ]}
        />
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4" onClick={() => setOpen(false)}>
          <div className="bg-white w-full max-w-4xl mx-2 sm:mx-4 max-h-[90vh] sm:max-h-[85vh] overflow-y-auto" style={{ borderRadius: 0 }} onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Employee Account Status</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-4 space-y-4">
              {/* Status filter chips with counts from the backend stats endpoint, same source as the pie */}
              <div className="flex flex-wrap gap-2">
                {([
                  { key: 'all', label: 'All', count: stats.total, chip: 'bg-gray-100 text-gray-700 border-gray-300' },
                  { key: 'active', label: 'Activated', count: stats.active, chip: 'bg-[rgba(76,175,80,0.12)] text-[#388E3C] border-[#4CAF50]' },
                  { key: 'inactive', label: 'Not activated', count: stats.inactive, chip: 'bg-[rgba(243,156,18,0.12)] text-[#F39C12] border-[#F39C12]' },
                  { key: 'locked', label: 'Locked', count: stats.locked, chip: 'bg-[rgba(231,76,60,0.12)] text-[#E74C3C] border-[#E74C3C]' },
                  { key: 'online', label: 'Online', count: stats.online, chip: 'bg-[rgba(41,128,185,0.12)] text-[#2980B9] border-[#2980B9]' },
                  { key: 'offline', label: 'Offline', count: stats.offline, chip: 'bg-gray-200 text-gray-600 border-gray-400' },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 text-xs font-semibold border transition-colors ${f.chip} ${filter === f.key ? 'ring-2 ring-[#056daa]' : 'opacity-80 hover:opacity-100'}`}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>
              {filtered.length === 0 ? (
                <div className="border-2 border-gray-300 px-4 py-16 text-center bg-white">
                  <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">No employees in this status</span>
                </div>
              ) : (
                <div className="overflow-auto max-h-80 border-2 border-gray-300">
                  <table className="w-full border-collapse table-auto min-w-[560px]">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        {['Name', 'Email', 'Department', 'Status'].map(label => (
                          <th key={label} className="cok-primary-bg text-white px-4 py-3.5 text-left text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((e: any, idx: number) => {
                        const locked = !!e.access_control?.is_locked;
                        const isLast = idx === filtered.length - 1;
                        const cell = (colIdx: number) =>
                          `px-4 py-3 ${colIdx === 0 ? '' : 'border-l border-[#E0E0E0]'} ${isLast ? '' : 'border-b border-[#E0E0E0]'}`;
                        return (
                          <tr key={idx} className={`transition-colors duration-100 ${idx % 2 === 0 ? 'bg-white hover:bg-[#F7F9FB]' : 'bg-gray-50/50 hover:bg-[#F7F9FB]'}`}>
                            <td className={`${cell(0)} whitespace-nowrap`}>
                              <span className="font-bold text-gray-900 text-sm">{e.full_name || '—'}</span>
                            </td>
                            <td className={`${cell(1)} break-all`}>
                              <span className="text-sm text-gray-700">{e.email || '—'}</span>
                            </td>
                            <td className={cell(2)}>
                              <span className="text-sm text-gray-700 font-medium">{e.department?.department_name || e.department?.name || e.department_name || '—'}</span>
                            </td>
                            <td className={cell(3)}>
                              <div className="flex flex-wrap gap-1">
                                <span className={`inline-block border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${e.is_account_activated ? 'bg-[rgba(76,175,80,0.12)] text-[#388E3C] border-[#4CAF50]' : 'bg-[rgba(243,156,18,0.12)] text-[#F39C12] border-[#F39C12]'}`}>
                                  {e.is_account_activated ? 'Activated' : 'Not activated'}
                                </span>
                                {locked && (
                                  <span className="inline-block border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide bg-[rgba(231,76,60,0.12)] text-[#E74C3C] border-[#E74C3C]">
                                    Locked
                                  </span>
                                )}
                                <span className={`inline-block border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${e.is_active ? 'bg-[rgba(41,128,185,0.12)] text-[#2980B9] border-[#2980B9]' : 'bg-gray-200 text-gray-600 border-gray-400'}`}>
                                  {e.is_active ? 'Active' : 'Offline'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Server-side pagination, 50 employees per page */}
              {total > PAGE_SIZE && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
                  <span>
                    Page <span className="font-semibold">{page}</span> of{' '}
                    <span className="font-semibold">{Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
                    {' '}· {total} employees
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1.5 border border-[#056daa] bg-white text-[#056daa] font-semibold uppercase hover:bg-[#F7F9FB] disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ letterSpacing: '1px' }}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= Math.ceil(total / PAGE_SIZE)}
                      className="px-3 py-1.5 border border-[#056daa] bg-white text-[#056daa] font-semibold uppercase hover:bg-[#F7F9FB] disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ letterSpacing: '1px' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EmployeeAccountStatusCard;
