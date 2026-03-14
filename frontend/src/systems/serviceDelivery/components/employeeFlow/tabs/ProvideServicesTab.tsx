// ProvideServicesTab - Service Provision page with Serve Modal
// STRICT SCHEMA ALIGNMENT: 'Not started', 'Inprogress', 'Transfered', 'Completed'

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiSearch, FiFilter, FiClock, FiCheckCircle, FiRefreshCw
} from 'react-icons/fi';

// Import modal components
import { ServeVisitorModal } from '../index';
import { Pagination, ServiceStatusBadge } from '../../shared';
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
  assignedTo: string;
  serviceType: string;
  waitTime: string;
  avatarColor: string;
  initials: string;
  status: 'not_started' | 'inprogress' | 'completed' | 'transfered';
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

  const fetchAssignedVisitors = useCallback(async () => {
    const currentUser = user as any;
    const myId = currentUser?._id || currentUser?.id || currentUser?.userId || currentUser?.employee_id;
    const myName = (currentUser?.full_name || currentUser?.fullName || currentUser?.name || 'Unknown').trim();

    if (!myId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const response = await serviceDeliveryService.getAll() as any;
      
      if (response && (response.data || response.success || Array.isArray(response))) {
        const allVisitors = Array.isArray(response.data) ? response.data : 
                            Array.isArray(response) ? response : [];
        
        // Filter for visitors assigned to this employee
        const myVisitors = allVisitors.filter((v: any) => {
          if (!v.services_status || !Array.isArray(v.services_status)) return false;
          return v.services_status.some((status: any) => 
            status.provider_id === String(myId)
          );
        });
        
        const formattedRequests: ServiceRequest[] = myVisitors.map((v: any) => {
          const serviceStatus = v.services_status?.find((s: any) => s.provider_id === String(myId));
          
          // MAP STRICT BACKEND STATUS TO FRONTEND
          let status: 'not_started' | 'inprogress' | 'completed' | 'transfered' = 'not_started';
          const rawStatus = (serviceStatus?.s_type || '').toLowerCase();
          
          if (rawStatus === 'completed') status = 'completed';
          else if (rawStatus === 'inprogress') status = 'inprogress';
          else if (rawStatus === 'transfered' || rawStatus === 'transferred') status = 'transfered';
          
          const colors = ['bg-purple-500', 'bg-pink-500', 'bg-yellow-400', 'bg-teal-500', 'bg-lavender-400', 'bg-blue-500'];
          const visitorName = v.full_name || v.name || v.visitorName || 'Unknown';
          const colorIndex = visitorName.charCodeAt(0) % colors.length;
          const initials = visitorName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
          
          let identification = 'N/A';
          if (typeof v.identification === 'string') identification = v.identification;
          else if (v.identification?.number) identification = v.identification.number;

          const checkIn = serviceStatus?.assigned_time || v.entry_date || new Date().toISOString();
          let waitTimeString = 'Just now';
          if (checkIn) {
            const diffMins = Math.floor((new Date().getTime() - new Date(checkIn).getTime()) / 60000);
            if (diffMins > 0 && diffMins < 1440) waitTimeString = `${diffMins} mins`;
          }

          return {
            id: v._id || v.id,
            visitorName: visitorName,
            visitorId: identification,
            assignedTo: myName,
            serviceType: serviceStatus?.department_name || 'General Service',
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
        const waitingCount = formattedRequests.filter(r => r.status === 'not_started' || r.status === 'inprogress').length;
        
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
  }, [user]);

  useEffect(() => {
    fetchAssignedVisitors();
    const interval = setInterval(fetchAssignedVisitors, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, [fetchAssignedVisitors]);

  const filteredRequests = requests.filter(request => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      request.visitorName.toLowerCase().includes(searchLower) ||
      request.visitorId.toLowerCase().includes(searchLower);
    
    // Quick normalize for filter dropdown
    let normalizedStatus = request.status.replace('_', '-'); 
    if (normalizedStatus === 'transfered') normalizedStatus = 'transferred';

    const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const totalFilteredPages = Math.ceil(filteredRequests.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + entriesPerPage);

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

  // 👉 TRIGGERED WHEN "START SERVICE" IS CLICKED IN MODAL
  const handleServiceStart = async (startTime: string) => {
    if (!selectedVisitor) return;
    try {
      const currentUser = user as any;
      const myId = currentUser?._id || currentUser?.id || currentUser?.employee_id;

      // Update backend strictly to 'Inprogress'
      await serviceDeliveryService.update(selectedVisitor.id, {
        services_status: [{
            provider_id: myId,
            s_type: 'Inprogress'
        }]
      });
      
      await fetchAssignedVisitors(); // Refresh UI in background
    } catch (error) {
      console.error("Failed to start service:", error);
    }
  };

  // 👉 TRIGGERED WHEN "END SERVICE" IS CLICKED IN MODAL
  const handleServiceComplete = async (data: any) => {
    if (!selectedVisitor) return;
    setIsServing(true);

    try {
      const currentUser = user as any;
      const myId = currentUser?._id || currentUser?.id || currentUser?.employee_id;

      const isTransfer = data.notes && data.notes.toLowerCase().includes('transfer');
      // Update backend strictly to 'Transfered' or 'Completed'
      const targetStatus = isTransfer ? 'Transfered' : 'Completed';

      await serviceDeliveryService.update(selectedVisitor.id, {
        services_status: [{
            provider_id: myId,
            s_type: targetStatus
        }]
      });
      
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
              placeholder="Search by visitor name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-4 border border-[#e0e0e0] rounded-[8px] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-11 px-4 border border-[#e0e0e0] rounded-[8px] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
          >
            <option value="all">All Status</option>
            <option value="not-started">Not Started</option>
            <option value="inprogress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[14px] p-6 mt-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[#1a2744] text-[16px] font-bold">Active Service Requests</h2>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f0f0f0]">
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">VISITOR</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">ASSIGNED TO</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">WAIT TIME</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">STATUS</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading && requests.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-gray-500">Loading requests...</td></tr>
            ) : paginatedRequests.length > 0 ? paginatedRequests.map((request) => (
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
                <td className="py-3 text-[#333] text-[13px] font-medium">
                  {request.assignedTo}
                </td>
                <td className="py-3 text-[#666] text-[13px]">{request.waitTime}</td>
                <td className="py-3">
                  {/* Custom Badges mapping perfectly to schema */}
                  {request.status === 'not_started' && <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#fff3e0] text-[#f57c00]">Not Started</span>}
                  {request.status === 'inprogress' && <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#e3f2fd] text-[#1a73e8]">In Progress</span>}
                  {request.status === 'completed' && <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#e8f5e9] text-[#2e7d32]">Completed</span>}
                  {request.status === 'transfered' && <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#f3e5f5] text-[#7b1fa2]">Transferred</span>}
                </td>
                <td className="py-3">
                  {request.status === 'completed' ? (
                    <span className="text-[#34a853] text-[12px] font-medium">✓ Served</span>
                  ) : request.status === 'transfered' ? (
                    <span className="text-[#7b1fa2] text-[12px] font-medium">⇄ Transferred</span>
                  ) : (
                    <button
                      onClick={() => handleServeClick(request)}
                      disabled={isServing}
                      className={`h-8 px-4 text-white text-[12px] font-medium rounded-[6px] transition-colors disabled:opacity-50 ${request.status === 'inprogress' ? 'bg-[#ff9800] hover:bg-[#f57c00]' : 'bg-[#1a73e8] hover:bg-[#1558c0]'}`}
                    >
                      {request.status === 'inprogress' ? 'Resume' : 'Serve'}
                    </button>
                  )}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="py-8 text-center text-gray-500">No active visitors assigned to you.</td></tr>
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
        onServiceStart={handleServiceStart} // Trigger status change to "Inprogress"
        onServiceEnd={handleServiceComplete} // Trigger status change to "Completed"
      />
    </div>
  );
};

export default ProvideServicesTab;