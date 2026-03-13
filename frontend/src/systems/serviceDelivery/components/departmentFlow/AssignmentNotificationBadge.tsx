// AssignmentNotificationBadge Component - Assignment notification badge
// Shows notification for new visitor assignments

import React, { useState, useEffect } from 'react';
import { FiBell, FiX, FiUsers, FiArrowRight } from 'react-icons/fi';

interface AssignmentNotification {
  _id: string;
  visitorName: string;
  visitorId: string;
  departmentName: string;
  assignedAt: string;
  isRead: boolean;
}

interface AssignmentNotificationBadgeProps {
  notifications?: AssignmentNotification[];
  onNotificationClick?: (notification: AssignmentNotification) => void;
  onMarkAllRead?: () => void;
  maxDisplay?: number;
}

const AssignmentNotificationBadge: React.FC<AssignmentNotificationBadgeProps> = ({
  notifications: propNotifications,
  onNotificationClick,
  onMarkAllRead,
  maxDisplay = 5,
}) => {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AssignmentNotification[]>(propNotifications || []);
  const [localNotifications, setLocalNotifications] = useState<AssignmentNotification[]>([]);

  // Load notifications from props or use local ones
  useEffect(() => {
    if (propNotifications) {
      setNotifications(propNotifications);
    }
  }, [propNotifications]);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const displayNotifications = notifications.slice(0, maxDisplay);

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Handle notification click
  const handleNotificationClick = (notification: AssignmentNotification) => {
    // Mark as read
    const updated = notifications.map(n => 
      n._id === notification._id ? { ...n, isRead: true } : n
    );
    setNotifications(updated);
    
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  // Handle mark all as read
  const handleMarkAllRead = () => {
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    setNotifications(updated);
    if (onMarkAllRead) {
      onMarkAllRead();
    }
  };

  // Demo notifications for display
  const demoNotifications: AssignmentNotification[] = [
    {
      _id: '1',
      visitorName: 'John Mugisha',
      visitorId: 'v1',
      departmentName: 'Operations',
      assignedAt: new Date(Date.now() - 5 * 60000).toISOString(),
      isRead: false,
    },
    {
      _id: '2',
      visitorName: 'Sarah Kemiremare',
      visitorId: 'v2',
      departmentName: 'Finance',
      assignedAt: new Date(Date.now() - 30 * 60000).toISOString(),
      isRead: false,
    },
    {
      _id: '3',
      visitorName: 'Patrick Nyagah',
      visitorId: 'v3',
      departmentName: 'Legal',
      assignedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      isRead: true,
    },
  ];

  const display = notifications.length > 0 ? displayNotifications : demoNotifications;
  const currentUnreadCount = notifications.length > 0 ? unreadCount : demoNotifications.filter(n => !n.isRead).length;

  return (
    <div className="relative">
      {/* Badge Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      >
        <FiBell className="text-xl" />
        {currentUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {currentUnreadCount > 9 ? '9+' : currentUnreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-20 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <FiBell /> Assignments
              </h3>
              {currentUnreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {display.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <FiUsers className="text-4xl mx-auto mb-2 opacity-50" />
                  <p>No new assignments</p>
                </div>
              ) : (
                display.map((notification) => (
                  <div
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                      !notification.isRead ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        !notification.isRead ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <FiUsers />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notification.isRead ? 'font-medium' : ''} text-gray-900`}>
                          {notification.visitorName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          Assigned to {notification.departmentName}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTime(notification.assignedAt)}
                        </p>
                      </div>

                      {/* Unread indicator */}
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > maxDisplay && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                <button className="w-full text-sm text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1">
                  View all assignments <FiArrowRight />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Compact version for inline use
export const CompactNotificationBadge: React.FC<{ count?: number }> = ({ count = 0 }) => {
  if (count === 0) return null;
  
  return (
    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
      {count > 9 ? '9+' : count}
    </span>
  );
};

export default AssignmentNotificationBadge;
