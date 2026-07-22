import { useState, useCallback, useMemo } from 'react';
import {
  FiCalendar,
  FiClipboard,
  FiXCircle,
  FiLoader,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiX,
} from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { useDashboard } from '../../event-managment/pages/dashboard/hooks/useDashboard';

// City of Kigali design rule palette (see desegin_rule.html)
const COK = {
  primary: '#34A8DB',
  success: '#4CAF50',
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
  eventOrganizer?: { fullNames?: string; email?: string; telephone?: string };
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
      color: COK.tertiary,
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

// ==================== Summary Cards ====================

const SUMMARY_CARDS = [
  { key: 'totalEventsHeld', label: 'Total Events Held', icon: FiCalendar, accent: COK.primary },
  { key: 'totalMeetingsHeld', label: 'Total Meetings Held', icon: FiClipboard, accent: COK.success },
  { key: 'totalEventsCanceled', label: 'Events Canceled', icon: FiXCircle, accent: COK.danger },
  { key: 'totalMeetingsCanceled', label: 'Meetings Canceled', icon: FiXCircle, accent: COK.warning },
];

function EventsSummaryCards({ summary, loading }: { summary: Record<string, number> | null; loading: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {SUMMARY_CARDS.map((card) => {
        const Icon = card.icon;
        const value = summary ? summary[card.key] ?? 0 : 0;
        return (
          <div
            key={card.key}
            className="bg-white p-4 relative transition-shadow duration-200 hover:shadow-md"
            style={{ border: `1px solid ${COK.border}` }}
          >
            {loading && <LoadingOverlay />}
            <div className="flex items-center justify-between" style={{ borderLeft: `2px solid ${card.accent}`, paddingLeft: 10 }}>
              <div>
                <CokLabel>{card.label}</CokLabel>
                <p
                  className="mt-1"
                  style={{ fontFamily: COK.headingFont, fontSize: 28, fontWeight: 700, color: COK.neutralDark, margin: 0 }}
                >
                  {value.toLocaleString()}
                </p>
              </div>
              <div
                className="w-11 h-11 flex items-center justify-center"
                style={{ backgroundColor: `${card.accent}1A` }}
              >
                <Icon className="w-5 h-5" style={{ color: card.accent }} />
              </div>
            </div>
          </div>
        );
      })}
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

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  live: { label: 'Happening Now', color: COK.success },
  upcoming: { label: 'Upcoming', color: COK.primary },
  recurring: { label: 'Recurring', color: COK.warning },
  past: { label: 'Completed', color: '#9E9E9E' },
};

function EventDetailsModal({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const live = isHappeningNow(event);
  const badge = event.isCancelled
    ? { label: 'Cancelled', color: COK.danger }
    : live
      ? STATUS_BADGES.live
      : STATUS_BADGES[event.eventStatus || ''] || { label: 'Scheduled', color: COK.primary };

  const startDate = event.startTime
    ? new Date(event.startTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'Not set';

  const detailRows: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Date', value: startDate },
    { label: 'Time', value: formatTimeRange(event.startTime, event.endTime) || 'Not set' },
    { label: 'Room / Venue', value: event.eventRoom || 'Not specified' },
    { label: 'Type', value: `${event.eventMeetingType === 'meet' ? 'Meeting' : 'Event'}${event.eventType ? ` · ${event.eventType}` : ''}` },
  ];
  if (event.eventOrganizer?.fullNames) {
    detailRows.push({
      label: 'Organizer',
      value: `${event.eventOrganizer.fullNames}${event.eventOrganizer.email ? ` (${event.eventOrganizer.email})` : ''}`,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(51,51,51,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-lg"
        style={{ border: `1px solid ${COK.border}` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Event details"
      >
        <div
          className="flex items-start justify-between p-4"
          style={{ borderBottom: `1px solid ${COK.border}` }}
        >
          <div>
            <span
              className="inline-block px-2 py-0.5 text-white uppercase"
              style={{
                backgroundColor: badge.color,
                fontFamily: COK.headingFont,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.5px',
              }}
            >
              {badge.label}
            </span>
            <h3
              className="mt-2"
              style={{ fontFamily: COK.headingFont, fontSize: 19, fontWeight: 700, color: COK.neutralDark, margin: '8px 0 0 0' }}
            >
              {event.eventName}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 shrink-0"
            style={{ border: `1px solid ${COK.border}` }}
          >
            <FiX className="w-4 h-4" style={{ color: COK.neutralDark }} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {detailRows.map((row) => (
            <div key={row.label}>
              <CokLabel>{row.label}</CokLabel>
              <p className="text-sm mt-0.5" style={{ fontFamily: COK.bodyFont, color: '#555555', margin: '2px 0 0 0' }}>
                {row.value}
              </p>
            </div>
          ))}
          {event.eventDescription && (
            <div>
              <CokLabel>Description</CokLabel>
              <p className="text-sm mt-0.5" style={{ fontFamily: COK.bodyFont, color: '#555555', margin: '2px 0 0 0' }}>
                {event.eventDescription}
              </p>
            </div>
          )}
        </div>

        <div
          className="px-4 py-3 text-xs text-gray-400"
          style={{ borderTop: `1px solid ${COK.border}`, fontFamily: COK.bodyFont }}
        >
         Event Information Managed by the Event Manager's office.
        </div>
      </div>
    </div>
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
          return (
            <div
              key={day}
              className="min-h-24 p-1 align-top"
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
                {visibleEvents.map((ev, i) => {
                  const live = isHappeningToday(ev);
                  const chip = (
                    <button
                      type="button"
                      onClick={() => onEventClick(ev)}
                      className="w-full text-left px-1 py-0.5 text-[10px] leading-tight hover:opacity-80 transition-opacity"
                      style={{
                        borderLeft: `2px solid ${eventAccent(ev)}`,
                        backgroundColor: live ? '#FFFFFF' : `${eventAccent(ev)}14`,
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
                  );
                  return live ? (
                    <div key={(ev.eventSpecialId || i) + (ev.occurrenceDate || '')} className="cok-live-event-frame">
                      {chip}
                    </div>
                  ) : (
                    <div key={(ev.eventSpecialId || i) + (ev.occurrenceDate || '')}>{chip}</div>
                  );
                })}
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
    summary,
    taskStatus,
    calendarEvents,
    loadingStats,
    loadingCalendar,
    fetchCalendar,
  } = useDashboard();

  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

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

        <EventsSummaryCards summary={summary} loading={loadingStats} />

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
        <EventDetailsModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </MainLayout>
  );
}
