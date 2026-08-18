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
    <div className="bg-white shadow-sm border border-[#E0E0E0]">
      <div className="p-4 border-b border-[#E0E0E0]">
        <h3 className="text-lg font-semibold text-gray-800">SERVICE FLOW TRACKING</h3>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center space-x-2 text-sm">
            <span className="bg-[rgba(5,109,170,0.1)] text-[#056daa] px-2 py-1">Arrival</span>
            <FiArrowRight className="w-4 h-4 text-gray-400" />
            <span className="bg-[rgba(243,156,18,0.12)] text-[#F39C12] px-2 py-1">Queue Start</span>
            <FiArrowRight className="w-4 h-4 text-gray-400" />
            <span className="bg-[rgba(243,156,18,0.15)] text-[#D68910] px-2 py-1">Service Start</span>
            <FiArrowRight className="w-4 h-4 text-gray-400" />
            <span className="bg-[rgba(231,76,60,0.12)] text-[#E74C3C] px-2 py-1">Service End</span>
            <FiArrowRight className="w-4 h-4 text-gray-400" />
            <span className="bg-[rgba(76,175,80,0.12)] text-[#388E3C] px-2 py-1">Feedback</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-[rgba(5,109,170,0.06)] p-3">
            <FiClock className="w-5 h-5 text-[#056daa] mx-auto mb-1" />
            <div className="text-lg font-bold text-[#056daa]">{serviceFlow.avgQueueTime} mins</div>
            <div className="text-xs text-[#056daa]">Avg Queue Time</div>
          </div>
          <div className="bg-[rgba(76,175,80,0.12)] p-3">
            <FiClock className="w-5 h-5 text-[#388E3C] mx-auto mb-1" />
            <div className="text-lg font-bold text-[#388E3C]">{serviceFlow.avgProcessingTime} mins</div>
            <div className="text-xs text-[#388E3C]">Avg Processing Time</div>
          </div>
          <div className="bg-[rgba(41,128,185,0.08)] p-3">
            <FiClock className="w-5 h-5 text-[#2980B9] mx-auto mb-1" />
            <div className="text-lg font-bold text-[#2980B9]">{serviceFlow.avgTotalTime} mins</div>
            <div className="text-xs text-[#2980B9]">Avg Total Visit Time</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[#E0E0E0]">
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-1">Task Management SLA</div>
            <div className="text-2xl font-bold text-[#056daa]">{taskSLA}%</div>
          </div>
        </div>
      </div>
    </div>
  );
};