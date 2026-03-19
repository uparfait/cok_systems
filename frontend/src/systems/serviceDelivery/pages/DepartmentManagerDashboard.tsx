// Department Manager Dashboard - MainLayout Compatible + Backend APIs
// Exact Figma Design Implementation

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  FiSearch, FiFilter, FiArrowRight, FiUser, FiCheckCircle, FiX, 
  FiClock, FiRefreshCw, FiPlus, FiEye, FiEdit, FiTrash2, FiArrowRightCircle, FiPlay, FiSquare
} from "react-icons/fi";

// Import API Services
import { serviceDeliveryService, employeeService, departmentService } from "../../../core/services/adminService";
import { useAuth } from "../../../core/contexts/AuthContext";

// Custom Live Timer Component
const LiveTimer: React.FC<{ startTime: string }> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    const start = new Date(startTime).getTime();
    
    const updateTime = () => setElapsed(Math.max(0, Math.floor((new Date().getTime() - start) / 1000)));
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');

  return <span className="font-mono tracking-widest">{h}:{m}:{s}</span>;
};

// Tab Components
import DepartmentAvailabilityTab from "../components/departmentFlow/tabs/DepartmentAvailabilityTab";
import ReportsTab from "../components/departmentFlow/tabs/ReportsTab";
import { ViewEmployeeModal, EditEmployeeModal, DeleteEmployeeModal } from "../components/departmentFlow/EmployeeModals";
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
  badge_number?: string;
  service?: string;
  department?: string;
  status?: string;
  checkInTime?: string;
  check_in_time?: string;
  entry_date?: string | Date;
  assignedTo?: any;
  assigned_to?: any;
  provider_name?: string;
  provider_id?: string;
  is_still_inhouse?: boolean;
  services_status?: ServiceStatus[];
  departments_assigned?: DepartmentAssigned[];
  durations?: {
    services_durations?: any[];
    emergency_durations?: any[];
  };
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
  department_id?: string | { _id?: string };
  department_name?: string;
  identification?: {
    id_type?: string;
    number?: string;
  };
  badge_number?: string;
}

// Wrapper component for Add Employee Modal
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

// Wrapper component for Edit Employee Modal
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
  
  // Tab State
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'dashboard');

  // LIVE DATA STATES
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [allDepartmentVisitors, setAllDepartmentVisitors] = useState<Visitor[]>([]);
  const [pendingServiceStartTime, setPendingServiceStartTime] = useState<string>('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination & Filters
  const [currentPage, setCurrentPage] = useState(1);
  const [backendTotal, setBackendTotal] = useState(0); // Total count from backend
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false); // Track if we're doing backend search
  const [serviceStatusSearch, setServiceStatusSearch] = useState("");
  const [serviceStatusFilter, setServiceStatusFilter] = useState("all");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState('all');

  // Handle Employee Search from backend
  const handleEmployeeSearch = async () => {
    setIsLoading(true);
    try {
      let response;
      if (employeeSearch && employeeSearch.trim()) {
        response = await employeeService.search(employeeSearch.trim());
      } else {
        // If search is empty, load all employees
        response = await employeeService.getAll();
      }
      
      if (response.success && response.data) {
        setEmployees(response.data);
      } else {
        console.error('Search failed:', response.message);
      }
    } catch (error: any) {
      console.error('Error searching employees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle visitor search with backend pagination
  const handleVisitorSearch = async () => {
    setIsLoading(true);
    setIsSearching(true);
    setCurrentPage(1);
    try {
      const limit = 20;
      let searchRes;
      
      if (searchTerm && searchTerm.trim()) {
        // Use backend search with pagination
        searchRes = await serviceDeliveryService.search(searchTerm.trim(), 1, limit, true);
      } else {
        // If search is empty, load all visitors
        searchRes = await serviceDeliveryService.getAll(1, limit, true);
      }
      
      if (searchRes && (searchRes.success || searchRes.status)) {
        // Extract total from backend response for proper pagination
        if (searchRes.total !== undefined) {
          setBackendTotal(searchRes.total);
        }
        
        const rawData = searchRes.data;
        let visitorsArray: any[] = [];
        
        if (Array.isArray(rawData)) {
          if (rawData.length > 0 && rawData[0].visitors) {
            rawData.forEach((dept: any) => {
              if (dept.visitors && Array.isArray(dept.visitors)) {
                visitorsArray = [...visitorsArray, ...dept.visitors];
              }
            });
          } else {
            visitorsArray = rawData;
          }
        }
        
        setVisitors(visitorsArray);
        setAllDepartmentVisitors(visitorsArray);
      } else {
        console.error('Search failed:', searchRes?.message);
      }
    } catch (error: any) {
      console.error('Error searching visitors:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
  
  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferVisitor, setTransferVisitor] = useState<Visitor | null>(null);
  const [transferDepartment, setTransferDepartment] = useState<string>('');
  const [transferEmployee, setTransferEmployee] = useState<Employee | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferEmployees, setTransferEmployees] = useState<Employee[]>([]);
  const [transferEmployeesLoading, setTransferEmployeesLoading] = useState(false);

  // Visitors by Department/Provider State
  const [visitorsByDepartment, setVisitorsByDepartment] = useState<any[]>([]);
  const [visitorsByProvider, setVisitorsByProvider] = useState<any[]>([]);
  const [loadingByFilters, setLoadingByFilters] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
    else setActiveTab('dashboard');
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dashboardStatusFilter]);

  // ULTRA ROBUST ASSIGNED EMPLOYEE FINDER
  const getAssignedEmployee = (v: any): { name: string; id: string } | null => {
    if (!v) return null;

    const checkEmpListForId = (id: string) => {
      const emp = employees.find(e => String(e._id) === String(id) || String(e.employee_id) === String(id));
      return emp ? emp.full_name : null;
    };

    // 1. Check Root Provider fields
    if (v.provider_name && v.provider_name !== 'Unknown') {
      return { name: v.provider_name, id: v.provider_id || '' };
    }

    // 2. Check Root 'assignedTo' or 'assigned_to'
    const rootAssigned = v.assignedTo || v.assigned_to;
    if (rootAssigned) {
      if (typeof rootAssigned === 'object') {
        const name = rootAssigned.full_name || rootAssigned.name || rootAssigned.provider_name;
        if (name) return { name, id: rootAssigned._id || rootAssigned.id || '' };
      } else if (typeof rootAssigned === 'string' && rootAssigned !== 'unassigned') {
        const name = checkEmpListForId(rootAssigned);
        if (name) return { name, id: rootAssigned };
      }
    }

    // 3. Check departments_assigned
    if (v.departments_assigned && Array.isArray(v.departments_assigned) && v.departments_assigned.length > 0) {
      const assignments = [...v.departments_assigned].reverse(); 
      for (const assign of assignments) {
        const name = assign.provider_name || assign.employee_name || assign.assigned_name;
        const id = assign.provider_id || assign.employee_id || assign.assigned_to;
        
        if (name && name !== 'Unknown') return { name, id: id || '' };
        if (id) {
          const empName = checkEmpListForId(id);
          if (empName) return { name: empName, id };
        }
      }
    }

    // 4. Check services_status
    if (v.services_status) {
      const statuses = Array.isArray(v.services_status) ? v.services_status : [v.services_status];
      const statusList = [...statuses].reverse();
      for (const s of statusList) {
        const name = s.provider_name || s.employee_name;
        const id = s.provider_id || s.employee_id;
        
        if (name && name !== 'Unknown') return { name, id: id || '' };
        if (id) {
          const empName = checkEmpListForId(id);
          if (empName) return { name: empName, id };
        }
      }
    }

    return null;
  };

  // FETCH LIVE DATA
  const loadData = async (page: number = 1, searchQuery: string = '') => {
    setIsLoading(true);
    setCurrentPage(page);
    try {
      let visitorRes;
      let allVisitorsRes;
      let empRes;
      let deptRes;

      // Use pagination - limit 20 per page as per backend default
      const limit = 20;

      // Use backend search if searchQuery is provided
      if (searchQuery && searchQuery.trim()) {
        allVisitorsRes = await serviceDeliveryService.search(searchQuery.trim(), page, limit, true);
        setIsSearching(true);
      } else {
        // Regular load with pagination
        if (departmentId) {
          visitorRes = await serviceDeliveryService.getCurrentVisitorsByDepartment(departmentId);
          allVisitorsRes = await serviceDeliveryService.getAll(page, limit, true);
          empRes = await employeeService.getByDepartment(departmentId, false);
        } else {
          allVisitorsRes = await serviceDeliveryService.getAll(page, limit, true);
          empRes = await employeeService.getAll();
        }
        setIsSearching(false);
      }

      try {
        deptRes = await departmentService.getAll();
        if (deptRes.status || deptRes.success) {
          setDepartments(deptRes.data || []);
        }
      } catch (deptError) {
        console.error('Failed to load departments:', deptError);
      }

      // Only process visitorRes if it exists (when not searching)
      if (visitorRes && (visitorRes.status || visitorRes.success)) {
        const rawData = visitorRes.data;
        let visitorsArray: any[] = [];
        
        if (Array.isArray(rawData)) {
          if (rawData.length > 0 && rawData[0].visitors) {
            rawData.forEach((dept: any) => {
              if (dept.visitors && Array.isArray(dept.visitors)) {
                visitorsArray = [...visitorsArray, ...dept.visitors];
              }
            });
          } else {
            visitorsArray = rawData;
          }
        }
        
        setVisitors(visitorsArray);
      } else if (allVisitorsRes && (allVisitorsRes.status || allVisitorsRes.success)) {
        // When searching or no visitorRes, use allVisitorsRes for visitors
        const rawData = allVisitorsRes.data;
        let visitorsArray: any[] = [];
        
        if (Array.isArray(rawData)) {
          if (rawData.length > 0 && rawData[0].visitors) {
            rawData.forEach((dept: any) => {
              if (dept.visitors && Array.isArray(dept.visitors)) {
                visitorsArray = [...visitorsArray, ...dept.visitors];
              }
            });
          } else {
            visitorsArray = rawData;
          }
        }
        
        setVisitors(visitorsArray);
      }
      
      if (allVisitorsRes && (allVisitorsRes.status || allVisitorsRes.success)) {
        // Extract total from backend response for proper pagination
        if (allVisitorsRes.total !== undefined) {
          setBackendTotal(allVisitorsRes.total);
        }
        
        const allRawData = allVisitorsRes.data;
        let allVisitorsArray: any[] = [];
        
        if (Array.isArray(allRawData)) {
          if (allRawData.length > 0 && allRawData[0].visitors) {
            allRawData.forEach((dept: any) => {
              if (dept.visitors && Array.isArray(dept.visitors)) {
                allVisitorsArray = [...allVisitorsArray, ...dept.visitors];
              }
            });
          } else {
            allVisitorsArray = allRawData;
          }
        }
        
        const deptVisitors = allVisitorsArray.filter((v: any) => {
          return (v.services_status || []).some((s: any) => 
            String(s.department_id) === String(departmentId)
          );
        });
        setAllDepartmentVisitors(deptVisitors);
      }
      
      if (empRes && (empRes.status || empRes.success)) {
        setEmployees(Array.isArray(empRes.data) ? empRes.data : []);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const fetchVisitorsByProvider = async () => {
    setLoadingByFilters(true);
    try {
      const response = await serviceDeliveryService.getAll();
      if (response.success && response.data) {
        const allVisitors = response.data as any[];
        const providerMap: Record<string, any> = {};
        
        allVisitors.forEach(v => {
          // Check if this visitor has any business in this department
          const isForThisDept = !departmentId || 
            (v.services_status || []).some((s:any) => String(s.department_id) === String(departmentId)) ||
            (v.departments_assigned || []).some((d:any) => String(d.department_id) === String(departmentId));
          
          if (isForThisDept) {
            const assigned = getAssignedEmployee(v);
            const status = getVisitorStatus(v);
            
            if (assigned) {
              if (!providerMap[assigned.id]) {
                providerMap[assigned.id] = {
                  provider_id: assigned.id,
                  provider_name: assigned.name,
                  visitors: [],
                  count: 0
                };
              }
              if (status !== 'Completed') {
                providerMap[assigned.id].visitors.push(v);
                providerMap[assigned.id].count++;
              }
            } else {
              if (!providerMap['unassigned']) {
                providerMap['unassigned'] = {
                  provider_id: 'unassigned',
                  provider_name: 'Unassigned Visitors',
                  visitors: [],
                  count: 0
                };
              }
              if (status !== 'Completed') {
                providerMap['unassigned'].visitors.push(v);
                providerMap['unassigned'].count++;
              }
            }
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
    
    // Auto-refresh every 10 seconds to keep timer updates and data fresh
    const refreshInterval = setInterval(() => {
      loadData(currentPage, searchTerm);
    }, 10000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Helpers
  const getVisitorName = (v: Visitor) => v.full_name || v.name || 'Unknown';
  const getIdentification = (v: Visitor) => {
    if (!v.identification) return '_____';
    if (typeof v.identification === 'string') return v.identification;
    return v.identification.number || '_____';
  };
  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string): string => {
    if (!name) return 'bg-gray-500';
    const colors = ['bg-purple-500', 'bg-pink-500', 'bg-yellow-400', 'bg-teal-500', 'bg-blue-500', 'bg-indigo-500', 'bg-red-500', 'bg-green-500'];
    const colorIndex = name.charCodeAt(0) % colors.length;
    return colors[colorIndex];
  };

  const getVisitorStatus = (v: Visitor): string => {
    if (!v.services_status || !v.services_status.length) return 'Not started';
    
    const currentUser = user as any;
    const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || '');
    
    // First try to find by provider_id (current employee's own status)
    if (myId) {
      const statusByProvider = (v.services_status || []).find((s: any) => 
        String(s.provider_id) === myId
      );
      if (statusByProvider && statusByProvider.s_type) {
        const s = statusByProvider.s_type.toLowerCase();
        if (s === 'inprogress') return 'Inprogress';
        if (s === 'completed') return 'Completed';
        if (s === 'transfered' || s === 'transferred') return 'Transfered';
        return statusByProvider.s_type;
      }
    }
    
    // Then try to find by department_id (for department-level status)
    if (departmentId) {
      const statusByDept = (v.services_status || []).find((s: any) => {
        const deptId = typeof s.department_id === 'object' ? s.department_id?._id : s.department_id;
        return String(deptId) === String(departmentId);
      });
      
      if (statusByDept && statusByDept.s_type) {
        const s = statusByDept.s_type.toLowerCase();
        if (s === 'inprogress') return 'Inprogress';
        if (s === 'completed') return 'Completed';
        if (s === 'transfered' || s === 'transferred') return 'Transfered';
        return statusByDept.s_type;
      }
    }
    
    // Fallback: check if any service is in progress
    const anyInProgress = (v.services_status || []).find((s: any) => 
      s.s_type?.toLowerCase() === 'inprogress'
    );
    if (anyInProgress) return 'Inprogress';
    
    // Check for completed
    const anyCompleted = (v.services_status || []).find((s: any) => 
      s.s_type?.toLowerCase() === 'completed'
    );
    if (anyCompleted) return 'Completed';
    
    // Check for transferred
    const anyTransferred = (v.services_status || []).find((s: any) => 
      s.s_type?.toLowerCase() === 'transfered' || s.s_type?.toLowerCase() === 'transferred'
    );
    if (anyTransferred) return 'Transfered';
    
    return 'Not started';
  };

  const getServiceStartTime = (v: Visitor): string => {
    if (!v.durations?.services_durations || !v.durations.services_durations.length) return '';
    
    const currentUser = user as any;
    const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || '');
    
    // First try to find by provider_id (current employee)
    if (myId) {
      const serviceDurationByProvider = v.durations.services_durations.find((d: any) => {
        return String(d.provider_id) === myId;
      });
      if (serviceDurationByProvider?.started_at) return serviceDurationByProvider.started_at;
    }
    
    // Then try to find by department_id
    if (departmentId) {
      const serviceDuration = v.durations.services_durations.find((d: any) => {
        const deptId = typeof d.department_id === 'object' ? d.department_id?._id : d.department_id;
        return String(deptId) === String(departmentId);
      });
      if (serviceDuration?.started_at) return serviceDuration.started_at;
    }
    
    // Fallback: find any service duration that has started_at for this visitor
    const anyDuration = v.durations.services_durations.find((d: any) => d.started_at && !d.ended_at);
    if (anyDuration?.started_at) return anyDuration.started_at;
    
    // Last fallback: any started_at
    const lastDuration = v.durations.services_durations.find((d: any) => d.started_at);
    return lastDuration?.started_at || '';
  };

  // Calculate wait time (from check-in to now or to service start)
  const getWaitTime = (visitor: Visitor): string => {
    const status = getVisitorStatus(visitor);
    const serviceStartTime = getServiceStartTime(visitor);
    
    // Check-in time from entry_date
    const checkIn = visitor.entry_date;
    if (!checkIn) return 'Just now';
    
    // End timestamp is either service start time (if in progress/completed/transfered) or now
    const waitTimeEndStamp = 
      (status === 'Inprogress' || status === 'Completed' || status === 'Transfered' || 
       status.toLowerCase() === 'inprogress' || status.toLowerCase() === 'completed' || status.toLowerCase() === 'transfered') && serviceStartTime
        ? new Date(serviceStartTime).getTime()
        : new Date().getTime();
    
    const diffMins = Math.floor((waitTimeEndStamp - new Date(checkIn).getTime()) / 60000);
    if (diffMins < 1) return 'Just now';
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`;
  };

  // Calculate duration from start time
  const getServiceDuration = (startTime: string): string => {
    if (!startTime) return '_____';
    const start = new Date(startTime).getTime();
    const now = new Date().getTime();
    const diffMs = now - start;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getDepartmentName = (v: Visitor): string => {
    if (!v.departments_assigned || !departmentId) return '';
    const dept = v.departments_assigned.find((d: any) => {
      const deptId = typeof d.department_id === 'object' ? d.department_id?._id : d.department_id;
      return String(deptId) === String(departmentId);
    });
    return dept?.department_name || departmentName || '';
  };

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

  useEffect(() => {
    calculateEmployeeServiceCounts();
  }, [visitors, departmentId]);

  const handleServiceStart = async (startTime: string) => {
    if (!servingVisitor || !servingEmployee || !departmentId) return;
    try {
      const visitorId = servingVisitor._id || servingVisitor.id;
      const empId = servingEmployee._id || servingEmployee.employee_id;
      const empName = servingEmployee.full_name;
      
      const rawVisitor = servingVisitor;
      const currentDurations = rawVisitor.durations || { services_durations: [], emergency_durations: [] };
      const existingServiceDurations = currentDurations.services_durations || [];
      
      const existingRecordIndex = existingServiceDurations.findIndex((d: any) => String(d.provider_id) === String(empId));
      
      let updatedServiceDurations = [...existingServiceDurations];
      const deptInfo = rawVisitor.departments_assigned?.find((d: any) => String(d.provider_id) === String(empId)) || 
                       rawVisitor.services_status?.find((s: any) => String(s.provider_id) === String(empId));
      
      if (existingRecordIndex === -1) {
        updatedServiceDurations.push({
          department_id: departmentId,
          department_name: departmentName || deptInfo?.department_name || 'General',
          provider_name: empName,
          provider_id: empId,
          started_at: new Date().toISOString()
        });
      } else {
        updatedServiceDurations[existingRecordIndex] = {
          ...updatedServiceDurations[existingRecordIndex],
          started_at: new Date().toISOString()
        };
      }
      
      const updatedServicesStatus = (rawVisitor.services_status || []).map((s: any) => {
        if (String(s.provider_id) === String(empId)) return { ...s, s_type: 'Inprogress' };
        return s;
      });
      
      await serviceDeliveryService.updateServiceStatus(visitorId as string, {
        services_status: updatedServicesStatus,
        durations: { ...currentDurations, services_durations: updatedServiceDurations }
      });
      
      await loadData(currentPage);
    } catch (error) {
      console.error('Failed to start service:', error);
    }
  };

  const handleServiceEnd = async (data: { duration: string; startTime: string; endTime: string; notes: string }) => {
    if (!servingVisitor || !servingEmployee || !departmentId) return;
    try {
      const visitorId = servingVisitor._id || servingVisitor.id;
      const empId = servingEmployee._id || servingEmployee.employee_id;
      
      const isTransfer = data.notes && data.notes.toLowerCase().includes('transfer');
      const targetStatus = isTransfer ? 'Transfered' : 'Completed';
      
      const rawVisitor = servingVisitor;
      const currentDurations = rawVisitor.durations || { services_durations: [], emergency_durations: [] };
      const existingServiceDurations = currentDurations.services_durations || [];
      
      const existingRecordIndex = existingServiceDurations.findIndex((d: any) => String(d.provider_id) === String(empId));
      let updatedServiceDurations = [...existingServiceDurations];
      
      if (existingRecordIndex !== -1) {
        updatedServiceDurations[existingRecordIndex] = {
          ...updatedServiceDurations[existingRecordIndex],
          ended_at: new Date().toISOString(),
          duration: data.duration
        };
      }
      
      const updatedServicesStatus = (rawVisitor.services_status || []).map((s: any) => {
        if (String(s.provider_id) === String(empId)) return { ...s, s_type: targetStatus };
        return s;
      });
      
      await serviceDeliveryService.updateServiceStatus(visitorId as string, {
        services_status: updatedServicesStatus,
        durations: { ...currentDurations, services_durations: updatedServiceDurations }
      });
      
      if (!isTransfer && empId) {
        setEmployeeServiceCount(prev => ({
          ...prev,
          [empId]: (prev[empId] || 0) + 1
        }));
      }
      
      setShowServeModal(false);
      setServingVisitor(null);
      setServingEmployee(null);
      setPendingServiceStartTime('');
      await loadData();
    } catch (error) {
      console.error('Failed to complete service:', error);
    }
  };
  
  const handleTransferFromModal = async (departmentId: string, departmentName: string, employeeId: string, employeeName: string) => {
    if (!servingVisitor || !departmentId || !employeeId) return;
    try {
      const visitorId = servingVisitor._id || servingVisitor.id;
      await serviceDeliveryService.assignToDepartment(
        visitorId as string,
        departmentId,
        departmentName,
        employeeId,
        employeeName
      );
      setShowServeModal(false);
      setServingVisitor(null);
      setServingEmployee(null);
      setPendingServiceStartTime('');
      await loadData();
    } catch (error) {
      console.error('Failed to transfer visitor:', error);
      alert('Failed to transfer visitor. Please try again.');
    }
  };
  
  // Fetch employees by department for transfer modal
  const fetchTransferEmployees = async (deptId: string) => {
    if (!deptId) {
      setTransferEmployees([]);
      return;
    }
    setTransferEmployeesLoading(true);
    try {
      const response = await employeeService.getByDepartment(deptId, false);
      if (response.success && response.data) {
        setTransferEmployees(response.data);
      } else {
        setTransferEmployees([]);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      setTransferEmployees([]);
    } finally {
      setTransferEmployeesLoading(false);
    }
  };

  const handleTransferVisitor = async () => {
    if (!transferVisitor || !transferDepartment) return;
    setTransferring(true);
    try {
      const visitorId = transferVisitor._id || transferVisitor.id;
      const newDept = departments.find(d => d._id === transferDepartment);
      const newDeptName = newDept?.department_name || newDept?.name || 'Unknown';
      
      // Get employee info if selected
      const providerId = transferEmployee ? (transferEmployee._id || transferEmployee.employee_id) : undefined;
      const providerName = transferEmployee ? transferEmployee.full_name : undefined;
      
      await serviceDeliveryService.assignToDepartment(
        visitorId as string,
        transferDepartment,
        newDeptName,
        providerId,
        providerName,
        departmentId // previous_department_id to close current service
      );
      
      setShowTransferModal(false);
      setTransferVisitor(null);
      setTransferDepartment('');
      setTransferEmployee(null);
      setTransferEmployees([]);
      await loadData();
    } catch (error) {
      console.error('Failed to transfer visitor:', error);
      alert('Failed to transfer visitor. Please try again.');
    } finally {
      setTransferring(false);
    }
  };

  const pendingVisitors = visitors.filter(v => getVisitorStatus(v) === 'Not started');
  const inProgressVisitors = visitors.filter(v => getVisitorStatus(v) === 'Inprogress');
  const completedVisitors = visitors.filter(v => getVisitorStatus(v) === 'Completed');
  const transferredVisitors = visitors.filter(v => getVisitorStatus(v) === 'Transfered');

  const filteredDashboardVisitors = visitors.filter(v => {
    const matchesSearch = getVisitorName(v).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getIdentification(v).includes(searchTerm);
    const matchesStatus = dashboardStatusFilter === 'all' 
      ? true 
      : getVisitorStatus(v).toLowerCase() === dashboardStatusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const itemsPerPage = 20; // Match backend limit
  // Use backend total for pagination if available, otherwise fall back to local count
  const totalItems = backendTotal > 0 ? backendTotal : filteredDashboardVisitors.length;
  const totalDashboardPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedDashboard = filteredDashboardVisitors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const filteredServiceVisitors = visitors.filter(v => {
    const matchesSearch = getVisitorName(v).toLowerCase().includes(serviceStatusSearch.toLowerCase()) || 
                          (v.telephone || '').includes(serviceStatusSearch);
    const matchesStatus = serviceStatusFilter === 'all' ? true : getVisitorStatus(v).toLowerCase() === serviceStatusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const filteredEmployees = employees.filter(e => 
    (e.full_name || '').toLowerCase().includes(employeeSearch.toLowerCase()) ||
    (e.email || '').toLowerCase().includes(employeeSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
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
          <div className="bg-white rounded-[14px] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
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
                    onKeyPress={(e) => e.key === 'Enter' && handleVisitorSearch()}
                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button 
                  onClick={handleVisitorSearch}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 rounded-lg text-white text-sm font-medium hover:bg-green-700"
                >
                  <FiSearch className="w-4 h-4" /> Search
                </button>
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
                <button onClick={() => loadData(1)} className="flex items-center gap-2 px-4 py-2 bg-[#0284C7] rounded-lg text-white text-sm font-medium hover:bg-[#0369A1]">
                  <FiRefreshCw className="w-4 h-4" /> Refresh
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-[#F8FAFC] sticky top-0 z-10">
                  <tr>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">VISITOR</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">CONTACT</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">ID/BADGE</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">ASSIGNED TO</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">STATUS</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">TIME</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-500">Loading live data...</td></tr>
                  ) : paginatedDashboard.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-500">No pending requests found.</td></tr>
                  ) : (
                    paginatedDashboard.map((visitor) => (
                      <tr key={visitor._id || visitor.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs mr-3">
                              {getInitials(getVisitorName(visitor))}
                            </div>
                            <p className="text-sm font-semibold text-gray-800">{getVisitorName(visitor)}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-600">{visitor.telephone || '_____'}</p>
                          <p className="text-xs text-gray-400">{visitor.email || ''}</p>
                        </td>
                        <td className="px-4 py-3"><p className="text-sm text-gray-600">{getIdentification(visitor) || visitor.badge_number || '_____'}</p></td>
                        <td className="px-4 py-3">
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
                        <td className="px-4 py-3">
                          {(() => {
                            const status = getVisitorStatus(visitor);
                            const statusLower = status.toLowerCase();
                            let displayStatus = status;
                            let colorClass = 'bg-gray-100 text-gray-700';
                            
                            if (statusLower === 'not started' || statusLower === 'not_started') {
                              displayStatus = 'Not started';
                              colorClass = 'bg-orange-100 text-orange-700';
                            } else if (statusLower === 'inprogress') {
                              displayStatus = 'In Progress';
                              colorClass = 'bg-blue-100 text-blue-700';
                            } else if (statusLower === 'completed') {
                              displayStatus = 'Completed';
                              colorClass = 'bg-green-100 text-green-700';
                            } else if (statusLower === 'transfered' || statusLower === 'transferred') {
                              displayStatus = 'Transferred';
                              colorClass = 'bg-purple-100 text-purple-700';
                            }
                            
                            return <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${colorClass}`}>{displayStatus}</span>;
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const status = getVisitorStatus(visitor);
                            const waitTime = getWaitTime(visitor);
                            const serviceStartTime = getServiceStartTime(visitor);
                            
                            // Show LIVE TIMER when service is in progress (using started_at from DB)
                            if ((status === 'Inprogress' || status.toLowerCase() === 'inprogress') && serviceStartTime) {
                              return (
                                <div className="flex flex-col">
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-[#e3f2fd] text-[#1a73e8]">
                                    <FiClock className="w-3 h-3 animate-pulse" />
                                    <LiveTimer startTime={serviceStartTime} />
                                  </span>
                                </div>
                              );
                            }
                            
                            // For completed services, show duration if available
                            if (status === 'Completed' || status.toLowerCase() === 'completed') {
                              const duration = visitor.durations?.services_durations?.find((d: any) => d.started_at && d.ended_at);
                              if (duration?.duration) {
                                return <span className="text-xs text-gray-600 font-medium">{duration.duration}</span>;
                              }
                            }
                            
                            // For pending, show wait time
                            if (status === 'Not started' || status.toLowerCase() === 'not started') {
                              return <span className="text-xs text-orange-600">{waitTime}</span>;
                            }
                            
                            // For transferred
                            return <span className="text-xs text-gray-500">{waitTime}</span>;
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const status = getVisitorStatus(visitor);
                            const assigned = getAssignedEmployee(visitor);
                            const serviceStartTime = getServiceStartTime(visitor);
                            
                            // If service is in progress, show timer, Stop and Transfer buttons
                            if (status === 'Inprogress' || status.toLowerCase() === 'inprogress') {
                              return (
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => {
                                      const emp = employees.find(e => e.full_name === assigned?.name);
                                      setServingVisitor(visitor);
                                      setServingEmployee(emp || null);
                                      setShowServeModal(true);
                                    }}
                                    className="flex items-center gap-1 h-7 px-2 bg-[#e53935] text-white text-xs font-bold rounded-[4px] hover:bg-[#c62828] transition-colors"
                                  >
                                    <FiSquare className="w-3 h-3 fill-current" /> Stop
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setTransferVisitor(visitor);
                                      setShowTransferModal(true);
                                    }}
                                    className="flex items-center gap-1 h-7 px-2 bg-[#0284C7] text-white text-xs font-bold rounded-[4px] hover:bg-[#0369A1] transition-colors"
                                  >
                                    <FiArrowRightCircle className="w-3 h-3" /> Transfer
                                  </button>
                                </div>
                              );
                            }
                            
                            // If completed, show completed
                            if (status === 'Completed' || status.toLowerCase() === 'completed') {
                              return (
                                <span className="text-[#34a853] text-xs font-medium">✓ Completed</span>
                              );
                            }
                            
                            // If transferred, show transferred
                            if (status === 'Transfered' || status.toLowerCase() === 'transfered' || status.toLowerCase() === 'transferred') {
                              return (
                                <span className="text-[#7b1fa2] text-xs font-medium">⇄ Transferred</span>
                              );
                            }
                            
                            // Not started - logic for Assigned vs Serve
                            if (status === 'Not started' || status.toLowerCase() === 'not started' || status.toLowerCase() === 'not_started' || !status) {
                              if (assigned) {
                                return (
                                  <div className="flex items-center gap-1">
                                    <span className="text-blue-600 font-bold text-xs uppercase px-2 py-1 bg-blue-50 border border-blue-200 rounded shadow-sm">
                                      Assigned
                                    </span>
                                    <button 
                                      onClick={() => {
                                        setTransferVisitor(visitor);
                                        setShowTransferModal(true);
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 bg-[#0284C7] text-white text-xs font-bold rounded hover:bg-[#0369A1] transition-colors shadow-sm"
                                    >
                                      <FiArrowRightCircle className="w-3 h-3" /> Transfer
                                    </button>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={async () => {
                                        // Find the current user in employees list or use first available
                                        const emp = employees.find(e => e.email === user?.email) || employees[0];
                                        if (emp) {
                                          const now = new Date().toISOString();
                                          
                                          // IMMEDIATELY send request to backend to start service
                                          await handleServiceStart(now);
                                          
                                          // Then set serving visitor and open modal
                                          setServingVisitor(visitor);
                                          setServingEmployee(emp);
                                          setPendingServiceStartTime(now);
                                          setShowServeModal(true);
                                          
                                          // Refresh data to get the confirmed start time from backend
                                          await loadData(currentPage);
                                        } else {
                                          alert('No employee found. Please ensure you are logged in as an employee.');
                                        }
                                      }}
                                      className="flex items-center px-3 py-1.5 bg-[#0284C7] text-white text-xs font-bold rounded hover:bg-[#0369A1] transition-colors shadow-sm"
                                    >
                                      Serve <FiPlay className="w-3 h-3 ml-1" />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setTransferVisitor(visitor);
                                        setShowTransferModal(true);
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 bg-[#0284C7] text-white text-xs font-bold rounded hover:bg-[#0369A1] transition-colors shadow-sm"
                                    >
                                      <FiArrowRightCircle className="w-3 h-3" /> Transfer
                                    </button>
                                  </div>
                                );
                              }
                            }
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white mt-auto">
              <span className="text-sm text-gray-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => loadData(Math.max(1, currentPage - 1), searchTerm)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors font-medium"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(totalDashboardPages, 5) }, (_, i) => {
                  // Show first 5 pages or less
                  let page = i + 1;
                  if (totalDashboardPages > 5 && currentPage > 3) {
                    page = currentPage - 2 + i;
                    if (page > totalDashboardPages) return null;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => loadData(page, searchTerm)}
                      className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium transition-colors ${
                        currentPage === page 
                          ? 'bg-[#0284C7] text-white' 
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => loadData(Math.min(totalDashboardPages, currentPage + 1), searchTerm)}
                  disabled={currentPage === totalDashboardPages || totalDashboardPages === 0}
                  className="px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors font-medium"
                >
                  Next
                </button>
              </div>
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
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">BADGE NUMBER</th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">SERVICE</th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">ASSIGNED TO</th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">STATUS</th>
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">PHONE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredServiceVisitors.map(visitor => (
                  <tr key={visitor._id || visitor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold text-gray-800">{getVisitorName(visitor)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{visitor.badge_number || '_____'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{visitor.service || '_____'}</td>
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
                        return <span className="text-sm text-gray-400 italic">Unassigned</span>;
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getVisitorStatus(visitor) === 'Inprogress' ? 'bg-blue-100 text-blue-700' : getVisitorStatus(visitor) === 'Not started' ? 'bg-orange-100 text-orange-600' : getVisitorStatus(visitor) === 'Transfered' ? 'bg-purple-100 text-purple-600' : getVisitorStatus(visitor) === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {getVisitorStatus(visitor) === 'Inprogress' ? 'In Progress' : getVisitorStatus(visitor) === 'Not started' ? 'Not Started' : getVisitorStatus(visitor) === 'Transfered' ? 'Transferred' : getVisitorStatus(visitor) === 'Completed' ? 'Completed' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{visitor.telephone || '_____'}</td>
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
          {/* Search Bar */}
          <div className="backdrop-blur-xl bg-white/80 rounded-2xl shadow-lg border border-white/30 p-3 mx-4 mt-2">
            <div className="flex flex-col md:flex-row gap-3 items-center">
              {/* Search Input */}
              <div className="flex-1 flex gap-2 w-full">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleEmployeeSearch()}
                    placeholder="Search employees by name or email..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200/50 rounded-lg bg-white/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm"
                  />
                </div>
                <button
                  onClick={handleEmployeeSearch}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 shadow-md transition-all"
                >
                  <FiSearch className="w-4 h-4" />
                  Search
                </button>
              </div>
            </div>
          </div>
          <div className="backdrop-blur-xl bg-white/80 rounded-2xl shadow-lg border border-white/30 overflow-hidden flex flex-col m-4 mt-2">
            <div className="overflow-auto flex-1">
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
                <tbody className="divide-y divide-gray-100/50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          Loading...
                        </div>
                      </td>
                    </tr>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                        <div className="flex flex-col items-center gap-1">
                          <FiSearch className="w-6 h-6 text-gray-400" />
                          <span>No employees found</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    employees.map(emp => (
                      <tr key={emp._id || emp.employee_id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-semibold text-gray-800 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                            {getInitials(emp.full_name || '')}
                          </div>
                          {emp.full_name}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {emp.identification?.number || emp.badge_number || 'N/A'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">{emp.email || 'N/A'}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{emp.title || emp.role || 'N/A'}</td>
                        <td className="px-4 py-4">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                            {employeeServiceCount[emp._id || emp.employee_id || ''] || 0}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase">
                            {emp.status || 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-700">{v.full_name || v.name || 'Unknown'}</span>
                              {(() => {
                                const assigned = getAssignedEmployee(v);
                                if (assigned) {
                                  return <span className="text-xs text-gray-500">Assigned to: {assigned.name}</span>;
                                }
                                return <span className="text-xs text-gray-400 italic">Unassigned</span>;
                              })()}
                            </div>
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
                        {provider.provider_id === 'unassigned' ? (
                          <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center">
                            <FiUser className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                            {getInitials(provider.provider_name || 'U')}
                          </div>
                        )}
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
                          <span className={`px-2 py-1 rounded text-xs font-bold ${(v.services_status || []).find((s: any) => String(s.department_id) === String(departmentId))?.s_type === 'Inprogress' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                            {(v.services_status || []).find((s: any) => String(s.department_id) === String(departmentId))?.s_type || 'Not started'}
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
            initials: getInitials(selectedDeptEmployee.full_name || ''),
            department: selectedDeptEmployee.department_name || 'N/A'
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
              const empId = selectedDeptEmployee._id || selectedDeptEmployee.employee_id;
              if (!empId) {
                throw new Error('Employee ID not found');
              }
              const response: any = await employeeService.delete(empId);
              if (response && response.success === true) {
                setShowDeleteEmployeeModal(false);
                setSelectedDeptEmployee(null);
                loadData();
              } else {
                const errorMsg = response?.message || 'Failed to delete employee';
                throw new Error(errorMsg);
              }
            } catch (error: any) {
              console.error('Delete error:', error);
              const errorMessage = error?.message || error?.response?.data?.message || 'Failed to delete employee';
              throw new Error(errorMessage);
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
            setPendingServiceStartTime('');
          }}
          visitor={{
            name: getVisitorName(servingVisitor),
            id: servingVisitor._id || servingVisitor.id || '',
            email: servingVisitor.email || servingVisitor.telephone || '',
            service: servingVisitor.service || 'General Service',
            checkInTime: servingVisitor.entry_date 
              ? new Date(servingVisitor.entry_date).toLocaleString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })
              : 'Just now',
            gate: 'Main Gate',
            status: getVisitorStatus(servingVisitor),
            serviceStartTime: getServiceStartTime(servingVisitor) || pendingServiceStartTime,
            departmentName: getDepartmentName(servingVisitor)
          }}
          onServiceStart={handleServiceStart}
          onServiceEnd={handleServiceEnd}
        />
      )}

      {/* Transfer Modal */}
      {showTransferModal && transferVisitor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[16px] shadow-[0px_10px_30px_rgba(0,0,0,0.1)] w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-[#2C3E50] text-[20px] font-semibold">Transfer Visitor</h2>
                <button 
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferVisitor(null);
                    setTransferDepartment('');
                    setTransferEmployee(null);
                  }} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">Visitor</label>
                <div className="flex items-center gap-3 p-3 bg-[#F7F9FB] rounded-lg">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${getAvatarColor(getVisitorName(transferVisitor))}`}>
                    <span>{getInitials(getVisitorName(transferVisitor))}</span>
                  </div>
                  <div>
                    <div className="text-[#2C3E50] text-[14px] font-medium">{getVisitorName(transferVisitor)}</div>
                    <div className="text-[#8A94A6] text-[12px]">{getIdentification(transferVisitor)}</div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">Select Department</label>
                <select
                  value={transferDepartment}
                  onChange={(e) => {
                    const deptId = e.target.value;
                    setTransferDepartment(deptId);
                    setTransferEmployee(null);
                    fetchTransferEmployees(deptId);
                  }}
                  className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-[13px] focus:ring-2 focus:ring-[#0284C7] bg-white"
                >
                  <option value="">Choose department...</option>
                  {departments
                    .filter(d => d._id !== departmentId)
                    .map(dept => (
                      <option key={dept._id} value={dept._id}>
                        {dept.department_name || dept.name}
                      </option>
                    ))}
                </select>
              </div>

              {transferDepartment && (
                <div className="mb-6">
                  <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">Select Employee</label>
                  <div className="relative">
                    {transferEmployeesLoading ? (
                      <div className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-[13px] bg-gray-100 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-[#0284C7] border-t-transparent rounded-full animate-spin mr-2"></div>
                        <span className="text-gray-500">Loading employees...</span>
                      </div>
                    ) : (
                      <select
                        value={transferEmployee?._id || transferEmployee?.employee_id || ''}
                        onChange={(e) => {
                          const emp = transferEmployees.find(em => String(em._id || em.employee_id) === e.target.value);
                          setTransferEmployee(emp || null);
                        }}
                        className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-[13px] focus:ring-2 focus:ring-[#0284C7] bg-white cursor-pointer appearance-none"
                      >
                        <option value="">Choose employee...</option>
                        {transferEmployees
                          .map(emp => {
                            const empId = String(emp._id || emp.employee_id || '');
                            const serviceCount = employeeServiceCount[empId] || 0;
                            return (
                              <option key={empId} value={empId}>
                                {emp.full_name} {emp.title ? `(${emp.title})` : ''} - {serviceCount} visitor{serviceCount !== 1 ? 's' : ''} in queue
                              </option>
                            );
                          })}
                      </select>
                    )}
                    {!transferEmployeesLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferVisitor(null);
                    setTransferDepartment('');
                    setTransferEmployee(null);
                    setTransferEmployees([]);
                  }}
                  className="flex-1 px-4 py-2 border border-[#D9E1EA] text-[#2C3E50] rounded-[8px] font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransferVisitor}
                  disabled={!transferDepartment || transferring}
                  className="flex-1 px-4 py-2 bg-[#0284C7] text-white rounded-[8px] font-medium hover:bg-[#0369A1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {transferring ? (
                    <>
                      <FiRefreshCw className="w-4 h-4 animate-spin" /> Transferring...
                    </>
                  ) : (
                    <>
                      <FiArrowRightCircle className="w-4 h-4" /> Transfer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentManagerDashboard;