// Delete Employee Modal
import { useState } from 'react';

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
        <div className="fixed inset-0 bg-black/25" />
        <div className="bg-white shadow-[0_8px_40px_rgba(0,0,0,0.15)] w-full max-w-[460px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="h-1.5 bg-[#e53935]" />
          <div className="px-8 py-6 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-[#fce8e6] flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2">
                <path d="M12 2L2 22h20L12 2z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <circle cx="12" cy="17" r="1" fill="#e53935" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#1a2744] mb-3">Delete Employee?</h3>
            <p className="text-sm text-[#666] max-w-[340px] mb-4">
              Are you sure you want to permanently delete the record for <span className="font-bold text-[#333]">{employee.name}</span>? This action cannot be undone.
            </p>
            {error && <div className="p-3 bg-red-100 text-red-600 text-sm mb-4 w-full">{error}</div>}
            <div className="flex justify-center gap-3">
              <button onClick={onClose} className="w-36 h-11 border border-[#d0d5dd] text-sm text-[#333] hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={isDeleting} className="w-44 h-11 bg-[#e53935] text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_2px_10px_rgba(229,57,53,0.4)]">
                {isDeleting ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin" />Deleting...</>
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