import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

const COLORS = {
  completed: '#22c55e',
  pending: '#f59e0b',
  inProgress: '#3b82f6',
  overdue: '#ef4444'
};

export default function TaskStatusChart({ data, loading }) {
  const chartData = [
    { name: 'Completed', value: data?.completed || 0, key: 'completed' },
    { name: 'Pending', value: data?.pending || 0, key: 'pending' },
    { name: 'In Progress', value: data?.inProgress || 0, key: 'inProgress' },
    { name: 'Overdue', value: data?.overdue || 0, key: 'overdue' }
  ];

  return (
    <div className="bg-white border border-gray-200 p-5 relative">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Task Status Overview</h3>

      {loading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
           <SpiralLoader />
        </div>
      )}
      

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: '#f3f4f6' }}
              contentStyle={{
                border: '1px solid #e5e7eb',
                borderRadius: 0,
                fontSize: 12
              }}
            />
            <Bar dataKey="value" radius={[0, 0, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={COLORS[entry.key]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
