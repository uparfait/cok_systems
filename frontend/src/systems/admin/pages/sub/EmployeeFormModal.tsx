import React, { useState, useRef, useEffect } from 'react';
import { FiUser, FiCheck, FiX, FiAlertCircle, FiRefreshCw, FiBriefcase, FiShield, FiSearch, FiChevronDown, FiPlus } from 'react-icons/fi';

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

export interface SelectOption { id: string; label: string; }

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
  loadingRoles?: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (data: EmployeeFormData) => void;
  onDepartmentChange: (name: string, id: string) => void;
  onAddNewDepartment?: (typedName: string) => void;
  onAddNewUnit?: (typedName: string) => void;
  onRefetchDepartments?: () => void | Promise<void>;
  onRefetchUnits?: () => void | Promise<void>;
}

interface SearchableCreateSelectProps {
  label: React.ReactNode;
  placeholder: string;
  emptyText: string;
  createNoun: string;
  disabled?: boolean;
  disabledHint?: string;
  loading?: boolean;
  options: SelectOption[];
  valueLabel: string;
  onSelect: (opt: SelectOption) => void;
  onAddNew?: (typedName: string) => void;
  onRefetch?: () => void | Promise<void>;
}

const SearchableCreateSelect: React.FC<SearchableCreateSelectProps> = ({
  label, placeholder, emptyText, createNoun, disabled, disabledHint, loading, options, valueLabel, onSelect, onAddNew, onRefetch,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [refetching, setRefetching] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const handleRefetch = async () => {
    if (!onRefetch || refetching) return;
    setRefetching(true);
    try { await onRefetch(); } finally { setRefetching(false); }
  };

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;

  const handleAddNew = () => {
    if (!onAddNew) return;
    const existing = q ? options.find(o => o.label.toLowerCase() === q) : undefined;
    if (existing) {
      onSelect(existing);
    } else {
      onAddNew(query.trim());
    }
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className="relative">
      <label className="text-xs font-medium text-gray-700 mb-1 block">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(o => !o); setQuery(''); }}
        className="cok-auth-input w-full text-sm text-left flex items-center justify-between cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ paddingLeft: '10px', paddingRight: '10px', minHeight: '38px' }}
        title={disabled ? disabledHint : undefined}
      >
        <span className={`truncate ${valueLabel ? 'text-gray-900' : 'text-gray-400'}`}>{valueLabel || placeholder}</span>
        <FiChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 bottom-full mb-1 z-30 bg-white border border-gray-200 shadow-lg">
          {onAddNew && (
            <div className="p-2 border-b border-gray-100">
              <button
                type="button"
                onClick={handleAddNew}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white bg-[#056daa] hover:bg-[#045d94] cursor-pointer"
              >
                <FiPlus className="w-3 h-3" />
                {q ? `Add new ${createNoun} "${query.trim()}"` : `Add new ${createNoun}`}
              </button>
            </div>
          )}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Search or type a new ${createNoun} name...`}
                className="cok-auth-input w-full text-sm"
                style={{ paddingLeft: '30px', minHeight: '34px' }}
              />
            </div>
          </div>
          <ul className="max-h-44 overflow-y-auto">
            {loading ? (
              <li className="px-3 py-2.5 text-xs text-center text-gray-500">Loading...</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-xs text-center text-gray-500">
                <span className="inline-flex items-center gap-2">
                  {q ? `No ${createNoun} matches "${query.trim()}"` : emptyText}
                  {onRefetch && (
                    <button
                      type="button"
                      onClick={handleRefetch}
                      title={`Refetch ${createNoun}s`}
                      className="p-1 text-[#056daa] hover:bg-[rgba(5,109,170,0.08)] cursor-pointer"
                    >
                      <FiRefreshCw className={`w-3.5 h-3.5 ${refetching ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </span>
              </li>
            ) : (
              filtered.map(o => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => { onSelect(o); setOpen(false); setQuery(''); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-[#F7F9FB] cursor-pointer"
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  show, editing, formData, formError, formSuccess, submitting, departments, departmentUnits, loadingUnits, roles, loadingRoles, onClose, onSubmit, onChange, onDepartmentChange, onAddNewDepartment, onAddNewUnit, onRefetchDepartments, onRefetchUnits
}) => {
  if (!show) return null;
  const rawUnit = String(formData.department_unit || '');
  const matchedUnit = departmentUnits.find(u => String(u._id) === rawUnit || String(u.department_id) === rawUnit);
  const departmentOptions: SelectOption[] = departments
    .filter(d => d.department_name)
    .map(d => ({ id: String(d._id || d.department_id || ''), label: d.department_name || '' }));
  const unitOptions: SelectOption[] = departmentUnits
    .filter(u => u.department_name)
    .map(u => ({ id: String(u._id || u.department_id || ''), label: u.department_name || '' }));
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white w-full sm:w-[70%] sm:max-w-none max-h-[90vh] overflow-y-auto shadow-2xl mx-2 sm:mx-4 my-2 sm:my-6">
        <div className="p-4 border-b bg-gray-50 sticky top-0 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[rgba(5,109,170,0.1)] flex items-center justify-center"><FiUser className="w-4 h-4 text-[#056daa]" /></div>
            <div><h2 className="text-sm font-bold text-gray-900">{editing ? 'Edit Employee' : 'Add Employee'}</h2><p className="text-xs text-gray-500">{editing ? 'Update employee details' : 'Create a new employee'}</p></div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 cursor-pointer"><FiX className="w-4 h-4 text-gray-500" /></button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          {formError && <div className="bg-[rgba(231,76,60,0.08)] border border-[#E74C3C] text-[#E74C3C] px-3 py-2 flex items-start gap-2 text-sm"><FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{formError}</span></div>}
          {formSuccess && <div className="bg-[rgba(76,175,80,0.1)] border-2 border-[#4CAF50] text-[#388E3C] px-4 py-3 flex items-center gap-3"><div className="w-8 h-8 bg-[rgba(76,175,80,0.12)] flex items-center justify-center flex-shrink-0"><FiCheck className="w-5 h-5 text-[#388E3C]" /></div><div><p className="font-semibold text-sm">Success!</p><p className="text-xs text-[#388E3C]">{formSuccess}</p></div></div>}

          <div className="bg-gray-50 p-3 space-y-3">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2"><FiUser className="w-3 h-3" />Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="text-xs font-medium text-gray-700 mb-1 block">Full Name <span className="text-red-500">*</span></label><input type="text" required value={formData.full_name} onChange={e => onChange({ ...formData, full_name: e.target.value })} className="cok-auth-input w-full text-sm" style={{ paddingLeft: '10px', minHeight: '38px' }} placeholder="Enter full name" /></div>
              <div><label className="text-xs font-medium text-gray-700 mb-1 block">Email <span className="text-red-500">*</span></label><input type="email" required value={formData.email} onChange={e => onChange({ ...formData, email: e.target.value })} className="cok-auth-input w-full text-sm" style={{ paddingLeft: '10px', minHeight: '38px' }} placeholder="email@example.com" /></div>
              <div><label className="text-xs font-medium text-gray-700 mb-1 block">Telephone <span className="text-red-500">*</span></label><input type="tel" required value={formData.telephone} onChange={e => onChange({ ...formData, telephone: e.target.value })} className="cok-auth-input w-full text-sm" style={{ paddingLeft: '10px', minHeight: '38px' }} placeholder="+1234567890" /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => onChange({ ...formData, title: e.target.value })}
                  className="cok-auth-input w-full text-sm" style={{ paddingLeft: '10px', minHeight: '38px' }}
                  placeholder="Enter job title"
                />
              </div>
              <div><label className="text-xs font-medium text-gray-700 mb-1 block">Gender</label><select value={formData.gender} onChange={e => onChange({ ...formData, gender: e.target.value })} className="cok-auth-input w-full text-sm" style={{ paddingLeft: '10px', minHeight: '38px' }}><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
              <div><label className="text-xs font-medium text-gray-700 mb-1 block">ID Type</label><select value={formData.identification?.id_type || 'National ID'} onChange={e => onChange({ ...formData, identification: { ...formData.identification!, id_type: e.target.value } })} className="cok-auth-input w-full text-sm" style={{ paddingLeft: '10px', minHeight: '38px' }}><option value="National ID">National ID</option><option value="Passport">Passport</option><option value="Driver License">Driver License</option></select></div>
            </div>
            <div><label className="text-xs font-medium text-gray-700 mb-1 block">ID Number</label><input type="text" value={formData.identification?.number || ''} onChange={e => onChange({ ...formData, identification: { ...formData.identification!, number: e.target.value } })} className="cok-auth-input w-full text-sm" style={{ paddingLeft: '10px', minHeight: '38px' }} placeholder="Enter ID number" /></div>
          </div>

          <div className="bg-[rgba(5,109,170,0.06)] p-3 space-y-3">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2"><FiBriefcase className="w-3 h-3" />Department & Role</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SearchableCreateSelect
                label="Department"
                placeholder="Search or select department"
                emptyText="No departments yet"
                createNoun="department"
                options={departmentOptions}
                valueLabel={formData.department_name || ''}
                onSelect={(opt) => onDepartmentChange(opt.label, opt.id)}
                onAddNew={onAddNewDepartment}
                onRefetch={onRefetchDepartments}
              />
              <SearchableCreateSelect
                label="Unit"
                placeholder="Search or select unit"
                emptyText="No units in this department"
                createNoun="unit"
                disabled={!formData.department_id}
                disabledHint="Select a department first"
                loading={loadingUnits}
                options={unitOptions}
                valueLabel={matchedUnit?.department_name || ''}
                onSelect={(opt) => onChange({ ...formData, department_unit: opt.id })}
                onAddNew={onAddNewUnit}
                onRefetch={onRefetchUnits}
              />
            </div>
            <div><label className="text-xs font-medium text-gray-700 mb-1 block"><FiShield className="w-3 h-3 inline mr-1" />User Role <span className="text-red-500">*</span></label>
              {loadingRoles ? (
                <div className="cok-auth-input w-full text-sm flex items-center gap-2 text-gray-500" style={{ paddingLeft: '10px', minHeight: '38px' }}>
                  <FiRefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: '#056daa' }} />
                  Loading roles...
                </div>
              ) : (
                <select required value={formData.roles?.role_name || ''} onChange={e => onChange({ ...formData, roles: { role_name: e.target.value, permissions: [] } })} className="cok-auth-input w-full text-sm cursor-pointer" style={{ paddingLeft: '10px', minHeight: '38px' }}>
                  <option value="">Select a role</option>
                  {roles.map(r => <option key={r._id || r.role_name} value={r.role_name}>{r.role_name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</option>)}
                </select>
              )}
              {!loadingRoles && roles.length === 0 && <p className="text-xs text-gray-500 mt-1">No roles available yet - create roles under Roles Management first.</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-3 py-2 border border-[#056daa] bg-white text-[#056daa] text-sm font-semibold uppercase hover:bg-[#F7F9FB] cursor-pointer" style={{ letterSpacing: '1px' }}>Cancel</button>
            <button type="submit" disabled={submitting || !!formSuccess} className={`flex-1 px-3 py-2 text-sm font-semibold uppercase cursor-pointer disabled:cursor-not-allowed ${formSuccess ? 'bg-[#4CAF50] text-white' : 'bg-[#056daa] text-white hover:bg-[#045d94]'} ${submitting ? 'opacity-50' : ''}`} style={{ letterSpacing: '1px' }}>
              {submitting ? <span className="flex items-center justify-center gap-2"><FiRefreshCw className="w-3 h-3 animate-spin" />Saving...</span> : formSuccess ? <span className="flex items-center justify-center gap-2"><FiCheck className="w-3 h-3" />Saved!</span> : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeFormModal;
