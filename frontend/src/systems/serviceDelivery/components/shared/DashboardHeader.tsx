// DashboardHeader Component - Reusable header for all dashboards

import React, { useState } from 'react';
import { FiActivity } from 'react-icons/fi';
import { NotificationBell, Profile } from './index';
import type { Notification as NotificationType } from './Notification';

const PRIMARY = "#056daa";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";

export type DashboardRole = 'receptionist' | 'department_manager' | 'employee';

export interface DashboardHeaderProps {
  activeTab: string;
  userRole: DashboardRole;
  userName: string;
  userInitials: string;
  userTitle: string;
  userAvatar?: string | null;
  notifications: NotificationType[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  menuItems?: { id: string; label: string }[];
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  activeTab,
  userRole,
  userName,
  userInitials,
  userTitle,
  userAvatar = null,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  // Get current date/time
  const [currentDate] = useState(new Date());
  const [showProfile, setShowProfile] = useState(false);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    }).toUpperCase();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toUpperCase();
  };

  // Get title based on active tab and role
  const getTitle = () => {
    if (userRole === 'receptionist') {
      switch (activeTab) {
        case 'visitors': return 'ASSIGNED VISITOR';
        case 'availability': return 'DEPARTMENT AVAILABILITY';
        default: return 'DASHBOARD';
      }
    } else if (userRole === 'department_manager') {
      switch (activeTab) {
        case 'dashboard': return 'DEPARTMENT DASHBOARD';
        case 'status': return (
          <span className="flex items-center gap-2">
            <FiActivity className="w-5 h-5 text-[#056daa]" />
            SERVICE TRACKING SYSTEM
          </span>
        );
        case 'employees': return 'EMPLOYEE MANAGEMENT';
        case 'availability': return 'DEPARTMENT AVAILABILITY';
        case 'reports': return 'DEPARTMENT PERFORMANCE REPORT';
        default: return 'DASHBOARD';
      }
    } else if (userRole === 'employee') {
      switch (activeTab) {
        case 'dashboard': return 'MY DASHBOARD';
        case 'services': return 'PROVIDE SERVICES';
        case 'availability': return 'AVAILABILITY';
        case 'reports': return 'REPORTS';
        default: return 'DASHBOARD';
      }
    }
    return 'DASHBOARD';
  };

  // Get role label for profile
  const getRoleLabel = (role: DashboardRole): string => {
    switch (role) {
      case 'receptionist':
        return 'Receptionist';
      case 'department_manager':
        return 'Department Manager';
      case 'employee':
        return 'Department Staff';
      default:
        return role;
    }
  };

  // Parse userName to firstName and lastName
  const getUserInfo = () => {
    const names = userName.split(' ');
    if (names.length >= 2) {
      return {
        firstName: names[0],
        lastName: names.slice(1).join(' ')
      };
    }
    return {
      firstName: userName,
      lastName: ''
    };
  };

  const userInfo = getUserInfo();

  return (
    <>
      <header
        className="h-16 flex items-center justify-between px-6"
        style={{ backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-6">
          <div>
            <h1
              className="text-lg font-bold"
              style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}
            >
              {getTitle()}
            </h1>
          </div>
          <div
            className="text-sm font-semibold"
            style={{ fontFamily: fontHeading, color: PRIMARY }}
          >
            {formatDate(currentDate)} - {formatTime(currentDate)}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Notification Bell */}
          <NotificationBell
            notifications={notifications}
            onMarkAsRead={onMarkAsRead}
            onMarkAllAsRead={onMarkAllAsRead}
            userRole={userRole}
          />

          {/* User Profile Section */}
          <div className="flex items-center gap-3 border-l border-[#E0E0E0] pl-4">
            <div>
              <p className="text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{userName}</p>
              <p className="text-xs" style={{ color: GRAY_DISABLED }}>{userTitle}</p>
            </div>

            {/* Avatar - Clickable to open profile */}
            <button
              onClick={() => setShowProfile(true)}
              className="relative w-9 h-9 rounded-full flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-[#056daa] transition-colors"
            >
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[rgba(5,109,170,0.08)] flex items-center justify-center">
                  <span className="text-sm font-medium text-[#056daa]">{userInitials}</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Profile Modal - Using Shared Profile Component */}
      {showProfile && (
        <Profile
          user={{
            firstName: userInfo.firstName,
            lastName: userInfo.lastName,
            role: getRoleLabel(userRole),
            avatar: userAvatar
          }}
          onClose={() => setShowProfile(false)}
        />
      )}
    </>
  );
};

export default DashboardHeader;
