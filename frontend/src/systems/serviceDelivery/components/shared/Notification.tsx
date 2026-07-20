// Notification Component - Real-time notifications across dashboards
import React, { useState } from 'react';
import { FiBell, FiCheck, FiUser, FiClock, FiX, FiFileText, FiAlertCircle, FiArrowRight } from 'react-icons/fi';

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  color: TERTIARY,
};

export type NotificationType = 'assignment' | 'service_complete' | 'status_change' | 'general';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
  visitorName?: string;
  serviceType?: string;
  department?: string;
  room?: string;
  timestamp?: string;
  details?: {
    visitorId?: string;
    serviceId?: string;
    assignedTo?: string;
    priority?: string;
    notes?: string;
  };
}

interface NotificationProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  userRole: 'receptionist' | 'department_manager' | 'employee';
  onNotificationClick?: (notification: Notification) => void;
}

// Initial mock notifications based on user role
export const getInitialNotifications = (role: string): Notification[] => {
  const baseNotifications: Notification[] = [
    {
      id: '1',
      type: 'assignment',
      title: 'New Visitor Assigned',
      message: 'A visitor has been assigned to your department',
      time: '2 min ago',
      read: false,
      visitorName: 'Jean Bosco',
      serviceType: 'Land Title',
      department: 'Revenue Office',
      room: 'Room 201',
      timestamp: '2024-01-15 10:30:00',
      details: {
        visitorId: 'V-001',
        serviceId: 'S-101',
        assignedTo: 'You',
        priority: 'Normal',
        notes: 'Please attend to this visitor at your earliest convenience'
      }
    },
    {
      id: '2',
      type: 'service_complete',
      title: 'Service Completed',
      message: 'Service has been completed by an employee',
      time: '15 min ago',
      read: false,
      visitorName: 'Marie Claire',
      serviceType: 'Building Permit',
      department: 'Planning',
      room: 'Room 305',
      timestamp: '2024-01-15 10:15:00',
      details: {
        visitorId: 'V-002',
        serviceId: 'S-102',
        assignedTo: 'John Doe',
        priority: 'High',
        notes: 'Building permit approved'
      }
    },
    {
      id: '3',
      type: 'status_change',
      title: 'Employee Status Changed',
      message: 'An employee is now available',
      time: '30 min ago',
      read: true,
      visitorName: 'Eric Nizeyimana',
      department: 'IT Department',
      timestamp: '2024-01-15 10:00:00',
      details: {
        visitorId: 'V-003',
        serviceId: 'S-103',
        assignedTo: 'Sarah Mukamana',
        priority: 'Normal'
      }
    },
    {
      id: '4',
      type: 'general',
      title: 'Queue Update',
      message: '5 new visitors have checked in',
      time: '1 hour ago',
      read: true,
      timestamp: '2024-01-15 09:30:00',
      details: {
        notes: 'Total queue now has 12 visitors waiting'
      }
    }
  ];

  // Filter based on role
  if (role === 'employee') {
    return baseNotifications.filter(n =>
      n.type === 'assignment' || n.type === 'status_change'
    );
  } else if (role === 'department_manager') {
    return baseNotifications.filter(n =>
      n.type === 'assignment' || n.type === 'service_complete'
    );
  }

  return baseNotifications;
};

const NotificationBell: React.FC<NotificationProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  userRole,
  onNotificationClick
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'assignment':
        return <FiUser className="w-4 h-4 text-[#056daa]" />;
      case 'service_complete':
        return <FiCheck className="w-4 h-4 text-[#388E3C]" />;
      case 'status_change':
        return <FiClock className="w-4 h-4 text-[#F39C12]" />;
      default:
        return <FiAlertCircle className="w-4 h-4 text-[#555555]" />;
    }
  };

  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case 'assignment':
        return 'bg-[rgba(5,109,170,0.08)]';
      case 'service_complete':
        return 'bg-[rgba(76,175,80,0.12)]';
      case 'status_change':
        return 'bg-[rgba(243,156,18,0.12)]';
      default:
        return 'bg-[#F0F0F0]';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }

    // Show detail modal
    setSelectedNotification(notification);
    setShowDetailModal(true);

    // Call callback if provided
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  const getTypeLabel = (type: NotificationType): string => {
    switch (type) {
      case 'assignment':
        return 'Assignment';
      case 'service_complete':
        return 'Service Completion';
      case 'status_change':
        return 'Status Change';
      default:
        return 'General';
    }
  };

  return (
    <>
      <div className="relative">
        {/* Notification Bell Button */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="relative p-2 hover:bg-gray-100 transition-colors"
        >
          <FiBell className="w-5 h-5 text-[#555555]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#E74C3C] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {showDropdown && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />

            {/* Dropdown Content */}
            <div
              className="absolute right-0 top-full mt-2 w-80 z-50 overflow-hidden"
              style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}
            >
              {/* Header */}
              <div className="flex justify-between items-center p-4 border-b border-[#E0E0E0]">
                <div>
                  <h3 className="text-[14px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Notifications</h3>
                  <p className="text-[#9E9E9E] text-[11px]">
                    {unreadCount} unread
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllAsRead}
                    className="text-[#056daa] text-[12px] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <FiBell className="w-8 h-8 text-[#9E9E9E] mx-auto mb-2" />
                    <p className="text-[#9E9E9E] text-[13px]">No notifications</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 border-b border-[#E0E0E0] hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-[rgba(5,109,170,0.04)]' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`w-8 h-8 rounded-full ${getNotificationColor(notification.type)} flex items-center justify-center flex-shrink-0`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <p className="text-[#333333] text-[13px] font-medium truncate">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <span className="w-2 h-2 bg-[#056daa] rounded-full flex-shrink-0 ml-2" />
                            )}
                          </div>
                          <p className="text-[#555555] text-[12px] mt-0.5 truncate">
                            {notification.message}
                          </p>
                          {notification.visitorName && (
                            <p className="text-[#056daa] text-[11px] mt-1">
                              Visitor: {notification.visitorName}
                            </p>
                          )}
                          <p className="text-[#9E9E9E] text-[10px] mt-1">
                            {notification.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-[#E0E0E0]" style={{ backgroundColor: NEUTRAL_LIGHT }}>
                <button className="w-full text-center text-[#056daa] text-[12px] hover:underline">
                  View All Notifications
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Notification Detail Modal */}
      {showDetailModal && selectedNotification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="w-[480px] max-h-[90vh] overflow-hidden"
            style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}
          >
            {/* Header */}
            <div className={`p-6 ${
              selectedNotification.type === 'assignment' ? 'bg-[rgba(5,109,170,0.08)]' :
              selectedNotification.type === 'service_complete' ? 'bg-[rgba(76,175,80,0.12)]' :
              selectedNotification.type === 'status_change' ? 'bg-[rgba(243,156,18,0.12)]' :
              'bg-[#F0F0F0]'
            }`}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${getNotificationColor(selectedNotification.type)} flex items-center justify-center`}>
                    {getNotificationIcon(selectedNotification.type)}
                  </div>
                  <div>
                    <h2 className="text-[18px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{selectedNotification.title}</h2>
                    <p className="text-[#555555] text-[12px] mt-0.5">{getTypeLabel(selectedNotification.type)} • {selectedNotification.time}</p>
                  </div>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-[#555555] hover:text-[#333333]">
                  <FiX className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Main Message */}
              <div>
                <label className="uppercase" style={labelStyle}>Message</label>
                <p className="text-[#333333] text-[14px] mt-1">{selectedNotification.message}</p>
              </div>

              {/* Visitor Info */}
              {selectedNotification.visitorName && (
                <div>
                  <label className="uppercase" style={labelStyle}>Visitor</label>
                  <div className="flex items-center gap-2 mt-1">
                    <FiUser className="w-4 h-4 text-[#056daa]" />
                    <p className="text-[#333333] text-[14px] font-medium">{selectedNotification.visitorName}</p>
                  </div>
                </div>
              )}

              {/* Service Type */}
              {selectedNotification.serviceType && (
                <div>
                  <label className="uppercase" style={labelStyle}>Service Type</label>
                  <div className="flex items-center gap-2 mt-1">
                    <FiFileText className="w-4 h-4 text-[#388E3C]" />
                    <p className="text-[#333333] text-[14px]">{selectedNotification.serviceType}</p>
                  </div>
                </div>
              )}

              {/* Department & Room */}
              {(selectedNotification.department || selectedNotification.room) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedNotification.department && (
                    <div>
                      <label className="uppercase" style={labelStyle}>Department</label>
                      <p className="text-[#333333] text-[14px] mt-1">{selectedNotification.department}</p>
                    </div>
                  )}
                  {selectedNotification.room && (
                    <div>
                      <label className="uppercase" style={labelStyle}>Location</label>
                      <p className="text-[#333333] text-[14px] mt-1">{selectedNotification.room}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Details */}
              {selectedNotification.details && (
                <>
                  {selectedNotification.details.assignedTo && (
                    <div>
                      <label className="uppercase" style={labelStyle}>Assigned To</label>
                      <p className="text-[#333333] text-[14px] mt-1">{selectedNotification.details.assignedTo}</p>
                    </div>
                  )}
                  {selectedNotification.details.priority && (
                    <div>
                      <label className="uppercase" style={labelStyle}>Priority</label>
                      <span className={`inline-block mt-1 px-2 py-1 text-[12px] font-medium ${
                        selectedNotification.details.priority === 'High' ? 'bg-[rgba(231,76,60,0.12)] text-[#E74C3C]' :
                        selectedNotification.details.priority === 'Normal' ? 'bg-[rgba(5,109,170,0.08)] text-[#056daa]' :
                        'bg-[#F0F0F0] text-[#555555]'
                      }`}>
                        {selectedNotification.details.priority}
                      </span>
                    </div>
                  )}
                  {selectedNotification.details.notes && (
                    <div>
                      <label className="uppercase" style={labelStyle}>Notes</label>
                      <p className="text-[#555555] text-[13px] mt-1 p-3" style={{ backgroundColor: NEUTRAL_LIGHT }}>
                        {selectedNotification.details.notes}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Timestamp */}
              {selectedNotification.timestamp && (
                <div>
                  <label className="uppercase" style={labelStyle}>Received</label>
                  <p className="text-[#9E9E9E] text-[12px] mt-1">{selectedNotification.timestamp}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E0E0E0] flex gap-3">
              <button
                onClick={() => setShowDetailModal(false)}
                className="flex-1 h-10 uppercase hover:bg-[rgba(5,109,170,0.08)] transition-colors"
                style={{
                  backgroundColor: 'transparent',
                  border: `1px solid ${PRIMARY}`,
                  color: PRIMARY,
                  borderRadius: 0,
                  fontFamily: fontHeading,
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '1px',
                }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setShowDropdown(false);
                }}
                className="flex-1 h-10 uppercase flex items-center justify-center gap-2 transition-colors"
                style={{
                  backgroundColor: PRIMARY,
                  color: WHITE,
                  borderRadius: 0,
                  fontFamily: fontHeading,
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '1px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
              >
                View Details <FiArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationBell;
