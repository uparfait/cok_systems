// Notification Component - Real-time notifications across dashboards
import React, { useState } from 'react';
import { FiBell, FiCheck, FiUser, FiClock, FiX, FiFileText, FiAlertCircle, FiArrowRight } from 'react-icons/fi';

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
        return <FiUser className="w-4 h-4 text-[#1a73e8]" />;
      case 'service_complete':
        return <FiCheck className="w-4 h-4 text-[#34a853]" />;
      case 'status_change':
        return <FiClock className="w-4 h-4 text-[#f57c00]" />;
      default:
        return <FiAlertCircle className="w-4 h-4 text-[#666]" />;
    }
  };

  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case 'assignment':
        return 'bg-[#e3f2fd]';
      case 'service_complete':
        return 'bg-[#e8f5e9]';
      case 'status_change':
        return 'bg-[#fff3e0]';
      default:
        return 'bg-gray-100';
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
          className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <FiBell className="w-5 h-5 text-[#555]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#e53935] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
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
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-[12px] shadow-xl border border-gray-100 z-50 overflow-hidden">
              {/* Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-100">
                <div>
                  <h3 className="text-[#1a2744] text-[14px] font-bold">Notifications</h3>
                  <p className="text-[#888] text-[11px]">
                    {unreadCount} unread
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllAsRead}
                    className="text-[#1a73e8] text-[12px] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <FiBell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-[#888] text-[13px]">No notifications</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-[#f8faff]' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`w-8 h-8 rounded-full ${getNotificationColor(notification.type)} flex items-center justify-center flex-shrink-0`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <p className="text-[#333] text-[13px] font-medium truncate">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <span className="w-2 h-2 bg-[#1a73e8] rounded-full flex-shrink-0 ml-2" />
                            )}
                          </div>
                          <p className="text-[#666] text-[12px] mt-0.5 truncate">
                            {notification.message}
                          </p>
                          {notification.visitorName && (
                            <p className="text-[#1a73e8] text-[11px] mt-1">
                              Visitor: {notification.visitorName}
                            </p>
                          )}
                          <p className="text-[#999] text-[10px] mt-1">
                            {notification.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-gray-100 bg-gray-50">
                <button className="w-full text-center text-[#1a73e8] text-[12px] hover:underline">
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
          <div className="bg-white rounded-[16px] w-[480px] max-h-[90vh] overflow-hidden shadow-xl">
            {/* Header */}
            <div className={`p-6 ${
              selectedNotification.type === 'assignment' ? 'bg-[#e3f2fd]' :
              selectedNotification.type === 'service_complete' ? 'bg-[#e8f5e9]' :
              selectedNotification.type === 'status_change' ? 'bg-[#fff3e0]' :
              'bg-gray-100'
            }`}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${getNotificationColor(selectedNotification.type)} flex items-center justify-center`}>
                    {getNotificationIcon(selectedNotification.type)}
                  </div>
                  <div>
                    <h2 className="text-[#1a2744] text-[18px] font-bold">{selectedNotification.title}</h2>
                    <p className="text-[#666] text-[12px] mt-0.5">{getTypeLabel(selectedNotification.type)} • {selectedNotification.time}</p>
                  </div>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-[#666] hover:text-[#333]">
                  <FiX className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Main Message */}
              <div>
                <label className="text-[#999] text-[11px] uppercase tracking-wider">Message</label>
                <p className="text-[#333] text-[14px] mt-1">{selectedNotification.message}</p>
              </div>

              {/* Visitor Info */}
              {selectedNotification.visitorName && (
                <div>
                  <label className="text-[#999] text-[11px] uppercase tracking-wider">Visitor</label>
                  <div className="flex items-center gap-2 mt-1">
                    <FiUser className="w-4 h-4 text-[#1a73e8]" />
                    <p className="text-[#1a2744] text-[14px] font-medium">{selectedNotification.visitorName}</p>
                  </div>
                </div>
              )}

              {/* Service Type */}
              {selectedNotification.serviceType && (
                <div>
                  <label className="text-[#999] text-[11px] uppercase tracking-wider">Service Type</label>
                  <div className="flex items-center gap-2 mt-1">
                    <FiFileText className="w-4 h-4 text-[#34a853]" />
                    <p className="text-[#1a2744] text-[14px]">{selectedNotification.serviceType}</p>
                  </div>
                </div>
              )}

              {/* Department & Room */}
              {(selectedNotification.department || selectedNotification.room) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedNotification.department && (
                    <div>
                      <label className="text-[#999] text-[11px] uppercase tracking-wider">Department</label>
                      <p className="text-[#1a2744] text-[14px] mt-1">{selectedNotification.department}</p>
                    </div>
                  )}
                  {selectedNotification.room && (
                    <div>
                      <label className="text-[#999] text-[11px] uppercase tracking-wider">Location</label>
                      <p className="text-[#1a2744] text-[14px] mt-1">{selectedNotification.room}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Details */}
              {selectedNotification.details && (
                <>
                  {selectedNotification.details.assignedTo && (
                    <div>
                      <label className="text-[#999] text-[11px] uppercase tracking-wider">Assigned To</label>
                      <p className="text-[#1a2744] text-[14px] mt-1">{selectedNotification.details.assignedTo}</p>
                    </div>
                  )}
                  {selectedNotification.details.priority && (
                    <div>
                      <label className="text-[#999] text-[11px] uppercase tracking-wider">Priority</label>
                      <span className={`inline-block mt-1 px-2 py-1 rounded text-[12px] font-medium ${
                        selectedNotification.details.priority === 'High' ? 'bg-red-100 text-red-700' :
                        selectedNotification.details.priority === 'Normal' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {selectedNotification.details.priority}
                      </span>
                    </div>
                  )}
                  {selectedNotification.details.notes && (
                    <div>
                      <label className="text-[#999] text-[11px] uppercase tracking-wider">Notes</label>
                      <p className="text-[#666] text-[13px] mt-1 bg-gray-50 p-3 rounded-lg">
                        {selectedNotification.details.notes}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Timestamp */}
              {selectedNotification.timestamp && (
                <div>
                  <label className="text-[#999] text-[11px] uppercase tracking-wider">Received</label>
                  <p className="text-[#999] text-[12px] mt-1">{selectedNotification.timestamp}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowDetailModal(false)}
                className="flex-1 h-10 bg-gray-100 text-[#333] text-[13px] font-medium rounded-[8px] hover:bg-gray-200"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setShowDropdown(false);
                }}
                className="flex-1 h-10 bg-[#1a73e8] text-white text-[13px] font-medium rounded-[8px] hover:bg-[#1558c0] flex items-center justify-center gap-2"
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
