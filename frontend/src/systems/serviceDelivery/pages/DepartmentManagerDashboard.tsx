// Department Manager Dashboard - MainLayout Compatible + Backend APIs
// Exact Figma Design Implementation

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  FiSearch, FiFilter, FiArrowRight, FiUser, FiCheckCircle, FiX, 
  FiClock, FiRefreshCw, FiPlus, FiEye, FiEdit, FiTrash2, FiArrowRightCircle
} from "react-icons/fi";

// Import API Services
import { serviceDeliveryService, employeeService } from "../../../core/services/adminService";
import { useAuth } from "../../../core/contexts/AuthContext";

// Tab Components (Assuming you have these built)
import DepartmentAvailabilityTab from "../components/departmentFlow/tabs/DepartmentAvailabilityTab";
import ReportsTab from "../components/departmentFlow/tabs/ReportsTab";
import ServiceDetailsModal from "../components/departmentFlow/ServiceDetailsModal";
import { ViewEmployeeModal, EditEmployeeModal, DeleteEmployeeModal, AddEmployeeModal } from "../components/departmentFlow/EmployeeModals";

// Types matching Backend Structure
interface Visitor {
  _id?: string;
  id?: string;
  name?: string;
  full_name?: string;
  identification?: string | { number?: string };
  telephone?: string;
  service?: string;
  department?: string;
  status?: string;
  checkInTime?: string;
  check_in_time?: string;
  assignedTo?: any;
}

interface Employee {
  _id?: string;
  employee_id?: string;
  full_name?: string;
  email?: string;
  role?: string;
  title?: string;
  status?: string;
}

const DepartmentManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  // Tab State (Driven by URL)
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'dashboard');

  // LIVE DATA STATES
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
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
      const [visitorRes, empRes] = await Promise.all([
        serviceDeliveryService.getAll(),
        employeeService.getAll()
      ]);

      if (visitorRes.status || visitorRes.success) {
        setVisitors(Array.isArray(visitorRes.data) ? visitorRes.data : []);
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

  // Stats
  const pendingVisitors = visitors.filter(v => (v.status || '').toLowerCase() === 'pending');
  const inProgressVisitors = visitors.filter(v => (v.status || '').toLowerCase() === 'in_progress');
  const completedVisitors = visitors.filter(v => (v.status || '').toLowerCase() === 'completed');

  // Dashboard Filters
  const filteredDashboardVisitors = pendingVisitors.filter(v => 
    getVisitorName(v).toLowerCase().includes(searchTerm.toLowerCase()) ||
    getIdentification(v).includes(searchTerm)
  );

  const itemsPerPage = 8;
  const paginatedDashboard = filteredDashboardVisitors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalDashboardPages = Math.ceil(filteredDashboardVisitors.length / itemsPerPage);

  // Service Status Filters
  const filteredServiceVisitors = visitors.filter(v => {
    const matchesSearch = getVisitorName(v).toLowerCase().includes(serviceStatusSearch.toLowerCase()) || 
                          (v.telephone || '').includes(serviceStatusSearch);
    const matchesStatus = serviceStatusFilter === 'all' ? true : (v.status || '').toLowerCase() === serviceStatusFilter.toLowerCase();
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
                  <p className="text-3xl font-bold text-gray-800">0</p>
                  <p className="text-sm text-gray-500 mt-1">Transferred</p>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FiArrowRightCircle className="w-6 h-6 text-gray-600" />
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
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">SERVICE TYPE</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">ARRIVAL TIME</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-500">Loading live data...</td></tr>
                  ) : paginatedDashboard.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-500">No pending requests found.</td></tr>
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
                        <td className="px-6 py-4"><span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">{visitor.service || 'N/A'}</span></td>
                        <td className="px-6 py-4"><p className="text-sm text-gray-600">{visitor.checkInTime || visitor.check_in_time || 'Just now'}</p></td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => { setSelectedVisitor(visitor); setShowAssignModal(true); }}
                            className="flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            Assign <FiArrowRight className="w-4 h-4 ml-1" />
                          </button>
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
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
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
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${visitor.status === 'In_progress' ? 'bg-blue-100 text-blue-700' : visitor.status === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-700'}`}>
                        {visitor.status || 'Pending'}
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
            <button className="flex items-center gap-2 px-4 py-2 bg-[#0284C7] text-white text-sm font-medium rounded-lg hover:bg-[#0369A1]">
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
                  <th className="text-left text-xs font-bold text-gray-500 uppercase px-6 py-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={4} className="text-center py-8">Loading employees...</td></tr>
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
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase">
                        {emp.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEPARTMENT AVAILABILITY & REPORTS */}
      {activeTab === 'availability' && <DepartmentAvailabilityTab />}
      {activeTab === 'reports' && <ReportsTab />}

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
    </div>
  );
};

export default DepartmentManagerDashboard;