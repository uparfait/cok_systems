/**
 * Live Service Centers Section
 */

import React from 'react';

interface LiveCentersSectionProps {
  centers: LiveCenter[];
  alerts: string[];
}
export interface LiveCenter {
  name: string;
  queue: number;
  avgWait: number;
  status: string;
}

// Inline SVG for Warning icon
const WarningSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
    />
  </svg>
);

export const LiveCentersSection: React.FC<LiveCentersSectionProps> = ({ centers, alerts }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Critical': return 'text-[#E74C3C] bg-[rgba(231,76,60,0.1)]';
      case 'Busy': return 'text-[#F39C12] bg-[rgba(243,156,18,0.12)]';
      case 'Normal': return 'text-[#F39C12] bg-[rgba(243,156,18,0.1)]';
      case 'Good': return 'text-[#4CAF50] bg-[rgba(76,175,80,0.1)]';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Live Service Centers */}
      <div className="bg-white shadow-sm border border-[#E0E0E0]">
        <div className="p-4 border-b border-[#E0E0E0]">
          <h3 className="text-lg font-semibold text-gray-800">LIVE SERVICE CENTERS</h3>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {centers.map((center, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0"
              >
                <div>
                  <div className="font-medium text-gray-800">{center.name}</div>
                  <div className="text-sm text-gray-600">
                    {center.queue} waiting • {center.avgWait} mins avg wait
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium ${getStatusColor(center.status)}`}
                >
                  {center.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Alerts */}
      <div className="bg-white shadow-sm border border-[#E0E0E0]">
        <div className="p-4 border-b border-[#E0E0E0]">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <WarningSvg className="w-5 h-5 text-[#E74C3C]" />
            REAL-TIME ALERTS
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-[rgba(231,76,60,0.08)] border border-[#E74C3C]"
              >
                <WarningSvg className="w-4 h-4 text-[#E74C3C] mt-0.5 flex-shrink-0" />
                <span className="text-sm text-[#E74C3C]">{alert}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
