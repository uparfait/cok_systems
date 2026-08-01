import React, { useState, useEffect } from 'react';
import requestService, { type RequestStatistics } from '../../../core/services/requestService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import OrientationStatsModal from './OrientationStatsModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface OrientationStat {
  name: string;
  pending: number;
  inprogress: number;
  completed: number;
  overdue: number;
  archived: number;
  total: number;
}

const STATUS_COLORS = {
  pending: '#2563EB',
  inprogress: '#F39C12',
  completed: '#4CAF50',
  overdue: '#E53935',
  archived: '#9E9E9E',
};

const STATUS_LABELS = {
  pending: 'Pending',
  inprogress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
  archived: 'Archived',
};

const OrientationStats: React.FC = () => {
  const [stats, setStats] = useState<RequestStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchStatistics = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await requestService.getStatistics({ period: 'month' });
      if (res && typeof res === 'object' && 'data' in res && res.data) {
        setStats(res.data as RequestStatistics);
      }
    } catch (error) {
      if (!silent) setStats(null);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatistics(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const orientations: OrientationStat[] = (stats?.by_orientation || []).sort((a, b) => b.total - a.total);
  const top3 = orientations.slice(0, 3);
  const maxTotal = Math.max(...orientations.map(o => o.total), 1);

  if (loading && !stats) {
    return (
      <div className="p-4 flex items-center justify-center" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)', borderRadius: 0 }}>
        <SpiralLoader />
      </div>
    );
  }

  if (orientations.length === 0) {
    return (
      <div className="p-4" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)', borderRadius: 0 }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5" style={{ backgroundColor: 'rgba(5,109,170,0.08)', borderRadius: 999 }}>
            <svg className="w-4 h-4" style={{ color: '#056daa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ fontFamily: "'Montserrat', sans-serif", color: '#333333' }}>
              By Orientation
            </h3>
            <p className="text-xs text-gray-400">Click to view all</p>
          </div>
        </div>
        <div className="text-center py-8 text-xs text-gray-400">No data available</div>
      </div>
    );
  }

  const chartData = top3.map((item) => ({
    name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
    fullName: item.name,
    Pending: item.pending,
    InProgress: item.inprogress,
    Completed: item.completed,
    Overdue: item.overdue,
    Archived: item.archived,
  }));

  return (
    <div className="p-4" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)', borderRadius: 0 }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5" style={{ backgroundColor: 'rgba(5,109,170,0.08)', borderRadius: 999 }}>
            <svg className="w-4 h-4" style={{ color: '#056daa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ fontFamily: "'Montserrat', sans-serif", color: '#333333' }}>
              By Orientation
            </h3>
            <p className="text-xs text-gray-400">Click to view all</p>
          </div>
        </div>
        
          <button
            onClick={() => setShowModal(true)}
            className="cok-btn-outlined text-xs"
            style={{ padding: '0.3rem 0.8rem' }}
          >
            View in full
          </button>
        
      </div>

      <div style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer onClick={() => setShowModal(true)} width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              height={60}
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: 0, border: '1px solid #E0E0E0' }}
              formatter={(value: any, name: string) => {
                const statusKey = name.toLowerCase().replace(' ', '');
                return [value, STATUS_LABELS[statusKey as keyof typeof STATUS_LABELS] || name];
              }}
              labelFormatter={(label, payload) => {
                const fullName = payload[0]?.payload?.fullName || label;
                return fullName;
              }}
            />
            <Legend
              formatter={(value) => STATUS_LABELS[value.toLowerCase() as keyof typeof STATUS_LABELS] || value}
              wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
            />
            <Bar dataKey="Pending" fill={STATUS_COLORS.pending} stackId="a" />
            <Bar dataKey="InProgress" fill={STATUS_COLORS.inprogress} stackId="a" />
            <Bar dataKey="Completed" fill={STATUS_COLORS.completed} stackId="a" />
            <Bar dataKey="Overdue" fill={STATUS_COLORS.overdue} stackId="a" />
            <Bar dataKey="Archived" fill={STATUS_COLORS.archived} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <OrientationStatsModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
};

export default OrientationStats;
