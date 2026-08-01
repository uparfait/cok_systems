import React, { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import requestService, { type RequestStatistics } from '../../../core/services/requestService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
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

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'range', label: 'Custom Range' },
];

const OrientationStatsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState<RequestStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'range' | 'all'>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appliedPeriod, setAppliedPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'range' | 'all'>('month');
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
      }
    } catch (error) {
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchStatistics();
  }, [isOpen, appliedPeriod, appliedFrom, appliedTo]);

  const handleApply = () => {
    setAppliedPeriod(period);
    setAppliedFrom(from);
    setAppliedTo(to);
  };

  const orientations: OrientationStat[] = (stats?.by_orientation || []).sort((a, b) => b.total - a.total);
  const maxValue = Math.max(...orientations.map(o => Math.max(o.pending, o.inprogress, o.completed, o.overdue, o.archived)), 1);

  const yAxisTicks = [];
  const step = maxValue <= 10 ? 1 : Math.ceil(maxValue / 10);
  for (let i = 0; i <= maxValue; i += step) {
    yAxisTicks.push(i);
  }
  if (yAxisTicks[yAxisTicks.length - 1] !== maxValue) {
    yAxisTicks.push(maxValue);
  }

  const chartData = orientations.map((item) => ({
    name: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
    fullName: item.name,
    Pending: item.pending,
    InProgress: item.inprogress,
    Completed: item.completed,
    Overdue: item.overdue,
    Archived: item.archived,
  }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-6xl max-h-[90vh] overflow-y-auto" style={{ borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 cok-bg-primary" style={{ borderRadius: 0 }}>
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Orientation Statistics
          </h2>
          <button onClick={onClose} className="cok-btn-outlined-reverse" style={{ padding: '0.4rem 0.8rem' }}>
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
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
            <div className="flex items-center justify-center py-20">
              <SpiralLoader />
            </div>
          ) : orientations.length === 0 ? (
            <div className="text-center py-20 text-xs text-gray-400">No data available</div>
          ) : (
            <div style={{ width: '100%', height: 500 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-30}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    ticks={yAxisTicks}
                    domain={[0, maxValue]}
                    allowDecimals={false}
                  />
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
          )}
        </div>
      </div>
    </div>
  );
};

export default OrientationStatsModal;
