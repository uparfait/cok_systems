import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight, FiMapPin, FiClock, FiLoader } from 'react-icons/fi';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getEventColor(event) {
  if (event.eventMeetingType === 'meet') return 'bg-blue-50 border-blue-200 text-blue-700';
  return 'bg-emerald-50 border-emerald-200 text-emerald-700';
}

function getEventDotColor(event) {
  if (event.eventMeetingType === 'meet') return 'bg-blue-500';
  return 'bg-emerald-500';
}

function formatTimeRange(startIso, endIso) {
  if (!startIso || !endIso) return '';
  const fmt = { hour: '2-digit', minute: '2-digit' };
  const start = new Date(startIso).toLocaleTimeString([], fmt);
  const end = new Date(endIso).toLocaleTimeString([], fmt);
  return `${start} - ${end}`;
}

export default function DashboardCalendar({ events, loading, onMonthChange, currentYear, currentMonth }) {
  const navigate = useNavigate();
  const [internalYear, setInternalYear] = useState(currentYear || new Date().getFullYear());
  const [internalMonth, setInternalMonth] = useState(currentMonth || new Date().getMonth());
  const [expandedDay, setExpandedDay] = useState(null);

  const year = currentYear ?? internalYear;
  const month = currentMonth ?? internalMonth;

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const daysInMonth = monthEnd.getDate();

  const now = new Date();
  const currentDay = now.getDate();
  const currentMonthIndex = now.getMonth();
  const currentYearVal = now.getFullYear();

  const offset = ((monthStart.getDay() + 6) % 7);

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of events) {
      const dateKey = ev.startTime ? new Date(ev.startTime).toISOString().split('T')[0] : null;
      if (!dateKey) continue;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(ev);
    }
    return map;
  }, [events]);

  const days = [];
  for (let i = 0; i < offset; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  const goToPrevMonth = () => {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    setInternalMonth(newMonth);
    setInternalYear(newYear);
    onMonthChange?.(newYear, newMonth);
  };

  const goToNextMonth = () => {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setInternalMonth(newMonth);
    setInternalYear(newYear);
    onMonthChange?.(newYear, newMonth);
  };

  const handleEventClick = (ev) => {
    if (ev.eventSpecialId) {
      navigate(`/event-manager/events/${ev.eventSpecialId}/details`);
    }
  };

  const isCurrentMonth = year === currentYearVal && month === currentMonthIndex;
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white border border-gray-200 flex flex-col">
      <div className="flex items-center justify-between p-4 bg-blue-600">
        <h3 className="text-sm font-semibold text-white">Calendar</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevMonth}
            className="p-1.5 border border-blue-500 hover:bg-blue-700 text-white transition-colors"
            aria-label="Previous month"
          >
            <FiChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-white min-w-[160px] text-center">{monthName}</span>
          <button
            onClick={goToNextMonth}
            className="p-1.5 border border-blue-500 hover:bg-blue-700 text-white transition-colors"
            aria-label="Next month"
          >
            <FiChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-gray-600 border-r border-gray-100 last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {loading && events.length === 0 ? (
        <div className="flex-1 min-h-[300px] flex items-center justify-center">
          <FiLoader className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-7 flex-1">
          {days.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="min-h-[80px] sm:min-h-[100px] md:min-h-[120px] border-r border-b border-gray-100 bg-gray-50/50" />;
            }

            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = eventsByDate[dateKey] || [];
            const isToday = isCurrentMonth && day === currentDay;
            const isExpanded = expandedDay === day;
            const visibleEvents = isExpanded ? dayEvents : dayEvents.slice(0, 2);
            const remaining = dayEvents.length - 2;

            return (
              <div
                key={day}
                className={`min-h-[80px] sm:min-h-[100px] md:min-h-[120px] border-r border-b border-gray-100 p-1 sm:p-1.5 md:p-2 last:border-r-0 ${isToday ? 'bg-blue-50/40' : ''}`}
              >
                <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                  {day}
                </div>
                <div className="space-y-1">
                  {visibleEvents.map((ev) => {
                    const isLive = ev.eventStatus === 'live';
                    const timeRange = formatTimeRange(ev.startTime, ev.endTime);
                    return (
                      <button
                        key={ev._id + (ev.occurrenceDate || '')}
                        onClick={() => handleEventClick(ev)}
                        className={`w-full text-left text-[10px] sm:text-[11px] leading-tight px-1 sm:px-1.5 py-0.5 sm:py-1 border ${getEventColor(ev)}`}
                        title={`${ev.eventName}\n${timeRange}\n${ev.eventRoom}`}
                      >
                        <div className="flex items-center gap-1">
                          <span className="truncate font-medium">{ev.eventName}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] sm:text-[10px] opacity-80 mt-0.5">
                          <FiClock className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0" />
                          <span className="truncate">{timeRange}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] sm:text-[10px] opacity-80 hidden sm:flex">
                          <FiMapPin className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0" />
                          <span className="truncate">{ev.eventRoom}</span>
                        </div>
                      </button>
                    );
                  })}
                  {!isExpanded && remaining > 0 && (
                    <button
                      onClick={() => setExpandedDay(day)}
                      className="text-[10px] sm:text-[11px] text-gray-500 hover:text-gray-700 px-1 sm:px-1.5 font-medium"
                    >
                      +{remaining} more
                    </button>
                  )}
                  {isExpanded && dayEvents.length > 2 && (
                    <button
                      onClick={() => setExpandedDay(null)}
                      className="text-[10px] sm:text-[11px] text-gray-500 hover:text-gray-700 px-1 sm:px-1.5 font-medium"
                    >
                      Show less
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loading && events.length > 0 && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center pointer-events-none">
          <FiLoader className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      )}
    </div>
  );
}
