// DashboardPage - Main dashboard after successful login
// Displays user info, permissions, and role-based content

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import { useSocket } from '../../core/contexts/SocketContext';

const DashboardPage: React.FC = () => {
  const { user, permissions, isAuthenticated, isLoading, logout, hasPermission, hasRole } = useAuth();
  const { isConnected, socket } = useSocket();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'permissions'>('profile');

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Demo socket event listener
  useEffect(() => {
    if (socket && isConnected) {
      // Example: Listen for test events
      socket.on('test-event', (data) => {
        console.log('Test event received:', data);
      });

      return () => {
        socket.off('test-event');
      };
    }
  }, [socket, isConnected]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Get role display name
  const getRoleDisplayName = (role: string) => {
    const roleNames: { [key: string]: string } = {
      'system_admin': 'System Administrator',
      'receptionist': 'Receptionist',
      'head_of_department': 'Head of Department',
      'department_employee': 'Department Employee',
      'vehicle_registrar': 'Vehicle Registrar',
      'entrance_officer': 'Entrance Officer'
    };
    return roleNames[role] || role;
  };

  // Get permission display name
  const getPermissionDisplayName = (resource: string, action: string) => {
    return `${action} ${resource}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">COK Systems Dashboard</h1>
              {/* Connection Status */}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {isConnected ? '● Connected' : '● Disconnected'}
              </span>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-start gap-6">
            {/* User Avatar */}
            <div className="flex-shrink-0">
              <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-3xl font-bold text-blue-600">
                  {user.fullName?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            </div>

            {/* User Details */}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{user.fullName}</h2>
              <p className="text-gray-600">{user.email}</p>
              
              <div className="mt-4 flex flex-wrap gap-4">
                {/* Role Badge */}
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                  {getRoleDisplayName(user.role)}
                </div>

                {/* Department */}
                {user.departmentName && (
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-medium">
                    {user.departmentName}
                  </div>
                )}

                {/* User ID */}
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-medium">
                  ID: {user.userId}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'profile'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Profile Details
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'permissions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Permissions ({permissions.length})
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Profile Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500">Full Name</label>
                <p className="mt-1 text-gray-900">{user.fullName || 'Not provided'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Email Address</label>
                <p className="mt-1 text-gray-900">{user.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Role</label>
                <p className="mt-1 text-gray-900">{getRoleDisplayName(user.role)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Department</label>
                <p className="mt-1 text-gray-900">{user.departmentName || 'Not assigned'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Department ID</label>
                <p className="mt-1 text-gray-900">{user.departmentId || 'Not assigned'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">User ID</label>
                <p className="mt-1 text-gray-900 text-sm">{user.userId}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'permissions' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Permissions</h3>
            {permissions.length === 0 ? (
              <p className="text-gray-500">No permissions assigned</p>
            ) : (
              <div className="space-y-4">
                {permissions.map((permission, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 capitalize">{permission.resource}</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {permission.actions.map((action, actionIndex) => (
                        <span
                          key={actionIndex}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                        >
                          {action}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {hasRole('system_admin') && (
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="font-medium text-gray-900">System Settings</div>
                <div className="text-sm text-gray-500">Manage system configuration</div>
              </button>
            )}
            {(hasRole('receptionist') || hasRole('system_admin')) && (
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="font-medium text-gray-900">Service Delivery</div>
                <div className="text-sm text-gray-500">Manage visitor check-ins</div>
              </button>
            )}
            {(hasRole('vehicle_registrar') || hasRole('entrance_officer') || hasRole('system_admin')) && (
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="font-medium text-gray-900">Smart Parking</div>
                <div className="text-sm text-gray-500">Manage parking records</div>
              </button>
            )}
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <div className="font-medium text-gray-900">My Profile</div>
              <div className="text-sm text-gray-500">View and edit profile</div>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
