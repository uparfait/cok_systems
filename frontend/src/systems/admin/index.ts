// Admin System - Index file
// Exports all admin system components, pages, and services

// Admin Pages
export { default as AdminDashboard } from './pages/AdminDashboard';
export { default as DepartmentsPage } from './pages/DepartmentsPage';
export { default as EmployeesPage } from './pages/EmployeesPage';
export { default as UserManagementPage } from './pages/UserManagementPage';

// Smart Parking Admin Pages
export { default as RolesManagementPage } from './pages/RolesManagementPage';
export { default as AdminSmartParkingDashboard } from './pages/AdminSmartParkingDashboard';
export { default as ReservationsPage } from './pages/ReservationsPage';

// Service Delivery Admin Pages
export { default as AdminServiceDeliveryDashboard } from './pages/AdminServiceDeliveryDashboard';
export { default as AdminCheckInCheckOut } from './pages/AdminCheckInCheckOut';
export { default as Analytics } from './pages/Analytics';
export { default as FeedbackPage } from './pages/FeedbackPage';

// Components
export * from './components';

// Services
export * from './services';
