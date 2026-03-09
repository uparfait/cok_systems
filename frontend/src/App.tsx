// App - Main application component
// Entry point for the COK Systems frontend application
// Updated to use the new systems-based structure with dynamic sidebar

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import ProfilePage from './pages/profile/ProfilePage';
import SystemSelector from './pages/dashboard/SystemSelector';
import UnderDevelopment from './pages/dashboard/UnderDevelopment';
import ProtectedRoute from './core/components/ProtectedRoute';
import { AuthProvider } from './core/contexts/AuthContext';
import { SocketProvider } from './core/contexts/SocketContext';
import { NotificationProvider } from './core/contexts/NotificationContext';
import { ToastProvider } from './core/contexts/ToastContext';

// Import from new systems folder (wrappers with MainLayout built-in)
import { 
  AdminDashboard, 
  DepartmentsPage, 
  EmployeesPage, 
  UserManagementPage 
} from './systems/admin';
import { ParkingDashboard } from './systems/smartParking';
import { ServiceDashboard } from './systems/serviceDelivery';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <NotificationProvider>
          <ToastProvider>
            <Router>
            <Routes>
              {/* Public Routes - No layout needed */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              
              {/* Protected Routes - Using new systems with MainLayout */}
              
              {/* ==================== ADMIN SYSTEM ==================== */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/admin/departments"
                element={
                  <ProtectedRoute>
                    <DepartmentsPage />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/admin/employees"
                element={
                  <ProtectedRoute>
                    <EmployeesPage />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/admin/user-management"
                element={
                  <ProtectedRoute>
                    <UserManagementPage />
                  </ProtectedRoute>
                }
              />
              
              {/* ==================== SMART PARKING SYSTEM ==================== */}
              <Route
                path="/smart-parking/dashboard"
                element={
                  <ProtectedRoute>
                    <ParkingDashboard />
                  </ProtectedRoute>
                }
              />
              
              {/* Smart Parking - Check In */}
              <Route
                path="/smart-parking/check-in"
                element={
                  <ProtectedRoute>
                    <UnderDevelopment />
                  </ProtectedRoute>
                }
              />
              
              {/* Smart Parking - Check Out */}
              <Route
                path="/smart-parking/check-out"
                element={
                  <ProtectedRoute>
                    <UnderDevelopment />
                  </ProtectedRoute>
                }
              />
              
              {/* Smart Parking - Records */}
              <Route
                path="/smart-parking/records"
                element={
                  <ProtectedRoute>
                    <UnderDevelopment />
                  </ProtectedRoute>
                }
              />
              
              {/* Smart Parking - Reports */}
              <Route
                path="/smart-parking/reports"
                element={
                  <ProtectedRoute>
                    <UnderDevelopment />
                  </ProtectedRoute>
                }
              />
              
              {/* Legacy route support */}
              <Route
                path="/smart_parking/dashboard"
                element={
                  <ProtectedRoute>
                    <ParkingDashboard />
                  </ProtectedRoute>
                }
              />
              
              {/* ==================== SERVICE DELIVERY SYSTEM ==================== */}
              <Route
                path="/service-delivery/dashboard"
                element={
                  <ProtectedRoute>
                    <ServiceDashboard />
                  </ProtectedRoute>
                }
              />
              
              {/* Service Delivery - Visitors */}
              <Route
                path="/service-delivery/visitors"
                element={
                  <ProtectedRoute>
                    <UnderDevelopment />
                  </ProtectedRoute>
                }
              />
              
              {/* Service Delivery - Check In */}
              <Route
                path="/service-delivery/check-in"
                element={
                  <ProtectedRoute>
                    <UnderDevelopment />
                  </ProtectedRoute>
                }
              />
              
              {/* Service Delivery - Check Out */}
              <Route
                path="/service-delivery/check-out"
                element={
                  <ProtectedRoute>
                    <UnderDevelopment />
                  </ProtectedRoute>
                }
              />
              
              {/* Service Delivery - Department Flow */}
              <Route
                path="/service-delivery/department-flow"
                element={
                  <ProtectedRoute>
                    <UnderDevelopment />
                  </ProtectedRoute>
                }
              />
              
              {/* Legacy route support */}
              <Route
                path="/service_delivery/dashboard"
                element={
                  <ProtectedRoute>
                    <ServiceDashboard />
                  </ProtectedRoute>
                }
              />
              
              {/* ==================== SYSTEM SELECTOR ==================== */}
              <Route
                path="/system-selector"
                element={
                  <ProtectedRoute>
                    <SystemSelector />
                  </ProtectedRoute>
                }
              />
              
              {/* ==================== PROFILE ==================== */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              
              {/* ==================== UNDER DEVELOPMENT ==================== */}
              <Route
                path="/under-development"
                element={
                  <ProtectedRoute>
                    <UnderDevelopment />
                  </ProtectedRoute>
                }
              />
              
              {/* ==================== LEGACY ROUTES SUPPORT ==================== */}
              {/* These redirect to new system routes */}
              <Route
                path="/dashboard"
                element={<Navigate to="/admin/dashboard" replace />}
              />
              
              {/* Default redirect - Go to login */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              
              {/* 404 */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Router>
          </ToastProvider>
        </NotificationProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
