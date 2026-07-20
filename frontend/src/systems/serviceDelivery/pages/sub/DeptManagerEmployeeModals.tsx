import React, { useState, useEffect } from 'react';
import { FiX, FiUser, FiMail, FiPhone, FiBriefcase } from 'react-icons/fi';
import { employeeService } from '../../../../core/services/adminService';

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";
const btnStyle: React.CSSProperties = { fontFamily: fontHeading, fontSize: "13px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", borderRadius: 0 };
const labelStyle: React.CSSProperties = { fontFamily: fontHeading, fontSize: "13px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: TERTIARY };
const inputStyle: React.CSSProperties = { fontFamily: fontHeading, fontSize: "14px", backgroundColor: NEUTRAL_LIGHT, border: "1px solid transparent", borderRadius: 0, boxShadow: "0px 2px 4px rgba(0,0,0,0.1)", color: NEUTRAL_DARK };
const focusInput = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = "0px 4px 8px rgba(5,109,170,0.25)"; };
const blurInput = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.boxShadow = "0px 2px 4px rgba(0,0,0,0.1)"; };

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
        <div className="fixed inset-0 bg-black/40" />
        <div className="relative w-full max-w-[600px]" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }} onClick={e => e.stopPropagation()}>
          <div className="px-4 py-3 flex justify-between items-center" style={{ borderBottom: `1px solid ${BORDER}` }}><h3 className="text-sm" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>Add New Employee</h3><button onClick={onClose} className="hover:text-gray-600" style={{ color: GRAY_DISABLED }}><FiX className="w-4 h-4" /></button></div>
          <div className="p-4 space-y-3">
            {error && <div className="p-2 text-sm" style={{ backgroundColor: 'rgba(231,76,60,0.08)', color: DANGER, borderRadius: 0 }}>{error}</div>}
            <div><label className="mb-0.5 block" style={labelStyle}>Full Name *</label><input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full px-3 py-1.5 outline-none transition-all" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div>
            <div><label className="mb-0.5 block" style={labelStyle}>Email *</label><input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-1.5 outline-none transition-all" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div>
            <div><label className="mb-0.5 block" style={labelStyle}>Telephone *</label><input type="tel" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} className="w-full px-3 py-1.5 outline-none transition-all" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div>
            <div><label className="mb-0.5 block" style={labelStyle}>Title</label><input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-1.5 outline-none transition-all" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div>
            <div><label className="mb-0.5 block" style={labelStyle}>Gender</label><select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full px-3 py-1.5 outline-none transition-all" style={inputStyle} onFocus={focusInput} onBlur={blurInput}><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
          </div>
          <div className="px-4 py-3 flex justify-end gap-2" style={{ borderTop: `1px solid ${BORDER}` }}><button onClick={onClose} className="px-3 py-1.5 bg-transparent hover:bg-gray-100 transition-colors" style={{ ...btnStyle, border: `1px solid ${PRIMARY}`, color: PRIMARY }}>Cancel</button><button onClick={handleSubmit} disabled={isSubmitting} className="px-3 py-1.5 disabled:opacity-50 transition-colors" style={{ ...btnStyle, backgroundColor: PRIMARY, color: WHITE }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}>{isSubmitting ? 'Adding...' : 'Add Employee'}</button></div>
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
        <div className="fixed inset-0 bg-black/40" />
        <div className="relative w-full max-w-[600px]" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }} onClick={e => e.stopPropagation()}>
          <div className="px-4 py-3 flex justify-between items-center" style={{ borderBottom: `1px solid ${BORDER}` }}><h3 className="text-sm" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>Edit Employee</h3><button onClick={onClose} className="hover:text-gray-600" style={{ color: GRAY_DISABLED }}><FiX className="w-4 h-4" /></button></div>
          <div className="p-4 space-y-3">
            {error && <div className="p-2 text-sm" style={{ backgroundColor: 'rgba(231,76,60,0.08)', color: DANGER, borderRadius: 0 }}>{error}</div>}
            <div><label className="mb-0.5 block" style={labelStyle}>Full Name *</label><input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full px-3 py-1.5 outline-none transition-all" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div>
            <div><label className="mb-0.5 block" style={labelStyle}>Email *</label><input type="email" value={formData.email} disabled className="w-full px-3 py-1.5 outline-none" style={{ ...inputStyle, border: `1px solid ${BORDER}`, color: GRAY_DISABLED }} /><p className="text-xs mt-0.5 italic" style={{ color: GRAY_DISABLED }}>Email cannot be changed.</p></div>
            <div><label className="mb-0.5 block" style={labelStyle}>Telephone</label><input type="tel" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} className="w-full px-3 py-1.5 outline-none transition-all" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div>
            <div><label className="mb-0.5 block" style={labelStyle}>Title</label><input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-1.5 outline-none transition-all" style={inputStyle} onFocus={focusInput} onBlur={blurInput} /></div>
            <div><label className="mb-0.5 block" style={labelStyle}>Gender</label><select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full px-3 py-1.5 outline-none transition-all" style={inputStyle} onFocus={focusInput} onBlur={blurInput}><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
          </div>
          <div className="px-4 py-3 flex justify-end gap-2" style={{ borderTop: `1px solid ${BORDER}` }}><button onClick={onClose} className="px-3 py-1.5 bg-transparent hover:bg-gray-100 transition-colors" style={{ ...btnStyle, border: `1px solid ${PRIMARY}`, color: PRIMARY }}>Cancel</button><button onClick={handleSubmit} disabled={isSubmitting} className="px-3 py-1.5 disabled:opacity-50 transition-colors" style={{ ...btnStyle, backgroundColor: PRIMARY, color: WHITE }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}>{isSubmitting ? 'Saving...' : 'Save Changes'}</button></div>
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
        <div className="fixed inset-0 bg-black/40" />
        <div className="relative w-full max-w-md" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }} onClick={e => e.stopPropagation()}>
          <div className="px-4 py-3 flex justify-between items-center" style={{ borderBottom: `1px solid ${BORDER}` }}><h3 className="text-sm" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>Employee Details</h3><button onClick={onClose} className="hover:text-gray-600" style={{ color: GRAY_DISABLED }}><FiX className="w-4 h-4" /></button></div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 pb-3" style={{ borderBottom: `1px solid ${BORDER}` }}><div className="w-10 h-10 flex items-center justify-center" style={{ backgroundColor: 'rgba(5,109,170,0.1)', borderRadius: 0 }}><FiUser className="w-5 h-5" style={{ color: PRIMARY }} /></div><div><p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{employee.full_name || employee.name}</p><p className="text-xs" style={{ color: GRAY_DISABLED }}>{employee.title || 'No title'}</p></div></div>
            <div className="space-y-2 text-sm" style={{ color: NEUTRAL_DARK }}><div className="flex items-center gap-2"><FiMail className="w-4 h-4" style={{ color: GRAY_DISABLED }} /><span>{employee.email}</span></div><div className="flex items-center gap-2"><FiPhone className="w-4 h-4" style={{ color: GRAY_DISABLED }} /><span>{employee.telephone || employee.phone || 'N/A'}</span></div><div className="flex items-center gap-2"><FiBriefcase className="w-4 h-4" style={{ color: GRAY_DISABLED }} /><span>{employee.gender || 'N/A'}</span></div></div>
          </div>
          <div className="px-4 py-3 flex justify-end" style={{ borderTop: `1px solid ${BORDER}` }}><button onClick={onClose} className="px-3 py-1.5 bg-transparent hover:bg-gray-100 transition-colors" style={{ ...btnStyle, border: `1px solid ${PRIMARY}`, color: PRIMARY }}>Close</button></div>
        </div>
      </div>
    </div>
  );
};
