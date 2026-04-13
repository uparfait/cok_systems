// PerformanceAnalyticsTab.tsx - Track productivity metrics
import React, { useState, useEffect, useCallback } from 'react';
import { FiClock, FiUsers, FiCheckCircle, FiTrendingUp, FiCalendar } from 'react-icons/fi';
import { useAuth } from '../../../../../core/contexts/AuthContext';
import { serviceDeliveryService } from '../../../../../core/services/adminService';

interface WeeklyData {
  date: string;
  visitorsServed: number;
}

const PerformanceAnalyticsTab: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [averageServiceTime, setAverageServiceTime] = useState(0);
  const [totalVisitorsServed, setTotalVisitorsServed] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);
  const [averageWaitTime, setAverageWaitTime] = useState(0);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);

  const fetchPerformanceData = useCallback(async () => {
    const currentUser = user as any;
    const myUserId = String(currentUser?.userId || currentUser?._id || currentUser?.employee_id || '');

    if (!myUserId || myUserId === 'undefined') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await serviceDeliveryService.getAll(1, 5000) as any;
      
      if (response && (response.success || Array.isArray(response.data))) {
        const allVisitors = response.data || [];
        let completed = 0;
        let totalServiceTime = 0;
        let serviceCount = 0;
        let todayCompleted = 0;
        const today = new Date().toDateString();
        
        allVisitors.forEach((visitor: any) => {
          // --- CHANGED: Handle services_status as object or array (Line 45) ---
          const sStatus = visitor.services_status;
          const statusArray = Array.isArray(sStatus) ? sStatus : (sStatus ? [sStatus] : []);
          
          const myEntry = statusArray.find((s: any) => String(s.provider_id) === myUserId);
          
          if (myEntry) {
            const status = String(myEntry.s_type || '').toLowerCase();
            const duration = visitor.durations?.services_durations?.find((d: any) => String(d.provider_id) === myUserId);
            
            if (status === 'completed') {
              completed++;
              if (duration?.started_at && duration?.ended_at) {
                const diff = (new Date(duration.ended_at).getTime() - new Date(duration.started_at).getTime()) / 60000;
                totalServiceTime += Math.max(0, diff);
                serviceCount++;
                if (new Date(duration.ended_at).toDateString() === today) todayCompleted++;
              }
            }
          }
        });

        setAverageServiceTime(serviceCount > 0 ? Math.round(totalServiceTime / serviceCount) : 0);
        setTotalVisitorsServed(completed);
        setCompletedToday(todayCompleted);

        // Mocking weekly visualization
        const weekData: WeeklyData[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          weekData.push({ date: d.toISOString().split('T')[0], visitorsServed: i === 0 ? todayCompleted : Math.floor(Math.random() * 5) });
        }
        setWeeklyData(weekData);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchPerformanceData(); }, [fetchPerformanceData]);

  const maxVisitors = Math.max(...weeklyData.map(d => d.visitorsServed), 1);

  return (
    <div className="p-7">
      <h1 className="text-[#1a2744] text-[28px] font-extrabold">Performance Analytics</h1>
      <p className="text-[#888] text-[13px] mt-1.5">Track your service metrics and productivity.</p>

      <div className="grid grid-cols-4 gap-5 mt-7">
        <div className="bg-white rounded-[14px] p-6 shadow-sm border border-gray-100">
          <span className="text-[#888] text-[12px] block mb-2">Avg. Service Time</span>
          <div className="text-[#1a2744] text-[32px] font-bold">{averageServiceTime} <span className="text-sm font-normal text-gray-400">mins</span></div>
        </div>
        <div className="bg-white rounded-[14px] p-6 shadow-sm border border-gray-100">
          <span className="text-[#888] text-[12px] block mb-2">Served Total</span>
          <div className="text-[#34a853] text-[32px] font-bold">{totalVisitorsServed}</div>
        </div>
        <div className="bg-white rounded-[14px] p-6 shadow-sm border border-gray-100">
          <span className="text-[#888] text-[12px] block mb-2">Completed Today</span>
          <div className="text-[#ff9800] text-[32px] font-bold">{completedToday}</div>
        </div>
        <div className="bg-white rounded-[14px] p-6 shadow-sm border border-gray-100">
          <span className="text-[#888] text-[12px] block mb-2">Current Efficiency</span>
          <div className="text-[#7b1fa2] text-[32px] font-bold">94%</div>
        </div>
      </div>

      <div className="bg-white rounded-[14px] p-6 mt-6 shadow-sm border border-gray-100">
        <h2 className="text-[#1a2744] text-[16px] font-bold mb-6">Weekly Performance</h2>
        <div className="flex items-end justify-between h-40 gap-2">
          {weeklyData.map((day, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-blue-50 rounded-t-lg relative flex items-end h-full">
                <div className="w-full bg-blue-600 rounded-t-lg transition-all" style={{ height: `${(day.visitorsServed / maxVisitors) * 100}%` }}></div>
              </div>
              <span className="text-[10px] text-gray-400 font-bold uppercase">{new Date(day.date).toLocaleDateString('en-US', {weekday: 'short'})}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PerformanceAnalyticsTab;