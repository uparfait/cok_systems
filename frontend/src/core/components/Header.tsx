// Header Component - Main application header with navigation and user controls
// Contains logo, navigation links, notification bell, and user profile dropdown
// Dynamic based on user department and permissions

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  FiMenu, FiBell, FiSearch, FiChevronDown, FiUser, 
  FiSettings, FiLogOut, FiHelpCircle, FiGrid
} from 'react-icons/fi';
import { getUserDepartment } from './Layout';

interface System {
  id: string;
  name: string;
  path: string;
  icon: string;
}

interface HeaderProps {
  onMenuToggle: () => void;
  systems: System[];
  currentSystem: string;
  onSystemChange: (systemId: string) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  onMenuToggle, 
  systems, 
  currentSystem,
  onSystemChange 
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSystemDropdown, setShowSystemDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentDateTime, setCurrentDateTime] = useState(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };
    const date = now.toLocaleDateString('en-US', options);
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${date}|${time}`;
  });

  // Update time every minute
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      };
      const date = now.toLocaleDateString('en-US', options);
      const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      setCurrentDateTime(`${date}|${time}`);
    };

    // Update every minute
    const interval = setInterval(updateDateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Get user info
  const displayName = user?.fullName || 'User';
  const displayRole = user?.role || 'Guest';
  const userDepartment = getUserDepartment(user);
  const userInitial = displayName.charAt(0).toUpperCase();

  // Get current system name
  const currentSystemData = systems.find(s => s.id === currentSystem);
  const currentSystemName = currentSystemData?.name || 'Dashboard';

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/login';
    }
  };

  

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Dashboard Title with Date/Time */}
        <div className="hidden lg:flex flex-col">
          <span className="font-semibold text-gray-900 text-lg">Dashboard</span>
          <span className="text-xs font-bold  text-gray-500">{currentDateTime}</span>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <FiMenu className="w-5 h-5" />
        </button>
      </div>

      {/* Center Section - Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent focus:bg-white focus:border-blue-300 rounded-lg text-sm transition-all outline-none"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
          <FiBell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>

        {/* Help */}
        <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors hidden sm:block">
          <FiHelpCircle className="w-5 h-5" />
        </button>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold text-sm">
              {userInitial}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-900 leading-tight">{displayName}</p>
              <p className="text-xs text-gray-500 leading-tight">{displayRole}</p>
            </div>
            <FiChevronDown className={`w-4 h-4 text-gray-500 transition-transform hidden sm:block ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
              {/* User Info */}
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{displayName}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                {userDepartment && (
                  <p className="text-xs text-blue-600 mt-1">{userDepartment}</p>
                )}
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/dashboard/profile');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <FiUser className="w-4 h-4" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/dashboard/settings');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <FiSettings className="w-4 h-4" />
                  Settings
                </button>
              </div>

              {/* Logout */}
              <div className="border-t border-gray-100 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <FiLogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {(showUserMenu || showSystemDropdown) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowUserMenu(false);
            setShowSystemDropdown(false);
          }}
        />
      )}
    </header>
  );
};

export default Header;
