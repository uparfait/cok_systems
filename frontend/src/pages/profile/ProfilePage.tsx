// ProfilePage - User profile page
// Page for viewing and editing user profile with real database data

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import MainLayout from '../../core/components/Layout/MainLayout';
import { getUserProfile, updateUserProfile, changePassword } from '../../core/services/authService';
import { employeeService } from '../../core/services/adminService';
import { 
  FiUser, FiMail, FiBriefcase, FiShield, 
  FiMapPin, FiPhone, FiCalendar, FiEdit2,
  FiLogOut, FiSettings, FiLock, FiBell,
  FiClock, FiAward, FiTrendingUp, FiActivity,
  FiCheckCircle, FiAlertCircle, FiInfo, FiX
} from 'react-icons/fi';
import { HiOutlineOfficeBuilding, HiOutlineUserGroup } from 'react-icons/hi';

// Extended user type from database
interface UserProfile {
  _id: string;
  full_name: string;
  email: string;
  telephone?: string;
  picture?: string;
  gender?: string;
  title?: string;
  department?: {
    _id: string;
    department_name: string;
    department_id: string;
  };
  roles?: {
    role_name: string;
    permissions: Array<{
      resource_name: string;
      actions: Array<{
        action_type: string;
        description: string;
        is_enabled: string;
      }>;
    }>;
  };
  is_active: boolean;
  created_date: string;
  is_account_activated: boolean;
}

interface ProfileFormData {
  full_name: string;
  email: string;
  telephone: string;
  picture: string;
  gender: string;
  title: string;
}

interface ActivityItem {
  id: number;
  type: 'login' | 'action' | 'update' | 'security';
  description: string;
  timestamp: string;
  icon: React.ReactNode;
}

const ProfilePage: React.FC = () => {
  const { user, logout, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'activity' | 'security'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Profile data from database
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<ProfileFormData>({
    full_name: '',
    email: '',
    telephone: '',
    picture: '',
    gender: '',
    title: ''
  });

  // Settings state - managed by admins
  const [settings] = useState({
    emailNotifications: true,
    pushNotifications: true
  });

  // Generate realistic activity data from user profile
  const getActivityData = useCallback((): ActivityItem[] => {
    const activities: ActivityItem[] = [];
    const now = new Date();
    
    // Role display helper (inline to avoid hoisting issues)
    const roleNames: { [key: string]: string } = {
      'system_admin': 'System Administrator',
      'department_admin': 'Department Admin',
      'department_leader': 'Department Leader',
      'department_employee': 'Employee',
      'security_guard': 'Security Guard',
      'visitor': 'Visitor'
    };
    const getRoleDisplay = (role?: string) => {
      if (!role) return 'N/A';
      return roleNames[role] || role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };
    
    // Account activation activity
    if (profileData?.is_account_activated) {
      activities.push({
        id: 1,
        type: 'security' as const,
        description: 'Account activated successfully',
        timestamp: profileData.created_date || now.toISOString(),
        icon: <FiCheckCircle className="w-4 h-4" />
      });
    }
    
    // Role assignment activity
    if (profileData?.roles?.role_name) {
      const roleDisplay = getRoleDisplay(profileData.roles.role_name);
      activities.push({
        id: 2,
        type: 'security' as const,
        description: `Assigned role: ${roleDisplay}`,
        timestamp: profileData.created_date || now.toISOString(),
        icon: <FiShield className="w-4 h-4" />
      });
    }
    
    // Department assignment
    if (profileData?.department?.department_name) {
      activities.push({
        id: 3,
        type: 'update' as const,
        description: `Joined department: ${profileData.department.department_name}`,
        timestamp: profileData.created_date || now.toISOString(),
        icon: <FiBriefcase className="w-4 h-4" />
      });
    }
    
    // Profile title
    if (profileData?.title) {
      activities.push({
        id: 4,
        type: 'update' as const,
        description: `Profile title set to: ${profileData.title}`,
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        icon: <FiEdit2 className="w-4 h-4" />
      });
    }
    
    // Add a recent login activity (simulated)
    activities.push({
      id: 5,
      type: 'login' as const,
      description: 'Logged into the system',
      timestamp: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      icon: <FiClock className="w-4 h-4" />
    });
    
    return activities.slice(0, 5);
  }, [profileData]);

  // Use memoized activity data
  const activities = useMemo(() => getActivityData(), [getActivityData]);

  // Fetch user profile from database
  const fetchProfile = useCallback(async () => {
    if (!user?.userId) return;
    
    setIsLoading(true);
    setError(null);
    
    // Try employeeService first (same endpoint structure used elsewhere in the app)
    try {
      console.log(`[ProfilePage] Fetching profile for user: ${user.userId}`);
      
      // Use employeeService.getById which uses the same endpoint
      const response = await employeeService.getById(user.userId);
      
      // Check for success - handle both response formats
      if ((response.success || response.status) && response.data) {
        setProfileData(response.data);
        // Initialize form with database data
        setFormData({
          full_name: response.data.full_name || '',
          email: response.data.email || '',
          telephone: response.data.telephone || '',
          picture: response.data.picture || '',
          gender: response.data.gender || '',
          title: response.data.title || ''
        });
        setIsLoading(false);
        return; // Success, exit function
      } else {
        console.warn('Failed to fetch profile:', response.message);
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      
      // If 404, the user might not exist in employee collection - don't retry
      if (err?.response?.status === 404 || err?.status === 404) {
        console.warn('Employee not found in database');
      }
    }
    
    // Use fallback data from auth context
    console.warn('Using fallback data from auth context');
    setFormData({
      full_name: user.fullName || '',
      email: user.email || '',
      telephone: '',
      picture: user.picture || '',
      gender: '',
      title: ''
    });
    
    setIsLoading(false);
  }, [user?.userId, user?.fullName, user?.email, user?.picture]);

  // Fetch profile on mount
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.userId) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await updateUserProfile(user.userId, formData);
      
      if (response.success) {
        setIsEditing(false);
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
        // Refresh profile data
        fetchProfile();
        // Update auth context
        checkAuth();
      } else {
        setError(response.message || 'Failed to update profile');
      }
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      setError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingChange = (key: keyof typeof settings, value: boolean | string) => {
    // Settings are managed by administrators - this is informational only
    console.log('Setting change requested:', key, value);
  };

  // Get role display name
  const getRoleDisplayName = (role?: string) => {
    if (!role) return 'N/A';
    const roleNames: { [key: string]: string } = {
      'system_admin': 'System Administrator',
      'department_admin': 'Department Admin',
      'department_leader': 'Department Leader',
      'department_employee': 'Employee',
      'security_guard': 'Security Guard',
      'visitor': 'Visitor'
    };
    return roleNames[role] || role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  // Get role badge color
  const getRoleBadgeColor = (role?: string) => {
    if (!role) return 'bg-gray-100 text-gray-700';
    const colors: { [key: string]: string } = {
      'system_admin': 'bg-purple-100 text-purple-700',
      'department_admin': 'bg-blue-100 text-blue-700',
      'department_leader': 'bg-green-100 text-green-700',
      'department_employee': 'bg-orange-100 text-orange-700',
      'security_guard': 'bg-red-100 text-red-700',
      'visitor': 'bg-gray-100 text-gray-700'
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  // Get user role from profile data
  const getUserRole = () => {
    if (profileData?.roles?.role_name) {
      return profileData.roles.role_name;
    }
    return user?.role || '';
  };

  // Get initials for avatar
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    return `${days} days ago`;
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Handle password change
  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New password and confirm password do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (passwordData.newPassword === passwordData.currentPassword) {
      setError('New password must be different from current password');
      return;
    }

    setIsChangingPassword(true);
    setError(null);

    try {
      await changePassword(passwordData);
      setShowPasswordModal(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Get activity icon color
  const getActivityColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'login': 'bg-blue-100 text-blue-600',
      'action': 'bg-green-100 text-green-600',
      'update': 'bg-purple-100 text-purple-600',
      'security': 'bg-orange-100 text-orange-600'
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Use profile data or fallback to auth user
  const displayName = profileData?.full_name || user.fullName || 'User';
  const displayEmail = profileData?.email || user.email || '';
  const displayPicture = profileData?.picture || user.picture || '';
  const departmentName = profileData?.department?.department_name || user.departmentName || '';
  const role = getUserRole();

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-5xl mx-auto">
        {/* Success Message */}
        {showSuccessMessage && (
          <div className="fixed top-4 right-4 z-50 animate-fade-in">
            <div className="flex items-center gap-2 px-6 py-3 bg-green-50 border border-green-200 rounded-lg shadow-lg">
              <FiCheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-700 font-medium">Profile updated successfully!</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="fixed top-4 right-4 z-50 animate-fade-in">
            <div className="flex items-center gap-2 px-6 py-3 bg-red-50 border border-red-200 rounded-lg shadow-lg">
              <FiAlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-700 font-medium">{error}</span>
              <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
                <FiX className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-sm mb-6 p-6">
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
          
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar */}
            <div className="relative group">
              {displayPicture ? (
                <img 
                  src={displayPicture} 
                  alt={displayName}
                  className="w-32 h-32 rounded-full object-cover border-4 border-blue-100 shadow-md"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-3xl font-bold border-4 border-blue-100 shadow-md">
                  {getInitials(displayName)}
                </div>
              )}
              <button 
                onClick={() => setIsEditing(true)}
                className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-all opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0"
              >
                <FiEdit2 className="w-4 h-4" />
              </button>
              {profileData?.is_active && (
                <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-500 border-2 border-white rounded-full"></div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                  profileData?.is_account_activated ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${profileData?.is_account_activated ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  {profileData?.is_account_activated ? 'Activated' : 'Not Activated'}
                </span>
              </div>
              <p className="text-gray-500 mt-1">{displayEmail}</p>
              {/* Last Login & Account Info */}
              <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(role)}`}>
                  {getRoleDisplayName(role)}
                </span>
                {departmentName && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                    <HiOutlineOfficeBuilding className="w-4 h-4" />
                    {departmentName}
                  </span>
                )}
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-900">{profileData?.is_account_activated ? 'Activated' : 'Not Activated'}</p>
                  <p className="text-xs text-gray-500">Account Status</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-900">{profileData?.title || formData.title || 'N/A'}</p>
                  <p className="text-xs text-gray-500">Title</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FiEdit2 className="w-4 h-4" />
                Edit Profile
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                <FiLogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Edit Profile Modal */}
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Edit Profile</h2>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <span className="text-2xl">&times;</span>
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Email - Disabled */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed focus:outline-none"
                    />
                  </div>

                  {/* Telephone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={formData.telephone}
                      onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Picture URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture URL</label>
                    <input
                      type="url"
                      value={formData.picture}
                      onChange={(e) => setFormData(prev => ({ ...prev, picture: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving || !formData.full_name || !formData.email}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex overflow-x-auto">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'profile'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FiUser className="w-5 h-5" />
                Profile
              </button>
    
              <button
                onClick={() => setActiveTab('security')}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'security'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FiShield className="w-5 h-5" />
                Security
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                  >
                    <FiEdit2 className="w-4 h-4" />
                    Edit
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Full Name */}
                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <FiUser className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Full Name</p>
                      <p className="font-medium text-gray-900">{displayName}</p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <FiMail className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email Address</p>
                      <p className="font-medium text-gray-900">{displayEmail || 'Not set'}</p>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <FiPhone className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Phone Number</p>
                      <p className="font-medium text-gray-900">{formData.telephone || 'Not set'}</p>
                    </div>
                  </div>

                  {/* Department */}
                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="p-3 bg-teal-100 rounded-lg">
                      <HiOutlineOfficeBuilding className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Department</p>
                      <p className="font-medium text-gray-900">{departmentName || 'Not assigned'}</p>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <FiShield className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Role</p>
                      <p className="font-medium text-gray-900">{getRoleDisplayName(role)}</p>
                    </div>
                  </div>

                  {/* Job Title */}
                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="p-3 bg-indigo-100 rounded-lg">
                      <FiBriefcase className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Job Title</p>
                      <p className="font-medium text-gray-900">{profileData?.title || formData.title || 'Not set'}</p>
                    </div>
                  </div>

                  {/* Gender */}
                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="p-3 bg-pink-100 rounded-lg">
                      <FiUser className="w-5 h-5 text-pink-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Gender</p>
                      <p className="font-medium text-gray-900">{formData.gender ? formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1) : 'Not set'}</p>
                    </div>
                  </div>

                  {/* Account Status */}
                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="p-3 bg-cyan-100 rounded-lg">
                      <FiCheckCircle className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Account Status</p>
                      <p className="font-medium text-gray-900">{profileData?.is_account_activated ? 'Activated' : 'Not Activated'}</p>
                    </div>
                  </div>

                  {/* Join Date */}
                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="p-3 bg-amber-100 rounded-lg">
                      <FiCalendar className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Join Date</p>
                      <p className="font-medium text-gray-900">{formatDate(profileData?.created_date)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                  <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    View All
                  </button>
                </div>

                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div 
                      key={activity.id}
                      className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className={`p-3 rounded-lg ${getActivityColor(activity.type)}`}>
                        {activity.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{activity.description}</p>
                        <p className="text-sm text-gray-500 mt-1">{formatTimestamp(activity.timestamp)}</p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        activity.type === 'login' ? 'bg-blue-100 text-blue-700' :
                        activity.type === 'action' ? 'bg-green-100 text-green-700' :
                        activity.type === 'security' ? 'bg-orange-100 text-orange-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Activity Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
                  <div className="text-center p-4 bg-blue-50 rounded-xl">
                    <FiTrendingUp className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{profileData?.is_account_activated ? 'Active' : 'Inactive'}</p>
                    <p className="text-sm text-gray-500">Account Status</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-xl">
                    <FiCalendar className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{profileData?.created_date ? formatDate(profileData.created_date).split(',')[0] : 'N/A'}</p>
                    <p className="text-sm text-gray-500">Member Since</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-xl">
                    <FiActivity className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{activities.length}</p>
                    <p className="text-sm text-gray-500">Total Activities</p>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>

                {/* Security Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <FiCheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Password</p>
                        <p className="text-sm text-green-600">
                          {profileData?.is_account_activated ? 'Active' : 'Pending'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <FiShield className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Account</p>
                        <p className="text-sm text-blue-600">
                          {profileData?.is_account_activated ? 'Verified' : 'Not Verified'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <FiClock className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Role</p>
                        <p className="text-sm text-purple-600">{getRoleDisplayName(role)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Change Password */}
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-red-100 rounded-lg">
                        <FiLock className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Change Password</p>
                        <p className="text-sm text-gray-500">Update your account password</p>
                      </div>
                    </div>
                     <button
                       onClick={() => setShowPasswordModal(true)}
                       className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                     >
                       Change Password
                     </button>
                  </div>

                  {/* Account Status */}
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${profileData?.is_account_activated ? 'bg-green-100' : 'bg-orange-100'}`}>
                        <FiShield className={`w-5 h-5 ${profileData?.is_account_activated ? 'text-green-600' : 'text-orange-600'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Account Status</p>
                        <p className="text-sm text-gray-500">
                          {profileData?.is_account_activated 
                            ? 'Your account is activated and verified' 
                            : 'Your account is pending activation'}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      profileData?.is_account_activated 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {profileData?.is_account_activated ? 'Activated' : 'Pending'}
                    </span>
                  </div>

                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>COK Systems • Profile Last Updated: {formatDate(profileData?.created_date)}</p>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Change Password</h2>
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password *
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your current password"
                    required
                  />
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password *
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter new password (min 8 characters)"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Password must contain at least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special character.
                  </p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password *
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm new password"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setError(null);
                  }}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isChangingPassword ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Changing...
                    </>
                  ) : (
                    'Change Password'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
    </MainLayout>
  );
};

export default ProfilePage;
