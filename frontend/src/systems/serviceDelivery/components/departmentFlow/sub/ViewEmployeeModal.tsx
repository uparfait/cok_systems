// View Employee Modal
import { FiX } from "react-icons/fi";

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
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

interface ViewEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: DepartmentEmployee | null;
}

const ViewEmployeeModal: React.FC<ViewEmployeeModalProps> = ({ isOpen, onClose, employee }) => {
  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40" />
        <div
          className="relative bg-white w-full max-w-[600px] overflow-hidden"
          style={{ borderRadius: 0, boxShadow: CARD_SHADOW }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: BORDER }}>
            <h3 className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Employee Details</h3>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100" style={{ borderRadius: 0 }}>
              <FiX className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 flex items-center justify-center text-white text-lg font-bold" style={{ backgroundColor: PRIMARY, color: WHITE, fontFamily: fontHeading, borderRadius: 0 }}>
                {employee.initials}
              </div>
              <div>
                <h4 className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{employee.name}</h4>
                <p className="text-xs text-[#555555]">{employee.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1" style={labelStyle}>Employee ID</p>
                <p className="text-sm font-semibold text-[#333333]">{employee.empId}</p>
              </div>
              <div>
                <p className="mb-1" style={labelStyle}>Title</p>
                <p className="text-sm font-semibold text-[#333333]">{employee.title}</p>
              </div>
              <div>
                <p className="mb-1" style={labelStyle}>Status</p>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                  employee.status === 'Active' ? 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]' : 'bg-[rgba(243,156,18,0.12)] text-[#F39C12]'
                }`} style={{ fontFamily: fontHeading, borderRadius: 0 }}>
                  {employee.status === 'Active' && <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50]"></span>}
                  {employee.status}
                </span>
              </div>
              <div>
                <p className="mb-1" style={labelStyle}>Department</p>
                <p className="text-sm font-semibold text-[#333333]">{employee.department || 'N/A'}</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t flex justify-end" style={{ borderColor: BORDER }}>
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
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewEmployeeModal;
