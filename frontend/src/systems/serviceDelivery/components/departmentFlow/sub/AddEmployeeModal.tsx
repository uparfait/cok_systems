// Add Employee Modal
import { useState } from 'react';
import { FiX } from "react-icons/fi";

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: TERTIARY,
};

const inputStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '14px',
  backgroundColor: NEUTRAL_LIGHT,
  border: '1px solid transparent',
  borderRadius: 0,
  boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
  color: NEUTRAL_DARK,
};

const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  e.currentTarget.style.border = `1px solid ${PRIMARY}`;
  e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)';
};

const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  e.currentTarget.style.border = '1px solid transparent';
  e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)';
};

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
        <div className="fixed inset-0 bg-black/40" />
        <div className="relative bg-white w-full max-w-[700px] overflow-hidden" style={{ borderRadius: 0, boxShadow: CARD_SHADOW }} onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-4 border-b" style={{ borderColor: BORDER }}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Add New Employee</h3>
                <p className="text-xs text-[#9E9E9E] mt-0.5">Enter the details for the new staff member.</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="px-6 pb-0">
            <div className="flex gap-4 mt-6">
              <div className="w-1/2">
                <label className="block mb-1.5" style={labelStyle}>Title</label>
                <select value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-11 px-3 outline-none transition-all" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur}>
                  <option value="">Select Title</option>
                  <option value="Mr.">Mr.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Eng.">Eng.</option>
                </select>
              </div>
              <div className="w-1/2">
                <label className="block mb-1.5" style={labelStyle}>Full Name</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Evode MUYISINGIZE" className="w-full h-11 px-3 outline-none transition-all" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur} />
              </div>
            </div>
            <div className="mt-4">
              <label className="block mb-1.5" style={labelStyle}>Department</label>
              <div className="relative">
                <input type="text" value={department} onChange={(e) => { setDepartment(e.target.value); setShowDepartmentDropdown(true); }} onFocus={(e) => { setShowDepartmentDropdown(true); handleInputFocus(e); }} onBlur={handleInputBlur} placeholder="Search for department..." className="w-full h-11 px-3 pl-9 outline-none transition-all" style={inputStyle} />
                {showDepartmentDropdown && department && (
                  <div className="absolute top-full left-0 right-0 bg-white border mt-1 max-h-36 overflow-y-auto z-10" style={{ borderColor: BORDER, borderRadius: 0, boxShadow: CARD_SHADOW }}>
                    {filteredDepartments.map((dept) => (
                      <div key={dept} onClick={() => { setDepartment(dept); setShowDepartmentDropdown(false); }} className="px-3 py-2 cursor-pointer border-b border-[#E0E0E0] hover:bg-[#F7F9FB] text-sm text-[#333333]">{dept}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <div className="w-1/2">
                <label className="block mb-1.5" style={labelStyle}>Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="evode@kigalicity.rw" className="w-full h-11 px-3 pl-9 outline-none transition-all" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur} />
              </div>
              <div className="w-1/2">
                <label className="block mb-1.5" style={labelStyle}>Telephone</label>
                <input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+250 788 000 000" className="w-full h-11 px-3 pl-9 outline-none transition-all" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur} />
              </div>
            </div>
            <div className="mt-4 mb-6">
              <label className="block mb-2" style={labelStyle}>Gender</label>
              <div className="flex gap-4">
                {['Male', 'Female', 'Other'].map((option) => (
                  <label key={option} className="flex items-center cursor-pointer">
                    <div className="w-4 h-4 border border-[#E0E0E0] flex items-center justify-center mr-2" style={{ borderRadius: 0 }} onClick={() => setGender(option)}>
                      {gender === option && <div className="w-2 h-2 bg-[#056daa]" />}
                    </div>
                    <span className="text-sm text-[#333333]">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderColor: BORDER }}>
            <button
              onClick={onClose}
              className="px-4 py-2 transition-colors hover:bg-[rgba(5,109,170,0.08)]"
              style={{
                backgroundColor: 'transparent',
                border: `1px solid ${PRIMARY}`,
                color: PRIMARY,
                borderRadius: 0,
                fontFamily: fontHeading,
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-5 py-2 flex items-center gap-2 transition-colors"
              style={{
                backgroundColor: PRIMARY,
                color: WHITE,
                borderRadius: 0,
                fontFamily: fontHeading,
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
            >
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
