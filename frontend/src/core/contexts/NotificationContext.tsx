// NotificationContext - Global notification state management
// Components can subscribe to receive real-time notifications via socket.
//
// Targeting rule (see src/core/constants/events.socket.json):
// - A payload with a `to` array is shown ONLY when the authenticated user id
//   is inside that array.
// - A payload without `to` is a broadcast and is shown to everyone.

import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import socketEventsRegistry from '../constants/events.socket.json';

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  timestamp: Date;
  read: boolean;
  event?: string;
  data?: Record<string, any> | null;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  isSocketConnected: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 15);

// A payload with a `to` array is only for the users listed in it.
// A payload without `to` is a broadcast for everyone.
export const isNotificationForUser = (payload: any, userId?: string | null): boolean => {
  const to = payload?.to;
  if (!Array.isArray(to) || to.length === 0) return true;
  if (!userId) return false;
  return to.map(String).includes(String(userId));
};

const VALID_TYPES = ['info', 'success', 'warning', 'error'];

const prettyEventTitle = (event: string) =>
  event
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

// Every event flagged for the notification panel in the shared registry
const PANEL_EVENTS: string[] = Object.entries((socketEventsRegistry as any).events || {})
  .filter(([, meta]: [string, any]) => meta.shown_in_notification_panel)
  .map(([name]) => name);

// Events that pages also react to through window CustomEvents (toasters, refreshes)
const CUSTOM_EVENT_BRIDGE: Record<string, string> = {
  car_checkedin: 'car:checkin',
  car_checkedout: 'car:checkout',
  visitor_checkedin: 'visitor:checkin',
  visitor_checkedout: 'visitor:checkout',
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket, isConnected: isSocketConnected } = useSocket();
  const { user } = useAuth();
  const userId = user?.userId || null;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Add notification to state
  const addNotification = useCallback((notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: AppNotification = {
      ...notification,
      id: generateId(),
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Handle incoming socket notifications for every registered panel event
  useEffect(() => {
    if (!socket) return;

    const handlers: Record<string, (data: any) => void> = {};

    PANEL_EVENTS.forEach((eventName) => {
      const handler = (data: any) => {
        // Pages listen for these window events to refresh data and show toasts,
        // so the bridge fires for everyone, before the targeting filter.
        const bridged = CUSTOM_EVENT_BRIDGE[eventName];
        if (bridged) {
          window.dispatchEvent(new CustomEvent(bridged, { detail: data }));
        }

        if (!isNotificationForUser(data, userId)) return;
        if (data && data.show_notif === false) return;

        const type = VALID_TYPES.includes(data?.type) ? data.type : 'info';
        addNotification({
          type,
          title: data?.title || prettyEventTitle(eventName),
          message: data?.message || 'You have a new notification',
          event: eventName,
          data: data?.data || null,
        });
      };
      handlers[eventName] = handler;
      socket.on(eventName, handler);
    });

    // Cleanup listeners
    return () => {
      Object.entries(handlers).forEach(([eventName, handler]) => {
        socket.off(eventName, handler);
      });
    };
  }, [socket, userId, addNotification]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    isSocketConnected,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook to use notification context
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
