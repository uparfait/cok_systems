// AssignVisitorModal Component - Modal for assigning visitors to departments
// This modal appears when clicking "Assign" and blurs the background

import { 
  FiX, FiUsers, FiFileText, FiTarget, FiUser, 
  FiUsers as FiPeople, FiCheck, FiChevronDown 
} from "react-icons/fi";

interface Department {
  id: string;
  name: string;
  staffAvailable: number;
  currentQueue: number;
  isActive: boolean;
}

interface Employee {
  _id?: string;
  employee_id?: string;
  full_name?: string;
  email?: string;
  telephone?: string;
  title?: string;
  department?: string | { _id?: string; department_name?: string };
  is_active?: boolean;
}

interface Visitor {
  id: string;
  full_name: string;
  identification: string | { number?: string };
  telephone: string;
  email?: string;
  address?: string;
  status: 'pending' | 'waiting' | 'In_progress' | 'completed';
  check_in_time: string;
  department?: string;
  service?: string;
  purpose?: string;
  assignedStaff?: string;
  departments_assigned?: Array<{
    department_id: string;
    department_name?: string;
    status: string;
  }>;
}

// Helper function to extract identification string from various formats
const getIdentification = (identification: string | { number?: string } | undefined, driverIdentification?: string | { number?: string } | undefined): string => {
  // Check identification field first
  if (identification) {
    if (typeof identification === 'string') return identification;
    if (typeof identification === 'object' && identification.number) {
      return identification.number;
    }
  }
  // Check driver_identification field as fallback
  if (driverIdentification) {
    if (typeof driverIdentification === 'string') return driverIdentification;
    if (typeof driverIdentification === 'object' && driverIdentification.number) {
      return driverIdentification.number;
    }
  }
  return 'N/A';
};

interface AssignVisitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitor: Visitor | null;
  departments: Department[];
  employees: Employee[];
  selectedDepartment: string;
  selectedEmployee: Employee | null;
  employeeQueueCount?: number;
  onSelectDepartment: (deptId: string) => void;
  onSelectEmployee: (employee: Employee | null) => void;
  onConfirm: () => void;
  showSuccessMessage?: boolean;
  successMessage?: string;
  isLoading?: boolean;
  employeesLoading?: boolean;
}

// COK Services options
const COK_SERVICES = [
  { id: 'general_inquiry', name: 'General Inquiry' },
  { id: 'service_complaint', name: 'Service Complaint' },
  { id: 'permit_request', name: 'Permit Request' },
  { id: 'tax_inquiry', name: 'Tax Inquiry' },
  { id: 'business_registration', name: 'Business Registration' },
  { id: 'land_management', name: 'Land Management' },
  { id: 'construction_permit', name: 'Construction Permit' },
];

const AssignVisitorModal: React.FC<AssignVisitorModalProps> = ({
  isOpen,
  onClose,
  visitor,
  departments,
  employees,
  selectedDepartment,
  selectedEmployee,
  employeeQueueCount = 0,
  onSelectDepartment,
  onSelectEmployee,
  onConfirm,
  showSuccessMessage,
  successMessage,
  isLoading,
  employeesLoading = false
}) => {
  if (!isOpen || !visitor) return null;

  // Get selected department info
  const selectedDeptInfo = departments.find(d => d.id === selectedDepartment);
  
  // Check if visitor already has an active assignment to this department
  const visitorDepartments = visitor.departments_assigned || [];
  const isAlreadyAssignedToSelectedDept = visitorDepartments.some(
    (dept: any) => dept.department_id === selectedDepartment && dept.status !== 'completed'
  );

  return (
    // Fixed overlay with backdrop blur effect - makes dashboard blurry
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur - this creates the blurry effect on the dashboard */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={isAlreadyAssignedToSelectedDept ? undefined : onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden">
        {/* Modal Header - Sky Blue Background */}
        <div className="px-6 py-4 bg-sky-50 border-b border-sky-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">Assign Visitor to Service & Department</h2>
          <button 
            onClick={onClose} 
            disabled={isAlreadyAssignedToSelectedDept}
            className="p-1 hover:bg-sky-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Modal Body - Two Columns */}
        <div className="p-6 bg-white">
          <div className="grid grid-cols-2 gap-6">
            {/* LEFT SIDE */}
            <div className="space-y-4">
              {/* Visitor Information Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiUsers className="text-sky-600" />
                  <h3 className="text-sm font-semibold text-gray-700">VISITOR INFORMATION</h3>
                </div>
                
                {/* Visitor Info Card - Sky Blue Background */}
                <div className="bg-sky-50 rounded-lg p-4 space-y-2">
                  {/* Name */}
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Name</span>
                    <span className="text-sm font-medium text-gray-800">{visitor.full_name}</span>
                  </div>
                  {/* Visitor ID */}
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Visitor ID</span>
                    <span className="text-sm font-medium text-gray-800">{getIdentification(visitor.identification, (visitor as any).driver_identification)}</span>
                  </div>
                  {/* Phone */}
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Phone</span>
                    <span className="text-sm font-medium text-gray-800">{visitor.telephone}</span>
                  </div>
                </div>
              </div>

              {/* Service Details Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiFileText className="text-sky-600" />
                  <h3 className="text-sm font-semibold text-gray-700">SELECT PROVIDER (OPTIONAL)</h3>
                </div>

                {/* Show department queue info */}
                {selectedDeptInfo && (
                  <div className="bg-yellow-50 rounded-lg p-3 mb-3 border border-yellow-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Current Queue:</span>
                      <span className="text-sm font-bold text-yellow-700">{(selectedDeptInfo.currentQueue || 0) + 1} visitors</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-600">Staff Available:</span>
                      <span className="text-sm font-bold text-green-700">{selectedDeptInfo.staffAvailable}</span>
                    </div>
                  </div>
                )}

                {/* Employee Selection */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Select Employee (Optional)</label>
                  <div className="relative">
                    {employeesLoading ? (
                      <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                        <span className="text-gray-500">Loading employees...</span>
                      </div>
                    ) : (
                      <select
                        value={selectedEmployee?._id || ''}
                        onChange={(e) => {
                          const emp = employees.find(emp => emp._id === e.target.value);
                          onSelectEmployee(emp || null);
                        }}
                        disabled={!selectedDepartment}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-none bg-white cursor-pointer disabled:bg-gray-100"
                      >
                        <option value="">No specific employee - Auto-assign</option>
                        {employees.filter((emp: any) => {
                          if (!selectedDepartment) return true;
                          const empDeptId = emp.department?._id || emp.department;
                          return empDeptId === selectedDepartment;
                        }).map((emp: any) => (
                          <option key={emp._id} value={emp._id}>
                            {emp.full_name} {emp.title ? `(${emp.title})` : ''} {emp.is_active === false ? '(Inactive)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="space-y-4">
              {/* Select Target Department Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiTarget className="text-sky-600" />
                  <h3 className="text-sm font-semibold text-gray-700">SELECT TARGET DEPARTMENT</h3>
                </div>

                {/* Department Dropdown */}
                <div className="mb-3">
                  <div className="relative">
                    <select
                      value={selectedDepartment}
                      onChange={(e) => onSelectDepartment(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-none bg-white cursor-pointer"
                    >
                      <option value="">Choose the department</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Warning if visitor already assigned to this department */}
                {selectedDepartment && isAlreadyAssignedToSelectedDept && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600 font-medium">
                      ⚠️ This visitor already has an active assignment to this department. 
                      Please complete or cancel the existing service before reassigning.
                    </p>
                  </div>
                )}

                {/* Department Status & Availability Card - Sky Blue - Only show when employee selected */}
                {selectedDeptInfo && selectedEmployee && (
                  <div className="bg-sky-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-sky-700">Employee Status</h4>
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${selectedEmployee.is_active !== false ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className={`text-xs font-medium ${selectedEmployee.is_active !== false ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedEmployee.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {/* Current Queue Card - White Background */}
                    <div className="bg-white rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FiPeople className="text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {selectedEmployee ? 'Employee Queue' : 'Current Queue'}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-gray-800">
                        {selectedEmployee ? (employeeQueueCount || 0) + 1 : ((selectedDeptInfo?.currentQueue || 0) + 1)}
                      </span>
                    </div>

                    {/* Available Staff Card - White Background */}
                    <div className="bg-white rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FiUser className="text-gray-500" />
                        <span className="text-sm text-gray-600">Available Staff</span>
                      </div>
                      <span className="text-lg font-bold text-gray-800">{selectedDeptInfo.staffAvailable}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Sky Blue Background */}
        <div className="px-6 py-4 bg-sky-50 border-t border-sky-100">
          {/* Success Message */}
          {showSuccessMessage && successMessage && (
            <div className="mb-3 p-3 bg-green-100 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700 font-medium">{successMessage}</p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isAlreadyAssignedToSelectedDept}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAlreadyAssignedToSelectedDept ? 'Cannot Close - Service In Progress' : 'Cancel'}
            </button>
            <button
              onClick={onConfirm}
              disabled={!selectedDepartment || isLoading || isAlreadyAssignedToSelectedDept}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FiCheck className="w-4 h-4" />
              {isLoading ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignVisitorModal;
