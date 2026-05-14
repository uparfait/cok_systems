
import React, { useState, useEffect, useCallback } from 'react';
import { FiClock, FiCheckCircle, FiRefreshCw } from 'react-icons/fi';

// Correct paths from the 'pages' folder
import { useAuth } from '../../../core/contexts/AuthContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import ProvideServicesTab from '../components/employeeFlow/tabs/ProvideServicesTab';

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [stats, setStats] = useState({ pending: 0, transfered: 0, completed: 0 });

  const fetchDashboardStats = useCallback(async () => {
    const currentUser = user as any;
    const myUserId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || '');

    if (!myUserId || myUserId === 'undefined') {
      setLoading(false);
      setFirstLoad(false);
      return;
    }
    
    try {
      setLoading(true);
      setFirstLoad(true);
      const response = await serviceDeliveryService.getAll() as any;

      // so for now as backend filter vistors automatically no need for frontend to filter my visitors or the one assigned to my department and we must remove the logic to filter
      
      if (response && (response.data || response.success || Array.isArray(response))) {
        const allVisitors = Array.isArray(response.data) ? response.data : Array.isArray(response) ? response : [];
        
        // remove all logics to filter my visitors or the one assigned to my department and we must remove the logic to filter
        const myVisitors = allVisitors; // as backend will filter visitors assigned to me or my department
        
        const records = myVisitors.map((visitor: any) => {
          const serviceStatus = visitor.services_status?.find((s: any) => true); // no need to filter for specific service as we want to show the overall status of the visitor based on all services
          return { status: (serviceStatus?.s_type || visitor.status || '').toLowerCase() };
        });

        console.log(records);
        
        setStats({
          pending: records.filter((r: any) => r.status === 'not started' || r.status === 'inprogress').length,
          transfered: records.filter((r: any) => r.status === 'transfered' || r.status === 'transferred').length,
          completed: records.filter((r: any) => r.status === 'completed').length
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  // Listen for new visitor assigned event
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewVisitorAssigned = (data: any) => {
      // Reload dashboard stats
      fetchDashboardStats();
    };

    socket.on('new_visitor_assigned', handleNewVisitorAssigned);

    return () => {
      socket.off('new_visitor_assigned', handleNewVisitorAssigned);
    };
  }, [socket, isConnected, fetchDashboardStats]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-7">
        {/* Dashboard Header */}
        <div>
          <h1 className="text-[#1a2744] text-[28px] font-extrabold">Service Overview</h1>
          <p className="text-[#888] text-[13px] mt-1.5">Manage and track visitor service requests assigned to you today.</p>
        </div>

        {/* Dashboard Custom KPI Cards */}
        <div className="flex gap-5 mt-7 mb-7">
          <div className="bg-white rounded-[14px] p-[22px_24px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] h-[110px] w-[33%] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16"><div className="absolute top-0 right-0 w-32 h-32 bg-[#ff9800] rounded-full opacity-20 -translate-x-8 -translate-y-8"></div></div>
            <div className="flex justify-between items-start relative z-10"><span className="text-[#888] text-[12px]">Pending Requests</span><FiClock className="text-[#ff9800] w-5 h-5" /></div>
            {(loading && firstLoad) ? (
              <div className="h-9 w-16 bg-gray-200 rounded animate-pulse mt-2"></div>
            ) : (
              <div className="text-[#1a2744] text-[36px] font-extrabold mt-2 relative z-10">{stats.pending}</div>
            )}
            <div className="w-10 h-1.5 bg-[#ffcc80] rounded-[3px] mt-1"></div>
          </div>
          <div className="bg-white rounded-[14px] p-[22px_24px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] h-[110px] w-[33%] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16"><div className="absolute top-0 right-0 w-32 h-32 bg-[#1a73e8] rounded-full opacity-20 -translate-x-8 -translate-y-8"></div></div>
            <div className="flex justify-between items-start relative z-10"><span className="text-[#888] text-[12px]">Transferred</span><FiRefreshCw className="text-[#1a73e8] w-4 h-4" /></div>
            {(loading && firstLoad) ? (
              <div className="h-9 w-16 bg-gray-200 rounded animate-pulse mt-2"></div>
            ) : (
              <div className="text-[#1a2744] text-[36px] font-extrabold mt-2 relative z-10">{stats.transfered}</div>
            )}
            <div className="w-10 h-1.5 bg-[#90caf9] rounded-[3px] mt-1"></div>
          </div>
          <div className="bg-white rounded-[14px] p-[22px_24px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] h-[110px] w-[33%] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16"><div className="absolute top-0 right-0 w-32 h-32 bg-[#34a853] rounded-full opacity-20 -translate-x-8 -translate-y-8"></div></div>
            <div className="flex justify-between items-start relative z-10"><span className="text-[#888] text-[12px]">Completed</span><FiCheckCircle className="text-[#34a853] w-5 h-5" /></div>
            {(loading && firstLoad) ? (
              <div className="h-9 w-16 bg-gray-200 rounded animate-pulse mt-2"></div>
            ) : (
              <div className="text-[#1a2744] text-[36px] font-extrabold mt-2 relative z-10">{stats.completed}</div>
            )}
            <div className="w-10 h-1.5 bg-[#a8d5b5] rounded-[3px] mt-1"></div>
          </div>
        </div>

        {/* CALLING THE REUSABLE TABLE COMPONENT HERE */}
        <ProvideServicesTab isDashboardView={true} />
      </div>
    </div>
  );
};

export default EmployeeDashboard;