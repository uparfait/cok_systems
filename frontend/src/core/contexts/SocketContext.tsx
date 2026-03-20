// SocketContext - WebSocket connection management
// Provides real-time communication with the backend using Socket.IO

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

// Socket server URL
// Use localhost:2026 for local development, remote for production
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
  (window.location.hostname === 'localhost' ? 'https://cok-bc.onrender.com' : 'https://cok-bc.onrender.com');

// Context type
interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback?: (data: any) => void) => void;
}

// Create context
const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Provider component
export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    console.log('[SocketContext] Token changed:', token ? 'present' : 'null');
    
    if (!token) {
      // Don't connect if no token
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Create socket connection
    const newSocket = io(SOCKET_URL, {
      auth: {
        token: token || undefined
      },
      transports: ['polling', 'websocket'], // Try polling first for better reliability
      transportOptions: {
        polling: {
          extraHeaders: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        }
      },
      reconnection: true,
      reconnectionAttempts: 3, // Reduced from 10 - fewer retries to prevent console spam
      reconnectionDelay: 3000, // Wait 3 seconds between retries
      reconnectionDelayMax: 10000, // Max delay between retries
      timeout: 15000, // Connection timeout
      autoConnect: true,
    });
    
    console.log('[SocketContext] Creating socket with token:', token ? 'yes' : 'no');

    // Track reconnection attempts
    let reconnectAttempts = 0;

    // Connection events
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      reconnectAttempts = 0; // Reset on successful connection
      
      // Verify authentication status with server
      newSocket.emit('get_user_info', {}, (response: any) => {
        if (response && response.authenticated) {
          console.log('Socket authenticated as:', response.user?.email, 'Role:', response.user?.role);
        } else {
          console.log('Socket not authenticated:', response?.message || 'Unknown reason');
        }
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      
      // If server disconnected us, don't auto-reconnect
      if (reason === 'io server disconnect') {
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (error) => {
      // Only log first few errors to avoid console spam
      if (reconnectAttempts < 2) {
        console.warn('[SocketContext] Connection error (attempt ' + (reconnectAttempts + 1) + '):', error.message);
      }
      reconnectAttempts++;
      setIsConnected(false);
      
      // Stop trying after max attempts - silently stop
      if (reconnectAttempts >= 3) {
        console.log('[SocketContext] Max reconnection attempts reached, stopping retry');
        newSocket.disconnect();
        // Don't throw error - just let the app work without real-time updates
      }
    });

    newSocket.on('reconnect_attempt', (attempt) => {
      // Silent - only log in development if needed
      if (attempt <= 2) {
        console.log('[SocketContext] Reconnection attempt:', attempt);
      }
    });

    newSocket.on('reconnect_failed', () => {
      console.log('Reconnection failed after all attempts');
      setIsConnected(false);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  // Emit event to server with optional callback
  const emit = useCallback((event: string, data: any, callback?: (response: any) => void) => {
    if (socket && isConnected) {
      if (callback) {
        socket.emit(event, data, callback);
      } else {
        socket.emit(event, data);
      }
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
      if (callback) {
        callback({ success: false, message: 'Socket not connected' });
      }
    }
  }, [socket, isConnected]);

  // Listen for events from server
  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
  }, [socket]);

  // Remove event listener
  const off = useCallback((event: string, callback?: (data: any) => void) => {
    if (socket) {
      if (callback) {
        socket.off(event, callback);
      } else {
        socket.off(event);
      }
    }
  }, [socket]);

  const value: SocketContextType = {
    socket,
    isConnected,
    emit,
    on,
    off
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

// Custom hook to use socket context
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;
