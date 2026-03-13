// EmployeeDashboard - Content component for MainLayout
// Sidebar and Header are provided by MainLayout
import React from 'react';
import { useSearchParams } from 'react-router-dom';

// Import tab components
import { EmployeeDashboardTab, ProvideServicesTab, AvailabilityTab } from '../components/employeeFlow/tabs';

type NavItem = 'dashboard' | 'services' | 'availability';

const EmployeeDashboard: React.FC = () => {
  // Use React Router's search params to grab the ?tab= value from the URL
  const [searchParams] = useSearchParams();
  
  // Get the current tab from the URL, default to 'dashboard' if none exists
  const tabParam = searchParams.get('tab');
  const activeNav: NavItem = ['dashboard', 'services', 'availability'].includes(tabParam || '') 
    ? (tabParam as NavItem) 
    : 'dashboard';

  // Render the correct component based on the URL parameter
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

  return (
    <div className="flex flex-col h-full">
      {/* NOTE: The horizontal tab buttons have been removed. 
        Navigation is now seamlessly handled by the MainLayout sidebar 
        and the URL parameters! 
      */}

      {/* Page Content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default EmployeeDashboard;