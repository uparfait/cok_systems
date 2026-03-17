// Smart Parking System - Index file
// Exports all smart parking components, pages, and services

// Pages
export { default as SmartParkingDashboard } from './pages/SmartParkingDashboard';
export { default as ParkingDashboard } from './pages/SmartParkingDashboard'; // Alias for backward compatibility
export { default as RegisterVisitorPage } from './pages/RegisterVisitorPage';
export { default as CheckoutPage } from './pages/CheckoutPage';
export { default as CheckInVehiclePage } from './pages/CheckInVehiclePage';
export { default as CheckInPersonPage } from './pages/CheckInPersonPage';
export { default as CheckOutVehiclePage } from './pages/CheckOutVehiclePage';
export { default as CheckOutPersonPage } from './pages/CheckOutPersonPage';

// Components
export * from './components';

// Services
export * from './services';
