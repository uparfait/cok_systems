// Employee Management Modals Component

import { useState, useEffect } from 'react';
import { FiX, FiEye, FiEdit, FiTrash2, FiCheck } from "react-icons/fi";

interface DepartmentEmployee {
  id: string;
  empId: string;
  name: string;
  email: string;
  title: string;
  status: 'Active' | 'Away';
  initials: string;
  department?: string;
  department_name?: string;
}

// View Employee Modal
interface ViewEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: DepartmentEmployee | null;
}

export const ViewEmployeeModal: React.FC<ViewEmployeeModalProps> = ({ isOpen, onClose, employee }) => {
  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-[rgba(15,23,42,0.4)] backdrop-blur-sm" />
        <div 
          className="relative bg-white rounded-[20px] shadow-[0px_20px_60px_rgba(0,0,0,0.2)] w-full max-w-[600px] overflow-hidden animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-[#E2E8F0]">
            <h3 className="text-xl font-bold text-[#0F172A]">Employee Details</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <FiX className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-20 h-20 rounded-full bg-[#0284C7] flex items-center justify-center text-white text-2xl font-bold">
                {employee.initials}
              </div>
              <div>
                <h4 className="text-xl font-bold text-[#0F172A]">{employee.name}</h4>
                <p className="text-sm text-[#64748B]">{employee.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-[#64748B] uppercase mb-1">Employee ID</p>
                <p className="text-sm font-semibold text-[#0F172A]">{employee.empId}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase mb-1">Title</p>
                <p className="text-sm font-semibold text-[#0F172A]">{employee.title}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase mb-1">Status</p>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  employee.status === 'Active' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FFEDD5] text-[#C2410C]'
                }`}>
                  {employee.status === 'Active' && <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>}
                  {employee.status}
                </span>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase mb-1">Department</p>
                <p className="text-sm font-semibold text-[#0F172A]">{employee.department || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 border-t border-[#E2E8F0] flex justify-end">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 border border-[#E2E8F0] rounded-[10px] text-[#475569] hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Edit Employee Modal
interface EditEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: DepartmentEmployee | null;
  onSave: (employee: DepartmentEmployee) => void;
}

export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({ isOpen, onClose, employee, onSave }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    title: '',
    gender: 'Male',
    email: '',
    phone: ''
  });

  // Initialize form data when modal opens
  useEffect(() => {
    if (employee && isOpen) {
      setFormData({
        fullName: employee.name,
        title: employee.title,
        gender: 'Male',
        email: employee.email,
        phone: ''
      });
    }
  }, [employee, isOpen]);

  if (!isOpen || !employee) return null;

  const handleSave = () => {
    onSave({
      ...employee,
      name: formData.fullName,
      title: formData.title,
      email: formData.email
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/25" />
        <div 
          className="relative bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.14)] w-full max-w-[560px] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ padding: '28px 28px 20px 28px', borderBottom: '1px solid #e8eaed' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#1a2744', margin: 0 }}>Edit Employee Details</h3>
                <p style={{ fontSize: '13px', color: '#888888', marginTop: '5px', margin: 0 }}>Update Employee information</p>
              </div>
              <button 
                onClick={onClose} 
                style={{ 
                  position: 'absolute', 
                  top: '22px', 
                  right: '24px',
                  background: 'none', 
                  border: 'none', 
                  fontSize: '20px', 
                  color: '#aaaaaa', 
                  cursor: 'pointer' 
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Form Body */}
          <div style={{ padding: '24px 28px 0 28px' }}>
            {/* Employee ID - Read Only */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>Employee ID</label>
              <div style={{ position: 'relative' }}>
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#1a73e8" 
                  strokeWidth="2"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                >
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <line x1="7" y1="8" x2="17" y2="8" />
                </svg>
                <input 
                  type="text" 
                  defaultValue={employee.empId}
                  readOnly
                  style={{
                    width: '100%',
                    height: '46px',
                    border: '1px solid #d0d5dd',
                    borderRadius: '10px',
                    background: '#f0f4f8',
                    padding: '0 14px 0 42px',
                    fontSize: '14px',
                    color: '#333',
                    cursor: 'not-allowed',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Full Name */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#1a73e8" 
                  strokeWidth="2"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input 
                  type="text" 
                  defaultValue={employee.name}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  style={{
                    width: '100%',
                    height: '46px',
                    border: '1px solid #d0d5dd',
                    borderRadius: '10px',
                    background: '#f0f4f8',
                    padding: '0 14px 0 42px',
                    fontSize: '14px',
                    color: '#333',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>Title</label>
              <div style={{ position: 'relative' }}>
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#1a73e8" 
                  strokeWidth="2"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input 
                  type="text" 
                  defaultValue={employee.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  style={{
                    width: '100%',
                    height: '46px',
                    border: '1px solid #d0d5dd',
                    borderRadius: '10px',
                    background: '#f0f4f8',
                    padding: '0 14px 0 42px',
                    fontSize: '14px',
                    color: '#333',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Gender - Radio */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '10px' }}>Gender</label>
              <div style={{ display: 'flex', gap: '28px' }}>
                {['Male', 'Female'].map((option) => (
                  <label 
                    key={option}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      cursor: 'pointer',
                      margin: 0
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        border: option === 'Male' ? '2px solid #1a73e8' : '1.5px solid #c0c8d0',
                        background: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '8px'
                      }}
                      onClick={() => setFormData({...formData, gender: option})}
                    >
                      {option === 'Male' && (
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: '#1a73e8'
                        }} />
                      )}
                    </div>
                    <span style={{ color: '#333', fontSize: '14px' }}>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <svg 
                  width="15" 
                  height="15" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#1a73e8" 
                  strokeWidth="2"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input 
                  type="email" 
                  defaultValue={employee.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  style={{
                    width: '100%',
                    height: '46px',
                    border: '1px solid #d0d5dd',
                    borderRadius: '10px',
                    background: '#f0f4f8',
                    padding: '0 14px 0 42px',
                    fontSize: '14px',
                    color: '#333',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Phone */}
            <div style={{ marginBottom: '0px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>Phone Number</label>
              <div style={{ position: 'relative' }}>
                <svg 
                  width="15" 
                  height="15" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#1a73e8" 
                  strokeWidth="2"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                >
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                </svg>
                <input 
                  type="tel" 
                  placeholder="+250 971 783 308"
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  style={{
                    width: '100%',
                    height: '46px',
                    border: '1px solid #d0d5dd',
                    borderRadius: '10px',
                    background: '#f0f4f8',
                    padding: '0 14px 0 42px',
                    fontSize: '14px',
                    color: '#333',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ 
            padding: '20px 28px 28px 28px', 
            borderTop: '1px solid #e8eaed',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '12px'
          }}>
            <button 
              onClick={onClose}
              style={{
                width: '110px',
                height: '44px',
                background: '#ffffff',
                border: '1px solid #d0d5dd',
                borderRadius: '22px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#333',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              style={{
                width: '140px',
                height: '44px',
                background: '#1a73e8',
                border: 'none',
                borderRadius: '22px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'white',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(26,115,232,0.35)'
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Delete Employee Modal
interface DeleteEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: DepartmentEmployee | null;
  onDelete: () => Promise<void>;
}

export const DeleteEmployeeModal: React.FC<DeleteEmployeeModalProps> = ({ isOpen, onClose, employee, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  
  if (!isOpen || !employee) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await onDelete();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete employee');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/25" />
        <div 
          style={{
            width: '100%',
            maxWidth: '460px',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Red Accent Bar */}
          <div style={{
            height: '6px',
            background: '#e53935',
            borderRadius: '16px 16px 0 0'
          }} />

          {/* Body */}
          <div style={{
            padding: '32px 36px 28px 36px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            {/* Warning Icon */}
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: '#fce8e6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
                <path d="M12 2L2 22h20L12 2z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <circle cx="12" cy="17" r="1" fill="#e53935" />
              </svg>
            </div>

            {/* Title */}
            <h3 style={{
              fontSize: '22px',
              fontWeight: 700,
              color: '#1a2744',
              marginBottom: '14px',
              margin: 0
            }}>
              Delete Employee?
            </h3>

            {/* Body Text */}
            <p style={{
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#666666',
              maxWidth: '340px',
              marginBottom: '28px',
              margin: 0
            }}>
              Are you sure you want to permanently delete the record for <span style={{ fontWeight: 700, color: '#333333' }}>{employee.name}</span>? This action cannot be undone.
            </p>
            
            {/* Error Message */}
            {error && (
              <div style={{
                padding: '12px',
                background: '#fee2e2',
                color: '#dc2626',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            {/* Buttons */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '14px'
            }}>
              <button 
                onClick={onClose}
                style={{
                  width: '160px',
                  height: '48px',
                  background: '#ffffff',
                  border: '1.5px solid #d0d5dd',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: '#333333',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  width: '190px',
                  height: '48px',
                  background: isDeleting ? '#9ca3af' : '#e53935',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#ffffff',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: isDeleting ? 'none' : '0 2px 10px rgba(229,57,53,0.4)'
                }}
              >
                {isDeleting ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" className="animate-spin">
                      <circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.3"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="#ffffff" strokeWidth="3" fill="none"/>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Delete Employee
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add Employee Modal
interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (employee: { name: string; email: string; title: string; phone: string; gender: string; department: string }) => void;
}

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [title, setTitle] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [gender, setGender] = useState('');
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);

  const departments = ['Urban Planning', 'Land Management', 'Building Permit', 'Finance', 'Registry'];

  const filteredDepartments = departments.filter(d => 
    d.toLowerCase().includes(department.toLowerCase())
  );

  const handleSubmit = () => {
    if (fullName && email && title && telephone && gender && department) {
      onAdd({
        name: fullName,
        email,
        title,
        phone: telephone,
        gender,
        department
      });
      // Reset form
      setTitle('');
      setFullName('');
      setDepartment('');
      setEmail('');
      setTelephone('');
      setGender('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30" />
        <div 
          className="relative bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] w-full max-w-[700px] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-7 py-5 border-b border-[#e8eaed]">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-[#1a2744]">Add New Employee</h3>
                <p className="text-[13px] text-[#888] mt-1">Enter the details for the new staff member.</p>
              </div>
              <button 
                onClick={onClose} 
                className="text-[#aaaaaa] text-xl cursor-pointer hover:text-gray-600"
                style={{ position: 'absolute', top: '20px', right: '24px' }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Form Body */}
          <div className="px-7 pb-0">
            {/* Row 1 - Two Columns */}
            <div className="flex gap-5" style={{ marginTop: '28px' }}>
              {/* Column 1 - Title */}
              <div style={{ width: '50%' }}>
                <label className="block text-[13px] font-semibold text-[#333] mb-2">Title</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      border: '1px solid #d0d5dd',
                      borderRadius: '8px',
                      background: '#ffffff',
                      padding: '0 14px',
                      fontSize: '14px',
                      color: title ? '#333' : '#888',
                      appearance: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Select Title</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Eng.">Eng.</option>
                  </select>
                  <span style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#aaa',
                    pointerEvents: 'none'
                  }}>∨</span>
                </div>
              </div>

              {/* Column 2 - Full Name */}
              <div style={{ width: '50%' }}>
                <label className="block text-[13px] font-semibold text-[#333] mb-2">Full Name</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Evode MUYISINGIZE"
                  style={{
                    width: '100%',
                    height: '44px',
                    border: '1px solid #d0d5dd',
                    borderRadius: '8px',
                    background: '#ffffff',
                    padding: '0 14px',
                    fontSize: '14px',
                    color: '#333',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Row 2 - Department (full width) */}
            <div style={{ marginTop: '20px' }}>
              <label className="block text-[13px] font-semibold text-[#333] mb-2">Department</label>
              <div style={{ position: 'relative' }}>
                <svg 
                  width="15" 
                  height="15" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#aaa" 
                  strokeWidth="2"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 1
                  }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input 
                  type="text" 
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setShowDepartmentDropdown(true);
                  }}
                  onFocus={() => setShowDepartmentDropdown(true)}
                  placeholder="Search for department..."
                  style={{
                    width: '100%',
                    height: '44px',
                    border: '1px solid #d0d5dd',
                    borderRadius: '8px',
                    background: '#f0f4f8',
                    padding: '0 14px 0 40px',
                    fontSize: '14px',
                    color: '#333',
                    outline: 'none'
                  }}
                />
                {showDepartmentDropdown && department && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid #d0d5dd',
                    borderRadius: '8px',
                    marginTop: '4px',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    zIndex: 10
                  }}>
                    {filteredDepartments.map((dept) => (
                      <div
                        key={dept}
                        onClick={() => {
                          setDepartment(dept);
                          setShowDepartmentDropdown(false);
                        }}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f0f0f0'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        {dept}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Row 3 - Two Columns */}
            <div className="flex gap-5" style={{ marginTop: '20px' }}>
              {/* Column 1 - Email */}
              <div style={{ width: '50%' }}>
                <label className="block text-[13px] font-semibold text-[#333] mb-2">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <svg 
                    width="15" 
                    height="15" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#aaa" 
                    strokeWidth="2"
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)'
                    }}
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="evode@kigalicity.rw"
                    style={{
                      width: '100%',
                      height: '44px',
                      border: '1px solid #d0d5dd',
                      borderRadius: '8px',
                      background: '#f0f4f8',
                      padding: '0 14px 0 42px',
                      fontSize: '14px',
                      color: '#333',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Column 2 - Telephone */}
              <div style={{ width: '50%' }}>
                <label className="block text-[13px] font-semibold text-[#333] mb-2">Telephone</label>
                <div style={{ position: 'relative' }}>
                  <svg 
                    width="15" 
                    height="15" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#aaa" 
                    strokeWidth="2"
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)'
                    }}
                  >
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                  </svg>
                  <input 
                    type="tel" 
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="+250 788 000 000"
                    style={{
                      width: '100%',
                      height: '44px',
                      border: '1px solid #d0d5dd',
                      borderRadius: '8px',
                      background: '#f0f4f8',
                      padding: '0 14px 0 42px',
                      fontSize: '14px',
                      color: '#333',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Row 4 - Gender Radio Group */}
            <div style={{ marginTop: '20px', marginBottom: '28px' }}>
              <label className="block text-[13px] font-semibold text-[#333] mb-3">Gender</label>
              <div style={{ display: 'flex', gap: '28px' }}>
                {['Male', 'Female', 'Other'].map((option) => (
                  <label 
                    key={option}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      cursor: 'pointer',
                      margin: 0
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        border: '1.5px solid #c0c8d0',
                        background: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '8px'
                      }}
                      onClick={() => setGender(option)}
                    >
                      {gender === option && (
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: '#1a73e8'
                        }} />
                      )}
                    </div>
                    <span style={{ color: '#333', fontSize: '14px' }}>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div 
            style={{
              background: '#f8f9fb',
              padding: '16px 28px',
              borderTop: '1px solid #e8eaed',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '12px',
              height: '72px'
            }}
          >
            <button 
              onClick={onClose}
              style={{
                width: '100px',
                height: '42px',
                background: '#ffffff',
                border: '1px solid #d0d5dd',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#333',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              style={{
                width: '160px',
                height: '42px',
                background: '#1a73e8',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(26,115,232,0.3)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Create Employee
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
