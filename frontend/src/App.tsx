// App - Main application component
// Entry point for the COK Systems frontend application
// Safely merged Smart Parking and Service Delivery Routes

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

// Import from new systems folder (wrappers with MainLayout built-in)
import { 
  AdminDashboard, 
  DepartmentsPage, 
  EmployeesPage, 
  UserManagementPage,
  RolesManagementPage
} from './systems/admin';

// 👉 COLLEGUE'S IMPORTS (Smart Parking)
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
  EmployeeDashboard 
} from './systems/serviceDelivery';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <NotificationProvider>
          <ToastProvider>
            <Router>
             // <ChatWidget />
            <Routes>
              {/* Public Routes - No layout needed */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              
              {/* Protected Routes - Using new systems with MainLayout */}
              
              {/* ==================== ADMIN SYSTEM ==================== */}
              <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/departments" element={<ProtectedRoute><DepartmentsPage /></ProtectedRoute>} />
              <Route path="/admin/employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />
              <Route path="/admin/user-management" element={<ProtectedRoute><UserManagementPage /></ProtectedRoute>} />
              <Route path="/admin/roles-management" element={<ProtectedRoute><RolesManagementPage /></ProtectedRoute>} />
              
              {/* ==================== SMART PARKING SYSTEM (Colleague's Work) ==================== */}
              <Route path="/smart-parking/dashboard" element={<ProtectedRoute><SmartParkingDashboard /></ProtectedRoute>} />
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
              
              {/* Pending Service Delivery Sub-pages */}
              <Route path="/service-delivery/visitors" element={<ProtectedRoute><UnderDevelopment /></ProtectedRoute>} />
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

export default App;
