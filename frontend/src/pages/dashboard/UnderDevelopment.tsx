// UnderDevelopment - Page displayed when user's department doesn't have a dedicated dashboard
// Shows information about upcoming features and allows access to available systems

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import { getUserDepartment, getUserSystems } from '../../core/components/Layout';
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-8 py-10 text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiSettings className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
              Coming Soon
            </h1>
            <p className="text-blue-100 text-lg">
              This feature is under development
            </p>
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            {/* Department Info */}
            <div className="bg-gray-50 rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <HiOutlineOfficeBuilding className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Your Department</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">{userDepartment || 'Unknown'}</h2>
              <p className="text-gray-600 mt-2">
                We're working hard to bring you a personalized dashboard for your department. 
                Our team is currently developing custom features that will meet your specific needs.
              </p>
            </div>

            {/* What's Coming */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FiClock className="w-5 h-5 text-blue-600" />
                What's Coming
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <span className="text-gray-600">Custom dashboard tailored to your department</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <span className="text-gray-600">Department-specific reports and analytics</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <span className="text-gray-600">Custom workflows and processes</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiClock className="w-3 h-3 text-yellow-600" />
                  </div>
                  <span className="text-gray-600">Integration with existing systems</span>
                </li>
              </ul>
            </div>

            {/* Alert */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <FiAlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">Need immediate access?</p>
                  <p className="text-sm text-amber-700 mt-1">
                    You can still access the following available systems while we work on your department's custom dashboard.
                  </p>
                </div>
              </div>
            </div>

            {/* Available Systems */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Systems</h3>
              <div className="grid grid-cols-2 gap-3">
                {userSystems.slice(0, 4).map((system) => (
                  <button
                    key={system.id}
                    onClick={() => handleAccessSystem(system.path)}
                    className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl transition-all text-left"
                  >
                    <FiGrid className="w-5 h-5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{system.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <FiMail className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Have suggestions?</p>
                  <p className="text-sm text-blue-700">
                    Contact us to share your ideas for the department dashboard
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleGoBack}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                <FiArrowLeft className="w-5 h-5" />
                Back to System Selection
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
              >
                <FiGrid className="w-5 h-5" />
                Go to Main Dashboard
              </button>
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
