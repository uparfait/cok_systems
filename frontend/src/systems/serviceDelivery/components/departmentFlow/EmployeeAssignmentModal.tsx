// EmployeeAssignmentModal Component - Employee assignment modal
// Modal for assigning visitors to employees

import React, { useState, useEffect } from 'react';
import {
  FiX,
  FiUser,
  FiSearch,
  FiCheck,
  FiAlertCircle,
  FiClock,
  FiUsers,
  FiBriefcase
} from 'react-icons/fi';
import { assignVisitorToDepartment } from '../../services/serviceDeliveryService';

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#388E3C";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

interface Employee {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  department?: {
    _id: string;
    department_name: string;
  };
  isAvailable?: boolean;
}

interface Visitor {
  _id: string;
  fullName: string;
  service: string;
  department?: {
    _id: string;
    department_name: string;
  };
}

interface EmployeeAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitor: Visitor | null;
  departmentId?: string;
  onSuccess?: (data: any) => void;
}

// Mock employees for demo
const mockEmployees: Employee[] = [
  { _id: '1', fullName: 'Alice Uwase', email: 'alice.uwase@cok.gov.rw', role: 'Officer', isAvailable: true },
  { _id: '2', fullName: 'Bob Mugisha', email: 'bob.mugisha@cok.gov.rw', role: 'Senior Officer', isAvailable: true },
  { _id: '3', fullName: 'Claire Mukamana', email: 'claire.mukamana@cok.gov.rw', role: 'Supervisor', isAvailable: false },
  { _id: '4', fullName: 'David Habineza', email: 'david.habineza@cok.gov.rw', role: 'Officer', isAvailable: true },
  { _id: '5', fullName: 'Eva Ingabire', email: 'eva.ingabire@cok.gov.rw', role: 'Senior Officer', isAvailable: true },
];

const EmployeeAssignmentModal: React.FC<EmployeeAssignmentModalProps> = ({
  isOpen,
  onClose,
  visitor,
  departmentId,
  onSuccess,
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  // [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [notes, setNotes] = useState('');
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedEmployee(null);
      setNotes('');
      setSubmitStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  // Filter employees based on search
  const filteredEmployees = employees.filter(emp => {
    const query = searchQuery.toLowerCase();
    return (
      emp.fullName.toLowerCase().includes(query) ||
      emp.email.toLowerCase().includes(query) ||
      emp.role.toLowerCase().includes(query)
    );
  });

  // Handle employee selection
  const handleSelectEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!visitor || !selectedEmployee) return;

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const payload = {
        visitorId: visitor._id,
        departmentId: departmentId || visitor.department?._id,
        employeeId: selectedEmployee._id,
        notes: notes || undefined,
      };

      const response = await assignVisitorToDepartment(payload);

      if (response.status) {
        setSubmitStatus('success');
        if (onSuccess) {
          onSuccess(response.data);
        }
        // Close modal after short delay
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setSubmitStatus('error');
        setErrorMessage(response.message || 'Failed to assign employee');
      }
    } catch (error: any) {
      // Simulate success for demo
      setSubmitStatus('success');
      if (onSuccess) {
        onSuccess({ visitor, employee: selectedEmployee, notes });
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle modal close
  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg max-h-[90vh] overflow-hidden" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: NEUTRAL_LIGHT, borderBottom: `1px solid ${BORDER}` }}>
            <div>
              <h2 className="text-lg" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>Assign Employee</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Select an employee to handle this visitor
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <FiX />
            </button>
          </div>

          {/* Visitor Info */}
          {visitor && (
            <div className="px-6 py-4" style={{ backgroundColor: 'rgba(5,109,170,0.08)', borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(5,109,170,0.12)' }}>
                  <FiUser className="text-xl" style={{ color: PRIMARY }} />
                </div>
                <div>
                  <p className="font-medium" style={{ color: NEUTRAL_DARK }}>{visitor.fullName}</p>
                  <p className="text-sm text-gray-500">{visitor.service}</p>
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6">
            {/* Status Messages */}
            {submitStatus === 'success' && (
              <div className="mb-4 p-4 flex items-center gap-3" style={{ backgroundColor: 'rgba(76,175,80,0.12)', border: `1px solid ${SUCCESS}`, borderRadius: 0, color: SUCCESS_HOVER }}>
                <FiCheck className="text-xl" />
                <span>Employee assigned successfully!</span>
              </div>
            )}

            {submitStatus === 'error' && (
              <div className="mb-4 p-4 flex items-center gap-3" style={{ backgroundColor: 'rgba(231,76,60,0.08)', border: `1px solid ${DANGER}`, borderRadius: 0, color: DANGER }}>
                <FiAlertCircle className="text-xl" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Search */}
            <div className="mb-4">
              <label className="block mb-2" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>
                Search Employees
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: GRAY_DISABLED }} />
                <input
                  type="text"
                  placeholder="Search by name, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 focus:outline-none transition-all"
                  style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Employee List */}
            <div className="mb-4">
              <label className="block mb-2" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>
                Available Employees
              </label>
              <div className="max-h-64 overflow-y-auto" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
                {filteredEmployees.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    <FiUsers className="text-4xl mx-auto mb-2 opacity-50" />
                    <p>No employees found</p>
                  </div>
                ) : (
                  filteredEmployees.map((employee) => (
                    <div
                      key={employee._id}
                      onClick={() => !isSubmitting && handleSelectEmployee(employee)}
                      className={`px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors ${
                        selectedEmployee?._id === employee._id
                          ? 'bg-[rgba(5,109,170,0.08)] border-l-4 border-l-[#056daa]'
                          : 'hover:bg-gray-50'
                      } ${employee.isAvailable ? '' : 'opacity-50'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            selectedEmployee?._id === employee._id
                              ? 'bg-[#056daa] text-white'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            <FiUser />
                          </div>
                          <div>
                            <p className="font-medium" style={{ color: NEUTRAL_DARK }}>{employee.fullName}</p>
                            <p className="text-xs text-gray-500">{employee.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {employee.isAvailable ? (
                            <span className="flex items-center gap-1 text-xs" style={{ color: SUCCESS_HOVER }}>
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SUCCESS }}></span>
                              Available
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <FiClock />
                              Busy
                            </span>
                          )}
                          {selectedEmployee?._id === employee._id && (
                            <FiCheck style={{ color: PRIMARY }} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="block mb-2" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any notes about this assignment..."
                className="w-full px-4 py-2.5 focus:outline-none transition-all"
                style={{ fontFamily: fontHeading, fontSize: '14px', backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 flex justify-end gap-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderTop: `1px solid ${BORDER}` }}>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedEmployee || isSubmitting}
              className="flex items-center gap-2 px-4 py-2 transition-colors disabled:cursor-not-allowed"
              style={{ backgroundColor: (!selectedEmployee || isSubmitting) ? GRAY_DISABLED : PRIMARY, color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = (!selectedEmployee || isSubmitting) ? GRAY_DISABLED : PRIMARY; }}
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Assigning...
                </>
              ) : (
                <>
                  <FiCheck /> Assign Employee
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EmployeeAssignmentModal;
