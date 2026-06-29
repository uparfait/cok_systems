import { useState, useEffect } from 'react';
import { FiHome, FiCheckCircle, FiUsers, FiMaximize, FiMapPin, FiBarChart2, FiTrendingUp } from 'react-icons/fi';
import axios from 'axios';
import SpiralLoader from './SpiralLoader';

const BASE_URL = '/cok/api/v1';

export default function RoomStatistics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${BASE_URL}/rooms/statistics`);
      setStats(response.data.data || response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white border border-gray-200 ppp-lg p-12 text-center">
          <div className="ppp-full h-8 w-8 mx-auto">
            < SpiralLoader />
          </div>
          <p className="text-sm text-gray-500 mt-3">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 ppp-lg p-6 text-center">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={fetchStatistics} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      label: 'Total Rooms',
      value: stats.overview?.totalRooms || 0,
      icon: FiHome,
      color: 'bg-blue-50 text-blue-600',
      bgBar: 'bg-blue-100'
    },
    {
      label: 'Active Rooms',
      value: stats.overview?.activeRooms || 0,
      icon: FiCheckCircle,
      color: 'bg-green-50 text-green-600',
      bgBar: 'bg-green-100'
    },
    {
      label: 'Occupied Rooms',
      value: stats.overview?.occupiedRooms || 0,
      icon: FiUsers,
      color: 'bg-purple-50 text-purple-600',
      bgBar: 'bg-purple-100'
    },
    {
      label: 'Total Capacity',
      value: stats.capacity?.totalCapacity || 0,
      icon: FiMaximize,
      color: 'bg-orange-50 text-orange-600',
      bgBar: 'bg-orange-100'
    }
  ];

  return (
    <div className="p-6 space-y-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <div key={index} className="bg-white border border-gray-200 ppp-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
              </div>
              <div className={`w-10 h-10 ppp-lg ${card.color} flex items-center justify-center`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
            <div className={`mt-4 h-1 ppp-full ${card.bgBar}`}>
              <div 
                className="h-full ppp-full bg-current opacity-25" 
                style={{ width: `${Math.min(100, (card.value / (stats.overview?.totalRooms || 1)) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Top Locations */}
      {stats.topLocations && stats.topLocations.length > 0 && (
        <div className="bg-white border border-gray-200 ppp-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 ppp-lg flex items-center justify-center">
                <FiMapPin className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Top Locations</h3>
                <p className="text-xs text-gray-500">By room count and capacity</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {stats.topLocations.map((location, index) => (
              <div key={index} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 ppp-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{location.location}</p>
                    <p className="text-xs text-gray-500">{location.roomCount} rooms</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{location.totalCapacity}</p>
                  <p className="text-xs text-gray-500">total capacity</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional Stats */}
      {stats.capacity && (
        <div className="bg-white border border-gray-200 ppp-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-50 ppp-lg flex items-center justify-center">
                <FiTrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Capacity Overview</h3>
                <p className="text-xs text-gray-500">Summary of room capacities</p>
              </div>
            </div>
          </div>
          <div className="p-6 grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Average Capacity</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.capacity.averageCapacity ? Math.round(stats.capacity.averageCapacity) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Largest Room</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.topLocations[0].location || ''} - ({stats.topLocations[0].totalCapacity || ''})
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}