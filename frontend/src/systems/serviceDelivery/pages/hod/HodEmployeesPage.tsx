import React, { useCallback, useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { departmentManagerService } from '@/core/services/adminService';
import { useToast } from '@/core/contexts/ToastContext';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

const PRIMARY = '#056daa';
const NEUTRAL_DARK = '#333333';
const GRAY_MID = '#555555';
const GRAY = '#9E9E9E';
const BORDER = '#E0E0E0';
const FONT = "'Montserrat', sans-serif";

interface TeamMember {
  _id: string;
  full_name?: string;
  email?: string;
  telephone?: string;
  gender?: string;
  title?: string;
  picture?: string;
  department?: { department_name?: string; department_id?: string; is_unit?: boolean; name?: string } | null;
  department_unit?: string;
  department_unit_name?: string;
  roles?: { role_name?: string };
  is_active?: boolean;
  is_account_activated?: boolean;
  created_date?: string;
}

const LIMIT = 10;

const formatDate = (value?: string | Date | null): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const initialsOf = (name?: string) =>
  (name || '?').split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase();

const MemberAvatar: React.FC<{ name?: string }> = ({ name }) => (
  <span
    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0"
    style={{ backgroundColor: 'rgba(5,109,170,0.12)', color: PRIMARY }}
  >
    {initialsOf(name)}
  </span>
);

const StatusChip: React.FC<{ active?: boolean }> = ({ active }) => (
  <span
    className="text-xs px-2 py-0.5 font-bold uppercase"
    style={{
      borderRadius: 0,
      fontFamily: FONT,
      backgroundColor: active ? 'rgba(76,175,80,0.12)' : 'rgba(231,76,60,0.12)',
      color: active ? '#388E3C' : '#E74C3C',
    }}
  >
    {active ? 'Active' : 'Inactive'}
  </span>
);

const StatTile: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="bg-white p-4 flex-1 min-w-[150px]" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: GRAY_MID, fontFamily: FONT }}>{label}</p>
    <p className="text-2xl font-bold mt-1" style={{ color: NEUTRAL_DARK, fontFamily: FONT }}>{value}</p>
    {hint && <p className="text-xs mt-0.5" style={{ color: GRAY }}>{hint}</p>}
  </div>
);

const HodEmployeesPage: React.FC = () => {
  const { showError } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [total, setTotal] = useState(0);
  const [totalActive, setTotalActive] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TeamMember | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await departmentManagerService.getTeamMembers(page, LIMIT, query || undefined);
      if (res?.success) {
        setMembers(res.data || []);
        setTotal(res.total || 0);
        setTotalActive(res.total_active || 0);
      } else if (!silent) {
        showError(res?.message || 'Failed to load team members');
      }
    } catch {
      if (!silent) showError('Failed to load team members');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, query, showError]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = setInterval(() => { load(true); }, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const totalPages = Math.max(Math.ceil(total / LIMIT), 1);

  return (
    <div className="p-4" style={{ fontFamily: FONT }}>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <StatTile label="Total Employees" value={total} hint="In the departments and units you lead" />
        <StatTile label="Total Active" value={totalActive} hint="Active accounts across your departments and units" />
      </div>

      <div className="bg-white" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <input
            className="cok-auth-input flex-1 w-full min-w-0 text-sm sm:text-base"
            style={{ paddingLeft: '12px', minHeight: '44px' }}
            placeholder="Search by name, email, phone or title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setPage(1); setQuery(search.trim()); } }}
          />
          <button
            className="cok-btn-primary shrink-0"
            style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '11px', borderRadius: 0, textTransform: 'uppercase', letterSpacing: '1px' }}
            onClick={() => { setPage(1); setQuery(search.trim()); }}
          >
            Search
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <SpiralLoader />
          </div>
        ) : members.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: GRAY }}>No employees found in your department.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead style={{ backgroundColor: PRIMARY }}>
                <tr>
                  {['Employee', 'Contact', 'Role', 'Department', 'Status', 'Joined'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs uppercase tracking-wider text-white font-semibold" style={{ fontFamily: FONT }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {members.map(m => (
                  <tr key={m._id} className="hover:bg-[#F7F9FB] cursor-pointer" onClick={() => setSelected(m)}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <MemberAvatar name={m.full_name} />
                        <div>
                          <p className="text-sm font-semibold" style={{ color: PRIMARY }}>{m.full_name || '-'}</p>
                          <p className="text-xs" style={{ color: GRAY }}>{m.title || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm" style={{ color: NEUTRAL_DARK }}>{m.email || '-'}</p>
                      <p className="text-xs" style={{ color: GRAY }}>{m.telephone || ''}</p>
                    </td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: GRAY_MID }}>{m.roles?.role_name || '-'}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm" style={{ color: GRAY_MID }}>{m.department?.department_name || m.department?.name || '-'}</p>
                      {m.department_unit_name && (
                        <span
                          className="inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5"
                          style={{ fontFamily: FONT, backgroundColor: 'rgba(5,109,170,0.08)', color: PRIMARY, borderRadius: 0 }}
                        >
                          {m.department_unit_name}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5"><StatusChip active={m.is_active} /></td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{formatDate(m.created_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          <span className="text-xs" style={{ color: GRAY_MID }}>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              className="cok-btn-outlined px-4 py-1.5 text-xs disabled:opacity-50"
              style={{ borderRadius: 0, textTransform: 'uppercase', letterSpacing: '1px' }}
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => Math.max(p - 1, 1))}
            >
              Back
            </button>
            <button
              className="cok-btn-outlined px-4 py-1.5 text-xs disabled:opacity-50"
              style={{ borderRadius: 0, textTransform: 'uppercase', letterSpacing: '1px' }}
              disabled={page >= totalPages || loading}
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ borderRadius: 0, border: `1px solid ${BORDER}` }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4" style={{ backgroundColor: PRIMARY }}>
              <h2 className="text-white font-bold text-sm uppercase tracking-wide" style={{ fontFamily: FONT }}>Employee Details</h2>
              <button onClick={() => setSelected(null)} className="cok-btn-outlined-reverse p-1.5" style={{ borderRadius: 0 }} aria-label="Close">
                <FiX size={16} />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <table className="w-full">
                <tbody className="divide-y divide-[#E0E0E0]">
                  {[
                    ['Full Name', selected.full_name],
                    ['Title', selected.title],
                    ['Email', selected.email],
                    ['Telephone', selected.telephone],
                    ['Gender', selected.gender],
                    ['Role', selected.roles?.role_name],
                    ['Department', selected.department?.department_name || selected.department?.name || '-'],
                    ['Unit', selected.department_unit_name || '-'],
                    ['Account Active', selected.is_active ? 'Yes' : 'No'],
                    ['Account Activated', selected.is_account_activated ? 'Yes' : 'No'],
                    ['Joined', formatDate(selected.created_date)],
                  ].map(([label, value]) => (
                    <tr key={label as string} className="hover:bg-[#F7F9FB]">
                      <td className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide w-1/3" style={{ color: GRAY_MID, fontFamily: FONT }}>{label}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: NEUTRAL_DARK }}>{(value as string) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HodEmployeesPage;
