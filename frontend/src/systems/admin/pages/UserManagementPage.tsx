// UserManagementPage - Admin User Account Management
// Page for managing user account lock/unlock functionality

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../core/contexts/AuthContext';
import { userAccountService } from '../../../core/services/adminService';
import type { Employee } from '../../../core/services/adminService';
import ConfirmModal from '../../../core/components/Modals/ConfirmModal';
import MainLayout from '../../../core/components/Layout/MainLayout';
import {  
  FiSearch, FiLock, FiUnlock, FiRefreshCw, FiUsers,
  FiMail, FiPhone, FiCheck, FiX, FiAlertCircle, FiUser,
  FiAlertTriangle
} from 'react-icons/fi';

interface UserWithLock extends Employee {
  access_control?: {
    is_locked?: boolean;
    reason?: string;
    last_login_attempt?: number;
  };
  is_account_activated?: boolean;
}

const UserManagementPage: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();  
  const [users, setUsers] = useState<UserWithLock[]>([]);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setfirstLoad] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<UserWithLock[]>([]);
  
  // Modal state
  const [showLockModal, setShowLockModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithLock | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  // Filter users when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(u => 
        (u.full_name?.toLowerCase().includes(query)) ||
        (u.email?.toLowerCase().includes(query)) ||
        (u.telephone?.toLowerCase().includes(query)) ||
        (u.department_name?.toLowerCase().includes(query))
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await userAccountService.getAllUsers();
      if (response.success) {
        const usersData = response.data || [];
        setUsers(usersData);
        setFilteredUsers(usersData);
      } else {
        setError(response.message || 'Failed to load users');
      }
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
      setfirstLoad(false);
    }
  };

  const handleLockClick = (userItem: UserWithLock) => {
    setSelectedUser(userItem);
    setLockReason('');
    setShowLockModal(true);
  };

  const handleUnlockClick = (userItem: UserWithLock) => {
    setSelectedUser(userItem);
    setShowUnlockModal(true);
  };

  const handleLockAccount = async () => {
    if (!selectedUser?._id) return;
    
    setActionLoading(true);
    
    try {
      const response = await userAccountService.lockUnlock(
        selectedUser._id, 
        'lock', 
        lockReason || 'Account locked by administrator'
      );
      
      if (response.success) {
        // Let the interceptor handle the toast (it shows response.data.message)
        // Update the user in the list
        setUsers(prev => prev.map(u => 
          u._id === selectedUser._id 
            ? { ...u, access_control: { is_locked: true, reason: lockReason || 'Account locked by administrator' } }
            : u
        ));
        setShowLockModal(false);
        setSelectedUser(null);
      } else {
        // Error toast is already shown by apiClient interceptor
      }
    } catch (err: any) {
      // Error toast is already shown by apiClient interceptor
      console.error('Error locking account:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlockAccount = async () => {
    if (!selectedUser?._id) return;
    
    setActionLoading(true);
    
    try {
      const response = await userAccountService.lockUnlock(selectedUser._id, 'unlock');
      
      if (response.success) {
        // Let the interceptor handle the toast (it shows response.data.message)
        // Update the user in the list
        setUsers(prev => prev.map(u => 
          u._id === selectedUser._id 
            ? { ...u, access_control: { is_locked: false, reason: undefined } }
            : u
        ));
        setShowUnlockModal(false);
        setSelectedUser(null);
      } else {
        // Error toast is already shown by apiClient interceptor
      }
    } catch (err: any) {
      // Error toast is already shown by apiClient interceptor
      console.error('Error unlocking account:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetAttempts = async (userItem: UserWithLock) => {
    if (!userItem._id) return;
    
    try {
      const response = await userAccountService.resetLoginAttempts(userItem._id);
      
      if (response.success) {
        // Toast is handled by interceptor (backend returns message)
        // Update the user in the list
        setUsers(prev => prev.map(u => 
          u._id === userItem._id 
            ? { ...u, access_control: { ...u.access_control, last_login_attempt: 0 } }
            : u
        ));
      } else {
        // Error toast is already shown by apiClient interceptor
      }
    } catch (err: any) {
      // Error toast is already shown by apiClient interceptor
      console.error('Error resetting login attempts:', err);
    }
  };

  return (
    <MainLayout>
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FiUsers className="w-7 h-7" />
          User Account Management
        </h1>
        <p className="text-gray-600 mt-1">
          Manage user account lock/unlock status
        </p>
      </div>

      {/* Search and Actions Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, phone, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={loadUsers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error State */}
      {error && !loading && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <FiAlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Activation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Lock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(loading && firstLoad) ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="text-gray-500">Loading users...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    {searchQuery ? 'No users found matching your search' : 'No users available'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((userItem) => (
                  <tr key={userItem._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <FiUser className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {userItem.full_name || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <FiMail className="w-3 h-3" />
                            {userItem.email || 'N/A'}
                          </div>
                          {userItem.telephone && (
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <FiPhone className="w-3 h-3" />
                              {userItem.telephone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {userItem.department_name || 
                         (typeof userItem.department === 'object' ? userItem.department?.department_name : 'N/A')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {userItem.is_account_activated ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <FiCheck className="w-3 h-3 mr-1" />
                          Activated
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <FiX className="w-3 h-3 mr-1" />
                          Not Activated
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {userItem.access_control?.is_locked ? (
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <FiLock className="w-3 h-3 mr-1" />
                            Locked
                          </span>
                          {userItem.access_control?.reason && (
                            <p className="text-xs text-gray-500 mt-1 max-w-48 truncate" title={userItem.access_control.reason}>
                              {userItem.access_control.reason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <FiUnlock className="w-3 h-3 mr-1" />
                          Unlocked
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        {userItem.access_control?.is_locked ? (
                          <button
                            onClick={() => handleUnlockClick(userItem)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium"
                            title="Unlock account"
                          >
                            <FiUnlock className="w-3 h-3" />
                            Unlock
                          </button>
                        ) : (
                          <button
                            onClick={() => handleLockClick(userItem)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium"
                            title="Lock account"
                          >
                            <FiLock className="w-3 h-3" />
                            Lock
                          </button>
                        )}
                        {userItem.access_control?.last_login_attempt && userItem.access_control.last_login_attempt > 0 && (
                          <button
                            onClick={() => handleResetAttempts(userItem)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs font-medium"
                            title="Reset login attempts"
                          >
                            <FiRefreshCw className="w-3 h-3" />
                            Reset
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 text-sm text-gray-500">
        Showing {filteredUsers.length} of {users.length} users
      </div>

      {/* Lock Account Modal with Reason Input */}
      {showLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowLockModal(false);
              setSelectedUser(null);
              setLockReason('');
            }}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 transform animate-scaleIn">
            {/* Header with Close Button */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FiLock className="w-5 h-5 text-red-600" />
                Lock User Account
              </h3>
              <button
                onClick={() => {
                  setShowLockModal(false);
                  setSelectedUser(null);
                  setLockReason('');
                }}
                disabled={actionLoading}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Close"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {/* Icon */}
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <FiAlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              
              {/* Message */}
              <div className="text-center mb-4">
                <p className="text-gray-600">
                  Are you sure you want to lock the account for <span className="font-semibold text-gray-900">{selectedUser?.full_name || selectedUser?.email}</span>?
                </p>
              </div>

              {/* Reason Input */}
              <div className="mb-6">
                <label htmlFor="lockReason" className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for locking <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="lockReason"
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  placeholder="Enter reason for locking this account..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  disabled={actionLoading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This reason will be visible to the user when they try to log in.
                </p>
              </div>
              
              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowLockModal(false);
                    setSelectedUser(null);
                    setLockReason('');
                  }}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <FiX className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleLockAccount}
                  disabled={actionLoading || !lockReason.trim()}
                  className={`flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50`}
                >
                  {actionLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Locking...
                    </>
                  ) : (
                    <>
                      <FiLock className="w-4 h-4" />
                      Lock Account
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Account Modal */}
      <ConfirmModal
        isOpen={showUnlockModal}
        onCancel={() => {
          setShowUnlockModal(false);
          setSelectedUser(null);
        }}
        onConfirm={handleUnlockAccount}
        title="Unlock User Account"
        message={`Are you sure you want to unlock the account for ${selectedUser?.full_name || selectedUser?.email}?`}
        confirmText={actionLoading ? 'Unlocking...' : 'Unlock Account'}
        cancelText="Cancel"
        type="info"
        isLoading={actionLoading}
      />
    </div>
    </MainLayout>
  );
};

export default UserManagementPage;