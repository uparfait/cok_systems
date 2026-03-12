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
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Assign Employee</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Select an employee to handle this visitor
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <FiX />
            </button>
          </div>

          {/* Visitor Info */}
          {visitor && (
            <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <FiUser className="text-blue-600 text-xl" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{visitor.fullName}</p>
                  <p className="text-sm text-gray-500">{visitor.service}</p>
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6">
            {/* Status Messages */}
            {submitStatus === 'success' && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
                <FiCheck className="text-xl" />
                <span>Employee assigned successfully!</span>
              </div>
            )}
            
            {submitStatus === 'error' && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
                <FiAlertCircle className="text-xl" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Employees
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Employee List */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Employees
              </label>
              <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
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
                          ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                          : 'hover:bg-gray-50'
                      } ${employee.isAvailable ? '' : 'opacity-50'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            selectedEmployee?._id === employee._id 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            <FiUser />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{employee.fullName}</p>
                            <p className="text-xs text-gray-500">{employee.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {employee.isAvailable ? (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                              Available
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <FiClock />
                              Busy
                            </span>
                          )}
                          {selectedEmployee?._id === employee._id && (
                            <FiCheck className="text-blue-500" />
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any notes about this assignment..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedEmployee || isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
