// Employee Status Overview Tab Component

import { useState, useEffect } from "react";
import { FiSearch, FiFilter, FiX, FiUser, FiClock } from "react-icons/fi";
import { employeeService, serviceDeliveryService, type Employee } from "../../../../../core/services/adminService";

interface EmployeeStatusOverviewTabProps {
  departmentId?: string;
}

// Function to determine employee status based on their current workload
const getEmployeeStatus = (emp: Employee, visitorsCount: number): { status: string; statusBg: string; statusColor: string } => {
  // If no visitors assigned, they're available
  if (!visitorsCount || visitorsCount === 0) {
    return { status: 'Online', statusBg: '#e6f4ea', statusColor: '#34a853' };
  }
  // If they have visitors in progress
  if (visitorsCount > 0) {
    return { status: 'In a Service', statusBg: '#e8f0fe', statusColor: '#1a73e8' };
  }
  // Default to online
  return { status: 'Online', statusBg: '#e6f4ea', statusColor: '#34a853' };
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
        return { bg: '#e6f4ea', color: '#34a853' };
      case 'In a Service':
        return { bg: '#e8f0fe', color: '#1a73e8' };
      default:
        return { bg: '#f5f5f5', color: '#888888' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading employees...</div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* Search & Filter Bar */}
      <div className="bg-white mx-6 mt-4 rounded-xl p-4 flex items-center justify-between" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        {/* Search Input */}
        <div className="relative flex-1" style={{ maxWidth: '380px' }}>
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employee by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-transparent border-0 rounded-lg focus:outline-none text-sm"
            style={{ color: '#666' }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Status Dropdown */}
          <select className="px-4 py-2 bg-white border rounded-lg text-sm" style={{ borderColor: '#e0e0e0', color: '#333' }}>
            <option>All Statuses</option>
            <option>Online</option>
            <option>Away</option>
            <option>In a Service</option>
            <option>On Site Visit</option>
            <option>Offline</option>
          </select>

          {/* More Filters Button */}
          <button className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm" style={{ borderColor: '#e0e0e0', color: '#333' }}>
            <FiFilter className="w-4 h-4" />
            More Filters
          </button>

          {/* Add Staff Button */}
          <button className="flex items-center gap-1 px-4 py-2 bg-[#1a73e8] text-white rounded-lg text-sm font-medium">
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
                className="bg-white rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow" 
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}
                onClick={() => handleCardClick(emp)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm">{getEmpInitials(emp)}</div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: empStatus.statusColor }}></div>
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#1a2744' }}>{emp.full_name || 'Unknown'}</p>
                      <p className="text-xs" style={{ color: '#888' }}>{emp.title || emp.department_name || 'Employee'}</p>
                    </div>
                  </div>
                  <button className="text-gray-500 hover:text-gray-700 font-bold text-lg" onClick={(e) => e.stopPropagation()}>⋮</button>
                </div>
                <div className="mt-3">
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold" style={{ background: empStatus.statusBg, color: empStatus.statusColor, border: `1px solid ${empStatus.statusColor}` }}>{empStatus.status}</span>
                  <p className="text-xs mt-1" style={{ color: '#aaa' }}>• Active</p>
                </div>
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid #f0f0f0' }}>
                  <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#666', letterSpacing: '0.5px' }}>WORKLOAD</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm" style={{ color: '#333' }}>Assigned Visitors</span>
                    <span className="text-sm font-bold" style={{ color: '#1a73e8' }}>{count}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-6 py-4 mt-4" style={{ borderTop: '1px solid #e0e0e0' }}>
        <p className="text-sm" style={{ color: '#888' }}>
          Showing <span className="font-bold text-gray-800">1</span> to <span className="font-bold text-gray-800">{filteredEmployees.length}</span> of <span className="font-bold text-gray-800">{filteredEmployees.length}</span> employees
        </p>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 text-sm rounded-lg" style={{ color: '#bbb', border: '1px solid #e0e0e0' }} disabled>
            Previous
          </button>
          <button className="px-4 py-2 text-sm rounded-lg" style={{ color: '#333', border: '1px solid #e0e0e0', background: 'white' }}>
            Next
          </button>
        </div>
      </div>

      {/* Employee Details Modal */}
      {showModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#e0e0e0' }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                  {getEmpInitials(selectedEmployee)}
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: '#1a2744' }}>{selectedEmployee.full_name || 'Employee'}</h2>
                  <p className="text-sm" style={{ color: '#666' }}>{selectedEmployee.title || selectedEmployee.department_name || 'Employee'}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 140px)' }}>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: '#666' }}>Assigned Visitors</h3>
              
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
                        'Not started': { bg: '#fff3e0', color: '#ff9800' },
                        'Inprogress': { bg: '#e8f0fe', color: '#1a73e8' },
                        'Completed': { bg: '#e6f4ea', color: '#34a853' },
                        'Transfered': { bg: '#f3e5f5', color: '#9c27b0' }
                      };
                      const colors = statusColors[status] || { bg: '#f5f5f5', color: '#888' };
                      
                      return (
                        <div key={visitor._id || idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                              {getInitials(visitor.full_name || '??')}
                            </div>
                            <div>
                              <p className="text-sm font-bold" style={{ color: '#1a2744' }}>{visitor.full_name || 'Unknown'}</p>
                              <p className="text-xs" style={{ color: '#888' }}>ID: {visitor.identification?.number || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs" style={{ color: '#888' }}>Arrival</p>
                              <p className="text-sm font-medium" style={{ color: '#333' }}>
                                {visitor.entry_date 
                                  ? new Date(visitor.entry_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                  : 'N/A'
                                }
                              </p>
                            </div>
                            <span 
                              className="px-3 py-1 rounded-full text-xs font-bold"
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
