import React from 'react';
import { FiTrendingUp } from 'react-icons/fi';

interface StatCardProps {
  stat: { label: string; value: number | string; icon: React.ComponentType<any>; color: string; subtext: string; trend: string; path: string };
  onClick: () => void;
  colorClasses: Record<string, { bg: string; text: string; light: string }>;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ stat, onClick, colorClasses, loading }) => {
  const Icon = stat.icon;
  const colors = colorClasses[stat.color] || colorClasses.blue;
  return (
    <div onClick={onClick} className="bg-white border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-all group relative overflow-hidden" role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()} aria-label={`View ${stat.label}: ${stat.value}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${colors.light} opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500">{stat.label}</p>
          {loading ? <div className="h-8 w-16 bg-gray-200 animate-pulse mt-1" /> : <p className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">{stat.value}</p>}
          <p className="text-xs text-gray-400 mt-1">{stat.subtext}</p>
        </div>
        <div className={`w-10 h-10 ${colors.light} flex items-center justify-center group-hover:scale-110 transition-transform`}>
          <Icon className={`w-5 h-5 ${colors.text}`} aria-hidden="true" />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between relative">
        <span className="text-xs font-medium flex items-center gap-1 text-gray-500"><FiTrendingUp className="w-3 h-3" />{stat.trend}</span>
        <span className="text-xs text-gray-400">Click to view</span>
      </div>
    </div>
  );
};

export default StatCard;