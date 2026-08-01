import React, { useState, useEffect } from 'react';
import requestService, { type RequestStatistics } from '../../../core/services/requestService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

interface OrientationStat {
  name: string;
  pending: number;
  inprogress: number;
  completed: number;
  overdue: number;
  archived: number;
  total: number;
}

const COLORS = [
  '#2563EB', '#F39C12', '#4CAF50', '#E53935', '#9E9E9E',
  '#7C3AED', '#EC4899', '#14B8A6', '#F97316', '#6366F1'
];

const OrientationStats: React.FC = () => {
  const [stats, setStats] = useState<RequestStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchStatistics = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await requestService.getStatistics({ period: 'all' });
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

  const renderBar = (item: OrientationStat, index: number, color: string) => {
    const widthPercent = (item.total / maxTotal) * 100;
    return (
      <div key={item.name} className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold truncate mr-2" style={{ fontFamily: "'Montserrat', sans-serif", color: '#333333' }} title={item.name}>
            {item.name}
          </span>
          <span className="text-xs font-bold flex-shrink-0" style={{ color, fontFamily: "'Montserrat', sans-serif" }}>
            {item.total}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-100" style={{ borderRadius: 0 }}>
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${widthPercent}%`, backgroundColor: color, borderRadius: 0 }}
          />
        </div>
      </div>
    );
  };

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
            <p className="text-xs text-gray-400">Top 3 orientations</p>
          </div>
        </div>
        <div className="text-center py-8 text-xs text-gray-400">No data available</div>
      </div>
    );
  }

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
            <p className="text-xs text-gray-400">Top 3 orientations</p>
          </div>
        </div>
        {orientations.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="cok-btn-outlined text-xs"
            style={{ padding: '0.3rem 0.8rem' }}
          >
            {expanded ? 'Show Less' : 'View All'}
          </button>
        )}
      </div>

      <div className={expanded ? '' : ''}>
        {(expanded ? orientations : top3).map((item, index) => renderBar(item, index, COLORS[index % COLORS.length]))}
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: '#E0E0E0' }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {orientations.map((item, index) => (
              <div
                key={item.name}
                className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                style={{ backgroundColor: '#F7F9FB', borderRadius: 0, borderLeft: `4px solid ${COLORS[index % COLORS.length]}` }}
              >
                <p className="text-xs font-semibold truncate mb-1" style={{ fontFamily: "'Montserrat', sans-serif", color: '#333333' }} title={item.name}>
                  {item.name}
                </p>
                <p className="text-lg font-bold" style={{ color: COLORS[index % COLORS.length] }}>
                  {item.total}
                </p>
                <div className="flex gap-2 mt-1 text-[10px] text-gray-500">
                  <span>P: {item.pending}</span>
                  <span>IP: {item.inprogress}</span>
                  <span>C: {item.completed}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrientationStats;
