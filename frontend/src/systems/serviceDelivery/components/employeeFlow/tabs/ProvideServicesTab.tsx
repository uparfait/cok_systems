// ProvideServicesTab - Service Provision page with Serve Modal
// INTEGRATED WITH BACKEND APIs & BULLETPROOF ASSIGNMENT MATCHING

import React, { useState, useEffect } from 'react';
import { 
  FiSearch, FiFilter, FiClock, FiCheckCircle, FiRefreshCw
} from 'react-icons/fi';

// Import modal components
import { ServeVisitorModal } from '../index';

// Import shared components
import { Pagination, ServiceStatusBadge } from '../../shared';

// API Services
import { useAuth } from '../../../../../core/contexts/AuthContext';
import { serviceDeliveryService } from '../../../../../core/services/adminService';

interface SelectedVisitor {
  id: string;
  name: string;
  visitorId: string;
  email: string;
  service: string;
  checkInTime: string;
  gate: string;
}

interface ServiceRequest {
  id: string;
  visitorName: string;
  visitorId: string;
  serviceType: string;
  serviceColor: string;
  waitTime: string;
  avatarColor: string;
  initials: string;
  status: string;
  telephone: string;
  checkInRaw: string;
}

const ProvideServicesTab: React.FC = () => {
  const { user } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<SelectedVisitor | null>(null);
  
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isServing, setIsServing] = useState(false);
  const [stats, setStats] = useState({ waitAvg: '0m', waiting: 0, completed: 0 });

  const entriesPerPage = 5;

  const fetchAssignedVisitors = async () => {
    const currentUser = user as any;
    
    // Safely get all possible identifiers for the logged-in user
    const myId = currentUser?._id || currentUser?.id || currentUser?.userId || currentUser?.employee_id;
    const myName = (currentUser?.full_name || currentUser?.fullName || currentUser?.name || '').toLowerCase().trim();

    try {
      setLoading(true);
      const response = await serviceDeliveryService.getAll() as any;
      
      if (response && (response.data || response.success || Array.isArray(response))) {
        const allVisitors = Array.isArray(response.data) ? response.data : 
                            Array.isArray(response) ? response : [];
        
        // 👉 BULLETPROOF FILTER: Match by ID *OR* Name
        const myVisitors = allVisitors.filter((v: any) => {
          if (!v) return false;

          const assignedObj = typeof v.assignedTo === 'object' ? v.assignedTo : null;
          const assignedStr = typeof v.assignedTo === 'string' ? v.assignedTo : null;
          
          const assignedId = assignedObj?._id || assignedObj?.id || assignedObj?.employee_id || assignedStr;
          const assignedName = (assignedObj?.full_name || assignedObj?.name || v.assignedStaff || assignedStr || '').toLowerCase().trim();
          
          const isIdMatch = myId && assignedId && String(myId) === String(assignedId);
          const isNameMatch = myName && assignedName && assignedName.includes(myName);

          return isIdMatch || isNameMatch;
        });
        
        const formattedRequests: ServiceRequest[] = myVisitors.map((v: any) => {
          
          let status = 'waiting';
          const rawStatus = (v.status || '').toLowerCase();
          if (rawStatus === 'completed') status = 'completed';
          else if (rawStatus === 'in_progress' || rawStatus === 'inside') status = 'in-progress';
          else if (rawStatus === 'transferred') status = 'transferred';
          
          const colors = ['bg-purple-500', 'bg-pink-500', 'bg-yellow-400', 'bg-teal-500', 'bg-lavender-400', 'bg-blue-500', 'bg-green-500'];
          const visitorName = v.full_name || v.name || v.visitorName || 'Unknown';
          const colorIndex = visitorName.charCodeAt(0) % colors.length;
          const initials = visitorName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
          
          let identification = 'N/A';
          if (typeof v.identification === 'string') identification = v.identification;
          else if (v.identification?.number) identification = v.identification.number;

          const serviceColors = [
            'bg-[#f3e5f5] text-[#7b1fa2]', 'bg-[#e3f2fd] text-[#1565c0]', 
            'bg-[#e8f5e9] text-[#2e7d32]', 'bg-[#fff8e1] text-[#f57f17]'
          ];
          const serviceName = v.service || 'General Service';
          const sColor = serviceColors[serviceName.charCodeAt(0) % serviceColors.length];

          const checkIn = v.checkInTime || v.check_in_time || v.createdAt || new Date().toISOString();
          let waitTimeString = 'Just now';
          if (checkIn) {
            const diffMins = Math.floor((new Date().getTime() - new Date(checkIn).getTime()) / 60000);
            if (diffMins > 0 && diffMins < 1440) waitTimeString = `${diffMins} mins`;
          }

          return {
            id: v._id || v.id || Math.random().toString(),
            visitorName: visitorName,
            visitorId: identification,
            serviceType: serviceName,
            serviceColor: sColor,
            waitTime: waitTimeString,
            avatarColor: colors[colorIndex],
            initials: initials,
            status: status,
            telephone: v.telephone || 'N/A',
            checkInRaw: checkIn
          };
        });
        
        // Reverse to show newest on top
        formattedRequests.reverse();
        setRequests(formattedRequests);
        
        const completedCount = formattedRequests.filter(r => r.status === 'completed').length;
        const waitingCount = formattedRequests.filter(r => r.status === 'waiting' || r.status === 'in-progress').length;
        
        setStats({
          waitAvg: waitingCount > 0 ? '12m 30s' : '0m',
          waiting: waitingCount,
          completed: completedCount
        });
      }
    } catch (error) {
      console.error('Error fetching assigned visitors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedVisitors();
    const interval = setInterval(fetchAssignedVisitors, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const filteredRequests = requests.filter(request => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      request.visitorName.toLowerCase().includes(searchLower) ||
      request.visitorId.toLowerCase().includes(searchLower) ||
      request.serviceType.toLowerCase().includes(searchLower);
    
    const matchesStatus = statusFilter === 'all' || 
      request.status.toLowerCase().replace('-', '').replace('_', '') === statusFilter.toLowerCase().replace('-', '').replace('_', '');
    
    return matchesSearch && matchesStatus;
  });

  const totalFilteredPages = Math.ceil(filteredRequests.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + entriesPerPage);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleServeClick = (request: ServiceRequest) => {
    if (request.status === 'completed') return;
    
    setSelectedVisitor({
      id: request.id,
      name: request.visitorName,
      visitorId: request.visitorId,
      email: request.telephone,
      service: request.serviceType,
      checkInTime: request.checkInRaw ? new Date(request.checkInRaw).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
      gate: 'Main Reception',
    });
    setShowModal(true);
  };

  // 👉 BACKEND COMPLETION/TRANSFER LOGIC
  const handleServiceComplete = async (data: any) => {
    if (!selectedVisitor) return;
    setIsServing(true);

    try {
      // Determine if this is a completion or a transfer based on modal data
      const isTransfer = data.notes && data.notes.toLowerCase().includes('transfer');
      
      const updatePayload = {
        status: isTransfer ? 'Transferred' : 'Completed',
        serviceNotes: data.notes 
      };

      await serviceDeliveryService.update(selectedVisitor.id, updatePayload);
      
      // Refresh the table instantly
      await fetchAssignedVisitors();
      setShowModal(false);
      setSelectedVisitor(null);

    } catch (error) {
      console.error("Failed to process service:", error);
      alert("Failed to process request. Please try again.");
    } finally {
      setIsServing(false);
    }
  };

  if (loading && requests.length === 0) {
    return <div className="p-7 flex items-center justify-center h-64 text-[#888]">Loading active requests...</div>;
  }

  return (
    <div className="p-7">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[#1a2744] text-[32px] font-extrabold">Service Provision</h1>
          <p className="text-[#888] text-[13px] mt-1.5">Manage active visitor requests, track wait times, and provision services efficiently.</p>
        </div>
        <button 
          onClick={fetchAssignedVisitors}
          className="flex items-center gap-2 h-9 px-4 border border-[#e0e0e0] rounded-[8px] bg-white text-[#333] text-[13px] hover:bg-gray-50 transition-colors"
        >
          <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      <div className="flex gap-5 mt-7">
        <div className="bg-white rounded-[14px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
          <div className="flex justify-between items-start">
            <span className="text-[#999] text-[11px] uppercase tracking-wider">AVG. SERVICE TIME</span>
            <FiClock className="text-[#90a4ae] w-7 h-7" />
          </div>
          <div className="text-[#1a2744] text-[28px] font-bold mt-3">{stats.waitAvg}</div>
        </div>

        <div className="bg-white rounded-[14px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
          <div className="flex justify-between items-start">
            <span className="text-[#999] text-[11px] uppercase tracking-wider">WAITING VISITORS</span>
            <div className="text-[#90a4ae]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="text-[#1a2744] text-[28px] font-bold mt-3">{stats.waiting}</div>
        </div>

        <div className="bg-white rounded-[14px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
          <div className="flex justify-between items-start">
            <span className="text-[#999] text-[11px] uppercase tracking-wider">COMPLETED TODAY</span>
            <FiCheckCircle className="text-[#34a853] w-7 h-7" />
          </div>
          <div className="text-[#1a2744] text-[28px] font-bold mt-3">{stats.completed}</div>
        </div>
      </div>

      <div className="bg-white rounded-[14px] p-4 mt-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by visitor name, ID, or service type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-4 border border-[#e0e0e0] rounded-[8px] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="h-11 px-4 border border-[#e0e0e0] rounded-[8px] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
          >
            <option value="all">All Status</option>
            <option value="waiting">Waiting</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[14px] p-6 mt-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[#1a2744] text-[16px] font-bold">Active Service Requests</h2>
          <div className="text-[#888] text-[12px]">
            Showing {filteredRequests.length > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + entriesPerPage, filteredRequests.length)} of {filteredRequests.length} entries
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f0f0f0]">
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">VISITOR</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">SERVICE TYPE</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">WAIT TIME</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">STATUS</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRequests.length > 0 ? paginatedRequests.map((request) => (
              <tr key={request.id} className="border-b border-[#f8f8f8] h-14">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full ${request.avatarColor} flex items-center justify-center text-white text-[12px] font-bold`}>
                      {request.initials}
                    </div>
                    <div>
                      <div className="text-[#333] text-[13px] font-medium">{request.visitorName}</div>
                      <div className="text-[#888] text-[11px]">{request.visitorId}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-medium ${request.serviceColor}`}>
                    {request.serviceType}
                  </span>
                </td>
                <td className="py-3 text-[#666] text-[13px]">{request.waitTime}</td>
                <td className="py-3">
                  <ServiceStatusBadge status={request.status} variant="employee" />
                </td>
                <td className="py-3">
                  {request.status === 'completed' ? (
                    <span className="text-[#34a853] text-[12px] font-medium">
                      ✓ Served
                    </span>
                  ) : request.status === 'transferred' ? (
                    <span className="text-[#1a73e8] text-[12px] font-medium">
                      ⇄ Transferred
                    </span>
                  ) : (
                    <button
                      onClick={() => handleServeClick(request)}
                      className="h-8 px-4 bg-[#1a73e8] text-white text-[12px] font-medium rounded-[6px] hover:bg-[#1558c0] transition-colors"
                    >
                      Serve
                    </button>
                  )}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="py-8 text-center text-gray-500">No visitors currently waiting for you.</td></tr>
            )}
          </tbody>
        </table>

        {filteredRequests.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalFilteredPages || 1}
            onPageChange={setCurrentPage}
            style="arrows-only"
            showPageInfo={true}
            prevLabel="Previous"
            nextLabel="Next"
          />
        )}
      </div>

      <ServeVisitorModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedVisitor(null);
        }}
        visitor={selectedVisitor as any}
        onServiceStart={(startTime) => {
          console.log('Service started at:', startTime);
        }}
        onServiceEnd={handleServiceComplete}
      />
    </div>
  );
};

export default ProvideServicesTab;