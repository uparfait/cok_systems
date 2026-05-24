// Performance Analytics Service
// Fetches employee and team performance metrics based on tasks

import { get } from './apiClient'

export interface PerformanceMetrics {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  underReviewTasks: number
  completionRate: number
  averageCompletionTime: number
  completedToday: number
  efficiency?: number
  onTimeRate: number
  overdueTasks: number
  onTimeTasks: number
}

export interface WeeklyData {
  date: string
  day: string
  completedTasks: number
  inProgressTasks: number
  underReviewTasks: number
  totalTasks: number
}

export interface EmployeePerformanceResponse {
  status: boolean
  message: string
  data: {
    metrics: PerformanceMetrics
    weeklyData: WeeklyData[]
    tasks: number
    dateRange: {
      startDate: string
      endDate: string
    }
  }
}

export interface TeamMemberMetrics extends PerformanceMetrics {
  memberId: string
  memberInfo?: {
    _id: string
    full_name: string
    email: string
  }
}

export interface TeamPerformanceResponse {
  status: boolean
  message: string
  data: {
    teamMetrics: TeamMemberMetrics[]
    overallMetrics: PerformanceMetrics
    weeklyData: WeeklyData[]
    teamSize: number
  }
}

// Get employee performance metrics
export const getEmployeePerformance = (params?: {
  startDate?: string
  endDate?: string
  userId?: string
}): Promise<EmployeePerformanceResponse> =>
  get('/performance/employee', params as any)

// Get team performance metrics
export const getTeamPerformance = (params?: {
  departmentId?: string
  startDate?: string
  endDate?: string
  managerId?: string
}): Promise<TeamPerformanceResponse> =>
  get('/performance/team', params as any)

// Format date range for API
export const formatDateRange = (
  startDate: Date,
  endDate: Date
): { startDate: string; endDate: string } => {
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  }
}

// Get current week date range
export const getCurrentWeekDateRange = (): {
  startDate: Date
  endDate: Date
} => {
  const today = new Date()
  const currentDay = today.getDay()
  const firstDay = new Date(today)
  firstDay.setDate(today.getDate() - currentDay + (currentDay === 0 ? -6 : 1))
  firstDay.setHours(0, 0, 0, 0)

  const lastDay = new Date(firstDay)
  lastDay.setDate(firstDay.getDate() + 6)
  lastDay.setHours(23, 59, 59, 999)

  return { startDate: firstDay, endDate: lastDay }
}

// Get current month date range
export const getCurrentMonthDateRange = (): {
  startDate: Date
  endDate: Date
} => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  lastDay.setHours(23, 59, 59, 999)

  return { startDate: firstDay, endDate: lastDay }
}

// Get custom date range
export const getCustomDateRange = (days: number): {
  startDate: Date
  endDate: Date
} => {
  const endDate = new Date()
  endDate.setHours(23, 59, 59, 999)

  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - days + 1)
  startDate.setHours(0, 0, 0, 0)

  return { startDate, endDate }
}
