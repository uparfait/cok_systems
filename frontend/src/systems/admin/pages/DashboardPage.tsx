/**
 * KIGALI SERVICE DELIVERY & EMPLOYEE PERFORMANCE DASHBOARD
 */

import React, { useState, useEffect } from 'react';
import type { DashboardData } from '../services/dashboardService.types';
import { dashboardService } from '../services/dashboardService.types';
import { DateFilter } from '../components/DateFilter';
import { ServiceMetricsCard } from '../components/ServiceMetricsCard';
import { LiveCentersSection } from '../components/LiveCentersSection';
import { EmployeePerformanceSection } from '../components/EmployeePerformanceSection';
import { AnalyticsSection } from '../components/AnalyticsSection';
import { ServiceFlowSection } from '../components/ServiceFlowSection';
import { AIInsightsSection } from '../components/AIInsightsSection';

const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (dateRange?: { startDate?: string; endDate?: string }) => {
    try {
      setLoading(true);
      setError(null);

      let analyticsData: DashboardData;

      if (dateRange?.startDate && dateRange?.endDate) {
        analyticsData = await dashboardService.getAnalytics(dateRange);
      } else {
        // Check which preset filter was applied (this would be passed from DateFilter)
        // For now, default to today
        analyticsData = await dashboardService.getTodayAnalytics();
      }

      setData(analyticsData);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = async (dateRange: { startDate?: string; endDate?: string } | undefined) => {
    await fetchData(dateRange);
  };

  const handlePresetFilter = async (filterType: 'today' | 'week' | 'month' | 'year') => {
    try {
      setLoading(true);
      setError(null);

      let analyticsData: DashboardData;

      switch (filterType) {
        case 'today':
          analyticsData = await dashboardService.getTodayAnalytics();
          break;
        case 'week':
          analyticsData = await dashboardService.getThisWeekAnalytics();
          break;
        case 'month':
          analyticsData = await dashboardService.getThisMonthAnalytics();
          break;
        case 'year':
          analyticsData = await dashboardService.getThisYearAnalytics();
          break;
        default:
          analyticsData = await dashboardService.getTodayAnalytics();
      }

      setData(analyticsData);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard preset filter error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        fetchData();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [loading]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 font-medium">Error Loading Dashboard</div>
            <div className="text-red-600 text-sm mt-1">{error}</div>
            <button
              onClick={() => fetchData()}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            KIGALI SERVICE DELIVERY & EMPLOYEE PERFORMANCE DASHBOARD
          </h1>
          <p className="text-gray-600">Real-time monitoring and analytics for municipal services</p>
        </div>

        {/* Date Filter */}
        <DateFilter
          onFilterChange={handleFilterChange}
          loading={loading}
        />

        {/* Service Metrics Overview */}
        <ServiceMetricsCard data={data.serviceMetrics} />

        {/* Live Centers and Alerts */}
        <LiveCentersSection centers={data.liveCenters} alerts={data.alerts} />

        {/* Employee Performance and Rankings */}
        <EmployeePerformanceSection employees={data.employeePerformance} rankings={data.officeRankings} />

        {/* Analytics Charts */}
        <AnalyticsSection
          waitingAnalytics={data.waitingAnalytics}
          serviceDuration={data.serviceDuration}
          slaMonitoring={data.slaMonitoring}
          citizenFeedback={data.citizenFeedback}
        />

        {/* Service Flow Tracking */}
        <ServiceFlowSection serviceFlow={data.serviceFlow} taskSLA={data.taskSLA} />

        {/* AI Insights and System Status */}
        <AIInsightsSection insights={data.insights} systemStatus={data.systemStatus} />
      </div>
    </div>
  );
};

export default DashboardPage;