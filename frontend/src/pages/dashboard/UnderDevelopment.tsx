// UnderDevelopment - Page displayed when user's department doesn't have a dedicated dashboard
// Shows information about upcoming features and allows access to available systems

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import { getUserDepartment, getUserSystems } from '../../core/components/Layout/layoutUtils';
import { 
  FiSettings, FiClock, FiMail, FiArrowLeft, FiGrid,
  FiAlertCircle
} from 'react-icons/fi';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';

interface UnderDevelopmentProps {
  departmentName?: string;
}

const UnderDevelopment: React.FC<UnderDevelopmentProps> = ({ departmentName }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const userDepartment = departmentName || getUserDepartment(user);
  const userSystems = getUserSystems(user);

  // Handle go back to system selector
  const handleGoBack = () => {
    navigate('/dashboard/select');
  };

  // Handle access available systems
  const handleAccessSystem = (path: string) => {
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 border-3 border-gray-300 to-gray-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Main Card */}
        <div className="bg-white   border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-8 py-10 text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiSettings className="w-10 h-10 text-white animate-spin " />
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
              Unknown
            </h1>
            <p className="text-blue-100 text-lg">
              It looks like you don't have any known Role assigned to your account
            </p>
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            {/* Alert */}
            <div className="bg-amber-50 border border-amber-200  p-4 mb-6">
              <div className="flex items-start gap-3">
                <FiAlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">Need immediate access?</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Contact an administrator to assign you a role to access the system.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          © 2026 COK Systems. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default UnderDevelopment;
