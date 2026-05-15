import axios from 'axios';
import api from '../../../core/services/api';

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export interface ServiceMetrics {
  citizensServed: number;
  avgWaitTime: number;
  avgServiceTime: number;
  slaCompliance: number;
  satisfactionScore: number;
}

export interface LiveCenter {
  name: string;
  queue: number;
  avgWait: number;
  status: string;
}

export interface EmployeePerformance {
  name: string;
  served: number;
  avgTime: number;
  rating: number;
  status: string;
}

export interface OfficeRanking {
  rank: number;
  name: string;
}

export interface WaitingAnalytics {
  time: string;
  level: string;
  color: string;
}

export interface ServiceDuration {
  service: string;
  duration: number;
}

export interface SLAMonitoring {
  withinSLA: number;
  delayed: number;
  mostDelayedOffice: string;
  highestDelayService: string;
}

export interface CitizenFeedback {
  positive: number;
  complaints: number;
  abandonmentRate: number;
  avgRating: number;
}

export interface ServiceFlow {
  avgQueueTime: number;
  avgProcessingTime: number;
  avgTotalTime: number;
}

export interface SystemStatus {
  status: string;
  activeEmployees: number;
  activeQueue: number;
  lastSync: string;
}

export interface DashboardData {
  serviceMetrics: ServiceMetrics;
  liveCenters: LiveCenter[];
  alerts: string[];
  employeePerformance: EmployeePerformance[];
  officeRankings: OfficeRanking[];
  waitingAnalytics: WaitingAnalytics[];
  serviceDuration: ServiceDuration[];
  slaMonitoring: SLAMonitoring;
  citizenFeedback: CitizenFeedback;
  serviceFlow: ServiceFlow;
  taskSLA: number;
  insights: string[];
  systemStatus: SystemStatus;
}

export const dashboardService = {
   /**
    * Get dashboard analytics data
    */
   getAnalytics: async (dateRange?: DateRange): Promise<DashboardData> => {
     const params = new URLSearchParams();

     if (dateRange?.startDate) {
       params.append('startDate', dateRange.startDate);
     }
     if (dateRange?.endDate) {
       params.append('endDate', dateRange.endDate);
     }

     const response = await axios.get(`/dashboard/analytics?${params.toString()}`);
     return response.data.data;
   },

  /**
   * Get today's analytics (default)
   */
  getTodayAnalytics: async (): Promise<DashboardData> => {
    return dashboardService.getAnalytics();
  },

  /**
   * Get this week's analytics
   */
  getThisWeekAnalytics: async (): Promise<DashboardData> => {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return dashboardService.getAnalytics({
      startDate: startOfWeek.toISOString(),
      endDate: endOfWeek.toISOString()
    });
  },

  /**
   * Get this month's analytics
   */
  getThisMonthAnalytics: async (): Promise<DashboardData> => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    return dashboardService.getAnalytics({
      startDate: startOfMonth.toISOString(),
      endDate: endOfMonth.toISOString()
    });
  },

  /**
   * Get this year's analytics
   */
  getThisYearAnalytics: async (): Promise<DashboardData> => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear(), 11, 31);
    endOfYear.setHours(23, 59, 59, 999);

    return dashboardService.getAnalytics({
      startDate: startOfYear.toISOString(),
      endDate: endOfYear.toISOString()
    });
  }
};