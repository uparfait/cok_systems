import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

const COLORS = {
  completed: '#22c55e',
  pending: '#f59e0b',
  inProgress: '#3b82f6',
  overdue: '#ef4444'
};

export const StatusPie3D = ({ slices }) => {
  const data = slices.filter(s => s.value > 0);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (!total) return <div className="h-40 flex items-center justify-center text-xs text-gray-400">No data available</div>;

  const cx = 280, cy = 112, rx = 104, squash = 0.55, ry = rx * squash, depth = 24, explode = 13;
  const shade = (hex, f) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
  };

  let angle = -Math.PI / 2;
  const parts = data.map(d => {
    const sweep = (d.value / total) * Math.PI * 2;
    const p = { ...d, a0: angle, a1: angle + sweep, mid: angle + sweep / 2 };
    angle += sweep;
    return p;
  });

  const off = (p) => ({ ox: Math.cos(p.mid) * explode, oy: Math.sin(p.mid) * explode * squash });
  const pt = (ang, ox, oy) => ({ x: cx + ox + rx * Math.cos(ang), y: cy + oy + ry * Math.sin(ang) });

  const topPath = (p) => {
    const { ox, oy } = off(p);
    const s = pt(p.a0, ox, oy), e = pt(p.a1, ox, oy);
    const large = p.a1 - p.a0 > Math.PI ? 1 : 0;
    return `M ${cx + ox} ${cy + oy} L ${s.x} ${s.y} A ${rx} ${ry} 0 ${large} 1 ${e.x} ${e.y} Z`;
  };

  const wallPath = (p) => {
    const lo = Math.max(p.a0, 0), hi = Math.min(p.a1, Math.PI);
    if (lo >= hi) return null;
    const { ox, oy } = off(p);
    const s = pt(lo, ox, oy), e = pt(hi, ox, oy);
    const large = hi - lo > Math.PI ? 1 : 0;
    return `M ${s.x} ${s.y} A ${rx} ${ry} 0 ${large} 1 ${e.x} ${e.y} L ${e.x} ${e.y + depth} A ${rx} ${ry} 0 ${large} 0 ${s.x} ${s.y + depth} Z`;
  };

  return (
    <svg viewBox="0 0 560 235" className="w-full" style={{ maxWidth: 640, margin: '0 auto', display: 'block' }}>
      {parts.map(p => { const w = wallPath(p); return w ? <path key={`w${p.label}`} d={w} fill={shade(p.color, 0.72)} /> : null; })}
      {parts.map(p => <path key={`t${p.label}`} d={topPath(p)} fill={p.color} />)}
      {parts.map(p => {
        const { ox, oy } = off(p);
        const lx = cx + ox + rx * 0.58 * Math.cos(p.mid);
        const ly = cy + oy + ry * 0.58 * Math.sin(p.mid);
        const pct = Math.round((p.value / total) * 100);
        return (
          <text key={`p${p.label}`} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="19" fontWeight="800" fill="#fff" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
            {pct}%
          </text>
        );
      })}
      {parts.map(p => {
        const right = Math.cos(p.mid) >= 0;
        const sx = cx + Math.cos(p.mid) * (rx + explode + 2);
        const sy = cy + Math.sin(p.mid) * (ry + explode * squash + 2) + (Math.sin(p.mid) > 0 ? depth : 0);
        const ex = cx + (right ? 1 : -1) * (rx + 46);
        const ey = sy + (Math.sin(p.mid) > 0 ? 14 : -14);
        return (
          <g key={`c${p.label}`}>
            <polyline points={`${sx},${sy} ${ex},${ey} ${ex + (right ? 22 : -22)},${ey}`} fill="none" stroke="#9ca3af" strokeWidth="1" />
            <text x={ex + (right ? 26 : -26)} y={ey} textAnchor={right ? 'start' : 'end'} dominantBaseline="middle" fontSize="11" fontWeight="600" fill="#374151">
              {p.label} ({p.value})
            </text>
          </g>
        );
      })}
    </svg>
  );
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
