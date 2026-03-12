// Smart Parking System - Index file
// Exports all smart parking components, pages, and services

// Pages
export { default as SmartParkingDashboard } from './pages/SmartParkingDashboard';
export { default as ParkingDashboard } from './pages/SmartParkingDashboard'; // Alias for backward compatibility
export { default as RegisterVisitorPage } from './pages/RegisterVisitorPage';
export { default as CheckoutPage } from './pages/CheckoutPage';
export { default as MonitorPage } from './pages/MonitorPage';
export { default as ReportsPage } from './pages/ReportsPage';

// Components
export * from './components';

// Services
export * from './services';
