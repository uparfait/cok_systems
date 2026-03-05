// SmartParkingDashboard - Smart Parking System Dashboard
// Dashboard for parking management

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import { smartParkingService } from '../../core/services/adminService';
import { 
  FiTruck, FiSearch, FiRefreshCw, FiAlertTriangle, FiCheckCircle,
  FiClock, FiMapPin, FiUser
} from 'react-icons/fi';

interface ParkingRecord {
  _id?: string;
  vehicle?: string;
  plateNumber?: string;
  owner?: string;
  ownerName?: string;
  status?: string;
  checkInTime?: string;
  spot?: string;
  flagged?: boolean;
}

const SmartParkingDashboard: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [records, setRecords] = useState<ParkingRecord[]>([]);
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
      const response = await smartParkingService.getAllVehicles();
      if (response.status) {
        setRecords(response.data || []);
      } else {
        setError(response.error || 'Failed to load parking data');
      }
    } catch (err: any) {
      setError('Failed to load parking data');
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
      const response = await smartParkingService.searchVehicles(searchQuery);
      if (response.status) {
        setRecords(response.data || []);
      }
    } catch (err: any) {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const totalVehicles = records.length;
  const parkedVehicles = records.filter(r => r.status === 'Parked').length;
  const availableSlots = Math.max(0, 250 - totalVehicles);
  const flaggedVehicles = records.filter(r => r.flagged).length;

  const statCards = [
    { label: 'Total Vehicles', value: totalVehicles, icon: FiTruck, color: 'blue' },
    { label: 'Currently Parked', value: parkedVehicles, icon: FiCheckCircle, color: 'green' },
    { label: 'Available Slots', value: availableSlots, icon: FiMapPin, color: 'purple' },
    { label: 'Flagged Vehicles', value: flaggedVehicles, icon: FiAlertTriangle, color: 'red' },
  ];

  const colorClasses: { [key: string]: { bg: string; text: string } } = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    red: { bg: 'bg-red-100', text: 'text-red-600' },
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading parking data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FiTruck className="w-8 h-8 text-blue-600" />
            Smart Parking
          </h1>
          <p className="text-gray-500 mt-1">Manage parking and vehicle tracking</p>
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

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by vehicle plate, owner name..."
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

      {/* Records Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Parking Records</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vehicle</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Owner</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Check-in Time</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Spot</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.slice(0, 10).map((record, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FiTruck className="w-5 h-5 text-gray-400" />
                      <span className="font-medium text-gray-900">{record.plateNumber || record.vehicle || 'N/A'}</span>
                      {record.flagged && (
                        <FiAlertTriangle className="w-4 h-4 text-red-500" title="Flagged" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{record.ownerName || record.owner || 'N/A'}</td>
                  <td className="px-6 py-4 text-gray-500">{record.checkInTime || 'N/A'}</td>
                  <td className="px-6 py-4 text-gray-600">{record.spot || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                      record.status === 'Parked' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {record.status || 'Unknown'}
                    </span>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No parking records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SmartParkingDashboard;
