

import {
  FiX, FiUsers, FiFileText, FiTarget, FiUser,
  FiUsers as FiPeople, FiCheck, FiChevronDown, FiSearch, FiLoader
} from "react-icons/fi";
import { useState, useEffect, useRef } from "react";

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#388E3C";
const WARNING = "#F39C12";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

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
      <div className="w-full px-3 py-2 text-sm cursor-not-allowed flex items-center" style={{ fontFamily: fontHeading, backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', color: GRAY_DISABLED }}>
        {icon && <span className="mr-2">{icon}</span>}
        <span>{placeholder}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className="w-full px-3 py-2 text-sm cursor-text border border-transparent shadow-[0px_2px_4px_rgba(0,0,0,0.1)] focus-within:border-[#056daa] focus-within:shadow-[0px_4px_8px_rgba(5,109,170,0.25)] transition-all"
        style={{ fontFamily: fontHeading, backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}
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
        <div className="absolute z-50 w-full mt-1 max-h-60 overflow-auto" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0, boxShadow: CARD_SHADOW }}>
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 text-center">
              No results found
            </div>
          ) : (
            filteredOptions.map(option => (
              <div
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`px-3 py-2 cursor-pointer hover:bg-[rgba(5,109,170,0.08)] ${
                  option.id === value ? 'bg-[rgba(5,109,170,0.08)] text-[#056daa] font-medium' : 'text-gray-700'
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
    // Fixed overlay
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - plain, no blur */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={isAlreadyAssignedToSelectedDept ? undefined : onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-3xl mx-4 overflow-visible" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
        {/* Modal Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: NEUTRAL_LIGHT, borderBottom: `1px solid ${BORDER}` }}>
          <h2 className="text-lg" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>Assign Visitor to Department & Unit</h2>
          <button
            onClick={onClose}
            disabled={isAlreadyAssignedToSelectedDept}
            className="p-1 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Modal Body - Two Columns */}
        <div className="p-6 overflow-visible" style={{ backgroundColor: WHITE }}>
          <div className="grid grid-cols-2 gap-6">
            {/* LEFT SIDE */}
            <div className="space-y-4">
              {/* Visitor Information Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiUsers style={{ color: PRIMARY }} />
                  <h3 style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>VISITOR INFORMATION</h3>
                </div>

                {/* Visitor Info Card */}
                <div className="p-4 space-y-2" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                  {/* Name */}
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Name</span>
                    <span className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{visitor.full_name}</span>
                  </div>
                  {/* Visitor ID */}
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Visitor ID</span>
                    <span className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{getIdentification(visitor.identification, (visitor as any).driver_identification)}</span>
                  </div>
                  {/* Phone */}
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Phone</span>
                    <span className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{visitor.telephone}</span>
                  </div>
                </div>
              </div>

              {/* Service Details Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiFileText style={{ color: PRIMARY }} />
                  <h3 style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>SELECT UNIT (OPTIONAL)</h3>
                </div>

                {/* Show department queue info */}
                {selectedDeptInfo && (
                  <div className="p-3 mb-3" style={{ backgroundColor: 'rgba(243,156,18,0.08)', borderRadius: 0 }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Department Queue:</span>
                      <span className="text-sm font-bold" style={{ color: WARNING }}>{(selectedDeptInfo.currentQueue || 0) + 1} visitors</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-600">Staff Available:</span>
                      <span className="text-sm font-bold" style={{ color: SUCCESS_HOVER }}>{selectedDeptInfo.staffAvailable}</span>
                    </div>
                  </div>
                )}

                {/* Unit Selection - Replaced with Colleague's SearchableSelect */}
                <div className="relative z-40">
                  <label className="block mb-1" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>Select Unit (Optional)</label>
                  {unitsLoading ? (
                    <div className="w-full px-3 py-2 text-sm flex items-center justify-center" style={{ backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}>
                      <FiLoader className="w-4 h-4 border-2 border-[#056daa] border-t-transparent rounded-full animate-spin mr-2" />
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
                  <FiTarget style={{ color: PRIMARY }} />
                  <h3 style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>SELECT TARGET DEPARTMENT</h3>
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
                  <div className="mt-3 p-3" style={{ backgroundColor: 'rgba(231,76,60,0.08)', border: `1px solid ${DANGER}`, borderRadius: 0 }}>
                    <p className="text-sm font-medium" style={{ color: DANGER }}>
                      ⚠️ This visitor already has an active assignment to this department/unit.
                      Please complete or cancel the existing service before reassigning.
                    </p>
                  </div>
                )}

                {/* Unit Status & Availability Card - Only show when unit selected */}
                {selectedUnitInfo && (
                  <div className="p-4 space-y-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm" style={{ fontFamily: fontHeading, fontWeight: 700, color: PRIMARY }}>Unit Status</h4>
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${selectedUnitInfo.isActive ? 'bg-[#4CAF50]' : 'bg-[#E74C3C]'}`}></span>
                        <span className={`text-xs font-medium ${selectedUnitInfo.isActive ? 'text-[#388E3C]' : 'text-[#E74C3C]'}`}>
                          {selectedUnitInfo.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {/* Current Queue Card - White Background */}
                    <div className="p-3 flex items-center justify-between" style={{ backgroundColor: WHITE, borderRadius: 0 }}>
                      <div className="flex items-center gap-2">
                        <FiPeople className="text-gray-500" />
                        <span className="text-sm text-gray-600">Unit Queue</span>
                      </div>
                      <span className="text-lg font-bold" style={{ color: NEUTRAL_DARK }}>
                        {(selectedUnitInfo.currentQueue || 0) + 1}
                      </span>
                    </div>

                    {/* Available Staff Card - White Background */}
                    <div className="p-3 flex items-center justify-between" style={{ backgroundColor: WHITE, borderRadius: 0 }}>
                      <div className="flex items-center gap-2">
                        <FiUser className="text-gray-500" />
                        <span className="text-sm text-gray-600">Available Staff</span>
                      </div>
                      <span className="text-lg font-bold" style={{ color: NEUTRAL_DARK }}>{selectedUnitInfo.staffAvailable}</span>
                    </div>
                  </div>
                )}

                {/* Department Status Card - Show when department selected but no unit */}
                {selectedDeptInfo && !selectedUnit && (
                  <div className="p-4 space-y-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm" style={{ fontFamily: fontHeading, fontWeight: 700, color: PRIMARY }}>Department Status</h4>
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${selectedDeptInfo.isActive ? 'bg-[#4CAF50]' : 'bg-[#E74C3C]'}`}></span>
                        <span className={`text-xs font-medium ${selectedDeptInfo.isActive ? 'text-[#388E3C]' : 'text-[#E74C3C]'}`}>
                          {selectedDeptInfo.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {/* Current Queue Card - White Background */}
                    <div className="p-3 flex items-center justify-between" style={{ backgroundColor: WHITE, borderRadius: 0 }}>
                      <div className="flex items-center gap-2">
                        <FiPeople className="text-gray-500" />
                        <span className="text-sm text-gray-600">Current Queue</span>
                      </div>
                      <span className="text-lg font-bold" style={{ color: NEUTRAL_DARK }}>
                        {(selectedDeptInfo.currentQueue || 0) + 1}
                      </span>
                    </div>

                    {/* Available Staff Card - White Background */}
                    <div className="p-3 flex items-center justify-between" style={{ backgroundColor: WHITE, borderRadius: 0 }}>
                      <div className="flex items-center gap-2">
                        <FiUser className="text-gray-500" />
                        <span className="text-sm text-gray-600">Available Staff</span>
                      </div>
                      <span className="text-lg font-bold" style={{ color: NEUTRAL_DARK }}>{selectedDeptInfo.staffAvailable}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 relative z-10" style={{ backgroundColor: NEUTRAL_LIGHT, borderTop: `1px solid ${BORDER}` }}>
          {/* Success Message */}
          {showSuccessMessage && successMessage && (
            <div className="mb-3 p-3" style={{ backgroundColor: 'rgba(76,175,80,0.12)', border: `1px solid ${SUCCESS}`, borderRadius: 0 }}>
              <p className="text-sm font-medium" style={{ color: SUCCESS_HOVER }}>{successMessage}</p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isAlreadyAssignedToSelectedDept}
              className="px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
            >
              {isAlreadyAssignedToSelectedDept ? 'Cannot Close - Service In Progress' : 'Cancel'}
            </button>
            <button
              onClick={onConfirm}
              disabled={!selectedDepartment || isLoading || isAlreadyAssignedToSelectedDept}
              className="px-4 py-2 transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              style={{ backgroundColor: (!selectedDepartment || isLoading || isAlreadyAssignedToSelectedDept) ? GRAY_DISABLED : PRIMARY, color: WHITE, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = (!selectedDepartment || isLoading || isAlreadyAssignedToSelectedDept) ? GRAY_DISABLED : PRIMARY; }}
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