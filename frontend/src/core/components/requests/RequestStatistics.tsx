import React, { useState, useEffect } from 'react';
import requestService, { type RequestStatistics } from '../../../core/services/requestService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import { StatusPie3D } from '@/systems/event-managment/pages/dashboard/components/TaskStatusChart';

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'range', label: 'Custom Range' },
];

const RequestStats: React.FC = () => {
  const [stats, setStats] = useState<RequestStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'range' | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appliedPeriod, setAppliedPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'range' | 'all'>('all');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const res = await requestService.getStatistics({
        period: appliedPeriod === 'all' ? undefined : appliedPeriod,
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
      });

    if (res && typeof res === 'object' && 'data' in res && res.data) {
      setStats(res.data as RequestStatistics);
    } else if (res && typeof res === 'object') {
      setStats(res as RequestStatistics);
    }
    } catch (error) {
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, [appliedPeriod, appliedFrom, appliedTo]);

  const handleApply = () => {
    setAppliedPeriod(period);
    setAppliedFrom(from);
    setAppliedTo(to);
  };

  const slices = stats
    ? [
        { label: 'Pending', value: stats.Pending || 0, color: '#2563EB' },
        { label: 'In Progress', value: stats.Inprogress || 0, color: '#F39C12' },
        { label: 'Completed', value: stats.Completed || 0, color: '#4CAF50' },
        { label: 'Archived', value: stats.Archived || 0, color: '#9E9E9E' },
        { label: 'Overdue', value: stats.Overdue || 0, color: '#E53935' },
      ]
    : [];

  return (
    <div
      className="p-4"
      style={{
        backgroundColor: '#FFFFFF',
        boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)',
        borderRadius: 0,
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className="p-1.5"
          style={{
            backgroundColor: 'rgba(5,109,170,0.08)',
            borderRadius: 999,
          }}
        >
          <svg className="w-4 h-4" style={{ color: '#056daa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ fontFamily: "'Montserrat', sans-serif", color: '#333333' }}>
            Request Statistics
          </h3>
          <p className="text-xs text-gray-400">By status</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="cok-auth-input w-full py-2.5 px-3 text-sm"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {period === 'range' && (
            <>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="cok-auth-input w-full py-2.5 px-3 text-sm"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              />
            </>
          )}
          <button
            onClick={handleApply}
            className="cok-btn-primary"
            style={{ width: 'auto', padding: '0.6rem 1rem' }}
          >
            Apply
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <SpiralLoader />
          </div>
        ) : slices.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            No data available
          </div>
        ) : (
          <StatusPie3D slices={slices} />
        )}
      </div>
    </div>
  );
};

export default RequestStats;
