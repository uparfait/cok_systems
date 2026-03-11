// ReceptionistDashboard Page - Exact Figma Design Implementation

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FiSearch, FiUsers, FiClock, FiCheckCircle, FiBell, FiHome, 
  FiGrid, FiLogOut, FiMoreVertical, FiDownload, FiChevronDown,
  FiChevronLeft, FiChevronRight, FiArrowLeft, FiFile, FiFileText, FiX
} from "react-icons/fi";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

// Import AssignedVisitorsList component
import AssignedVisitorsList from "../components/departmentFlow/AssignedVisitorsList";
import AssignVisitorModal from "../components/departmentFlow/AssignVisitorModal";
import DepartmentAvailability from "../components/departmentFlow/DepartmentAvailability";

// Import shared components
import { Profile, NotificationBell, getInitialNotifications, Logout, DashboardHeader, ServiceStatusBadge } from "../components/shared";

// Mock user data
const currentUser = {
  firstName: 'Evode',
  lastName: 'Munyensenga',
  role: 'Receptionist',
  avatar: null,
};

// Types
interface Visitor {
  id: string;
  full_name: string;
  identification: string;
  telephone: string;
  email?: string;
  address?: string;
  status: 'pending' | 'waiting' | 'In_progress' | 'completed';
  check_in_time: string;
  department?: string;
  service?: string;
  purpose?: string;
  assignedStaff?: string;
}

// Mock data matching Figma exactly
const MOCK_VISITORS: Visitor[] = [
  { id: '1', full_name: 'Evode Sano', identification: '119988776655', telephone: '+250 789123456',  status: 'pending', check_in_time: '09:30 AM', department: 'Finance', service: 'General Inquiry', purpose: 'Official Business', assignedStaff: 'Mukankusi' },
  { id: '2', full_name: 'Jane Nyirahabimana', identification: '119977654321', telephone: '+250 782345678', status: 'In_progress', check_in_time: '09:45 AM', department: 'IT Department', service: 'Service Complaint' },
  { id: '3', full_name: 'Eric Kayisire', identification: '119988776655', telephone: '+250 783456789', status: 'pending', check_in_time: '10:00 AM', department: 'Human Resource', service: 'Permit Request' },
  { id: '4', full_name: 'Alice Umutoni', identification: '119955543210', telephone: '+250 784567890', status: 'pending', check_in_time: '10:15 AM', department: 'Customer Care', service: 'Tax Inquiry' },
  { id: '5', full_name: 'Alice Umutoni', identification: '119944432109', telephone: '+250 785678901', status: 'pending', check_in_time: '08:30 AM', department: 'Registry', service: 'Business Registration' },
];

const DEPARTMENTS = [
  { id: 'dept_1', name: 'Finance', staffAvailable: 2, currentQueue: 5, isActive: true },
  { id: 'dept_2', name: 'IT Department', staffAvailable: 1, currentQueue: 3, isActive: true },
  { id: 'dept_3', name: 'Human Resource', staffAvailable: 0, currentQueue: 8, isActive: false },
  { id: 'dept_4', name: 'Customer Care', staffAvailable: 1, currentQueue: 2, isActive: true },
  { id: 'dept_5', name: 'Registry', staffAvailable: 1, currentQueue: 4, isActive: true },
  { id: 'dept_6', name: 'Planning', staffAvailable: 0, currentQueue: 6, isActive: false },
];

// Hourly data for line chart
const HOURLY_VISITORS = [
  { hour: '8AM', count: 4 },
  { hour: '9AM', count: 19 },
  { hour: '10AM', count: 12 },
  { hour: '11AM', count: 14 },
  { hour: '12PM', count: 8 },
  { hour: '1PM', count: 14 },
];

const ReceptionistDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'visitors' | 'availability'>('dashboard');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [showVisitorDetail, setShowVisitorDetail] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Shared component states
  const [showProfile, setShowProfile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
   
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
  
  // Notification state
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<{id: string, title: string, message: string, time: string, read: boolean} | null>(null);
  const [notifications, setNotifications] = useState(() => getInitialNotifications('receptionist'));

  // Load assigned visitors from localStorage on mount
  useEffect(() => {
    const savedVisitors = localStorage.getItem('assignedVisitors');
    if (savedVisitors) {
      try {
        setAssignedVisitors(JSON.parse(savedVisitors));
      } catch (e) {
        console.error('Error loading assigned visitors:', e);
      }
    }
  }, []);

  // Assigned visitors state - will be updated when assignment is made
  const [assignedVisitors, setAssignedVisitors] = useState<Visitor[]>([]);

  // Save assigned visitors to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('assignedVisitors', JSON.stringify(assignedVisitors));
  }, [assignedVisitors]);

  // Filtered visitors based on search and status filter - combine MOCK_VISITORS with assignedVisitors
  const allVisitors = [...MOCK_VISITORS, ...assignedVisitors];
  const filteredVisitors = allVisitors.filter(visitor => {
    const matchesSearch = !searchTerm ? true : 
      visitor.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visitor.identification.includes(searchTerm) ||
      visitor.telephone.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' ? true : 
      visitor.status.toLowerCase().replace('_', '') === statusFilter.toLowerCase().replace('_', '');
    
    return matchesSearch && matchesStatus;
  });

  // Pagination variables
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage);
  const paginatedVisitors = filteredVisitors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Effects
  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Reset to first page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Handlers
  const handleAssignClick = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setShowAssignModal(true);
  };

  const handleCloseModal = () => {
    setShowAssignModal(false);
    setSelectedVisitor(null);
    setSelectedDepartment('');
    setSelectedService('');
    setServiceDescription('');
  };

  const handleDepartmentSelect = (deptId: string) => {
    setSelectedDepartment(deptId);
  };

  const handleServiceSelect = (service: string) => {
    setSelectedService(service);
  };

  const handleServiceDescriptionChange = (description: string) => {
    setServiceDescription(description);
  };

  // Pagination handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  const handleConfirmAssignment = () => {
    if (selectedVisitor && selectedDepartment) {
      // Get department name
      const dept = DEPARTMENTS.find(d => d.id === selectedDepartment);
      
      // Update the visitor's status and department
      const updatedVisitor: Visitor = {
        ...selectedVisitor,
        status: 'In_progress',
        department: dept?.name || selectedVisitor.department,
        service: selectedService || selectedVisitor.service,
      };
      
      // Add to assigned visitors list
      setAssignedVisitors(prev => [updatedVisitor, ...prev]);
      
      // Create notification for the assignment
      const newNotification = {
        id: String(Date.now()),
        type: 'assignment' as const,
        title: 'New Assignment',
        message: `Visitor ${updatedVisitor.full_name} has been assigned to ${dept?.name || 'the selected department'}`,
        time: 'Just now',
        read: false
      };
      setNotifications(prev => [newNotification, ...prev]);
      
      console.log('Assigning visitor:', updatedVisitor);
      console.log('To department:', selectedDepartment);
      
      // Show success message
      setSuccessMessage('Assignment successful! The visitor has been assigned to ' + (dept?.name || 'the selected department'));
      setShowSuccessMessage(true);
      
      // Hide success message after 3 seconds and close modal
      setTimeout(() => {
        setShowSuccessMessage(false);
        handleCloseModal();
      }, 2000);
    }
  };

  // Export handlers
  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('Receptionist Visitor Report', 14, 22);
    
    // Add date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    
    // Table headers
    const headers = ['Name', 'ID', 'Phone', 'Status', 'Check-in Time', 'Department', 'Service'];
    const colWidths = [35, 30, 30, 25, 25, 30, 35];
    let yPos = 40;
    
    // Header row
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    headers.forEach((header, i) => {
      doc.text(header, 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), yPos);
    });
    
    // Data rows
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    
    const allVisitors = [...MOCK_VISITORS, ...assignedVisitors];
    allVisitors.forEach((visitor) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      const row = [
        visitor.full_name,
        visitor.identification,
        visitor.telephone,
        visitor.status,
        visitor.check_in_time,
        visitor.department || '-',
        visitor.service || '-'
      ];
      
      row.forEach((cell, i) => {
        doc.text(String(cell), 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), yPos);
      });
      
      yPos += 7;
    });
    
    // Save the PDF
    doc.save('visitors-report.pdf');
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    const allVisitors = [...MOCK_VISITORS, ...assignedVisitors];
    
    // Prepare data for Excel
    const data = allVisitors.map(visitor => ({
      'Name': visitor.full_name,
      'Identification': visitor.identification,
      'Phone': visitor.telephone,
      'Status': visitor.status,
      'Check-in Time': visitor.check_in_time,
      'Department': visitor.department || '-',
      'Service': visitor.service || '-',
      'Purpose': visitor.purpose || '-',
      'Assigned Staff': visitor.assignedStaff || '-'
    }));
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Visitors');
    
    // Save the file
    XLSX.writeFile(wb, 'visitors-report.xlsx');
    setShowExportMenu(false);
  };

  const handleExportCSV = () => {
    const allVisitors = [...MOCK_VISITORS, ...assignedVisitors];
    
    // Prepare data for CSV
    const data = allVisitors.map(visitor => ({
      'Name': visitor.full_name,
      'Identification': visitor.identification,
      'Phone': visitor.telephone,
      'Status': visitor.status,
      'Check-in Time': visitor.check_in_time,
      'Department': visitor.department || '-',
      'Service': visitor.service || '-',
      'Purpose': visitor.purpose || '-',
      'Assigned Staff': visitor.assignedStaff || '-'
    }));
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Visitors');
    
    // Save as CSV
    XLSX.writeFile(wb, 'visitors-report.csv');
    setShowExportMenu(false);
  };

  // Format helpers
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric' 
    }).toUpperCase();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    }).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] font-sans flex">
      {/* LEFT SIDEBAR - White with Blue Bottom */}
      <nav className="w-64 bg-white flex flex-col fixed h-full border-r border-gray-200">
        {/* Top part of sidebar - White */}
        <div className="flex-1">
          {/* Sidebar Header */}
          <div className="h-16 flex items-center gap-3 px-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center">
              <img src="/src/assets/LOGO_COK.jpg" alt="Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <div className="text-[#1a2744] font-bold text-[13px]">KSESM</div>
              <div className="text-[#1a73e8] font-bold text-[11px] uppercase tracking-wide">CITY OF KIGALI</div>
            </div>
          </div>
          
          {/* Sidebar Menu - Only 3 tabs as per Figma */}
          <div className="py-4 px-3">
            <button
              onClick={() => { setActiveTab('dashboard'); setShowVisitorDetail(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'dashboard' && !showVisitorDetail
                  ? 'bg-blue-100 text-black' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FiHome className="text-lg" />
              <span className="text-sm">Dashboard</span>
            </button>
            <button
              onClick={() => { setActiveTab('visitors'); setShowVisitorDetail(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'visitors'
                  ? 'bg-blue-100 text-black' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FiUsers className="text-lg" />
              <span className="text-sm">Assigned Visitor</span>
            </button>
            <button
              onClick={() => { setActiveTab('availability'); setShowVisitorDetail(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'availability'
                  ? 'bg-blue-100 text-black' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FiGrid className="text-lg" />
              <span className="text-sm">Dept. Availability</span>
            </button>
          </div>
        </div>
        
        {/* Sidebar Footer - Blue Background */}
        <div className="p-4 bg-blue-600 mr-4 my-6 br-4">
          <div className="flex items-center gap-3">
            {/* User Avatar - Clickable to open profile */}
            <button
              onClick={() => setShowProfile(true)}
              className="w-9 h-9 rounded-full bg-purple-400 flex items-center justify-center"
            >
              <span className="text-sm font-medium text-white ">EM</span>
            </button>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">E. Munyensenga</p>
              <p className="text-xs text-white">Receptionist</p>
            </div>
            <button onClick={() => setShowLogoutConfirm(true)} className="p-2 text-red-400 hover:text-red-300">
              <FiLogOut />
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 ml-64 flex flex-col">
        {/* TOP HEADER */}
        <DashboardHeader 
          activeTab={activeTab}
          userRole="receptionist"
          userName="Evode Munyensenga"
          userInitials="EM"
          userTitle="Main Reception"
          notifications={notifications}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
        />

        {/* PAGE CONTENT */}
        <main className="flex-1 p-6 overflow-auto">
          {/* DASHBOARD TAB */}
          {(activeTab === 'dashboard' && !showVisitorDetail) && (
            <div className="tab-content">
              {/* 3 KPI Cards Row  */}
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
                  <div className="w-8 h-30 rounded-lg bg-blue-50 flex items-center justify-center">
                    <FiUsers className="w-7 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-800">124</p>
                    <p className="text-sm text-gray-500">Total Visitors Today</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-blue-50 flex items-center justify-center">
                    <FiClock className="w-7 h-7 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-800">18</p>
                    <p className="text-sm text-gray-500">Active Now(Inside)</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-blue-50 flex items-center justify-center">
                    <FiCheckCircle className="w-7 h-7 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-800">86</p>
                    <p className="text-sm text-gray-500">Total Assigned</p>
                  </div>
                </div>
              </div>

              {/* Main Content - Table Card */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
                {/* Table Header with Search, Filter, and Export */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-blue-800">SEARCH VISITORS AND ASSIGN</h2>
                  <div className="flex gap-3 items-center">
                    {/* Search */}
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search visitors..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 w-64 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    {/* Status Filter Dropdown */}
                    <div className="relative">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="pl-4 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer"
                      >
                        <option value="all">All Status</option>
                        <option value="in_progress">IN_PROGRESS</option>
                        <option value="waiting">WAITING</option>
                        <option value="pending">PENDING</option>
                        <option value="completed">COMPLETED</option>
                      </select>
                      <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    
                    {/* Export Button with dropdown */}
                    <div className="relative">
                      <button 
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
                      >
                        <FiDownload className="w-4 h-4" />
                        Export
                        <FiChevronDown className="w-4 h-4" />
                      </button>
                      {showExportMenu && (
                        <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                          <button 
                            onClick={handleExportPDF}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg flex items-center gap-2"
                          >
                            <FiFile className="text-red-500" />
                            Export PDF
                          </button>
                          <button 
                            onClick={handleExportExcel}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <FiFileText className="text-green-500" />
                            Export Excel
                          </button>
                          <button 
                            onClick={handleExportCSV}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-b-lg flex items-center gap-2"
                          >
                            <FiFileText className="text-blue-500" />
                            Export CSV
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">VISITOR NAME</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">ID NUMBER</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">STATUS</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">CHECK-IN TIME</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">PHONE</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedVisitors.map((visitor) => (
                        <tr key={visitor.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-gray-800">{visitor.full_name}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-600">{visitor.identification}</p>
                          </td>
                          <td className="px-6 py-4">
                            <ServiceStatusBadge status={visitor.status} variant="receptionist" />
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-600">{visitor.check_in_time}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-600">{visitor.telephone}</p>
                          </td>
                          <td className="px-6 py-4">
                            {visitor.status === 'In_progress' ? (
                              <button className="p-2 text-gray-400 hover:text-gray-600">
                                <FiMoreVertical className="w-5 h-5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAssignClick(visitor)}
                                className="px-4 py-1.5 bg-blue-500 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                Assign
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination with < and > */}
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Showing {paginatedVisitors.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredVisitors.length)} of {filteredVisitors.length} entries
                  </p>
                  <div className="flex gap-2 items-center">
                    <button 
                      onClick={handlePrevPage}
                      disabled={currentPage === 1}
                      className="w-8 h-8 flex items-center justify-center text-gray-600 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      <FiChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => handlePageClick(page)}
                        className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium ${
                          currentPage === page
                            ? 'bg-blue-500 text-white'
                            : 'text-gray-600 border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button 
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="w-8 h-8 flex items-center justify-center text-gray-600 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Daily Insights - Line Chart at bottom of table */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="text-lg font-semibold text-gray-800 mb-1">Daily Insights</h3>
                <p className="text-sm text-gray-500 mb-4">Visitor Traffic by Hour</p>
                
                {/* Line Chart */}
                <div className="relative w-full h-64">
                  <svg viewBox="0 0 500 220" className="w-full h-full">
                    {/* Y-axis line */}
                    <line x1="40" y1="20" x2="40" y2="180" stroke="#9ca3af" strokeWidth="1" />
                    
                    {/* X-axis line */}
                    <line x1="40" y1="180" x2="480" y2="180" stroke="#9ca3af" strokeWidth="1" />
                    
                    {/* Y-axis labels */}
                    <text x="10" y="24" className="text-xs fill-gray-500">20</text>
                    <text x="10" y="64" className="text-xs fill-gray-500">15</text>
                    <text x="10" y="104" className="text-xs fill-gray-500">10</text>
                    <text x="10" y="144" className="text-xs fill-gray-500">5</text>
                    <text x="10" y="184" className="text-xs fill-gray-500">0</text>
                    
                    {/* Grid lines */}
                    <line x1="40" y1="20" x2="480" y2="20" stroke="#e5e7eb" strokeWidth="1" />
                    <line x1="40" y1="60" x2="480" y2="60" stroke="#e5e7eb" strokeWidth="1" />
                    <line x1="40" y1="100" x2="480" y2="100" stroke="#e5e7eb" strokeWidth="1" />
                    <line x1="40" y1="140" x2="480" y2="140" stroke="#e5e7eb" strokeWidth="1" />
                    
                    {/* X-axis labels */}
                    <text x="55" y="195" className="text-xs fill-gray-500">8AM</text>
                    <text x="125" y="195" className="text-xs fill-gray-500">9AM</text>
                    <text x="200" y="195" className="text-xs fill-gray-500">10AM</text>
                    <text x="275" y="195" className="text-xs fill-gray-500">11AM</text>
                    <text x="350" y="195" className="text-xs fill-gray-500">12PM</text>
                    <text x="425" y="195" className="text-xs fill-gray-500">1PM</text> 
                    
                    {/* Avg label at end of X-axis */}
                    <text x="480" y="195" className="text-xs fill-gray-500" textAnchor="end">Avg: 12/hr</text>
                    
                    {/* Peak label at bottom */}
                    <text x="125" y="210" className="text-xs fill-black-500 font-medium" textAnchor="middle">Peak: 9AM</text>
                    
                    {/* Area under the curved line */}
                    <defs>
                      <linearGradient id="areaGradient" x1="1" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    <path
                      d={`M 55 ${180 - (HOURLY_VISITORS[0].count / 20 * 160)} Q 90 ${180 - (HOURLY_VISITORS[0].count / 20 * 160)} 125 ${180 - (HOURLY_VISITORS[1].count / 20 * 160)} Q 162 ${180 - (HOURLY_VISITORS[1].count / 20 * 160)} 200 ${180 - (HOURLY_VISITORS[2].count / 20 * 160)} Q 237 ${180 - (HOURLY_VISITORS[2].count / 20 * 160)} 275 ${180 - (HOURLY_VISITORS[3].count / 20 * 160)} Q 312 ${180 - (HOURLY_VISITORS[3].count / 20 * 160)} 350 ${180 - (HOURLY_VISITORS[4].count / 20 * 160)} Q 387 ${180 - (HOURLY_VISITORS[4].count / 20 * 160)} 425 ${180 - (HOURLY_VISITORS[5].count / 20 * 160)} L 425 180 L 55 180 Z`}
                      fill="url(#areaGradient)"
                    />
                    
                    {/* Curved line connecting points */}
                    <path
                      d={`M 55 ${180 - (HOURLY_VISITORS[0].count / 20 * 160)} Q 90 ${180 - (HOURLY_VISITORS[0].count / 20 * 160)} 125 ${180 - (HOURLY_VISITORS[1].count / 20 * 160)} Q 162 ${180 - (HOURLY_VISITORS[1].count / 20 * 160)} 200 ${180 - (HOURLY_VISITORS[2].count / 20 * 160)} Q 237 ${180 - (HOURLY_VISITORS[2].count / 20 * 160)} 275 ${180 - (HOURLY_VISITORS[3].count / 20 * 160)} Q 312 ${180 - (HOURLY_VISITORS[3].count / 20 * 160)} 350 ${180 - (HOURLY_VISITORS[4].count / 20 * 160)} Q 387 ${180 - (HOURLY_VISITORS[4].count / 20 * 160)} 425 ${180 - (HOURLY_VISITORS[5].count / 20 * 160)}`}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2"
                    />
                    
                    {/* Data points with circles */}
                    {HOURLY_VISITORS.map((item, index) => {
                      const x = 55 + index * 70;
                      const y = 180 - (item.count / 20 * 160);
                      return (
                        <g key={index}>
                          <circle cx={x} cy={y} r="5" fill="#3b82f6" stroke="white" strokeWidth="2" />
                          <text x={x} y={y - 10} textAnchor="middle" className="text-xs fill-gray-700 font-medium">{item.count}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* VISITOR DETAIL VIEW */}
          {showVisitorDetail && selectedVisitor && (
            <div className="bg-white rounded-xl shadow-sm">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setShowVisitorDetail(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <FiArrowLeft className="text-gray-600" />
                  </button>
                  <h2 className="text-lg font-semibold text-gray-800">Visitor Tracking</h2>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <FiMoreVertical className="text-gray-600" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* Visitor Information Card */}
                  <div className="bg-gray-50 rounded-xl p-5">
                    <h3 className="text-sm font-medium text-gray-500 mb-4">VISITOR INFORMATION</h3>
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                        <FiUsers className="text-blue-600 text-2xl" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-lg">{selectedVisitor.full_name}</p>
                        <p className="text-sm text-gray-500">National ID: {selectedVisitor.identification}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="text-sm font-medium text-gray-800">{selectedVisitor.telephone}</p>
                      </div>
                      {selectedVisitor.email && (
                        <div>
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="text-sm font-medium text-gray-800">{selectedVisitor.email}</p>
                        </div>
                      )}
                      {selectedVisitor.address && (
                        <div>
                          <p className="text-xs text-gray-500">Address</p>
                          <p className="text-sm font-medium text-gray-800">{selectedVisitor.address}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Visit Details Card */}
                  <div className="bg-gray-50 rounded-xl p-5">
                    <h3 className="text-sm font-medium text-gray-500 mb-4">VISIT DETAILS</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <p className="text-xs text-gray-500">Service Type</p>
                        <p className="text-sm font-medium text-gray-800">{selectedVisitor.service}</p>
                      </div>
                      <div className="flex justify-between">
                        <p className="text-xs text-gray-500">Purpose</p>
                        <p className="text-sm font-medium text-gray-800">{selectedVisitor.purpose || 'N/A'}</p>
                      </div>
                      <div className="flex justify-between">
                        <p className="text-xs text-gray-500">Department</p>
                        <p className="text-sm font-medium text-gray-800">{selectedVisitor.department}</p>
                      </div>
                      {selectedVisitor.assignedStaff && (
                        <div className="flex justify-between">
                          <p className="text-xs text-gray-500">Assigned Staff</p>
                          <p className="text-sm font-medium text-gray-800">{selectedVisitor.assignedStaff}</p>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <p className="text-xs text-gray-500">Check-in Time</p>
                        <p className="text-sm font-medium text-gray-800">{selectedVisitor.check_in_time}</p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-500">Status</p>
                        <ServiceStatusBadge status={selectedVisitor.status} variant="receptionist" size="sm" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="mt-6 bg-gray-50 rounded-xl p-5">
                  <h3 className="text-sm font-medium text-gray-500 mb-4">TRACKING</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <div className="w-0.5 h-16 bg-green-500"></div>
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-gray-800">Checked In</p>
                      <p className="text-xs text-gray-500">09:30 AM</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <div className="w-0.5 h-16 bg-green-500"></div>
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-gray-800">Assigned to {selectedVisitor.department} Department</p>
                      <p className="text-xs text-gray-500">09:35 AM</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <div className="w-0.5 h-16 bg-blue-500"></div>
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-gray-800">Assigned to Staff {selectedVisitor.assignedStaff || 'N/A'}</p>
                      <p className="text-xs text-gray-500">09:40 AM</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">In Progress</p>
                      <p className="text-xs text-gray-500">Currently in progress</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
                    Transfer Department
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ASSIGNED VISITORS TAB */}
          {activeTab === 'visitors' && !showVisitorDetail && (
            <div className="tab-content">
              <AssignedVisitorsList visitors={assignedVisitors.map(v => ({
                id: v.id,
                fullName: v.full_name,
                nationalId: v.identification,
                service: v.service || 'General Inquiry',
                department: v.department || 'General',
                assignmentTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                status: v.status === 'In_progress' ? 'inprogress' : v.status,
                phone: v.telephone,
                checkInTime: v.check_in_time,
              }))} />
            </div>
          )}

          {/* DEPT AVAILABILITY TAB */}
          {activeTab === 'availability' && !showVisitorDetail && (
            <div className="tab-content">
              <DepartmentAvailability />
            </div>
          )}
        </main>
      </div>

      {/* ASSIGN VISITOR MODAL - Using separate component with blur effect */}
      <AssignVisitorModal
        isOpen={showAssignModal}
        onClose={handleCloseModal}
        visitor={selectedVisitor}
        departments={DEPARTMENTS}
        selectedDepartment={selectedDepartment}
        selectedService={selectedService}
        serviceDescription={serviceDescription}
        onSelectDepartment={handleDepartmentSelect}
        onSelectService={handleServiceSelect}
        onServiceDescriptionChange={handleServiceDescriptionChange}
        onConfirm={handleConfirmAssignment}
        showSuccessMessage={showSuccessMessage}
        successMessage={successMessage}
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
      
      {/* Notification Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => {
              setShowNotificationModal(false);
              setSelectedNotification(null);
            }}
          ></div>
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Notifications</h2>
              <button 
                onClick={() => setShowNotificationModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-4 max-h-96 overflow-y-auto">
              {selectedNotification ? (
                // Show selected notification details
                <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{selectedNotification.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{selectedNotification.message}</p>
                      <p className="text-xs text-gray-400 mt-2">{selectedNotification.time}</p>
                    </div>
                  </div>
                </div>
              ) : (
                // Show all notifications
                notifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className={`p-4 mb-3 rounded-lg border ${notification.read ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-blue-50'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{notification.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                        <p className="text-xs text-gray-400 mt-2">{notification.time}</p>
                      </div>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowNotificationModal(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceptionistDashboard;



