import { FiCalendar, FiClock } from 'react-icons/fi';

const PRIMARY = '#056daa';
const DANGER = '#E74C3C';
const NEUTRAL_DARK = '#333333';
const fontHeading = "'Montserrat', sans-serif";

const inputClass = 'w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base';
const selectClass = 'w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base';

const labelStyle = {
  fontFamily: fontHeading, fontSize: '13px', fontWeight: 600,
  letterSpacing: '0.5px', lineHeight: '1.4', display: 'block',
  color: NEUTRAL_DARK, textTransform: 'uppercase', marginBottom: '8px',
};

export default function EventTimeFields({ eventMode, formData, recurringType, monthlyPattern, onChange, onRecurringTypeChange, onMonthlyPatternChange }) {
  const getToday = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
  };

  if (!eventMode) return null;

  return (
    <div className="flex flex-col gap-3 pt-2">
      <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>Event Time</h2>

      {(eventMode === 'live' || eventMode === 'upcoming') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="eventDate" style={labelStyle}>Date <span style={{ color: DANGER }}>*</span></label>
            <div className="relative">
              <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="date" id="eventDate" value={formData.eventDate}
                onChange={(e) => onChange('eventDate', e.target.value)} required
                min={eventMode === 'upcoming' ? getToday() : undefined}
                className={inputClass} />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="fromTime" style={labelStyle}>From <span style={{ color: DANGER }}>*</span></label>
            <div className="relative">
              <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="time" id="fromTime" value={formData.fromTime}
                onChange={(e) => onChange('fromTime', e.target.value)} required
                className={inputClass} />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="toTime" style={labelStyle}>To <span style={{ color: DANGER }}>*</span></label>
            <div className="relative">
              <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="time" id="toTime" value={formData.toTime}
                onChange={(e) => onChange('toTime', e.target.value)} required
                min={formData.fromTime || undefined}
                className={inputClass} />
            </div>
          </div>
        </div>
      )}

      {eventMode === 'recurring' && (
        <>
          <div className="space-y-2">
            <label htmlFor="recurringType" style={labelStyle}>Recurring Type <span style={{ color: DANGER }}>*</span></label>
            <select id="recurringType" value={recurringType}
              onChange={(e) => onRecurringTypeChange(e.target.value)} required className={selectClass}>
              <option value="">Select type</option>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="eventStartDate" style={labelStyle}>Start Date <span style={{ color: DANGER }}>*</span></label>
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" id="eventStartDate" value={formData.eventStartDate}
                  onChange={(e) => onChange('eventStartDate', e.target.value)} required className={inputClass} />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="recurringEndDate" style={labelStyle}>End Date <span style={{ color: DANGER }}>*</span></label>
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" id="recurringEndDate" value={formData.recurringEndDate}
                  onChange={(e) => onChange('recurringEndDate', e.target.value)} required className={inputClass} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="eventStartTime" style={labelStyle}>Start Time <span style={{ color: DANGER }}>*</span></label>
              <div className="relative">
                <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="time" id="eventStartTime" value={formData.eventStartTime}
                  onChange={(e) => onChange('eventStartTime', e.target.value)} required className={inputClass} />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="eventEndTime" style={labelStyle}>End Time <span style={{ color: DANGER }}>*</span></label>
              <div className="relative">
                <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="time" id="eventEndTime" value={formData.eventEndTime}
                  onChange={(e) => onChange('eventEndTime', e.target.value)} required className={inputClass} />
              </div>
            </div>
          </div>
          {recurringType === 'Weekly' && <WeeklyDaysSelector days={formData.weeklyDays} onChange={onChange} />}
          {recurringType === 'Monthly' && (
            <MonthlyPatternFields monthlyPattern={monthlyPattern} monthlyDates={formData.monthlyDates}
              onPatternChange={onMonthlyPatternChange} onChange={onChange} />
          )}
        </>
      )}
    </div>
  );
}

function WeeklyDaysSelector({ days, onChange }) {
  return (
    <div className="space-y-2">
      <label style={labelStyle}>Days of Week <span style={{ color: DANGER }}>*</span></label>
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
          <label key={i} className="flex items-center justify-center gap-1 p-2 border border-gray-200 ppp-lg hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={days.includes(i)} value={i}
              onChange={(e) => {
                const newDays = e.target.checked ? [...days, i] : days.filter(d => d !== i);
                onChange('weeklyDays', newDays);
              }}
              className="w-4 h-4 border-gray-300 ppp" style={{ accentColor: PRIMARY }} />
            <span className="text-xs text-gray-700">{day}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function MonthlyPatternFields({ monthlyPattern, monthlyDates, onPatternChange, onChange }) {
  return (
    <>
      <div className="space-y-2">
        <label style={labelStyle}>Monthly Pattern</label>
        <select value={monthlyPattern} onChange={(e) => onPatternChange(e.target.value)}
          className={selectClass}>
          <option value="specific">Specific Dates</option>
          <option value="firstDay">First Day of Month</option>
          <option value="lastDay">Last Day of Month</option>
          <option value="firstTwoWeeks">First Two Weeks</option>
          <option value="lastTwoWeeks">Last Two Weeks</option>
          <option value="mixed">Mixed</option>
        </select>
      </div>
      {(monthlyPattern === 'specific' || monthlyPattern === 'mixed') && (
        <div className="space-y-2">
          <label style={labelStyle}>
            Monthly Dates (comma-separated, 1-31) <span style={{ color: DANGER }}>*</span>
          </label>
          <input type="text" value={monthlyDates}
            onChange={(e) => onChange('monthlyDates', e.target.value)}
            placeholder="1,15,30"
            className={inputClass} />
        </div>
      )}
    </>
  );
}