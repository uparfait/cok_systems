// AdminDashboard - System Administrator Dashboard
// Full control over all systems and staff management

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import { departmentService, employeeService, smartParkingService, serviceDeliveryService } from '../../core/services/adminService';
import { 
  FiUsers, FiGrid, FiTruck, FiMessageSquare, FiSettings, FiRefreshCw,
  FiAlertTriangle, FiCheckCircle, FiClock, FiActivity
} from 'react-icons/fi';
import { HiOutlineOfficeBuilding, HiOutlineChartBar } from 'react-icons/hi';

interface StatCard {
  label: string;
  value: number;
  icon: React.ComponentType<any>;
  color: string;
  trend?: string;
}

const AdminDashboard: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Data states
  const [stats, setStats] = useState<{
    departments: number;
    employees: number;
    parkingRecords: number;
    visitors: number;
  }>({
    departments: 0,
    employees: 0,
    parkingRecords: 0,
    visitors: 0,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, authLoading, navigate]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Fetch all data in parallel
      const [deptRes, empRes, parkingRes, visitorRes] = await Promise.all([
        departmentService.getAll(),
        employeeService.getAll(),
        smartParkingService.getAllVehicles(),
        serviceDeliveryService.getAllVisitors(),
      ]);

      setStats({
        departments: deptRes.data?.length || 0,
        employees: empRes.data?.length || 0,
        parkingRecords: parkingRes.data?.length || 0,
        visitors: visitorRes.data?.length || 0,
      });
    } catch (err: any) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statCards: StatCard[] = [
    { label: 'Departments', value: stats.departments, icon: HiOutlineOfficeBuilding, color: 'blue' },
    { label: 'Employees', value: stats.employees, icon: FiUsers, color: 'green' },
    { label: 'Parking Records', value: stats.parkingRecords, icon: FiTruck, color: 'purple' },
    { label: 'Visitors Today', value: stats.visitors, icon: FiGrid, color: 'orange' },
  ];

  const colorClasses: { [key: string]: { bg: string; text: string } } = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500">System administration and management</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
        >
          <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const colors = colorClasses[stat.color] || colorClasses.blue;
          return (
            <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${colors.text}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/admin/departments')}
          className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <HiOutlineOfficeBuilding className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Manage Departments</h3>
              <p className="text-sm text-gray-500">Add, edit, remove departments</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate('/admin/employees')}
          className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <FiUsers className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Manage Employees</h3>
              <p className="text-sm text-gray-500">Employee records and profiles</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate('/smart_parking/dashboard')}
          className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <FiTruck className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Smart Parking</h3>
              <p className="text-sm text-gray-500">Manage parking system</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate('/service_delivery/dashboard')}
          className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <FiGrid className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Service Delivery</h3>
              <p className="text-sm text-gray-500">Manage visitors</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;
