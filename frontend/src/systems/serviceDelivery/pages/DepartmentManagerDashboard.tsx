// Department Manager Dashboard - MainLayout Compatible + Backend APIs
// Exact Figma Design Implementation

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  FiSearch, FiFilter, FiArrowRight, FiUser, FiCheckCircle, FiX, 
  FiClock, FiRefreshCw, FiPlus, FiEye, FiEdit, FiTrash2, FiArrowRightCircle, FiPlay
} from "react-icons/fi";

// Import API Services
import { serviceDeliveryService, employeeService, departmentService } from "../../../core/services/adminService";
import { useAuth } from "../../../core/contexts/AuthContext";

// Tab Components (Assuming you have these built)
import DepartmentAvailabilityTab from "../components/departmentFlow/tabs/DepartmentAvailabilityTab";
import ReportsTab from "../components/departmentFlow/tabs/ReportsTab";
import ServiceDetailsModal from "../components/departmentFlow/ServiceDetailsModal";
import { ViewEmployeeModal, EditEmployeeModal, DeleteEmployeeModal, AddEmployeeModal } from "../components/departmentFlow/EmployeeModals";
import ServeVisitorModal from "../components/employeeFlow/ServeVisitorModal";

// Types matching Backend Structure
interface ServiceStatus {
  department_name?: string;
  department_id?: string;
  provider_name?: string;
  provider_id?: string;
  s_type?: string; // 'Not started', 'Inprogress', 'Transfered', 'Completed'
}

interface DepartmentAssigned {
  department_id?: string;
  department_name?: string;
  assigned_time?: string | Date;
  reached_in?: boolean;
  provider_name?: string;
  provider_id?: string;
}

interface Visitor {
  _id?: string;
  id?: string;
  name?: string;
  full_name?: string;
  identification?: string | { number?: string };
  telephone?: string;
  email?: string;
  service?: string;
  department?: string;
  status?: string;
  checkInTime?: string;
  check_in_time?: string;
  entry_date?: string | Date;
  assignedTo?: any;
  is_still_inhouse?: boolean;
  services_status?: ServiceStatus[];
  departments_assigned?: DepartmentAssigned[];
}

interface Employee {
  _id?: string;
  employee_id?: string;
  full_name?: string;
  email?: string;
  telephone?: string;
  role?: string;
  title?: string;
  gender?: string;
  status?: string;
}

// Wrapper component for Add Employee Modal with backend API integration
interface AddEmployeeModalContentProps {
  isOpen: boolean;
  onClose: () => void;
  departmentId?: string;
  departmentName?: string;
  onSuccess: () => void;
}

const AddEmployeeModalContent: React.FC<AddEmployeeModalContentProps> = ({ isOpen, onClose, departmentId, departmentName, onSuccess }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    telephone: '',
    title: '',
    gender: '',
    department_id: departmentId || '',
    department_name: departmentName || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!formData.full_name || !formData.email || !formData.telephone) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await employeeService.create({
        full_name: formData.full_name,
        email: formData.email,
        telephone: formData.telephone,
        title: formData.title,
        gender: formData.gender,
        department_id: formData.department_id,
        department_name: formData.department_name,
        roles: { role_name: 'department_employee', permissions: [] }
      });

      if (response.success) {
        onSuccess();
      } else {
        setError(response.message || 'Failed to create employee');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30" />
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-[600px]" onClick={e => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">Add New Employee</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telephone *</label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={e => setFormData({...formData, telephone: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Senior Officer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={e => setFormData({...formData, gender: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Employee'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrapper component for Edit Employee Modal with backend API integration
interface EditEmployeeModalContentProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSuccess: () => void;
}

const EditEmployeeModalContent: React.FC<EditEmployeeModalContentProps> = ({ isOpen, onClose, employee, onSuccess }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    telephone: '',
    title: '',
    gender: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (employee) {
      setFormData({
        full_name: employee.full_name || '',
        email: employee.email || '',
        telephone: employee.telephone || '',
        title: employee.title || '',
        gender: employee.gender || ''
      });
    }
  }, [employee]);

  const handleSubmit = async () => {
    if (!formData.full_name || !formData.email) {
      setError('Please fill in required fields');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const empId = employee?._id || employee?.employee_id;
      if (!empId) {
        setError('Employee ID not found');
        return;
      }

      const response = await employeeService.update(empId, {
        full_name: formData.full_name,
        email: formData.email,
        telephone: formData.telephone,
        title: formData.title,
        gender: formData.gender
      });

      if (response.success) {
        onSuccess();
      } else {
        setError(response.message || 'Failed to update employee');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30" />
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-[600px]" onClick={e => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">Edit Employee</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={e => setFormData({...formData, telephone: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={e => setFormData({...formData, gender: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DepartmentManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  
  // Get department ID from user context
  const departmentId = user?.departmentId || user?.department_id;
  const departmentName = user?.departmentName || user?.department_name;
  
  // Tab State (Driven by URL)
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'dashboard');

  // LIVE DATA STATES
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination & Filters
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [serviceStatusSearch, setServiceStatusSearch] = useState("");
  const [serviceStatusFilter, setServiceStatusFilter] = useState("all");
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Modal States
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  // Employee Modals
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showViewEmployeeModal, setShowViewEmployeeModal] = useState(false);
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  const [showDeleteEmployeeModal, setShowDeleteEmployeeModal] = useState(false);
  const [selectedDeptEmployee, setSelectedDeptEmployee] = useState<Employee | null>(null);

  // Serve Visitor Modal State
  const [showServeModal, setShowServeModal] = useState(false);
  const [servingVisitor, setServingVisitor] = useState<Visitor | null>(null);
  const [servingEmployee, setServingEmployee] = useState<Employee | null>(null);
  const [employeeServiceCount, setEmployeeServiceCount] = useState<Record<string, number>>({});

  // Visitors by Department/Provider State
  const [visitorsByDepartment, setVisitorsByDepartment] = useState<any[]>([]);
  const [visitorsByProvider, setVisitorsByProvider] = useState<any[]>([]);
  const [loadingByFilters, setLoadingByFilters] = useState(false);

  // Sync tabs with URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
    else setActiveTab('dashboard');
  }, [searchParams]);

  // Auth Check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  // FETCH LIVE DATA
  const loadData = async () => {
    setIsLoading(true);
    try {
      let visitorRes;
      let empRes;
      let deptRes;

      // If user has a department, fetch department-specific data
      if (departmentId) {
        // Use getCurrentVisitorsByDepartment to get all visitors assigned to this department
        visitorRes = await serviceDeliveryService.getCurrentVisitorsByDepartment(departmentId);
        empRes = await employeeService.getByDepartment(departmentId, false);
      } else {
        // Fallback to all data if no department assigned
        visitorRes = await serviceDeliveryService.getAll();
        empRes = await employeeService.getAll();
      }

      // Fetch all departments for transfer functionality
      try {
        deptRes = await departmentService.getAll();
        if (deptRes.status || deptRes.success) {
          setDepartments(deptRes.data || []);
        }
      } catch (deptError) {
        console.error('Failed to load departments:', deptError);
      }

      if (visitorRes.status || visitorRes.success) {
        // Handle both response formats - flat array or nested with department grouping
        const rawData = visitorRes.data;
        let visitorsArray: any[] = [];
        
        if (Array.isArray(rawData)) {
          // Check if it's grouped by department (has visitors array inside)
          if (rawData.length > 0 && rawData[0].visitors) {
            // Extract visitors from all departments
            rawData.forEach((dept: any) => {
              if (dept.visitors && Array.isArray(dept.visitors)) {
                visitorsArray = [...visitorsArray, ...dept.visitors];
              }
            });
          } else {
            // It's a flat array
            visitorsArray = rawData;
          }
        }
        
        setVisitors(visitorsArray);
      }
      if (empRes.status || empRes.success) {
        setEmployees(Array.isArray(empRes.data) ? empRes.data : []);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch visitors by department
  const fetchVisitorsByDepartment = async () => {
    if (!departmentId) return;
    setLoadingByFilters(true);
    try {
      const response = await serviceDeliveryService.getCurrentVisitorsByDepartment(departmentId);
      if (response.success && response.data) {
        setVisitorsByDepartment(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch visitors by department:', error);
    } finally {
      setLoadingByFilters(false);
    }
  };

  // Fetch visitors by provider (employee)
  const fetchVisitorsByProvider = async () => {
    setLoadingByFilters(true);
    try {
      const response = await serviceDeliveryService.getAll();
      if (response.success && response.data) {
        // Group visitors by provider_id within this department
        const allVisitors = response.data as any[];
        const providerMap: Record<string, any> = {};
        
        allVisitors.forEach(v => {
          // Handle both array and unwound object
          if (v.services_status) {
            const statuses = Array.isArray(v.services_status) 
              ? v.services_status 
              : [v.services_status];
            
            statuses.forEach((s: any) => {
              if (s.department_id === departmentId && s.provider_id) {
                if (!providerMap[s.provider_id]) {
                  providerMap[s.provider_id] = {
                    provider_id: s.provider_id,
                    provider_name: s.provider_name || 'Unknown',
                    visitors: [],
                    count: 0
                  };
                }
                if (s.s_type !== 'Completed') {
                  providerMap[s.provider_id].visitors.push(v);
                  providerMap[s.provider_id].count++;
                }
              }
            });
          }
        });
        
        setVisitorsByProvider(Object.values(providerMap));
      }
    } catch (error) {
      console.error('Failed to fetch visitors by provider:', error);
    } finally {
      setLoadingByFilters(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helpers
  const getVisitorName = (v: Visitor) => v.full_name || v.name || 'Unknown';
  const getIdentification = (v: Visitor) => {
    if (!v.identification) return 'N/A';
    if (typeof v.identification === 'string') return v.identification;
    return v.identification.number || 'N/A';
  };
  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  // Get visitor status from backend services_status array (handles both array and unwound object)
  const getVisitorStatus = (v: Visitor): string => {
    if (!v.services_status || !departmentId) return 'Not started';
    
    // Check if services_status is an array or a single object (from unwind)
    const statusObj = Array.isArray(v.services_status) 
      ? v.services_status.find((s: any) => s.department_id === departmentId)
      : v.services_status;
    
    if (statusObj && statusObj.s_type) {
      return statusObj.s_type;
    }
    return 'Not started';
  };

  // Check if visitor is assigned to an employee in this department (handles both array and unwound object)
  const isAssignedToEmployee = (v: Visitor): boolean => {
    if (!v.services_status || !departmentId) return false;
    
    const statusObj = Array.isArray(v.services_status) 
      ? v.services_status.find((s: any) => s.department_id === departmentId)
      : v.services_status;
    
    return !!(statusObj && statusObj.provider_name);
  };

  // Get assigned employee for this department (handles both array and unwound object)
  const getAssignedEmployee = (v: Visitor): { name: string; id: string } | null => {
    if (!v.services_status || !departmentId) return null;
    
    const statusObj = Array.isArray(v.services_status) 
      ? v.services_status.find((s: any) => s.department_id === departmentId)
      : v.services_status;
    
    if (statusObj && statusObj.provider_name) {
      return { name: statusObj.provider_name, id: statusObj.provider_id || '' };
    }
    return null;
  };

  // Calculate employee service counts from visitors (handles both array and unwound object)
  const calculateEmployeeServiceCounts = () => {
    const counts: Record<string, number> = {};
    visitors.forEach(v => {
      if (v.services_status && departmentId) {
        const statusObj = Array.isArray(v.services_status) 
          ? v.services_status.find((s: any) => s.department_id === departmentId)
          : v.services_status;
        
        if (statusObj && statusObj.provider_id && statusObj.s_type === 'Completed') {
          counts[statusObj.provider_id] = (counts[statusObj.provider_id] || 0) + 1;
        }
      }
    });
    setEmployeeServiceCount(counts);
  };

  // Calculate service counts when visitors change
  useEffect(() => {
    calculateEmployeeServiceCounts();
  }, [visitors, departmentId]);

  // Handle starting a service
  const handleServiceStart = async (startTime: string) => {
    if (!servingVisitor || !servingEmployee || !departmentId) return;
    
    try {
      const visitorId = servingVisitor._id || servingVisitor.id;
      const empId = servingEmployee._id || servingEmployee.employee_id;
      const empName = servingEmployee.full_name;
      
      // Use update API like ProvideServicesTab - update services_status directly
      await serviceDeliveryService.update(visitorId as string, {
        services_status: [{
          department_id: departmentId,
          department_name: departmentName,
          provider_id: empId,
          provider_name: empName,
          s_type: 'Inprogress'
        }]
      });
      
      await loadData();
    } catch (error) {
      console.error('Failed to start service:', error);
    }
  };

  // Handle ending a service
  const handleServiceEnd = async (data: { duration: string; startTime: string; endTime: string; notes: string }) => {
    if (!servingVisitor || !servingEmployee || !departmentId) return;
    
    try {
      const visitorId = servingVisitor._id || servingVisitor.id;
      const empId = servingEmployee._id || servingEmployee.employee_id;
      const empName = servingEmployee.full_name;
      
      // Check if this is a transfer (like ProvideServicesTab)
      const isTransfer = data.notes && data.notes.toLowerCase().includes('transfer');
      const targetStatus = isTransfer ? 'Transfered' : 'Completed';
      
      // Use update API like ProvideServicesTab - update services_status directly
      await serviceDeliveryService.update(visitorId as string, {
        services_status: [{
          department_id: departmentId,
          department_name: departmentName,
          provider_id: empId,
          provider_name: empName,
          s_type: targetStatus
        }]
      });
      
      // Update the local service count for this employee
      if (!isTransfer && empId) {
        setEmployeeServiceCount(prev => ({
          ...prev,
          [empId]: (prev[empId] || 0) + 1
        }));
      }
      
      setShowServeModal(false);
      setServingVisitor(null);
      setServingEmployee(null);
      await loadData();
    } catch (error) {
      console.error('Failed to complete service:', error);
    }
  };

  // Stats - using backend services_status data
  const pendingVisitors = visitors.filter(v => getVisitorStatus(v) === 'Not started');
  const inProgressVisitors = visitors.filter(v => getVisitorStatus(v) === 'Inprogress');
  const completedVisitors = visitors.filter(v => getVisitorStatus(v) === 'Completed');
  const transferredVisitors = visitors.filter(v => getVisitorStatus(v) === 'Transfered');

  // Dashboard filter state
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState('all');

  // Dashboard Filters - show all visitors with optional status filter
  const filteredDashboardVisitors = visitors.filter(v => {
    // First filter by search term
    const matchesSearch = getVisitorName(v).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getIdentification(v).includes(searchTerm);
    
    // Then filter by status if not 'all'
    const matchesStatus = dashboardStatusFilter === 'all' 
      ? true 
      : getVisitorStatus(v).toLowerCase() === dashboardStatusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const itemsPerPage = 8;
  const paginatedDashboard = filteredDashboardVisitors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalDashboardPages = Math.ceil(filteredDashboardVisitors.length / itemsPerPage);

  // Service Status Filters - using backend services_status data
  const filteredServiceVisitors = visitors.filter(v => {
    const matchesSearch = getVisitorName(v).toLowerCase().includes(serviceStatusSearch.toLowerCase()) || 
                          (v.telephone || '').includes(serviceStatusSearch);
    const matchesStatus = serviceStatusFilter === 'all' ? true : getVisitorStatus(v).toLowerCase() === serviceStatusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Employee Filters
  const filteredEmployees = employees.filter(e => 
    (e.full_name || '').toLowerCase().includes(employeeSearch.toLowerCase()) ||
    (e.email || '').toLowerCase().includes(employeeSearch.toLowerCase())
  );

  // Assignment Handler
  const handleConfirmAssignment = async () => {
    if (selectedVisitor && selectedEmployee) {
      setIsAssigning(true);
      try {
        const visitorId = selectedVisitor._id || selectedVisitor.id;
        const empId = selectedEmployee._id || selectedEmployee.employee_id;
        
        // Use your service delivery update endpoint
        await serviceDeliveryService.update(visitorId as string, {
          assignedTo: empId,
          status: 'In_progress'
        });
        
        setShowSuccessMessage(true);
        await loadData(); // Refresh table
        
        setTimeout(() => {
          setShowAssignModal(false);
          setShowSuccessMessage(false);
          setSelectedVisitor(null);
          setSelectedEmployee(null);
        }, 1500);
      } catch (error) {
        console.error("Assignment failed:", error);
        alert("Failed to assign employee.");
      } finally {
        setIsAssigning(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* NOTE: Horizontal Tabs & Sidebar have been removed.
        Navigation is completely handled by layoutUtils.ts and ?tab= URL parameters
      */}

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* STATISTICS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-800">{pendingVisitors.length}</p>
                  <p className="text-sm text-green-600 mt-1">Pending Requests</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FiClock className="w-6 h-6 text-orange-500" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-800">{inProgressVisitors.length}</p>
                  <p className="text-sm text-gray-500 mt-1">Active tasks</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FiRefreshCw className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-800">{transferredVisitors.length}</p>
                  <p className="text-sm text-gray-500 mt-1">Transferred</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FiArrowRightCircle className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-800">{completedVisitors.length}</p>
                  <p className="text-sm text-gray-500 mt-1">Completed</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <FiCheckCircle className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </div>
          </div>

          {/* PENDING REQUESTS TABLE */}
          <div className="bg-white rounded-[14px] shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white">
              <h2 className="text-[16px] font-bold text-blue-600 uppercase">Current Pending Requests</h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search requests..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={dashboardStatusFilter}
                  onChange={e => setDashboardStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="Not started">Pending</option>
                  <option value="Inprogress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Transfered">Transferred</option>
                </select>
                <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-[#0284C7] rounded-lg text-white text-sm font-medium hover:bg-[#0369A1]">
                  <FiRefreshCw className="w-4 h-4" /> Refresh
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">VISITOR NAME</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">ID NUMBER</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">ASSIGNED TO</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">STATUS</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">ARRIVAL TIME</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">Loading live data...</td></tr>
                  ) : paginatedDashboard.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">No pending requests found.</td></tr>
                  ) : (
                    paginatedDashboard.map((visitor) => (
                      <tr key={visitor._id || visitor.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs mr-3">
                              {getInitials(getVisitorName(visitor))}
                            </div>
                            <p className="text-sm font-semibold text-gray-800">{getVisitorName(visitor)}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4"><p className="text-sm text-gray-600">{getIdentification(visitor)}</p></td>
                        <td className="px-6 py-4">
                          {(() => {
                            const assigned = getAssignedEmployee(visitor);
                            if (assigned) {
                              return (
                                <div className="flex items-center">
                                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xs mr-2">
                                    {getInitials(assigned.name)}
                                  </div>
                                  <span className="text-sm font-medium text-gray-700">{assigned.name}</span>
                                </div>
                              );
                            }
                            return <span className="text-sm text-gray-400 italic">Not assigned</span>;
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const status = getVisitorStatus(visitor);
                            const statusColors = {
                              'Not started': 'bg-orange-100 text-orange-700',
                              'Inprogress': 'bg-blue-100 text-blue-700',
                              'Completed': 'bg-green-100 text-green-700',
                              'Transfered': 'bg-purple-100 text-purple-700'
                            };
                            const colorClass = statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-700';
                            return <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${colorClass}`}>{status}</span>;
                          })()}
                        </td>
                        <td className="px-6 py-4"><p className="text-sm text-gray-600">
                          {visitor.entry_date 
                            ? new Date(visitor.entry_date).toLocaleString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })
                            : 'Just now'
                          }
                        </p></td>
                        <td className="px-6 py-4">
                          {(() => {
                            const assigned = getAssignedEmployee(visitor);
                            if (assigned) {
                              // Visitor is already assigned - show Assigned status
                              return (
                                <div className="flex items-center gap-2">
                                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                    Assigned
                                  </span>
                                  <button 
                                    onClick={() => {
                                      const emp = employees.find(e => e.full_name === assigned.name);
                                      setServingVisitor(visitor);
                                      setServingEmployee(emp || null);
                                      setShowServeModal(true);
                                    }}
                                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                                  >
                                    View
                                  </button>
                                </div>
                              );
                            }
                            // Not assigned - show Serve button with blue background
                            return (
                              <button 
                                onClick={() => {
                                  setServingVisitor(visitor);
                                  setServingEmployee(employees[0] || null);
                                  setShowServeModal(true);
                                }}
                                className="flex items-center px-4 py-2 bg-[#0284C7] text-white text-sm font-bold rounded-lg hover:bg-[#0369A1] transition-colors"
                              >
                                Serve <FiPlay className="w-4 h-4 ml-1" />
                              </button>
                            );
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SERVICE STATUS TRACKING TAB */}
      {activeTab === 'status' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-white">
            <h2 className="text-[16px] font-bold text-blue-600 uppercase mb-4">Service Status Tracking</h2>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Search visitors..."
                value={serviceStatusSearch}
                onChange={(e) => setServiceStatusSearch(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <select
                value={serviceStatusFilter}
                onChange={(e) => setServiceStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="not started">Pending</option>
                <option value="inprogress">In Progress</option>
                <option value="transfered">Transferred</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">VISITOR NAME</th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">SERVICE</th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">STATUS</th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">PHONE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredServiceVisitors.map(visitor => (
                  <tr key={visitor._id || visitor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold text-gray-800">{getVisitorName(visitor)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{visitor.service || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getVisitorStatus(visitor) === 'Inprogress' ? 'bg-blue-100 text-blue-700' : getVisitorStatus(visitor) === 'Not started' ? 'bg-orange-100 text-orange-600' : getVisitorStatus(visitor) === 'Transfered' ? 'bg-purple-100 text-purple-600' : getVisitorStatus(visitor) === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {getVisitorStatus(visitor) === 'Inprogress' ? 'In Progress' : getVisitorStatus(visitor) === 'Not started' ? 'Not Started' : getVisitorStatus(visitor) === 'Transfered' ? 'Transferred' : getVisitorStatus(visitor) === 'Completed' ? 'Completed' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{visitor.telephone || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EMPLOYEE MANAGEMENT TAB */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
            <h2 className="text-[16px] font-bold text-blue-600 uppercase">Employee Management</h2>
            <button 
              onClick={() => setShowAddEmployeeModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#0284C7] text-white text-sm font-medium rounded-lg hover:bg-[#0369A1]"
            >
              <FiPlus /> Add Employee
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">EMPLOYEE NAME</th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">EMAIL</th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">ROLE/TITLE</th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">SERVICES SERVED</th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">STATUS</th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-8">Loading employees...</td></tr>
                ) : filteredEmployees.map(emp => (
                  <tr key={emp._id || emp.employee_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold text-gray-800 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                        {getInitials(emp.full_name || '')}
                      </div>
                      {emp.full_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{emp.email || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{emp.title || emp.role || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                        {employeeServiceCount[emp._id || emp.employee_id || ''] || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase">
                        {emp.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setSelectedDeptEmployee(emp);
                            setShowViewEmployeeModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" 
                          title="View"
                        >
                          <FiEye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedDeptEmployee(emp);
                            setShowEditEmployeeModal(true);
                          }}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg" 
                          title="Edit"
                        >
                          <FiEdit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedDeptEmployee(emp);
                            setShowDeleteEmployeeModal(true);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg" 
                          title="Delete"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISITORS BY DEPARTMENT TAB */}
      {activeTab === 'by-department' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[16px] font-bold text-blue-600 uppercase">Visitors by Department</h2>
              <button 
                onClick={() => { fetchVisitorsByDepartment(); }}
                className="flex items-center gap-2 px-4 py-2 bg-[#0284C7] text-white text-sm font-medium rounded-lg hover:bg-[#0369A1]"
              >
                <FiRefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
            
            {loadingByFilters ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : visitorsByDepartment.length > 0 ? (
              <div className="space-y-4">
                {visitorsByDepartment.map((dept: any) => (
                  <div key={dept._id || dept.department_name} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-gray-800">{dept.department_name || dept._id}</h3>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-bold rounded-full">
                        {dept.count || dept.visitors?.length || 0}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {(dept.visitors || []).slice(0, 3).map((v: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                              {getInitials(v.full_name || v.name || 'U')}
                            </div>
                            <span className="text-sm text-gray-700">{v.full_name || v.name || 'Unknown'}</span>
                          </div>
                          {(() => {
                            const statusObj = Array.isArray(v.services_status) 
                              ? v.services_status.find((s: any) => s.department_id === departmentId)
                              : v.services_status;
                            const sType = statusObj?.s_type || 'Not started';
                            return (
                              <span className={`px-2 py-1 rounded text-xs font-bold ${sType === 'Inprogress' ? 'bg-blue-100 text-blue-700' : sType === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                {sType}
                              </span>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No visitors found by department</div>
            )}
          </div>
        </div>
      )}

      {/* VISITORS BY PROVIDER TAB */}
      {activeTab === 'by-provider' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[16px] font-bold text-blue-600 uppercase">Visitors by Employee (Provider)</h2>
              <button 
                onClick={() => { fetchVisitorsByProvider(); }}
                className="flex items-center gap-2 px-4 py-2 bg-[#0284C7] text-white text-sm font-medium rounded-lg hover:bg-[#0369A1]"
              >
                <FiRefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
            
            {loadingByFilters ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : visitorsByProvider.length > 0 ? (
              <div className="space-y-4">
                {visitorsByProvider.map((provider: any) => (
                  <div key={provider.provider_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                          {getInitials(provider.provider_name || 'U')}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-800">{provider.provider_name || 'Unknown'}</h3>
                          <p className="text-xs text-gray-500">{provider.visitors?.length || 0} active visitors</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full">
                        {provider.count || provider.visitors?.length || 0}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {(provider.visitors || []).slice(0, 5).map((v: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700">{v.full_name || v.name || 'Unknown'}</span>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${(v.services_status || []).find((s: any) => s.provider_id === provider.provider_id)?.s_type === 'Inprogress' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                            {(v.services_status || []).find((s: any) => s.provider_id === provider.provider_id)?.s_type || 'Not started'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No visitors found by provider</div>
            )}
          </div>
        </div>
      )}

      {/* DEPARTMENT AVAILABILITY & REPORTS */}
      {activeTab === 'availability' && <DepartmentAvailabilityTab departmentId={departmentId} />}
      {activeTab === 'reports' && <ReportsTab departmentId={departmentId} departmentName={departmentName} />}

      {/* ASSIGN MODAL */}
      {showAssignModal && selectedVisitor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FiUser className="text-blue-600" /> Assign Visitor
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600"><FiX className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-1">Assigning Visitor:</p>
                <p className="text-sm font-bold text-gray-800">{getVisitorName(selectedVisitor)}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Select Employee</label>
                <select
                  value={selectedEmployee?._id || ''}
                  onChange={(e) => {
                    const emp = employees.find(em => em._id === e.target.value);
                    setSelectedEmployee(emp || null);
                  }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Select an employee...</option>
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id}>{emp.full_name} - {emp.title || emp.role}</option>
                  ))}
                </select>
              </div>

              {showSuccessMessage && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2 text-sm font-medium">
                  <FiCheckCircle className="w-4 h-4" /> Assignment Successful!
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button onClick={() => setShowAssignModal(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg">Cancel</button>
              <button 
                onClick={handleConfirmAssignment}
                disabled={!selectedEmployee || isAssigning}
                className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isAssigning ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMPLOYEE MODALS */}
      
      {/* Add Employee Modal */}
      {showAddEmployeeModal && (
        <AddEmployeeModalContent
          isOpen={showAddEmployeeModal}
          onClose={() => setShowAddEmployeeModal(false)}
          departmentId={departmentId}
          departmentName={departmentName}
          onSuccess={() => {
            setShowAddEmployeeModal(false);
            loadData();
          }}
        />
      )}

      {/* View Employee Modal */}
      {showViewEmployeeModal && selectedDeptEmployee && (
        <ViewEmployeeModal
          isOpen={showViewEmployeeModal}
          onClose={() => {
            setShowViewEmployeeModal(false);
            setSelectedDeptEmployee(null);
          }}
          employee={{
            id: selectedDeptEmployee._id || '',
            empId: selectedDeptEmployee.employee_id || selectedDeptEmployee._id || '',
            name: selectedDeptEmployee.full_name || '',
            email: selectedDeptEmployee.email || '',
            title: selectedDeptEmployee.title || selectedDeptEmployee.role || '',
            status: selectedDeptEmployee.status === 'Active' ? 'Active' : 'Away',
            initials: getInitials(selectedDeptEmployee.full_name || '')
          }}
        />
      )}

      {/* Edit Employee Modal */}
      {showEditEmployeeModal && selectedDeptEmployee && (
        <EditEmployeeModalContent
          isOpen={showEditEmployeeModal}
          onClose={() => {
            setShowEditEmployeeModal(false);
            setSelectedDeptEmployee(null);
          }}
          employee={selectedDeptEmployee}
          onSuccess={() => {
            setShowEditEmployeeModal(false);
            setSelectedDeptEmployee(null);
            loadData();
          }}
        />
      )}

      {/* Delete Employee Modal */}
      {showDeleteEmployeeModal && selectedDeptEmployee && (
        <DeleteEmployeeModal
          isOpen={showDeleteEmployeeModal}
          onClose={() => {
            setShowDeleteEmployeeModal(false);
            setSelectedDeptEmployee(null);
          }}
          employee={{
            id: selectedDeptEmployee._id || '',
            empId: selectedDeptEmployee.employee_id || selectedDeptEmployee._id || '',
            name: selectedDeptEmployee.full_name || '',
            email: selectedDeptEmployee.email || '',
            title: selectedDeptEmployee.title || selectedDeptEmployee.role || '',
            status: selectedDeptEmployee.status === 'Active' ? 'Active' : 'Away',
            initials: getInitials(selectedDeptEmployee.full_name || '')
          }}
          onDelete={async () => {
            try {
              await employeeService.delete(selectedDeptEmployee._id || selectedDeptEmployee.employee_id || '');
              setShowDeleteEmployeeModal(false);
              setSelectedDeptEmployee(null);
              loadData();
            } catch (error) {
              console.error('Failed to delete employee:', error);
              alert('Failed to delete employee');
            }
          }}
        />
      )}

      {/* Serve Visitor Modal */}
      {showServeModal && servingVisitor && (
        <ServeVisitorModal
          isOpen={showServeModal}
          onClose={() => {
            setShowServeModal(false);
            setServingVisitor(null);
            setServingEmployee(null);
          }}
          visitor={{
            name: getVisitorName(servingVisitor),
            id: servingVisitor._id || servingVisitor.id || '',
            email: servingVisitor.email || '',
            service: servingVisitor.service || 'General Service',
            checkInTime: servingVisitor.entry_date 
              ? new Date(servingVisitor.entry_date).toLocaleString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })
              : 'Just now',
            gate: 'Main Gate'
          }}
          onServiceStart={handleServiceStart}
          onServiceEnd={handleServiceEnd}
        />
      )}
    </div>
  );
};

export default DepartmentManagerDashboard;