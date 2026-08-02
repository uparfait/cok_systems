// Service Delivery System - Index file
// Exports all service delivery components, pages, and services

// Pages
export { default as ServiceDashboard } from './pages/ServiceDeliveryDashboard';
export { default as ReceptionistDashboard } from './pages/ReceptionistDashboardWrapper';
export { default as ReceptionistVisitors } from './pages/ReceptionistVisitors';
export { default as DepartmentManagerDashboard } from './pages/DepartmentManagerDashboardWrapper';
export { default as EmployeeDashboard } from './pages/EmployeeDashboardWrapper';
export { default as EmployeeVisitorsTab } from './components/employeeFlow/tabs/EmployeeVisitorsTab';
export { default as VisitorDetailsPage } from './pages/VisitorDetailsPage';

// Components
export * from './components';

// Services
export * from './services';
