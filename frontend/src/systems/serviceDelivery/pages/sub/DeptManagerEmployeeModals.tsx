import React, { useState, useEffect } from 'react';
import { FiX, FiUser, FiMail, FiPhone, FiBriefcase } from 'react-icons/fi';
import { employeeService } from '../../../../core/services/adminService';

interface Employee { _id?: string; employee_id?: string; full_name?: string; name?: string; email?: string; telephone?: string; phone?: string; title?: string; gender?: string; }

interface AddEmployeeModalProps { isOpen: boolean; onClose: () => void; departmentId?: string; departmentName?: string; onSuccess: () => void; }
export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({ isOpen, onClose, departmentId, departmentName, onSuccess }) => {
  const [formData, setFormData] = useState({ full_name: '', email: '', telephone: '', title: '', gender: '', department_id: departmentId || '', department_name: departmentName || '' });
  const [isSubmitting, setIsSubmitting] = useState(false); const [error, setError] = useState('');
  const handleSubmit = async () => {
    if (!formData.full_name || !formData.email || !formData.telephone) { setError('Fill required fields'); return; }
    setIsSubmitting(true); setError('');
    try { const r: any = await employeeService.create({ ...formData, roles: { role_name: 'department_employee', permissions: [] } }); if (r && (r.success === true || r._id || r.data)) onSuccess(); else setError(r?.message || 'Failed'); }
    catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-2 sm:p-4">
        <div className="fixed inset-0 bg-black/30" />
        <div className="relative bg-white shadow-xl w-full max-w-[600px]" onClick={e => e.stopPropagation()}>
          <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center"><h3 className="text-sm font-bold text-gray-800">Add New Employee</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX className="w-4 h-4" /></button></div>
          <div className="p-4 space-y-3">
            {error && <div className="p-2 bg-red-50 text-red-600 text-sm">{error}</div>}
            <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">Full Name *</label><input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full px-3 py-1.5 border border-gray-300 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">Email *</label><input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-1.5 border border-gray-300 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">Telephone *</label><input type="tel" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} className="w-full px-3 py-1.5 border border-gray-300 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">Title</label><input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-1.5 border border-gray-300 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">Gender</label><select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full px-3 py-1.5 border border-gray-300 text-sm"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2"><button onClick={onClose} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 text-sm">Cancel</button><button onClick={handleSubmit} disabled={isSubmitting} className="px-3 py-1.5 bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">{isSubmitting ? 'Adding...' : 'Add Employee'}</button></div>
        </div>
      </div>
    </div>
  );
};

interface EditEmployeeModalProps { isOpen: boolean; onClose: () => void; employee: Employee | null; onSuccess: () => void; }
export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({ isOpen, onClose, employee, onSuccess }) => {
  const [formData, setFormData] = useState({ full_name: '', email: '', telephone: '', title: '', gender: '' });
  const [isSubmitting, setIsSubmitting] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (employee) setFormData({ full_name: employee.full_name || '', email: employee.email || '', telephone: employee.telephone || '', title: employee.title || '', gender: employee.gender || '' }); }, [employee]);
  const handleSubmit = async () => {
    if (!formData.full_name || !formData.email) { setError('Fill required fields'); return; }
    setIsSubmitting(true); setError('');
    try { const id = employee?._id || employee?.employee_id; if (!id) { setError('ID not found'); return; } const r: any = await employeeService.update(id, formData); if (r && (r.success === true || r._id || r.data)) onSuccess(); else setError(r?.message || 'Failed'); }
    catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };
  if (!isOpen || !employee) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-2 sm:p-4">
        <div className="fixed inset-0 bg-black/30" />
        <div className="relative bg-white shadow-xl w-full max-w-[600px]" onClick={e => e.stopPropagation()}>
          <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center"><h3 className="text-sm font-bold text-gray-800">Edit Employee</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX className="w-4 h-4" /></button></div>
          <div className="p-4 space-y-3">
            {error && <div className="p-2 bg-red-50 text-red-600 text-sm">{error}</div>}
            <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">Full Name *</label><input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full px-3 py-1.5 border border-gray-300 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">Email *</label><input type="email" value={formData.email} disabled className="w-full px-3 py-1.5 border border-gray-200 bg-gray-100 text-gray-500 text-sm" /><p className="text-xs text-gray-400 mt-0.5 italic">Email cannot be changed.</p></div>
            <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">Telephone</label><input type="tel" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} className="w-full px-3 py-1.5 border border-gray-300 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">Title</label><input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-1.5 border border-gray-300 text-sm" /></div>
            <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">Gender</label><select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full px-3 py-1.5 border border-gray-300 text-sm"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2"><button onClick={onClose} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 text-sm">Cancel</button><button onClick={handleSubmit} disabled={isSubmitting} className="px-3 py-1.5 bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Save Changes'}</button></div>
        </div>
      </div>
    </div>
  );
};

interface ViewEmployeeModalProps { isOpen: boolean; onClose: () => void; employee: Employee | null; }
export const ViewEmployeeModal: React.FC<ViewEmployeeModalProps> = ({ isOpen, onClose, employee }) => {
  if (!isOpen || !employee) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-2 sm:p-4">
        <div className="fixed inset-0 bg-black/30" />
        <div className="relative bg-white shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center"><h3 className="text-sm font-bold text-gray-800">Employee Details</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX className="w-4 h-4" /></button></div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b"><div className="w-10 h-10 bg-blue-100 flex items-center justify-center"><FiUser className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm font-semibold text-gray-900">{employee.full_name || employee.name}</p><p className="text-xs text-gray-500">{employee.title || 'No title'}</p></div></div>
            <div className="space-y-2 text-sm"><div className="flex items-center gap-2"><FiMail className="w-4 h-4 text-gray-400" /><span>{employee.email}</span></div><div className="flex items-center gap-2"><FiPhone className="w-4 h-4 text-gray-400" /><span>{employee.telephone || employee.phone || 'N/A'}</span></div><div className="flex items-center gap-2"><FiBriefcase className="w-4 h-4 text-gray-400" /><span>{employee.gender || 'N/A'}</span></div></div>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 flex justify-end"><button onClick={onClose} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm hover:bg-gray-200">Close</button></div>
        </div>
      </div>
    </div>
  );
};