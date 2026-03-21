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
  s_type?: string; 
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
  const [backendTotal, setBackendTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [serviceStatusSearch, setServiceStatusSearch] = useState("");
  const [serviceStatusFilter, setServiceStatusFilter] = useState("all");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState('all');

  // Modals
  const [showServeModal, setShowServeModal] = useState(false);
  const [servingVisitor, setServingVisitor] = useState<Visitor | null>(null);
  const [employeeServiceCount, setEmployeeServiceCount] = useState<Record<string, number>>({});
  
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferVisitor, setTransferVisitor] = useState<Visitor | null>(null);
  const [transferDepartment, setTransferDepartment] = useState<string>('');
  const [transferEmployee, setTransferEmployee] = useState<Employee | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferEmployees, setTransferEmployees] = useState<Employee[]>([]);
  const [transferEmployeesLoading, setTransferEmployeesLoading] = useState(false);

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

  const getAssignedEmployee = (v: any): { name: string; id: string } | null => {
    if (!v) return null;
    const checkEmpListForId = (id: string) => {
      const emp = employees.find(e => String(e._id) === String(id) || String(e.employee_id) === String(id));
      return emp ? emp.full_name : null;
    };

    if (v.provider_name && v.provider_name !== 'Unknown') return { name: v.provider_name, id: v.provider_id || '' };

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

  const loadData = async (page: number = 1, searchQuery: string = '', silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    setCurrentPage(page);
    try {
      let visitorRes;
      let allVisitorsRes;
      let empRes;
      let deptRes;
      const limit = 20;

      if (searchQuery && searchQuery.trim()) {
        allVisitorsRes = await serviceDeliveryService.search(searchQuery.trim(), page, limit, true);
        setIsSearching(true);
      } else {
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
        if (deptRes.status || deptRes.success) setDepartments(deptRes.data || []);
      } catch (deptError) {}

      if (visitorRes && (visitorRes.status || visitorRes.success)) {
        const rawData = visitorRes.data;
        let visitorsArray: any[] = [];
        if (Array.isArray(rawData)) {
          if (rawData.length > 0 && rawData[0].visitors) {
            rawData.forEach((dept: any) => {
              if (dept.visitors && Array.isArray(dept.visitors)) visitorsArray = [...visitorsArray, ...dept.visitors];
            });
          } else {
            visitorsArray = rawData;
          }
        }
        setVisitors(visitorsArray);
      } else if (allVisitorsRes && (allVisitorsRes.status || allVisitorsRes.success)) {
        const rawData = allVisitorsRes.data;
        let visitorsArray: any[] = [];
        if (Array.isArray(rawData)) {
          if (rawData.length > 0 && rawData[0].visitors) {
            rawData.forEach((dept: any) => {
              if (dept.visitors && Array.isArray(dept.visitors)) visitorsArray = [...visitorsArray, ...dept.visitors];
            });
          } else {
            visitorsArray = rawData;
          }
        }
        setVisitors(visitorsArray);
      }
      
      if (allVisitorsRes && (allVisitorsRes.status || allVisitorsRes.success)) {
        if (allVisitorsRes.total !== undefined) setBackendTotal(allVisitorsRes.total);
      }
      
      if (empRes && (empRes.status || empRes.success)) {
        setEmployees(Array.isArray(empRes.data) ? empRes.data : []);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(1, '', false);
  }, []);

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
  
  const getAvatarColor = (name: string) => {
    const colors = ['bg-purple-500', 'bg-pink-500', 'bg-yellow-400', 'bg-teal-500', 'bg-indigo-500', 'bg-blue-500'];
    if (!name) return colors[0];
    const colorIndex = name.charCodeAt(0) % colors.length;
    return colors[colorIndex];
  };

  const getVisitorStatus = (v: Visitor): string => {
    if (!v.services_status || !v.services_status.length) return 'Not started';
    const currentUser = user as any;
    const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || '');
    
    let status = '';
    
    if (myId) {
      const statusByProvider = (v.services_status || []).find((s: any) => String(s.provider_id) === myId);
      if (statusByProvider && statusByProvider.s_type) {
        const s = statusByProvider.s_type.toLowerCase();
        if (s === 'inprogress') status = 'Inprogress';
        else if (s === 'completed') status = 'Completed';
        else if (s === 'transfered' || s === 'transferred') status = 'Transfered';
        else if (s === 'not started') status = 'Not started';
        else status = statusByProvider.s_type;
      }
    }
    
    if (!status && departmentId) {
      const statusByDept = (v.services_status || []).find((s: any) => {
        const deptId = typeof s.department_id === 'object' ? s.department_id?._id : s.department_id;
        return String(deptId) === String(departmentId);
      });
      if (statusByDept && statusByDept.s_type) {
        const s = statusByDept.s_type.toLowerCase();
        if (s === 'inprogress') status = 'Inprogress';
        else if (s === 'completed') status = 'Completed';
        else if (s === 'transfered' || s === 'transferred') status = 'Transfered';
        else if (s === 'not started') status = 'Not started';
        else status = statusByDept.s_type;
      }
    }
    
    if (!status) {
      const anyInProgress = (v.services_status || []).find((s: any) => s.s_type?.toLowerCase() === 'inprogress');
      if (anyInProgress) status = 'Inprogress';
      else {
        const anyCompleted = (v.services_status || []).find((s: any) => s.s_type?.toLowerCase() === 'completed');
        if (anyCompleted) status = 'Completed';
        else {
          const anyTransferred = (v.services_status || []).find((s: any) => s.s_type?.toLowerCase() === 'transfered' || s.s_type?.toLowerCase() === 'transferred');
          if (anyTransferred) status = 'Transfered';
          else status = 'Not started';
        }
      }
    }

    if (status === 'Transfered') {
      const latestAssignment = v.departments_assigned && v.departments_assigned.length > 0 ? v.departments_assigned[v.departments_assigned.length - 1] : null;
      if (latestAssignment) {
        const latestProviderId = typeof latestAssignment.provider_id === 'object' ? (latestAssignment.provider_id as any)._id : latestAssignment.provider_id;
        const latestDeptId = typeof latestAssignment.department_id === 'object' ? (latestAssignment.department_id as any)._id : latestAssignment.department_id;

        if (String(latestProviderId) === String(myId) || String(latestDeptId) === String(departmentId)) {
          status = 'Not started';
        }
      }
    }

    return status;
  };

  const getServiceStartTime = (v: Visitor): string => {
    if (!v.durations?.services_durations || !v.durations.services_durations.length) return '';
    const currentUser = user as any;
    const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || '');
    
    if (myId) {
      const serviceDurationByProvider = v.durations.services_durations.find((d: any) => String(d.provider_id) === myId);
      if (serviceDurationByProvider?.started_at) return serviceDurationByProvider.started_at;
    }
    
    if (departmentId) {
      const serviceDuration = v.durations.services_durations.find((d: any) => {
        const deptId = typeof d.department_id === 'object' ? d.department_id?._id : d.department_id;
        return String(deptId) === String(departmentId);
      });
      if (serviceDuration?.started_at) return serviceDuration.started_at;
    }
    
    const anyDuration = v.durations.services_durations.find((d: any) => d.started_at && !d.ended_at);
    if (anyDuration?.started_at) return anyDuration.started_at;
    
    const lastDuration = v.durations.services_durations.find((d: any) => d.started_at);
    return lastDuration?.started_at || '';
  };

  const getWaitTime = (visitor: Visitor): string => {
    const status = getVisitorStatus(visitor);
    const serviceStartTime = getServiceStartTime(visitor);
    const checkIn = visitor.entry_date;
    if (!checkIn) return 'Just now';
    
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

  const getDepartmentName = (v: Visitor): string => {
    if (!v.departments_assigned || !departmentId) return '';
    const dept = v.departments_assigned.find((d: any) => {
      const deptId = typeof d.department_id === 'object' ? d.department_id?._id : d.department_id;
      return String(deptId) === String(departmentId);
    });
    return dept?.department_name || departmentName || '';
  };

  const updateBackendStatus = async (targetStatus: string, visitorId: string, rawVisitor: any, empId: string, empName: string, isStart: boolean = false, durationStr: string = "") => {
    const updatedServicesStatus = (rawVisitor.services_status || []).filter((s: any) => String(s.provider_id) !== String(empId));
    updatedServicesStatus.push({
      department_id: departmentId || "",
      department_name: departmentName || "General",
      provider_name: empName,
      provider_id: empId,
      s_type: targetStatus
    });

    const currentDurations = rawVisitor.durations || { services_durations: [], emergency_durations: [] };
    const existingServiceDurations = currentDurations.services_durations || [];
    const existingRecordIndex = existingServiceDurations.findIndex((d: any) => String(d.provider_id) === String(empId));

    let updatedServiceDurations = [...existingServiceDurations];

    if (isStart) {
      if (existingRecordIndex === -1) {
        updatedServiceDurations.push({
          department_id: departmentId || "",
          department_name: departmentName || "General",
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
    } else if (!isStart && durationStr) {
      if (existingRecordIndex !== -1) {
        updatedServiceDurations[existingRecordIndex] = {
          ...updatedServiceDurations[existingRecordIndex],
          ended_at: new Date().toISOString(),
          duration: durationStr
        };
      } else {
        // Fallback safety to ensure durations always push correctly
        updatedServiceDurations.push({
          department_id: departmentId || "",
          department_name: departmentName || "General",
          provider_name: empName,
          provider_id: empId,
          ended_at: new Date().toISOString(),
          duration: durationStr
        });
      }
    }

    await serviceDeliveryService.updateServiceStatus(visitorId, { 
      services_status: updatedServicesStatus,
      durations: { ...currentDurations, services_durations: updatedServiceDurations }
    });
  };

  // 👉 FIXED: End Service is now robust and relies strictly on the logged in user's ID
  const handleServiceEnd = async (data: { duration: string; startTime: string; endTime: string; notes: string }) => {
    if (!servingVisitor || !departmentId) return;
    try {
      const visitorId = servingVisitor._id || servingVisitor.id;
      
      const currentUser = user as any;
      const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || '');
      const myName = String(currentUser?.full_name || currentUser?.fullName || currentUser?.name || 'Unknown');
      
      // Determine exactly who was serving to end their specific session
      const assigned = getAssignedEmployee(servingVisitor);
      const empId = assigned?.id || myId;
      const empName = assigned?.name || myName;
      
      const isTransfer = data.notes && data.notes.toLowerCase().includes('transfer');
      const targetStatus = isTransfer ? 'Transfered' : 'Completed';
      
      // Save the visitor reference before clearing
      const visitorToUpdate = servingVisitor;
      
      // Optimistic UI Update
      setVisitors(prev => prev.map(v => {
        if (String(v._id || v.id) === String(visitorId)) {
            const newStatus = [...(v.services_status || [])];
            const myIdx = newStatus.findIndex(s => String(s.provider_id) === String(empId));
            if (myIdx !== -1) {
                newStatus[myIdx] = { ...newStatus[myIdx], s_type: targetStatus };
            } else {
                newStatus.push({ department_id: departmentId, provider_id: empId, provider_name: empName, s_type: targetStatus });
            }
            return { ...v, services_status: newStatus };
        }
        return v;
      }));

      // Close the modal instantly
      setShowServeModal(false);
      setServingVisitor(null);
      setPendingServiceStartTime('');

      // Silent sync to DB
      await updateBackendStatus(targetStatus, visitorId as string, visitorToUpdate, empId, empName, false, data.duration);
      loadData(currentPage, searchTerm, true);
    } catch (error) {
      console.error('Failed to complete service:', error);
    }
  };

  const handleVisitorSearch = async () => {
    setIsSearching(true);
    setCurrentPage(1);
    await loadData(1, searchTerm, false);
  };

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
      const providerId = transferEmployee ? (transferEmployee._id || transferEmployee.employee_id) : undefined;
      const providerName = transferEmployee ? transferEmployee.full_name : undefined;
      
      const currentUser = user as any;
      const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || '');
      const myName = String(currentUser?.full_name || currentUser?.fullName || currentUser?.name || 'Unknown');

      setVisitors(prev => prev.map(v => {
        if ((v._id || v.id) === visitorId) {
          const newStatus = [...(v.services_status || [])];
          const existingDeptStatusIndex = newStatus.findIndex(s => String(s.department_id) === String(departmentId));
          if (existingDeptStatusIndex !== -1) {
            newStatus[existingDeptStatusIndex] = { ...newStatus[existingDeptStatusIndex], s_type: 'Transfered' };
          } else {
            newStatus.push({ department_id: departmentId, provider_id: myId, provider_name: myName, s_type: 'Transfered' });
          }
          return { ...v, services_status: newStatus };
        }
        return v;
      }));

      await updateBackendStatus('Transfered', visitorId as string, transferVisitor, myId, myName, false, '');

      await serviceDeliveryService.assignToDepartment(
        visitorId as string,
        transferDepartment,
        newDeptName,
        providerId,
        providerName,
        departmentId 
      );
      
      setShowTransferModal(false);
      setTransferVisitor(null);
      setTransferDepartment('');
      setTransferEmployee(null);
      setTransferEmployees([]);
      
      loadData(currentPage, searchTerm, true);
    } catch (error) {
      console.error('Failed to transfer visitor:', error);
      alert('Failed to transfer visitor. Please try again.');
      loadData(currentPage, searchTerm, true); 
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

  const itemsPerPage = 20;
  const totalItems = backendTotal > 0 ? backendTotal : filteredDashboardVisitors.length;
  const totalDashboardPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedDashboard = filteredDashboardVisitors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
                <button onClick={() => loadData(1, searchTerm, false)} className="flex items-center gap-2 px-4 py-2 bg-[#0284C7] rounded-lg text-white text-sm font-medium hover:bg-[#0369A1]">
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
                            
                            if (status === 'Completed' || status.toLowerCase() === 'completed') {
                              const duration = visitor.durations?.services_durations?.find((d: any) => d.started_at && d.ended_at);
                              if (duration?.duration) {
                                return <span className="text-xs text-gray-600 font-medium">{duration.duration}</span>;
                              }
                            }
                            
                            if (status === 'Not started' || status.toLowerCase() === 'not started') {
                              return <span className="text-xs text-orange-600">{waitTime}</span>;
                            }
                            
                            return <span className="text-xs text-gray-500">{waitTime}</span>;
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const currentUser = user as any;
                            const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || '');
                            const myName = String(currentUser?.full_name || currentUser?.fullName || currentUser?.name || 'Unknown');
                            const status = getVisitorStatus(visitor);
                            const statusLower = status.toLowerCase();

                            if (statusLower === 'completed') {
                              return <span className="text-[#34a853] text-xs font-medium">✓ Completed</span>;
                            }

                            // 👉 FIXED: Rely on the logged in user to click Stop, completely eliminating the 'employees' search bug
                            if (statusLower === 'inprogress') {
                              return (
                                <div className="flex items-center gap-2">
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setServingVisitor(visitor);
                                      setPendingServiceStartTime(getServiceStartTime(visitor) || '');
                                      setShowServeModal(true);
                                    }}
                                    className="flex items-center justify-center gap-1.5 h-8 w-20 bg-[#e53935] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#c62828] transition-colors shadow-sm"
                                  >
                                    <FiSquare className="w-3 h-3 fill-current" /> Stop
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setTransferVisitor(visitor);
                                      setShowTransferModal(true);
                                    }}
                                    className="flex items-center justify-center gap-1 h-8 w-24 bg-[#7b1fa2] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#6a1b9a] transition-colors shadow-sm"
                                  >
                                    <FiArrowRightCircle className="w-3 h-3" /> Transfer
                                  </button>
                                </div>
                              );
                            }

                            const currentAssignment = visitor.departments_assigned && visitor.departments_assigned.length > 0 
                                ? visitor.departments_assigned[visitor.departments_assigned.length - 1] 
                                : null;
                            
                            const currentDeptId = currentAssignment ? (typeof currentAssignment.department_id === 'object' ? (currentAssignment.department_id as any)._id : currentAssignment.department_id) : null;
                            const currentProviderId = currentAssignment ? (typeof currentAssignment.provider_id === 'object' ? (currentAssignment.provider_id as any)._id : currentAssignment.provider_id) : null;

                            const isCurrentlyInMyDept = currentAssignment && String(currentDeptId) === String(departmentId);
                            const isAssignedToMe = currentAssignment && String(currentProviderId) === String(myId);
                            const isUnassignedInMyDept = isCurrentlyInMyDept && (!currentProviderId || String(currentProviderId) === 'unassigned');
                            const isAssignedToSomeoneElseInMyDept = isCurrentlyInMyDept && !isAssignedToMe && !isUnassignedInMyDept;

                            if (!isCurrentlyInMyDept && !isAssignedToMe && (statusLower === 'transfered' || statusLower === 'transferred')) {
                                return <span className="text-[#7b1fa2] text-xs font-medium">⇄ Transferred Away</span>;
                            }

                            if (isAssignedToSomeoneElseInMyDept) {
                                return (
                                    <div className="flex items-center gap-2">
                                      <span className="text-blue-600 font-bold text-xs uppercase px-3 py-1.5 bg-blue-50 border border-blue-200 rounded shadow-sm">
                                        Assigned
                                      </span>
                                      <button 
                                        onClick={(e) => { 
                                          e.preventDefault(); e.stopPropagation(); 
                                          setTransferVisitor(visitor); setShowTransferModal(true); 
                                        }} 
                                        className="flex items-center justify-center gap-1 h-8 w-24 bg-[#7b1fa2] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#6a1b9a] transition-colors shadow-sm"
                                      >
                                        <FiArrowRightCircle className="w-3 h-3" /> Transfer
                                      </button>
                                    </div>
                                );
                            }

                            return (
                              <div className="flex items-center gap-2">
                                <button 
                                  type="button"
                                  // 👉 FIXED: Serve sets In Progress using the direct Auth Context, avoiding the lookup bug completely
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const now = new Date().toISOString();
                                    
                                    setVisitors(prev => prev.map(v => 
                                      (v._id || v.id) === (visitor._id || visitor.id) 
                                        ? { ...v, services_status: [...(v.services_status || []).filter((s:any)=> String(s.provider_id) !== myId), { provider_id: myId, provider_name: myName, s_type: 'Inprogress' }] }
                                        : v
                                    ));
                                    
                                    await updateBackendStatus('Inprogress', visitor._id || visitor.id || '', visitor, myId, myName, true);
                                    
                                    setServingVisitor(visitor);
                                    setPendingServiceStartTime(now);
                                    setShowServeModal(true);
                                    
                                    loadData(currentPage, searchTerm, true);
                                  }}
                                  className="h-8 w-20 bg-[#1a73e8] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#1558c0] transition-colors flex items-center justify-center gap-1 shadow-sm"
                                >
                                  Serve
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setTransferVisitor(visitor);
                                    setShowTransferModal(true);
                                  }}
                                  className="h-8 w-24 bg-[#7b1fa2] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#6a1b9a] transition-colors flex items-center justify-center gap-1 shadow-sm"
                                >
                                  <FiArrowRightCircle className="w-3 h-3" /> Transfer
                                </button>
                              </div>
                            );
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
                Showing {((currentPage - 1) * itemsPerPage) + (paginatedDashboard.length > 0 ? 1 : 0)} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => loadData(Math.max(1, currentPage - 1), searchTerm, false)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors font-medium"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(totalDashboardPages, 5) }, (_, i) => {
                  let page = i + 1;
                  if (totalDashboardPages > 5 && currentPage > 3) {
                    page = currentPage - 2 + i;
                    if (page > totalDashboardPages) return null;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => loadData(page, searchTerm, false)}
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
                  onClick={() => loadData(Math.min(totalDashboardPages, currentPage + 1), searchTerm, false)}
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

      {/* Serve Visitor Modal */}
      {showServeModal && servingVisitor && (
        <ServeVisitorModal
          isOpen={showServeModal}
          onClose={() => {
            setShowServeModal(false);
            setServingVisitor(null);
            setPendingServiceStartTime('');
            loadData(currentPage, searchTerm, true);
          }}
          visitor={{
            name: getVisitorName(servingVisitor),
            id: servingVisitor._id || servingVisitor.id || '',
            email: servingVisitor.email || servingVisitor.telephone || '',
            service: servingVisitor.service || 'General Service',
            checkInTime: servingVisitor.entry_date 
              ? new Date(servingVisitor.entry_date).toLocaleString('en-US', { 
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                })
              : 'Just now',
            gate: 'Main Gate',
            status: getVisitorStatus(servingVisitor),
            serviceStartTime: pendingServiceStartTime || getServiceStartTime(servingVisitor),
            departmentName: getDepartmentName(servingVisitor)
          }}
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
                    setTransferEmployees([]);
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
                    .filter(d => String(d._id) !== String(departmentId))
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
                        <option value="">Any employee in department</option>
                        {transferEmployees.map(emp => {
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

      {/* OTHER TABS */}
      {activeTab === 'status' && <div className="text-center py-8 text-gray-500">Service Status Tracking Content</div>}
      {activeTab === 'employees' && <div className="text-center py-8 text-gray-500">Employee Management Content</div>}
      {activeTab === 'by-department' && <div className="text-center py-8 text-gray-500">Visitors By Department Content</div>}
      {activeTab === 'by-provider' && <div className="text-center py-8 text-gray-500">Visitors By Provider Content</div>}
      {activeTab === 'availability' && <DepartmentAvailabilityTab departmentId={departmentId} />}
      {activeTab === 'reports' && <ReportsTab departmentId={departmentId} departmentName={departmentName} />}
    </div>
  );
};

export default DepartmentManagerDashboard;