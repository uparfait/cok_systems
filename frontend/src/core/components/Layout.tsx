// Layout Component - Main application layout wrapper
// Provides consistent structure with sidebar, header, and main content area
// Dynamic based on user department and permissions

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

// Department-based system configurations
export const SYSTEM_CONFIGS = {
  // 'IT Department': {
  //   systems: [
  //     { id: 'parking', name: 'Smart Parking', path: '/dashboard/parking', icon: 'FiTruck' },
  //     { id: 'service', name: 'Service Delivery', path: '/dashboard/service', icon: 'FiClipboard' },
  //   ],
  //   defaultSystem: 'parking'
  // },
  // 'Finance Department': {
  //   systems: [
  //     { id: 'parking', name: 'Smart Parking', path: '/dashboard/parking', icon: 'FiTruck' },
  //     { id: 'reports', name: 'Financial Reports', path: '/dashboard/reports', icon: 'FiBarChart' },
  //   ],
  //   defaultSystem: 'reports'
  // },
  // 'HR Department': {
  //   systems: [
  //     { id: 'service', name: 'Service Delivery', path: '/dashboard/service', icon: 'FiClipboard' },
  //     { id: 'employees', name: 'Employees', path: '/dashboard/employees', icon: 'FiUsers' },
  //   ],
  //   defaultSystem: 'service'
  // },
  // 'Legal Department': {
  //   systems: [
  //     { id: 'service', name: 'Service Delivery', path: '/dashboard/service', icon: 'FiClipboard' },
  //     { id: 'parking', name: 'Smart Parking', path: '/dashboard/parking', icon: 'FiTruck' },
  //   ],
  //   defaultSystem: 'service'
  // },
  // 'Operations': {
  //   systems: [
  //     { id: 'parking', name: 'Smart Parking', path: '/dashboard/parking', icon: 'FiTruck' },
  //     { id: 'service', name: 'Service Delivery', path: '/dashboard/service', icon: 'FiClipboard' },
  //     { id: 'employees', name: 'Employees', path: '/dashboard/employees', icon: 'FiUsers' },
  //   ],
  //   defaultSystem: 'parking'
  // },
  'System Admin': {
    systems: [
      { id: 'dashboard', name: 'Dashboard', path: '/admin/dashboard', icon: 'FiHome' },
      { id: 'parking', name: 'Smart Parking', path: '/smart_parking/dashboard', icon: 'FiTruck' },
      { id: 'service', name: 'Service Delivery', path: '/service_delivery/dashboard', icon: 'FiClipboard' },
      { id: 'employees', name: 'Employees', path: '/admin/employees', icon: 'FiUsers' },
      { id: 'departments', name: 'Departments', path: '/admin/departments', icon: 'FiGrid' },
      { id: 'feedback', name: 'Feedback', path: '#', icon: 'FiMessageSquare' },
      { id: 'reports', name: 'Reports', path: '#', icon: 'FiBarChart' },
      { id: 'settings', name: 'Settings', path: '#', icon: 'FiSettings' },
    ],
    defaultSystem: 'dashboard'
  }
};

// Get department from user (supports both departmentName and department_name)
export const getUserDepartment = (user: any): string => {
  if (!user) return '';
  return user.departmentName || user.department_name || '';
};

// Get user's available systems based on department
export const getUserSystems = (user: any) => {
  const department = getUserDepartment(user);
  const normalizedDept = department.toLowerCase();
  
  // Check user's role first - if role is system/admin, show admin dashboard
  // If role is not recognized, show under-development message
  const userRole = user?.role?.toLowerCase() || '';
  
  // Define valid roles that have dashboards
  const validRoles = ['system', 'admin', 'system admin', 'it', 'finance', 'hr', 'legal', 'operations'];
  const isValidRole = validRoles.includes(userRole);
  
  if (!isValidRole) {
    // Return minimal systems - user will be redirected to under-development
    return [
      { id: 'dashboard', name: 'Dashboard', path: '/under-development', icon: 'FiHome' },
    ];
  }
  
  // Check for system admin roles (system, admin, system admin)
  if (userRole === 'system' || userRole === 'admin' || userRole === 'system admin') {
    return SYSTEM_CONFIGS['System Admin'].systems;
  }
  
  // Check for exact match first
  if (SYSTEM_CONFIGS[department as keyof typeof SYSTEM_CONFIGS]) {
    return SYSTEM_CONFIGS[department as keyof typeof SYSTEM_CONFIGS].systems;
  }
  
  // Check for partial matches (e.g., "IT" matches "IT Department")
  for (const [key, config] of Object.entries(SYSTEM_CONFIGS)) {
    if (normalizedDept.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedDept)) {
      return config.systems;
    }
  }
  
  // Return default systems for unknown departments
  return [
    { id: 'dashboard', name: 'Dashboard', path: '/admin/dashboard', icon: 'FiHome' },
    { id: 'parking', name: 'Smart Parking', path: '/smart_parking/dashboard', icon: 'FiTruck' },
    { id: 'service', name: 'Service Delivery', path: '/service_delivery/dashboard', icon: 'FiClipboard' },
  ];
};

// Check if department has a dedicated dashboard
export const hasDedicatedDashboard = (user: any): boolean => {
  const department = getUserDepartment(user);
  return department.toLowerCase().includes('system admin');
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentSystem, setCurrentSystem] = useState('dashboard');

  // Get user's available systems
  const userSystems = getUserSystems(user);

  // Determine current system from URL path
  useEffect(() => {
    const path = location.pathname;
    const systemMatch = userSystems.find(s => path.includes(s.id));
    if (systemMatch) {
      setCurrentSystem(systemMatch.id);
    }
  }, [location.pathname, userSystems]);

  // Redirect to system selector if no specific system is selected
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Handle system change
  const handleSystemChange = (systemId: string) => {
    setCurrentSystem(systemId);
    const system = userSystems.find(s => s.id === systemId);
    if (system) {
      navigate(system.path);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      // Use logout from auth context
      const { logout } = useAuth();
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect to login even if logout fails
      window.location.href = '/login';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        systems={userSystems}
        currentSystem={currentSystem}
        onSystemChange={handleSystemChange}
        userDepartment={getUserDepartment(user)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 ml-64">
        {/* Header */}
        <Header 
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          systems={userSystems}
          currentSystem={currentSystem}
          onSystemChange={handleSystemChange}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
