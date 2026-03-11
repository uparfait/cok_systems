// Department Manager Dashboard - Exact Figma Design Implementation

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FiSearch, FiFile, FiFileText, FiEdit, FiFilter,
  FiCheck, FiArrowRight, FiUser, FiCheckCircle, FiX, 
  FiMoreVertical, FiBell, FiGrid, FiClock, FiUsers, FiArrowRightCircle,
  FiUserCheck, FiCheckSquare, FiRefreshCw, FiMenu, FiPlus, FiEye, FiTrash2, FiLogOut, FiActivity
} from "react-icons/fi";

// Tab Components
import DepartmentDashboardTab from "../components/departmentFlow/tabs/DepartmentDashboardTab";
import ServiceStatusTab from "../components/departmentFlow/tabs/ServiceStatusTab";
import EmployeeManagementTab from "../components/departmentFlow/tabs/EmployeeManagementTab";
import DepartmentAvailabilityTab from "../components/departmentFlow/tabs/DepartmentAvailabilityTab";
import ReportsTab from "../components/departmentFlow/tabs/ReportsTab";

// Import shared components
import { Profile, NotificationBell, getInitialNotifications, Logout, DashboardHeader } from "../components/shared";

// Mock user data
const currentUser = {
  firstName: 'Munyensenga',
  lastName: 'Evode',
  role: 'Department Manager',
  avatar: null,
};

// Department Employee Types
interface DepartmentEmployee {
  id: string;
  empId: string;
  name: string;
  email: string;
  title: string;
  status: 'Active' | 'Away';
  initials: string;
}

// Mock Department Employees
const mockDepartmentEmployees: DepartmentEmployee[] = [
  { id: "1", empId: "EMP-001", name: "Evode Sano", email: "evode@kigali.rw", title: "Senior Urban Planner", status: "Active", initials: "ES" },
  { id: "2", empId: "EMP-002", name: "John Smith", email: "john.smith@kigali.rw", title: "Civil Engineer", status: "Active", initials: "JS" },
  { id: "3", empId: "EMP-003", name: "Alice Uwase", email: "alice.uwase@kigali.rw", title: "Project Manager", status: "Away", initials: "AU" },
  { id: "4", empId: "EMP-004", name: "David Nkosi", email: "david.nkosi@kigali.rw", title: "GIS Specialist", status: "Active", initials: "DN" },
  { id: "5", empId: "EMP-005", name: "Sarah Mitesy", email: "sarah.m@kigali.rw", title: "Public Relations", status: "Active", initials: "SM" },
];
import ServiceDetailsModal from "../components/departmentFlow/ServiceDetailsModal";
import { ViewEmployeeModal, EditEmployeeModal, DeleteEmployeeModal, AddEmployeeModal } from "../components/departmentFlow/EmployeeModals";

// Service Status Types
interface ServiceStatusVisitor {
  id: string;
  requestId: string;
  fullName: string;
  initials: string;
  contact: string;
  service: string;
  status: 'Pending' | 'In-Progress' | 'Completed' | 'Transferred';
  assignedTo: string;
  assignedToInitials?: string;
  createdAt?: string;
}

// Types
interface Visitor {
  id: string;
  fullName: string;
  nationalId: string;
  service: string;
  department: string;
  arrivalTime: string;
  status: string;
  phone: string;
  requestId?: string;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  status: 'available' | 'busy' | 'off';
  avatar?: string;
}

// Mock data - Exact Figma Design
const mockVisitors: Visitor[] = [
  { id: "1", fullName: "Jean Bosco Ndayisenga", nationalId: "1199080012345678", service: "Land Registration", department: "Land Management", arrivalTime: "09:15 AM", status: "pending", phone: "0781234567", requestId: "REQ-9012" },
  { id: "2", fullName: "Alice Umutoni", nationalId: "1199570087654321", service: "Business Permit", department: "Business", arrivalTime: "09:45 AM", status: "pending", phone: "0782345678", requestId: "REQ-9013" },
  { id: "3", fullName: "Eric Mugisha", nationalId: "1198880055443322", service: "Tax Clearance", department: "Finance", arrivalTime: "10:10 AM", status: "pending", phone: "0783456789", requestId: "REQ-9014" },
  { id: "4", fullName: "Beata Kayitesi", nationalId: "1197770022334455", service: "Birth Certificate", department: "Registry", arrivalTime: "10:45 AM", status: "pending", phone: "0784567890", requestId: "REQ-9015" },
  { id: "5", fullName: "Beata Kayitesi", nationalId: "1197770022334456", service: "Birth Certificate", department: "Registry", arrivalTime: "10:45 AM", status: "pending", phone: "0784567890", requestId: "REQ-9016" },
  { id: "6", fullName: "Jean Bosco Ndayisenga", nationalId: "1199080012345679", service: "Land Registration", department: "Land Management", arrivalTime: "09:15 AM", status: "pending", phone: "0781234567", requestId: "REQ-9017" },
  { id: "7", fullName: "Alice Umutoni", nationalId: "1199570087654322", service: "Business Permit", department: "Business", arrivalTime: "09:45 AM", status: "pending", phone: "0782345678", requestId: "REQ-9018" },
  { id: "8", fullName: "Eric Mugisha", nationalId: "1198880055443323", service: "Tax Clearance", department: "Finance", arrivalTime: "10:10 AM", status: "pending", phone: "0783456789", requestId: "REQ-9019" },
  { id: "9", fullName: "Beata Kayitesi", nationalId: "1197770022334457", service: "Birth Certificate", department: "Registry", arrivalTime: "10:45 AM", status: "pending", phone: "0784567890", requestId: "REQ-9020" },
  { id: "10", fullName: "Jean Bosco Ndayisenga", nationalId: "1199080012345680", service: "Land Registration", department: "Land Management", arrivalTime: "09:15 AM", status: "pending", phone: "0781234567", requestId: "REQ-9021" },
  { id: "11", fullName: "Alice Umutoni", nationalId: "1199570087654323", service: "Business Permit", department: "Business", arrivalTime: "09:45 AM", status: "pending", phone: "0782345678", requestId: "REQ-9022" },
  { id: "12", fullName: "Eric Mugisha", nationalId: "1198880055443324", service: "Tax Clearance", department: "Finance", arrivalTime: "10:10 AM", status: "pending", phone: "0783456789", requestId: "REQ-9023" },
];

const mockEmployees: Employee[] = [
  { id: "1", name: "Jean de Dieu Nkurunziza", role: "Land Officer", status: "available" },
  { id: "2", name: "Marie Mukamana", role: "Tax Officer", status: "busy" },
  { id: "3", name: "Pierre Kabera", role: "Permit Officer", status: "available" },
  { id: "4", name: "Claire Uwera", role: "Registry Officer", status: "available" },
];

// Get initials from name
const getInitials = (name: string) => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Get color from name
const getColorFromName = (name: string) => {
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

// Mock Service Status Data
const mockServiceStatusVisitors: ServiceStatusVisitor[] = [
  { id: "1", requestId: "REQ-9012", fullName: "Michael K.", initials: "MK", contact: "+250729525550", service: "Document Certification", status: "Pending", assignedTo: "Unassigned", createdAt: "2026-03-06" },
  { id: "2", requestId: "REQ-8945", fullName: "Sarah Connor", initials: "SC", contact: "+250729525550", service: "Business License", status: "In-Progress", assignedTo: "John Doe", assignedToInitials: "JD", createdAt: "2026-03-06" },
  { id: "3", requestId: "REQ-8871", fullName: "ISHIMWE Marie", initials: "IM", contact: "+250729525550", service: "Land Title Change", status: "Completed", assignedTo: "Alice Smith", assignedToInitials: "AS", createdAt: "2026-03-05" },
  { id: "4", requestId: "REQ-8720", fullName: "Tina Huang", initials: "TH", contact: "+250729525550", service: "Visa Consultation", status: "Transferred", assignedTo: "Legal Dept.", createdAt: "2026-03-04" },
  { id: "5", requestId: "REQ-8710", fullName: "John Smith", initials: "JS", contact: "+250729525550", service: "Tax Clearance", status: "Pending", assignedTo: "Unassigned", createdAt: "2026-03-06" },
  { id: "6", requestId: "REQ-8700", fullName: "Emma Wilson", initials: "EW", contact: "+250729525550", service: "Permit Request", status: "In-Progress", assignedTo: "Mike Johnson", assignedToInitials: "MJ", createdAt: "2026-03-03" },
  { id: "7", requestId: "REQ-8690", fullName: "Robert Brown", initials: "RB", contact: "+250729525550", service: "Building Permit", status: "Completed", assignedTo: "Sarah Lee", assignedToInitials: "SL", createdAt: "2026-02-28" },
  { id: "8", requestId: "REQ-8680", fullName: "Lisa Anderson", initials: "LA", contact: "+250729525550", service: "Business Registration", status: "Transferred", assignedTo: "Legal Dept.", createdAt: "2026-02-20" },
];

const DepartmentManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [visitors, setVisitors] = useState<Visitor[]>(mockVisitors);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [notificationCount, setNotificationCount] = useState(3);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  
  // Shared component states
  const [showProfile, setShowProfile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notifications, setNotifications] = useState(() => getInitialNotifications('manager'));
  
  // Handle confirm logout
  const handleConfirmLogout = () => {
    navigate('/login');
  };
  
  // Handle cancel logout
  const handleCancelLogout = () => {
    setShowLogoutConfirm(false);
  };
  
  // Notification handlers
  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };
  
  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };
  
  const itemsPerPage = 9;

  // Service Status states
  const [serviceStatusVisitors, setServiceStatusVisitors] = useState<ServiceStatusVisitor[]>(mockServiceStatusVisitors);
  const [serviceStatusSearch, setServiceStatusSearch] = useState("");
  const [serviceStatusFilter, setServiceStatusFilter] = useState("all");
  const [serviceDateFilter, setServiceDateFilter] = useState("all");
  const [serviceCurrentPage, setServiceCurrentPage] = useState(1);
  const [showServiceDetailsModal, setShowServiceDetailsModal] = useState(false);
  const [selectedServiceVisitor, setSelectedServiceVisitor] = useState<ServiceStatusVisitor | null>(null);
  
  // Employee Management states
  const [employees, setEmployees] = useState<DepartmentEmployee[]>(mockDepartmentEmployees);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState("all");
  const [employeePage, setEmployeePage] = useState(1);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showViewEmployeeModal, setShowViewEmployeeModal] = useState(false);
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  const [showDeleteEmployeeModal, setShowDeleteEmployeeModal] = useState(false);
  const [selectedDeptEmployee, setSelectedDeptEmployee] = useState<DepartmentEmployee | null>(null);
  const employeesPerPage = 5;
  
  // Service Status pagination constants
  const serviceItemsPerPage = 8;
  const filteredServiceVisitors = serviceStatusVisitors.filter(visitor => {
    const matchesSearch = !serviceStatusSearch ? true : 
      visitor.fullName.toLowerCase().includes(serviceStatusSearch.toLowerCase()) ||
      visitor.requestId.toLowerCase().includes(serviceStatusSearch.toLowerCase()) ||
      visitor.contact.includes(serviceStatusSearch);
    const matchesStatus = serviceStatusFilter === 'all' ? true : visitor.status === serviceStatusFilter;
    return matchesSearch && matchesStatus;
  });
  const serviceTotalPages = Math.ceil(filteredServiceVisitors.length / serviceItemsPerPage);
  const paginatedServiceVisitors = filteredServiceVisitors.slice(
    (serviceCurrentPage - 1) * serviceItemsPerPage,
    serviceCurrentPage * serviceItemsPerPage
  );

  // Reset serviceCurrentPage when filters change
  useEffect(() => {
    setServiceCurrentPage(1);
  }, [serviceStatusSearch, serviceStatusFilter, serviceDateFilter]);

  // Reset currentPage when filtered visitors change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, visitors]);

  // Filter visitors (only pending)
  const filteredVisitors = visitors.filter(visitor => {
    const matchesSearch = !searchTerm ? true : 
      visitor.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visitor.nationalId.includes(searchTerm);
    return matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage);
  const paginatedVisitors = filteredVisitors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats
  const pendingCount = visitors.filter(v => v.status === 'pending').length;
  const inProgressCount = 8;
  const transferredCount = 5;
  const completedCount = 42;

  // Handle assign click
  const handleAssignClick = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setSelectedEmployee(null);
    setShowModal(true);
  };

  // Handle confirm assignment
  const handleConfirmAssignment = () => {
    if (selectedVisitor && selectedEmployee) {
      // Add to service status visitors (with request ID)
      const newServiceVisitor: ServiceStatusVisitor = {
        id: selectedVisitor.id,
        requestId: selectedVisitor.requestId || `REQ-${9000 + parseInt(selectedVisitor.id)}`,
        fullName: selectedVisitor.fullName,
        initials: getInitials(selectedVisitor.fullName),
        contact: selectedVisitor.phone,
        service: selectedVisitor.service,
        status: 'In-Progress',
        assignedTo: selectedEmployee.name,
        assignedToInitials: getInitials(selectedEmployee.name)
      };
      setServiceStatusVisitors(prev => [...prev, newServiceVisitor]);
      
      // Remove from pending visitors
      setVisitors(prev => prev.filter(v => v.id !== selectedVisitor.id));
      // Show success message
      setShowSuccessMessage(true);
      // Increase notification count
      setNotificationCount(prev => prev + 1);
      // Close modal after showing success
      setTimeout(() => {
        setShowModal(false);
        setShowSuccessMessage(false);
        setSelectedVisitor(null);
        setSelectedEmployee(null);
      }, 1500);
    }
  };

  // Handle close modal
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedVisitor(null);
    setSelectedEmployee(null);
  };

  // Menu items - with Service Status active
  const menuItems = [
    { id: 'dashboard', icon: FiGrid, label: 'Dashboard', active: activeTab === 'dashboard' },
    { id: 'status', icon: FiClock, label: 'Service Status', active: activeTab === 'status' },
    { id: 'employees', icon: FiUsers, label: 'Employee Management', active: activeTab === 'employees' },
    { id: 'availability', icon: FiCheckCircle, label: 'Department Availability', active: activeTab === 'availability' },
    { id: 'reports', icon: FiFile, label: 'Reports', active: activeTab === 'reports' },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F9] font-sans flex">
      {/* LEFT SIDEBAR - Fixed */}
      <nav className="w-60 bg-white flex flex-col fixed h-full border-r border-gray-200 shadow-sm">
        {/* Logo Area */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center">
              <img src="/src/assets/LOGO_COK.jpg" alt="Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <div className="text-[#1a2744] font-bold text-[13px]">KSESM</div>
              <div className="text-[#1a73e8] font-bold text-[11px] uppercase tracking-wide">CITY OF KIGALI</div>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="flex-1 py-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${item.active 
                ? 'bg-blue-600 text-white mx-1' 
                : 'text-gray-600 hover:bg-gray-100 mx-2'}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Profile Mini Card - Blue Background like Receptionist */}
        <div className="p-2 bg-blue-600 mr-2 my-2 rounded-lg">
          <div className="flex items-center gap-3">
            {/* User Avatar - Clickable to open profile */}
            <button
              onClick={() => setShowProfile(true)}
              className="w-9 h-9 rounded-full bg-white flex items-center justify-center"
            >
              <span className="text-sm font-medium text-blue-600">EM</span>
            </button>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Evode MUYISINGIZE</p>
              <p className="text-xs text-white">Dept. Manager</p>
            </div>
            {/* Logout Button */}
            <button 
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 text-red-400 hover:text-red-300"
            >
              <FiLogOut />
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="flex-1 ml-60">
        {/* TOP HEADER - Using Shared DashboardHeader */}
        <DashboardHeader 
          activeTab={activeTab}
          userRole="department_manager"
          userName="Evode Munyensenga"
          userInitials="EM"
          userTitle="Dept. Manager"
          notifications={notifications}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
        />

        {/* CONTENT AREA */}
        <main className="p-6">
          {activeTab === 'dashboard' && (
          <>
          {/* STATISTICS CARDS */}
          <div className="grid grid-cols-4 gap-5 mb-6">
            {/* Pending Card */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-800">{pendingCount}</p>
                  <p className="text-sm text-green-600 mt-1">↑ 4% since yesterday</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FiClock className="w-6 h-6 text-orange-500" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">Pending</p>
            </div>

            {/* In-Progress Card */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-800">{inProgressCount}</p>
                  <p className="text-sm text-gray-500 mt-1">Current active tasks</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FiRefreshCw className="w-6 h-6 text-blue-500" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">In-Progress</p>
            </div>

            {/* Transferred Card */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-800">{transferredCount}</p>
                  <p className="text-sm text-gray-500 mt-1">To other departments</p>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FiArrowRightCircle className="w-6 h-6 text-gray-600" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">Transferred</p>
            </div>

            {/* Completed Card */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-800">{completedCount}</p>
                  <p className="text-sm text-gray-500 mt-1">Successfully completed</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <FiCheckCircle className="w-6 h-6 text-green-500" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">Completed</p>
            </div>
          </div>

          {/* CURRENT PENDING REQUESTS CARD */}
          <div className="bg-white rounded-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
            {/* Card Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-[18px] font-semibold text-[#0F172A]">Current Pending Requests</h2>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-[14px] py-2 border border-[#CBD5E1] rounded-[8px] text-[#475569] hover:bg-gray-50 transition-colors">
                  <FiFilter className="w-4 h-4" />
                  Filter
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-[#0284C7] rounded-[8px] text-white hover:bg-[#0369A1] transition-colors">
                  <FiRefreshCw className="w-4 h-4" />
                  Refresh Data
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto px-6">
              <table className="w-full">
                <thead className="bg-[#F1F5F9]">
                  <tr>
                    <th className="text-left text-[13px] font-semibold text-[#64748B] uppercase tracking-[0.5px] px-6 py-3">VISITOR NAME</th>
                    <th className="text-left text-[13px] font-semibold text-[#64748B] uppercase tracking-[0.5px] px-6 py-3">ID NUMBER</th>
                    <th className="text-left text-[13px] font-semibold text-[#64748B] uppercase tracking-[0.5px] px-6 py-3">SERVICE TYPE</th>
                    <th className="text-left text-[13px] font-semibold text-[#64748B] uppercase tracking-[0.5px] px-6 py-3">ARRIVAL TIME</th>
                    <th className="text-left text-[13px] font-semibold text-[#64748B] uppercase tracking-[0.5px] px-6 py-3">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedVisitors.map((visitor) => (
                    <tr key={visitor.id} className="h-16 border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-9 h-9 rounded-full bg-[#E0F2FE] flex items-center justify-center text-[#0284C7] font-semibold text-[13px] mr-3">
                            {getInitials(visitor.fullName)}
                          </div>
                          <p className="text-[14px] font-medium text-[#1E293B]">{visitor.fullName}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[13px] text-[#64748B] tracking-wide">{visitor.nationalId}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-[10px] py-1 bg-[#E2E8F0] rounded-full text-[12px] font-medium text-[#475569]">
                          {visitor.service}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[13px] text-[#475569]">{visitor.arrivalTime}</p>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => handleAssignClick(visitor)}
                          className="flex items-center text-[14px] font-medium text-[#0284C7] cursor-pointer hover:underline hover:text-[#0369A1] transition-colors"
                        >
                          Assign <FiArrowRight className="w-3 h-3 ml-1" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Pagination */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-[13px] text-[#64748B]">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredVisitors.length)} to {Math.min(currentPage * itemsPerPage, filteredVisitors.length)} of {filteredVisitors.length} requests
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="w-7 h-7 flex items-center justify-center bg-[#F1F5F9] rounded-[4px] hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiArrowRight className="w-4 h-4 text-[#475569] rotate-180" />
                </button>
                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-7 h-7 flex items-center justify-center text-[13px] font-medium rounded-[4px] transition-colors ${
                        currentPage === page 
                          ? 'bg-[#0284C7] text-white' 
                          : 'bg-[#F1F5F9] text-[#475569] hover:bg-gray-200'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="w-7 h-7 flex items-center justify-center bg-[#F1F5F9] rounded-[4px] hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiArrowRight className="w-4 h-4 text-[#475569]" />
                </button>
              </div>
            </div>
          </div>
          </>
          )}

          {/* SERVICE STATUS TRACKING PAGE */}
          {activeTab === 'status' && (
            <div className="space-y-6">
              {/* Header Section */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">Service Status Tracking</h1>
                  <p className="text-sm text-gray-500 mt-1">manage and track live visitor requests across all departments.</p>
                </div>
                <div className="flex items-center gap-4">
                  {/* Active Today Card */}
                  <div className="bg-white rounded-xl shadow-sm p-4 min-w-[140px]">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">ACTIVE TODAY</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">124</p>
                  </div>
                  {/* Avg Wait Card */}
                  <div className="bg-white rounded-xl shadow-sm p-4 min-w-[140px]">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">AVG. WAIT</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">15 min</p>
                  </div>
                </div>
              </div>

              {/* Search and Filter Card */}
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-4">
                  {/* Search Box */}
                  <div className="relative flex-1">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by ID, Name, or Number...."
                      value={serviceStatusSearch}
                      onChange={(e) => setServiceStatusSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-[#E0F2FE] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-2">
                    <select
                      value={serviceStatusFilter}
                      onChange={(e) => setServiceStatusFilter(e.target.value)}
                      className="px-4 py-2 bg-[#E0F2FE] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                    >
                      <option value="all">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="In-Progress">In-Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Transferred">Transferred</option>
                    </select>
                  </div>

                  {/* Date Filter */}
                  <div className="flex items-center gap-2">
                    <select
                      value={serviceDateFilter}
                      onChange={(e) => setServiceDateFilter(e.target.value)}
                      className="px-4 py-2 bg-[#E0F2FE] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                    >
                      <option value="all">Any Date</option>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                    </select>
                  </div>

                  {/* Apply Button */}
                  <button className="flex items-center gap-2 px-4 py-2 bg-[#0284C7] text-white rounded-lg hover:bg-[#0369A1] transition-colors">
                    <FiFilter className="w-4 h-4" />
                    Apply
                  </button>
                </div>
              </div>

              {/* Table Card */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#F1F5F9]">
                      <tr>
                        <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">REQUEST ID</th>
                        <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">VISITOR NAME</th>
                        <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">CONTACT NUMBER</th>
                        <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">REQUESTED SERVICE</th>
                        <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">STATUS</th>
                        <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">ASSIGNED TO</th>
                        <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {paginatedServiceVisitors.map((visitor) => (
                        <tr key={visitor.id} className="h-16 hover:bg-[#F8FAFC] transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-[13px] font-medium text-[#0284C7]">#{visitor.requestId}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="w-9 h-9 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[#475569] font-semibold text-[13px] mr-3">
                                {visitor.initials}
                              </div>
                              <p className="text-[14px] font-medium text-[#1E293B]">{visitor.fullName}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-[13px] text-[#475569]">{visitor.contact}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-[13px] text-[#475569]">{visitor.service}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-3 py-1 rounded-full text-[12px] font-semibold ${
                              visitor.status === 'Pending' ? 'bg-[#FEF3C7] text-[#B45309]' :
                              visitor.status === 'In-Progress' ? 'bg-[#DBEAFE] text-[#1D4ED8]' :
                              visitor.status === 'Completed' ? 'bg-[#DCFCE7] text-[#15803D]' :
                              'bg-[#E9D5FF] text-[#7C3AED]'
                            }`}>
                              {visitor.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              {visitor.assignedToInitials ? (
                                <>
                                  <div className="w-7 h-7 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[#475569] font-semibold text-[11px] mr-2">
                                    {visitor.assignedToInitials}
                                  </div>
                                  <p className="text-[13px] text-[#475569]">{visitor.assignedTo}</p>
                                </>
                              ) : (
                                <p className="text-[13px] text-[#475569]">{visitor.assignedTo}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => {
                                setSelectedServiceVisitor(visitor);
                                setShowServiceDetailsModal(true);
                              }}
                              className="text-[14px] font-medium text-[#0284C7] cursor-pointer hover:underline"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-[13px] text-[#64748B]">
                    Showing {Math.min((serviceCurrentPage - 1) * serviceItemsPerPage + 1, filteredServiceVisitors.length)} to {Math.min(serviceCurrentPage * serviceItemsPerPage, filteredServiceVisitors.length)} of {filteredServiceVisitors.length} results
                  </p>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setServiceCurrentPage(Math.max(1, serviceCurrentPage - 1))}
                      disabled={serviceCurrentPage === 1}
                      className="w-7 h-7 flex items-center justify-center bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiArrowRight className="w-4 h-4 text-[#475569] rotate-180" />
                    </button>
                    {Array.from({ length: Math.min(4, serviceTotalPages) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <button
                          key={page}
                          onClick={() => setServiceCurrentPage(page)}
                          className={`w-7 h-7 flex items-center justify-center text-[13px] font-medium rounded-[8px] transition-colors ${
                            serviceCurrentPage === page 
                              ? 'bg-[#0284C7] text-white' 
                              : 'bg-white border border-[#E2E8F0] text-[#475569] hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button 
                      onClick={() => setServiceCurrentPage(Math.min(serviceTotalPages, serviceCurrentPage + 1))}
                      disabled={serviceCurrentPage === serviceTotalPages}
                      className="w-7 h-7 flex items-center justify-center bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiArrowRight className="w-4 h-4 text-[#475569]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EMPLOYEE MANAGEMENT TAB */}
          {activeTab === 'employees' && (
            <div className="space-y-6">
              {/* Page Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-[28px] font-bold text-[#0F172A]">Department Employee Management</h1>
                  <p className="text-sm text-[#64748B] mt-2">Manage staff details, track attendance, and update employee records efficiently.</p>
                </div>
                {/* Add New Employee Button */}
                <button 
                  onClick={() => setShowAddEmployeeModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#0284C7] text-white rounded-full font-medium hover:bg-[#0369A1] transition-colors shadow-[0px_4px_10px_rgba(2,132,199,0.2)]"
                >
                  <FiPlus className="w-5 h-5" />
                  Add New Employee
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-6">
                {/* Active Staff Card */}
                <div className="bg-white rounded-2xl p-6 shadow-[0px_8px_24px_rgba(0,0,0,0.04)]">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-[#64748B] uppercase tracking-wider">ACTIVE STAFF</p>
                      <p className="text-[36px] font-bold text-[#0F172A] mt-1">{employees.filter(e => e.status === 'Active').length}</p>
                    </div>
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <FiCheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                </div>

                {/* Away / On Leave Card */}
                <div className="bg-white rounded-2xl p-6 shadow-[0px_8px_24px_rgba(0,0,0,0.04)]">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-[#64748B] uppercase tracking-wider">AWAY / ON LEAVE</p>
                      <p className="text-[36px] font-bold text-[#0F172A] mt-1">{employees.filter(e => e.status === 'Away').length}</p>
                      <p className="text-xs text-[#94A3B8] mt-1">Currently unavailable</p>
                    </div>
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <FiClock className="w-5 h-5 text-orange-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex items-center gap-4">
                {/* Search Input */}
                <div className="relative flex-1">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    type="text"
                    placeholder="Search by name, ID, or email"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="w-full h-11 pl-12 pr-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-full focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:border-transparent"
                  />
                </div>

                {/* Status Filter */}
                <button className="flex items-center gap-2 px-4 py-2 border border-[#E2E8F0] rounded-[10px] text-[#475569] hover:bg-gray-50">
                  <FiFilter className="w-4 h-4" />
                  Status: {employeeStatusFilter === 'all' ? 'All' : employeeStatusFilter}
                </button>
              </div>

              {/* Employee Table */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[#F8FAFC]">
                    <tr>
                      <th className="text-left text-xs font-semibold text-[#475569] uppercase px-6 py-4">EMPLOYEE</th>
                      <th className="text-left text-xs font-semibold text-[#475569] uppercase px-6 py-4">ID</th>
                      <th className="text-left text-xs font-semibold text-[#475569] uppercase px-6 py-4">TITLE</th>
                      <th className="text-left text-xs font-semibold text-[#475569] uppercase px-6 py-4">STATUS</th>
                      <th className="text-left text-xs font-semibold text-[#475569] uppercase px-6 py-4">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {employees.map((employee) => (
                      <tr key={employee.id} className="hover:bg-[#F1F5F9] transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-[#0284C7] flex items-center justify-center text-white font-semibold mr-3">
                              {employee.initials}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#0F172A]">{employee.name}</p>
                              <p className="text-xs text-[#64748B]">{employee.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="bg-[#F1F5F9] text-[#475569] text-xs px-3 py-1.5 rounded-full">{employee.empId}</span>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm text-[#475569]">{employee.title}</p>
                        </td>
                        <td className="px-6 py-5">
                          {employee.status === 'Active' ? (
                            <span className="inline-flex items-center gap-1.5 bg-[#DCFCE7] text-[#15803D] text-xs px-3 py-1.5 rounded-full">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-[#FFEDD5] text-[#C2410C] text-xs px-3 py-1.5 rounded-full">
                              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                              Away
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => { setSelectedDeptEmployee(employee); setShowViewEmployeeModal(true); }}
                              className="text-[#64748B] hover:scale-110 transition-transform cursor-pointer"
                            >
                              <FiEye className="w-[18px] h-[18px]" />
                            </button>
                            <button 
                              onClick={() => { setSelectedDeptEmployee(employee); setShowEditEmployeeModal(true); }}
                              className="text-[#0284C7] hover:scale-110 transition-transform cursor-pointer"
                            >
                              <FiEdit className="w-[18px] h-[18px]" />
                            </button>
                            <button 
                              onClick={() => { setSelectedDeptEmployee(employee); setShowDeleteEmployeeModal(true); }}
                              className="text-[#DC2626] hover:scale-110 transition-transform cursor-pointer"
                            >
                              <FiTrash2 className="w-[18px] h-[18px]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between">
                  <p className="text-sm text-[#64748B]">Showing 1 to {employees.length} of {employees.length} results</p>
                  <div className="flex items-center gap-2">
                    <button className="w-8 h-8 flex items-center justify-center bg-white border border-[#E2E8F0] rounded-[8px] text-[#475569] hover:bg-gray-50">
                      <FiArrowRight className="w-4 h-4 rotate-180" />
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center bg-[#0284C7] text-white rounded-[8px]">1</button>
                    <button className="w-8 h-8 flex items-center justify-center bg-white border border-[#E2E8F0] rounded-[8px] text-[#475569] hover:bg-gray-50">
                      <FiArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DEPARTMENT AVAILABILITY TAB */}
          {activeTab === 'availability' && (
            <DepartmentAvailabilityTab />
          )}

          {/* REPORTS TAB */}
          {activeTab === 'reports' && (
            <ReportsTab />
          )}
        </main>
      </div>

      {/* ASSIGN MODAL - With Blur Effect */}
      {showModal && selectedVisitor && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FiUser className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Request Detail</h3>
              </div>
              <button 
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Section 1 - Visitor Information */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Visitor Name</p>
                  <p className="text-sm font-semibold text-gray-800">{selectedVisitor.fullName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Request ID</p>
                  <p className="text-sm font-semibold text-gray-800">#{selectedVisitor.requestId || `REQ-${9000 + parseInt(selectedVisitor.id)}`}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Service Requesting</p>
                  <p className="text-sm font-semibold text-gray-800">{selectedVisitor.service}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Wait Time</p>
                  <p className="text-sm font-semibold text-gray-800">25 minutes</p>
                </div>
              </div>

              {/* Section 2 - Assignment Area */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <FiUserCheck className="w-5 h-5 text-gray-600" />
                  <p className="text-sm font-medium text-gray-800">Assign to staff member</p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-2">Select Employee</p>
                  <select
                    value={selectedEmployee?.id || ''}
                    onChange={(e) => {
                      const emp = mockEmployees.find(em => em.id === e.target.value);
                      setSelectedEmployee(emp || null);
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select an employee...</option>
                    {mockEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} - {emp.role}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Employee Status Card - Shows when employee is selected */}
                {selectedEmployee && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-800">Employee Status & Availability</p>
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        Available
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <p className="text-sm text-green-600">Active</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Success Message */}
            {showSuccessMessage && (
              <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10">
                <div className="flex items-center gap-2 px-6 py-3 bg-green-100 text-green-700 rounded-lg">
                  <FiCheckCircle className="w-5 h-5" />
                  <span className="font-medium">Assignment successful!</span>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button 
                onClick={handleCloseModal}
                className="px-6 py-2.5 border border-gray-200 rounded-[10px] text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmAssignment}
                disabled={!selectedEmployee}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 rounded-[10px] text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SERVICE DETAILS MODAL */}
      <ServiceDetailsModal 
        isOpen={showServiceDetailsModal} 
        onClose={() => setShowServiceDetailsModal(false)} 
        visitor={selectedServiceVisitor} 
      />

      {/* EMPLOYEE MODALS */}
      <AddEmployeeModal 
        isOpen={showAddEmployeeModal} 
        onClose={() => setShowAddEmployeeModal(false)} 
        onAdd={(newEmployee) => {
          // Handle adding new employee
          console.log('New employee added:', newEmployee);
        }}
      />
      <ViewEmployeeModal 
        isOpen={showViewEmployeeModal} 
        onClose={() => setShowViewEmployeeModal(false)} 
        employee={selectedDeptEmployee} 
      />
      <EditEmployeeModal 
        isOpen={showEditEmployeeModal} 
        onClose={() => setShowEditEmployeeModal(false)} 
        employee={selectedDeptEmployee}
        onSave={(updatedEmployee) => {
          // Handle saving edited employee
          console.log('Employee updated:', updatedEmployee);
        }}
      />
      <DeleteEmployeeModal 
        isOpen={showDeleteEmployeeModal} 
        onClose={() => setShowDeleteEmployeeModal(false)} 
        employee={selectedDeptEmployee}
        onDelete={() => {
          // Handle deleting employee
          console.log('Employee deleted');
        }}
      />
      
      {/* Profile Modal */}
      {showProfile && (
        <Profile 
          user={currentUser}
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* Logout Confirmation */}
      {showLogoutConfirm && (
        <Logout 
          onConfirm={handleConfirmLogout}
          onCancel={handleCancelLogout}
        />
      )}
    </div>
  );
};

export default DepartmentManagerDashboard;
