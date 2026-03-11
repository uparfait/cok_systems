// ReceptionistDashboard Page - MainLayout Compatible + Figma UI Content
// INTEGRATED WITH BACKEND APIs

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  FiSearch, FiUsers, FiClock, FiCheckCircle, FiMoreVertical, FiChevronDown,
  FiDownload, FiChevronLeft, FiChevronRight
} from "react-icons/fi";

// Import API Services
import { serviceDeliveryService, departmentService } from "../../../core/services/adminService";
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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // LIVE DATA STATES
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

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
    setIsLoading(true);
    try {
      const [visitorRes, deptRes] = await Promise.all([
        serviceDeliveryService.getAll(),
        departmentService.getAll()
      ]);

      if (visitorRes.status || visitorRes.success) {
        const visitorData = Array.isArray(visitorRes.data) ? visitorRes.data : [];
        setVisitors(visitorData);
      }
      if (deptRes.status || deptRes.success) {
        const deptData = Array.isArray(deptRes.data) ? deptRes.data : [];
        setDepartments(deptData);
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

  // Format Departments for the Modal
  const formattedDepartments = departments.map(dept => ({
    id: dept._id || dept.department_id,
    name: dept.department_name || dept.name,
    staffAvailable: dept.total_employees || dept.employees || 0,
    currentQueue: 0,
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
  const filteredVisitors = visitors.filter(visitor => {
    const vName = getVisitorName(visitor);
    const vId = getIdentification(visitor);
    const vPhone = visitor.telephone || '';
    const vStatus = visitor.status || 'pending';

    const matchesSearch = !searchTerm ? true : 
      vName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vId.includes(searchTerm) ||
      vPhone.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' ? true : 
      vStatus.toLowerCase().replace('_', '') === statusFilter.toLowerCase().replace('_', '');
    
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const itemsPerPage = 5;
  const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage);
  const paginatedVisitors = filteredVisitors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Derived Stats
  const totalVisitors = Array.isArray(visitors) ? visitors.length : 0;
  const activeVisitors = Array.isArray(visitors) ? visitors.filter(v => v.status === 'In_progress' || v.status === 'Inside').length : 0;
  const assignedCount = Array.isArray(visitors) ? visitors.filter(v => v.department && v.department !== 'General').length : 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Assignment Handlers
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

  const handleConfirmAssignment = async () => {
    if (selectedVisitor && selectedDepartment) {
      setIsAssigning(true);
      try {
        const visitorId = selectedVisitor._id || selectedVisitor.id;
        await serviceDeliveryService.assignToDepartment(visitorId as string, selectedDepartment);
        
        const dept = formattedDepartments.find(d => d.id === selectedDepartment);
        setSuccessMessage(`Assignment successful! Visitor assigned to ${dept?.name || 'department'}`);
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

          {/* Table Card (Figma Styled) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex flex-wrap items-center justify-between bg-white gap-4">
              <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wide">SEARCH VISITORS AND ASSIGN</h2>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by ID, Name, or Phone Number"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 w-72 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  />
                </div>
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="in_progress">In Progress</option>
                    <option value="pending">Pending</option>
                  </select>
                  <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
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
                Showing {paginatedVisitors.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredVisitors.length)} of {filteredVisitors.length} entries
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

          {/* Chart Section (Figma Styled) */}
          <div className="w-full md:w-1/2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-bold text-gray-800 mb-1">Daily Insights</h3>
            <p className="text-xs text-gray-400 mb-6">Visitor traffic by hour</p>
            <div className="relative w-full h-48">
              <svg viewBox="0 0 500 200" className="w-full h-full">
                <line x1="40" y1="160" x2="480" y2="160" stroke="#e5e7eb" strokeWidth="2" />
                <text x="55" y="180" className="text-[10px] fill-gray-400 font-bold">8am</text>
                <text x="125" y="180" className="text-[10px] fill-gray-400 font-bold">9am</text>
                <text x="200" y="180" className="text-[10px] fill-gray-400 font-bold">10am</text>
                <text x="275" y="180" className="text-[10px] fill-gray-400 font-bold">11am</text>
                <text x="350" y="180" className="text-[10px] fill-gray-400 font-bold">12pm</text>
                <text x="425" y="180" className="text-[10px] fill-gray-400 font-bold">1pm</text> 
                <path d={`M 55 140 Q 90 60 125 40 Q 162 60 200 90 Q 237 100 275 80 Q 312 90 350 130 Q 387 140 425 90`} fill="none" stroke="#38bdf8" strokeWidth="3" />
                {[55,125,200,275,350,425].map((x, i) => (
                   <circle key={i} cx={x} cy={[140,40,90,80,130,90][i]} r="4" fill="#fff" stroke="#38bdf8" strokeWidth="2" />
                ))}
              </svg>
              <div className="flex justify-between mt-2 px-8">
                 <p className="text-xs font-bold text-gray-800">Peak: 9:00 AM</p>
                 <p className="text-xs font-bold text-gray-800">Avg: 12/hr</p>
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
          <DepartmentAvailability />
        </div>
      )}

      {/* MODALS */}
      <AssignVisitorModal
        isOpen={showAssignModal}
        onClose={handleCloseModal}
        visitor={selectedVisitor as any}
        departments={formattedDepartments}
        selectedDepartment={selectedDepartment}
        selectedService={selectedService}
        serviceDescription={serviceDescription}
        onSelectDepartment={setSelectedDepartment}
        onSelectService={setSelectedService}
        onServiceDescriptionChange={setServiceDescription}
        onConfirm={handleConfirmAssignment}
        showSuccessMessage={showSuccessMessage}
        successMessage={successMessage}
      />
    </div>
  );
};

export default ReceptionistDashboard;