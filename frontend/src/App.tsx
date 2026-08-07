import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
  useNavigate,
} from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import FeedbackLandingPage from "./pages/feedback/FeedbackLandingPage";
import FeedbackServicePage from "./pages/feedback/FeedbackServicePage";
import FeedbackGeneralPage from "./pages/feedback/FeedbackGeneralPage";
import UnderDevelopment from "./pages/dashboard/UnderDevelopment";
import ProtectedRoute from "./core/components/ProtectedRoute";
import MainLayout from "./core/components/Layout/MainLayout";
// import ChatWidget from './core/components/ChatWidget';
import { AuthProvider } from "./core/contexts/AuthContext";
import { SocketProvider } from "./core/contexts/SocketContext";
import { NotificationProvider } from "./core/contexts/NotificationContext";
import { ToastProvider } from "./core/contexts/ToastContext";
import PWAInstallPrompt from "./core/components/PWAInstallPrompt";
import { useAuth } from "./core/contexts/AuthContext";
import { getRoleSlug } from "./core/components/Layout/layoutUtils";

// Admin system imports
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
  MayorEventsPage,
  MayorActionsPage,
  MayorFeedbackPage,
  StorageManagement,
} from "./systems/admin";

// Smart Parking imports
import {
  SmartParkingDashboard,
  CheckInVehiclePage,
  CheckInPersonPage,
  CheckOutVehiclePage,
  CheckOutPersonPage,
} from "./systems/smartParking";

// Service Delivery imports
import {
  ServiceDashboard,
  ReceptionistDashboard,
  ReceptionistVisitors,
  DepartmentManagerDashboard,
  EmployeeDashboard,
  EmployeeVisitorsTab,
  VisitorDetailsPage,
} from "./systems/serviceDelivery";
import AssignedVisitorsList from "./systems/serviceDelivery/components/departmentFlow/AssignedVisitorsList";

import RequestsPage from "./pages/dashboard/RequestsPage";
// Task Management
import TaskManager from "./systems/taskManagement/TaskManager";
import FollowUpManager from "./systems/taskManagement/FollowUpManager";
// Head of Department pages
import HodEmployeesPage from "./systems/serviceDelivery/pages/hod/HodEmployeesPage";
import HodTasksPage from "./systems/serviceDelivery/pages/hod/HodTasksPage";
import HodAnnouncementsPage from "./systems/serviceDelivery/pages/hod/HodAnnouncementsPage";
import HodFeedbackPage from "./systems/serviceDelivery/pages/hod/HodFeedbackPage";

// event-managment
import Layout from "./systems/event-managment/pages/index/Layout.jsx";
import Request from "./systems/event-managment/pages/index/Request.jsx";
import BookingOptions from "./systems/event-managment/pages/index/BookingOptions.jsx";
import BookingRequestTrack from "./systems/event-managment/pages/index/BookingRequestTrack.jsx";
import BookNow from "./systems/event-managment/pages/index/BookNow.jsx";
import LiveEvents from "./systems/event-managment/pages/index/LiveEvents.jsx";
import UpcomingEvents from "./systems/event-managment/pages/index/UpcomingEvents.jsx";
import EventDetails from "./systems/event-managment/pages/index/EventDetails.jsx";
import EventActionsPage from "./systems/event-managment/pages/index/EventActionsPage.jsx";
import AttendanceForm from "./systems/event-managment/pages/index/AttendanceForm.jsx";
import AttendeesList from "./systems/event-managment/pages/index/AttendeesList.jsx";
import ShowEditor from "./systems/event-managment/pages/index/components/ShowEditor.jsx";
import MyTasksPage from "./systems/event-managment/pages/index/MyTasksPage.jsx";
import MyTasksTaskPage from "./systems/event-managment/pages/index/MyTasksTaskPage.jsx";
import InvitePage from "./systems/event-managment/pages/index/InvitePage.jsx";
import DesignateMinutes from "./systems/event-managment/pages/index/DesignateMinutes.jsx";

import DashboardLayout from "./systems/event-managment/pages/dashboard/DashboardLayout.jsx";
import DashboardPage from "./systems/event-managment/pages/dashboard/DashboardPage.jsx";
import CreateRoomForm from "./systems/event-managment/components/CreateRoomForm.jsx";
import RoomStatistics from "./systems/event-managment/components/RoomStatistics.jsx";
import CheckAvailability from "./systems/event-managment/components/CheckAvailability.jsx";
import DateCheck from "./systems/event-managment/components/DateCheck.jsx";
import RoomsList from "./systems/event-managment/components/RoomList.jsx";
import CreateEvent from "./systems/event-managment/components/CreateEvent.jsx";
import NewTypeSelector from "./systems/event-managment/components/NewTypeSelector.jsx";
import Live from "./systems/event-managment/components/Live.jsx";
import Upcoming from "./systems/event-managment/components/Upcoming.jsx";
import Recurring from "./systems/event-managment/components/Recurring.jsx";
import Past from "./systems/event-managment/components/Past.jsx";
import ViewEventDetailsDashboard from "./systems/event-managment/components/ViewEventDetailsDashboard.jsx";
import EventActions from "./systems/event-managment/components/EventActions.jsx";
import Editor from "./systems/event-managment/components/Editor.jsx";
import BookingRequestsList from "./systems/event-managment/components/BookingRequestsList.jsx";
import BookingRequestDetails from "./systems/event-managment/components/BookingRequestDetails.jsx";

// RoleDashboardPage: renders the correct dashboard component based on the logged-in user's role
const RoleDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const role = (user?.role || "").toLowerCase().trim();

  if (role.includes("event-manager")) return <DashboardLayout />;

  if (role.includes("receptionist")) return <ReceptionistDashboard />;
  if (role.includes("employee") || role.includes("staff"))
    return <EmployeeDashboard />;
  if (
    role.includes("department manager") ||
    role.includes("department head") ||
    role.includes("head of department") ||
    role.includes("director")
  )
    return <DepartmentManagerDashboard />;
  if (
    (role.includes("manager") || role.includes("head")) &&
    !role.includes("receptionist")
  )
    return <DepartmentManagerDashboard />;
  if (role.includes("gate") && role.includes("vehicle"))
    return <SmartParkingDashboard />;
  if (role.includes("admin") || role.includes("system"))
    return <AdminDashboard />;

  // Default: try admin
  return <AdminDashboard />;
};

// PWA Install Prompt Wrapper
const PWAInstallPromptWrapper: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(true);

  useEffect(() => {
    const handleInstallAvailable = () => {
      const isOnLoginPage =
        window.location.pathname === "/login" ||
        window.location.pathname === "/";
      if (!isOnLoginPage) setShowPrompt(true);
    };
    const handleInstalled = () => setShowPrompt(false);

    window.addEventListener("pwa-install-available", handleInstallAvailable);
    window.addEventListener("pwa-installed", handleInstalled);
    return () => {
      window.removeEventListener(
        "pwa-install-available",
        handleInstallAvailable,
      );
      window.removeEventListener("pwa-installed", handleInstalled);
    };
  }, []);

  console.log("PWAInstallPromptWrapper: showPrompt =", showPrompt);

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
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<LiveEvents />} />

                  <Route path="upcoming" element={<UpcomingEvents />} />
                  <Route path="book-a-room" element={<BookingOptions />} />
                  <Route
                    path="book-a-room/options"
                    element={<BookingOptions />}
                  />
                  <Route path="book-a-room/new" element={<BookNow />} />
                  <Route
                    path="book-a-room/new/:eventMeetingType"
                    element={<BookNow />}
                  />
                  <Route
                    path="book-a-room/track"
                    element={<BookingRequestTrack />}
                  />

                  <Route path="live/:id" element={<>Live Event Details</>} />
                  <Route
                    path="event/:id/attendances"
                    element={<AttendanceForm />}
                  />
                  <Route path="event/:id/details" element={<EventDetails />} />
                  <Route
                    path="event/:id/attendees"
                    element={<AttendeesList />}
                  />
                  <Route
                    path="event/:id/designate"
                    element={<DesignateMinutes />}
                  />
                  <Route
                    path="event/:id/actions"
                    element={<EventActionsPage />}
                  />
                  <Route path="event/:id/editor" element={<ShowEditor />} />
                  <Route path="event/:id/invite" element={<InvitePage />} />

                  <Route path="my-tasks" element={<MyTasksPage />} />
                  <Route
                    path="my-tasks/:taskId"
                    element={<MyTasksTaskPage />}
                  />
                  <Route path="feedback" element={<FeedbackLandingPage />} />
                  <Route
                    path="feedback/service"
                    element={<FeedbackServicePage />}
                  />
                  <Route
                    path="feedback/general"
                    element={<FeedbackGeneralPage />}
                  />
                </Route>

                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />

                <Route
                  path="/forgot-password"
                  element={<ForgotPasswordPage />}
                />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                <Route
                  path="/mayor/dashboard"
                  element={
                    <ProtectedRoute>
                      <OverviewPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/mayor/events"
                  element={
                    <ProtectedRoute>
                      <MayorEventsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/mayor/actions"
                  element={
                    <ProtectedRoute>
                      <MayorActionsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/mayor/feedback-analysis"
                  element={
                    <ProtectedRoute>
                      <MayorFeedbackPage />
                    </ProtectedRoute>
                  }
                />

                {/* ==================== ROLE-BASED ROUTES ==================== */}
                {/* Dashboard - role-specific component chosen at runtime */}
                

                {/* Separated Private/Authenticated Route View Wrapper */}
                <Route path="/event-manager" element={
                  <ProtectedRoute>
                  <DashboardLayout />
                  </ProtectedRoute>
                  }>
                
                  <Route index element={<DashboardPage />} />

                  {/* Rooms Management Routes */}
                  <Route
                    path="/event-manager/rooms/all"
                    element={<RoomsList />}
                  />
                  <Route
                    path="/event-manager/rooms/stats"
                    element={<RoomStatistics />}
                  />
                  <Route
                    path="/event-manager/rooms/new"
                    element={<CreateRoomForm />}
                  />
                  <Route
                    path="/event-manager/rooms/availability"
                    element={<CheckAvailability />}
                  />
                  <Route
                    path="/event-manager/rooms/date-check"
                    element={<DateCheck />}
                  />

                  {/* Events Management Routes */}
                  <Route path="/event-manager/events/live" element={<Live />} />
                  <Route
                    path="/event-manager/events/upcoming"
                    element={<Upcoming />}
                  />
                  <Route
                    path="/event-manager/events/recurring"
                    element={<Recurring />}
                  />
                  <Route path="/event-manager/events/past" element={<Past />} />
                  <Route
                    path="/event-manager/events/new"
                    element={<NewTypeSelector />}
                  />
                  <Route
                    path="/event-manager/events/new/event"
                    element={<CreateEvent eventMeetingType="event" />}
                  />
                  <Route
                    path="/event-manager/events/new/meet"
                    element={<CreateEvent eventMeetingType="meet" />}
                  />
                  <Route
                    path="/event-manager/events/:eventId/edit"
                    element={<CreateEvent eventMeetingType={undefined} />}
                  />
                  <Route
                    path="/event-manager/events/:eventId/details"
                    element={<ViewEventDetailsDashboard />}
                  />
                  <Route
                    path="/event-manager/events/:eventId/designate"
                    element={<DesignateMinutes />}
                  />
                  <Route
                    path="/event-manager/events/actions"
                    element={<EventActions />}
                  />
                  <Route
                    path="/event-manager/events/:eventId/invite"
                    element={<InvitePage />}
                  />

                  {/* Booking Requests Routes */}
                  <Route
                    path="/event-manager/booking-requests/all"
                    element={<BookingRequestsList />}
                  />
                  <Route
                    path="/event-manager/booking-requests/water"
                    element={<BookingRequestsList waterOnly />}
                  />
                  <Route
                    path="/event-manager/booking-requests/:id"
                    element={<BookingRequestDetails />}
                  />
                </Route>

                <Route
                  path="/:roleSlug/dashboard"
                  element={
                    <ProtectedRoute>
                      <RoleDashboardPage />
                    </ProtectedRoute>
                  }
                />

                {/* Task Management */}
                <Route
                  path="/:roleSlug/tasks"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <TaskManager />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/followups"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <FollowUpManager />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Admin system pages */}
                <Route
                  path="/:roleSlug/overview"
                  element={
                    <ProtectedRoute>
                      <OverviewPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/departments"
                  element={
                    <ProtectedRoute>
                      <DepartmentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/employees"
                  element={
                    <ProtectedRoute>
                      <EmployeesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/user-management"
                  element={
                    <ProtectedRoute>
                      <UserManagementPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/roles-management"
                  element={
                    <ProtectedRoute>
                      <RolesManagementPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/system-audit"
                  element={
                    <ProtectedRoute>
                      <SystemAuditPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/analytics"
                  element={
                    <ProtectedRoute>
                      <Analytics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/storage-management"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <StorageManagement />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/feedback"
                  element={
                    <ProtectedRoute>
                      <FeedbackPage />
                    </ProtectedRoute>
                  }
                />

                {/* Smart Parking pages */}
                <Route
                  path="/:roleSlug/smart-parking"
                  element={
                    <ProtectedRoute>
                      <AdminSmartParkingDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/smart-parking/reservation"
                  element={
                    <ProtectedRoute>
                      <ReservationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/checkin-vehicle"
                  element={
                    <ProtectedRoute>
                      <CheckInVehiclePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/checkin-person"
                  element={
                    <ProtectedRoute>
                      <CheckInPersonPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/checkout-vehicle"
                  element={
                    <ProtectedRoute>
                      <CheckOutVehiclePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/checkout-person"
                  element={
                    <ProtectedRoute>
                      <CheckOutPersonPage />
                    </ProtectedRoute>
                  }
                />

                {/* Service Delivery pages */}
                <Route
                  path="/:roleSlug/service-delivery/dashboard"
                  element={
                    <ProtectedRoute>
                      <AdminServiceDeliveryDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/service-delivery/checkin-checkout"
                  element={
                    <ProtectedRoute>
                      <AdminCheckInCheckOut />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/service-delivery/analytics"
                  element={
                    <ProtectedRoute>
                      <Analytics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/service-delivery/feedback"
                  element={
                    <ProtectedRoute>
                      <FeedbackPage />
                    </ProtectedRoute>
                  }
                />

                {/* Event Management Invite Page */}
                <Route
                  path="/:roleSlug/events/:eventId/invite"
                  element={
                    <ProtectedRoute>
                      <InvitePage />
                    </ProtectedRoute>
                  }
                />

                {/* Visitor details (for employee/receptionist) */}
                <Route
                  path="/:roleSlug/visitors/:visitorId"
                  element={
                    <ProtectedRoute>
                      <VisitorDetailsPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/:roleSlug/requests"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <RequestsPage />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/:roleSlug/all-visitors"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <EmployeeVisitorsTab />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Head of Department pages */}
                <Route
                  path="/:roleSlug/hod/employees"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <HodEmployeesPage />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/hod/tasks"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <HodTasksPage />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/hod/announcements"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <HodAnnouncementsPage />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:roleSlug/hod/feedback"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <HodFeedbackPage />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Shared pages */}

                {/* ==================== LEGACY ROUTE REDIRECTS ==================== */}
                <Route
                  path="/admin/overview"
                  element={<Navigate to="/system-admin/overview" replace />}
                />
                <Route
                  path="/admin/dashboard"
                  element={<Navigate to="/system-admin/dashboard" replace />}
                />
                <Route
                  path="/admin/departments"
                  element={<Navigate to="/system-admin/departments" replace />}
                />
                <Route
                  path="/admin/employees"
                  element={<Navigate to="/system-admin/employees" replace />}
                />
                <Route
                  path="/admin/user-managment"
                  element={
                    <Navigate to="/system-admin/user-managment" replace />
                  }
                />
                <Route
                  path="/admin/roles-managment"
                  element={
                    <Navigate to="/system-admin/roles-managment" replace />
                  }
                />
                <Route
                  path="/admin/system-audit"
                  element={<Navigate to="/system-admin/system-audit" replace />}
                />
                <Route
                  path="/admin/smart-parking"
                  element={
                    <Navigate to="/system-admin/smart-parking" replace />
                  }
                />
                <Route
                  path="/admin/smart-parking/reservation"
                  element={
                    <Navigate
                      to="/system-admin/smart-parking/reservation"
                      replace
                    />
                  }
                />
                <Route
                  path="/admin/service-delivery/dashboard"
                  element={
                    <Navigate
                      to="/system-admin/service-delivery/dashboard"
                      replace
                    />
                  }
                />
                <Route
                  path="/admin/service-delivery/checkin-checkout"
                  element={
                    <Navigate
                      to="/system-admin/service-delivery/checkin-checkout"
                      replace
                    />
                  }
                />
                <Route
                  path="/admin/analytics"
                  element={<Navigate to="/system-admin/analytics" replace />}
                />
                <Route
                  path="/admin/feedback"
                  element={<Navigate to="/system-admin/feedback" replace />}
                />
                <Route
                  path="/admin/service-delivery/analytics"
                  element={
                    <Navigate
                      to="/system-admin/service-delivery/analytics"
                      replace
                    />
                  }
                />
                <Route
                  path="/admin/service-delivery/feedback"
                  element={
                    <Navigate
                      to="/system-admin/service-delivery/feedback"
                      replace
                    />
                  }
                />
                <Route
                  path="/smart-parking/dashboard"
                  element={<Navigate to="/gate-officer/dashboard" replace />}
                />
                <Route
                  path="/smart-parking/checkin-vehicle"
                  element={
                    <Navigate to="/gate-officer/checkin-vehicle" replace />
                  }
                />
                <Route
                  path="/smart-parking/checkin-person"
                  element={
                    <Navigate to="/gate-officer/checkin-person" replace />
                  }
                />
                <Route
                  path="/smart-parking/checkout-vehicle"
                  element={
                    <Navigate to="/gate-officer/checkout-vehicle" replace />
                  }
                />
                <Route
                  path="/smart-parking/checkout-person"
                  element={
                    <Navigate to="/gate-officer/checkout-person" replace />
                  }
                />
                <Route
                  path="/service-delivery/receptionist"
                  element={<Navigate to="/receptionist/dashboard" replace />}
                />
                <Route
                  path="/receptionist/visitors"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <ReceptionistVisitors />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/receptionist/assigned"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <AssignedVisitorsList />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/service-delivery/department-manager"
                  element={
                    <Navigate to="/department-manager/dashboard" replace />
                  }
                />
                <Route
                  path="/service-delivery/employee"
                  element={<Navigate to="/employee/dashboard" replace />}
                />
                <Route
                  path="/service-delivery/dashboard"
                  element={
                    <Navigate
                      to="/system-admin/service-delivery/dashboard"
                      replace
                    />
                  }
                />
                <Route
                  path="/dashboard"
                  element={<Navigate to="/system-admin/dashboard" replace />}
                />

                {/* route for unknown route move to under development */}
                <Route
                  path=":roleSlug/Unknown-user"
                  element={
                    <ProtectedRoute>
                      <UnderDevelopment />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              {/* <ChatWidget /> */}
            </Router>
          </ToastProvider>
        </NotificationProvider>
      </SocketProvider>
    </AuthProvider>
  );
};

import SystemAlert from "./core/components/SystemAlert";
import SpiralLoader from "./systems/event-managment/components/SpiralLoader.jsx";

function AppWithPWA() {
  const [alerts, setAlerts] = useState({
    error: false,
    systemError: false,
    warning: false,
    success: false,
  });

  const openAlert = (type: keyof typeof alerts) => {
    setAlerts((prev) => ({ ...prev, [type]: true }));
  };

  const closeAlert = (type: keyof typeof alerts) => {
    setAlerts((prev) => ({ ...prev, [type]: false }));
  };

  return (
    <>
      <App />
      {/* <PWAInstallPromptWrapper /> */}

      {/* <SystemAlert
        isOpen={alerts.error}
        type="error"
        message="This is an error alert."
        onClose={() => closeAlert("error")}
      />
      <SystemAlert
        isOpen={alerts.systemError}
        type="systemError"
        message="This is a system error alert (500)."
        onClose={() => closeAlert("systemError")}
      />
      <SystemAlert
        isOpen={alerts.warning}
        type="warning"
        message="This is a warning alert."
        onClose={() => closeAlert("warning")}
      />
      <SystemAlert
        isOpen={alerts.success}
        type="success"
        message="This is a success alert."
        onClose={() => closeAlert("success")}
      />

      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          onClick={() => openAlert("error")}
          style={{
            padding: "8px 14px",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: "uppercase",
            border: "none",
            borderRadius: 0,
            cursor: "pointer",
            color: "#fff",
            backgroundColor: "#E53935",
          }}
        >
          Test Error
        </button>
        <button
          onClick={() => openAlert("systemError")}
          style={{
            padding: "8px 14px",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: "uppercase",
            border: "none",
            borderRadius: 0,
            cursor: "pointer",
            color: "#fff",
            backgroundColor: "#E74C3C",
          }}
        >
          Test System Error
        </button>
        <button
          onClick={() => openAlert("warning")}
          style={{
            padding: "8px 14px",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: "uppercase",
            border: "none",
            borderRadius: 0,
            cursor: "pointer",
            color: "#fff",
            backgroundColor: "#FF9800",
          }}
        >
          Test Warning
        </button>
        <button
          onClick={() => openAlert("success")}
          style={{
            padding: "8px 14px",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: "uppercase",
            border: "none",
            borderRadius: 0,
            cursor: "pointer",
            color: "#fff",
            backgroundColor: "#4CAF50",
          }}
        >
          Test Success
        </button>
      </div> */}
    </>
  );
}

export default AppWithPWA;
