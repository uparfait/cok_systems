import { useState, useCallback, useMemo } from 'react';
import {
  FiCalendar,
  FiLoader,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
} from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { useDashboard } from '../../event-managment/pages/dashboard/hooks/useDashboard';
import MayorEventDetailsOverlay from './sub/MayorEventDetailsOverlay';

// City of Kigali design rule palette (see desegin_rule.html)
const COK = {
  primary: '#056daa',
  success: '#4CAF50',
  primaryDark: '#045d94',
  warning: '#F39C12',
  danger: '#E53935',
  tertiary: '#CDB896',
  neutralDark: '#333333',
  neutralLight: '#F7F9FB',
  border: '#E0E0E0',
  headingFont: "'Montserrat', sans-serif",
  bodyFont: "'Merriweather', serif",
};

interface CalendarEvent {
  _id?: string;
  eventSpecialId?: string;
  eventName?: string;
  eventDescription?: string;
  eventMeetingType?: string;
  eventType?: string;
  eventStatus?: string;
  eventRoom?: string;
  eventOrganizer?: { fullNames?: string; email?: string; phone?: string; telephone?: string; institution?: string };
  expectedAudience?: number | string;
  startTime?: string;
  endTime?: string;
  isCancelled?: boolean;
  occurrenceDate?: string;
}

// ==================== Shared UI ====================

const CokLabel = ({ children }: { children: React.ReactNode }) => (
  <p
    className="uppercase"
    style={{
      fontFamily: COK.headingFont,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.5px',
      color: COK.neutralDark,
      margin: 0,
    }}
  >
    {children}
  </p>
);

const LoadingOverlay = () => (
  <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
    <FiLoader className="w-5 h-5 animate-spin" style={{ color: COK.primary }} />
  </div>
);

// ==================== Filter Bar ====================

interface DateRange {
  from: string;
  to: string;
}

function EventsFilterBar({
  dateRange,
  onChange,
  onRefresh,
  loading,
}: {
  dateRange: DateRange;
  onChange: (r: DateRange) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 bg-white p-3"
      style={{ border: `1px solid ${COK.border}` }}
    >
      <div className="flex items-center gap-2">
        <FiCalendar className="w-4 h-4" style={{ color: COK.primary }} />
        <CokLabel>Date Range</CokLabel>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500" htmlFor="mayor-events-from">From</label>
        <input
          id="mayor-events-from"
          type="date"
          value={dateRange.from}
          onChange={(e) => onChange({ ...dateRange, from: e.target.value })}
          className="h-9 px-3 text-sm text-gray-700 focus:outline-none"
          style={{ border: `1px solid ${COK.border}` }}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500" htmlFor="mayor-events-to">To</label>
        <input
          id="mayor-events-to"
          type="date"
          value={dateRange.to}
          onChange={(e) => onChange({ ...dateRange, to: e.target.value })}
          className="h-9 px-3 text-sm text-gray-700 focus:outline-none"
          style={{ border: `1px solid ${COK.border}` }}
        />
      </div>

      <button
        onClick={onRefresh}
        disabled={loading}
        className="h-9 px-4 text-white text-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        style={{ backgroundColor: COK.primary, fontFamily: COK.headingFont, fontWeight: 600 }}
      >
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
}

// ==================== Task Status Chart ====================

const TASK_COLORS: Record<string, string> = {
  completed: COK.success,
  pending: COK.warning,
  inProgress: COK.primary,
  overdue: COK.danger,
};

function EventsTaskStatusChart({ data, loading }: { data: Record<string, number> | null; loading: boolean }) {
  const chartData = [
    { name: 'Completed', value: data?.completed || 0, key: 'completed' },
    { name: 'Pending', value: data?.pending || 0, key: 'pending' },
    { name: 'In Progress', value: data?.inProgress || 0, key: 'inProgress' },
    { name: 'Overdue', value: data?.overdue || 0, key: 'overdue' },
  ];

  return (
    <div className="bg-white p-4 relative" style={{ border: `1px solid ${COK.border}` }}>
      <h3
        className="mb-4"
        style={{ fontFamily: COK.headingFont, fontSize: 15, fontWeight: 600, color: COK.neutralDark, margin: '0 0 16px 0' }}
      >
        Task Status Overview
      </h3>

      {loading && <LoadingOverlay />}

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: COK.border }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: COK.border }}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: COK.neutralLight }}
              contentStyle={{ border: `1px solid ${COK.border}`, borderRadius: 0, fontSize: 12 }}
            />
            <Bar dataKey="value" radius={[0, 0, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={TASK_COLORS[entry.key]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ==================== Read-only Events Calendar ====================

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function eventAccent(ev: CalendarEvent): string {
  return ev.eventMeetingType === 'meet' ? COK.primary : COK.success;
}

function formatTimeRange(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return '';
  const fmt: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const start = new Date(startIso).toLocaleTimeString([], fmt);
  const end = new Date(endIso).toLocaleTimeString([], fmt);
  return `${start} - ${end}`;
}

function isHappeningNow(ev: CalendarEvent): boolean {
  if (ev.isCancelled) return false;
  if (ev.eventStatus === 'live') return true;
  if (!ev.startTime || !ev.endTime) return false;
  const now = Date.now();
  return new Date(ev.startTime).getTime() <= now && now <= new Date(ev.endTime).getTime();
}

// An event scheduled for today (happening today) also gets the animated frame
function isHappeningToday(ev: CalendarEvent): boolean {
  if (ev.isCancelled) return false;
  if (isHappeningNow(ev)) return true;
  if (!ev.startTime) return false;
  const d = new Date(ev.startTime);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function EventsCalendar({
  events,
  loading,
  year,
  month,
  onMonthChange,
  onEventClick,
}: {
  events: CalendarEvent[];
  loading: boolean;
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const monthStart = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (monthStart.getDay() + 6) % 7;

  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;

  const eventsByDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!ev.startTime) continue;
      const d = new Date(ev.startTime);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const day = d.getDate();
      if (!map[day]) map[day] = [];
      map[day].push(ev);
    }
    return map;
  }, [events, year, month]);

  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const goTo = (delta: number) => {
    setExpandedDay(null);
    const d = new Date(year, month + delta, 1);
    onMonthChange(d.getFullYear(), d.getMonth());
  };

  return (
    <div className="bg-white p-4 relative" style={{ border: `1px solid ${COK.border}` }}>
      {loading && <LoadingOverlay />}

      <div className="flex items-center justify-between mb-4">
        <h3
          style={{ fontFamily: COK.headingFont, fontSize: 15, fontWeight: 600, color: COK.neutralDark, margin: 0 }}
        >
          Events Calendar
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goTo(-1)}
            aria-label="Previous month"
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-50"
            style={{ border: `1px solid ${COK.border}` }}
          >
            <FiChevronLeft className="w-4 h-4" style={{ color: COK.neutralDark }} />
          </button>
          <span
            className="min-w-36 text-center"
            style={{ fontFamily: COK.headingFont, fontSize: 14, fontWeight: 600, color: COK.primary }}
          >
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={() => goTo(1)}
            aria-label="Next month"
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-50"
            style={{ border: `1px solid ${COK.border}` }}
          >
            <FiChevronRight className="w-4 h-4" style={{ color: COK.neutralDark }} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COK.success }} />
          <span className="text-xs text-gray-500">Events</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COK.primary }} />
          <span className="text-xs text-gray-500">Meetings</span>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center py-2 uppercase"
            style={{
              fontFamily: COK.headingFont,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.5px',
              color: COK.tertiary,
              borderBottom: `1px solid ${COK.border}`,
            }}
          >
            {d}
          </div>
        ))}

        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="min-h-24" style={{ borderBottom: `1px solid ${COK.neutralLight}` }} />;
          }
          const dayEvents = eventsByDay[day] || [];
          const isToday = isCurrentMonth && day === now.getDate();
          const isExpanded = expandedDay === day;
          const visibleEvents = isExpanded ? dayEvents : dayEvents.slice(0, 2);
          const remaining = dayEvents.length - 2;
          const hasHappeningEvent = dayEvents.some(isHappeningToday);
          return (
            <div
              key={day}
              className={`min-h-24 p-1 align-top ${hasHappeningEvent ? 'cok-live-event-frame' : ''}`}
              style={{ borderBottom: `1px solid ${COK.neutralLight}` }}
            >
              <span
                className="inline-flex items-center justify-center w-6 h-6 text-xs"
                style={{
                  fontFamily: COK.headingFont,
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? '#FFFFFF' : COK.neutralDark,
                  backgroundColor: isToday ? COK.primary : undefined,
                  borderRadius: '9999px',
                }}
              >
                {day}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {visibleEvents.map((ev, i) => (
                  <button
                    key={(ev.eventSpecialId || i) + (ev.occurrenceDate || '')}
                    type="button"
                    onClick={() => onEventClick(ev)}
                    className="w-full text-left px-1 py-0.5 text-[10px] leading-tight hover:opacity-80 transition-opacity"
                    style={{
                      borderLeft: `2px solid ${eventAccent(ev)}`,
                      backgroundColor: `${eventAccent(ev)}14`,
                      color: COK.neutralDark,
                      cursor: 'pointer',
                    }}
                    title={`${ev.eventName}\n${formatTimeRange(ev.startTime, ev.endTime)}\n${ev.eventRoom || ''}`}
                  >
                    <span className="block truncate" style={{ fontWeight: 600 }}>{ev.eventName}</span>
                    <span className="flex items-center gap-1 opacity-80 text-[9px]">
                      <FiClock className="w-2 h-2 shrink-0" />
                      <span className="truncate">{formatTimeRange(ev.startTime, ev.endTime)}</span>
                    </span>
                  </button>
                ))}
                {!isExpanded && remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedDay(day)}
                    className="text-[10px] px-1 hover:underline"
                    style={{ color: COK.primary, fontFamily: COK.headingFont, fontWeight: 600 }}
                  >
                    +{remaining} more
                  </button>
                )}
                {isExpanded && dayEvents.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setExpandedDay(null)}
                    className="text-[10px] px-1 hover:underline"
                    style={{ color: COK.primary, fontFamily: COK.headingFont, fontWeight: 600 }}
                  >
                    Show less
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== Page ====================

export default function MayorEventsPage() {
  const {
    dateRange,
    setDateRange,
    taskStatus,
    calendarEvents,
    loadingStats,
    loadingCalendar,
    fetchCalendar,
  } = useDashboard();

  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Reconstruct each event's true start/end from its per-day calendar slices.
  // Recurring occurrences share an eventSpecialId across different dates, so
  // they are excluded and keep their own occurrence times.
  const mergedWindows = useMemo(() => {
    const map: Record<string, { start?: string; end?: string }> = {};
    for (const ev of (calendarEvents || []) as CalendarEvent[]) {
      if (!ev.eventSpecialId || ev.occurrenceDate || ev.eventStatus === 'recurring') continue;
      if (!ev.startTime || !ev.endTime) continue;
      const w = map[ev.eventSpecialId] || (map[ev.eventSpecialId] = {});
      if (!w.start || ev.startTime < w.start) w.start = ev.startTime;
      if (!w.end || ev.endTime > w.end) w.end = ev.endTime;
    }
    return map;
  }, [calendarEvents]);

  const handleMonthChange = useCallback(
    (year: number, month: number) => {
      setCalendarYear(year);
      setCalendarMonth(month);
      fetchCalendar(year, month);
    },
    [fetchCalendar]
  );

  const handleRefresh = () => {
    fetchCalendar(calendarYear, calendarMonth);
  };

  return (
    <MainLayout>
      <div className="p-4 space-y-4" style={{ backgroundColor: COK.neutralLight, minHeight: '100%' }}>
        <div>
          <h1
            style={{ fontFamily: COK.headingFont, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: COK.primary, margin: 0 }}
          >
            Events
          </h1>
          <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: COK.bodyFont, margin: '4px 0 0 0' }}>
            City events overview and calendar
          </p>
        </div>

        <EventsFilterBar
          dateRange={dateRange}
          onChange={setDateRange}
          onRefresh={handleRefresh}
          loading={loadingStats}
        />

        <EventsTaskStatusChart data={taskStatus} loading={loadingStats} />

        <EventsCalendar
          events={calendarEvents || []}
          loading={loadingCalendar}
          year={calendarYear}
          month={calendarMonth}
          onMonthChange={handleMonthChange}
          onEventClick={setSelectedEvent}
        />
      </div>

      {selectedEvent && (
        <MayorEventDetailsOverlay
          event={selectedEvent}
          window={(selectedEvent.eventSpecialId && mergedWindows[selectedEvent.eventSpecialId]) || {}}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </MainLayout>
  );
}
