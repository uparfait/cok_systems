// ServiceDeliveryDashboard - Service Delivery System Dashboard
// Dashboard for visitor management

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { 
  FiUsers, FiSearch, FiRefreshCw, FiClock, FiCheckCircle,
  FiUserPlus, FiLogOut
} from 'react-icons/fi';
import { HiOutlineClipboardList } from 'react-icons/hi';

interface Visitor {
  _id?: string;
  name?: string;
  visitorName?: string;
  phone?: string;
  department?: string;
  departmentName?: string;
  purpose?: string;
  status?: string;
  checkInTime?: string;
  checkIn?: string;
  checkOutTime?: string;
  checkOut?: string;
}

const ServiceDeliveryDashboard: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

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
      const response = await serviceDeliveryService.getAllVisitors();
      if (response.status) {
        setVisitors(response.data || []);
      } else {
        // Use backend message with priority
        setError(response.message || response.error || 'Failed to load visitor data');
      }
    } catch (err: any) {
      // Use backend message with priority
      setError(err?.message || err?.error || 'Failed to load visitor data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }
    
    setLoading(true);
    try {
      const response = await serviceDeliveryService.searchVisitors(searchQuery);
      if (response.status) {
        setVisitors(response.data || []);
      }
    } catch (err: any) {
      // Use backend message with priority
      setError(err?.message || err?.error || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const totalVisitors = visitors.length;
  const checkedIn = visitors.filter(v => v.status === 'Inside').length;
  const checkedOut = visitors.filter(v => v.status === 'Left').length;

  const statCards = [
    { label: 'Total Visitors', value: totalVisitors, icon: FiUsers, color: 'blue' },
    { label: 'Currently Inside', value: checkedIn, icon: FiClock, color: 'green' },
    { label: 'Checked Out', value: checkedOut, icon: FiCheckCircle, color: 'purple' },
  ];

  const colorClasses: { [key: string]: { bg: string; text: string } } = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading visitor data...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <HiOutlineClipboardList className="w-8 h-8 text-green-600" />
            Service Delivery
          </h1>
          <p className="text-gray-500 mt-1">Manage visitors and service delivery</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium disabled:opacity-50"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
            <FiUserPlus className="w-4 h-4" />
            New Visitor
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
          >
            Search
          </button>
        </div>
      </div>

      {/* Visitors Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Visitor Records</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Purpose</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Check In</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {visitors.slice(0, 10).map((visitor, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <FiUsers className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-900">{visitor.name || visitor.visitorName || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{visitor.phone || 'N/A'}</td>
                  <td className="px-6 py-4 text-gray-600">{visitor.departmentName || visitor.department || 'N/A'}</td>
                  <td className="px-6 py-4 text-gray-500">{visitor.purpose || '-'}</td>
                  <td className="px-6 py-4 text-gray-500">{visitor.checkInTime || visitor.checkIn || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                      visitor.status === 'Inside' 
                        ? 'bg-blue-100 text-blue-700' 
                        : visitor.status === 'Left'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {visitor.status || 'Waiting'}
                    </span>
                  </td>
                </tr>
              ))}
              {visitors.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No visitors found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </MainLayout>
  );
};

export default ServiceDeliveryDashboard;
