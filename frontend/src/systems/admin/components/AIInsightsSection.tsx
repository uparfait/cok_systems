/**
 * AI Insights & Recommendations Section
 */

import React from 'react';
import type { SystemStatus } from '../services/dashboardService.types';
import { FiZap, FiWifi, FiUsers, FiClock } from 'react-icons/fi';

interface AIInsightsSectionProps {
  insights: string[];
  systemStatus: SystemStatus;
}

export const AIInsightsSection: React.FC<AIInsightsSectionProps> = ({ insights, systemStatus }) => {
  return (
    <div className="space-y-6">
      {/* AI Insights */}
      <div className="bg-white shadow-sm border border-[#E0E0E0]">
        <div className="p-4 border-b border-[#E0E0E0]">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FiZap className="w-5 h-5 text-[#F39C12]" />
            AI INSIGHTS & RECOMMENDATIONS
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-[rgba(5,109,170,0.06)] border border-[#E0E0E0]">
                <FiZap className="w-4 h-4 text-[#056daa] mt-0.5 flex-shrink-0" />
                <span className="text-sm text-[#333333]">{insight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-gray-900 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FiWifi className="w-5 h-5 text-[#4CAF50]" />
              <span className="font-medium">SYSTEM STATUS: {systemStatus.status}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiUsers className="w-4 h-4 text-[#7FBFE8]" />
              <span className="text-sm">Active Employees: {systemStatus.activeEmployees}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiClock className="w-4 h-4 text-[#F39C12]" />
              <span className="text-sm">Active Citizens in Queue: {systemStatus.activeQueue}</span>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            Last Sync: {systemStatus.lastSync}
          </div>
        </div>
      </div>
    </div>
  );
};