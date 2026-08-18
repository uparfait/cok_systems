/**
 * Employee Performance Section
 */

import React from 'react';

export interface OfficeRanking {
  rank: number;
  name: string;
}

export interface EmployeePerformance {
  name: string;
  served: number;
  avgTime: number;
  rating: number;
  status: string;
}

interface EmployeePerformanceSectionProps {
  employees: EmployeePerformance[];
  rankings: OfficeRanking[];
}

// Inline SVGs
const StarSvg: React.FC<{ className?: string; filled?: boolean }> = ({ className, filled }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11.99 2.5l2.92 6.26 6.89.55-5.18 4.49 1.55 6.7-6.18-3.73-6.18 3.73 1.55-6.7-5.18-4.49 6.89-.55 2.92-6.26z"
    />
  </svg>
);

const TrophySvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 21h8M12 17c3.31 0 6-2.69 6-6V5H6v6c0 3.31 2.69 6 6 6zM18 5h2a2 2 0 012 2v1a4 4 0 01-4 4M6 5H4a2 2 0 00-2 2v1a4 4 0 004 4"
    />
  </svg>
);

export const EmployeePerformanceSection: React.FC<EmployeePerformanceSectionProps> = ({ employees, rankings }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Excellent': return 'text-[#388E3C] bg-[rgba(76,175,80,0.1)]';
      case 'Good': return 'text-[#056daa] bg-[rgba(5,109,170,0.1)]';
      case 'Moderate': return 'text-[#F39C12] bg-[rgba(243,156,18,0.1)]';
      case 'Slow': return 'text-[#E74C3C] bg-[rgba(231,76,60,0.1)]';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <StarSvg
        key={i}
        className={`w-3 h-3 ${i < Math.floor(rating) ? 'text-[#F39C12]' : 'text-gray-300'}`}
        filled={i < Math.floor(rating)}
      />
    ));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Employee Performance */}
      <div className="bg-white shadow-sm border border-[#E0E0E0]">
        <div className="p-4 border-b border-[#E0E0E0]">
          <h3 className="text-lg font-semibold text-gray-800">EMPLOYEE PERFORMANCE</h3>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {employees.slice(0, 4).map((employee, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0"
              >
                <div>
                  <div className="font-medium text-gray-800">{employee.name}</div>
                  <div className="text-sm text-gray-600 flex items-center gap-1">
                    {employee.served} served • {employee.avgTime} mins avg • {renderStars(employee.rating)}
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium ${getStatusColor(employee.status)}`}
                >
                  {employee.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Office Rankings */}
      <div className="bg-white shadow-sm border border-[#E0E0E0]">
        <div className="p-4 border-b border-[#E0E0E0]">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <TrophySvg className="w-5 h-5 text-[#F39C12]" />
            OFFICE RANKINGS
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {rankings.map((ranking, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-[rgba(243,156,18,0.12)] text-[#F39C12] flex items-center justify-center text-sm font-bold">
                    {ranking.rank}
                  </span>
                  <span className="font-medium text-gray-800">{ranking.name}</span>
                </div>
                <span className="text-sm text-gray-600">#{ranking.rank}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
