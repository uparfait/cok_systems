import { get } from './apiClient'

export const statisticsService = {
  getServiceDeliveryStats: () => get('/statistics/service-delivery'),
  getHourlyServiceDeliveryStats: () => get('/statistics/hourly-service-delivery'),
  getHourlyParkingStats: () => get('/statistics/hourly-parking'),
  getDepartmentsWithLeaders: () => get('/statistics/departments-leaders'),
  getEmployeeStats: () => get('/statistics/employees'),
  getFeedbackTotals: () => get('/statistics/feedback-totals'),
  getFeedbackAverageByDepartment: () => get('/statistics/feedback-average'),
  getCurrentlyParkedStats: () => get('/statistics/currently-parked'),
  getFlaggedVehiclesStats: () => get('/statistics/flagged-vehicles'),
  getEmergencyCarsStats: () => get('/statistics/emergency-cars'),
  getParkingSlots: () => get('/smartparking/slots'),
}