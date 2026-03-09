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
  FiMail, FiPhone, FiCheck, FiX, FiAlertCircle, FiUser
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<UserWithLock[]>([]);
  
  // Modal state
  const [showLockModal, setShowLockModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithLock | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      const response = await userAccountService.lockUnlock(
        selectedUser._id, 
        'lock', 
        lockReason || 'Account locked by administrator'
      );
      
      if (response.success) {
        setSuccessMessage(`Account for ${selectedUser.full_name || selectedUser.email} has been locked successfully.`);
        // Update the user in the list
        setUsers(prev => prev.map(u => 
          u._id === selectedUser._id 
            ? { ...u, access_control: { is_locked: true, reason: lockReason || 'Account locked by administrator' } }
            : u
        ));
        setShowLockModal(false);
        setSelectedUser(null);
      } else {
        setErrorMessage(response.message || 'Failed to lock account');
      }
    } catch (err: any) {
      console.error('Error locking account:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to lock account');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlockAccount = async () => {
    if (!selectedUser?._id) return;
    
    setActionLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      const response = await userAccountService.lockUnlock(selectedUser._id, 'unlock');
      
      if (response.success) {
        setSuccessMessage(`Account for ${selectedUser.full_name || selectedUser.email} has been unlocked successfully.`);
        // Update the user in the list
        setUsers(prev => prev.map(u => 
          u._id === selectedUser._id 
            ? { ...u, access_control: { is_locked: false, reason: undefined } }
            : u
        ));
        setShowUnlockModal(false);
        setSelectedUser(null);
      } else {
        setErrorMessage(response.message || 'Failed to unlock account');
      }
    } catch (err: any) {
      console.error('Error unlocking account:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to unlock account');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetAttempts = async (userItem: UserWithLock) => {
    if (!userItem._id) return;
    
    try {
      const response = await userAccountService.resetLoginAttempts(userItem._id);
      
      if (response.success) {
        setSuccessMessage(`Login attempts reset for ${userItem.full_name || userItem.email}.`);
        // Update the user in the list
        setUsers(prev => prev.map(u => 
          u._id === userItem._id 
            ? { ...u, access_control: { ...u.access_control, last_login_attempt: 0 } }
            : u
        ));
      } else {
        setErrorMessage(response.message || 'Failed to reset login attempts');
      }
    } catch (err: any) {
      console.error('Error resetting login attempts:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to reset login attempts');
    }
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setErrorMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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

      {/* Messages */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <FiCheck className="w-5 h-5 text-green-600" />
          <span className="text-green-700">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <FiAlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-700">{errorMessage}</span>
        </div>
      )}

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
              {loading ? (
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

      {/* Lock Account Modal */}
      <ConfirmModal
        isOpen={showLockModal}
        onCancel={() => {
          setShowLockModal(false);
          setSelectedUser(null);
          setLockReason('');
        }}
        onConfirm={handleLockAccount}
        title="Lock User Account"
        message={`Are you sure you want to lock the account for ${selectedUser?.full_name || selectedUser?.email}?`}
        confirmText={actionLoading ? 'Locking...' : 'Lock Account'}
        cancelText="Cancel"
        type="danger"
        isLoading={actionLoading}
      />

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
