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
      case 'Critical': return 'text-red-600 bg-red-50';
      case 'Busy': return 'text-orange-600 bg-orange-50';
      case 'Normal': return 'text-yellow-600 bg-yellow-50';
      case 'Good': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Live Service Centers */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
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
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(center.status)}`}
                >
                  {center.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Alerts */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <WarningSvg className="w-5 h-5 text-red-500" />
            REAL-TIME ALERTS
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <WarningSvg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-red-800">{alert}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
