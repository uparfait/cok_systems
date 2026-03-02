// Sidebar Component - Navigation sidebar with menu items
// Provides navigation links to different system modules
// Dynamic based on user department and permissions

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  FiHome, FiGrid, FiTruck, FiUsers, FiSettings, FiChevronLeft, 
  FiChevronRight, FiMessageSquare, FiBarChart2, FiMapPin, FiLogOut
} from 'react-icons/fi';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';

interface System {
  id: string;
  name: string;
  path: string;
  icon: string;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  systems: System[];
  currentSystem: string;
  onSystemChange: (systemId: string) => void;
  userDepartment: string;
}

// Icon mapping
const getIcon = (iconName: string) => {
  const icons: { [key: string]: React.ComponentType<any> } = {
    FiHome,
    FiGrid,
    FiTruck,
    FiUsers,
    FiSettings,
    FiMessageSquare,
    FiBarChart: FiBarChart2,
    FiMapPin,
    FiLogOut,
    HiOutlineOfficeBuilding,
  };
  return icons[iconName] || FiGrid;
};

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onToggle, 
  systems, 
  currentSystem,
  onSystemChange,
  userDepartment 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Handle navigation
  const handleNavigation = (path: string, systemId: string) => {
    onSystemChange(systemId);
    navigate(path);
  };

  // Get user display info
  const displayName = user?.fullName || 'User';
  const displayRole = user?.role || 'Guest';
  const userInitial = displayName.charAt(0).toUpperCase();

  // Additional menu items that might be available to all
  const commonMenuItems = [
    { id: 'profile', label: 'Profile', icon: FiUsers, path: '/dashboard/profile' },
    { id: 'settings', label: 'Settings', icon: FiSettings, path: '/dashboard/settings' },
  ];

  return (
    <aside 
      className="fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-40 flex flex-col w-64"
    >
      {/* Logo Section */}
      <div className="h-24 flex items-center px-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <img 
            src="/LOGO_COK.jpg" 
            alt="COK Logo" 
            className="h-10 w-auto object-contain"
          />
          <div className="flex flex-col">
            <span className="font-bold text-lg text-gray-900">KSESM Portal</span>
            <span className="text-xs font-medium text-sky-500 uppercase tracking-wide">{displayRole}</span>
          </div>
        </div>
      </div>

      {/* User Department Badge */}
      {isOpen && userDepartment && (
        <div className="px-4 py-3">
          <div className="bg-blue-50 rounded-lg px-3 py-2">
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Department</p>
            <p className="text-sm text-gray-900 font-semibold truncate">{userDepartment}</p>
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="p-3 space-y-1 overflow-y-auto flex-1">
        {systems.map((system) => {
          const Icon = getIcon(system.icon);
          const isActive = currentSystem === system.id || location.pathname === system.path;
          
          return (
            <button
              key={system.id}
              onClick={() => handleNavigation(system.path, system.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              title={!isOpen ? system.name : undefined}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
              {isOpen && (
                <span className="font-medium text-sm truncate">{system.name}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Common Menu Items */}
      <div className="absolute bottom-20 left-0 right-0 px-3 space-y-1 border-t border-gray-200 pt-2">
        {commonMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              title={!isOpen ? item.label : undefined}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
              {isOpen && (
                <span className="font-medium text-sm truncate">{item.label}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* User Profile Section */}
      <div className="absolute bottom-0 left-0 right-0 h-16 border-t border-gray-200 bg-white">
        <div className={`flex items-center ${isOpen ? 'px-4' : 'justify-center'} h-full gap-3`}>
          {/* User Avatar */}
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
            {userInitial}
          </div>
          
          {isOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 truncate">{displayRole}</p>
            </div>
          )}

          {isOpen && (
            <button
              onClick={() => logout()}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              title="Logout"
            >
              <FiLogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
