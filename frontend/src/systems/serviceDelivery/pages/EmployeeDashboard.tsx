// EmployeeDashboard - Main page with sidebar and navigation
import React, { useState } from 'react';
import { FiLogOut } from 'react-icons/fi';

// Import tab components
import { EmployeeDashboardTab, ProvideServicesTab, AvailabilityTab } from '../components/employeeFlow/tabs';

// Import shared components
import { Profile, getInitialNotifications, Logout, DashboardHeader } from '../components/shared';

type NavItem = 'dashboard' | 'services' | 'availability';

// Mock user data - this will come from auth context in real app
const currentUser = {
  firstName: 'Evode',
  lastName: 'MUYISINGIZE',
  role: 'DEPT. STAFF',
  avatar: null
};

const getInitials = (firstName: string, lastName: string) => {
  return (firstName[0] + lastName[0]).toUpperCase();
};

const EmployeeDashboard: React.FC = () => {
  const [activeNav, setActiveNav] = useState<NavItem>('dashboard');
  const [showProfile, setShowProfile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notifications, setNotifications] = useState(() => getInitialNotifications('employee'));

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleConfirmLogout = () => {
    console.log('Logging out...');
    // Navigate to login - in real app use router
    window.location.href = '/login';
  };

  const handleCancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const renderContent = () => {
    switch (activeNav) {
      case 'dashboard':
        return <EmployeeDashboardTab />;
      case 'services':
        return <ProvideServicesTab />;
      case 'availability':
        return <AvailabilityTab />;
      default:
        return <EmployeeDashboardTab />;
    }
  };

  // Get the active tab label for header
  const getActiveTabLabel = () => {
    switch (activeNav) {
      case 'dashboard':
        return 'DASHBOARD';
      case 'services':
        return 'PROVIDE SERVICES';
      case 'availability':
        return 'AVAILABILITY';
      default:
        return 'DASHBOARD';
    }
  };

  return (
    <div className="flex h-screen bg-[#f0f2f5]">
      {/* LEFT SIDEBAR */}
      <aside className="w-[220px] bg-white border-r border-[#e8eaed] flex flex-col">
        {/* Logo Block */}
        <div className="p-4 border-b border-[#e8eaed]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center">
              <img src="/src/assets/LOGO_COK.jpg" alt="Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <div className="text-[#1a2744] font-bold text-[13px]">KSESM</div>
              <div className="text-[#1a73e8] font-bold text-[11px] uppercase tracking-wide">CITY OF KIGALI</div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4">
          {(['dashboard', 'services', 'availability'] as NavItem[]).map((item) => {
            const isActive = activeNav === item;
            const labels = {
              dashboard: 'Dashboard',
              services: 'Provide Services',
              availability: 'Availability'
            };
            return (
              <button
                key={item}
                onClick={() => setActiveNav(item)}
                className={`w-full flex items-center gap-3 px-4 py-3 mx-0 my-0.5 rounded-lg transition-all ${
                  isActive 
                    ? 'bg-[#1a73e8] text-white shadow-md font-medium' 
                    : 'text-[#555] hover:bg-gray-100'
                }`}
              >
                <span className="text-[13px]">{labels[item]}</span>
              </button>
            );
          })}
        </nav>

        {/* User Card - Blue Background - Same as Receptionist */}
        <div className="p-4 bg-blue-600 mr-4 my-6 rounded-lg">
          <div className="flex items-center gap-3">
            {/* User Avatar */}
            <button
              onClick={() => setShowProfile(true)}
              className="w-9 h-9 rounded-full bg-white flex items-center justify-center"
            >
              <span className="text-blue-600 text-sm font-bold">
                {getInitials(currentUser.firstName, currentUser.lastName)}
              </span>
            </button>
            
            {/* User Info */}
            <div className="flex-1">
              <p className="text-white text-[13px] font-medium truncate">
                {currentUser.firstName} {currentUser.lastName}
              </p>
              <p className="text-white/80 text-[11px]">
                {currentUser.role}
              </p>
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
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar - Using Shared DashboardHeader */}
        <DashboardHeader 
          activeTab={activeNav}
          userRole="employee"
          userName="Evode MUYISINGIZE"
          userInitials="EM"
          userTitle="Dept. Staff"
          notifications={notifications}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {renderContent()}
        </main>
      </div>

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

export default EmployeeDashboard;
