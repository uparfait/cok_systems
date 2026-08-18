import React from 'react';
import { FiTruck, FiUsers } from 'react-icons/fi';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';

interface ActivityItem {
  id: string; type: 'parking' | 'visitor' | 'employee' | 'system'; message: string; time: string; icon: React.ComponentType<any>; color: string;
}

const colorMap: Record<string, string> = { blue: 'bg-[rgba(5,109,170,0.1)] text-[#056daa]', green: 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]', purple: 'bg-[rgba(41,128,185,0.1)] text-[#2980B9]', gray: 'bg-gray-100 text-[#555555]' };
const typeColorMap: Record<string, string> = { parking: 'bg-[rgba(5,109,170,0.1)] text-[#056daa]', visitor: 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]', system: 'bg-[rgba(41,128,185,0.1)] text-[#2980B9]' };

const ActivityItemComponent: React.FC<{ activity: ActivityItem }> = ({ activity }) => (
  <div className="px-4 py-2.5 hover:bg-[#F7F9FB] transition-colors cursor-pointer">
    <div className="flex items-start gap-3">
      <div className={`w-9 h-9 flex items-center justify-center flex-shrink-0 ${colorMap[activity.color] || colorMap.gray}`}>
        <activity.icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 font-medium truncate">{activity.message}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs px-1.5 py-0.5 ${typeColorMap[activity.type] || 'bg-gray-100 text-gray-700'}`}>{activity.type}</span>
          <span className="text-xs text-gray-400">{activity.time}</span>
        </div>
      </div>
    </div>
  </div>
);

interface ActivityFeedProps {
  recentParking: any[];
  recentVisitors: any[];
  departments: any[];
}

const getRelativeTime = (date: Date | string | undefined): string => {
  if (!date) return 'Recently';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Recently';
    const diff = new Date().getTime() - dateObj.getTime();
    if (diff < 0) return 'Just now';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(diff / 86400000);
    if (days < 7) return `${days}d ago`;
    return dateObj.toLocaleDateString();
  } catch { return 'Recently'; }
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({ recentParking, recentVisitors, departments }) => {
  const activities: ActivityItem[] = [];
  const now = new Date();

  recentParking.slice(0, 3).forEach((p: any) => {
    const time = p.checkInTime || p.check_in ? new Date(p.checkInTime || p.check_in) : now;
    const plate = p.vehicle || p.plateNumber || p.plate_number || p.driver_name || 'Unknown';
    const statusText = p.status === 'active' || p.status === 'Parked' ? 'checked in' : 'checked out';
    activities.push({ id: `parking-${p._id}`, type: 'parking', message: `Vehicle ${plate} ${statusText}`, time: getRelativeTime(time), icon: FiTruck, color: 'blue' });
  });

  recentVisitors.slice(0, 3).forEach((v: any) => {
    const time = v.checkInTime || v.check_in ? new Date(v.checkInTime || v.check_in) : now;
    const name = v.full_name || v.name || v.visitorName || v.visitor_name || `Visitor with badge ${v.badge_number}`;
    const statusText = v.is_still_inhouse === true || v.status === 'Inside' ? 'checked in' : 'checked out';
    activities.push({ id: `visitor-${v._id}`, type: 'visitor', message: `${name} ${statusText}`, time: getRelativeTime(time), icon: FiUsers, color: 'green' });
  });

  departments.slice(0, 2).forEach((d: any) => {
    activities.push({ id: `dept-${d._id}`, type: 'system', message: `Department "${d.name || d.department_name || 'Unknown'}" is active`, time: d.created_date ? getRelativeTime(new Date(d.created_date)) : 'Recently', icon: HiOutlineOfficeBuilding, color: 'purple' });
  });

  return (
    <div className="bg-white border border-[#E0E0E0] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E0E0E0] bg-[#F7F9FB]">
        <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
      </div>
      <div className="divide-y divide-[#E0E0E0] max-h-80 overflow-y-auto">
        {activities.slice(0, 8).map(a => <ActivityItemComponent key={a.id} activity={a} />)}
        {activities.length === 0 && <div className="px-4 py-6 text-center text-sm text-gray-500">No recent activity</div>}
      </div>
    </div>
  );
};

export default ActivityFeed;