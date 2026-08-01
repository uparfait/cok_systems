import React, { useCallback, useEffect, useState } from 'react';
import { FiSearch, FiRefreshCw } from 'react-icons/fi';
import { departmentManagerService } from '@/core/services/adminService';
import { useToast } from '@/core/contexts/ToastContext';
import {
  COK, FONT, formatDate,
  HodPageHeader, HodCard, HodStatCard, HodPagination, HodModal, HodEmpty, HodTh, HodAvatar, HodChip,
} from './hodShared';

interface TeamMember {
  _id: string;
  full_name?: string;
  email?: string;
  telephone?: string;
  gender?: string;
  title?: string;
  department?: { name?: string } | null;
  department_unit?: string;
  roles?: { role_name?: string };
  is_active?: boolean;
  is_account_activated?: boolean;
  created_date?: string;
}

const LIMIT = 20;

const HodEmployeesPage: React.FC = () => {
  const { showError } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TeamMember | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await departmentManagerService.getTeamMembers(page, LIMIT, query || undefined);
      if (res?.success) {
        setMembers(res.data || []);
        setTotal(res.total || 0);
      } else {
        showError(res?.message || 'Failed to load team members');
      }
    } catch {
      showError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, [page, query, showError]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(Math.ceil(total / LIMIT), 1);
  const activeCount = members.filter(m => m.is_active).length;

  return (
    <div className="p-4">
      <HodPageHeader title="My Department Employees" subtitle="All staff members in the departments you lead" />

      <div className="flex flex-wrap gap-3 mb-4">
        <HodStatCard label="Total Employees" value={total} />
        <HodStatCard label="Active (this page)" value={activeCount} accent={COK.success} />
      </div>

      <HodCard>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b" style={{ borderColor: COK.border }}>
          <div className="relative flex-1 min-w-[220px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COK.gray }} />
            <input
              className="cok-auth-input w-full py-2 pl-9 pr-3 text-sm"
              placeholder="Search by name, email, phone or title..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setPage(1); setQuery(search.trim()); } }}
            />
          </div>
          <button className="cok-btn-primary px-4 py-2 text-xs" style={{ borderRadius: 0 }} onClick={() => { setPage(1); setQuery(search.trim()); }}>
            Search
          </button>
          <button
            className="cok-btn-outlined px-3 py-2 text-xs flex items-center gap-1"
            style={{ borderRadius: 0 }}
            onClick={() => { setSearch(''); setQuery(''); setPage(1); }}
          >
            <FiRefreshCw /> Reset
          </button>
        </div>

        {loading ? (
          <HodEmpty message="Loading employees..." />
        ) : members.length === 0 ? (
          <HodEmpty message="No employees found in your department." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <HodTh>Employee</HodTh>
                  <HodTh>Contact</HodTh>
                  <HodTh>Role</HodTh>
                  <HodTh>Department</HodTh>
                  <HodTh>Status</HodTh>
                  <HodTh>Joined</HodTh>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#F3F4F6' }}>
                {members.map(m => (
                  <tr key={m._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(m)}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <HodAvatar name={m.full_name} />
                        <div>
                          <p className="text-sm font-semibold" style={{ color: COK.primary, fontFamily: FONT }}>{m.full_name || '—'}</p>
                          <p className="text-xs" style={{ color: COK.gray }}>{m.title || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm" style={{ color: COK.textDark }}>{m.email || '—'}</p>
                      <p className="text-xs" style={{ color: COK.gray }}>{m.telephone || ''}</p>
                    </td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: COK.textMid }}>{m.roles?.role_name || '—'}</td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: COK.textMid }}>{m.department?.name || m.department_unit || '—'}</td>
                    <td className="px-3 py-2.5">
                      <HodChip label={m.is_active ? 'Active' : 'Inactive'} color={m.is_active ? COK.success : COK.gray} />
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: COK.gray }}>{formatDate(m.created_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <HodPagination page={page} totalPages={totalPages} onPage={setPage} />
      </HodCard>

      {selected && (
        <HodModal title="Employee Details" onClose={() => setSelected(null)}>
          <table className="w-full">
            <tbody className="divide-y divide-gray-100">
              {[
                ['Full Name', selected.full_name],
                ['Title', selected.title],
                ['Email', selected.email],
                ['Telephone', selected.telephone],
                ['Gender', selected.gender],
                ['Role', selected.roles?.role_name],
                ['Department', selected.department?.name || selected.department_unit],
                ['Account Active', selected.is_active ? 'Yes' : 'No'],
                ['Account Activated', selected.is_account_activated ? 'Yes' : 'No'],
                ['Joined', formatDate(selected.created_date)],
              ].map(([label, value]) => (
                <tr key={label as string} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide w-1/3" style={{ color: COK.textMid, fontFamily: FONT }}>{label}</td>
                  <td className="px-3 py-2.5 text-sm" style={{ color: COK.textDark }}>{(value as string) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </HodModal>
      )}
    </div>
  );
};

export default HodEmployeesPage;
