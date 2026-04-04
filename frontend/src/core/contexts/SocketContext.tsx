// SocketContext - WebSocket connection management
// Provides real-time communication with the backend using Socket.IO

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

// Socket server URL - use local for development, remote for production
const getSocketUrl = () => {
  // Check for environment variable first
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  
  // Check if running on localhost - connect to local backend
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
  
  if (isLocalhost) {
    // For local development, use the same port as the API
    // The API runs on port 2026 based on backend configuration
    return 'http://localhost:2026';
  }
  
  // For production/remote, use the remote server
  return 'https://cok-bc.onrender.com';
};

const SOCKET_URL = getSocketUrl();

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

  // Refs to track connection state and prevent multiple connections
  const socketRef = useRef<Socket | null>(null);
  const isConnectingRef = useRef(false);
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    // Don't connect if no token
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
      hasConnectedRef.current = false;
      isConnectingRef.current = false;
      return;
    }

    // Already have a valid connection
    if (socketRef.current && hasConnectedRef.current) {
      return;
    }

    // Prevent multiple connection attempts
    if (isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;

    // Create socket connection
    const newSocket = io(SOCKET_URL, {
      auth: {
        token: token || undefined
      },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      autoConnect: true,
    });

    console.log(`[SocketContext] Connecting to: ${SOCKET_URL}`);

    socketRef.current = newSocket;
    hasConnectedRef.current = true;

    // Connection events
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      isConnectingRef.current = false;
      
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
      
      if (reason === 'io server disconnect') {
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.warn('Socket connection error:', error.message);
      isConnectingRef.current = false;
      setIsConnected(false);
    });

    newSocket.on('reconnect_attempt', (attempt) => {
      if (attempt <= 2) {
        console.log('Reconnection attempt:', attempt);
      }
    });

    newSocket.on('reconnect_failed', () => {
      console.log('Reconnection failed after all attempts');
      setIsConnected(false);
      isConnectingRef.current = false;
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      isConnectingRef.current = false;
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
