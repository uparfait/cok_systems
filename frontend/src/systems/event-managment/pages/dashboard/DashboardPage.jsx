import { useState, useCallback } from 'react';
import DateFilter from './components/DateFilter';
import SummaryCards from './components/SummaryCards';
import TaskStatusChart from './components/TaskStatusChart';
import DashboardCalendar from './components/DashboardCalendar';
import { useDashboard } from './hooks/useDashboard';

export default function DashboardPage() {
  const {
    dateRange,
    setDateRange,
    summary,
    taskStatus,
    calendarEvents,
    loadingStats,
    loadingCalendar,
    fetchCalendar
  } = useDashboard();

  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());

  const handleMonthChange = useCallback((year, month) => {
    setCalendarYear(year);
    setCalendarMonth(month);
    fetchCalendar(year, month);
  }, [fetchCalendar]);

  const handleDateRangeChange = (newRange) => {
    setDateRange(newRange);
  };

  const handleRefresh = () => {
    fetchCalendar(calendarYear, calendarMonth);
  };

  return (
    <div className="space-y-5">
      <DateFilter
        dateRange={dateRange}
        onChange={handleDateRangeChange}
        onRefresh={handleRefresh}
        loading={loadingStats}
      />

      <SummaryCards summary={summary} loading={loadingStats} />

      <div className="space-y-5">
        <TaskStatusChart data={taskStatus} loading={loadingStats} />
        <DashboardCalendar
          events={calendarEvents}
          loading={loadingCalendar}
          onMonthChange={handleMonthChange}
          currentYear={calendarYear}
          currentMonth={calendarMonth}
        />
      </div>
    </div>
  );
}
