// DashboardSidebar - Shared sidebar component for all dashboards
import React from 'react';
import { FiLogOut } from 'react-icons/fi';

const PRIMARY = "#056daa";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";

export type DashboardRole = 'receptionist' | 'department_manager' | 'employee';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface DashboardSidebarProps {
  role: DashboardRole;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  userName: string;
  userInitials: string;
  onLogout: () => void;
  onProfileClick: () => void;
}

const getNavItemsByRole = (role: DashboardRole): { id: string; label: string }[] => {
  switch (role) {
    case 'receptionist':
      return [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'queue', label: 'Queue Status' },
        { id: 'assign', label: 'Assign Visitor' },
      ];
    case 'department_manager':
      return [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'employees', label: 'Employees' },
        { id: 'availability', label: 'Availability' },
        { id: 'reports', label: 'Reports' },
      ];
    case 'employee':
      return [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'performance', label: 'Performance Analytics' },
        { id: 'history', label: 'Service History' },
        { id: 'queue', label: 'Department Queue' },
      ];
    default:
      return [];
  }
};

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  role,
  activeTab,
  onTabChange,
  userName,
  userInitials,
  onLogout,
  onProfileClick,
}) => {
  const navItems = getNavItemsByRole(role);

  const getRoleLabel = (role: DashboardRole): string => {
    switch (role) {
      case 'receptionist':
        return 'Receptionist';
      case 'department_manager':
        return 'Dept. Manager';
      case 'employee':
        return 'Dept. Staff';
      default:
        return role;
    }
  };

  return (
    <aside
      className="w-[220px] flex flex-col h-full"
      style={{ backgroundColor: WHITE, borderRight: `1px solid ${BORDER}` }}
    >
      {/* Logo Block */}
      <div className="p-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center">
            <img
              src="/src/assets/LOGO_COK.jpg"
              alt="Logo"
              className="w-8 h-8 object-contain"
            />
          </div>
          <div>
            <div className="font-bold text-[13px]" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>KSESM</div>
            <div className="font-bold text-[11px] uppercase tracking-wide" style={{ fontFamily: fontHeading, color: PRIMARY }}>
              CITY OF KIGALI
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 mx-0 my-0.5 transition-colors ${
                isActive
                  ? 'bg-[#056daa] text-white font-medium'
                  : 'text-[#555555] hover:bg-gray-100'
              }`}
            >
              <span className="text-[13px]">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Card - Blue Background */}
      <div className="p-4 mx-4 mb-4" style={{ backgroundColor: PRIMARY, borderRadius: 0 }}>
        <div className="flex items-center gap-3">
          {/* User Avatar */}
          <button
            onClick={onProfileClick}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center"
          >
            <span className="text-sm font-bold" style={{ color: PRIMARY }}>
              {userInitials}
            </span>
          </button>

          {/* User Info */}
          <div className="flex-1">
            <p className="text-white text-[13px] font-medium truncate">
              {userName}
            </p>
            <p className="text-white/80 text-[11px]">
              {getRoleLabel(role)}
            </p>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="p-2 text-white/80 hover:text-white transition-colors"
          >
            <FiLogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
