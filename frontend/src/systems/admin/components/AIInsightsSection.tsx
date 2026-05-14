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
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FiZap className="w-5 h-5 text-yellow-500" />
            AI INSIGHTS & RECOMMENDATIONS
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <FiZap className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-blue-800">{insight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-gray-900 text-white rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FiWifi className="w-5 h-5 text-green-400" />
              <span className="font-medium">SYSTEM STATUS: {systemStatus.status}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiUsers className="w-4 h-4 text-blue-400" />
              <span className="text-sm">Active Employees: {systemStatus.activeEmployees}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiClock className="w-4 h-4 text-orange-400" />
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