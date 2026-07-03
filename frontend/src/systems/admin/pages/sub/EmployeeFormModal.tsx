import React from 'react';
import { FiUser, FiCheck, FiX, FiAlertCircle, FiRefreshCw, FiBriefcase, FiShield } from 'react-icons/fi';

interface EmployeeFormData {
  full_name: string; telephone: string; email: string;
  identification?: { id_type: string; number: string };
  gender: string; title: string; department: string; department_name: string;
  department_id: string; department_unit: string;
  roles?: { role_name: string; permissions: any[] };
  is_unit?: boolean; parent_department?: string;
}

interface Department { _id?: string; department_id?: string; department_name?: string; }
interface RoleFromBackend { _id?: string; role_name: string; permissions?: any[]; }

interface EmployeeFormModalProps {
  show: boolean;
  editing: boolean;
  formData: EmployeeFormData;
  formError: string;
  formSuccess: string;
  submitting: boolean;
  departments: Department[];
  departmentUnits: Department[];
  loadingUnits: boolean;
  roles: RoleFromBackend[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (data: EmployeeFormData) => void;
  onDepartmentChange: (name: string, id: string) => void;
}

const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  show, editing, formData, formError, formSuccess, submitting, departments, departmentUnits, loadingUnits, roles, onClose, onSubmit, onChange, onDepartmentChange
}) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl m-3 sm:m-6">
        <div className="p-4 border-b bg-gray-50 sticky top-0 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 flex items-center justify-center"><FiUser className="w-4 h-4 text-blue-600" /></div>
            <div><h2 className="text-sm font-bold text-gray-900">{editing ? 'Edit Employee' : 'Add Employee'}</h2><p className="text-xs text-gray-500">{editing ? 'Update employee details' : 'Create a new employee'}</p></div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200"><FiX className="w-4 h-4 text-gray-500" /></button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          {formError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 flex items-start gap-2 text-sm"><FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{formError}</span></div>}
          {formSuccess && <div className="bg-green-50 border-2 border-green-500 text-green-800 px-4 py-3 flex items-center gap-3"><div className="w-8 h-8 bg-green-100 flex items-center justify-center flex-shrink-0"><FiCheck className="w-5 h-5 text-green-600" /></div><div><p className="font-semibold text-sm">Success!</p><p className="text-xs text-green-700">{formSuccess}</p></div></div>}

          <div className="bg-gray-50 p-3 space-y-3">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2"><FiUser className="w-3 h-3" />Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="text-xs font-medium text-gray-700 mb-1 block">Full Name <span className="text-red-500">*</span></label><input type="text" required value={formData.full_name} onChange={e => onChange({ ...formData, full_name: e.target.value })} className="w-full px-2.5 py-2 border border-gray-300 text-sm bg-white" placeholder="Enter full name" /></div>
              <div><label className="text-xs font-medium text-gray-700 mb-1 block">Email <span className="text-red-500">*</span></label><input type="email" required value={formData.email} onChange={e => onChange({ ...formData, email: e.target.value })} className="w-full px-2.5 py-2 border border-gray-300 text-sm bg-white" placeholder="email@example.com" /></div>
              <div><label className="text-xs font-medium text-gray-700 mb-1 block">Telephone</label><input type="tel" value={formData.telephone} onChange={e => onChange({ ...formData, telephone: e.target.value })} className="w-full px-2.5 py-2 border border-gray-300 text-sm bg-white" placeholder="+1234567890" /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="text-xs font-medium text-gray-700 mb-1 block">Title</label><select value={formData.title} onChange={e => onChange({ ...formData, title: e.target.value })} className="w-full px-2.5 py-2 border border-gray-300 text-sm bg-white"><option value="">Select title</option><option value="Mr">Mr</option><option value="Mrs">Mrs</option></select></div>
              <div><label className="text-xs font-medium text-gray-700 mb-1 block">Gender</label><select value={formData.gender} onChange={e => onChange({ ...formData, gender: e.target.value })} className="w-full px-2.5 py-2 border border-gray-300 text-sm bg-white"><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
              <div><label className="text-xs font-medium text-gray-700 mb-1 block">ID Type</label><select value={formData.identification?.id_type || 'National ID'} onChange={e => onChange({ ...formData, identification: { ...formData.identification!, id_type: e.target.value } })} className="w-full px-2.5 py-2 border border-gray-300 text-sm bg-white"><option value="National ID">National ID</option><option value="Passport">Passport</option><option value="Driver License">Driver License</option></select></div>
            </div>
            <div><label className="text-xs font-medium text-gray-700 mb-1 block">ID Number</label><input type="text" value={formData.identification?.number || ''} onChange={e => onChange({ ...formData, identification: { ...formData.identification!, number: e.target.value } })} className="w-full px-2.5 py-2 border border-gray-300 text-sm bg-white" placeholder="Enter ID number" /></div>
          </div>

          <div className="bg-blue-50 p-3 space-y-3">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2"><FiBriefcase className="w-3 h-3" />Department & Role</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-700 mb-1 block">Department</label>
                <select value={formData.department_name} onChange={e => { const d = departments.find(d => d.department_name === e.target.value); onDepartmentChange(e.target.value, d?._id || ''); }} className="w-full px-2.5 py-2 border border-gray-300 text-sm bg-white">
                  <option value="">Select department</option>{departments.map(d => <option key={d._id || d.department_id} value={d.department_name}>{d.department_name}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-medium text-gray-700 mb-1 block">Unit</label>
                <select value={formData.department_unit || ''} onChange={e => onChange({ ...formData, department_unit: e.target.value })} disabled={!formData.department_id || loadingUnits} className="w-full px-2.5 py-2 border border-gray-300 text-sm bg-white disabled:bg-gray-200">
                  {loadingUnits ? <option>Loading...</option> : departmentUnits.length === 0 ? <option>No units</option> : <><option value="">Select unit</option>{departmentUnits.map(u => <option key={u._id} value={u._id}>{u.department_name}</option>)}</>}
                </select>
              </div>
            </div>
            <div><label className="text-xs font-medium text-gray-700 mb-1 block"><FiShield className="w-3 h-3 inline mr-1" />User Role</label>
              <select value={formData.roles?.role_name || 'department_employee'} onChange={e => onChange({ ...formData, roles: { role_name: e.target.value, permissions: [] } })} className="w-full px-2.5 py-2 border border-gray-300 text-sm bg-white">
                {roles.length > 0 ? roles.map(r => <option key={r._id || r.role_name} value={r.role_name}>{r.role_name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</option>) : <option>No roles available</option>}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting || !!formSuccess} className={`flex-1 px-3 py-2 text-sm font-medium ${formSuccess ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'} ${submitting ? 'opacity-50' : ''}`}>
              {submitting ? <span className="flex items-center justify-center gap-2"><FiRefreshCw className="w-3 h-3 animate-spin" />Saving...</span> : formSuccess ? <span className="flex items-center justify-center gap-2"><FiCheck className="w-3 h-3" />Saved!</span> : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeFormModal;