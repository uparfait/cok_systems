

import { 
  FiX, FiUsers, FiFileText, FiTarget, FiUser, 
  FiUsers as FiPeople, FiCheck, FiChevronDown, FiSearch, FiLoader 
} from "react-icons/fi";
import { useState, useEffect, useRef } from "react";

interface Department {
  id: string;
  name: string;
  staffAvailable: number;
  currentQueue: number;
  isActive: boolean;
  sub_departments?: Department[];
}

interface Unit {
  id: string;
  name: string;
  staffAvailable: number;
  currentQueue: number;
  isActive: boolean;
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

// ==========================================
// NEW FEATURE: SearchableSelect Component
// ==========================================
interface SearchableSelectProps {
  options: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  icon
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [displayText, setDisplayText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.id === value);
  
  useEffect(() => {
    if (selectedOption) {
      setDisplayText(selectedOption.name);
    } else {
      setDisplayText('');
    }
  }, [selectedOption]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  if (disabled) {
    return (
      <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-500 cursor-not-allowed flex items-center">
        {icon && <span className="mr-2">{icon}</span>}
        <span>{placeholder}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div 
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white cursor-text focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500"
        onClick={() => !isOpen && inputRef.current?.focus()}
      >
        <div className="flex items-center">
          {icon && <span className="mr-2 text-gray-400"><FiSearch className="w-4 h-4" /></span>}
          <input
            ref={inputRef}
            type="text"
            value={isOpen ? searchTerm : displayText}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={value ? '' : placeholder}
            className="flex-1 outline-none bg-transparent text-gray-800 placeholder-gray-400 w-full"
            disabled={disabled}
          />
        </div>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 text-center">
              No results found
            </div>
          ) : (
            filteredOptions.map(option => (
              <div
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`px-3 py-2 cursor-pointer hover:bg-sky-50 ${
                  option.id === value ? 'bg-sky-50 text-sky-700 font-medium' : 'text-gray-700'
                }`}
              >
                {option.name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
// ==========================================

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
  units: Unit[];
  selectedDepartment: string;
  selectedUnit: string;
  onSelectDepartment: (deptId: string) => void;
  onSelectUnit: (unitId: string) => void;
  onConfirm: () => void;
  showSuccessMessage?: boolean;
  successMessage?: string;
  isLoading?: boolean;
  unitsLoading?: boolean;
}

const AssignVisitorModal: React.FC<AssignVisitorModalProps> = ({
  isOpen,
  onClose,
  visitor,
  departments,
  units,
  selectedDepartment,
  selectedUnit,
  onSelectDepartment,
  onSelectUnit,
  onConfirm,
  showSuccessMessage,
  successMessage,
  isLoading,
  unitsLoading = false
}) => {
  if (!isOpen || !visitor) return null;

  // Get selected department info
  const selectedDeptInfo = departments.find(d => d.id === selectedDepartment);
  
  // Get selected unit info
  const selectedUnitInfo = units.find(u => u.id === selectedUnit);
  
  // Check if visitor already has an active assignment to this department/unit
  const visitorDepartments = visitor.departments_assigned || [];
  const isAlreadyAssignedToSelectedDept = visitorDepartments.some(
    (dept: any) => (dept.department_id === selectedDepartment || dept.department_id === selectedUnit) && dept.status !== 'completed'
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
      <div className="relative bg-white shadow-2xl w-full max-w-3xl mx-4 overflow-visible">
        {/* Modal Header - Sky Blue Background */}
        <div className="px-6 py-4 bg-sky-50 border-b border-sky-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">Assign Visitor to Department & Unit</h2>
          <button 
            onClick={onClose} 
            disabled={isAlreadyAssignedToSelectedDept}
            className="p-1 hover:bg-sky-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Modal Body - Two Columns */}
        <div className="p-6 bg-white overflow-visible">
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
                  <h3 className="text-sm font-semibold text-gray-700">SELECT UNIT (OPTIONAL)</h3>
                </div>

                {/* Show department queue info */}
                {selectedDeptInfo && (
                  <div className="bg-yellow-50 rounded-lg p-3 mb-3 border border-yellow-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Department Queue:</span>
                      <span className="text-sm font-bold text-yellow-700">{(selectedDeptInfo.currentQueue || 0) + 1} visitors</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-600">Staff Available:</span>
                      <span className="text-sm font-bold text-green-700">{selectedDeptInfo.staffAvailable}</span>
                    </div>
                  </div>
                )}

                {/* Unit Selection - Replaced with Colleague's SearchableSelect */}
                <div className="relative z-40">
                  <label className="text-xs text-gray-500 block mb-1">Select Unit (Optional)</label>
                  {unitsLoading ? (
                    <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 flex items-center justify-center">
                      <FiLoader className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-2" />
                      <span className="text-gray-500">Loading units...</span>
                    </div>
                  ) : (
                    <SearchableSelect
                      options={[
                        { id: '', name: 'No specific unit - Assign to department' },
                        ...units.map((unit: Unit) => ({ 
                          id: unit.id, 
                          name: `${unit.name}${unit.staffAvailable > 0 ? ` (${unit.staffAvailable} staff)` : ''}` 
                        }))
                      ]}
                      value={selectedUnit}
                      onChange={onSelectUnit}
                      placeholder="Search or select a unit..."
                      disabled={!selectedDepartment || units.length === 0}
                    />
                  )}
                  {selectedDepartment && units.length === 0 && !unitsLoading && (
                    <p className="text-xs text-gray-500 mt-1">No units available for this department</p>
                  )}
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

                {/* Department Dropdown - Replaced with Colleague's SearchableSelect */}
                <div className="mb-3 relative z-50">
                  <SearchableSelect
                    options={departments.map(dept => ({ id: dept.id, name: dept.name }))}
                    value={selectedDepartment}
                    onChange={onSelectDepartment}
                    placeholder="Search or select a department..."
                  />
                </div>

                {/* Warning if visitor already assigned to this department */}
                {selectedDepartment && isAlreadyAssignedToSelectedDept && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600 font-medium">
                      ⚠️ This visitor already has an active assignment to this department/unit. 
                      Please complete or cancel the existing service before reassigning.
                    </p>
                  </div>
                )}

                {/* Unit Status & Availability Card - Sky Blue - Only show when unit selected */}
                {selectedUnitInfo && (
                  <div className="bg-sky-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-sky-700">Unit Status</h4>
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${selectedUnitInfo.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className={`text-xs font-medium ${selectedUnitInfo.isActive ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedUnitInfo.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {/* Current Queue Card - White Background */}
                    <div className="bg-white rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FiPeople className="text-gray-500" />
                        <span className="text-sm text-gray-600">Unit Queue</span>
                      </div>
                      <span className="text-lg font-bold text-gray-800">
                        {(selectedUnitInfo.currentQueue || 0) + 1}
                      </span>
                    </div>

                    {/* Available Staff Card - White Background */}
                    <div className="bg-white rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FiUser className="text-gray-500" />
                        <span className="text-sm text-gray-600">Available Staff</span>
                      </div>
                      <span className="text-lg font-bold text-gray-800">{selectedUnitInfo.staffAvailable}</span>
                    </div>
                  </div>
                )}

                {/* Department Status Card - Show when department selected but no unit */}
                {selectedDeptInfo && !selectedUnit && (
                  <div className="bg-sky-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-sky-700">Department Status</h4>
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${selectedDeptInfo.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className={`text-xs font-medium ${selectedDeptInfo.isActive ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedDeptInfo.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {/* Current Queue Card - White Background */}
                    <div className="bg-white rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FiPeople className="text-gray-500" />
                        <span className="text-sm text-gray-600">Current Queue</span>
                      </div>
                      <span className="text-lg font-bold text-gray-800">
                        {(selectedDeptInfo.currentQueue || 0) + 1}
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
        <div className="px-6 py-4 bg-sky-50 border-t border-sky-100 relative z-10">
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