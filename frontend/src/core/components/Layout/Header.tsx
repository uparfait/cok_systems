import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useToast } from "../../contexts/ToastContext";
import ProfileModal from "../ProfileModal";
import {
  FiMenu,
  FiBell,
  FiChevronDown,
  FiLogOut,
  FiHelpCircle,
  FiCheck,
  FiUser,
  FiX,
} from "react-icons/fi";

interface SidebarLink {
  id: string;
  name: string;
  path: string;
  icon: string;
  isParent: boolean;
  parentId?: string;
}

interface HeaderProps {
  onMenuToggle: () => void;
  currentSystem: React.ReactNode;
  links: SidebarLink[];
  currentPath: string;
  onNavigate: (path: string) => void;
  // MainLayout's own sidebar auto-pins open at the lg breakpoint, so the
  // toggle button only needs to exist below it (lg:hidden). A consumer
  // whose sidebar never auto-pins (it's always an overlay, at any screen
  // size) needs the button reachable at every width instead - true here
  // keeps it visible past lg: too, without changing anything for MainLayout
  // and every other existing caller, which never pass this prop.
  alwaysShowMenuButton?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  onMenuToggle,
  currentSystem,
  links,
  currentPath,
  onNavigate,
  alwaysShowMenuButton,
}) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } =
    useNotification();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutOverlay, setShowLogoutOverlay] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const displayName = user?.fullName || "User";
  const displayRole = user?.role || "Guest";
  const userDepartment = user?.departmentName || user?.department_name || "";

  const nameParts = displayName
    .trim()
    .split(" ")
    .filter((part) => part.length > 0);
  const userInitial =
    nameParts.length >= 2
      ? (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase()
      : displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    setShowLogoutOverlay(true);
    try {
      await logout();
      // No hard redirect: clearing the auth state makes MainLayout/ProtectedRoute
      // client-side navigate to "/" without refreshing the page.
    } catch (error) {
      console.error("Logout error:", error);
      setShowLogoutOverlay(false);
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "warning":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      case "success":
        return "bg-green-500";
      default:
        return "cok-primary-bg";
    }
  };

  const formatTimestamp = (timestamp: Date) =>
    new Date(timestamp).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const DETAIL_LABELS: Record<string, string> = {
    department_name: "Department",
    visitor_name: "Visitor",
    assigned_total: "Assigned visitors",
    waiting_total: "Visitors waiting now",
    plate_number: "Plate number",
    driver_type: "Driver type",
    duration_hours: "Hours parked",
    a_type: "Type",
    published_by: "Published by",
    alert_type: "Alert",
  };

  const renderNotificationDetails = (data: Record<string, any> | null | undefined) => {
    if (!data || typeof data !== "object") return null;

    const scalarEntries = Object.entries(data).filter(
      ([key, value]) =>
        DETAIL_LABELS[key] !== undefined &&
        (typeof value === "string" || typeof value === "number") &&
        String(value).length > 0
    );
    const queue = Array.isArray(data.queue) ? data.queue : null;
    const link = typeof data.link === "string" && data.link.length > 0 ? data.link : null;

    if (scalarEntries.length === 0 && !queue && !link) return null;

    return (
      <div className="mt-2 border border-gray-200 bg-gray-50 p-3 space-y-2">
        {scalarEntries.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {scalarEntries.map(([key, value]) => (
              <p key={key} className="text-xs text-gray-600 break-words">
                <span className="font-semibold text-gray-800">{DETAIL_LABELS[key]}:</span>{" "}
                <span className="capitalize">{String(value)}</span>
              </p>
            ))}
          </div>
        )}
        {queue && queue.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-1">
              Current queue
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {queue.map((item: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 text-xs bg-white border border-gray-200 px-2 py-1.5"
                >
                  <span className="text-gray-800 truncate">
                    {item.position}. {item.visitor_name}
                  </span>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      item.status === "Being served"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-block text-xs font-semibold uppercase tracking-wide px-3 py-1.5 text-white cok-primary-bg"
          >
            {typeof data.link_label === "string" && data.link_label ? data.link_label : "Open"}
          </a>
        )}
      </div>
    );
  };

  return (
    <>
      <header className="h-16 select-none cok-primary-bg px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 text-white">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className={`${alwaysShowMenuButton ? "" : "lg:hidden"} p-2 rounded-none hover:bg-white/10 text-white`}
          >
            <FiMenu className="w-5 h-5" />
          </button>

          <div className="flex flex-col">
            <span className="truncate text-xs font-semibold text-white sm:text-base md:text-lg">
              {typeof currentSystem === "string" ? currentSystem.split("-").join(" ").toLocaleUpperCase() : currentSystem}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 cursor-pointer rounded-full hover:bg-white/10 text-white transition-colors"
            >
              <FiBell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-[#056daa] text-white text-xs flex items-center justify-center font-medium">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>

          <button className="p-2 rounded-full cursor-pointer hover:bg-white/10 text-white transition-colors hidden sm:block">
            <FiHelpCircle className="w-5 h-5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 rounded-none cursor-pointer hover:bg-white/10 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm">
                {userInitial}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-white leading-tight">
                  {displayName}
                </p>
              </div>
              <FiChevronDown
                className={`w-4 h-4 text-white transition-transform hidden sm:block ${showUserMenu ? "rotate-180" : ""}`}
              />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-none shadow-lg py-2 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">
                    {displayName}
                  </p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                  {userDepartment && (
                    <p className="text-xs cok-primary-color mt-1">
                      {userDepartment}
                    </p>
                  )}
                </div>

                <div className="py-1">
                   <button
                     onClick={() => {
                       setShowUserMenu(false);
                       setShowProfileModal(true);
                     }}
                     className={`w-full cursor-pointer flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 ${
                       currentPath === "/profile"
                         ? "cok-primary-color bg-blue-50"
                         : "text-gray-700"
                     }`}
                   >
                     <FiUser className="w-4 h-4" />
                     Profile
                   </button>
                </div>

                <div className="border-t border-gray-100 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex cursor-pointer items-center gap-3 px-3 py-2 text-sm text-orange-500 hover:bg-orange-50 transition-colors"
                  >
                    <FiLogOut className="w-4 cursor-pointer h-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {showNotifications && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 sm:p-4">
          <div
            className="bg-white w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl flex flex-col"
            style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
          >
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-4 cok-bg-primary" style={{ borderRadius: 0 }}>
              <h2 className="text-base sm:text-lg font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ''}
              </h2>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="cok-btn-outlined-reverse text-xs flex items-center gap-1 cursor-pointer"
                    style={{ padding: '0.4rem 0.8rem' }}
                  >
                    <FiCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
                <button onClick={() => setShowNotifications(false)} className="cok-btn-outlined-reverse cursor-pointer" style={{ padding: '0.4rem 0.8rem' }}>
                  <FiX className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-6">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  You have no notifications
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => markAsRead(notification.id)}
                      className={`p-3 sm:p-4 border cursor-pointer transition-colors ${
                        !notification.read ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"
                      }`}
                      style={{ borderRadius: 0 }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 ${getNotificationColor(notification.type)}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1">
                            <p className="text-sm font-semibold text-gray-900 break-words">
                              {notification.title || 'Notification'}
                            </p>
                            {!notification.read && (
                              <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white cok-primary-bg">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 break-words whitespace-pre-wrap">
                            {notification.message}
                          </p>
                          {renderNotificationDetails(notification.data)}
                          <p className="text-xs text-gray-400 mt-2">
                            {formatTimestamp(notification.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 p-3 sm:p-6 pt-2 border-t" style={{ borderColor: '#E0E0E0' }}>
              <button
                type="button"
                onClick={clearNotifications}
                disabled={notifications.length === 0}
                className="w-full cok-btn-outlined disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ padding: '0.9rem 1.2rem' }}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoutOverlay && (
        <div className="cok-logout-overlay backdrop-blur-[12px] select-none">
          <div className="text-center">
            <p className="text-white/95 text-2xl font-semibold tracking-wide">
              {" "}
              Logging out &middot;&middot;&middot;&middot;
            </p>
          </div>
        </div>
      )}

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </>
  );
};

export default Header;
