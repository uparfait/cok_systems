// NotificationContext - Global notification state management
// Components can subscribe to receive real-time notifications via socket

import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';
import { useSocket } from './SocketContext';

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  timestamp: Date;
  read: boolean;
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

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket, isConnected: isSocketConnected } = useSocket();
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

  // Handle incoming socket notifications
  useEffect(() => {
    if (!socket) return;

    // Listen for general notifications
    socket.on('notifications', (data: any) => {
      addNotification({
        type: 'info',
        title: data.title || 'Notification',
        message: data.message || 'You have a new notification',
      });
    });

    // Listen for parking alerts
    socket.on('parking_alert', (data: any) => {
      addNotification({
        type: 'warning',
        title: data.type === 'OVERSTAY_WARNING' ? 'Parking Warning' : 'Parking Alert',
        message: data.message || 'Parking alert received',
      });
    });

    // Listen for smart parking updates
    socket.on('smartparking_test', (data: any) => {
      addNotification({
        type: 'info',
        title: 'Smart Parking',
        message: data.message || 'Parking update',
      });
    });

    // Listen for car check-in events from backend
    socket.on('car_checkedin', (data: any) => {
      // Dispatch custom event for toaster (pages will handle showing toast on smart parking routes)
      const toastEvent = new CustomEvent('car:checkin', { detail: data });
      window.dispatchEvent(toastEvent);
      
      // If show_notif is true, add to notification list
      if (data.show_notif) {
        addNotification({
          type: data.type || 'info',
          title: 'Car Check-in',
          message: data.message || 'A new car has checked in',
        });
      }
    });

    // Listen for service delivery updates
    socket.on('service_delivery_test', (data: any) => {
      addNotification({
        type: 'info',
        title: 'Service Delivery',
        message: data.message || 'Service delivery update',
      });
    });

    // Cleanup listeners
    return () => {
      socket.off('notifications');
      socket.off('parking_alert');
      socket.off('smartparking_test');
      socket.off('service_delivery_test');
      socket.off('car_checkedin');
    };
  }, [socket, addNotification]);

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
