
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

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const ACCENT_DARK_BLUE = "#2980B9";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const cardStyle: React.CSSProperties = { backgroundColor: WHITE, boxShadow: CARD_SHADOW };
const labelStyle: React.CSSProperties = { fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY };
const btnTypography: React.CSSProperties = { fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' };
const inputStyle: React.CSSProperties = { fontFamily: fontHeading, fontSize: 14, backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' };
const focusInput = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.border = `1px solid ${PRIMARY}`; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; };
const blurInput = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; };

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
          <FiLoader className="w-12 h-12 animate-spin mx-auto mb-3" style={{ color: PRIMARY }} />
          <p className="text-[#555555]">Loading performance analytics...</p>
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
          <h1 className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Performance Analytics</h1>
          <p className="text-[#555555] text-xs mt-0.5">Track your task completion metrics and productivity.</p>
        </div>
        <button
          onClick={loadPerformanceData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#056daa] text-white hover:bg-[#045d94]"
          style={btnTypography}
        >
          <FiRefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="p-3" style={cardStyle}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2" style={labelStyle}>
            <FiCalendar className="w-4 h-4" />
            Date Range:
          </span>

          <button
            onClick={() => setSelectedRange('week')}
            className={`px-3 py-1.5 ${
              selectedRange === 'week'
                ? 'bg-[#056daa] text-white'
                : 'bg-[#F7F9FB] text-[#333333] hover:bg-[rgba(5,109,170,0.08)]'
            }`}
            style={btnTypography}
          >
            This Week
          </button>

          <button
            onClick={() => setSelectedRange('month')}
            className={`px-3 py-1.5 ${
              selectedRange === 'month'
                ? 'bg-[#056daa] text-white'
                : 'bg-[#F7F9FB] text-[#333333] hover:bg-[rgba(5,109,170,0.08)]'
            }`}
            style={btnTypography}
          >
            This Month
          </button>

          <button
            onClick={() => setSelectedRange('custom')}
            className={`px-3 py-1.5 ${
              selectedRange === 'custom'
                ? 'bg-[#056daa] text-white'
                : 'bg-[#F7F9FB] text-[#333333] hover:bg-[rgba(5,109,170,0.08)]'
            }`}
            style={btnTypography}
          >
            Custom
          </button>

          {selectedRange === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5"
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
              <span className="text-[#9E9E9E]">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5"
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
            </div>
          )}
        </div>
        {dateRangeDisplay && (
          <p className="text-xs text-[#9E9E9E] mt-3">Period: {dateRangeDisplay}</p>
        )}
      </div>

      {/* Metric Cards - 4 Primary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4" style={cardStyle}>
          <span className="block mb-1.5 flex items-center gap-1.5" style={labelStyle}>
            <FiCheckCircle className="w-3.5 h-3.5" />
            Total Tasks
          </span>
          <div className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{metrics?.totalTasks || 0}</div>
          <p className="text-xs text-[#9E9E9E] mt-0.5">Tasks in period</p>
        </div>

        <div className="p-4" style={cardStyle}>
          <span className="block mb-1.5 flex items-center gap-1.5" style={labelStyle}>
            <FiCheckCircle className="w-3.5 h-3.5" />
            Completed
          </span>
          <div className="text-lg font-bold" style={{ fontFamily: fontHeading, color: SUCCESS }}>{metrics?.completedTasks || 0}</div>
          <p className="text-xs text-[#9E9E9E] mt-0.5">Successfully completed</p>
        </div>

        <div className="p-4" style={cardStyle}>
          <span className="block mb-1.5 flex items-center gap-1.5" style={labelStyle}>
            <FiTrendingUp className="w-3.5 h-3.5" />
            Completion Rate
          </span>
          <div className="text-lg font-bold" style={{ fontFamily: fontHeading, color: WARNING }}>{metrics?.completionRate || 0}%</div>
          <p className="text-xs text-[#9E9E9E] mt-0.5">Tasks completed</p>
        </div>

        <div className="p-4" style={cardStyle}>
          <span className="block mb-1.5 flex items-center gap-1.5" style={labelStyle}>
            <FiTrendingUp className="w-3.5 h-3.5" />
            On-Time Rate
          </span>
          <div className="text-lg font-bold" style={{ fontFamily: fontHeading, color: ACCENT_DARK_BLUE }}>{metrics?.onTimeRate || 0}%</div>
          <p className="text-xs text-[#9E9E9E] mt-0.5">Before due date</p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4" style={cardStyle}>
          <span className="block mb-1.5 flex items-center gap-1.5" style={labelStyle}>
            <FiClock className="w-3.5 h-3.5" />
            Avg. Completion Time
          </span>
          <div className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
            {metrics?.averageCompletionTime || 0} <span className="text-xs font-normal text-[#9E9E9E]">mins</span>
          </div>
          <p className="text-xs text-[#9E9E9E] mt-0.5">Average time per task</p>
        </div>

        <div className="p-4" style={cardStyle}>
          <span className="block mb-1.5 flex items-center gap-1.5" style={labelStyle}>
            <FiCheckCircle className="w-3.5 h-3.5" />
            Completed Today
          </span>
          <div className="text-base font-bold" style={{ fontFamily: fontHeading, color: SUCCESS }}>{metrics?.completedToday || 0}</div>
          <p className="text-xs text-[#9E9E9E] mt-0.5">Today's completions</p>
        </div>

        <div className="p-4" style={cardStyle}>
          <span className="block mb-1.5 flex items-center gap-1.5" style={labelStyle}>
            <FiTrendingUp className="w-3.5 h-3.5" />
            Overdue Tasks
          </span>
          <div className="text-base font-bold" style={{ fontFamily: fontHeading, color: metrics?.overdueTasks ? DANGER : SUCCESS }}>
            {metrics?.overdueTasks || 0}
          </div>
          <p className="text-xs text-[#9E9E9E] mt-0.5">Tasks past due date</p>
        </div>
      </div>

      {/* Weekly Performance Bar Chart */}
      <div className="p-4" style={cardStyle}>
        <h2 className="text-sm font-bold mb-4" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Weekly Performance</h2>

        {weeklyData && weeklyData.length > 0 ? (
          <div className="space-y-4">
            {/* Chart */}
            <div className="flex gap-2 md:gap-3 lg:gap-4 h-80 items-end">
              {/* Y-Axis Labels */}
              <div className="flex flex-col justify-between h-full w-12 text-right pr-4">
                {yAxisValues.reverse().map((value, idx) => (
                  <span key={idx} className="text-xs font-medium" style={{ color: GRAY_DISABLED }}>
                    {value}
                  </span>
                ))}
              </div>

              {/* Bars Container */}
              <div className="flex-1 flex items-end justify-around gap-1 md:gap-2 border-l border-b border-[#E0E0E0] pl-2 pb-2">
                {weeklyData.map((day, idx) => (
                  <div key={idx} className="flex flex-col items-center flex-1 group">
                    {/* Bar */}
                    <div
                      className="w-full bg-[#056daa] hover:bg-[#045d94] transition-colors cursor-pointer"
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
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: GRAY_DISABLED }}>{day.day}</span>
                </div>
              ))}
            </div>

            {/* Chart Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 mt-6 border-t border-[#E0E0E0]">
              <div className="text-center">
                <p className="text-xs text-[#555555] font-medium mb-1">Peak</p>
                <p className="text-2xl font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                  {Math.max(...weeklyData.map(d => d.completedTasks))}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-[#555555] font-medium mb-1">Average</p>
                <p className="text-2xl font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                  {Math.round(weeklyData.reduce((sum, d) => sum + d.completedTasks, 0) / weeklyData.length)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-[#555555] font-medium mb-1">Total</p>
                <p className="text-2xl font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                  {weeklyData.reduce((sum, d) => sum + d.completedTasks, 0)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-[#9E9E9E]">No data available for the selected period</p>
          </div>
        )}
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[rgba(5,109,170,0.08)] p-3">
          <p className="text-xs text-[#056daa] font-medium" style={{ fontFamily: fontHeading }}>In Progress</p>
          <p className="text-base font-bold mt-1" style={{ fontFamily: fontHeading, color: PRIMARY }}>{metrics?.inProgressTasks || 0}</p>
          <p className="text-xs text-[#056daa] mt-0.5">Currently being worked on</p>
        </div>

        <div className="bg-[rgba(243,156,18,0.1)] p-3">
          <p className="text-xs text-[#F39C12] font-medium" style={{ fontFamily: fontHeading }}>Under Review</p>
          <p className="text-base font-bold mt-1" style={{ fontFamily: fontHeading, color: WARNING }}>{metrics?.underReviewTasks || 0}</p>
          <p className="text-xs text-[#F39C12] mt-0.5">Awaiting review</p>
        </div>

        <div className="bg-[rgba(76,175,80,0.1)] p-3">
          <p className="text-xs text-[#4CAF50] font-medium" style={{ fontFamily: fontHeading }}>On Time</p>
          <p className="text-base font-bold mt-1" style={{ fontFamily: fontHeading, color: SUCCESS }}>{metrics?.onTimeTasks || 0}</p>
          <p className="text-xs text-[#4CAF50] mt-0.5">Completed on time</p>
        </div>
      </div>
    </div>
  )
}

export default PerformanceAnalyticsTab
