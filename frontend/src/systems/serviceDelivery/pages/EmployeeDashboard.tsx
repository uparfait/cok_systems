import React, { useState, useEffect, useCallback } from 'react';
import { FiClock, FiCheckCircle, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { serviceDeliveryService } from '../../../core/services/adminService';

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const BORDER = "#E0E0E0";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [stats, setStats] = useState({ pending: 0, transfered: 0, completed: 0 });

  const fetchDashboardStats = useCallback(async () => {
    const currentUser = user as any;
    const myUserId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || '');
    if (!myUserId || myUserId === 'undefined') { setLoading(false); setFirstLoad(false); return; }
    try {
      setLoading(true); setFirstLoad(true);
      const response = await serviceDeliveryService.getAll() as any;
      if (response && (response.data || response.success || Array.isArray(response))) {
        const allVisitors = Array.isArray(response.data) ? response.data : Array.isArray(response) ? response : [];
        const myVisitors = allVisitors;
        const records = myVisitors.map((visitor: any) => { const s = visitor.services_status?.find(() => true); return { status: (s?.s_type || visitor.status || '').toLowerCase() }; });
        setStats({
          pending: records.filter((r: any) => r.status === 'not started' || r.status === 'inprogress').length,
          transfered: records.filter((r: any) => r.status === 'transfered' || r.status === 'transferred').length,
          completed: records.filter((r: any) => r.status === 'completed').length
        });
      }
    } catch (error) { console.error(error); }
    finally { setLoading(false); setFirstLoad(false); }
  }, [user]);

  useEffect(() => { fetchDashboardStats(); }, [fetchDashboardStats]);
  useEffect(() => { if (!socket || !isConnected) return; const h = () => fetchDashboardStats(); socket.on('new_visitor_assigned', h); return () => { socket.off('new_visitor_assigned', h); }; }, [socket, isConnected, fetchDashboardStats]);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      <div className="flex-1 overflow-auto p-4">
        <div><h1 className="text-base font-bold" style={{ fontFamily: fontHeading, color: PRIMARY }}>Service Overview</h1><p className="text-xs mt-1" style={{ color: GRAY_DISABLED }}>Manage and track visitor service requests assigned to you.</p></div>
        <div className="flex gap-3 mt-4 mb-4">
          {[
            { label: 'Pending Requests', value: stats.pending, icon: FiClock, color: WARNING, bar: 'rgba(243,156,18,0.35)' },
            { label: 'Transferred', value: stats.transfered, icon: FiRefreshCw, color: PRIMARY, bar: 'rgba(5,109,170,0.35)' },
            { label: 'Completed', value: stats.completed, icon: FiCheckCircle, color: SUCCESS, bar: 'rgba(76,175,80,0.35)' },
          ].map((s, i) => (
            <div key={i} className="p-4 flex-1 relative overflow-hidden" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
              <div className="absolute top-0 right-0 w-16 h-16"><div className="absolute top-0 right-0 w-32 h-32" style={{ backgroundColor: s.color, opacity: 0.1 }}></div></div>
              <div className="flex justify-between items-start relative z-10"><span className="text-xs" style={{ color: '#555555' }}>{s.label}</span><s.icon style={{ color: s.color }} className="w-4 h-4" /></div>
              {loading && firstLoad ? <div className="h-8 w-14 bg-gray-200 animate-pulse mt-1"></div> : <div className="text-xl font-bold mt-1 relative z-10" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{s.value}</div>}
              <div className="w-8 h-1 mt-1" style={{ backgroundColor: s.bar }}></div>
            </div>
          ))}
         </div>
       </div>
     </div>
   );
};

export default EmployeeDashboard;
