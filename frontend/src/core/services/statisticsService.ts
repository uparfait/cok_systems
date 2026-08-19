import { get } from './apiClient'

export const statisticsService = {
  getServiceDeliveryStats: () => get('/statistics/service-delivery'),
  getHourlyServiceDeliveryStats: () => get('/statistics/hourly-service-delivery'),
  getHourlyParkingStats: () => get('/statistics/hourly-parking'),
  getActivityTimeline: (params?: { period?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    const qs = query.toString();
    return get(`/statistics/activity-timeline${qs ? `?${qs}` : ''}`);
  },
  getDepartmentsWithLeaders: () => get('/statistics/departments-leaders'),
  getEmployeeStats: () => get('/statistics/employees'),
  getFeedbackTotals: () => get('/statistics/feedback-totals'),
  getFeedbackAverageByDepartment: () => get('/statistics/feedback-average'),
  getCurrentlyParkedStats: () => get('/statistics/currently-parked'),
  getFlaggedVehiclesStats: () => get('/statistics/flagged-vehicles'),
  getEmergencyCarsStats: () => get('/statistics/emergency-cars'),
  getParkingSlots: () => get('/smartparking/slots'),
}