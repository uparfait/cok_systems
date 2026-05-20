import { get, post, put } from './apiClient'

export const parkingService = {
  getAll: async () => {
    try {
      const response = await get('/smartparking/vehicle?status=all&limit=50&page=1')
      if (response.success) return { success: true, data: response.data || [], total: response.total || 0 }
      return { success: false, data: [], total: 0 }
    } catch (error) {
      return { success: false, data: [], total: 0 }
    }
  },
  getAllPaginated: (page: number = 1, limit: number = 50, status: string = 'all') =>
    get(`/smartparking/vehicle?status=${status}&page=${page}&limit=${limit}`),
  update: (id: string, data: any) => put(`/smartparking/vehicle/${id}`, data),
  getStats: async () => {
    try {
      const currentlyParkedResponse = await get('/statistics/currently-parked')
      if (currentlyParkedResponse.success && currentlyParkedResponse.data) {
        const { total } = currentlyParkedResponse.data
        const totalSlots = 200
        return { success: true, data: { availableSlots: Math.max(0, totalSlots - (total || 0)), totalSlots, staffVehicles: 0, visitorVehicles: total || 0, totalParked: total || 0 } }
      }
      return currentlyParkedResponse
    } catch (error) {
      return { success: false, data: {} }
    }
  },
  search: (query: string, page: number = 1, limit: number = 50) =>
    get(`/smartparking/vehicle/search?query=${encodeURIComponent(query)}&status=active&page=${page}&limit=${limit}`),
  getById: (id: string) => get(`/smartparking/vehicle/${id}`),
  checkIn: (data: any) => post('/smartparking/vehicle/checkin', data),
  checkOut: (id: string) => post('/smartparking/vehicle/checkout', { id }),
  verifyVehicle: (plateNumber: string) => post('/smartparking/vehicle/verify', { plate_number: plateNumber }),
  getFlagged: () => get('/smartparking/vehicle/flagged'),
  updateSlotConfig: (config: { totalSlots: number; staffReservedSlots: number; visitorReservedSlots: number }) =>
    put('/smartparking/slots', config),
}

export const smartParkingService = parkingService