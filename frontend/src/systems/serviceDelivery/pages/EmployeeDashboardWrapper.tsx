import React from 'react';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '../../../core/components/Layout/MainLayout';
import EmployeeDashboard from './EmployeeDashboard';
import { PerformanceAnalyticsTab, ServiceHistoryTab, DepartmentQueueTab } from '../components/employeeFlow/tabs';

type EmployeeTab = 'dashboard' | 'services' | 'performance' | 'history' | 'queue' | 'availability';

const EmployeeDashboardWrapper: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  // Determine which tab to render based on query parameter
  let activeTab: EmployeeTab = 'dashboard';
  if (tabParam === 'services') activeTab = 'services';
  else if (tabParam === 'performance') activeTab = 'performance';
  else if (tabParam === 'history') activeTab = 'history';
  else if (tabParam === 'queue') activeTab = 'queue';
  else if (tabParam === 'availability') activeTab = 'availability';

  // Render the appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'performance':
        return <PerformanceAnalyticsTab />;
      case 'history':
        return <ServiceHistoryTab />;
      case 'queue':
        return <DepartmentQueueTab />;
      case 'services':
      case 'availability':
      case 'dashboard':
      default:
        // Default dashboard view shows the main employee dashboard
        return <EmployeeDashboard />;
    }
  };

  return (
    <MainLayout>
      {renderTabContent()}
    </MainLayout>
  );
};

export default EmployeeDashboardWrapper;
