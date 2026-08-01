import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
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
  currentSystem: string;
  links: SidebarLink[];
  currentPath: string;
  onNavigate: (path: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  onMenuToggle,
  currentSystem,
  links,
  currentPath,
  onNavigate,
}) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } =
    useNotification();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutOverlay, setShowLogoutOverlay] = useState(false);

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
    } catch (error) {
      console.error("Logout error:", error);
      setShowLogoutOverlay(false);
    } finally {
      window.location.href = "/";
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

  return (
    <>
      <header className="h-16 select-none cok-primary-bg px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 text-white">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-none hover:bg-white/10 text-white"
          >
            <FiMenu className="w-5 h-5" />
          </button>

          <div className="flex flex-col">
            <span className="truncate text-xs font-semibold text-white sm:text-base md:text-lg">
              {currentSystem?.split("-").join(" ").toLocaleUpperCase()}
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
                      onNavigate("/profile");
                      setShowUserMenu(false);
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col" style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 cok-bg-primary" style={{ borderRadius: 0 }}>
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Notifications
              </h2>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="cok-btn-outlined-reverse text-xs flex items-center gap-1"
                    style={{ padding: '0.4rem 0.8rem' }}
                  >
                    <FiCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
                <button onClick={() => setShowNotifications(false)} className="cok-btn-outlined-reverse" style={{ padding: '0.4rem 0.8rem' }}>
                  <FiX className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  No notifications
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => markAsRead(notification.id)}
                      className={`p-4 border cursor-pointer transition-colors ${
                        !notification.read ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"
                      }`}
                      style={{ borderRadius: 0 }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 ${getNotificationColor(notification.type)}`}
                        />
                        <div className="flex-1 min-w-0">
                          {notification.title && (
                            <p className="text-sm font-semibold text-gray-900 mb-1">
                              {notification.title}
                            </p>
                          )}
                          <p className="text-sm text-gray-700 break-words">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {notification.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6 pt-2 border-t" style={{ borderColor: '#E0E0E0' }}>
              <button
                type="button"
                onClick={clearNotifications}
                disabled={notifications.length === 0}
                className="w-full cok-btn-outlined"
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
    </>
  );
};

export default Header;
