// View Employee Modal
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
        <div className="fixed inset-0 bg-[rgba(15,23,42,0.4)]" />
        <div 
          className="relative bg-white shadow-[0px_20px_60px_rgba(0,0,0,0.2)] w-full max-w-[600px] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
            <h3 className="text-base font-bold text-[#0F172A]">Employee Details</h3>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100">
              <FiX className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-[#0284C7] flex items-center justify-center text-white text-lg font-bold">
                {employee.initials}
              </div>
              <div>
                <h4 className="text-base font-bold text-[#0F172A]">{employee.name}</h4>
                <p className="text-xs text-[#64748B]">{employee.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium ${
                  employee.status === 'Active' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FFEDD5] text-[#C2410C]'
                }`}>
                  {employee.status === 'Active' && <span className="w-1.5 h-1.5 bg-green-500"></span>}
                  {employee.status}
                </span>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase mb-1">Department</p>
                <p className="text-sm font-semibold text-[#0F172A]">{employee.department || 'N/A'}</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-[#E2E8F0] flex justify-end">
            <button onClick={onClose} className="px-4 py-2 border border-[#E2E8F0] text-[#475569] hover:bg-gray-50 text-sm">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewEmployeeModal;