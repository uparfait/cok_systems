// SystemSelector - System selection dashboard
// Page for selecting available systems based on user role and department

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import LoadingSpinner from '../../core/components/LoadingSpinner';
import { getUserSystems, getUserDepartment, hasDedicatedDashboard } from '../../core/components/Layout/layoutUtils';
import { 
  FiHome, FiGrid, FiTruck, FiUsers, FiSettings, FiMessageSquare, 
  FiBarChart2, FiMapPin, FiArrowRight, FiCheckCircle
} from 'react-icons/fi';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';

// Icon mapping
const getIcon = (iconName: string) => {
  const icons: { [key: string]: React.ComponentType<any> } = {
    FiHome,
    FiGrid,
    FiTruck,
    FiUsers,
    FiSettings,
    FiMessageSquare,
    FiBarChart: FiBarChart2,
    FiMapPin,
    FiClipboard: FiGrid,
    FiBarChart2,
    HiOutlineOfficeBuilding,
  };
  return icons[iconName] || FiGrid;
};

// System card component
interface SystemCardProps {
  id: string;
  name: string;
  description: string;
  icon: string;
  path: string;
  onSelect: (id: string, path: string) => void;
  color: string;
}

const SystemCard: React.FC<SystemCardProps> = ({ id, name, description, icon, path, onSelect, color }) => {
  const Icon = getIcon(icon);
  
  const colorClasses: { [key: string]: { bg: string; text: string; border: string } } = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
    red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' },
  };
  
  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <button
      onClick={() => onSelect(id, path)}
      className={`w-full text-left p-6 rounded-2xl border-2 ${colors.border} bg-white hover:shadow-lg hover:border-blue-300 transition-all duration-300 group`}
    >
      <div className="flex items-start justify-between">
        <div className={`w-14 h-14 ${colors.bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
          <Icon className={`w-7 h-7 ${colors.text}`} />
        </div>
        <FiArrowRight className={`w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all`} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{name}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </button>
  );
};

const SystemSelector: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Get user's available systems
  const userSystems = getUserSystems(user);
  const userDepartment = getUserDepartment(user);
  const hasDedicated = hasDedicatedDashboard(user);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Handle system selection
  const handleSystemSelect = (systemId: string, path: string) => {
    navigate(path);
  };

  // Get system descriptions
  const getSystemDescription = (systemId: string): string => {
    const descriptions: { [key: string]: string } = {
      dashboard: 'Overview of all systems and activities',
      parking: 'Manage parking spaces and vehicle tracking',
      service: 'Handle visitor check-in/check-out and service delivery',
      employees: 'Manage employee records and information',
      departments: 'Configure and manage departments',
      feedback: 'View and manage user feedback',
      reports: 'Generate and view analytics reports',
      settings: 'Configure system settings and preferences',
    };
    return descriptions[systemId] || 'System module';
  };

  // Get color for each system
  const getSystemColor = (index: number): string => {
    const colors = ['blue', 'green', 'purple', 'orange', 'red', 'indigo', 'blue', 'green'];
    return colors[index % colors.length];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner 
          message="Loading systems..."
          longLoadingMessage="This is taking longer than usual. Please check your connection."
          longLoadingDelay={3000}
        />
      </div>
    );
  }

  const displayName = user?.fullName || 'User';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Banner */}
      <div className="bg-white border-b border-gray-200 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">COK</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">COK Systems</h1>
              <p className="text-gray-500">Welcome back, {displayName}</p>
            </div>
          </div>
          
          {/* User Info Badge */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
              <HiOutlineOfficeBuilding className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">{userDepartment || 'General User'}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
              <FiCheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">
                {userSystems.length} System{userSystems.length !== 1 ? 's' : ''} Available
              </span>
            </div>
            {hasDedicated && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg">
                <FiSettings className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Full Access</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Select a System</h2>
          <p className="text-gray-500">Choose which system module you want to access</p>
        </div>

        {/* Systems Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userSystems.map((system, index) => (
            <SystemCard
              key={system.id}
              id={system.id}
              name={system.name}
              description={getSystemDescription(system.id)}
              icon={system.icon}
              path={system.path}
              color={getSystemColor(index)}
              onSelect={handleSystemSelect}
            />
          ))}
        </div>

        {/* Quick Access - Show Dashboard if has dedicated access */}
        {hasDedicated && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Access</h2>
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
                    <FiHome className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Main Dashboard</h3>
                    <p className="text-sm text-gray-500">Access the main admin dashboard with all features</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto px-6 py-6 border-t border-gray-200">
        <p className="text-center text-sm text-gray-500">
          © 2026 COK Systems. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default SystemSelector;
