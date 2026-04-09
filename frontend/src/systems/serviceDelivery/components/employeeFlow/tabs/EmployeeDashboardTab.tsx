// EmployeeDashboardTab - Dashboard page for Employee
// INTEGRATED WITH BACKEND SCHEMA: FETCHES DURATIONS PROPERLY

import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiClock, FiCheckCircle, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '../../../../../core/contexts/AuthContext';
import { useSocket } from '../../../../../core/contexts/SocketContext';
import { serviceDeliveryService } from '../../../../../core/services/adminService';
import { Pagination } from '../../shared';

interface ServiceRecord {
  id: string;
  visitorName: string;
  visitorId: string;
  badgeNumber: string;
  assignedTo: string;
  waitTime: string;
  status: 'not_started' | 'inprogress' | 'completed' | 'transfered';
  avatarColor: string;
  initials: string;
}

const statusStyles = {
  not_started: { bg: 'bg-[#fff3e0]', text: 'text-[#f57c00]', label: 'Not Started' },
  inprogress: { bg: 'bg-[#e3f2fd]', text: 'text-[#1a73e8]', label: 'In Progress' },
  completed: { bg: 'bg-[#e8f5e9]', text: 'text-[#2e7d32]', label: 'Completed' },
  transfered: { bg: 'bg-[#f3e5f5]', text: 'text-[#7b1fa2]', label: 'Transferred' },
};

const EmployeeDashboardTab: React.FC = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, transfered: 0, completed: 0 });
  const resultsPerPage = 5;

  const fetchAssignedVisitors = useCallback(async (silent: boolean = false) => {
    const currentUser = user as any;
    const myUserId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || '');
    const myName = String(currentUser?.full_name || currentUser?.fullName || currentUser?.name || 'Unknown').trim();

    if (!myUserId || myUserId === 'undefined' || myUserId === '') {
      if (!silent) setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      // 👉 NEW: Use the updated backend endpoint that returns ALL visitors (assigned and unassigned)
      const response = await serviceDeliveryService.getCurrentVisitorsByProvider(myUserId) as any;
      
      if (response && response.success && response.data) {
        // The backend now returns visitors grouped by department (including "Unassigned")
        const departmentGroups = response.data;
        
        // Flatten all visitors from all department groups into a single array
        const allVisitors: any[] = [];
        departmentGroups.forEach((group: any) => {
          if (group.visitors && Array.isArray(group.visitors)) {
            group.visitors.forEach((visitor: any) => {
              // Add department info to each visitor for display
              allVisitors.push({
                ...visitor,
                _departmentGroup: group.department_name
              });
            });
          }
        });
        
        // 👉 MAPPING LOGIC: Format the data perfectly for the table
        const records: ServiceRecord[] = allVisitors.map((visitor: any) => {
          // Check if explicitly assigned to me
          // Note: services_status is now a single object (not an array) after backend aggregation
          const myServiceStatus = visitor.services_status && typeof visitor.services_status === 'object' && 
                                  String(visitor.services_status.provider_id) === myUserId 
            ? visitor.services_status 
            : null;
          const myDeptAssign = visitor.departments_assigned?.find((d: any) => String(d.provider_id) === myUserId);
          const isExplicitlyMine = !!myServiceStatus || !!myDeptAssign;

          let status: 'not_started' | 'inprogress' | 'completed' | 'transfered' = 'not_started';
          let assignedToDisplay = myName;
          let serviceStartTime = '';
          let checkIn = visitor.entry_date || new Date().toISOString();

          if (isExplicitlyMine) {
            // Read my explicit status
            const rawStatus = myServiceStatus?.s_type || visitor.status || '';
            const normalizedStatus = rawStatus.toLowerCase();
            if (normalizedStatus === 'completed') status = 'completed';
            else if (normalizedStatus === 'inprogress') status = 'inprogress';
            else if (normalizedStatus === 'transfered' || normalizedStatus === 'transferred') status = 'transfered';
            else status = 'not_started';

            assignedToDisplay = myName;
            checkIn = myDeptAssign?.assigned_time || visitor.entry_date || new Date().toISOString();
            const serviceDuration = visitor.durations?.services_durations?.find((d: any) => String(d.provider_id) === myUserId);
            serviceStartTime = serviceDuration?.started_at || '';
          } else {
            // It's a general unassigned queue item or assigned to another department
            status = 'not_started';
            const latestAssign = visitor.departments_assigned?.[visitor.departments_assigned.length - 1];
            
            // Check if this is an unassigned visitor
            const isUnassigned = visitor._departmentGroup === 'Unassigned' || 
                                !latestAssign?.provider_id || 
                                latestAssign.provider_id === 'undefined' || 
                                latestAssign.provider_id === 'null' || 
                                latestAssign.provider_id === '' || 
                                latestAssign.provider_id === 'unassigned';
            
            if (isUnassigned) {
              assignedToDisplay = 'Unassigned';
            } else if (latestAssign) {
              // Show department name if assigned to a department
              assignedToDisplay = latestAssign.department_name || visitor._departmentGroup || 'General Queue';
            } else {
              assignedToDisplay = visitor._departmentGroup || 'General Queue';
            }
            
            checkIn = latestAssign?.assigned_time || visitor.entry_date || new Date().toISOString();
          }
          
          const colors = ['bg-purple-500', 'bg-pink-500', 'bg-yellow-400', 'bg-teal-500', 'bg-blue-500'];
          const visitorName = visitor.full_name || visitor.name || 'Unknown';
          const colorIndex = visitorName.charCodeAt(0) % colors.length;
          const initials = visitorName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
          
          let identification = 'N/A';
          if (typeof visitor.identification === 'string') identification = visitor.identification;
          else if (visitor.identification?.number) identification = visitor.identification.number;

          let badgeNumber = visitor.badge_number || '';

          const waitTimeEndStamp = (status === 'inprogress' || status === 'completed' || status === 'transfered') && serviceStartTime
            ? new Date(serviceStartTime).getTime() 
            : new Date().getTime();
          
          let waitTimeString = 'Just now';
          if (checkIn) {
            const diffMins = Math.floor((waitTimeEndStamp - new Date(checkIn).getTime()) / 60000);
            if (diffMins > 0) {
              const hours = Math.floor(diffMins / 60);
              const mins = diffMins % 60;
              waitTimeString = hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`;
            }
          }
          
          return {
            id: visitor._id || visitor.id || Math.random().toString(),
            visitorName: visitorName,
            visitorId: identification,
            badgeNumber: badgeNumber,
            assignedTo: assignedToDisplay,
            status,
            waitTime: waitTimeString,
            avatarColor: colors[colorIndex],
            initials
          };
        });
        
        // Sort records: In Progress first, then Transferred, then Not Started
        records.sort((a, b) => {
          const statusOrder: Record<string, number> = {
            'inprogress': 1,
            'transfered': 2,
            'not_started': 3,
            'completed': 4
          };
          const orderA = statusOrder[a.status] ?? 99;
          const orderB = statusOrder[b.status] ?? 99;
          return orderA - orderB;
        });
        
        setServiceRecords(records);
        
        setStats({
          pending: records.filter(r => r.status === 'not_started' || r.status === 'inprogress').length,
          transfered: records.filter(r => r.status === 'transfered').length,
          completed: records.filter(r => r.status === 'completed').length
        });
      }
    } catch (error) {
      console.error('Error fetching assigned visitors:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAssignedVisitors();
  }, [fetchAssignedVisitors]);

  // WebSocket listener for real-time visitor assignment updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewVisitorAssigned = (data: any) => {
      console.log('New visitor assigned (employee dashboard):', data);
      // Silently refresh the service records when visitors are assigned
      fetchAssignedVisitors(true); // true = silent mode
    };

    socket.on('new_visitor_assigned', handleNewVisitorAssigned);

    return () => {
      socket.off('new_visitor_assigned', handleNewVisitorAssigned);
    };
  }, [socket, isConnected, fetchAssignedVisitors]);

  const filteredRecords = serviceRecords.filter(record => {
    const searchLower = searchTerm.toLowerCase();
    return (
      record.visitorName.toLowerCase().includes(searchLower) ||
      record.visitorId.toLowerCase().includes(searchLower) ||
      record.badgeNumber.toLowerCase().includes(searchLower)
    );
  });

  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * resultsPerPage,
    currentPage * resultsPerPage
  );

  return (
    <div className="p-7">
      <div>
        <h1 className="text-[#1a2744] text-[28px] font-extrabold">Service Overview</h1>
        <p className="text-[#888] text-[13px] mt-1.5">Manage and track visitor service requests assigned to you today.</p>
      </div>

      <div className="flex gap-5 mt-7">
        <div className="bg-white rounded-[14px] p-[22px_24px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] h-[110px] w-[33%] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16"><div className="absolute top-0 right-0 w-32 h-32 bg-[#ff9800] rounded-full opacity-20 -translate-x-8 -translate-y-8"></div></div>
          <div className="flex justify-between items-start relative z-10"><span className="text-[#888] text-[12px]">Visitors being Served</span><FiClock className="text-[#ff9800] w-5 h-5" /></div>
          <div className="text-[#1a2744] text-[36px] font-extrabold mt-2 relative z-10">{stats.pending}</div>
          <div className="w-10 h-1.5 bg-[#ffcc80] rounded-[3px] mt-1"></div>
        </div>
        <div className="bg-white rounded-[14px] p-[22px_24px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] h-[110px] w-[33%] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16"><div className="absolute top-0 right-0 w-32 h-32 bg-[#1a73e8] rounded-full opacity-20 -translate-x-8 -translate-y-8"></div></div>
          <div className="flex justify-between items-start relative z-10"><span className="text-[#888] text-[12px]">Transferred</span><FiRefreshCw className="text-[#1a73e8] w-4 h-4" /></div>
          <div className="text-[#1a2744] text-[36px] font-extrabold mt-2 relative z-10">{stats.transfered}</div>
          <div className="w-10 h-1.5 bg-[#90caf9] rounded-[3px] mt-1"></div>
        </div>
        <div className="bg-white rounded-[14px] p-[22px_24px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] h-[110px] w-[33%] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16"><div className="absolute top-0 right-0 w-32 h-32 bg-[#34a853] rounded-full opacity-20 -translate-x-8 -translate-y-8"></div></div>
          <div className="flex justify-between items-start relative z-10"><span className="text-[#888] text-[12px]">Completed</span><FiCheckCircle className="text-[#34a853] w-5 h-5" /></div>
          <div className="text-[#1a2744] text-[36px] font-extrabold mt-2 relative z-10">{stats.completed}</div>
          <div className="w-10 h-1.5 bg-[#a8d5b5] rounded-[3px] mt-1"></div>
        </div>
      </div>

      <div className="bg-white rounded-[14px] p-6 mt-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[#1a2744] text-[16px] font-bold">Service History</h2>
          <div className="flex gap-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="Search visitor or ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-[220px] h-9 border border-[#e0e0e0] rounded-[20px] pl-10 pr-4 text-[12px] focus:ring-2 focus:ring-[#1a73e8]" />
            </div>
            <button onClick={() => fetchAssignedVisitors()} className="flex items-center gap-2 h-9 px-4 border border-[#e0e0e0] rounded-[8px] bg-white text-[#333] text-[13px] hover:bg-gray-50">
              <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f0f0f0]">
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">VISITOR ↕</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">ID</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">BADGE</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">ASSIGNED TO ↕</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">WAIT TIME ↕</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">STATUS ↕</th>
            </tr>
          </thead>
          <tbody>
            {loading && serviceRecords.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-500">Loading your assignments...</td></tr>
            ) : paginatedRecords.length > 0 ? paginatedRecords.map((record) => {
              const status = statusStyles[record.status];
              return (
                <tr key={record.id} className="border-b border-[#f8f8f8] h-14">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${record.avatarColor} flex items-center justify-center text-white text-[12px] font-bold`}>{record.initials}</div>
                      <div>
                        <div className="text-[#333] text-[13px] font-medium">{record.visitorName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-[#333] text-[13px]">{record.visitorId}</td>
                  <td className="py-3 text-[#333] text-[13px]">{record.badgeNumber || '-'}</td>
                  <td className="py-3 text-[#333] text-[13px] font-medium">{record.assignedTo}</td>
                  <td className="py-3 text-[#666] text-[13px] font-medium">{record.waitTime}</td>
                  <td className="py-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={6} className="py-8 text-center text-[#888]">No active visitors waiting in queue.</td></tr>
            )}
          </tbody>
        </table>
        
        {filteredRecords.length > 0 && (
          <Pagination currentPage={currentPage} totalPages={Math.ceil(filteredRecords.length / resultsPerPage)} onPageChange={setCurrentPage} style="arrows-with-numbers" showPageInfo={true} totalItems={filteredRecords.length} itemsPerPage={resultsPerPage} />
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboardTab;
