/**
 * Service Flow Tracking Section
 */

import React from 'react';
import type { ServiceFlow } from '../services/dashboardService.types';
import { FiArrowRight, FiClock } from 'react-icons/fi';

interface ServiceFlowSectionProps {
  serviceFlow: ServiceFlow;
  taskSLA: number;
}

export const ServiceFlowSection: React.FC<ServiceFlowSectionProps> = ({ serviceFlow, taskSLA }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold text-gray-800">SERVICE FLOW TRACKING</h3>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center space-x-2 text-sm">
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">Arrival</span>
            <FiArrowRight className="w-4 h-4 text-gray-400" />
            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Queue Start</span>
            <FiArrowRight className="w-4 h-4 text-gray-400" />
            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">Service Start</span>
            <FiArrowRight className="w-4 h-4 text-gray-400" />
            <span className="bg-red-100 text-red-800 px-2 py-1 rounded">Service End</span>
            <FiArrowRight className="w-4 h-4 text-gray-400" />
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Feedback</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-blue-50 p-3 rounded-lg">
            <FiClock className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-blue-600">{serviceFlow.avgQueueTime} mins</div>
            <div className="text-xs text-blue-700">Avg Queue Time</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <FiClock className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-green-600">{serviceFlow.avgProcessingTime} mins</div>
            <div className="text-xs text-green-700">Avg Processing Time</div>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg">
            <FiClock className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-purple-600">{serviceFlow.avgTotalTime} mins</div>
            <div className="text-xs text-purple-700">Avg Total Visit Time</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-1">Task Management SLA</div>
            <div className="text-2xl font-bold text-blue-600">{taskSLA}%</div>
          </div>
        </div>
      </div>
    </div>
  );
};