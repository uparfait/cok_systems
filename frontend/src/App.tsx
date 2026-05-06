// App - Main application component
// Entry point for the COK Systems frontend application
// Safely merged Smart Parking and Service Delivery Routes

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import ProfilePage from './pages/profile/ProfilePage';
import UnderDevelopment from './pages/dashboard/UnderDevelopment';
import ProtectedRoute from './core/components/ProtectedRoute';
import { AuthProvider } from './core/contexts/AuthContext';
import { SocketProvider } from './core/contexts/SocketContext';
import { NotificationProvider } from './core/contexts/NotificationContext';
import { ToastProvider } from './core/contexts/ToastContext';
import ChatWidget from './core/components/ChatWidget';
import PWAInstallPrompt from './core/components/PWAInstallPrompt';

// Import from new systems folder (wrappers with MainLayout built-in)
import {
  AdminDashboard,
  DepartmentsPage,
  EmployeesPage,
  UserManagementPage,
  RolesManagementPage,
  AdminSmartParkingDashboard,
  ReservationsPage,
  AdminServiceDeliveryDashboard,
  AdminCheckInCheckOut,
  Analytics,
  FeedbackPage,
  OverviewPage,
  SystemAuditPage,
} from './systems/admin';

// 👉 COLLEAGUE'S IMPORTS (Smart Parking) - Cleaned to match new index.ts!
import {
  SmartParkingDashboard,
  CheckInVehiclePage,
  CheckInPersonPage,
  CheckOutVehiclePage,
  CheckOutPersonPage

} from './systems/smartParking';

// 👉 YOUR IMPORTS (Service Delivery)
import {
  ServiceDashboard,
  ReceptionistDashboard,
  DepartmentManagerDashboard,
  EmployeeDashboard,
  VisitorDetailsPage
} from './systems/serviceDelivery';



// PWA Install Prompt Wrapper Component
const PWAInstallPromptWrapper: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleInstallAvailable = () => {
      // Only show if user is authenticated (not on login page)
      const isOnLoginPage = window.location.pathname === '/login' || window.location.pathname === '/';
      if (!isOnLoginPage) {
        setShowPrompt(true);
      }
    };

    const handleInstalled = () => {
      setShowPrompt(false);
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('pwa-installed', handleInstalled);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('pwa-installed', handleInstalled);
    };
  }, []);

  return showPrompt ? (
    <PWAInstallPrompt onClose={() => setShowPrompt(false)} />
  ) : null;
};

// Main App Component
const App: React.FC = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <NotificationProvider>
          <ToastProvider>
            <Router>
              {/* <ProtectedRoute>
              <ChatWidget />
                </ProtectedRoute> */}
            <Routes>
              {/* Public Routes - No layout needed */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              
              {/* Protected Routes - Using new systems with MainLayout */}
              
              {/* ==================== ADMIN SYSTEM ==================== */}
               <Route path="/admin/overview" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
               <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
               <Route path="/admin/departments" element={<ProtectedRoute><DepartmentsPage /></ProtectedRoute>} />
               <Route path="/admin/employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />
               <Route path="/admin/user-management" element={<ProtectedRoute><UserManagementPage /></ProtectedRoute>} />
               <Route path="/admin/roles-management" element={<ProtectedRoute><RolesManagementPage /></ProtectedRoute>} />
               <Route path="/admin/system-audit" element={<ProtectedRoute><SystemAuditPage /></ProtectedRoute>} />
              <Route path="/admin/smart-parking" element={<ProtectedRoute><AdminSmartParkingDashboard /></ProtectedRoute>} />
              <Route path="/admin/smart-parking/reservation" element={<ProtectedRoute><ReservationsPage /></ProtectedRoute>} />
              
              {/* ==================== SERVICE DELIVERY ADMIN PAGES ==================== */}
              <Route path="/admin/service-delivery/dashboard" element={<ProtectedRoute><AdminServiceDeliveryDashboard /></ProtectedRoute>} />
              <Route path="/admin/service-delivery/checkin-checkout" element={<ProtectedRoute><AdminCheckInCheckOut /></ProtectedRoute>} />
              <Route path="/admin/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/admin/feedback" element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
              <Route path="/admin/service-delivery/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/admin/service-delivery/feedback" element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
              
              {/* ==================== SMART PARKING SYSTEM (Colleague's Work) ==================== */}
              <Route path="/smart-parking/dashboard" element={<ProtectedRoute><SmartParkingDashboard /></ProtectedRoute>} />
              
              {/* Colleague's New Routes */}
              <Route path="/smart-parking/checkin-vehicle" element={<ProtectedRoute><CheckInVehiclePage /></ProtectedRoute>} />
              <Route path="/smart-parking/checkin-person" element={<ProtectedRoute><CheckInPersonPage /></ProtectedRoute>} />
              <Route path="/smart-parking/checkout-vehicle" element={<ProtectedRoute><CheckOutVehiclePage /></ProtectedRoute>} />
              <Route path="/smart-parking/checkout-person" element={<ProtectedRoute><CheckOutPersonPage /></ProtectedRoute>} />
              
              <Route path="/smart_parking/dashboard" element={<ProtectedRoute><SmartParkingDashboard /></ProtectedRoute>} />
              
              {/* ==================== SERVICE DELIVERY SYSTEM (Your Work) ==================== */}
              <Route path="/service-delivery/receptionist" element={<ProtectedRoute><ReceptionistDashboard /></ProtectedRoute>} />
              <Route path="/service-delivery/department-manager" element={<ProtectedRoute><DepartmentManagerDashboard /></ProtectedRoute>} />
              <Route path="/service-delivery/employee" element={<ProtectedRoute><EmployeeDashboard /></ProtectedRoute>} />
              <Route path="/service-delivery/dashboard" element={<ProtectedRoute><ServiceDashboard /></ProtectedRoute>} />
              
              {/* Service Delivery Sub-pages */}
              <Route path="/service-delivery/visitors/:visitorId" element={<ProtectedRoute><VisitorDetailsPage /></ProtectedRoute>} />
              <Route path="/service-delivery/check-in" element={<ProtectedRoute><UnderDevelopment /></ProtectedRoute>} />
              <Route path="/service-delivery/check-out" element={<ProtectedRoute><UnderDevelopment /></ProtectedRoute>} />
              <Route path="/service-delivery/department-flow" element={<ProtectedRoute><UnderDevelopment /></ProtectedRoute>} />
              <Route path="/service_delivery/dashboard" element={<ProtectedRoute><ServiceDashboard /></ProtectedRoute>} />
              
              {/* ==================== SYSTEM SELECTOR & PROFILE ==================== */}
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/under-development" element={<ProtectedRoute><UnderDevelopment /></ProtectedRoute>} />
              
              {/* ==================== LEGACY ROUTES SUPPORT ==================== */}
              <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/" element={<Navigate to="/login" replace />} />
               <Route path="*" element={<Navigate to="/login" replace />} />
             </Routes>
           </Router>
          </ToastProvider>
        </NotificationProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

// Main App with PWA Wrapper
function AppWithPWA() {
  return (
    <>
      <App />
      <PWAInstallPromptWrapper />
    </>
  );
};

export default AppWithPWA;
