// MainLayout - Unified application layout with dynamic sidebar
// Provides consistent structure with sidebar, header, and main content area
// Sidebar links are dynamically generated based on user role/permissions

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';
import LoadingSpinner from '../LoadingSpinner';
import { 
  getNavigationByPermissions, 
  getCurrentSystemFromPath, 
  toSidebarLinks,
  type NavItem, 
  type SidebarLink 
} from './layoutUtils';

interface MainLayoutProps {
  children: React.ReactNode;
  // Optional: Override default navigation (for system-specific layouts)
  customNavItems?: NavItem[];
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, customNavItems }) => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Responsive state
  const [isDesktop, setIsDesktop] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Get navigation links (use custom if provided, otherwise use role-based)
  const sidebarLinks: SidebarLink[] = useMemo(() => {
    if (customNavItems) {
      return customNavItems.map(item => ({
        id: item.id,
        name: item.label,
        path: item.path,
        icon: item.icon,
        isParent: true,
        isExpandable: !!(item.children && item.children.length > 0),
      }));
    }
    // Convert navigation to sidebar format
    const navigation = getNavigationByPermissions(user);
    return toSidebarLinks(navigation);
  }, [user, customNavItems]);
  
  // Determine current system from URL path
  // Note: currentSystem is kept for future use in breadcrumbs/title
  getCurrentSystemFromPath(location.pathname);
  
  // Get user department
  const userDepartment = user?.departmentName || user?.department_name || '';

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const nowDesktop = window.innerWidth >= 1024;
      setIsDesktop(nowDesktop);
      setSidebarOpen(nowDesktop);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for auth logout events from apiClient for smoother navigation
  useEffect(() => {
    const handleAuthLogout = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('[MainLayout] Auth logout event:', customEvent.detail);
      // Use React Router navigate for smoother transition
      navigate('/login', { replace: true });
    };
    
    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, [navigate]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Handle navigation
  const handleNavigation = (path: string) => {
    navigate(path);
    // Close sidebar on mobile after navigation
    if (!isDesktop) {
      setSidebarOpen(false);
    }
  };

  // Get current system name for header
  const getCurrentSystemName = (): string => {
    const path = location.pathname.toLowerCase();
    
    if (path.includes('/admin')) return 'Admin';
    if (path.includes('/smart-parking') || path.includes('/parking')) return 'Smart Parking';
    if (path.includes('/service-delivery') || path.includes('/service')) return 'Service Delivery';
    if (path.includes('/dashboard') || path === '/') return 'Dashboard';
    if (path.includes('/profile')) return 'Profile';
    if (path.includes('/reports')) return 'Reports';
    if (path.includes('/settings')) return 'Settings';
    
    return 'Dashboard';
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner 
          message="Loading your dashboard..."
          longLoadingMessage="This is taking longer than usual. Please check your connection."
          longLoadingDelay={3000}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-300 
          lg:translate-x-0 
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${!sidebarOpen && 'lg:block hidden'}
        `}
      >
        <Sidebar 
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          isDesktop={isDesktop}
          links={sidebarLinks}
          currentPath={location.pathname}
          onNavigate={handleNavigation}
          userDepartment={userDepartment}
        />
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${isDesktop ? 'lg:ml-64 ml-0' : 'ml-0'}`}>
        {/* Header */}
        <Header 
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          currentSystem={getCurrentSystemName()}
          links={sidebarLinks}
          currentPath={location.pathname}
          onNavigate={handleNavigation}
        />

        {/* Page Content */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
