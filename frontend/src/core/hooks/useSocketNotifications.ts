

import { useEffect, useCallback, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

export interface Notification {
  title?: string;
  sender?: string;
  message: string;
  timestamp?: Date;
}

export interface UseSocketNotificationsReturn {
  notifications: Notification[];
  clearNotifications: () => void;
  isConnected: boolean;
}

/**
 * Custom hook to receive real-time notifications from the socket server
 * 
 * Usage:
 * const { notifications, clearNotifications, isConnected } = useSocketNotifications();
 * 
 * Or with callback:
 * const { isConnected } = useSocketNotifications((notification) => {
 *   console.log('Got notification:', notification);
 * });
 */
export const useSocketNotifications = (
  onNotification?: (notification: Notification) => void
): UseSocketNotificationsReturn => {
  const { socket, isConnected } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Handle incoming notifications
  const handleNotification = useCallback((data: Notification) => {
    const notification: Notification = {
      ...data,
      timestamp: new Date(),
    };

    // Add to notifications array
    setNotifications((prev) => [notification, ...prev]);

    // Call the callback if provided
    if (onNotification) {
      onNotification(notification);
    }
  }, [onNotification]);

  // Handle parking alerts
  const handleParkingAlert = useCallback((data: any) => {
    const notification: Notification = {
      title: 'Parking Alert',
      message: data.message || 'Parking alert received',
    };

    setNotifications((prev) => [notification, ...prev]);

    if (onNotification) {
      onNotification(notification);
    }
  }, [onNotification]);

  // Set up socket listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for general notifications
    socket.on('notifications', handleNotification);

    // Listen for parking alerts
    socket.on('parking_alert', handleParkingAlert);

    // Listen for smart parking updates
    socket.on('smartparking_test', (data: any) => {
      const notification: Notification = {
        title: 'Smart Parking',
        message: data.message || 'Parking update received',
      };
      setNotifications((prev) => [notification, ...prev]);
      if (onNotification) onNotification(notification);
    });

    // Listen for service delivery updates
    socket.on('service_delivery_test', (data: any) => {
      const notification: Notification = {
        title: 'Service Delivery',
        message: data.message || 'Service delivery update received',
      };
      setNotifications((prev) => [notification, ...prev]);
      if (onNotification) onNotification(notification);
    });

    // Cleanup listeners on unmount
    return () => {
      socket.off('notifications', handleNotification);
      socket.off('parking_alert', handleParkingAlert);
      socket.off('smartparking_test');
      socket.off('service_delivery_test');
    };
  }, [socket, handleNotification, handleParkingAlert, onNotification]);

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    clearNotifications,
    isConnected,
  };
};

export default useSocketNotifications;
