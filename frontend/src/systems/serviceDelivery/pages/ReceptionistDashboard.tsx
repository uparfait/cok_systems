// ReceptionistDashboard Page - MainLayout Compatible + Figma UI Content
// INTEGRATED WITH BACKEND APIs

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  FiSearch, FiUsers, FiClock, FiCheckCircle, FiMoreVertical, FiChevronDown,
  FiDownload, FiChevronLeft, FiChevronRight
} from "react-icons/fi";

// Import API Services
import { serviceDeliveryService, departmentService, statisticsService, employeeService } from "../../../core/services/adminService";
import { useAuth } from "../../../core/contexts/AuthContext";

// Import components
import AssignedVisitorsList from "../components/departmentFlow/AssignedVisitorsList";
import AssignVisitorModal from "../components/departmentFlow/AssignVisitorModal";
import DepartmentAvailability from "../components/departmentFlow/DepartmentAvailability";

// Types - Matching your backend structure
interface Visitor {
  _id?: string;
  id?: string;
  name?: string;
  full_name?: string;
  visitorName?: string;
  identification?: string | { number?: string };
  telephone?: string;
  email?: string;
  address?: string;
  status: string;
  checkInTime?: string;
  check_in_time?: string;
  entry_date?: string;
  department?: string;
  departmentName?: string;
  service?: string;
  purpose?: string;
  assignedStaff?: string;
  departments_assigned?: Array<{
    department_id: string;
    department_name?: string;
    status: string;
  }>;
}

const ReceptionistDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  // State
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'visitors' | 'availability'>(
    tabParam === 'visitors' ? 'visitors' : tabParam === 'availability' ? 'availability' : 'dashboard'
  );
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // LIVE DATA STATES
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Hourly visitor data for graph
  const [hourlyData, setHourlyData] = useState<{hour: number; visitors_checked_in: number}[]>([]);
  const [hoveredHour, setHoveredHour] = useState<{hour: number; visitors: number} | null>(null);
  
  // Department visitor counts
  const [departmentVisitorCounts, setDepartmentVisitorCounts] = useState<Record<string, number>>({});
  
  // Employee data for assignment
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [selectedDeptForAssignment, setSelectedDeptForAssignment] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');

  // Modal States
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  // Handle employee selection with queue count
  const handleSelectEmployee = async (employee: any) => {
    setSelectedEmployee(employee);
    setEmployeeQueueCount(0);
    
    if (employee && employee._id) {
      try {
        const res = await serviceDeliveryService.getCurrentVisitorsByProvider(employee._id);
        if (res.success && res.data) {
          const providerData = res.data.find((p: any) => p.provider_id === employee._id);
          setEmployeeQueueCount(providerData?.count || 0);
        }
      } catch (error) {
        console.error("Failed to fetch employee queue:", error);
      }
    }
  };
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [employeeQueueCount, setEmployeeQueueCount] = useState(0);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Update tab when URL changes (Driven by MainLayout Sidebar)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'visitors') setActiveTab('visitors');
    else if (tab === 'availability') setActiveTab('availability');
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
    const isSearch = searchTerm && searchTerm.trim();
    setIsLoading(true);
    if (isSearch) {
      setSearchLoading(true);
    }
    try {
      let visitorRes;
      
      // Use backend search if searchTerm exists, otherwise get all
      if (searchTerm && searchTerm.trim()) {
        visitorRes = await serviceDeliveryService.search(searchTerm, currentPage, 20);
      } else {
        visitorRes = await serviceDeliveryService.getAll(currentPage, 20);
      }

      if (visitorRes.status || visitorRes.success) {
        let allVisitors = Array.isArray(visitorRes.data) ? visitorRes.data : [];
        
        // Filter to show only unassigned visitors (departments_assigned is empty or undefined)
        const visitorData = allVisitors.filter((v: any) => {
          const deptAssigned = v.departments_assigned;
          return !deptAssigned || !Array.isArray(deptAssigned) || deptAssigned.length === 0;
        });
        setVisitors(visitorData);
        setTotalCount(visitorRes.total || 0);
        
        // Calculate visitor counts per department
        const counts: Record<string, number> = {};
        visitorData.forEach((v: any) => {
          if (v.department) {
            counts[v.department] = (counts[v.department] || 0) + 1;
          }
        });
        setDepartmentVisitorCounts(counts);
      }
      
      // Load departments
      const deptResponse = await departmentService.getAll();
      if (deptResponse.status || deptResponse.success) {
        const deptData = Array.isArray(deptResponse.data) ? deptResponse.data : [];
        setDepartments(deptData);
      }
      
      // Load hourly stats
      const hourlyResponse = await statisticsService.getHourlyServiceDeliveryStats();
      if (hourlyResponse.success) {
        setHourlyData(hourlyResponse.data?.hourly || hourlyResponse.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentPage]);

  // Format Departments for the Modal
  const formattedDepartments = departments.map(dept => ({
    id: dept._id || dept.department_id,
    name: dept.department_name || dept.name,
    staffAvailable: dept.total_employees || dept.employees || 0,
    currentQueue: departmentVisitorCounts[dept.department_name || dept.name] || 0,
    isActive: dept.status === 'Active'
  }));

  // Helper functions
  const getIdentification = (visitor: Visitor): string => {
    if (!visitor.identification) return 'N/A';
    if (typeof visitor.identification === 'string') return visitor.identification;
    if (typeof visitor.identification === 'object' && visitor.identification.number) {
      return visitor.identification.number;
    }
    return 'N/A';
  };

  const getVisitorName = (visitor: Visitor): string => {
    return visitor.full_name || visitor.name || visitor.visitorName || 'Unknown';
  };

  const getCheckInTime = (visitor: Visitor): string => {
    if (visitor.checkInTime) return new Date(visitor.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    if (visitor.check_in_time) return new Date(visitor.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    if (visitor.entry_date) return new Date(visitor.entry_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    return 'Just now';
  };

  // Filtering Visitors
  // Use visitors directly from backend (already paginated)
  const paginatedVisitors = visitors;
  
  // Backend handles search and pagination - no frontend filtering needed
  // Pagination calculation using totalCount from backend
  const itemsPerPage = 20;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Derived Stats - use totalCount from backend
  const totalVisitors = totalCount;
  const activeVisitors = Array.isArray(visitors) ? visitors.filter(v => v.status === 'In_progress' || v.status === 'Inside').length : 0;
  const assignedCount = Array.isArray(visitors) ? visitors.filter(v => v.department && v.department !== 'General').length : 0;

  useEffect(() => {
    loadData();
  }, [currentPage, searchTerm]);

  // Load employees when department is selected
  const loadEmployeesByDepartment = async (departmentId: string) => {
    try {
      const res = await employeeService.getByDepartment(departmentId);
      if (res.success) {
        setEmployees(res.data || []);
      }
    } catch (error) {
      console.error("Failed to load employees:", error);
    }
  };

  // Assignment Handlers
  const handleAssignClick = async (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setShowAssignModal(true);
    setEmployeesLoading(true);
    
    // Load all departments' employees when modal opens
    try {
      const res = await employeeService.getAll();
      if (res.success) {
        setEmployees(res.data || []);
      }
    } catch (error) {
      console.error("Failed to load employees:", error);
    } finally {
      setEmployeesLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowAssignModal(false);
    setSelectedVisitor(null);
    setSelectedDepartment('');
    setSelectedEmployee(null);
    setEmployeeQueueCount(0);
    setEmployeesLoading(false);
  };

  const handleConfirmAssignment = async () => {
    if (selectedVisitor && selectedDepartment) {
      setIsAssigning(true);
      try {
        const visitorId = selectedVisitor._id || selectedVisitor.id;
        const dept = formattedDepartments.find(d => d.id === selectedDepartment);
        const departmentName = dept?.name || '';
        
        await serviceDeliveryService.assignToDepartment(
          visitorId as string, 
          selectedDepartment,
          departmentName,
          selectedEmployee?._id,
          selectedEmployee?.full_name
        );
        
        setSuccessMessage(`Assignment successful! Visitor assigned to ${departmentName}${selectedEmployee ? ` with ${selectedEmployee.full_name}` : ''}`);
        setShowSuccessMessage(true);
        
        await loadData();

        setTimeout(() => {
          setShowSuccessMessage(false);
          handleCloseModal();
        }, 2000);
      } catch (error) {
        console.error("Failed to assign visitor:", error);
        alert("Failed to assign visitor. Please try again.");
      } finally {
        setIsAssigning(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Note: We REMOVED the horizontal tabs here. 
        Navigation is now handled purely by the MainLayout sidebar and the ?tab= parameter in the URL. 
      */}

      {/* DASHBOARD TAB CONTENT */}
      {activeTab === 'dashboard' && (
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* KPI Cards (Figma Styled) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                <FiUsers className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-xs text-gray-500 font-medium mb-1">Today's Total Visitors</p>
              <p className="text-4xl font-bold text-gray-800">{totalVisitors}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center mb-4">
                <FiClock className="w-5 h-5 text-yellow-500" />
              </div>
              <p className="text-xs text-gray-500 font-medium mb-1">Active Now (Inside)</p>
              <p className="text-4xl font-bold text-gray-800">{activeVisitors}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center mb-4">
                <FiCheckCircle className="w-5 h-5 text-teal-500" />
              </div>
              <p className="text-xs text-gray-500 font-medium mb-1">Total Assigned</p>
              <p className="text-4xl font-bold text-gray-800">{assignedCount}</p>
            </div>
          </div>

          {/* Chart Section - Now above the table */}
          <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-bold text-gray-800 mb-1">Daily Insights</h3>
            <p className="text-xs text-gray-400 mb-4">Visitor traffic by hour</p>
            {hourlyData.length > 0 ? (
              <div className="relative w-full h-72">
                <svg viewBox="0 0 800 280" className="w-full h-full" preserveAspectRatio="none">
                  {/* Background gradient */}
                  <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="50%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid lines - horizontal */}
                  {/* Grid lines - horizontal with dynamic increment based on PEAK hour */}
                  {(() => {
                    const maxHourly = Math.max(...hourlyData.map(h => h.visitors_checked_in), 0);
                    let increment = 1;
                    if (maxHourly > 1000) increment = 1000;
                    else if (maxHourly > 100) increment = 100;
                    else if (maxHourly > 10) increment = 10;
                    else increment = 1;
                    
                    const maxVal = Math.max(maxHourly, increment);
                    const numTicks = Math.ceil(maxVal / increment) + 1;
                    const yStep = 220 / (numTicks - 1);
                    
                    return Array.from({ length: numTicks }, (_, i) => (
                      <line 
                        key={`h-${i}`} 
                        x1="45" y1={30 + i * yStep} x2="780" y2={30 + i * yStep} 
                        stroke="#f3f4f6" strokeWidth="1" 
                      />
                    ));
                  })()}
                  
                  {/* Grid lines - vertical - all 24 hours */}
                  {Array.from({ length: 24 }, (_, hour) => (
                    <line 
                      key={`v-${hour}`} 
                      x1={45 + (hour / 23) * 735} y1="30" x2={45 + (hour / 23) * 735} y2="250" 
                      stroke="#f3f4f6" strokeWidth="1" 
                    />
                  ))}
                  
                  {/* Y-axis labels - dynamic increment based on PEAK hour */}
                  {(() => {
                    const maxHourly = Math.max(...hourlyData.map(h => h.visitors_checked_in), 0);
                    let increment = 1;
                    if (maxHourly > 1000) increment = 1000;
                    else if (maxHourly > 100) increment = 100;
                    else if (maxHourly > 10) increment = 10;
                    else increment = 1;
                    
                    const maxVal = Math.max(maxHourly, increment);
                    const numTicks = Math.ceil(maxVal / increment) + 1;
                    return Array.from({ length: numTicks }, (_, i) => i * increment).map((val) => (
                      <text key={`y-${val}`} x="40" y={274 - (val / maxVal) * 220} className="text-[9px] fill-gray-400" textAnchor="end" dominantBaseline="middle">
                        {val}
                      </text>
                    ));
                  })()}
                  
                  {/* X-axis labels - all 24 hours with AM/PM */}
                  {Array.from({ length: 24 }, (_, hour) => (
                    <text 
                      key={`x-${hour}`} 
                      x={45 + (hour / 23) * 735} y="268" 
                      className="text-[8px] fill-gray-400" textAnchor="middle"
                    >
                      {hour === 0 ? '12am' : hour === 12 ? '12pm' : hour > 12 ? `${hour-12}pm` : `${hour}am`}
                    </text>
                  ))}
                  
                  {/* Vertical line passing through data points */}
                  {hourlyData.filter(h => h.visitors_checked_in > 0).map((h) => {
                    const maxHourly = Math.max(...hourlyData.map(h => h.visitors_checked_in), 0);
                    let increment = 1;
                    if (maxHourly > 1000) increment = 1000;
                    else if (maxHourly > 100) increment = 100;
                    else if (maxHourly > 10) increment = 10;
                    else increment = 1;
                    const maxVal = Math.max(maxHourly, increment);
                    const x = 45 + (h.hour / 23) * 735;
                    return (
                      <line 
                        key={`vline-${h.hour}`}
                        x1={x} y1="30" x2={x} y2="250" 
                        stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="3,3"
                      />
                    );
                  })}
                  
                  {/* Area under the line */}
                  <path 
                    d={`M 45 250 ${hourlyData.map((h) => {
                      const maxHourly = Math.max(...hourlyData.map(h => h.visitors_checked_in), 0);
                      let increment = 1;
                      if (maxHourly > 1000) increment = 1000;
                      else if (maxHourly > 100) increment = 100;
                      else if (maxHourly > 10) increment = 10;
                      else increment = 1;
                      const maxVal = Math.max(maxHourly, increment);
                      const x = 45 + (h.hour / 23) * 735;
                      const y = 250 - (h.visitors_checked_in / maxVal) * 220;
                      return `L ${x} ${y}`;
                    }).join(' ')} L 780 250 Z`}
                    fill="url(#areaGradient)" 
                  />
                  
                  {/* Smooth curved line */}
                  <path 
                    d={`M ${hourlyData.map((h, i) => {
                      const maxHourly = Math.max(...hourlyData.map(h => h.visitors_checked_in), 0);
                      let increment = 1;
                      if (maxHourly > 1000) increment = 1000;
                      else if (maxHourly > 100) increment = 100;
                      else if (maxHourly > 10) increment = 10;
                      else increment = 1;
                      const maxVal = Math.max(maxHourly, increment);
                      const x = 45 + (h.hour / 23) * 735;
                      const y = 250 - (h.visitors_checked_in / maxVal) * 220;
                      
                      if (i === 0) return `M ${x} ${y}`;
                      
                      const prevMaxHourly = Math.max(...hourlyData.slice(0, i).map(h => h.visitors_checked_in), 0);
                      let prevIncrement = 1;
                      if (prevMaxHourly > 1000) prevIncrement = 1000;
                      else if (prevMaxHourly > 100) prevIncrement = 100;
                      else if (prevMaxHourly > 10) prevIncrement = 10;
                      else prevIncrement = 1;
                      const prevMaxVal = Math.max(prevMaxHourly, prevIncrement);
                      const prevX = 45 + (hourlyData[i-1].hour / 23) * 735;
                      const prevY = 250 - (hourlyData[i-1].visitors_checked_in / prevMaxVal) * 220;
                      
                      const cpX = (prevX + x) / 2;
                      return `Q ${cpX} ${prevY} ${x} ${y}`;
                    }).join(' ')}`}
                    fill="none" 
                    stroke="url(#lineGradient)" 
                    strokeWidth="2.5" 
                    strokeLinecap="round"
                  />
                  
                  {/* Small data points with hover tooltip */}
                  {hourlyData.filter(h => h.visitors_checked_in > 0).map((h) => {
                    const maxHourly = Math.max(...hourlyData.map(h => h.visitors_checked_in), 0);
                    let increment = 1;
                    if (maxHourly > 1000) increment = 1000;
                    else if (maxHourly > 100) increment = 100;
                    else if (maxHourly > 10) increment = 10;
                    else increment = 1;
                    const maxVal = Math.max(maxHourly, increment);
                    const x = 45 + (h.hour / 23) * 735;
                    const y = 250 - (h.visitors_checked_in / maxVal) * 220;
                    return (
                      <g 
                        key={h.hour}
                        onMouseEnter={() => setHoveredHour({ hour: h.hour, visitors: h.visitors_checked_in })}
                        onMouseLeave={() => setHoveredHour(null)}
                        className="cursor-pointer"
                      >
                        <circle cx={x} cy={y} r="4" fill="#fff" stroke="url(#lineGradient)" strokeWidth="2" />
                        <circle cx={x} cy={y} r="2" fill="#06b6d4" />
                      </g>
                    );
                  })}
                  
                  {/* Tooltip */}
                  {hoveredHour && (() => {
                    const maxHourly = Math.max(...hourlyData.map(h => h.visitors_checked_in), 0);
                    let increment = 1;
                    if (maxHourly > 1000) increment = 1000;
                    else if (maxHourly > 100) increment = 100;
                    else if (maxHourly > 10) increment = 10;
                    else increment = 1;
                    const maxVal = Math.max(maxHourly, increment);
                    const x = 45 + (hoveredHour.hour / 23) * 735;
                    const y = 250 - (hoveredHour.visitors / maxVal) * 220;
                    return (
                      <g>
                        <rect 
                          x={x - 35} 
                          y={y - 45} 
                          width="70" 
                          height="32" 
                          rx="6" 
                          fill="#1f2937" 
                        />
                        <text 
                          x={x} 
                          y={y - 30} 
                          textAnchor="middle" 
                          className="text-xs fill-white font-medium"
                        >
                          {hoveredHour.hour}:00
                        </text>
                        <text 
                          x={x} 
                          y={y - 14} 
                          textAnchor="middle" 
                          className="text-[10px] fill-cyan-400 font-bold"
                        >
                          {hoveredHour.visitors} visitors
                        </text>
                      </g>
                    );
                  })()}
                </svg>
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center text-gray-400">
                No hourly data available
              </div>
            )}
            
            {/* Stats below chart - well designed */}
            {hourlyData.length > 0 && (
              <div className="flex justify-center gap-8 mt-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Peak Hour</p>
                  <p className="text-lg font-bold bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
                    {hourlyData.find(h => h.visitors_checked_in === Math.max(...hourlyData.map(d => d.visitors_checked_in), 0))?.hour || 0}:00
                  </p>
                  <p className="text-xs text-gray-400">
                    {Math.max(...hourlyData.map(h => h.visitors_checked_in), 0)} visitors
                  </p>
                </div>
                <div className="w-px bg-gray-200"></div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Total Today</p>
                  <p className="text-lg font-bold text-gray-800">
                    {hourlyData.reduce((sum, h) => sum + h.visitors_checked_in, 0)}
                  </p>
                  <p className="text-xs text-gray-400">visitors</p>
                </div>
              </div>
            )}
          </div>

          {/* Table Card (Figma Styled) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex flex-wrap items-center justify-between bg-white gap-4">
              <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wide">SEARCH VISITORS AND ASSIGN</h2>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative">
                  {searchLoading ? (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  )}
                  <input
                    type="text"
                    placeholder="Search Badge, Name, or Phone"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`pl-9 pr-4 py-2 w-72 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 ${searchLoading ? 'opacity-50' : ''}`}
                  />
                </div>
                <button onClick={() => setShowExportMenu(!showExportMenu)} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors">
                  <FiDownload className="w-3 h-3" /> Export
                </button>
              </div>
            </div>

            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-4">VISITOR NAME</th>
                    <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-4">ID NUMBER</th>
                    <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-4">STATUS</th>
                    <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-4">CHECK-IN TIME</th>
                    <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-4">PHONE</th>
                    <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-4">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={6} className="text-center py-8 text-sm text-gray-500">Loading live data...</td></tr>
                  ) : paginatedVisitors.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-sm text-gray-500">No visitors found.</td></tr>
                  ) : (
                    paginatedVisitors.map((visitor) => (
                      <tr key={visitor._id || visitor.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                            {getVisitorName(visitor).substring(0,2).toUpperCase()}
                          </div>
                          <p className="text-sm font-semibold text-gray-800">{getVisitorName(visitor)}</p>
                        </td>
                        <td className="px-6 py-4"><p className="text-xs text-gray-600 font-medium">{getIdentification(visitor)}</p></td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${visitor.status === 'In_progress' || visitor.status === 'Inside' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'}`}>
                            {visitor.status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4"><p className="text-xs font-semibold text-gray-800">{getCheckInTime(visitor)}</p></td>
                        <td className="px-6 py-4"><p className="text-xs text-gray-600">{visitor.telephone || 'N/A'}</p></td>
                        <td className="px-6 py-4">
                          {(visitor.status === 'In_progress' || visitor.status === 'Inside') ? (
                            <button className="p-2 text-gray-400 hover:text-blue-600 cursor-not-allowed">
                              <FiMoreVertical className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAssignClick(visitor)}
                              className="px-5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-md transition-colors shadow-sm"
                            >
                              Assign
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Showing {paginatedVisitors.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} entries
              </p>
              <div className="flex gap-1">
                <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="w-6 h-6 flex items-center justify-center text-gray-400 border border-gray-200 rounded text-xs hover:bg-gray-50 disabled:opacity-50"><FiChevronLeft/></button>
                {Array.from({length: totalPages}, (_, i) => (
                  <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-6 h-6 flex items-center justify-center rounded text-xs font-medium ${currentPage === i + 1 ? 'bg-blue-500 text-white' : 'text-gray-600 border border-gray-200'}`}>{i + 1}</button>
                ))}
                <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="w-6 h-6 flex items-center justify-center text-gray-400 border border-gray-200 rounded text-xs hover:bg-gray-50 disabled:opacity-50"><FiChevronRight/></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGNED VISITORS TAB CONTENT */}
      {activeTab === 'visitors' && (
        <div className="max-w-7xl mx-auto">
          <AssignedVisitorsList visitors={visitors.filter(v => v.department).map(v => ({
            id: String(v._id || v.id || ''),
            fullName: getVisitorName(v),
            nationalId: getIdentification(v),
            service: String(v.service || 'General Inquiry'),
            department: String(v.department || v.departmentName || 'General'),
            assignmentTime: getCheckInTime(v),
            status: String(v.status || 'pending'),
            phone: String(v.telephone || ''),
            checkInTime: getCheckInTime(v),
          }))} />
        </div>
      )}

      {/* DEPARTMENT AVAILABILITY TAB CONTENT */}
      {activeTab === 'availability' && (
        <div className="max-w-7xl mx-auto">
          <DepartmentAvailability 
            departments={formattedDepartments}
            visitorCounts={departmentVisitorCounts}
          />
        </div>
      )}

      {/* MODALS */}
      <AssignVisitorModal
        isOpen={showAssignModal}
        onClose={handleCloseModal}
        visitor={selectedVisitor as any}
        departments={formattedDepartments}
        employees={employees}
        selectedDepartment={selectedDepartment}
        selectedEmployee={selectedEmployee}
        employeeQueueCount={employeeQueueCount}
        onSelectDepartment={setSelectedDepartment}
        onSelectEmployee={handleSelectEmployee}
        onConfirm={handleConfirmAssignment}
        showSuccessMessage={showSuccessMessage}
        successMessage={successMessage}
        isLoading={isAssigning}
        employeesLoading={employeesLoading}
      />
    </div>
  );
};

export default ReceptionistDashboard;