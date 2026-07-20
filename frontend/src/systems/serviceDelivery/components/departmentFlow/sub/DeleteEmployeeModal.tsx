// Delete Employee Modal
import { useState } from 'react';

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const DANGER = "#E74C3C";
const NEUTRAL_DARK = "#333333";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

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
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40" />
        <div className="bg-white w-full max-w-[460px] overflow-hidden" style={{ borderRadius: 0, boxShadow: CARD_SHADOW }} onClick={(e) => e.stopPropagation()}>
          <div className="h-1.5" style={{ backgroundColor: DANGER }} />
          <div className="px-8 py-6 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-[rgba(231,76,60,0.1)] flex items-center justify-center mb-4" style={{ borderRadius: 0 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" strokeWidth="2">
                <path d="M12 2L2 22h20L12 2z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <circle cx="12" cy="17" r="1" fill="#E74C3C" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-3" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Delete Employee?</h3>
            <p className="text-sm text-[#555555] max-w-[340px] mb-4">
              Are you sure you want to permanently delete the record for <span className="font-bold text-[#333333]">{employee.name}</span>? This action cannot be undone.
            </p>
            {error && <div className="p-3 bg-[rgba(231,76,60,0.1)] text-[#E74C3C] text-sm mb-4 w-full" style={{ borderRadius: 0 }}>{error}</div>}
            <div className="flex justify-center gap-3">
              <button
                onClick={onClose}
                className="w-36 h-11 transition-colors hover:bg-[rgba(5,109,170,0.08)]"
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteEmployeeModal;
