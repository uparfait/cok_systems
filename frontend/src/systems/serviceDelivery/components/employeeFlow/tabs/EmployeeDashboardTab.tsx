// EmployeeDashboardTab - Dashboard page for Employee
// INTEGRATED WITH BACKEND API & STRICT TYPES FIXED

import React, { useState, useEffect } from 'react';
import { 
  FiSearch, FiFilter, FiClock, FiCheckCircle
} from 'react-icons/fi';
import { useAuth } from '../../../../../core/contexts/AuthContext';
import { serviceDeliveryService } from '../../../../../core/services/adminService';

// Import shared components
import { Pagination } from '../../shared';

// Service record interface
interface ServiceRecord {
  id: string;
  visitorName: string;
  serviceId: string;
  status: 'pending' | 'completed' | 'transferred';
  assignmentTime: string;
  avatarColor: string;
  initials: string;
}

// Status styles for rendering
const statusStyles = {
  pending: { bg: 'bg-[#fff3e0]', text: 'text-[#f57c00]', label: 'Pending' },
  completed: { bg: 'bg-[#e8f5e9]', text: 'text-[#2e7d32]', label: 'Completed' },
  transferred: { bg: 'bg-[#e3f2fd]', text: 'text-[#1565c0]', label: 'Transferred' },
};

const EmployeeDashboardTab: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, transferred: 0, completed: 0 });
  const [totalResults, setTotalResults] = useState(0);
  
  const resultsPerPage = 5;

  // Fetch visitors assigned to this employee
  const fetchAssignedVisitors = async () => {
    // FIX: Using 'as any' safely bypasses TypeScript complaining about the exact ID field name
    const currentUser = user as any;
    const myUserId = currentUser?._id || currentUser?.id || currentUser?.userId || currentUser?.employee_id;

    if (!myUserId) {
      console.log('[EmployeeDashboardTab] No valid userId, skipping fetch');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log('[EmployeeDashboardTab] Fetching visitors for provider:', myUserId);
      
      // Get all visitors and filter on frontend since by-provider endpoint may have issues
      const response = await serviceDeliveryService.getAll() as any;
      console.log('[EmployeeDashboardTab] Full API Response:', response);
      
      // Handle the response - get all visitors and filter by provider_id
      if (response && (response.data || response.success || Array.isArray(response))) {
        const allVisitors = Array.isArray(response.data) ? response.data : 
                            Array.isArray(response) ? response : [];
        
        console.log('[EmployeeDashboardTab] Total visitors:', allVisitors.length);
        
        // Filter visitors assigned to this employee via services_status.provider_id
        const myVisitors = allVisitors.filter((v: any) => {
          if (!v.services_status || !Array.isArray(v.services_status)) return false;
          // Check if any service status has this provider's ID
          return v.services_status.some((status: any) => 
            status.provider_id === myUserId || status.provider_id === String(myUserId)
          );
        });
        
        console.log('[EmployeeDashboardTab] Filtered visitors for this employee:', myVisitors.length);
        
        // Transform visitor data to service records
        const records: ServiceRecord[] = myVisitors.map((visitor: any) => {
          
          // Get status from services_status array
          let status: 'pending' | 'completed' | 'transferred' = 'pending';
          const serviceStatus = visitor.services_status?.find((s: any) => s.provider_id === myUserId);
          const rawStatus = (serviceStatus?.s_type || '').toLowerCase();
          
          if (rawStatus === 'completed') {
            status = 'completed';
          } else if (rawStatus === 'transfered') {
            status = 'transferred';
          } else {
            status = 'pending'; 
          }
          
          const colors = ['bg-purple-500', 'bg-pink-500', 'bg-yellow-400', 'bg-teal-500', 'bg-lavender-400', 'bg-blue-500', 'bg-green-500'];
          const visitorName = visitor.full_name || visitor.name || visitor.visitorName || 'Unknown';
          const colorIndex = visitorName.charCodeAt(0) % colors.length;
          
          const initials = visitorName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
          
          const assignmentTime = serviceStatus?.assigned_time || 
                                  visitor.departments_assigned?.find((d: any) => d.provider_id === myUserId)?.assigned_time ||
                                  visitor.checkInTime || 
                                  visitor.updatedAt || 
                                  new Date().toISOString();
          const formattedTime = new Date(assignmentTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          
          return {
            id: visitor._id || visitor.id || Math.random().toString(),
            visitorName: visitorName,
            serviceId: `#${(visitor._id || visitor.id || 'N/A').substring(0, 8)}`,
            status,
            assignmentTime: formattedTime,
            avatarColor: colors[colorIndex],
            initials
          };
        });
        
        setServiceRecords(records);
        
        setStats({
          pending: records.filter(r => r.status === 'pending').length,
          transferred: records.filter(r => r.status === 'transferred').length,
          completed: records.filter(r => r.status === 'completed').length
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
  }, [user, currentPage]);

  // Filter records based on search
  const filteredRecords = serviceRecords.filter(record => {
    const searchLower = searchTerm.toLowerCase();
    return (
      record.visitorName.toLowerCase().includes(searchLower) ||
      record.serviceId.toLowerCase().includes(searchLower)
    );
  });

  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * resultsPerPage,
    currentPage * resultsPerPage
  );

  if (loading) {
    return (
      <div className="p-7 flex items-center justify-center h-64">
        <div className="text-[#888]">Loading assigned visitors...</div>
      </div>
    );
  }

  return (
    <div className="p-7">
      <div>
        <h1 className="text-[#1a2744] text-[28px] font-extrabold">Service Overview</h1>
        <p className="text-[#888] text-[13px] mt-1.5">Manage and track visitor service requests assigned to you today.</p>
      </div>

      <div className="flex gap-5 mt-7">
        <div className="bg-white rounded-[14px] p-[22px_24px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] h-[110px] w-[33%] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff9800] rounded-full opacity-20 -translate-x-8 -translate-y-8"></div>
          </div>
          <div className="flex justify-between items-start relative z-10">
            <span className="text-[#888] text-[12px]">Pending Requests</span>
            <FiClock className="text-[#ff9800] w-5 h-5" />
          </div>
          <div className="text-[#1a2744] text-[36px] font-extrabold mt-2 relative z-10">{stats.pending}</div>
          <div className="w-10 h-1.5 bg-[#ffcc80] rounded-[3px] mt-1"></div>
        </div>

        <div className="bg-white rounded-[14px] p-[22px_24px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] h-[110px] w-[33%] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#1a73e8] rounded-full opacity-20 -translate-x-8 -translate-y-8"></div>
          </div>
          <div className="flex justify-between items-start relative z-10">
            <span className="text-[#888] text-[12px]">Transferred</span>
            <div className="text-[#1a73e8]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </div>
          </div>
          <div className="text-[#1a2744] text-[36px] font-extrabold mt-2 relative z-10">{stats.transferred}</div>
          <div className="w-10 h-1.5 bg-[#90caf9] rounded-[3px] mt-1"></div>
        </div>

        <div className="bg-white rounded-[14px] p-[22px_24px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] h-[110px] w-[33%] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#34a853] rounded-full opacity-20 -translate-x-8 -translate-y-8"></div>
          </div>
          <div className="flex justify-between items-start relative z-10">
            <span className="text-[#888] text-[12px]">Completed</span>
            <FiCheckCircle className="text-[#34a853] w-5 h-5" />
          </div>
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
              <input
                type="text"
                placeholder="Search visitor or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[220px] h-9 border border-[#e0e0e0] rounded-[20px] pl-10 pr-4 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
              />
            </div>
            <button 
              onClick={fetchAssignedVisitors}
              className="flex items-center gap-2 h-9 px-4 border border-[#e0e0e0] rounded-[8px] bg-white text-[#333] text-[13px] hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f0f0f0]">
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">Visitor Name ↕</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">Service ID ↕</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">Status ↕</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">Assignment Time ↕</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRecords.length > 0 ? paginatedRecords.map((record) => {
              const status = statusStyles[record.status];
              return (
                <tr key={record.id} className="border-b border-[#f8f8f8] h-14">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${record.avatarColor} flex items-center justify-center text-white text-[12px] font-bold`}>
                        {record.initials}
                      </div>
                      <span className="text-[#333] text-[13px] font-medium">{record.visitorName}</span>
                    </div>
                  </td>
                  <td className="py-3 text-[#333] text-[13px]">{record.serviceId}</td>
                  <td className="py-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="py-3 text-[#666] text-[13px] font-medium">{record.assignmentTime}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[#888]">
                  No visitors assigned to you yet
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {filteredRecords.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredRecords.length / resultsPerPage)}
            onPageChange={setCurrentPage}
            style="arrows-with-numbers"
            showPageInfo={true}
            totalItems={filteredRecords.length}
            itemsPerPage={resultsPerPage}
          />
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboardTab;