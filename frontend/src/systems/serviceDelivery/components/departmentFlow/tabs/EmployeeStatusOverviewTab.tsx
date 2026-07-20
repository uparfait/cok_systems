// Employee Status Overview Tab Component

import { useState, useEffect } from "react";
import { FiSearch, FiFilter, FiX, FiUser, FiClock } from "react-icons/fi";
import { employeeService, serviceDeliveryService, type Employee } from "../../../../../core/services/adminService";

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const GRAY_DISABLED = "#9E9E9E";
const ACCENT_DARK_BLUE = "#2980B9";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

interface EmployeeStatusOverviewTabProps {
  departmentId?: string;
}

// Function to determine employee status based on their current workload
const getEmployeeStatus = (emp: Employee, visitorsCount: number): { status: string; statusBg: string; statusColor: string } => {
  // If no visitors assigned, they're available
  if (!visitorsCount || visitorsCount === 0) {
    return { status: 'Online', statusBg: 'rgba(76,175,80,0.12)', statusColor: SUCCESS };
  }
  // If they have visitors in progress
  if (visitorsCount > 0) {
    return { status: 'In a Service', statusBg: 'rgba(5,109,170,0.1)', statusColor: PRIMARY };
  }
  // Default to online
  return { status: 'Online', statusBg: 'rgba(76,175,80,0.12)', statusColor: SUCCESS };
};

// Function to get initials from name
const getInitials = (name: string): string => {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1 
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() 
    : name.substring(0, 2).toUpperCase();
};

// Visitor type for modal
interface VisitorData {
  _id: string;
  full_name: string;
  identification?: {
    number?: string;
  };
  services_status?: {
    s_type: string;
    department_id: string;
    provider_id?: string;
    provider_name?: string;
  };
  entry_date?: string;
}

const EmployeeStatusOverviewTab: React.FC<EmployeeStatusOverviewTabProps> = ({ departmentId }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [visitorCounts, setVisitorCounts] = useState<Record<string, number>>({});
  const [employeeVisitors, setEmployeeVisitors] = useState<Record<string, VisitorData[]>>({});
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!departmentId) {
        // If no department, get all employees
        try {
          const response = await employeeService.getAll();
          if (response.success && response.data) {
            setEmployees(response.data);
          }
        } catch (error) {
          console.error('Failed to fetch employees:', error);
        }
      } else {
        // Get employees by department
        try {
          const response = await employeeService.getByDepartment(departmentId, false);
          if (response.success && response.data) {
            setEmployees(response.data);
          }
        } catch (error) {
          console.error('Failed to fetch employees:', error);
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [departmentId]);

  // Fetch visitors to calculate counts per employee
  useEffect(() => {
    const fetchVisitorCounts = async () => {
      if (!departmentId) return;
      
      try {
        // Get all current visitors by department
        const response = await serviceDeliveryService.getCurrentVisitorsByDepartment(departmentId);
        if (response.success && response.data) {
          const counts: Record<string, number> = {};
          const visitorsByEmployee: Record<string, VisitorData[]> = {};
          
          // Process the data - handle both grouped and flat formats
          const deptData = Array.isArray(response.data) ? response.data : [];
          
          deptData.forEach((dept: any) => {
            const visitors = dept.visitors || [];
            visitors.forEach((v: VisitorData) => {
              // Get the services_status for this visitor
              // Note: after $unwind, services_status is a single object
              const statusObj = v.services_status as any;
              if (statusObj && statusObj.provider_id) {
                const providerId = statusObj.provider_id;
                
                // Count visitors per employee
                counts[providerId] = (counts[providerId] || 0) + 1;
                
                // Store visitor details per employee
                if (!visitorsByEmployee[providerId]) {
                  visitorsByEmployee[providerId] = [];
                }
                visitorsByEmployee[providerId].push(v);
              }
            });
          });
          
          console.log('Visitor counts:', counts);
          console.log('Visitors by employee:', visitorsByEmployee);
          
          setVisitorCounts(counts);
          setEmployeeVisitors(visitorsByEmployee);
        }
      } catch (error) {
        console.error('Failed to fetch visitor counts:', error);
      }
    };

    fetchVisitorCounts();
  }, [departmentId]);

  // Filter employees based on search
  const filteredEmployees = employees.filter(emp => 
    emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get initials
  const getEmpInitials = (emp: Employee): string => getInitials(emp.full_name || '');

  // Handle card click
  const handleCardClick = (emp: Employee) => {
    setSelectedEmployee(emp);
    setShowModal(true);
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string): { bg: string; color: string } => {
    switch (status) {
      case 'Online':
        return { bg: 'rgba(76,175,80,0.12)', color: SUCCESS };
      case 'In a Service':
        return { bg: 'rgba(5,109,170,0.1)', color: PRIMARY };
      default:
        return { bg: 'rgba(158,158,158,0.15)', color: GRAY_DISABLED };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-[#9E9E9E]">Loading employees...</div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* Search & Filter Bar */}
      <div className="bg-white mx-6 mt-4 p-4 flex items-center justify-between" style={{ boxShadow: CARD_SHADOW }}>
        {/* Search Input */}
        <div className="relative flex-1" style={{ maxWidth: '380px' }}>
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employee by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 focus:outline-none"
            style={{ color: NEUTRAL_DARK, fontFamily: fontHeading, fontSize: '14px', background: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}
            onFocus={(e) => {
              e.currentTarget.style.border = `1px solid ${PRIMARY}`;
              e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = '1px solid transparent';
              e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)';
            }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Status Dropdown */}
          <select className="px-4 py-2 focus:outline-none" style={{ background: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', color: NEUTRAL_DARK, fontFamily: fontHeading, fontSize: '14px' }}>
            <option>All Statuses</option>
            <option>Online</option>
            <option>Away</option>
            <option>In a Service</option>
            <option>On Site Visit</option>
            <option>Offline</option>
          </select>

          {/* More Filters Button */}
          <button className="flex items-center gap-2 px-4 py-2 bg-transparent uppercase font-semibold transition-colors hover:bg-[rgba(5,109,170,0.08)]" style={{ border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', letterSpacing: '1px' }}>
            <FiFilter className="w-4 h-4" />
            More Filters
          </button>

          {/* Add Staff Button */}
          <button
            className="flex items-center gap-1 px-4 py-2 text-white uppercase font-semibold transition-colors"
            style={{ background: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontSize: '13px', letterSpacing: '1px' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = PRIMARY_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = PRIMARY; }}
          >
            + Add Staff
          </button>
        </div>
      </div>

      {/* Employee Cards Grid - 4 columns */}
      <div className="grid grid-cols-4 gap-4 px-6 mt-4">
        {filteredEmployees.length === 0 ? (
          <div className="col-span-4 text-center py-8 text-gray-500">
            No employees found in this department
          </div>
        ) : (
          filteredEmployees.map((emp: Employee, index: number) => {
            // Get the visitor count for this employee
            const empId = emp._id || emp.employee_id || '';
            const count = visitorCounts[empId] || 0;
            
            // Get employee status based on their current workload
            const empStatus = getEmployeeStatus(emp, count);
            
            return (
              <div
                key={emp._id || index}
                className="bg-white p-4 cursor-pointer transition-shadow"
                style={{ boxShadow: CARD_SHADOW }}
                onClick={() => handleCardClick(emp)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-full bg-[#056daa] flex items-center justify-center text-white font-medium text-sm">{getEmpInitials(emp)}</div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: empStatus.statusColor }}></div>
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{emp.full_name || 'Unknown'}</p>
                      <p className="text-xs" style={{ color: GRAY_DISABLED }}>{emp.title || emp.department_name || 'Employee'}</p>
                    </div>
                  </div>
                  <button className="text-gray-500 hover:text-gray-700 font-bold text-lg" onClick={(e) => e.stopPropagation()}>⋮</button>
                </div>
                <div className="mt-3">
                  <span className="inline-flex px-3 py-1 text-xs font-bold" style={{ background: empStatus.statusBg, color: empStatus.statusColor, border: `1px solid ${empStatus.statusColor}` }}>{empStatus.status}</span>
                  <p className="text-xs mt-1" style={{ color: GRAY_DISABLED }}>• Active</p>
                </div>
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <p className="uppercase" style={{ color: TERTIARY, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px' }}>WORKLOAD</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm" style={{ color: NEUTRAL_DARK }}>Assigned Visitors</span>
                    <span className="text-sm font-bold" style={{ color: PRIMARY }}>{count}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-6 py-4 mt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
        <p className="text-sm" style={{ color: GRAY_DISABLED }}>
          Showing <span className="font-bold text-[#333333]">1</span> to <span className="font-bold text-[#333333]">{filteredEmployees.length}</span> of <span className="font-bold text-[#333333]">{filteredEmployees.length}</span> employees
        </p>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 text-sm" style={{ color: GRAY_DISABLED, border: `1px solid ${BORDER}`, borderRadius: 0, fontFamily: fontHeading }} disabled>
            Previous
          </button>
          <button className="px-4 py-2 text-sm" style={{ color: PRIMARY, border: `1px solid ${PRIMARY}`, background: 'transparent', borderRadius: 0, fontFamily: fontHeading }}>
            Next
          </button>
        </div>
      </div>

      {/* Employee Details Modal */}
      {showModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl max-h-[80vh] overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#056daa] flex items-center justify-center text-white font-bold text-lg">
                  {getEmpInitials(selectedEmployee)}
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{selectedEmployee.full_name || 'Employee'}</h2>
                  <p className="text-sm" style={{ color: '#555555' }}>{selectedEmployee.title || selectedEmployee.department_name || 'Employee'}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 140px)' }}>
              <h3 className="uppercase mb-3" style={{ color: TERTIARY, fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px' }}>Assigned Visitors</h3>
              
              {(() => {
                const empId = selectedEmployee._id || selectedEmployee.employee_id || '';
                const visitors = employeeVisitors[empId] || [];
                
                if (visitors.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      No visitors assigned to this employee
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-3">
                    {visitors.map((visitor, idx) => {
                      const statusObj = visitor.services_status;
                      const status = statusObj?.s_type || 'Not started';
                      const statusColors: Record<string, { bg: string; color: string }> = {
                        'Not started': { bg: 'rgba(243,156,18,0.12)', color: WARNING },
                        'Inprogress': { bg: 'rgba(5,109,170,0.1)', color: PRIMARY },
                        'Completed': { bg: 'rgba(51,51,51,0.08)', color: NEUTRAL_DARK },
                        'Transfered': { bg: 'rgba(41,128,185,0.12)', color: ACCENT_DARK_BLUE }
                      };
                      const colors = statusColors[status] || { bg: 'rgba(158,158,158,0.15)', color: GRAY_DISABLED };
                      
                      return (
                        <div key={visitor._id || idx} className="flex items-center justify-between p-4 bg-[#F7F9FB]">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[rgba(5,109,170,0.1)] flex items-center justify-center text-[#056daa] font-bold text-sm">
                              {getInitials(visitor.full_name || '??')}
                            </div>
                            <div>
                              <p className="text-sm font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{visitor.full_name || 'Unknown'}</p>
                              <p className="text-xs" style={{ color: GRAY_DISABLED }}>ID: {visitor.identification?.number || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs" style={{ color: GRAY_DISABLED }}>Arrival</p>
                              <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>
                                {visitor.entry_date 
                                  ? new Date(visitor.entry_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                  : 'N/A'
                                }
                              </p>
                            </div>
                            <span
                              className="px-3 py-1 text-xs font-bold"
                              style={{ background: colors.bg, color: colors.color }}
                            >
                              {status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeStatusOverviewTab;
