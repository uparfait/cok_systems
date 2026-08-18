/**
 * Analytics Section with Charts
 */

import React from 'react';
import type { WaitingAnalytics, ServiceDuration, SLAMonitoring, CitizenFeedback } from '../services/dashboardService.types';
import { WaitingTimeChart, ServiceDurationChart, SLAChart, FeedbackChart } from './charts';

interface AnalyticsSectionProps {
  waitingAnalytics: WaitingAnalytics[];
  serviceDuration: ServiceDuration[];
  slaMonitoring: SLAMonitoring;
  citizenFeedback: CitizenFeedback;
}

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  waitingAnalytics,
  serviceDuration,
  slaMonitoring,
  citizenFeedback
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Waiting Time Analytics */}
      <div className="bg-white shadow-sm border border-[#E0E0E0]">
        <div className="p-4 border-b border-[#E0E0E0]">
          <h3 className="text-lg font-semibold text-gray-800" style={{ fontFamily: "'Montserrat', sans-serif" }}>WAITING TIME ANALYTICS</h3>
        </div>
        <div className="p-4">
          <WaitingTimeChart data={waitingAnalytics} />
        </div>
      </div>

      {/* Service Duration Analytics */}
      <div className="bg-white shadow-sm border border-[#E0E0E0]">
        <div className="p-4 border-b border-[#E0E0E0]">
          <h3 className="text-lg font-semibold text-gray-800" style={{ fontFamily: "'Montserrat', sans-serif" }}>SERVICE DURATION ANALYTICS</h3>
        </div>
        <div className="p-4">
          <ServiceDurationChart data={serviceDuration} />
        </div>
      </div>

      {/* SLA Monitoring */}
      <div className="bg-white shadow-sm border border-[#E0E0E0]">
        <div className="p-4 border-b border-[#E0E0E0]">
          <h3 className="text-lg font-semibold text-gray-800" style={{ fontFamily: "'Montserrat', sans-serif" }}>SLA MONITORING</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <SLAChart data={slaMonitoring} />
            </div>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Most Delayed Office:</span> {slaMonitoring.mostDelayedOffice}
              </div>
              <div className="text-sm">
                <span className="font-medium">Highest Delay:</span> {slaMonitoring.highestDelayService}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Citizen Feedback */}
      <div className="bg-white shadow-sm border border-[#E0E0E0]">
        <div className="p-4 border-b border-[#E0E0E0]">
          <h3 className="text-lg font-semibold text-gray-800" style={{ fontFamily: "'Montserrat', sans-serif" }}>CITIZEN FEEDBACK</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FeedbackChart data={citizenFeedback} />
            </div>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Complaints Submitted:</span> {citizenFeedback.complaints}
              </div>
              <div className="text-sm">
                <span className="font-medium">Queue Abandonment:</span> {citizenFeedback.abandonmentRate}%
              </div>
              <div className="text-sm">
                <span className="font-medium">Avg Rating:</span> {citizenFeedback.avgRating}/5
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};