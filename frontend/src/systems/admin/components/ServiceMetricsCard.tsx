/**
 * Service Metrics Card Component
 */

import React from 'react';
export interface ServiceMetrics {
  citizensServed: number;
  avgWaitTime: number;
  avgServiceTime: number;
  slaCompliance: number;
  satisfactionScore: number;
}

interface ServiceMetricsCardProps {
  data: ServiceMetrics;
}

export const ServiceMetricsCard: React.FC<ServiceMetricsCardProps> = ({ data }) => {
  return (
    <div className="text-white p-6 shadow-lg" style={{ backgroundColor: '#056daa', fontFamily: "'Montserrat', sans-serif" }}>
      <h3 className="text-lg font-semibold mb-4 text-center">SERVICE METRICS OVERVIEW</h3>
      <div className="grid grid-cols-5 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold">{data.citizensServed.toLocaleString()}</div>
          <div className="text-sm opacity-90">Citizens Served</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{data.avgWaitTime} mins</div>
          <div className="text-sm opacity-90">Avg Waiting Time</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{data.avgServiceTime} mins</div>
          <div className="text-sm opacity-90">Avg Service Time</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{data.slaCompliance}%</div>
          <div className="text-sm opacity-90">SLA Compliance</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{data.satisfactionScore}/5</div>
          <div className="text-sm opacity-90">Satisfaction Score</div>
        </div>
      </div>
    </div>
  );
};