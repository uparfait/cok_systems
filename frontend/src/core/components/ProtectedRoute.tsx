import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import ForbiddenResourceScreen from './ForbiddenResourceScreen';
import { evaluateRouteAccess } from '../services/accessControl';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

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
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const access = evaluateRouteAccess(location.pathname, user);
  if (!access.allowed) {
    console.warn('[RBAC] route denied:', location.pathname, access.reason);
    return <ForbiddenResourceScreen />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
