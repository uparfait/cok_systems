// DashboardSidebar - Shared sidebar component for all dashboards
import React from 'react';
import { FiLogOut } from 'react-icons/fi';

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
    <aside className="w-[220px] bg-white border-r border-[#e8eaed] flex flex-col h-full">
      {/* Logo Block */}
      <div className="p-4 border-b border-[#e8eaed]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center">
            <img 
              src="/src/assets/LOGO_COK.jpg" 
              alt="Logo" 
              className="w-8 h-8 object-contain" 
            />
          </div>
          <div>
            <div className="text-[#1a2744] font-bold text-[13px]">KSESM</div>
            <div className="text-[#1a73e8] font-bold text-[11px] uppercase tracking-wide">
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
              className={`w-full flex items-center gap-3 px-4 py-3 mx-0 my-0.5 rounded-lg transition-all ${
                isActive 
                  ? 'bg-[#1a73e8] text-white shadow-md font-medium' 
                  : 'text-[#555] hover:bg-gray-100'
              }`}
            >
              <span className="text-[13px]">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Card - Blue Background */}
      <div className="p-4 bg-[#1a73e8] mx-4 mb-4 rounded-[12px]">
        <div className="flex items-center gap-3">
          {/* User Avatar */}
          <button
            onClick={onProfileClick}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center"
          >
            <span className="text-[#1a73e8] text-sm font-bold">
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
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <FiLogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
