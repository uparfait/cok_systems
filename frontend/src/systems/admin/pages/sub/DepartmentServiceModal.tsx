import React, { useEffect, useRef, useState } from 'react';
import { FiUsers, FiPackage, FiSearch, FiEdit2, FiTrash2, FiChevronLeft, FiChevronRight, FiAlertCircle, FiPlus, FiCheck, FiRefreshCw } from 'react-icons/fi';
import OverlayShell from '../../../../core/components/overlay/OverlayShell';
import { employeeService } from '../../../../core/services/adminService';

interface Department { _id?: string; name?: string; department_id?: string; services?: any[]; sub_departments?: any[]; description?: string; }

const EMPLOYEES_PAGE_SIZE = 20;

interface EmployeesModalProps { show: boolean; department: Department | null; onClose: () => void; }

export const EmployeesModal: React.FC<EmployeesModalProps> = ({ show, department, onClose }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const requestRef = useRef(0);
  const departmentId = department?._id || department?.department_id || '';

  useEffect(() => { setPage(1); }, [query]);

  useEffect(() => {
    if (!show || !departmentId) return;
    requestRef.current += 1;
    const requestId = requestRef.current;
    setLoading(true);
    employeeService.getByDepartment(departmentId, false, page, EMPLOYEES_PAGE_SIZE, query.trim())
      .then((r: any) => {
        if (requestId !== requestRef.current) return;
        const list = Array.isArray(r?.data) ? r.data : (r?.data?.data || []);
        setRows(r?.success === false ? [] : list);
        setTotal(Number(r?.total) || 0);
      })
      .catch(() => { if (requestId === requestRef.current) { setRows([]); setTotal(0); } })
      .finally(() => { if (requestId === requestRef.current) setLoading(false); });
  }, [show, departmentId, page, query]);

  if (!show || !department) return null;

  const close = () => { requestRef.current += 1; setSearch(''); setQuery(''); setPage(1); setRows([]); setTotal(0); setLoading(false); onClose(); };
  const totalPages = Math.max(1, Math.ceil(total / EMPLOYEES_PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * EMPLOYEES_PAGE_SIZE + 1;
  const to = Math.min(page * EMPLOYEES_PAGE_SIZE, total);
  const pagerButton = 'inline-flex items-center gap-1 px-3 py-1.5 cok-btn-outlined text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  return (
    <OverlayShell
      title={<span className="inline-flex items-center gap-2 max-w-full"><FiUsers className="w-4 h-4 shrink-0 cok-primary-color" /><span className="truncate">Employees</span></span>}
      subtitle={department.name}
      onClose={close}
      width="lg"
      headerExtra={
        <div className="px-4 sm:px-5 py-2 border-b border-gray-100 bg-white flex-shrink-0">
          <div className="relative">
            <input type="text" placeholder="Search by name, email or phone..." value={search} onChange={e => { setSearch(e.target.value); if (!e.target.value.trim()) setQuery(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setQuery(search); } }} className="w-full pl-3 pr-10! py-1.5 cok-auth-input text-sm" />
            <button type="button" aria-label="Search" title="Search" onClick={() => setQuery(search)} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-[#056daa] hover:bg-[rgba(5,109,170,0.1)] cursor-pointer"><FiSearch className="w-4 h-4" /></button>
          </div>
        </div>
      }
      footer={total > 0 ? <div className="w-full flex items-center justify-between gap-2"><button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={loading || page <= 1} className={pagerButton}><FiChevronLeft className="w-4 h-4" />Previous</button><span className="text-xs text-gray-600">{from}-{to} of {total}</span><button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={loading || page >= totalPages} className={pagerButton}>Next<FiChevronRight className="w-4 h-4" /></button></div> : undefined}
    >
      {loading ? <div className="flex justify-center py-8"><FiRefreshCw className="w-6 h-6 animate-spin text-[#056daa]" /></div>
        : rows.length === 0 ? <div className="text-center py-8"><FiUsers className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-500">{search ? 'No matches' : 'No employees'}</p></div>
          : <div className="cok-table-scroll"><table className="w-full text-sm"><thead className="cok-bg-primary sticky top-0"><tr><th className="px-3 py-2 text-left font-semibold text-white text-xs uppercase tracking-wider">Employee</th><th className="px-3 py-2 text-left font-semibold text-white text-xs uppercase tracking-wider">Email</th><th className="px-3 py-2 text-left font-semibold text-white text-xs uppercase tracking-wider">Position</th></tr></thead>
            <tbody className="divide-y divide-[#E0E0E0]">{rows.map((emp: any) => <tr key={emp._id} className="hover:bg-[#F7F9FB]"><td className="px-3 py-2.5"><div className="flex items-center gap-2"><div className="w-7 h-7 bg-[rgba(5,109,170,0.1)] flex items-center justify-center"><span className="cok-primary-color font-semibold text-xs">{(emp.full_name || 'E').charAt(0)}</span></div><span className="font-medium text-gray-900 text-sm">{emp.full_name}</span></div></td><td className="px-3 py-2.5 text-xs text-gray-600">{emp.email}</td><td className="px-3 py-2.5 text-xs text-gray-600">{emp.roles?.role_name || '-'}</td></tr>)}</tbody></table></div>}
    </OverlayShell>
  );
};

interface ServicesModalProps {
  show: boolean; department: Department | null; loading: boolean; page: number;
  onClose: () => void; onPageChange: (p: number) => void;
  itemsPerPage: number; services: any[];
  onAdd: (name: string, desc: string) => void; onEdit: (id: string, name: string, desc: string) => void; onDelete: (id: string) => void;
  error: string; actionLoading: boolean;
}

export const ServicesModal: React.FC<ServicesModalProps> = ({ show, department, page, onClose, onPageChange, itemsPerPage, services, onAdd, onEdit, onDelete, error, actionLoading }) => {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  if (!show || !department) return null;
  const totalPages = Math.ceil((services || []).length / itemsPerPage);
  const paginated = (services || []).slice((page - 1) * itemsPerPage, page * itemsPerPage);
  return (
    <OverlayShell
      title={<span className="inline-flex items-center gap-2 max-w-full"><FiPackage className="w-4 h-4 shrink-0 cok-primary-color" /><span className="truncate">Services Management</span></span>}
      subtitle={department.name}
      onClose={() => { onClose(); setEditId(null); setNewName(''); setNewDesc(''); }}
      busy={actionLoading}
      width="lg"
      bodyClassName="space-y-4"
    >
      {error && <div className="bg-[rgba(231,76,60,0.08)] border border-[#E74C3C] text-[#E74C3C] px-3 py-2 flex items-start gap-2 text-sm"><FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span></div>}
      <div className="border-2 border-[#056daa] p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{editId ? 'Edit Service' : 'Add New Service'}</h3>
        <div className="space-y-3">
          <div><label className="text-xs font-semibold text-gray-700 mb-1 block cok-req">Service Name</label><input type="text" value={editId ? editName : newName} onChange={e => editId ? setEditName(e.target.value) : setNewName(e.target.value)} placeholder="e.g., Consultation" className="w-full px-3 py-2 cok-auth-input text-sm" /></div>
          <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Description</label><textarea value={editId ? editDesc : newDesc} onChange={e => editId ? setEditDesc(e.target.value) : setNewDesc(e.target.value)} placeholder="Brief description (optional)" rows={2} className="w-full px-3 py-2 cok-auth-input text-sm resize-vertical" /></div>
          <div className="flex gap-2 pt-1">
            {editId ? <>
              <button onClick={async () => { await onEdit(editId, editName, editDesc); setEditId(null); setEditName(''); setEditDesc(''); }} disabled={actionLoading || !editName.trim()} className="flex-1 px-3 py-2 cok-btn-primary text-white text-sm font-semibold  disabled:opacity-50 flex items-center justify-center gap-1.5">{actionLoading ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiCheck className="w-3.5 h-3.5" />}Update</button>
              <button onClick={() => { setEditId(null); setEditName(''); setEditDesc(''); }} className="flex-1 px-3 py-2 cok-btn-outlined text-sm font-semibold">Stop Editing</button>
            </> : <button onClick={() => onAdd(newName, newDesc)} disabled={actionLoading || !newName.trim()} className="w-full px-3 py-2 cok-btn-primary text-white text-sm font-semibold  disabled:opacity-50 flex items-center justify-center gap-1.5">{actionLoading ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiPlus className="w-3.5 h-3.5" />}Add Service</button>}
          </div>
        </div>
      </div>
      {(!services || services.length === 0) ? <div className="text-center py-8"><FiPackage className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-500">No services yet</p></div>
        : <div><h3 className="text-sm font-semibold text-gray-900 mb-3">Services ({services.length})</h3><div className="space-y-1.5">{paginated.map((s: any) => <div key={s._id} className="px-3 py-2 border border-gray-200"><div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-900">{s.name}</span><div className="flex items-center gap-1"><button onClick={() => { setEditId(s._id); setEditName(s.name); setEditDesc(s.description || ''); }} className="p-1 cok-primary-color hover:bg-[#F7F9FB]"><FiEdit2 className="w-3 h-3" /></button><button onClick={() => onDelete(s._id)} disabled={actionLoading} className="p-1 text-[#E74C3C] hover:bg-[rgba(231,76,60,0.08)]"><FiTrash2 className="w-3 h-3" /></button></div></div>{s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}</div>)}</div>
          {totalPages > 1 && <div className="mt-3 flex items-center justify-center gap-2"><button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="p-1.5 hover:bg-gray-100 disabled:opacity-50"><FiChevronLeft className="w-3.5 h-3.5" /></button><span className="text-xs text-gray-600">Page {page} of {totalPages}</span><button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="p-1.5 hover:bg-gray-100 disabled:opacity-50"><FiChevronRight className="w-3.5 h-3.5" /></button></div>}
        </div>}
    </OverlayShell>
  );
};
