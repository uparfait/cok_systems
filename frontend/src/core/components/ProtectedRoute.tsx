import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length > 0) {
          // Unregister all found service workers
          const unregisterPromises = registrations.map((registration) =>
            registration.unregister()
          );

          // Reload only after all service workers are removed
          Promise.all(unregisterPromises).then(() => {
            
          });
        }
      });
    }
  }, []); // Empty dependency array ensures this runs once on mount

  // Wait for auth to be ready before making any decisions
  useEffect(() => {
    // Give a small delay to ensure auth state is initialized
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Debug logging
  console.log('[ProtectedRoute] isLoading:', isLoading, 'isAuthenticated:', isAuthenticated, 'isReady:', isReady);

  // Show loading spinner while auth is initializing or not ready
  if (isLoading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner 
          message="Connecting..."
          longLoadingMessage="This is taking longer than usual. Please check your connection."
          longLoadingDelay={3000}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('[ProtectedRoute] Not authenticated, redirecting to home from:', location.pathname);
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  console.log('[ProtectedRoute] User is authenticated, rendering children');
  return <>{children}</>;
};

export default ProtectedRoute;
