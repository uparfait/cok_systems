import React from 'react';
import { FiMapPin, FiShield, FiTrendingUp, FiTruck, FiUserPlus, FiUsers } from 'react-icons/fi';
import { MdOutlineLocalParking } from 'react-icons/md';
import type { DashboardStats } from './useDashboardData';
import { ACCENT_DARK_BLUE, CARD_SHADOW, PRIMARY, SUCCESS, SUCCESS_HOVER, WARNING, WHITE, fontHeading } from './dashboardTheme';

interface StatCardProps {
  title: string;
  value: number;
  note: React.ReactNode;
  color: string;
  tint: string;
  pulse: string;
  noteClass: string;
  loading: boolean;
  icon: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, note, color, tint, pulse, noteClass, loading, icon }) => (
  <div className="p-3 transition-shadow duration-300" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium mb-0.5" style={{ color, fontFamily: fontHeading }}>{title}</p>
        {loading ? (
          <div className="h-7 w-12 animate-pulse mt-1" style={{ backgroundColor: pulse }}></div>
        ) : (
          <h3 className="text-xl font-bold" style={{ color, fontFamily: fontHeading }}>{value}</h3>
        )}
        <p className={`${noteClass} text-xs mt-1 flex items-center gap-1`}>{note}</p>
      </div>
      <div className="p-2" style={{ backgroundColor: tint }}>{icon}</div>
    </div>
  </div>
);

const DashboardStatCards: React.FC<{ stats: DashboardStats; loading: boolean }> = ({ stats, loading }) => {
  const occupied = stats.totalInside;
  const ratio = stats.totalSlots > 0 ? occupied / stats.totalSlots : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
      <StatCard
        title="Available Slots"
        value={stats.availableSlots}
        note={<><FiMapPin className="w-3 h-3" />Out of {stats.totalSlots} total</>}
        color={PRIMARY}
        tint="rgba(5,109,170,0.08)"
        pulse="rgba(5,109,170,0.12)"
        noteClass="text-[#555555]"
        loading={loading}
        icon={<MdOutlineLocalParking className="w-5 h-5" style={{ color: PRIMARY }} />}
      />
      <StatCard
        title="Regular Available"
        value={stats.regularAvailable}
        note={<><FiMapPin className="w-3 h-3" /> {stats.regularTotal} allocated</>}
        color={SUCCESS_HOVER}
        tint="rgba(76,175,80,0.1)"
        pulse="rgba(76,175,80,0.12)"
        noteClass="text-[#555555]"
        loading={loading}
        icon={<FiTruck className="w-5 h-5" style={{ color: SUCCESS }} />}
      />
      <StatCard
        title="Staff Reserved"
        value={stats.staffAvailableSlots}
        note={<><FiUsers className="w-3 h-3" />Out of {stats.staffReservedSlots} allocated</>}
        color={ACCENT_DARK_BLUE}
        tint="rgba(41,128,185,0.1)"
        pulse="rgba(41,128,185,0.12)"
        noteClass="text-[#333333]"
        loading={loading}
        icon={<FiShield className="w-5 h-5" style={{ color: ACCENT_DARK_BLUE }} />}
      />
      <StatCard
        title="Visitor Reserved"
        value={stats.visitorAvailableSlots}
        note={<><FiTrendingUp className="w-3 h-3" />Out of {stats.visitorReservedSlots} allocated</>}
        color={WARNING}
        tint="rgba(243,156,18,0.1)"
        pulse="rgba(243,156,18,0.12)"
        noteClass="text-[#333333]"
        loading={loading}
        icon={<FiUserPlus className="w-5 h-5" style={{ color: WARNING }} />}
      />

      <div className="p-3 transition-shadow duration-300 col-span-2 sm:col-span-3 lg:col-span-1" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
        <div className="flex items-center gap-1.5 mb-2">
          <MdOutlineLocalParking className="w-4 h-4" style={{ color: PRIMARY }} />
          <p className="text-xs font-medium" style={{ color: PRIMARY, fontFamily: fontHeading }}>Parking Status</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#056daa] border-t-transparent"></div>
          </div>
        ) : (
          <div>
            <p className="text-2xl sm:text-3xl font-bold" style={{ color: PRIMARY, fontFamily: fontHeading }}>
              {stats.totalSlots > 0 ? `${(ratio * 100).toFixed(3)}%` : '0%'}
            </p>
            <p className="text-[#555555] text-xs mt-1" style={{ fontFamily: fontHeading }}>
              {occupied} of {stats.totalSlots} occupied
            </p>
            <div className="w-full bg-[#E0E0E0] h-1.5 mt-2">
              <div
                className="h-1.5 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round(ratio * 100))}%`, backgroundColor: PRIMARY }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardStatCards;
