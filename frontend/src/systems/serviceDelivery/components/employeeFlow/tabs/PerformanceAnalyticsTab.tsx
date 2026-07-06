
import React, { useState, useEffect, useCallback } from 'react'
import { FiClock, FiCheckCircle, FiTrendingUp, FiCalendar, FiLoader, FiRefreshCw } from 'react-icons/fi'
import { useAuth } from '../../../../../core/contexts/AuthContext'
import { useToast } from '../../../../../core/contexts/ToastContext'
import {
  getEmployeePerformance,
  getCurrentWeekDateRange,
  getCurrentMonthDateRange,
  formatDateRange,
  type PerformanceMetrics,
  type WeeklyData
} from '../../../../../core/services/performanceService'

const PerformanceAnalyticsTab: React.FC = () => {
  const { user } = useAuth()
  const { showError } = useToast()
  const [loading, setLoading] = useState(true)
  const [selectedRange, setSelectedRange] = useState<'week' | 'month' | 'custom'>('week')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [dateRangeDisplay, setDateRangeDisplay] = useState('')

  const loadPerformanceData = useCallback(async () => {
    if (!user?.userId) return

    setLoading(true)
    try {
      let dateParams = {}

      if (selectedRange === 'week') {
        const { startDate, endDate } = getCurrentWeekDateRange()
        dateParams = formatDateRange(startDate, endDate)
        setDateRangeDisplay(`${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`)
      } else if (selectedRange === 'month') {
        const { startDate, endDate } = getCurrentMonthDateRange()
        dateParams = formatDateRange(startDate, endDate)
        setDateRangeDisplay(`${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`)
      } else if (selectedRange === 'custom' && customStartDate && customEndDate) {
        const start = new Date(customStartDate)
        const end = new Date(customEndDate)
        if (start > end) {
          showError('Start date must be before end date')
          setLoading(false)
          return
        }
        dateParams = { startDate: customStartDate, endDate: customEndDate }
        setDateRangeDisplay(`${start.toLocaleDateString()} - ${end.toLocaleDateString()}`)
      }

      const response = await getEmployeePerformance({
        userId: user.userId,
        ...dateParams
      })

      if (response.status && response.data) {
        setMetrics(response.data.metrics)
        setWeeklyData(response.data.weeklyData)
      } else {
        showError(response.message || 'Failed to load performance data')
      }
    } catch (error: any) {
      console.error('Error loading performance data:', error)
      showError(error?.message || 'Failed to load performance analytics')
    } finally {
      setLoading(false)
    }
  }, [user?.userId, selectedRange, customStartDate, customEndDate, showError])

  useEffect(() => {
    loadPerformanceData()
  }, [loadPerformanceData])

  if (loading) {
    return (
      <div className="p-7 flex items-center justify-center min-h-96">
        <div className="text-center">
          <FiLoader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading performance analytics...</p>
        </div>
      </div>
    )
  }

  // Calculate max value for Y-axis
  const maxCompleted = Math.max(...(weeklyData?.map(d => d.completedTasks) || [1]), 1)
  // Round up to nearest 5 or 10
  const maxYAxis = Math.ceil(maxCompleted / 5) * 5 || 10
  const yAxisValues = Array.from({ length: 5 }, (_, i) => Math.round((i / 4) * maxYAxis))

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-[#1a2744]">Performance Analytics</h1>
          <p className="text-gray-500 text-xs mt-0.5">Track your task completion metrics and productivity.</p>
        </div>
        <button
          onClick={loadPerformanceData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
        >
          <FiRefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white border border-gray-200 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <FiCalendar className="w-4 h-4" />
            Date Range:
          </span>

          <button
            onClick={() => setSelectedRange('week')}
            className={`px-3 py-1.5 text-xs font-medium ${
              selectedRange === 'week'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            This Week
          </button>

          <button
            onClick={() => setSelectedRange('month')}
            className={`px-3 py-1.5 text-xs font-medium ${
              selectedRange === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            This Month
          </button>

          <button
            onClick={() => setSelectedRange('custom')}
            className={`px-3 py-1.5 text-xs font-medium ${
              selectedRange === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Custom
          </button>

          {selectedRange === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 text-xs"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 text-xs"
              />
            </div>
          )}
        </div>
        {dateRangeDisplay && (
          <p className="text-xs text-gray-500 mt-3">Period: {dateRangeDisplay}</p>
        )}
      </div>

      {/* Metric Cards - 4 Primary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 p-4">
          <span className="text-gray-500 text-xs block mb-1.5 flex items-center gap-1.5">
            <FiCheckCircle className="w-3.5 h-3.5" />
            Total Tasks
          </span>
          <div className="text-lg font-bold text-[#1a2744]">{metrics?.totalTasks || 0}</div>
          <p className="text-xs text-gray-400 mt-0.5">Tasks in period</p>
        </div>

        <div className="bg-white border border-gray-200 p-4">
          <span className="text-gray-500 text-xs block mb-1.5 flex items-center gap-1.5">
            <FiCheckCircle className="w-3.5 h-3.5" />
            Completed
          </span>
          <div className="text-lg font-bold text-[#34a853]">{metrics?.completedTasks || 0}</div>
          <p className="text-xs text-gray-400 mt-0.5">Successfully completed</p>
        </div>

        <div className="bg-white border border-gray-200 p-4">
          <span className="text-gray-500 text-xs block mb-1.5 flex items-center gap-1.5">
            <FiTrendingUp className="w-3.5 h-3.5" />
            Completion Rate
          </span>
          <div className="text-lg font-bold text-[#ff9800]">{metrics?.completionRate || 0}%</div>
          <p className="text-xs text-gray-400 mt-0.5">Tasks completed</p>
        </div>

        <div className="bg-white border border-gray-200 p-4">
          <span className="text-gray-500 text-xs block mb-1.5 flex items-center gap-1.5">
            <FiTrendingUp className="w-3.5 h-3.5" />
            On-Time Rate
          </span>
          <div className="text-lg font-bold text-[#7b1fa2]">{metrics?.onTimeRate || 0}%</div>
          <p className="text-xs text-gray-400 mt-0.5">Before due date</p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 p-4">
          <span className="text-gray-500 text-xs block mb-1.5 flex items-center gap-1.5">
            <FiClock className="w-3.5 h-3.5" />
            Avg. Completion Time
          </span>
          <div className="text-base font-bold text-[#1a2744]">
            {metrics?.averageCompletionTime || 0} <span className="text-xs font-normal text-gray-400">mins</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Average time per task</p>
        </div>

        <div className="bg-white border border-gray-200 p-4">
          <span className="text-gray-500 text-xs block mb-1.5 flex items-center gap-1.5">
            <FiCheckCircle className="w-3.5 h-3.5" />
            Completed Today
          </span>
          <div className="text-base font-bold text-[#34a853]">{metrics?.completedToday || 0}</div>
          <p className="text-xs text-gray-400 mt-0.5">Today's completions</p>
        </div>

        <div className="bg-white border border-gray-200 p-4">
          <span className="text-gray-500 text-xs block mb-1.5 flex items-center gap-1.5">
            <FiTrendingUp className="w-3.5 h-3.5" />
            Overdue Tasks
          </span>
          <div className={`text-base font-bold ${metrics?.overdueTasks ? 'text-[#f44336]' : 'text-[#34a853]'}`}>
            {metrics?.overdueTasks || 0}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Tasks past due date</p>
        </div>
      </div>

      {/* Weekly Performance Bar Chart */}
      <div className="bg-white border border-gray-200 p-4">
        <h2 className="text-sm font-bold text-[#1a2744] mb-4">Weekly Performance</h2>
        
        {weeklyData && weeklyData.length > 0 ? (
          <div className="space-y-4">
            {/* Chart */}
            <div className="flex gap-2 md:gap-3 lg:gap-4 h-80 items-end">
              {/* Y-Axis Labels */}
              <div className="flex flex-col justify-between h-full w-12 text-right pr-4">
                {yAxisValues.reverse().map((value, idx) => (
                  <span key={idx} className="text-xs font-medium text-gray-600">
                    {value}
                  </span>
                ))}
              </div>

              {/* Bars Container */}
              <div className="flex-1 flex items-end justify-around gap-1 md:gap-2 border-l border-b border-gray-300 pl-2 pb-2">
                {weeklyData.map((day, idx) => (
                  <div key={idx} className="flex flex-col items-center flex-1 group">
                    {/* Bar */}
                    <div
                      className="w-full bg-blue-600 rounded-t hover:bg-blue-700 transition-colors cursor-pointer"
                      style={{
                        height: `${(day.completedTasks / maxYAxis) * 100}%`,
                        minHeight: day.completedTasks > 0 ? '4px' : '0px'
                      }}
                      title={`${day.day}: ${day.completedTasks} tasks`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* X-Axis Labels (Days) */}
            <div className="flex gap-1 md:gap-2 lg:gap-4 ml-16 pl-2">
              {weeklyData.map((day, idx) => (
                <div key={idx} className="flex-1 flex justify-center">
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{day.day}</span>
                </div>
              ))}
            </div>

            {/* Chart Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 mt-6 border-t border-gray-200">
              <div className="text-center">
                <p className="text-xs text-gray-600 font-medium mb-1">Peak</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.max(...weeklyData.map(d => d.completedTasks))}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 font-medium mb-1">Average</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round(weeklyData.reduce((sum, d) => sum + d.completedTasks, 0) / weeklyData.length)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 font-medium mb-1">Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {weeklyData.reduce((sum, d) => sum + d.completedTasks, 0)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">No data available for the selected period</p>
          </div>
        )}
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-100 p-3">
          <p className="text-xs text-blue-700 font-medium">In Progress</p>
          <p className="text-base font-bold text-blue-900 mt-1">{metrics?.inProgressTasks || 0}</p>
          <p className="text-xs text-blue-600 mt-0.5">Currently being worked on</p>
        </div>

        <div className="bg-amber-50 border border-amber-100 p-3">
          <p className="text-xs text-amber-700 font-medium">Under Review</p>
          <p className="text-base font-bold text-amber-900 mt-1">{metrics?.underReviewTasks || 0}</p>
          <p className="text-xs text-amber-600 mt-0.5">Awaiting review</p>
        </div>

        <div className="bg-green-50 border border-green-100 p-3">
          <p className="text-xs text-green-700 font-medium">On Time</p>
          <p className="text-base font-bold text-green-900 mt-1">{metrics?.onTimeTasks || 0}</p>
          <p className="text-xs text-green-600 mt-0.5">Completed on time</p>
        </div>
      </div>
    </div>
  )
}

export default PerformanceAnalyticsTab
