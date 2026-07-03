// Edit Employee Modal
import { useState, useEffect } from 'react';
import { FiX } from "react-icons/fi";

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

interface EditEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: DepartmentEmployee | null;
  onSave: (employee: DepartmentEmployee) => void;
}

const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({ isOpen, onClose, employee, onSave }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    title: '',
    gender: 'Male',
    email: '',
    phone: ''
  });

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
          className="relative bg-white shadow-[0_8px_40px_rgba(0,0,0,0.14)] w-full max-w-[560px] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-[#e8eaed]">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-[#1a2744]">Edit Employee Details</h3>
                <p className="text-xs text-[#888] mt-0.5">Update Employee information</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#333] mb-1.5">Employee ID</label>
              <input type="text" defaultValue={employee.empId} readOnly className="w-full h-11 px-3 py-2 border border-[#d0d5dd] bg-[#f0f4f8] text-sm text-[#333] cursor-not-allowed outline-none" />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#333] mb-1.5">Full Name</label>
              <input type="text" defaultValue={employee.name} onChange={(e) => setFormData({...formData, fullName: e.target.value})} className="w-full h-11 px-3 py-2 border border-[#d0d5dd] bg-[#f0f4f8] text-sm text-[#333] outline-none" />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#333] mb-1.5">Title</label>
              <input type="text" defaultValue={employee.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full h-11 px-3 py-2 border border-[#d0d5dd] bg-[#f0f4f8] text-sm text-[#333] outline-none" />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#333] mb-1.5">Gender</label>
              <div className="flex gap-4">
                {['Male', 'Female'].map((option) => (
                  <label key={option} className="flex items-center cursor-pointer">
                    <div className="w-4 h-4 border-2 border-[#1a73e8] flex items-center justify-center mr-2" onClick={() => setFormData({...formData, gender: option})}>
                      {formData.gender === option && <div className="w-2 h-2 bg-[#1a73e8]" />}
                    </div>
                    <span className="text-sm text-[#333]">{option}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#333] mb-1.5">Email Address</label>
              <input type="email" defaultValue={employee.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full h-11 px-3 py-2 border border-[#d0d5dd] bg-[#f0f4f8] text-sm text-[#333] outline-none" />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#333] mb-1.5">Phone Number</label>
              <input type="tel" placeholder="+250 971 783 308" onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full h-11 px-3 py-2 border border-[#d0d5dd] bg-[#f0f4f8] text-sm text-[#333] outline-none" />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-[#e8eaed] flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-[#d0d5dd] text-sm text-[#333] hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} className="px-5 py-2 bg-[#1a73e8] text-white text-sm font-semibold hover:bg-blue-700 shadow-[0_2px_8px_rgba(26,115,232,0.35)]">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditEmployeeModal;