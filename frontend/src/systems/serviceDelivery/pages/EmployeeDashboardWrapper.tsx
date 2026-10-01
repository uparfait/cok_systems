import React from 'react';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '../../../core/components/Layout/MainLayout';
import EmployeeDashboard from './EmployeeDashboard';
import { PerformanceAnalyticsTab, DepartmentQueueTab } from '../components/employeeFlow/tabs';
import { TaskManager } from '../../../systems/taskManagement';

const EmployeeQueue: React.FC = () => (
  <div className="flex flex-col h-full" style={{ backgroundColor: '#F7F9FB' }}>
    <div className="flex-1 overflow-auto p-4">
      <DepartmentQueueTab />
    </div>
  </div>
);

const EmployeeDashboardWrapper: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');

  const renderTabContent = () => {
    switch (tab) {
      case 'queue':
        return <EmployeeQueue />;
      case 'performance':
        return <PerformanceAnalyticsTab />;
      case 'tasks':
        return <TaskManager />;
      default:
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
