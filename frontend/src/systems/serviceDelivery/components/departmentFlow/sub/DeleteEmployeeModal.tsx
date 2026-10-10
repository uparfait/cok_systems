import { useState } from 'react';
import OverlayShell from '../../../../../core/components/overlay/OverlayShell';

const DANGER = "#E74C3C";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";

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

interface DeleteEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: DepartmentEmployee | null;
  onDelete: () => Promise<void>;
}

const DeleteEmployeeModal: React.FC<DeleteEmployeeModalProps> = ({ isOpen, onClose, employee, onDelete }) => {
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
    <OverlayShell
      open
      title="Delete Employee?"
      onClose={onClose}
      busy={isDeleting}
      width="sm"
      footer={
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="w-44 h-11 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          style={{
            backgroundColor: isDeleting ? GRAY_DISABLED : DANGER,
            color: WHITE,
            borderRadius: 0,
            fontFamily: fontHeading,
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}
          onMouseEnter={(e) => { if (!isDeleting) e.currentTarget.style.backgroundColor = '#C0392B'; }}
          onMouseLeave={(e) => { if (!isDeleting) e.currentTarget.style.backgroundColor = DANGER; }}
        >
          {isDeleting ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Deleting...</>
          ) : 'Delete Employee'}
        </button>
      }
    >
      <div className="px-2 py-2 text-center flex flex-col items-center">
        <div className="w-16 h-16 bg-[rgba(231,76,60,0.1)] flex items-center justify-center mb-4" style={{ borderRadius: 0 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" strokeWidth="2">
            <path d="M12 2L2 22h20L12 2z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <circle cx="12" cy="17" r="1" fill="#E74C3C" />
          </svg>
        </div>
        <p className="text-sm text-[#555555] max-w-[340px] mb-2">
          Are you sure you want to permanently delete the record for <span className="font-bold text-[#333333]">{employee.name}</span>? This action cannot be undone.
        </p>
        {error && <div className="p-3 bg-[rgba(231,76,60,0.1)] text-[#E74C3C] text-sm mt-2 w-full" style={{ borderRadius: 0 }}>{error}</div>}
      </div>
    </OverlayShell>
  );
};

export default DeleteEmployeeModal;
