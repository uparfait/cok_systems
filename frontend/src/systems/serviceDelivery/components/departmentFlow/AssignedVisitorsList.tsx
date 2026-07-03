
// export default AssignedVisitorsList;
// AssignedVisitorsList Component - Exact Figma Design Implementation

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { 
  FiSearch, FiFile, FiFileText, FiEdit, FiFilter,
  FiCheck, FiArrowRight, FiUser, FiCheckCircle, FiX, 
  FiMoreVertical, FiZap, FiClock, FiUsers, FiArrowRightCircle,
  FiUserCheck, FiCheckSquare, FiRefreshCw, FiMapPin, FiTrendingUp
} from "react-icons/fi";

// Types
interface AssignedVisitor {
  id: string;
  fullName: string;
  nationalId: string;
  identity?: string;
  badgeNumber?: string;
  service: string;
  department: string;
  assignmentTime: string;
  status: string;
  phone: string;
  checkInTime: string;
  queuePosition?: number;
  checkedInTime?: string;
  checkedInGate?: string;
  receptionistName?: string;
  officerName?: string;
  // Provider/Officer info from services_status
  providerName?: string;
  providerId?: string;
  // Service type from backend: 'Not started', 'Inprogress', 'Transfered', 'Completed'
  serviceType?: string;
  // Track which department's status we're showing
  currentDepartmentId?: string;
}

interface AssignedVisitorsListProps {
  visitors?: AssignedVisitor[];
}

// Status configurations
const statusConfig = {
  accepted: { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500", label: "ACCEPTED" },
  completed: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500", label: "COMPLETED" },
  transferred: { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-500", label: "TRANSFERRED" },
  inprogress: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500", label: "IN PROGRESS" },
  waiting: { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500", label: "WAITING" },
  'not started': { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500", label: "NOT STARTED" },
};

// Helper to determine the display status based on service type
const getDisplayStatus = (visitor: AssignedVisitor): string => {
  const serviceType = visitor.serviceType?.toLowerCase();
  if (serviceType === 'completed') return 'completed';
  if (serviceType === 'inprogress') return 'inprogress';
  if (serviceType === 'transfered') return 'transferred';
  // If visitor is assigned to department but not started yet
  if (visitor.status === 'transferred' || visitor.department) return 'waiting';
  return visitor.status?.toLowerCase() || 'waiting';
};

// Get the officer/employee name for display
const getOfficerName = (visitor: AssignedVisitor): string => {
  // Priority: providerName (from services_status) > officerName > 'Pending'
  if (visitor.providerName) return visitor.providerName;
  if (visitor.officerName) return visitor.officerName;
  return 'Pending';
};

// Check if service is in progress (Officer Accepted phase)
const isOfficerAccepted = (visitor: AssignedVisitor): boolean => {
  const serviceType = visitor.serviceType?.toLowerCase();
  return serviceType === 'inprogress' || serviceType === 'accepted';
};

// Check if service is completed
const isServiceCompleted = (visitor: AssignedVisitor): boolean => {
  return visitor.serviceType?.toLowerCase() === 'completed';
};

// Get initials from name
const getInitials = (name: string) => {
  if (!name) return "??";
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Get color from name
const getColorFromName = (name: string) => {
  if (!name) return 'bg-gray-500';
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

const AssignedVisitorsList: React.FC<AssignedVisitorsListProps> = ({ visitors: propVisitors }) => {
  // Use prop visitors from backend
  const [visitors, setVisitors] = useState<AssignedVisitor[]>(propVisitors || []);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedVisitor, setSelectedVisitor] = useState<AssignedVisitor | null>(null);
  const [editingVisitor, setEditingVisitor] = useState<AssignedVisitor | null>(null);
  const [activeVisitorId, setActiveVisitorId] = useState<string | null>(null);
  const [showServicePanel, setShowServicePanel] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchTermRef = useRef("");
  const itemsPerPage = 5;

  // Update visitors when propVisitors changes
  useEffect(() => {
    if (propVisitors) {
      setVisitors(propVisitors);
    }
  }, [propVisitors]);
  
  // Handle row click
  const handleRowClick = (visitor: AssignedVisitor) => {
    setActiveVisitorId(visitor.id);
    setSelectedVisitor(visitor);
    setShowServicePanel(true);
  };
  
  // Handle close panel
  const handleClosePanel = () => {
    setShowServicePanel(false);
    setActiveVisitorId(null);
    setSelectedVisitor(null);
    setEditingVisitor(null);
  };
  

  // Handle save edited visitor
  const handleSaveEdit = () => {
    if (editingVisitor) {
      setVisitors(prev => prev.map(v => v.id === editingVisitor.id ? editingVisitor : v));
      setSelectedVisitor(editingVisitor);
      setEditingVisitor(null);
    }
  };

  // Handle edit button click
  const handleEditClick = (visitor: AssignedVisitor) => {
    setEditingVisitor({ ...visitor });
  };

  // Filter visitors
  const filteredVisitors = useMemo(() => {
    return visitors.filter(visitor => {
      const matchesSearch = !searchTerm ? true : 
        (visitor.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        visitor.nationalId?.includes(searchTerm) ||
        visitor.phone?.includes(searchTerm));
       
      // Use serviceType for status filtering
      const matchesStatus = statusFilter === 'all' ? true : getDisplayStatus(visitor) === statusFilter;
       
      return matchesSearch && matchesStatus;
    });
  }, [visitors, searchTerm, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage);
  const paginatedVisitors = filteredVisitors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Handle search button click
  const handleSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setIsSearching(true);
    setCurrentPage(1);
    setStatusFilter('all'); // Reset filter when searching
    lastSearchTermRef.current = searchTerm;
    // Search is handled by the filteredVisitors useMemo
    setTimeout(() => setIsSearching(false), 300);
  }, [searchTerm]);

  // Debounced search as user types
  useEffect(() => {
    // Don't search if term hasn't changed
    if (searchTerm === lastSearchTermRef.current) return;
    
    lastSearchTermRef.current = searchTerm;
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // If search query is empty, reset
    if (!searchTerm.trim()) {
      setStatusFilter('all');
      return;
    }
    
    // Set new timeout for debounced search (300ms delay)
    searchTimeoutRef.current = setTimeout(() => {
      setIsSearching(true);
      setCurrentPage(1);
      setStatusFilter('all');
      setTimeout(() => setIsSearching(false), 300);
    }, 300);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Export functions
  const handleExportPDF = () => {
    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #1a365d; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #1a365d; color: white; }
            .footer { margin-top: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>Assigned Visitors Tracking Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Visitor Name</th>
                <th>National ID</th>
                <th>Service</th>
                <th>Department</th>
                <th>Assignment Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredVisitors.map((v, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${v.fullName || ''}</td>
                  <td>${v.nationalId || ''}</td>
                  <td>${v.service || ''}</td>
                  <td>${v.department || ''}</td>
                  <td>${v.assignmentTime || ''}</td>
                  <td>${statusConfig[v.status as keyof typeof statusConfig]?.label || v.status || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>Total Visitors: ${filteredVisitors.length}</p>
            <p>City of Kigali - Visitor Management System</p>
          </div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleExportExcel = () => {
    const headers = ['#', 'Visitor Name', 'National ID', 'Service', 'Department', 'Assignment Time', 'Status'];
    const rows = filteredVisitors.map((v, i) => [
      i + 1,
      v.fullName || '',
      v.nationalId || '',
      v.service || '',
      v.department || '',
      v.assignmentTime || '',
      statusConfig[v.status as keyof typeof statusConfig]?.label || v.status || ''
    ]);
    
    const tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assigned_visitors_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    if (currentPage <= 3) {
      return [1, 2, 3, 4, 5];
    }
    
    if (currentPage >= totalPages - 2) {
      return Array.from({ length: 5 }, (_, i) => totalPages - 4 + i);
    }
    
    return [
      currentPage - 2,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      currentPage + 2
    ];
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Assigned Visitors Tracking</h1>
        <p className="text-sm text-gray-500 mt-1">Manage real-time visitor flow and service assignments across all government departments.</p>
      </div>

      {/* Export Buttons
      <div className="flex gap-3">
        <button 
          onClick={handleExportPDF}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-black rounded-lg transition-colors"
        >
          <FiFile className="w-4 h-4" />
          Export PDF
        </button>
        <button 
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-black rounded-lg transition-colors"
        >
          <FiFileText className="w-4 h-4" />
          Export Excel
        </button>
      </div> */}

      {/* Search and Table Container - Grid layout with panel */}
      <div className="relative min-h-[calc(100vh-200px)]">
        {/* Left side: Search and Table */}
        <div className={`${showServicePanel && selectedVisitor ? 'w-[calc(100%-320px)]' : 'w-full'} space-y-4 pr-4 transition-all duration-300`}>
          {/* Search and Filter Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex flex-col md:flex-row gap-3 items-center">
              {/* Search Input */}
              <div className="flex-1 flex gap-2 w-full">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search by visitor name, ID or badge..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 shadow-md transition-all"
                >
                  <FiSearch className="w-4 h-4" />
                  Search
                </button>
              </div>
              
              {/* Filter Buttons */}
              <div className="flex gap-2 flex-wrap">
                {(['all', 'accepted', 'completed', 'transferred', 'inprogress', 'waiting'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      statusFilter === filter 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">VISITOR NAME</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">IDENTITY</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">BADGE NUMBER</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">DEPARTMENT</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">ASSIGNMENT TIME</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedVisitors.length > 0 ? (
                    paginatedVisitors.map((visitor) => {
                      // Use serviceType from services_status for accurate status display
                      const displayStatus = getDisplayStatus(visitor);
                      const status = statusConfig[displayStatus as keyof typeof statusConfig] || statusConfig.waiting;
                      const isActive = activeVisitorId === visitor.id;
                      return (
                        <tr 
                          key={visitor.id} 
                          onClick={() => handleRowClick(visitor)}
                          className={`cursor-pointer transition-colors ${isActive ? 'bg-[#E7F1FA] border-l-4 border-l-[#1E88C8] shadow-sm' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full ${getColorFromName(visitor.fullName)} flex items-center justify-center text-white font-medium`}>
                                {getInitials(visitor.fullName)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-800">{visitor.fullName}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-800 font-medium">{visitor.identity || '___'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {visitor.badgeNumber || '___'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-600">{visitor.department}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-600">{visitor.assignmentTime}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No visitors found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom of Table */}
            {filteredVisitors.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                <p className="text-xs text-gray-600">
                  Showing {paginatedVisitors.length} of {filteredVisitors.length} results
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600 py-1 px-3">
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Service Tracking Card - Glassmorphism Design */}
        {showServicePanel && selectedVisitor && (
          <div 
            className="fixed right-0 top-0 h-full z-40 shadow-2xl overflow-hidden"
            style={{ width: '320px' }}
          >
            {/* Glassmorphism Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-blue-50/60 backdrop-blur-xl"></div>
            
            {/* Content */}
            <div className="relative h-full flex flex-col">
              {/* Panel Header */}
              <div className="px-5 py-4 border-b border-white/30 flex items-center justify-between bg-white/20">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md">
                    <FiTrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-bold text-gray-800">Service Tracking</span>
                </div>
                <button 
                  onClick={handleClosePanel}
                  className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <FiX className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Visitor Card - Glassmorphism */}
                <div className="bg-white/40 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/50">
                  <div className="flex items-center gap-3">
                    {/* Avatar Circle */}
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
                      <span className="text-sm font-bold text-white">{getInitials(selectedVisitor?.fullName || '')}</span>
                    </div>
                    {/* Visitor Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{selectedVisitor?.fullName}</p>
                      <p className="text-xs text-gray-500 truncate">{selectedVisitor?.department}</p>
                    </div>
                  </div>
                  
                  {/* Status */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200/50">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isServiceCompleted(selectedVisitor!) ? 'bg-green-500' : isOfficerAccepted(selectedVisitor!) ? 'bg-blue-500 animate-pulse' : 'bg-yellow-500 animate-pulse'}`}></div>
                      <span className="text-xs font-medium text-gray-600">
                        {isServiceCompleted(selectedVisitor!) ? 'Completed' : isOfficerAccepted(selectedVisitor!) ? 'In Progress' : 'Waiting'}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">Checked In</p>
                      <p className="text-sm font-semibold text-gray-600">{selectedVisitor?.checkedInTime || '---'}</p>
                    </div>
                  </div>
                </div>
                
                {/* Service Timeline - Compact Glassmorphism */}
                <div className="bg-white/30 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/40">
                  <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Progress</p>
                  
                  {/* Vertical Timeline - Compact */}
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-400 via-blue-400 to-gray-300"></div>
                    
                    {/* Timeline Steps - Compact */}
                    <div className="space-y-3">
                      {/* Step - Checked In */}
                      <div className="flex items-center gap-3 relative">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center z-10 shadow-md">
                          <FiCheck className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1 bg-white/50 rounded-lg p-2 shadow-sm">
                          <p className="text-xs font-semibold text-gray-700">Checked In</p>
                          <p className="text-[10px] text-gray-400">{selectedVisitor?.checkedInTime || '---'} • {selectedVisitor?.checkedInGate || 'Gate'}</p>
                        </div>
                      </div>
                      
                      {/* Step - Transferred */}
                      <div className="flex items-center gap-3 relative">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center z-10 shadow-md ${isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!) ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-white border-2 border-blue-400'}`}>
                          {isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!) ? (
                            <FiCheck className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <FiArrowRightCircle className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        <div className={`flex-1 rounded-lg p-2 shadow-sm ${isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!) ? 'bg-blue-50/80' : 'bg-white/50'}`}>
                          <p className={`text-xs font-semibold ${isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!) ? 'text-blue-700' : 'text-blue-500'}`}>Transferred</p>
                          <p className={`text-[10px] ${isServiceCompleted(selectedVisitor!) || isOfficerAccepted(selectedVisitor!) ? 'text-gray-500' : 'text-blue-400'}`}>{selectedVisitor?.assignmentTime || '---'} • To {selectedVisitor?.department?.split(' ')[0] || 'Dept'}</p>
                        </div>
                      </div>
                      
                      {/* Step - Officer Accepted */}
                      <div className="flex items-center gap-3 relative">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center z-10 shadow-md ${isServiceCompleted(selectedVisitor!) ? 'bg-gradient-to-br from-green-400 to-green-600' : isOfficerAccepted(selectedVisitor!) ? 'bg-white border-2 border-blue-400' : 'bg-gray-100'}`}>
                          {isServiceCompleted(selectedVisitor!) ? (
                            <FiCheck className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <FiUserCheck className={`w-4 h-4 ${isOfficerAccepted(selectedVisitor!) ? 'text-blue-500' : 'text-gray-400'}`} />
                          )}
                        </div>
                        <div className={`flex-1 rounded-lg p-2 shadow-sm ${isServiceCompleted(selectedVisitor!) ? 'bg-green-50/80' : isOfficerAccepted(selectedVisitor!) ? 'bg-blue-50/80' : 'bg-gray-50/50'}`}>
                          <p className={`text-xs font-semibold ${isServiceCompleted(selectedVisitor!) ? 'text-green-700' : isOfficerAccepted(selectedVisitor!) ? 'text-blue-700' : 'text-gray-400'}`}>Officer Accepted</p>
                          <p className={`text-[10px] ${isServiceCompleted(selectedVisitor!) ? 'text-green-500' : isOfficerAccepted(selectedVisitor!) ? 'text-blue-500' : 'text-gray-400'}`}>
                            {getOfficerName(selectedVisitor!)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Step - Completed */}
                      <div className="flex items-center gap-3 relative">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center z-10 shadow-md ${isServiceCompleted(selectedVisitor!) ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gray-100'}`}>
                          <FiCheckSquare className={`w-4 h-4 ${isServiceCompleted(selectedVisitor!) ? 'text-white' : 'text-gray-300'}`} />
                        </div>
                        <div className={`flex-1 rounded-lg p-2 shadow-sm ${isServiceCompleted(selectedVisitor!) ? 'bg-green-50/80' : 'bg-gray-50/50'}`}>
                          <p className={`text-xs font-semibold ${isServiceCompleted(selectedVisitor!) ? 'text-green-700' : 'text-gray-400'}`}>Completed</p>
                          <p className={`text-[10px] ${isServiceCompleted(selectedVisitor!) ? 'text-green-500' : 'text-gray-400'}`}>
                            {isServiceCompleted(selectedVisitor!) ? '✓ Service done' : 'Pending'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default AssignedVisitorsList;