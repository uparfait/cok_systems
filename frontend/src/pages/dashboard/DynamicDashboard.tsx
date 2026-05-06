// DynamicDashboard - Renders the appropriate dashboard based on the role parameter
import React from 'react';
import { useParams } from 'react-router-dom';
import AdminDashboard from '../../systems/admin/pages/AdminDashboard';
import ReceptionistDashboard from '../../systems/serviceDelivery/pages/ReceptionistDashboard';
import DepartmentManagerDashboard from '../../systems/serviceDelivery/pages/DepartmentManagerDashboard';
import EmployeeDashboard from '../../systems/serviceDelivery/pages/EmployeeDashboard';
import SmartParkingDashboard from '../../systems/smartParking/pages/SmartParkingDashboard';

const DynamicDashboard: React.FC = () => {
  const { rolename } = useParams<{ rolename: string }>();

  // Determine which dashboard to render based on the rolename parameter
  const getDashboardComponent = () => {
    if (!rolename) return <AdminDashboard />;

    const normalizedRole = rolename.toLowerCase().trim();

    // Admin roles
    if (normalizedRole.includes('admin') || normalizedRole.includes('administrator') || normalizedRole.includes('system')) {
      return <AdminDashboard />;
    }

    // Receptionist roles
    if (normalizedRole.includes('receptionist')) {
      return <ReceptionistDashboard />;
    }

    // Department Manager roles
    if (normalizedRole.includes('department') && (normalizedRole.includes('manager') || normalizedRole.includes('head') || normalizedRole.includes('director'))) {
      return <DepartmentManagerDashboard />;
    }

    // Generic manager roles
    if (normalizedRole.includes('manager') || normalizedRole.includes('head')) {
      return <DepartmentManagerDashboard />;
    }

    // Employee/Staff roles
    if (normalizedRole.includes('employee') || normalizedRole.includes('staff') || normalizedRole.includes('officer') || normalizedRole.includes('clerk')) {
      return <EmployeeDashboard />;
    }

    // Gate/Security roles
    if (normalizedRole.includes('gate') || normalizedRole.includes('security') || normalizedRole.includes('parking')) {
      return <SmartParkingDashboard />;
    }

    // Default to admin dashboard
    return <AdminDashboard />;
  };

  return getDashboardComponent();
};

export default DynamicDashboard;