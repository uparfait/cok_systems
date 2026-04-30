// Department Manager Dashboard - MainLayout Compatible + Backend APIs
// Exact Figma Design Implementation.

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiSearch, FiUser, FiUsers, FiCheckCircle, FiX, FiTrendingUp, FiMessageSquare,
  FiClock, FiRefreshCw, FiPlus, FiEye, FiEdit, FiArrowRightCircle, FiSquare, FiFileText, FiBriefcase
} from "react-icons/fi";

// Import API Services
import { serviceDeliveryService, employeeService, departmentService, departmentManagerService } from "../../../core/services/adminService";
import { useAuth } from "../../../core/contexts/AuthContext";
import { useSocket } from "../../../core/contexts/SocketContext";
import { useToast } from "../../../core/contexts/ToastContext";

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
import { ViewEmployeeModal, EditEmployeeModal } from "../components/departmentFlow/EmployeeModals"; // Removed DeleteEmployeeModal
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
  name?: string;
  email?: string;
  telephone?: string;
  phone?: string;
  role?: string;
  title?: string;
  gender?: string;
  status?: string;
  is_active?: boolean;
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
      const response: any = await employeeService.create({
        full_name: formData.full_name,
        email: formData.email,
        telephone: formData.telephone,
        title: formData.title,
        gender: formData.gender,
        department_id: formData.department_id,
        department_name: formData.department_name,
        roles: { role_name: 'department_employee', permissions: [] }
      });

      // MODIFICATION 4: Forgiving API check for create
      if (response && (response.success === true || response._id || response.data)) {
        onSuccess();
      } else if (response && response.success === false) {
        setError(response.message || 'Failed to create employee');
      } else if (response && response.error) {
        setError(response.error);
      } else {
        onSuccess(); // Fallback success
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

// RequestsTable component for pending/active/completed requests
interface RequestsTableProps {
  status: 'pending' | 'active' | 'completed';
  title: string;
  departmentId: string;
  departmentName: string;
  showError: (msg: string) => void;
  setSelectedActiveTask: (task: any) => void;
  setShowActiveTaskModal: (show: boolean) => void;
  setTransferVisitor: (visitor: any) => void;
  setShowTransferModal: (show: boolean) => void;
  showInfo: (msg: string) => void;
  getInitials: (name: string) => string;
}

const RequestsTable: React.FC<RequestsTableProps> = ({
  status,
  title,
  departmentId,
  departmentName,
  showError,
  setSelectedActiveTask,
  setShowActiveTaskModal,
  setTransferVisitor,
  setShowTransferModal,
  showInfo,
  getInitials
}) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [dateFilter, setDateFilter] = useState<string>('');

  const fetchRequests = async (currentPage: number = 1, filter: string = '') => {
    setLoading(true);
    try {
      const response = await departmentManagerService.getVisitorsByStatus(status, currentPage, 20, filter);
      if (response.success && response.data) {
        setRequests(response.data);
        setTotal(response.total || 0);
        setPage(currentPage);
      } else {
        setRequests([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error(`Failed to fetch ${status} requests:`, error);
      showError(`Failed to load ${status} requests`);
      setRequests([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests(1, dateFilter);
  }, [status]);

  const handleDateFilterChange = (filter: string) => {
    setDateFilter(filter);
    fetchRequests(1, filter);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-orange-700';
      case 'active': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="bg-white rounded-[14px] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white">
        <h2 className="text-[16px] font-bold text-blue-600 uppercase">{title}</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search requests..."
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-green-600 rounded-lg text-white text-sm font-medium hover:bg-green-700"
          >
            <FiSearch className="w-4 h-4" /> Search
          </button>
          <select
            value={dateFilter}
            onChange={(e) => handleDateFilterChange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="last_week">Last Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
          </select>
          <button
            onClick={() => fetchRequests(page, dateFilter)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0284C7] rounded-lg text-white text-sm font-medium hover:bg-[#0369A1]"
          >
            <FiRefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {loading ? (
          <div className="flex items-center justify-center p-8 min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading {status} requests...</p>
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex items-center justify-center p-8 min-h-[400px]">
            <div className="text-center text-gray-500">
              <FiFileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No {status} requests found</p>
              <p className="text-sm">There are currently no {status.toLowerCase()} visitor requests.</p>
            </div>
          </div>
        ) : (
          <table className="w-full min-w-[1000px] table-fixed">
            <thead className="bg-[#F8FAFC] sticky top-0 z-10">
              <tr>
                <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">VISITOR</th>
                <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">CONTACT</th>
                <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">DEPARTMENT</th>
                <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">PROVIDER</th>
                <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">ENTRY TIME</th>
                <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">STATUS</th>
                {status === 'active' && (
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">DURATION</th>
                )}
                {(status === 'pending' || status === 'active') && (
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">ACTION</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((request: any) => (
                <tr key={request._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs mr-3">
                        {request.full_name ? getInitials(request.full_name) : '?'}
                      </div>
                      <p className="text-sm font-semibold text-gray-800">{request.full_name || 'Unknown'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-sm text-gray-600">{request.telephone || '_____'}</p>
                    <p className="text-xs text-gray-400">{request.email || ''}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-sm text-gray-600">
                      {request.departments_assigned?.[0]?.department_name || 'Unknown'}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-sm text-gray-600">
                      {request.departments_assigned?.[0]?.provider_name || 'Unassigned'}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-sm text-gray-500">
                      {request.entry_date ? new Date(request.entry_date).toLocaleString() : 'N/A'}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(status)}`}>
                      {status === 'pending' ? 'Not Started' : status === 'active' ? 'In Progress' : 'Completed'}
                    </span>
                  </td>
                  {status === 'active' && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-[#e3f2fd] text-[#1a73e8]">
                        <FiClock className="w-3 h-3 animate-pulse" />
                        <LiveTimer startTime={request.entry_date} />
                      </span>
                    </td>
                  )}
                  {(status === 'pending' || status === 'active') && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {status === 'pending' && (
                        <button
                          onClick={() => {
                            setSelectedActiveTask(request);
                            setShowActiveTaskModal(true);
                          }}
                          className="flex items-center justify-center gap-1 h-8 w-20 bg-blue-600 text-white text-[12px] font-bold rounded-[6px] hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          Details
                        </button>
                      )}
                      {status === 'active' && (
                        <button
                          onClick={() => {
                            setTransferVisitor(request);
                            setShowTransferModal(true);
                            showInfo(`Preparing to transfer ${request.full_name || 'visitor'}...`);
                          }}
                          className="flex items-center justify-center gap-1 h-8 w-24 bg-[#7b1fa2] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#6a1b9a] transition-colors shadow-sm"
                        >
                          <FiArrowRightCircle className="w-3 h-3" /> Transfer
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="bg-white px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchRequests(page - 1, dateFilter)}
                disabled={page === 1 || loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors flex items-center gap-1"
              >
                {loading && (
                  <svg className="animate-spin h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                ← Previous
              </button>

              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-600">Page</span>
                <span className="px-3 py-1 bg-blue-50 text-blue-700 font-medium rounded">{page}</span>
              </div>

              <button
                onClick={() => fetchRequests(page + 1, dateFilter)}
                disabled={page * 20 >= total || loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors flex items-center gap-1"
              >
                Next →
                {loading && (
                  <svg className="animate-spin h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Departments Management Tab
const DepartmentsTab: React.FC<{ showError: (msg: string) => void; showSuccess: (msg: string) => void }> = ({ showError, showSuccess }) => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDepartment, setEditingDepartment] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const response = await departmentManagerService.getManagedDepartments();
      if (response.success && response.data) {
        setDepartments(response.data);
      } else {
        setDepartments([]);
      }
    } catch (error: any) {
      console.error('Failed to fetch departments:', error);
      showError('Failed to load departments');
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleUpdateDepartment = async (departmentId: string, updates: any) => {
    try {
      const response = await departmentManagerService.updateDepartment(departmentId, updates);
      if (response.success) {
        showSuccess('Department updated successfully');
        setShowEditModal(false);
        setEditingDepartment(null);
        fetchDepartments(); // Refresh the list
      } else {
        showError(response.message || 'Failed to update department');
      }
    } catch (error: any) {
      showError(error.message || 'Failed to update department');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Department Management</h1>
          <p className="text-gray-600 mt-1">Manage departments under your supervision</p>
        </div>
        <button
          onClick={fetchDepartments}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiRefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Departments Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-h-[600px] flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading departments...</p>
                </div>
              </div>
            ) : departments.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center text-gray-500">
                  <FiBriefcase className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No departments found</p>
                  <p className="text-sm">You are not assigned as a leader for any departments.</p>
                </div>
              </div>
            ) : (
              <>
                <table className="w-full min-w-[800px]">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department ID</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Response Time</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leader</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {departments.map((dept: any) => (
                      <tr key={dept._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{dept.department_name}</div>
                          <div className="text-sm text-gray-500">
                            {dept.sub_department_mng?.is_sub_department ? 'Sub-Department' : 'Main Department'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{dept.department_id}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {dept.department_response_time_in_minutes > 0
                              ? `${dept.department_response_time_in_minutes} minutes`
                              : 'Not set'
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {dept.department_leader?.full_name || 'Not assigned'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setEditingDepartment(dept);
                              setShowEditModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors text-xs font-medium"
                          >
                            Edit Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Fill remaining space to maintain fixed height */}
                <div className="flex-1 bg-white"></div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit Department Modal */}
      {showEditModal && editingDepartment && (
        <div className="fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Edit Department</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingDepartment(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Name</label>
                  <input
                    type="text"
                    defaultValue={editingDepartment.department_name}
                    onChange={(e) => {
                      editingDepartment.department_name = e.target.value;
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter department name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Response Time (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    defaultValue={editingDepartment.department_response_time_in_minutes || ''}
                    onChange={(e) => {
                      editingDepartment.department_response_time_in_minutes = parseInt(e.target.value) || 0;
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter response time in minutes"
                  />
                  <p className="text-xs text-gray-500 mt-1">Set to 0 to disable response time tracking</p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingDepartment(null);
                  }}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateDepartment(editingDepartment._id, {
                    department_name: editingDepartment.department_name,
                    department_response_time_in_minutes: editingDepartment.department_response_time_in_minutes
                  })}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Update Department
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Feedback Management Tab
const FeedbackTab: React.FC<{ showError: (msg: string) => void }> = ({ showError }) => {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [analytics, setAnalytics] = useState<any>({});
  const [dateFilter, setDateFilter] = useState<string>('');
  const [ratingFilter, setRatingFilter] = useState<number | ''>('');

  const fetchFeedback = async (currentPage: number = 1, dateFilter: string = '', rating: number | '' = '') => {
    setLoading(true);
    try {
      const response = await departmentManagerService.getDepartmentFeedback(currentPage, 20, dateFilter, rating || undefined);
      if (response.success && response.data) {
        setFeedback(response.data);
        setTotal(response.total || 0);
        setAnalytics(response.analytics || {});
        setPage(currentPage);
      } else {
        setFeedback([]);
        setTotal(0);
        setAnalytics({});
      }
    } catch (error: any) {
      console.error('Failed to fetch feedback:', error);
      showError('Failed to load feedback');
      setFeedback([]);
      setTotal(0);
      setAnalytics({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback(1, dateFilter, ratingFilter);
  }, []);

  const handleFiltersChange = () => {
    fetchFeedback(1, dateFilter, ratingFilter);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return 'text-green-600';
    if (rating >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRatingStars = (rating: number) => {
    return '★'.repeat(rating) + '☆'.repeat(10 - rating);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feedback & Analytics</h1>
          <p className="text-gray-600 mt-1">Monitor feedback and performance metrics for your departments</p>
        </div>
        <button
          onClick={() => fetchFeedback(page, dateFilter, ratingFilter)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiRefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Analytics Cards */}
      {analytics.average_rating && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-800">{analytics.average_rating?.toFixed(1) || '0.0'}</p>
                <p className="text-sm text-gray-600 mt-1">Average Rating</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <FiMessageSquare className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-800">{analytics.total_feedback || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Total Feedback</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FiTrendingUp className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {analytics.average_rating >= 8 ? 'Excellent' :
                   analytics.average_rating >= 6 ? 'Good' : 'Needs Improvement'}
                </p>
                <p className="text-sm text-gray-600 mt-1">Performance Status</p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                analytics.average_rating >= 8 ? 'bg-green-100' :
                analytics.average_rating >= 6 ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                <FiMessageSquare className={`w-6 h-6 ${
                  analytics.average_rating >= 8 ? 'text-green-500' :
                  analytics.average_rating >= 6 ? 'text-yellow-500' : 'text-red-500'
                }`} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Date</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Rating</label>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value ? parseInt(e.target.value) : '')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Ratings</option>
              <option value="10">5 Stars (Excellent)</option>
              <option value="8">4 Stars (Good)</option>
              <option value="6">3 Stars (Average)</option>
              <option value="4">2 Stars (Poor)</option>
              <option value="2">1 Star (Very Poor)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleFiltersChange}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Table */}
      <div className="bg-white rounded-[14px] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {loading ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading feedback...</p>
                </div>
              </div>
            ) : feedback.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center text-gray-500">
                  <FiMessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No feedback found</p>
                  <p className="text-sm">There is no feedback available for your departments.</p>
                </div>
              </div>
            ) : (
              <>
                <table className="w-full min-w-[1000px] table-fixed">
                  <thead className="bg-[#F8FAFC] sticky top-0 z-10">
                    <tr>
                      <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">VISITOR</th>
                      <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">DEPARTMENT</th>
                      <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">RATING</th>
                      <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">FEEDBACK</th>
                      <th className="text-left text-xs font-bold text-gray-500 uppercase px-4 py-3">DATE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {feedback.map((item: any) => (
                      <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs mr-3">
                              {(item.user_name || 'Unknown').charAt(0).toUpperCase()}
                            </div>
                            <p className="text-sm font-semibold text-gray-800">{item.user_name || 'Anonymous'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-sm text-gray-600">{item.department_name || 'Unknown'}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${getRatingColor(item.rate)}`}>
                              {getRatingStars(item.rate)}
                            </span>
                            <span className="text-sm text-gray-600">({item.rate}/10)</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="text-sm text-gray-900 max-w-xs truncate cursor-pointer hover:text-blue-600"
                            onClick={() => {
                              alert(`Feedback Details:\n\n${item.textmessage || 'No feedback message'}\n\nRating: ${item.rate}/10\nDate: ${item.created_date ? new Date(item.created_date).toLocaleDateString() : 'Unknown'}`);
                            }}
                          >
                            {item.textmessage || 'No feedback message'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-sm text-gray-500">
                            {item.created_date ? new Date(item.created_date).toLocaleDateString() : 'Unknown'}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Fill remaining space to maintain fixed height */}
                <div className="flex-1 bg-white"></div>
              </>
            )}
          </div>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="bg-white px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchFeedback(page - 1, dateFilter, ratingFilter)}
                  disabled={page === 1 || loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors flex items-center gap-1"
                >
                  {loading && (
                    <svg className="animate-spin h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  ← Previous
                </button>

                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-600">Page</span>
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 font-medium rounded">{page}</span>
                </div>

                <button
                  onClick={() => fetchFeedback(page + 1, dateFilter, ratingFilter)}
                  disabled={page * 20 >= total || loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors flex items-center gap-1"
                >
                  Next →
                  {loading && (
                    <svg className="animate-spin h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
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

      const response: any = await employeeService.update(empId, {
        full_name: formData.full_name,
        email: formData.email,
        telephone: formData.telephone,
        title: formData.title,
        gender: formData.gender
      });

      // MODIFICATION 4: Forgiving API check for update
      if (response && (response.success === true || response._id || response.data)) {
        onSuccess();
      } else if (response && response.success === false) {
        setError(response.message || 'Failed to update employee');
      } else if (response && response.error) {
        setError(response.error);
      } else {
        onSuccess(); // Fallback success
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

            {/* MODIFICATION 1: Email field disabled, grayed out, read-only */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed focus:outline-none"
              />
               <p className="text-xs text-gray-400 mt-1 italic">Email cannot be changed after creation.</p>
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
  const { socket, isConnected } = useSocket();
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  const departmentId = user?.departmentId || user?.department_id || '';
  const departmentName = user?.departmentName || user?.department_name || '';
  
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'departments' | 'feedback' | 'by-department' | 'by-provider' | 'availability' | 'active-tasks' | 'completed-requests'>('dashboard');

  // Function to update both activeTab and URL
  const navigateToTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [allDepartmentVisitors, setAllDepartmentVisitors] = useState<Visitor[]>([]);
  const [pendingServiceStartTime, setPendingServiceStartTime] = useState<string>('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [backendTotal, setBackendTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [serviceStatusSearch, setServiceStatusSearch] = useState("");
  const [serviceStatusFilter, setServiceStatusFilter] = useState("all");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState('all');

  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showViewEmployeeModal, setShowViewEmployeeModal] = useState(false);
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  // MODIFICATION 3: Removed showDeleteEmployeeModal state completely
  const [selectedDeptEmployee, setSelectedDeptEmployee] = useState<Employee | null>(null);

  // Active tasks modal
  const [showActiveTaskModal, setShowActiveTaskModal] = useState(false);
  const [selectedActiveTask, setSelectedActiveTask] = useState<any>(null);

  // Sub-departments for transfer
  const [subDepartments, setSubDepartments] = useState<any[]>([]);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);
  const [selectedSubDepartment, setSelectedSubDepartment] = useState<string>('');

  const [showServeModal, setShowServeModal] = useState(false);
  const [servingVisitor, setServingVisitor] = useState<Visitor | null>(null);
  const [servingEmployee, setServingEmployee] = useState<Employee | null>(null);
  const [employeeServiceCount, setEmployeeServiceCount] = useState<Record<string, number>>({});
  
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferVisitor, setTransferVisitor] = useState<Visitor | null>(null);
  const [transferDepartment, setTransferDepartment] = useState<string>('');
  const [transferEmployee, setTransferEmployee] = useState<Employee | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferEmployees, setTransferEmployees] = useState<Employee[]>([]);
  const [transferEmployeesLoading, setTransferEmployeesLoading] = useState(false);

  // Employee pagination state
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [employeeLoading, setEmployeeLoading] = useState(false);

  // Dashboard statistics state
  const [dashboardStats, setDashboardStats] = useState({
    pending: 0,
    active: 0,
    transferred: 0,
    completed: 0,
    totalEmployees: 0,
    totalFeedback: 0,
    averageRating: 0
  });
  const [dashboardLoading, setDashboardLoading] = useState(false);
  
  const [visitorsByDepartment, setVisitorsByDepartment] = useState<any[]>([]);
  const [visitorsByProvider, setVisitorsByProvider] = useState<any[]>([]);
  const [loadingByFilters, setLoadingByFilters] = useState(false);

  // Active tasks state (for Head of Department)
  const [activeTasks, setActiveTasks] = useState<any[]>([]);
  const [activeTasksLoading, setActiveTasksLoading] = useState(false);
  const [activeTasksPage, setActiveTasksPage] = useState(1);
  const [activeTasksTotal, setActiveTasksTotal] = useState(0);
  const [activeTasksSearch, setActiveTasksSearch] = useState('');

  useEffect(() => {
    const tab = searchParams.get('tab');
    const validTabs: Array<'dashboard' | 'employees' | 'departments' | 'feedback' | 'by-department' | 'by-provider' | 'availability' | 'active-tasks' | 'completed-requests'> =
      ['dashboard', 'employees', 'departments', 'feedback', 'by-department', 'by-provider', 'availability', 'active-tasks', 'completed-requests'];
    if (tab && validTabs.includes(tab as any)) {
      setActiveTab(tab as any);
    } else {
      setActiveTab('dashboard');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dashboardStatusFilter]);

  // Fetch active tasks when tab changes to active-tasks
  useEffect(() => {
    if (activeTab === 'active-tasks') {
      showInfo('Loading active tasks...');
      fetchActiveTasks(1, activeTasksSearch);
    }
  }, [activeTab]);

  // Fetch employees when tab changes to employees
  useEffect(() => {
    if (activeTab === 'employees') {
      showInfo('Loading employees...');
      fetchEmployees(1, employeeSearch);
    }
  }, [activeTab]);

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    setDashboardLoading(true);
    try {
      // Fetch statistics from all status endpoints
      const [pendingRes, activeRes, transferredRes, completedRes, feedbackRes] = await Promise.all([
        departmentManagerService.getVisitorsByStatus('pending', 1, 1), // Just get count
        departmentManagerService.getVisitorsByStatus('active', 1, 1),
        departmentManagerService.getVisitorsByStatus('transferred', 1, 1),
        departmentManagerService.getVisitorsByStatus('completed', 1, 1),
        departmentManagerService.getDepartmentFeedback(1, 1)
      ]);

      setDashboardStats({
        pending: pendingRes.total || 0,
        active: activeRes.total || 0,
        transferred: transferredRes.total || 0,
        completed: completedRes.total || 0,
        totalEmployees: employeeTotal, // This will be updated when employees are loaded
        totalFeedback: feedbackRes.total || 0,
        averageRating: feedbackRes.analytics?.average_rating || 0
      });
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      // Keep existing stats on error
    } finally {
      setDashboardLoading(false);
    }
  };

  // Fetch dashboard stats when dashboard tab is active
  useEffect(() => {
    if (activeTab === 'dashboard' && user?.role === 'Head of department') {
      fetchDashboardStats();
      // Also fetch employee count for the dashboard display
      fetchEmployees(1, '', true); // true = silent mode, no loading indicators
    }
  }, [activeTab, user]);

  // WebSocket listeners for real-time employee and visitor updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleUserStatusUpdate = (data: any) => {
      if (activeTab === 'employees' && data?.user_id) {
        // Silently refresh employee data to show updated status
        fetchEmployees(employeePage, employeeSearch, true); // true = silent mode
      }
    };

    const handleNewVisitorAssigned = (data: any) => {
      if (activeTab === 'employees') {
        // Silently refresh employee data when visitors are assigned (might affect workload/assignments)
        fetchEmployees(employeePage, employeeSearch, true); // true = silent mode
      }
    };

    socket.on('active_user', handleUserStatusUpdate);
    socket.on('inactive_user', handleUserStatusUpdate);
    socket.on('new_visitor_assigned', handleNewVisitorAssigned);

    return () => {
      socket.off('active_user', handleUserStatusUpdate);
      socket.off('inactive_user', handleUserStatusUpdate);
      socket.off('new_visitor_assigned', handleNewVisitorAssigned);
    };
  }, [socket, isConnected, activeTab, employeePage, employeeSearch]);

  const handleEmployeeSearch = async () => {
    setIsLoading(true);
    try {
      let response: any;
      if (employeeSearch && employeeSearch.trim()) {
        response = await employeeService.search(employeeSearch.trim());
      } else {
        response = await employeeService.getAll();
      }
      
      if (Array.isArray(response)) {
        setEmployees(response);
      } else if (response && response.data) {
        setEmployees(Array.isArray(response.data) ? response.data : [response.data]);
      } else if (response && response.success && Array.isArray(response.employees)) {
        setEmployees(response.employees);
      } else {
        setEmployees([]);
      }
    } catch (error: any) {
      console.error('Error searching employees:', error);
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

  const fetchActiveTasks = async (page: number = 1, search: string = '') => {
    setActiveTasksLoading(true);
    try {
      const response = await serviceDeliveryService.getActiveTasks(page, 10, search);
      if (response.success && response.data) {
        setActiveTasks(response.data);
        setActiveTasksTotal(response.total || 0);
        setActiveTasksPage(page);

        // Show success toast only if it's not the initial load
        if (page > 1 || search) {
          showSuccess(`Found ${response.total || 0} active tasks`);
        }
      } else {
        setActiveTasks([]);
        setActiveTasksTotal(0);
        if (page > 1 || search) {
          showWarning('No active tasks found');
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch active tasks:', error);
      const errorMessage = error?.message || 'Failed to load active tasks';
      showError(errorMessage);
      setActiveTasks([]);
      setActiveTasksTotal(0);
    } finally {
      setActiveTasksLoading(false);
    }
  };

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
    if (!silent) setFirstLoad(true);
    setCurrentPage(page);
    try {
      let visitorRes;
      let allVisitorsRes;
      let empRes: any;
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
      
      if (Array.isArray(empRes)) {
        setEmployees(empRes);
      } else if (empRes && empRes.data) {
        setEmployees(Array.isArray(empRes.data) ? empRes.data : [empRes.data]);
      } else if (empRes && empRes.success && Array.isArray(empRes.employees)) {
        setEmployees(empRes.employees);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      if (!silent) setIsLoading(false);
      if (!silent) setFirstLoad(false);
    }
  };

  useEffect(() => {
    loadData(1, '', false);
  }, []);

  // Listen for new visitor assigned to department event
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewVisitorAssigned = (data: any) => {
      console.log('New visitor assigned to department:', data);
      // Refresh visitor list when a new visitor is assigned to this department
      if (data?.message) {
        // Show notification or toast if needed
        console.log('Notification:', data.message);
      }
      // Reload visitors data
      loadData(1, '', true);
    };

    socket.on('new_visitor_assigned_to_your_department', handleNewVisitorAssigned);

    // Also listen for general new_visitor_assigned events
    const handleNewVisitorAssignedGeneral = (data: any) => {
      console.log('New visitor assigned (general):', data);
      // Silently refresh visitor data when any new visitor is assigned
      loadData(currentPage, searchTerm, true); // true = silent refresh
    };

    socket.on('new_visitor_assigned', handleNewVisitorAssignedGeneral);

    return () => {
      socket.off('new_visitor_assigned_to_your_department', handleNewVisitorAssigned);
      socket.off('new_visitor_assigned', handleNewVisitorAssignedGeneral);
    };
  }, [socket, isConnected]);

  const getVisitorName = (v: Visitor) => v.full_name || v.name || 'Unknown';
  const getIdentification = (v: Visitor) => {
    if (!v.identification) return '_____';
    if (typeof v.identification === 'string') return v.identification;
    return v.identification.number || '_____';
  };
  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    let formatted =  parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
    return formatted;
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
        const latestProviderId = typeof latestAssignment.provider_id === 'object' ? (latestAssignment.provider_id as any)?._id : latestAssignment.provider_id;
        const latestDeptId = typeof latestAssignment.department_id === 'object' ? (latestAssignment.department_id as any)?._id : latestAssignment.department_id;

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
    const deptInfo = rawVisitor.departments_assigned?.find((d: any) => String(d.provider_id) === empId) || 
                     rawVisitor.services_status?.find((s: any) => String(s.provider_id) === empId);
    
    const updatedServicesStatus = (rawVisitor.services_status || []).filter((s: any) => String(s.provider_id) !== String(empId));
    updatedServicesStatus.push({
      department_id: deptInfo?.department_id || departmentId || "",
      department_name: deptInfo?.department_name || departmentName || "General",
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

    await serviceDeliveryService.updateServiceStatus({
      visitor_id: visitorId,
      services_status: updatedServicesStatus,
      durations: { ...currentDurations, services_durations: updatedServiceDurations }
    });
  };

  const handleServiceEnd = async (data: { duration: string; startTime: string; endTime: string; notes: string }) => {
    if (!servingVisitor) return; 

    try {
      const visitorId = servingVisitor._id || servingVisitor.id;
      
      const currentUser = user as any;
      const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || '');
      const myName = String(currentUser?.full_name || currentUser?.fullName || currentUser?.name || 'Unknown');
      
      const assigned = getAssignedEmployee(servingVisitor);
      const empId = assigned?.id || myId;
      const empName = assigned?.name || myName;
      
      const isTransfer = data.notes && data.notes.toLowerCase().includes('transfer');
      const targetStatus = isTransfer ? 'Transfered' : 'Completed';
      
      const visitorToUpdate = servingVisitor;
      
      setVisitors(prev => prev.map(v => {
        if (String(v._id || v.id) === String(visitorId)) {
            const newStatus = [...(v.services_status || [])];
            const myIdx = newStatus.findIndex(s => String(s.provider_id) === String(empId));
            if (myIdx !== -1) {
                newStatus[myIdx] = { ...newStatus[myIdx], s_type: targetStatus };
            } else {
                newStatus.push({ department_id: departmentId || "", provider_id: empId, provider_name: empName, s_type: targetStatus });
            }
            return { ...v, services_status: newStatus };
        }
        return v;
      }));

      setShowServeModal(false);
      setServingVisitor(null);
      setPendingServiceStartTime('');

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

  // Fetch employees with pagination and search
  const fetchEmployees = async (page: number = 1, search: string = '', silent: boolean = false) => {
    if (!silent) setEmployeeLoading(true);
    try {
      // Always use backend search API (with empty search for all employees)
      const searchQuery = search && search.trim() ? search.trim() : '';
      const response = await employeeService.search(searchQuery, page, 20);
      if (response.success && response.data) {
        setEmployees(response.data);
        setEmployeeTotal(response.total || 0);
        setEmployeePage(page);

        // Update dashboard stats with employee count
        setDashboardStats(prev => ({
          ...prev,
          totalEmployees: response.total || 0
        }));

        // Show success toast only if it's not the initial load and not silent
        if (!silent && (page > 1 || search)) {
          showSuccess(`Found ${response.total || 0} employees`);
        }
      } else {
        setEmployees([]);
        setEmployeeTotal(0);
      }
    } catch (error: any) {
      console.error('Failed to fetch employees:', error);
      if (!silent) {
        const errorMessage = error?.message || 'Failed to load employees';
        showError(errorMessage);
      }
      setEmployees([]);
      setEmployeeTotal(0);
    } finally {
      if (!silent) setEmployeeLoading(false);
    }
  };

  const handleTransferDepartmentChange = async (deptId: string) => {
    setTransferDepartment(deptId);
    setTransferEmployee(null);
    setSelectedSubDepartment('');
    setSubDepartments([]);

    if (deptId) {
      try {
        // Show loading toast
        showInfo('Loading department details...', 1500);

        // Fetch sub-departments for the selected department
        setLoadingSubDepartments(true);
        const subDeptResponse = await departmentService.getSubDepartments(deptId);
        if (subDeptResponse.success && subDeptResponse.data) {
          setSubDepartments(Array.isArray(subDeptResponse.data) ? subDeptResponse.data : []);
        }

        // Fetch employees for the main department initially
        await loadEmployeesForTarget(deptId);

        // Show success toast
        showSuccess('Department details loaded successfully');
      } catch (error: any) {
        console.error('Failed to fetch department data:', error);
        const errorMessage = error?.message || 'Failed to load department details';
        showError(errorMessage);
        setTransferEmployees([]);
        setSubDepartments([]);
      } finally {
        setLoadingSubDepartments(false);
      }
    } else {
      setTransferEmployees([]);
      setSubDepartments([]);
      setTransferEmployeesLoading(false);
    }
  };

  // Load employees for either department or sub-department/unit
  const loadEmployeesForTarget = async (targetId: string) => {
    setTransferEmployeesLoading(true);
    try {
      const empResponse = await employeeService.getByDepartment(targetId, false);
      if (empResponse.success && empResponse.data) {
        setTransferEmployees(Array.isArray(empResponse.data) ? empResponse.data : [empResponse.data]);
      } else {
        setTransferEmployees([]);
      }
    } catch (error: any) {
      console.error('Failed to fetch employees:', error);
      showError('Failed to load employees');
      setTransferEmployees([]);
    } finally {
      setTransferEmployeesLoading(false);
    }
  };

  // Handle sub-department/unit selection
  const handleSubDepartmentChange = async (subDeptId: string) => {
    setSelectedSubDepartment(subDeptId);
    setTransferEmployee(null);

    if (subDeptId) {
      // Load employees for the specific sub-department/unit
      showInfo('Loading unit employees...', 1000);
      await loadEmployeesForTarget(subDeptId);
    } else {
      // Load employees for the main department
      await loadEmployeesForTarget(transferDepartment);
    }
  };

  const handleTransferVisitor = async () => {
    if (!transferVisitor || !transferDepartment) return;
    setTransferring(true);

    // Show loading toast
    showInfo('Transferring visitor...', 2000);

    try {
      const currentUser = user as any;
      const myId = String(
        currentUser?.userId ||
          currentUser?._id ||
          currentUser?.id ||
          currentUser?.employee_id ||
          "",
      );

      // Determine target: sub-department/unit if selected, otherwise main department
      const targetId = selectedSubDepartment || transferDepartment;
      const targetInfo = selectedSubDepartment
        ? subDepartments.find((d) => d._id === selectedSubDepartment) || departments.find((d) => d._id === selectedSubDepartment)
        : departments.find((d) => d._id === transferDepartment);
      const targetName = targetInfo?.department_name || targetInfo?.name || "Unknown";

      // Find current department assignment for this visitor
      const currentDept = transferVisitor.departments_assigned?.find(
        (d: any) => String(d.provider_id) === myId || String(d.department_id) === departmentId,
      );
      const previousDepartmentId = currentDept?.department_id || departmentId;

      // Only assign specific provider if employee selected
      const providerId = transferEmployee
        ? String(transferEmployee._id || transferEmployee.employee_id || "")
        : undefined;
      const providerName = transferEmployee
        ? String(transferEmployee.full_name || "")
        : undefined;

      // Update local state for active tasks (if on active tasks tab)
      if (activeTab === 'active-tasks') {
        setActiveTasks(prev => prev.filter(task => task._id !== transferVisitor._id));
      }

      await serviceDeliveryService.assignToDepartment(
        String(transferVisitor._id || transferVisitor.id),
        targetId,
        targetName,
        providerId,
        providerName,
        previousDepartmentId,
      );

      // Show success toast
      showSuccess(`Visitor successfully transferred to ${targetName}${providerName ? ` (${providerName})` : ''}`);

      setShowTransferModal(false);
      setTransferVisitor(null);
      setTransferDepartment('');
      setTransferEmployee(null);
      setTransferEmployees([]);
      setSelectedSubDepartment('');
      setSubDepartments([]);

      // Refresh data based on current tab
      if (activeTab === 'active-tasks') {
        fetchActiveTasks(activeTasksPage, activeTasksSearch);
      } else {
        loadData(currentPage, searchTerm, true);
      }
    } catch (error: any) {
      console.error('Failed to transfer visitor:', error);

      // Show error toast with backend message
      const errorMessage = error?.message || 'Failed to transfer visitor. Please try again.';
      showError(errorMessage);

      // Refresh data on error
      if (activeTab === 'active-tasks') {
        fetchActiveTasks(activeTasksPage, activeTasksSearch);
      } else {
        loadData(currentPage, searchTerm, true);
      }
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">


            <div
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigateToTab('active-tasks')}
            >
              <div className="flex items-start justify-between">
                <div>
                  {dashboardLoading ? (
                    <div className="h-9 w-16 bg-gray-200 rounded animate-pulse mt-2"></div>
                  ) : (
                    <p className="text-3xl font-bold text-gray-800">{dashboardStats.active}</p>
                  )}
                  <p className="text-sm text-blue-600 mt-1">Active Tasks</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FiRefreshCw className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </div>



            <div
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigateToTab('completed-requests')}
            >
              <div className="flex items-start justify-between">
                <div>
                  {dashboardLoading ? (
                    <div className="h-9 w-16 bg-gray-200 rounded animate-pulse mt-2"></div>
                  ) : (
                    <p className="text-3xl font-bold text-gray-800">{dashboardStats.completed}</p>
                  )}
                  <p className="text-sm text-green-600 mt-1">Completed Requests</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <FiCheckCircle className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </div>
          </div>

          {/* ADDITIONAL METRICS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigateToTab('active-tasks')}
            >
              <div className="flex items-start justify-between">
                <div>
                  {dashboardLoading ? (
                    <div className="h-9 w-16 bg-gray-200 rounded animate-pulse mt-2"></div>
                  ) : (
                    <p className="text-3xl font-bold text-gray-800">{employeeTotal}</p>
                  )}
                  <p className="text-sm text-indigo-600 mt-1">Total Employees</p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <FiUsers className="w-6 h-6 text-indigo-500" />
                </div>
              </div>
            </div>



            <div
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigateToTab('feedback')}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      {dashboardLoading ? (
                        <div className="h-9 w-16 bg-gray-200 rounded animate-pulse mt-2"></div>
                      ) : (
                        <p className="text-3xl font-bold text-gray-800">{dashboardStats.totalFeedback}</p>
                      )}
                      <p className="text-sm text-pink-600 mt-1">Total Feedback</p>
                    </div>
                    <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                      <FiMessageSquare className="w-6 h-6 text-pink-500" />
                    </div>
                  </div>
                  {!dashboardLoading && dashboardStats.averageRating > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      Avg Rating: {dashboardStats.averageRating.toFixed(1)}/10
                    </div>
                  )}
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

      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        <table className="w-full min-w-[1000px] table-fixed">
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
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs mr-3">
                              {getInitials(getVisitorName(visitor))}
                            </div>
                            <p className="text-sm font-semibold text-gray-800">{getVisitorName(visitor)}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-sm text-gray-600">{visitor.telephone || '_____'}</p>
                          <p className="text-xs text-gray-400">{visitor.email || ''}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap"><p className="text-sm text-gray-600">{getIdentification(visitor) || visitor.badge_number || '_____'}</p></td>
                        <td className="px-4 py-3 whitespace-nowrap">
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
                        <td className="px-4 py-3 whitespace-nowrap">
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
                        <td className="px-4 py-3 whitespace-nowrap">
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
                        <td className="px-4 py-3 whitespace-nowrap">
                          {(() => {
                            const currentUser = user as any;
                            const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || '');
                            const myName = String(currentUser?.full_name || currentUser?.fullName || currentUser?.name || 'Unknown');
                            const status = getVisitorStatus(visitor);
                            const statusLower = status.toLowerCase();

                            if (statusLower === 'completed') {
                              return <span className="text-[#34a853] text-xs font-medium">✓ Completed</span>;
                            }

                            if (statusLower === 'inprogress') {
                              // Head of Department can only transfer, not serve/stop
                              if (user?.role === 'Head of department') {
                                return (
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
                                );
                              }

                              return (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const assigned = getAssignedEmployee(visitor);
                                      const emp = employees.find(e => e.full_name === assigned?.name) || employees[0];
                                      setServingVisitor(visitor);
                                      setServingEmployee(emp || null);
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
                            
                            const currentDeptId = currentAssignment ? (typeof currentAssignment.department_id === 'object' && currentAssignment.department_id ? (currentAssignment.department_id as any)?._id : currentAssignment.department_id) : null;
                            const currentProviderId = currentAssignment ? (typeof currentAssignment.provider_id === 'object' && currentAssignment.provider_id ? (currentAssignment.provider_id as any)?._id : currentAssignment.provider_id) : null;

                            const isCurrentlyInMyDept = currentAssignment && String(currentDeptId) === String(departmentId);
                            const isAssignedToMe = currentAssignment && String(currentProviderId) === String(myId);
                            const isUnassignedInMyDept = isCurrentlyInMyDept && (!currentProviderId || String(currentProviderId) === 'unassigned');
                            const isAssignedToSomeoneElseInMyDept = isCurrentlyInMyDept && !isAssignedToMe && !isUnassignedInMyDept;

                            if (!isCurrentlyInMyDept && !isAssignedToMe && (statusLower === 'transfered' || statusLower === 'transferred')) {
                                return <span className="text-[#7b1fa2] text-xs font-medium">⇄ Transferred Away</span>;
                            }

                            if (isAssignedToSomeoneElseInMyDept) {
                                // Head of Department can only transfer
                                if (user?.role === 'Head of department') {
                                  return (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault(); e.stopPropagation();
                                        setTransferVisitor(visitor); setShowTransferModal(true);
                                      }}
                                      className="flex items-center justify-center gap-1 h-8 w-24 bg-[#7b1fa2] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#6a1b9a] transition-colors shadow-sm"
                                    >
                                      <FiArrowRightCircle className="w-3 h-3" /> Transfer
                                    </button>
                                  );
                                }

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

                            // Head of Department can only transfer, not serve
                            if (user?.role === 'Head of department') {
                              return (
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
                              );
                            }

                            return (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
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
                  disabled={currentPage === 1 || isLoading}
                  className="px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors font-medium flex items-center gap-1"
                >
                  {isLoading && (
                    <svg className="animate-spin h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
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
                  disabled={currentPage === totalDashboardPages || totalDashboardPages === 0 || isLoading}
                  className="px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors font-medium flex items-center gap-1"
                >
                  Next
                  {isLoading && (
                    <svg className="animate-spin h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* COMPLETED REQUESTS TAB - Only for Head of Department */}
      {activeTab === 'completed-requests' && user?.role === 'Head of department' && (
        <RequestsTable
          status="completed"
          title="Completed Requests"
          departmentId={departmentId}
          departmentName={departmentName}
          showError={showError}
          setSelectedActiveTask={setSelectedActiveTask}
          setShowActiveTaskModal={setShowActiveTaskModal}
          setTransferVisitor={setTransferVisitor}
          setShowTransferModal={setShowTransferModal}
          showInfo={showInfo}
          getInitials={getInitials}
        />
      )}

      {/* DEPARTMENTS MANAGEMENT TAB - Only for Head of Department */}
      {activeTab === 'departments' && user?.role === 'Head of department' && (
        <DepartmentsTab showError={showError} showSuccess={showSuccess} />
      )}

      {/* FEEDBACK MANAGEMENT TAB - Only for Head of Department */}
      {activeTab === 'feedback' && user?.role === 'Head of department' && (
        <FeedbackTab showError={showError} />
      )}

      {/* EMPLOYEE MANAGEMENT TAB */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
            <h2 className="text-[16px] font-bold text-blue-600 uppercase">Employee Management</h2>
          </div>
          <div className="backdrop-blur-xl bg-white/80 rounded-2xl shadow-lg border border-white/30 p-3 mx-4 mt-2">
            <div className="flex flex-col md:flex-row gap-3 items-center">
              <div className="flex-1 flex gap-2 w-full">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                  {/* MODIFICATION 2: ID placeholder added */}
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && fetchEmployees(1, employeeSearch)}
                    placeholder="Search employees by name, email, or ID number..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200/50 rounded-lg bg-white/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm"
                  />
                </div>
                <button
                  onClick={() => fetchEmployees(1, employeeSearch)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 shadow-md transition-all"
                >
                  <FiSearch className="w-4 h-4" />
                  Search
                </button>
              </div>
            </div>
          </div>
          <div className="backdrop-blur-xl bg-white/80 rounded-2xl shadow-lg border border-white/30 overflow-hidden flex flex-col m-4 mt-2">
            <div className="overflow-x-auto flex flex-col min-h-[600px]">
              <table className="w-full">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">EMPLOYEE NAME</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">ID NUMBER</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">EMAIL</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">ROLE/TITLE</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">TELEPHONE</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/50">
                  {employeeLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          Loading...
                        </div>
                      </td>
                    </tr>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
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
                          <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs ${getAvatarColor(emp.full_name || emp.name || 'U')}`}>
                            {getInitials(emp.full_name || emp.name || 'U')}
                          </div>
                          {emp.full_name || emp.name}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {emp.identification?.number || 'Not specified'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">{emp.email || '____'}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{emp.title || emp.role || '____'}</td>
                        <td className="px-4 py-4">
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">
                            {emp.telephone || emp.phone || '____'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase ${emp.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {emp.is_active !== false ? 'Online' : 'Offline'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Fill remaining space to maintain fixed height */}
              <div className="flex-1 bg-white"></div>
            </div>

            {/* Pagination */}
            {employeeTotal > 0 && (
              <div className="bg-white px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {((employeePage - 1) * 20) + 1} to {Math.min(employeePage * 20, employeeTotal)} of {employeeTotal} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchEmployees(employeePage - 1, employeeSearch)}
                      disabled={employeePage === 1 || employeeLoading}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors flex items-center gap-1"
                    >
                      {employeeLoading && (
                        <svg className="animate-spin h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      ← Previous
                    </button>

                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-600">Page</span>
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 font-medium rounded">{employeePage}</span>
                    </div>

                    <button
                      onClick={() => fetchEmployees(employeePage + 1, employeeSearch)}
                      disabled={employeePage * 20 >= employeeTotal || employeeLoading}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors flex items-center gap-1"
                    >
                      Next →
                      {employeeLoading && (
                        <svg className="animate-spin h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddEmployeeModal && (
        <AddEmployeeModalContent
          isOpen={showAddEmployeeModal}
          onClose={() => setShowAddEmployeeModal(false)}
          departmentId={departmentId}
          departmentName={departmentName}
          onSuccess={() => {
            setShowAddEmployeeModal(false);
            handleEmployeeSearch();
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
            name: selectedDeptEmployee.full_name || selectedDeptEmployee.name || '',
            email: selectedDeptEmployee.email || '',
            title: selectedDeptEmployee.title || selectedDeptEmployee.role || '',
            status: selectedDeptEmployee.is_active !== false ? 'Active' : 'Away',
            initials: getInitials(selectedDeptEmployee.full_name || selectedDeptEmployee.name || ''),
            department: selectedDeptEmployee.department_name || user?.departmentName || 'N/A'
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
            handleEmployeeSearch();
          }}
        />
      )}

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

      {/* ACTIVE TASKS TAB - Only for Head of Department */}
      {activeTab === 'active-tasks' && user?.role === 'Head of department' && (
        <RequestsTable
          status="active"
          title="Active Tasks"
          departmentId={departmentId}
          departmentName={departmentName}
          showError={showError}
          setSelectedActiveTask={setSelectedActiveTask}
          setShowActiveTaskModal={setShowActiveTaskModal}
          setTransferVisitor={setTransferVisitor}
          setShowTransferModal={setShowTransferModal}
          showInfo={showInfo}
          getInitials={getInitials}
        />
      )}


      {activeTab === 'availability' && <DepartmentAvailabilityTab departmentId={departmentId} />}


      {/* Active Task Details Modal */}
      {showActiveTaskModal && selectedActiveTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Visitor Details</h2>
                <button
                  onClick={() => {
                    setShowActiveTaskModal(false);
                    setSelectedActiveTask(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Visitor Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <p className="text-gray-900 font-medium">{selectedActiveTask.full_name || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <p className="text-gray-900">{selectedActiveTask.telephone || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <p className="text-gray-900">{selectedActiveTask.email || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Badge Number</label>
                      <p className="text-gray-900">{selectedActiveTask.badge_number || 'Not assigned'}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Service</label>
                      <p className="text-gray-900 font-medium">{selectedActiveTask.current_service_department || 'Unknown'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Service Provider</label>
                      <p className="text-gray-900">{selectedActiveTask.current_service_provider || 'Unknown'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Department</label>
                      <p className="text-gray-900">{selectedActiveTask.assigned_department || 'Unknown'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                      <LiveTimer startTime={selectedActiveTask.entry_date} />
                    </div>
                  </div>
                </div>

                {/* Service Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Service Status</label>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-600 font-medium">Currently Being Served</span>
                  </div>
                </div>


              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && transferVisitor && (
        <div className="fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Transfer Visitor</h2>
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferVisitor(null);
                    setTransferDepartment('');
                    setTransferEmployee(null);
                    setTransferEmployees([]);
                    setSelectedSubDepartment('');
                    setSubDepartments([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              {/* Visitor Info */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Visitor</label>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">
                      {(transferVisitor.full_name || transferVisitor.name || 'Unknown').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-gray-900 font-medium">
                      {transferVisitor.full_name || transferVisitor.name || 'Unknown'}
                    </div>
                    <div className="text-gray-500 text-sm">
                      {transferVisitor.telephone || transferVisitor.email || 'No contact info'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Department Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Department
                </label>
                <select
                  value={transferDepartment}
                  onChange={(e) => handleTransferDepartmentChange(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose department...</option>
                  {departments
                    .filter(dept => dept._id !== departmentId) // Don't show current department
                    .map((dept) => (
                      <option key={dept._id} value={dept._id}>
                        {dept.department_name || dept.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Sub-Department Selection */}
              {transferDepartment && subDepartments.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Unit (Optional)
                  </label>
                  <select
                    value={selectedSubDepartment}
                    onChange={(e) => handleSubDepartmentChange(e.target.value)}
                    disabled={loadingSubDepartments}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">
                      {loadingSubDepartments ? 'Loading units...' : 'Choose unit...'}
                    </option>
                    {subDepartments.map((subDept) => (
                      <option key={subDept._id} value={subDept._id}>
                        {subDept.department_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Employee Selection */}
              {transferDepartment && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign to Employee
                  </label>
                  <select
                    value={
                      transferEmployee?._id ||
                      transferEmployee?.employee_id ||
                      ""
                    }
                    onChange={(e) => {
                      const emp = transferEmployees.find(
                        (em) =>
                          String(em._id || em.employee_id) ===
                          e.target.value,
                      );
                      setTransferEmployee(emp || null);
                    }}
                    disabled={transferEmployeesLoading}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">
                      {transferEmployeesLoading
                        ? `Loading employees${selectedSubDepartment ? ' for unit' : ''}...`
                        : 'No specific employee'
                      }
                    </option>
                    {transferEmployees.map((emp) => (
                      <option
                        key={emp._id || emp.employee_id}
                        value={emp._id || emp.employee_id}
                      >
                        {emp.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferVisitor(null);
                    setTransferDepartment('');
                    setTransferEmployee(null);
                    setTransferEmployees([]);
                    setSelectedSubDepartment('');
                    setSubDepartments([]);
                  }}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={transferring}
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransferVisitor}
                  disabled={transferring || !transferDepartment}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {transferring ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Transferring...
                    </>
                  ) : (
                    <>
                      <FiArrowRightCircle className="w-4 h-4" />
                      Transfer
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