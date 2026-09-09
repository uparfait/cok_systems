import React, { useState, useEffect } from 'react';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';
import { FiAlertCircle, FiCheck } from 'react-icons/fi';
import { departmentService } from '../../../core/services/adminService';
import { dispatchToast } from '../../../core/services/apiClient';

interface EmployeeOption { _id?: string; employee_id?: string; full_name?: string; email?: string; }

interface DepartmentFormModalProps {
  show: boolean;
  isUnit: boolean;
  parentDepartmentId?: string;
  parentDepartmentName?: string;
  initialName?: string;
  employees: EmployeeOption[];
  onClose: () => void;
  onCreated: (created: { _id: string; department_name: string }) => void;
}

const DepartmentFormModal: React.FC<DepartmentFormModalProps> = ({
  show, isUnit, parentDepartmentId, parentDepartmentName, initialName, employees, onClose, onCreated,
}) => {
  const entityLabel = isUnit ? 'Department Unit' : 'Department';
  const [name, setName] = useState('');
  const [dptId, setDptId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [description, setDescription] = useState('');
  const [leader, setLeader] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    if (show) {
      setName(initialName || '');
      setDptId('');
      setRoomNumber('');
      setDescription('');
      setLeader('');
      setFormError('');
      setFormSuccess('');
    }
  }, [show, initialName]);

  if (!show) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (!name.trim()) { setFormError(`${entityLabel} name is required`); return; }
    if (isUnit && !parentDepartmentId) { setFormError('Select a department first, then add its unit'); return; }
    try {
      setSubmitting(true);
      const payload: Record<string, unknown> = { name: name.trim(), description: description || '', room_number: roomNumber || '', dpt_id: dptId || '', leader: leader || null, services: [] };
      if (isUnit) { payload.is_unit = true; payload.parent_department = parentDepartmentId; }
      const r = await departmentService.create(payload as any);
      if (r.success && r.data) {
        const msg = r.message || `${entityLabel} created successfully`;
        setFormSuccess(msg);
        dispatchToast('success', msg);
        const created = { _id: String(r.data._id), department_name: r.data.department_name || name.trim() };
        setTimeout(() => { onCreated(created); onClose(); }, 900);
      } else {
        const msg = r.message || r.error || `The ${entityLabel.toLowerCase()} could not be created. Please review the form and try again.`;
        setFormError(msg);
        dispatchToast('error', msg);
      }
    } catch (err: any) {
      const msg = err?.message || err?.error || `The ${entityLabel.toLowerCase()} could not be created. Please review the form and try again.`;
      setFormError(msg);
      dispatchToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-4 border-b bg-gray-50"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-[rgba(5,109,170,0.1)] flex items-center justify-center"><HiOutlineOfficeBuilding className="w-4 h-4 cok-primary-color" /></div><div><h2 className="text-sm font-bold text-gray-900">{`Add ${entityLabel}`}</h2><p className="text-xs text-gray-500">{isUnit ? `Create a new department unit under ${parentDepartmentName || 'the selected department'}` : 'Create a new department'}</p></div></div></div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {formError && <div className="bg-[rgba(231,76,60,0.08)] border border-[#E74C3C] text-[#E74C3C] px-3 py-2 text-sm flex items-start gap-2"><FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{formError}</span></div>}
          {formSuccess && <div className="bg-[rgba(76,175,80,0.08)] border border-[#388E3C] text-[#388E3C] px-3 py-2 text-sm flex items-start gap-2"><FiCheck className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{formSuccess}</span></div>}
          <div><span className={`inline-block text-xs px-2 py-0.5 font-semibold ${isUnit ? 'bg-[rgba(41,128,185,0.08)] text-[#2980B9]' : 'bg-[rgba(5,109,170,0.1)] text-[#056daa]'}`}>{entityLabel}</span></div>
          <div><label className="text-xs font-semibold text-gray-700 mb-1 block">{entityLabel} Name <span className="text-red-500">*</span></label><input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 cok-auth-input  text-sm" placeholder={`${entityLabel} name`} /></div>
          <div><label className="text-xs font-semibold text-gray-700 mb-1 block">{entityLabel} Code (optional)</label><input type="text" value={dptId} onChange={e => setDptId(e.target.value)} className="w-full px-3 py-2 cok-auth-input  text-sm" placeholder="e.g., DEP-001" /></div>
          <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Room Number</label><input type="text" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} className="w-full px-3 py-2 cok-auth-input  text-sm" placeholder="e.g., 101" /></div>
          <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 cok-auth-input  text-sm resize-none" rows={2} placeholder="Description" /></div>
          <div><label className="text-xs font-semibold text-gray-700 mb-1 block">{entityLabel} Leader</label><select value={leader} onChange={e => setLeader(e.target.value)} className="w-full px-3 py-2 cok-auth-input  text-sm cursor-pointer"><option value="">No leader</option>{employees.map(emp => <option key={emp._id || emp.employee_id} value={emp._id || emp.employee_id || ''}>{emp.full_name} ({emp.email})</option>)}</select></div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={submitting || !!formSuccess} className="flex-1 px-3 py-2 cok-btn-primary text-white text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Saving...' : 'Create'}</button>
            <button type="button" onClick={onClose} disabled={submitting} className="flex-1 px-3 py-2 cok-btn-outlined text-sm font-medium cursor-pointer">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DepartmentFormModal;
