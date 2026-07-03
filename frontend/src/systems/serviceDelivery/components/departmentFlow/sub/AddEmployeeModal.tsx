// Add Employee Modal
import { useState } from 'react';
import { FiX } from "react-icons/fi";

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (employee: { name: string; email: string; title: string; phone: string; gender: string; department: string }) => void;
}

const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [title, setTitle] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [gender, setGender] = useState('');
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);

  const departments = ['Urban Planning', 'Land Management', 'Building Permit', 'Finance', 'Registry'];
  const filteredDepartments = departments.filter(d => d.toLowerCase().includes(department.toLowerCase()));

  const handleSubmit = () => {
    if (fullName && email && title && telephone && gender && department) {
      onAdd({ name: fullName, email, title, phone: telephone, gender, department });
      setTitle(''); setFullName(''); setDepartment(''); setEmail(''); setTelephone(''); setGender('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30" />
        <div className="relative bg-white shadow-[0_8px_32px_rgba(0,0,0,0.15)] w-full max-w-[700px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-[#e8eaed]">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-[#1a2744]">Add New Employee</h3>
                <p className="text-xs text-[#888] mt-0.5">Enter the details for the new staff member.</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="px-6 pb-0">
            <div className="flex gap-4 mt-6">
              <div className="w-1/2">
                <label className="block text-xs font-semibold text-[#333] mb-1.5">Title</label>
                <select value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-11 px-3 border border-[#d0d5dd] bg-white text-sm text-[#333] outline-none">
                  <option value="">Select Title</option>
                  <option value="Mr.">Mr.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Eng.">Eng.</option>
                </select>
              </div>
              <div className="w-1/2">
                <label className="block text-xs font-semibold text-[#333] mb-1.5">Full Name</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Evode MUYISINGIZE" className="w-full h-11 px-3 border border-[#d0d5dd] bg-white text-sm text-[#333] outline-none" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-[#333] mb-1.5">Department</label>
              <div className="relative">
                <input type="text" value={department} onChange={(e) => { setDepartment(e.target.value); setShowDepartmentDropdown(true); }} onFocus={() => setShowDepartmentDropdown(true)} placeholder="Search for department..." className="w-full h-11 px-3 pl-9 border border-[#d0d5dd] bg-[#f0f4f8] text-sm text-[#333] outline-none" />
                {showDepartmentDropdown && department && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-[#d0d5dd] mt-1 max-h-36 overflow-y-auto z-10">
                    {filteredDepartments.map((dept) => (
                      <div key={dept} onClick={() => { setDepartment(dept); setShowDepartmentDropdown(false); }} className="px-3 py-2 cursor-pointer border-b border-gray-100 hover:bg-gray-50 text-sm">{dept}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <div className="w-1/2">
                <label className="block text-xs font-semibold text-[#333] mb-1.5">Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="evode@kigalicity.rw" className="w-full h-11 px-3 pl-9 border border-[#d0d5dd] bg-[#f0f4f8] text-sm text-[#333] outline-none" />
              </div>
              <div className="w-1/2">
                <label className="block text-xs font-semibold text-[#333] mb-1.5">Telephone</label>
                <input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+250 788 000 000" className="w-full h-11 px-3 pl-9 border border-[#d0d5dd] bg-[#f0f4f8] text-sm text-[#333] outline-none" />
              </div>
            </div>
            <div className="mt-4 mb-6">
              <label className="block text-xs font-semibold text-[#333] mb-2">Gender</label>
              <div className="flex gap-4">
                {['Male', 'Female', 'Other'].map((option) => (
                  <label key={option} className="flex items-center cursor-pointer">
                    <div className="w-4 h-4 border border-[#c0c8d0] flex items-center justify-center mr-2" onClick={() => setGender(option)}>
                      {gender === option && <div className="w-2 h-2 bg-[#1a73e8]" />}
                    </div>
                    <span className="text-sm text-[#333]">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-[#f8f9fb] px-6 py-4 border-t border-[#e8eaed] flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-[#d0d5dd] text-sm text-[#333] hover:bg-gray-50">Cancel</button>
            <button onClick={handleSubmit} className="px-5 py-2 bg-[#1a73e8] text-white text-sm font-semibold hover:bg-blue-700 shadow-[0_2px_8px_rgba(26,115,232,0.3)] flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              Create Employee
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddEmployeeModal;