import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { DASHBOARD_STATS, CALENDAR_EVENTS } from '../constants/api';

const formatDateForInput = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function useDashboard() {
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), 0, 1);
    return {
      from: formatDateForInput(from),
      to: formatDateForInput(now)
    };
  });

  const [summary, setSummary] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const params = new URLSearchParams();
      params.append('from', dateRange.from);
      params.append('to', dateRange.to);
      const response = await axios.get(`${DASHBOARD_STATS}?${params.toString()}`);
      if (response.data?.success) {
        setSummary(response.data.data.summary);
        setTaskStatus(response.data.data.taskStatus);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingStats(false);
    }
  }, [dateRange]);

  const fetchCalendar = useCallback(async (year, month) => {
    setLoadingCalendar(true);
    try {
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const response = await axios.get(`${CALENDAR_EVENTS}?month=${encodeURIComponent(monthStr)}`);
      if (response.data?.success) {
        setCalendarEvents(response.data.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingCalendar(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const now = new Date();
    fetchCalendar(now.getFullYear(), now.getMonth());
  }, [fetchCalendar]);

  return {
    dateRange,
    setDateRange,
    summary,
    taskStatus,
    calendarEvents,
    loadingStats,
    loadingCalendar,
    error,
    fetchStats,
    fetchCalendar
  };
}
