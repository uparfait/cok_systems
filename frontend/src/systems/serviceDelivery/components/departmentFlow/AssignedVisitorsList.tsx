// AssignedVisitorsList Component - Exact Figma Design Implementation

import { useState, useEffect, useMemo } from "react";
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
  service: string;
  department: string;
  assignmentTime: string;
  status: string;
  phone: string;
  checkInTime: string;
  roomNumber?: string;
  queuePosition?: number;
  checkedInTime?: string;
  checkedInGate?: string;
  receptionistName?: string;
  officerName?: string;
}

interface AssignedVisitorsListProps {
  visitors?: AssignedVisitor[];
}

// Mock visitors data
const mockVisitors: AssignedVisitor[] = [
  {
    id: "1",
    fullName: "Evode Munyensenga",
    nationalId: "120050000000",
    service: "Construction Permit",
    department: "Land Management",
    assignmentTime: "08:30 AM",
    status: "inprogress",
    phone: "0785550123",
    checkInTime: "08:45 AM",
    roomNumber: "Room 201",
    queuePosition: 1,
    checkedInTime: "08:40 AM",
    checkedInGate: "Main Gate",
    receptionistName: "Marie",
    officerName: "",
  },
  {
    id: "2",
    fullName: "Alice Uwase",
    nationalId: "119990000000",
    service: "Service Complaint",
    department: "HR",
    assignmentTime: "09:10 AM",
    status: "completed",
    phone: "0781112233",
    checkInTime: "09:15 AM",
    roomNumber: "Room 105",
    queuePosition: 2,
    checkedInTime: "09:00 AM",
    checkedInGate: "Main Gate",
    receptionistName: "Jean",
    officerName: "Mr. Kagaba",
  },
  {
    id: "3",
    fullName: "John Mugisha",
    nationalId: "120080000000",
    service: "Permit Request",
    department: "Legal",
    assignmentTime: "09:45 AM",
    status: "transferred",
    phone: "0789998877",
    checkInTime: "09:50 AM",
    roomNumber: "Room 302",
    queuePosition: 3,
    checkedInTime: "09:30 AM",
    checkedInGate: "Side Gate",
    receptionistName: "Marie",
    officerName: "",
  },
  {
    id: "4",
    fullName: "Sarah Kemiremare",
    nationalId: "120030000000",
    service: "Tax Inquiry",
    department: "Finance",
    assignmentTime: "10:00 AM",
    status: "waiting",
    phone: "0784445566",
    checkInTime: "10:05 AM",
    roomNumber: "Room 401",
    queuePosition: 4,
    checkedInTime: "09:55 AM",
    checkedInGate: "Main Gate",
    receptionistName: "Jean",
    officerName: "",
  },
  {
    id: "5",
    fullName: "Marie Mukamana",
    nationalId: "120060000000",
    service: "Business Registration",
    department: "Registry",
    assignmentTime: "10:15 AM",
    status: "accepted",
    phone: "0782223344",
    checkInTime: "10:20 AM",
    roomNumber: "Room 102",
    queuePosition: 5,
    checkedInTime: "10:10 AM",
    checkedInGate: "Main Gate",
    receptionistName: "Marie",
    officerName: "Mr. Niyonkuru",
  },
];

// Status configurations
const statusConfig = {
  accepted: { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500", label: "ACCEPTED" },
  completed: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500", label: "COMPLETED" },
  transferred: { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-500", label: "TRANSFERRED" },
  inprogress: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500", label: "IN PROGRESS" },
  waiting: { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500", label: "WAITING" },
};

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

const AssignedVisitorsList: React.FC<AssignedVisitorsListProps> = ({ visitors: propVisitors }) => {
  // Use prop visitors if provided, otherwise use mock data
  const [visitors, setVisitors] = useState<AssignedVisitor[]>(propVisitors && propVisitors.length > 0 ? propVisitors : mockVisitors);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedVisitor, setSelectedVisitor] = useState<AssignedVisitor | null>(null);
  const [editingVisitor, setEditingVisitor] = useState<AssignedVisitor | null>(null);
  const [activeVisitorId, setActiveVisitorId] = useState<string | null>(null);
  const [showServicePanel, setShowServicePanel] = useState(false);
  const itemsPerPage = 5;

  // Update visitors when propVisitors changes
  useEffect(() => {
    if (propVisitors && propVisitors.length > 0) {
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
  };
  
  // Update visitors when props change
  useEffect(() => {
    if (propVisitors && propVisitors.length > 0) {
      const combined = [...propVisitors, ...mockVisitors.filter(v => !propVisitors.some(pv => pv.id === v.id))];
      setVisitors(combined);
    } else {
      setVisitors(mockVisitors);
    }
  }, [propVisitors]);

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
        visitor.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        visitor.nationalId.includes(searchTerm) ||
        visitor.phone.includes(searchTerm);
       
      const matchesStatus = statusFilter === 'all' ? true : visitor.status === statusFilter;
       
      return matchesSearch && matchesStatus;
    });
  }, [visitors, searchTerm, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage);
  const paginatedVisitors = filteredVisitors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
                  <td>${v.fullName}</td>
                  <td>${v.nationalId}</td>
                  <td>${v.service}</td>
                  <td>${v.department}</td>
                  <td>${v.assignmentTime}</td>
                  <td>${statusConfig[v.status as keyof typeof statusConfig]?.label || v.status}</td>
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
      v.fullName,
      v.nationalId,
      v.service,
      v.department,
      v.assignmentTime,
      statusConfig[v.status as keyof typeof statusConfig]?.label || v.status
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Assigned Visitors Tracking</h1>
        <p className="text-sm text-gray-500 mt-1">Manage real-time visitor flow and service assignments across all government departments.</p>
      </div>

      {/* Export Buttons */}
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
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-white text-black rounded-lg transition-colors"
        >
          <FiFileText className="w-4 h-4" />
          Export Excel
        </button>
      </div>

      {/* Search and Table Container - Grid layout with panel */}
      <div className="relative min-h-[calc(100vh-200px)]">
        {/* Left side: Search and Table */}
        <div className={`${selectedVisitor ? 'w-[calc(100%-350px)]' : 'w-full'} space-y-4 pr-4`}>
          {/* Search and Filter Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-4">
              {/* Search Box */}
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="search by visitor name,id or badge....."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">STATUS:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="accepted">Accepted</option>
                  <option value="completed">Completed</option>
                  <option value="transferred">Transferred</option>
                  <option value="inprogress">In Progress</option>
                  <option value="waiting">Not Started</option>
                </select>
                <FiFilter className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">VISITOR NAME</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">SERVICE REQUESTED</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">DEPARTMENT</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">ASSIGNMENT TIME</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedVisitors.map((visitor, index) => {
                    const status = statusConfig[visitor.status as keyof typeof statusConfig] || statusConfig.waiting;
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
                              <p className="text-xs text-gray-500">ID : {visitor.nationalId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-600">{visitor.service}</p>
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
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom of Table */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {paginatedVisitors.length} of {filteredVisitors.length} assigned visitors
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiArrowRight className="w-4 h-4 rotate-180" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page 
                          ? 'bg-blue-500 text-white' 
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Service Tracking Card */}
        {showServicePanel && selectedVisitor && (
          <div 
            className="fixed right-0 top-16 h-[calc(100%-4rem)] bg-[#F7F9FC] border-l border-[#E3E8EF] overflow-hidden z-40"
            style={{ width: '350px' }}
          >
            {/* Panel Header */}
            <div className="px-6 py-5 border-b border-[#E3E8EF] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiTrendingUp className="w-5 h-5 text-[#1E88C8]" />
                <span className="text-base font-semibold text-[#2C3E50]">Service Tracking</span>
              </div>
              <button 
                onClick={() => handleClosePanel()}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Selected Visitor Card */}
            <div className="bg-white rounded-xl p-4 shadow-[0px_2px_8px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-3">
                  {/* Avatar Circle */}
                  <div className="w-10 h-10 rounded-full bg-[#E8D9FF] flex items-center justify-center">
                    <span className="text-base font-semibold text-[#7B3FE4]">{getInitials(selectedVisitor?.fullName || '')}</span>
                  </div>
                  {/* Visitor Details */}
                  <div>
                    <p className="text-sm font-semibold text-[#2C3E50]">{selectedVisitor?.fullName?.toUpperCase()}</p>
                    <p className="text-[11px] text-[#8A94A6] tracking-wide">{selectedVisitor?.department?.toUpperCase()} • {selectedVisitor?.roomNumber?.toUpperCase() || 'ROOM PENDING'}</p>
                  </div>
                </div>
                
                {/* Queue Information */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-[11px] text-[#8A94A6]">WAITING</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-[#8A94A6]">Queue Position</p>
                    <p className="text-xl font-semibold text-[#1E88C8]">#{selectedVisitor?.queuePosition || '-'}</p>
                  </div>
                </div>
            </div>
            
            {/* Service Timeline / Progress Tracker */}
            <div className="px-6 py-5">
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[#D8E1EC]"></div>
                
                {/* Timeline Steps */}
                <div className="space-y-5">
                  {/* Completed Step - Checked In */}
                  <div className="flex items-start gap-3 relative">
                    <div className="w-8 h-8 rounded-full bg-[#1E88C8] flex items-center justify-center z-10">
                      <FiCheck className="w-4 h-4 text-white" />
                    </div>
                    <div className="pt-1">
                      <p className="text-sm font-medium text-[#2C3E50]">Checked In</p>
                      <p className="text-xs text-[#8A94A6]">{selectedVisitor?.checkedInTime || '10:55 AM'} • {selectedVisitor?.checkedInGate || 'Gate'}</p>
                    </div>
                  </div>
                  
                  {/* Current Step - Transferred */}
                  <div className="flex items-start gap-3 relative">
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-[#1E88C8] flex items-center justify-center z-10">
                      <FiArrowRightCircle className="w-4 h-4 text-[#1E88C8]" />
                    </div>
                    <div className="pt-1">
                      <p className="text-sm font-medium text-[#1E88C8]">Transferred</p>
                      <p className="text-xs text-[#1E88C8]">11:15 AM • To {selectedVisitor?.roomNumber || 'Room 402'}</p>
                    </div>
                  </div>
                  
                  {/* Pending Step - Officer Accepted */}
                  <div className="flex items-start gap-3 relative">
                    <div className="w-8 h-8 rounded-full bg-[#EEF2F7] flex items-center justify-center z-10">
                      <FiUserCheck className="w-4 h-4 text-[#A0AEC0]" />
                    </div>
                    <div className="pt-1">
                      <p className="text-sm font-medium text-[#A0AEC0]">Officer Accepted</p>
                      <p className="text-xs text-[#A0AEC0]">Pending Officer</p>
                    </div>
                  </div>
                  
                  {/* Pending Step - Completed */}
                  <div className="flex items-start gap-3 relative">
                    <div className="w-8 h-8 rounded-full bg-[#EEF2F7] flex items-center justify-center z-10">
                      <FiCheckSquare className="w-4 h-4 text-[#A0AEC0]" />
                    </div>
                    <div className="pt-1">
                      <p className="text-sm font-medium text-[#A0AEC0]">Completed</p>
                      <p className="text-xs text-[#A0AEC0]">Service end</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Bottom Action Button */}
            <div className="absolute bottom-0 left-0 right-0 px-6 py-4 bg-white border-t border-[#E3E8EF]">
              <button 
                onClick={() => handleEditClick(selectedVisitor)}
                className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-[#D8E1EC] bg-white text-[#2C3E50] hover:bg-[#F4F7FB] transition-colors"
              >
                <FiEdit className="w-4 h-4" />
                Edit Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignedVisitorsList;
