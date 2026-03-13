// DashboardLayout - Reusable layout component for all dashboards
// This component provides consistent sidebar and header for all dashboard pages

import React, { useState, useEffect } from 'react';
import { FiLogOut, FiHome, FiUsers, FiGrid, FiClock, FiCheckCircle, FiFile } from 'react-icons/fi';

// Import shared components
import { DashboardHeader, NotificationBell, getInitialNotifications, Logout, Profile } from './index';
import type { Notification, DashboardRole } from './index';

// Import types
import type { UserProfile } from '../../types';

// ==================== Navigation Configuration ====================

export type DashboardTab = 
  | 'dashboard' 
  | 'visitors' 
  | 'availability' 
  | 'queue' 
  | 'assign'
  | 'status'
  | 'employees'
  | 'services'
  | 'reports';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Navigation items for each role
const getNavItems = (role: DashboardRole): NavItem[] => {
  switch (role) {
    case 'receptionist':
      return [
        { id: 'dashboard', label: 'Dashboard', icon: FiHome },
        { id: 'visitors', label: 'Assigned Visitor', icon: FiUsers },
        { id: 'availability', label: 'Dept. Availability', icon: FiGrid },
      ];
    case 'department_manager':
      return [
        { id: 'dashboard', label: 'Dashboard', icon: FiGrid },
        { id: 'status', label: 'Service Status', icon: FiClock },
        { id: 'employees', label: 'Employee Management', icon: FiUsers },
        { id: 'availability', label: 'Department Availability', icon: FiCheckCircle },
        { id: 'reports', label: 'Reports', icon: FiFile },
      ];
    case 'employee':
      return [
        { id: 'dashboard', label: 'Dashboard', icon: FiHome },
        { id: 'services', label: 'Provide Services', icon: FiUsers },
        { id: 'availability', label: 'Availability', icon: FiGrid },
      ];
    default:
      return [];
  }
};

// Get role label for display
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

// ==================== Props Interface ====================

export interface DashboardLayoutProps {
  /** The role of the user viewing the dashboard */
  role: DashboardRole;
  
  /** Currently active tab */
  activeTab: string;
  
  /** Callback when tab changes */
  onTabChange: (tab: string) => void;
  
  /** User's first name */
  userFirstName: string;
  
  /** User's last name */
  userLastName: string;
  
  /** User's title/position */
  userTitle: string;
  
  /** User's avatar URL (optional) */
  userAvatar?: string | null;
  
  /** Custom navigation items (overrides default) */
  customNavItems?: NavItem[];
  
  /** Page title to show in header */
  pageTitle?: string;
  
  /** Whether to show the header */
  showHeader?: boolean;
  
  /** Child components (the main content) */
  children: React.ReactNode;
}

// ==================== Component ====================

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  role,
  activeTab,
  onTabChange,
  userFirstName,
  userLastName,
  userTitle,
  userAvatar = null,
  customNavItems,
  pageTitle,
  showHeader = true,
  children,
}) => {
  // State
  const [showProfile, setShowProfile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [notifications, setNotifications] = useState<Notification[]>(() => getInitialNotifications(role));

  // Get user full name and initials
  const userName = `${userFirstName} ${userLastName}`;
  const userInitials = (userFirstName[0] || '') + (userLastName[0] || '');

  // Get navigation items
  const navItems = customNavItems || getNavItems(role);

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Notification handlers
  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Logout handlers
  const handleConfirmLogout = () => {
    // Navigate to login - the parent component should handle actual navigation
    window.location.href = '/login';
  };

  const handleCancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  // Get title based on active tab and role
  const getTitle = (): string => {
    if (pageTitle) return pageTitle;
    
    if (role === 'receptionist') {
      switch (activeTab) {
        case 'visitors': return 'ASSIGNED VISITOR';
        case 'availability': return 'DEPARTMENT AVAILABILITY';
        default: return 'DASHBOARD';
      }
    } else if (role === 'department_manager') {
      switch (activeTab) {
        case 'dashboard': return 'DEPARTMENT DASHBOARD';
        case 'status': return 'SERVICE TRACKING SYSTEM';
        case 'employees': return 'EMPLOYEE MANAGEMENT';
        case 'availability': return 'DEPARTMENT AVAILABILITY';
        case 'reports': return 'DEPARTMENT PERFORMANCE REPORT';
        default: return 'DASHBOARD';
      }
    } else if (role === 'employee') {
      switch (activeTab) {
        case 'dashboard': return 'MY DASHBOARD';
        case 'services': return 'PROVIDE SERVICES';
        case 'availability': return 'AVAILABILITY';
        case 'reports': return 'REPORTS';
        default: return 'DASHBOARD';
      }
    }
    return 'DASHBOARD';
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] font-sans flex">
      {/* LEFT SIDEBAR - Fixed */}
      <nav className="w-64 bg-white flex flex-col fixed h-full border-r border-gray-200">
        {/* Logo Area */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center">
            <img src="/src/assets/LOGO_COK.jpg" alt="Logo" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <div className="text-[#1a2744] font-bold text-[13px]">KSESM</div>
            <div className="text-[#1a73e8] font-bold text-[11px] uppercase tracking-wide">CITY OF KIGALI</div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 py-4 px-3">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive && !showProfile
                    ? 'bg-blue-100 text-black' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <item.icon className="text-lg" />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* User Card - Blue Background */}
        <div className="p-4 bg-blue-600 mr-4 my-6 rounded-lg">
          <div className="flex items-center gap-3">
            {/* User Avatar - Clickable to open profile */}
            <button
              onClick={() => setShowProfile(true)}
              className="w-9 h-9 rounded-full bg-white flex items-center justify-center"
            >
              <span className="text-sm font-medium text-blue-600">{userInitials}</span>
            </button>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{userName}</p>
              <p className="text-xs text-white">{getRoleLabel(role)}</p>
            </div>
            {/* Logout Button */}
            <button 
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 text-red-400 hover:text-red-300"
            >
              <FiLogOut />
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 ml-64 flex flex-col">
        {/* TOP HEADER */}
        {showHeader && (
          <header className="h-16 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-6">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-lg font-semibold text-gray-700">
                  {getTitle()}
                </h1>
              </div>
              <div className="text-sm text-blue-500 font-semibold text-gray-500">
                {currentDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: '2-digit', 
                  year: 'numeric' 
                }).toUpperCase()} - {currentDate.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                }).toUpperCase()}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Notification Bell */}
              <NotificationBell 
                notifications={notifications}
                onMarkAsRead={handleMarkAsRead}
                onMarkAllAsRead={handleMarkAllAsRead}
                userRole={role}
              />

              {/* User Profile Section */}
              <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">{userName}</p>
                  <p className="text-xs text-gray-500">{userTitle}</p>
                </div>
                
                {/* Avatar - Clickable to open profile */}
                <button
                  onClick={() => setShowProfile(true)}
                  className="relative w-9 h-9 rounded-full flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
                >
                  {userAvatar ? (
                    <img 
                      src={userAvatar} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-700">{userInitials}</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </header>
        )}

        {/* PAGE CONTENT */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>

      {/* Profile Modal */}
      {showProfile && (
        <Profile 
          user={{
            firstName: userFirstName,
            lastName: userLastName,
            role: getRoleLabel(role),
            avatar: userAvatar
          }}
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* Logout Confirmation */}
      {showLogoutConfirm && (
        <Logout 
          onConfirm={handleConfirmLogout}
          onCancel={handleCancelLogout}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
