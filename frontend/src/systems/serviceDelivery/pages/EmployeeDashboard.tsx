// EmployeeDashboard.tsx - Dashboard content page for Employee
// No MainLayout here! The Wrapper file handles that.

import React, { useState, useEffect, useCallback } from 'react';
import { FiClock, FiCheckCircle, FiRefreshCw } from 'react-icons/fi';

// Correct paths from the 'pages' folder
import { useAuth } from '../../../core/contexts/AuthContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import ProvideServicesTab from '../components/employeeFlow/tabs/ProvideServicesTab';

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, transfered: 0, completed: 0 });

  const fetchDashboardStats = useCallback(async () => {
    const currentUser = user as any;
    const myUserId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || '');

    if (!myUserId || myUserId === 'undefined') {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const response = await serviceDeliveryService.getAll() as any;
      
      if (response && (response.data || response.success || Array.isArray(response))) {
        const allVisitors = Array.isArray(response.data) ? response.data : Array.isArray(response) ? response : [];
        
        const myVisitors = allVisitors.filter((v: any) => {
          if (!v.services_status || !Array.isArray(v.services_status)) return false;
          return v.services_status.some((status: any) => String(status.provider_id) === myUserId);
        });
        
        const records = myVisitors.map((visitor: any) => {
          const serviceStatus = visitor.services_status?.find((s: any) => String(s.provider_id) === myUserId);
          return { status: (serviceStatus?.s_type || visitor.status || '').toLowerCase() };
        });
        
        setStats({
          pending: records.filter((r: any) => r.status === 'not_started' || r.status === 'inprogress').length,
          transfered: records.filter((r: any) => r.status === 'transfered' || r.status === 'transferred').length,
          completed: records.filter((r: any) => r.status === 'completed').length
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 10000); 
    return () => clearInterval(interval);
  }, [fetchDashboardStats]);

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

        {/* 👉 CALLING THE REUSABLE TABLE COMPONENT HERE */}
        <ProvideServicesTab isDashboardView={true} />
      </div>
    </div>
  );
};

export default EmployeeDashboard;