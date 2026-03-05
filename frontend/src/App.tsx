// App - Main application component
// Entry point for the COK Systems frontend application

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import { DepartmentsPage, EmployeesPage } from './pages/Admin';
import AdminDashboard from './pages/Admin/AdminDashboard';
import SmartParkingDashboard from './pages/smart_parking/SmartParkingDashboard';
import ServiceDeliveryDashboard from './pages/service_delivery/ServiceDeliveryDashboard';
import SystemSelector from './pages/dashboard/SystemSelector';
import UnderDevelopment from './pages/dashboard/UnderDevelopment';
import ProfilePage from './pages/profile/ProfilePage';
import ProtectedRoute from './core/components/ProtectedRoute';
import Layout from './core/components/Layout';
import { AuthProvider } from './core/contexts/AuthContext';
import { SocketProvider } from './core/contexts/SocketContext';
import { NotificationProvider } from './core/contexts/NotificationContext';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <NotificationProvider>
          <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            
            {/* Protected Routes - Wrapped with Layout (Sidebar + Header) */}
            
            {/* ==================== ADMIN ROUTES ==================== */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AdminDashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/admin/departments"
              element={
                <ProtectedRoute>
                  <Layout>
                    <DepartmentsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/admin/employees"
              element={
                <ProtectedRoute>
                  <Layout>
                    <EmployeesPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* ==================== SMART PARKING ROUTES ==================== */}
            <Route
              path="/smart_parking/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SmartParkingDashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* ==================== SERVICE DELIVERY ROUTES ==================== */}
            <Route
              path="/service_delivery/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ServiceDeliveryDashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* ==================== SYSTEM SELECTOR ROUTE ==================== */}
            <Route
              path="/system-selector"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SystemSelector />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* ==================== PROFILE ROUTE ==================== */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProfilePage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* ==================== UNDER DEVELOPMENT ROUTE ==================== */}
            <Route
              path="/under-development"
              element={
                <ProtectedRoute>
                  <Layout>
                    <UnderDevelopment />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* Default redirect - Go to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            
            {/* 404 */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </NotificationProvider>
    </SocketProvider>
  </AuthProvider>
  );
}

export default App;
