// Edit Employee Modal
import { useState, useEffect } from 'react';
import { FiX } from "react-icons/fi";

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
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

const readOnlyInputStyle: React.CSSProperties = {
  ...inputStyle,
  color: GRAY_DISABLED,
};

const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.border = `1px solid ${PRIMARY}`;
  e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)';
};

const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.border = '1px solid transparent';
  e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)';
};

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
        <div className="fixed inset-0 bg-black/40" />
        <div
          className="relative bg-white w-full max-w-[560px] overflow-hidden"
          style={{ borderRadius: 0, boxShadow: CARD_SHADOW }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b" style={{ borderColor: BORDER }}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Edit Employee Details</h3>
                <p className="text-xs text-[#9E9E9E] mt-0.5">Update Employee information</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <label className="block mb-1.5" style={labelStyle}>Employee ID</label>
              <input type="text" defaultValue={employee.empId} readOnly className="w-full h-11 px-3 py-2 cursor-not-allowed outline-none" style={readOnlyInputStyle} />
            </div>
            <div className="mb-4">
              <label className="block mb-1.5" style={labelStyle}>Full Name</label>
              <input type="text" defaultValue={employee.name} onChange={(e) => setFormData({...formData, fullName: e.target.value})} className="w-full h-11 px-3 py-2 outline-none transition-all" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur} />
            </div>
            <div className="mb-4">
              <label className="block mb-1.5" style={labelStyle}>Title</label>
              <input type="text" defaultValue={employee.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full h-11 px-3 py-2 outline-none transition-all" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur} />
            </div>
            <div className="mb-4">
              <label className="block mb-2" style={labelStyle}>Gender</label>
              <div className="flex gap-4">
                {['Male', 'Female'].map((option) => (
                  <label key={option} className="flex items-center cursor-pointer">
                    <div className="w-4 h-4 border-2 border-[#056daa] flex items-center justify-center mr-2" style={{ borderRadius: 0 }} onClick={() => setFormData({...formData, gender: option})}>
                      {formData.gender === option && <div className="w-2 h-2 bg-[#056daa]" />}
                    </div>
                    <span className="text-sm text-[#333333]">{option}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block mb-1.5" style={labelStyle}>Email Address</label>
              <input type="email" defaultValue={employee.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full h-11 px-3 py-2 outline-none transition-all" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur} />
            </div>
            <div className="mb-4">
              <label className="block mb-1.5" style={labelStyle}>Phone Number</label>
              <input type="tel" placeholder="+250 971 783 308" onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full h-11 px-3 py-2 outline-none transition-all" style={inputStyle} onFocus={handleInputFocus} onBlur={handleInputBlur} />
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
              onClick={handleSave}
              className="px-5 py-2 transition-colors"
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
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditEmployeeModal;
