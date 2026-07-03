import React, { useState } from 'react';
import { FiUsers, FiPackage, FiSearch, FiX, FiEdit2, FiTrash2, FiChevronLeft, FiChevronRight, FiAlertCircle, FiPlus, FiCheck, FiRefreshCw } from 'react-icons/fi';

interface Department { _id?: string; name?: string; department_id?: string; services?: any[]; sub_departments?: any[]; description?: string; }

interface EmployeesModalProps {
  show: boolean; department: Department | null; employees: any[]; loading: boolean; page: number; searchQuery: string;
  onClose: () => void; onSearchChange: (q: string) => void; onPageChange: (p: number) => void;
  itemsPerPage: number; getEmployees: (dept: Department) => any[];
}

export const EmployeesModal: React.FC<EmployeesModalProps> = ({ show, department, employees, page, searchQuery, onClose, onSearchChange, onPageChange, itemsPerPage, getEmployees }) => {
  if (!show || !department) return null;
  const deptEmployees = getEmployees(department);
  const totalPages = Math.ceil(deptEmployees.length / itemsPerPage);
  const paginated = deptEmployees.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2"><div className="w-8 h-8 bg-blue-100 flex items-center justify-center"><FiUsers className="w-4 h-4 text-blue-600" /></div><div><h2 className="text-sm font-bold text-gray-900">Employees</h2><p className="text-xs text-gray-500">{department.name}</p></div></div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200"><FiX className="w-4 h-4" /></button>
        </div>
        <div className="p-3 border-b bg-white flex-shrink-0">
          <div className="relative"><FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search..." value={searchQuery} onChange={e => { onSearchChange(e.target.value); onPageChange(1); }} className="w-full pl-8 pr-3 py-2 border border-gray-300 text-sm" /></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {paginated.length === 0 ? <div className="text-center py-8"><FiUsers className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-500">{searchQuery ? 'No matches' : 'No employees'}</p></div>
            : <table className="w-full text-sm"><thead className="bg-gray-50 border-b sticky top-0"><tr><th className="px-3 py-2 text-left font-semibold text-gray-600 text-xs">Employee</th><th className="px-3 py-2 text-left font-semibold text-gray-600 text-xs">Email</th><th className="px-3 py-2 text-left font-semibold text-gray-600 text-xs">Position</th></tr></thead>
              <tbody className="divide-y">{paginated.map((emp: any) => <tr key={emp._id} className="hover:bg-gray-50"><td className="px-3 py-2.5"><div className="flex items-center gap-2"><div className="w-7 h-7 bg-blue-100 flex items-center justify-center"><span className="text-blue-600 font-semibold text-xs">{(emp.full_name || 'E').charAt(0)}</span></div><span className="font-medium text-gray-900 text-sm">{emp.full_name}</span></div></td><td className="px-3 py-2.5 text-xs text-gray-600">{emp.email}</td><td className="px-3 py-2.5 text-xs text-gray-600">{emp.roles?.role_name || '-'}</td></tr>)}</tbody></table>}
        </div>
        {totalPages > 1 && <div className="p-3 border-t flex items-center justify-center gap-2"><button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="p-1.5 hover:bg-gray-100 disabled:opacity-50"><FiChevronLeft className="w-4 h-4" /></button><span className="text-xs text-gray-600">Page {page} of {totalPages}</span><button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="p-1.5 hover:bg-gray-100 disabled:opacity-50"><FiChevronRight className="w-4 h-4" /></button></div>}
      </div>
    </div>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-4 border-b bg-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2"><div className="w-8 h-8 bg-blue-100 flex items-center justify-center"><FiPackage className="w-4 h-4 text-blue-600" /></div><div><h2 className="text-sm font-bold text-gray-900">Services Management</h2><p className="text-xs text-gray-500">{department.name}</p></div></div>
          <button onClick={() => { onClose(); setEditId(null); setNewName(''); setNewDesc(''); }} className="p-1.5 hover:bg-gray-200"><FiX className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 flex items-start gap-2 text-sm"><FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span></div>}
          <div className="border border-blue-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{editId ? 'Edit Service' : 'Add New Service'}</h3>
            <div className="space-y-3">
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Service Name <span className="text-red-500">*</span></label><input type="text" value={editId ? editName : newName} onChange={e => editId ? setEditName(e.target.value) : setNewName(e.target.value)} placeholder="e.g., Consultation" className="w-full px-3 py-2 border border-blue-300 text-sm" /></div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Description</label><textarea value={editId ? editDesc : newDesc} onChange={e => editId ? setEditDesc(e.target.value) : setNewDesc(e.target.value)} placeholder="Brief description (optional)" rows={2} className="w-full px-3 py-2 border border-blue-300 text-sm resize-vertical" /></div>
              <div className="flex gap-2 pt-1">
                {editId ? <>
                  <button onClick={async () => { await onEdit(editId, editName, editDesc); setEditId(null); setEditName(''); setEditDesc(''); }} disabled={actionLoading || !editName.trim()} className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5">{actionLoading ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiCheck className="w-3.5 h-3.5" />}Update</button>
                  <button onClick={() => { setEditId(null); setEditName(''); setEditDesc(''); }} className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50">Cancel</button>
                </> : <button onClick={() => onAdd(newName, newDesc)} disabled={actionLoading || !newName.trim()} className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5">{actionLoading ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiPlus className="w-3.5 h-3.5" />}Add Service</button>}
              </div>
            </div>
          </div>
          {(!services || services.length === 0) ? <div className="text-center py-8"><FiPackage className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-500">No services yet</p></div>
            : <div><h3 className="text-sm font-semibold text-gray-900 mb-3">Services ({services.length})</h3><div className="space-y-1.5">{paginated.map((s: any) => <div key={s._id} className="px-3 py-2 border border-gray-200"><div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-900">{s.name}</span><div className="flex items-center gap-1"><button onClick={() => { setEditId(s._id); setEditName(s.name); setEditDesc(s.description || ''); }} className="p-1 text-blue-600 hover:bg-blue-50"><FiEdit2 className="w-3 h-3" /></button><button onClick={() => onDelete(s._id)} disabled={actionLoading} className="p-1 text-red-600 hover:bg-red-50"><FiTrash2 className="w-3 h-3" /></button></div></div>{s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}</div>)}</div>
              {totalPages > 1 && <div className="mt-3 flex items-center justify-center gap-2"><button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="p-1.5 hover:bg-gray-100 disabled:opacity-50"><FiChevronLeft className="w-3.5 h-3.5" /></button><span className="text-xs text-gray-600">Page {page} of {totalPages}</span><button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="p-1.5 hover:bg-gray-100 disabled:opacity-50"><FiChevronRight className="w-3.5 h-3.5" /></button></div>}
            </div>}
        </div>
      </div>
    </div>
  );
};