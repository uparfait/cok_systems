// useNotifications Hook - Notification helper hook
// Provides easy access to NotificationContext methods and state
// This is a wrapper around the NotificationContext for easier consumption in components

import { useContext } from 'react';
import { NotificationContext } from '../contexts/NotificationContext';

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  
  return context;
};

export default useNotifications;
