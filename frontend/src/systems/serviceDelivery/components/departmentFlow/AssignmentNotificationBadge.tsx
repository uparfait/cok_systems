import React, { useState, useEffect } from 'react';
import { FiBell, FiUsers, FiArrowRight } from 'react-icons/fi';
import { useVisitorPanel } from '../../../../core/components/visitor/VisitorPanelProvider';

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

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
  onViewAll?: () => void;
  maxDisplay?: number;
}

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

const AssignmentNotificationBadge: React.FC<AssignmentNotificationBadgeProps> = ({
  notifications: propNotifications,
  onNotificationClick,
  onMarkAllRead,
  onViewAll,
  maxDisplay = 5,
}) => {
  const { openVisitor } = useVisitorPanel();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AssignmentNotification[]>(propNotifications || []);

  useEffect(() => {
    if (propNotifications) {
      setNotifications(propNotifications);
    }
  }, [propNotifications]);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const displayNotifications = notifications.slice(0, maxDisplay);

  const handleNotificationClick = (notification: AssignmentNotification) => {
    setNotifications(prev => prev.map(n =>
      n._id === notification._id ? { ...n, isRead: true } : n
    ));
    setIsOpen(false);
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    openVisitor(notification.visitorId);
  };

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    if (onMarkAllRead) {
      onMarkAllRead();
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    if (onViewAll) onViewAll();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-[#056daa] hover:bg-[rgba(5,109,170,0.08)] transition-colors"
      >
        <FiBell className="text-xl" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 text-white text-xs rounded-full flex items-center justify-center font-medium" style={{ backgroundColor: DANGER }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 top-full mt-2 w-80 z-20 overflow-hidden" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, border: `1px solid ${BORDER}`, borderRadius: 0 }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: NEUTRAL_LIGHT }}>
              <h3 className="flex items-center gap-2" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>
                <FiBell /> Assignments
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs transition-colors"
                  style={{ color: PRIMARY }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = PRIMARY; }}
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {displayNotifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <FiUsers className="text-4xl mx-auto mb-2 opacity-50" />
                  <p>No new assignments</p>
                </div>
              ) : (
                displayNotifications.map((notification) => (
                  <div
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                      !notification.isRead ? 'bg-[rgba(5,109,170,0.08)]' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        !notification.isRead ? 'bg-[rgba(5,109,170,0.12)] text-[#056daa]' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <FiUsers />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notification.isRead ? 'font-medium' : ''}`} style={{ color: NEUTRAL_DARK }}>
                          {notification.visitorName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          Assigned to {notification.departmentName}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTime(notification.assignedAt)}
                        </p>
                      </div>

                      {!notification.isRead && (
                        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ backgroundColor: PRIMARY }} />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {onViewAll && notifications.length > maxDisplay && (
              <div className="px-4 py-3" style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: NEUTRAL_LIGHT }}>
                <button
                  onClick={handleViewAll}
                  className="w-full text-sm flex items-center justify-center gap-1 transition-colors"
                  style={{ color: PRIMARY }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = PRIMARY; }}
                >
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

export const CompactNotificationBadge: React.FC<{ count?: number }> = ({ count = 0 }) => {
  if (count === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#E74C3C] text-white text-xs rounded-full flex items-center justify-center font-medium">
      {count > 9 ? '9+' : count}
    </span>
  );
};

export default AssignmentNotificationBadge;
