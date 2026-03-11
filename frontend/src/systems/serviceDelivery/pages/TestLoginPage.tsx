// TestLoginPage - Simple test login for receptionist dashboard
// This is a temporary test login - can be removed later
// Does NOT affect the existing authentication system

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLock, FiLogIn } from 'react-icons/fi';

const TestLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<'receptionist' | 'head_of_department' | 'employee'>('receptionist');
  const [isLoading, setIsLoading] = useState(false);

  // Mock login handler - just sets localStorage and navigates
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate login delay
    setTimeout(() => {
      // Create user object in the format expected by AuthContext
      // The AuthContext expects userData in localStorage with key 'userData'
      // and token with key 'token' (from authService.js)
      const mockUser = {
        userId: role === 'receptionist' ? 'test-receptionist-001' : 'test-manager-001',
        fullName: role === 'receptionist' ? 'Test Receptionist' : 'Test Department Manager',
        email: `test@${role}.cok.gov.rw`,
        role: role,
        permissions: [
          { resource: 'service_delivery', actions: ['create', 'read', 'update', 'delete'] },
          { resource: 'visitors', actions: ['create', 'read', 'update', 'delete'] },
        ],
        departmentId: 'dept-001',
        departmentName: 'Operations',
      };
      
      const mockToken = 'test-token-' + Date.now();
      
      // Store in the format expected by authService
      localStorage.setItem('userData', JSON.stringify(mockUser));
      localStorage.setItem('accessToken', mockToken);
      localStorage.setItem('refreshToken', 'test-refresh-' + Date.now());
      
      // Navigate based on role
      if (role === 'receptionist') {
        navigate('/test-receptionist');
      } else if (role === 'head_of_department') {
        navigate('/test-dept-manager');
      } else if (role === 'employee') {
        navigate('/test-employee');
      } else {
        navigate('/dashboard');
      }
      
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiUser className="text-white text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-white">COK Systems</h1>
          <p className="text-blue-100 mt-1">Test Login - Service Delivery</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="p-8">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Role (for testing)
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setRole('receptionist')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  role === 'receptionist'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">Receptionist</div>
                <div className="text-xs mt-1">Visitor Check-in</div>
              </button>
              <button
                type="button"
                onClick={() => setRole('head_of_department')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  role === 'head_of_department'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">Dept Manager</div>
                <div className="text-xs mt-1">Manage Visitors</div>
              </button>
              <button
                type="button"
                onClick={() => setRole('employee')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  role === 'employee'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">Employee</div>
                <div className="text-xs mt-1">Serve Visitors</div>
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <div className="relative">
              <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={role === 'receptionist' ? 'receptionist' : role === 'employee' ? 'employee' : 'manager'}
                disabled
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value="test123"
                disabled
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Logging in...
              </>
            ) : (
              <>
                <FiLogIn /> Test Login
              </>
            )}
          </button>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> This is a test login. It does NOT connect to the real backend 
              and will NOT affect the existing authentication system. Use this only for testing 
              the Service Delivery dashboard.
            </p>
          </div>

          <div className="mt-4 text-center">
            <a href="/login" className="text-sm text-blue-600 hover:underline">
              Go to Real Login →
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TestLoginPage;
