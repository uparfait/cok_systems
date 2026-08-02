// EmployeeDashboardTab - Dashboard page for Employee
// INTEGRATED WITH BACKEND SCHEMA: FETCHES DURATIONS PROPERLY

import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiClock, FiCheckCircle, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '../../../../../core/contexts/AuthContext';
import { useSocket } from '../../../../../core/contexts/SocketContext';
import { serviceDeliveryService } from '../../../../../core/services/adminService';
import Table from '../../../../../core/components/Table';
import type { TableHeader, TablePagination } from '../../../../../core/components/Table';

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

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";
const inputStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: "14px",
  backgroundColor: NEUTRAL_LIGHT,
  border: "1px solid transparent",
  borderRadius: 0,
  boxShadow: "0px 2px 4px rgba(0,0,0,0.1)",
  color: NEUTRAL_DARK,
};
const focusInput = (e: React.FocusEvent<HTMLElement>) => {
  e.currentTarget.style.borderColor = PRIMARY;
  e.currentTarget.style.boxShadow = "0px 4px 8px rgba(5,109,170,0.25)";
};
const blurInput = (e: React.FocusEvent<HTMLElement>) => {
  e.currentTarget.style.borderColor = "transparent";
  e.currentTarget.style.boxShadow = "0px 2px 4px rgba(0,0,0,0.1)";
};
const btnTypography: React.CSSProperties = { fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' };

const statusStyles = {
  not_started: { bg: 'cok-bg-primary', text: 'cok-primary-color', label: 'Not Started' },
  inprogress: { bg: 'bg-[rgba(76,175,80,0.12)]', text: 'text-[#388E3C]', label: 'In Progress' },
  completed: { bg: 'bg-[rgba(51,51,51,0.08)]', text: 'text-[#555555]', label: 'Completed' },
  transfered: { bg: 'bg-[rgba(41,128,185,0.12)]', text: 'text-[#2980B9]', label: 'Transferred' },
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
          
          const colors = ['bg-[#2980B9]', 'bg-[#E74C3C]', 'bg-[#F39C12]', 'bg-[#4CAF50]', 'bg-[#056daa]'];
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
        <h1 className="text-[28px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Service Overview</h1>
        <p className="text-[#555555] text-[13px] mt-1.5">Manage and track visitor service requests assigned to you today.</p>
      </div>

      <div className="flex gap-5 mt-7">
        <div className="bg-white p-[22px_24px] h-[110px] w-[33%] relative overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          <div className="absolute top-0 right-0 w-16 h-16"><div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 -translate-x-8 -translate-y-8" style={{ backgroundColor: WARNING }}></div></div>
          <div className="flex justify-between items-start relative z-10"><span className="text-[#555555] text-[12px]">Visitors being Served</span><FiClock className="w-5 h-5" style={{ color: WARNING }} /></div>
          <div className="text-[36px] font-bold mt-2 relative z-10" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{stats.pending}</div>
          <div className="w-10 h-1.5 mt-1" style={{ backgroundColor: WARNING }}></div>
        </div>
        <div className="bg-white p-[22px_24px] h-[110px] w-[33%] relative overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          <div className="absolute top-0 right-0 w-16 h-16"><div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 -translate-x-8 -translate-y-8" style={{ backgroundColor: PRIMARY }}></div></div>
          <div className="flex justify-between items-start relative z-10"><span className="text-[#555555] text-[12px]">Transferred</span><FiRefreshCw className="w-4 h-4" style={{ color: PRIMARY }} /></div>
          <div className="text-[36px] font-bold mt-2 relative z-10" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{stats.transfered}</div>
          <div className="w-10 h-1.5 mt-1" style={{ backgroundColor: PRIMARY }}></div>
        </div>
        <div className="bg-white p-[22px_24px] h-[110px] w-[33%] relative overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          <div className="absolute top-0 right-0 w-16 h-16"><div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 -translate-x-8 -translate-y-8" style={{ backgroundColor: SUCCESS }}></div></div>
          <div className="flex justify-between items-start relative z-10"><span className="text-[#555555] text-[12px]">Completed</span><FiCheckCircle className="w-5 h-5" style={{ color: SUCCESS }} /></div>
          <div className="text-[36px] font-bold mt-2 relative z-10" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{stats.completed}</div>
          <div className="w-10 h-1.5 mt-1" style={{ backgroundColor: SUCCESS }}></div>
        </div>
      </div>

      <div className="bg-white p-6 mt-6" style={{ boxShadow: CARD_SHADOW }}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[16px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Service History</h2>
          <div className="flex gap-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="Search visitor or ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="cok-auth-input w-[220px] h-9 pl-10 pr-4" style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
            </div>
<button onClick={() => fetchAssignedVisitors()} className="cok-btn-outlined flex items-center gap-2 h-9 px-4 text-xs">
               <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
             </button>
          </div>
        </div>

        <Table
          headers={[
            { key: 'visitor', label: 'VISITOR' },
            { key: 'id', label: 'ID' },
            { key: 'badge', label: 'BADGE' },
            { key: 'assigned_to', label: 'ASSIGNED TO' },
            { key: 'wait_time', label: 'WAIT TIME' },
            { key: 'status', label: 'STATUS' }
          ]}
          data={paginatedRecords}
          loading={loading && serviceRecords.length === 0}
          emptyMessage="No active visitors waiting in queue."
          maxHeight="400px"
          minWidth="800px"
          renderCell={(header, record, index) => {
            switch (header.key) {
              case 'visitor':
                return (
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${record.avatarColor} flex items-center justify-center text-white text-[12px] font-bold`}>
                      {record.initials}
                    </div>
                    <div>
                      <div className="text-[#333] text-[13px] font-medium">{record.visitorName}</div>
                    </div>
                  </div>
                );
              case 'id':
                return <span className="text-[#333] text-[13px]">{record.visitorId}</span>;
              case 'badge':
                return <span className="text-[#333] text-[13px]">{record.badgeNumber || '-'}</span>;
              case 'assigned_to':
                return <span className="text-[#333] text-[13px] font-medium">{record.assignedTo}</span>;
              case 'wait_time':
                return <span className="text-[#555555] text-[13px] font-medium">{record.waitTime}</span>;
              case 'status':
                const statusKey = record.status as keyof typeof statusStyles;
                const status = statusStyles[statusKey];
                return (
                  <span className={`inline-flex items-center px-3 py-1 text-[12px] font-bold uppercase tracking-wide ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                );
              default:
                return <span>{record[header.key] || '-'}</span>;
            }
          }}
          pagination={{
            currentPage,
            totalPages: Math.ceil(filteredRecords.length / resultsPerPage),
            totalCount: filteredRecords.length,
            itemsPerPage: resultsPerPage,
            onPageChange: setCurrentPage,
            loading
          }}
        />
      </div>
    </div>
  );
};

export default EmployeeDashboardTab;
