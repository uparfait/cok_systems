import { FiCalendar, FiClock } from 'react-icons/fi';

const inputClass = 'w-full px-4 py-2.5 border border-gray-300 ppp-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200';
const labelClass = 'block text-xs font-semibold text-gray-700 mb-2';
const selectClass = 'w-full px-4 py-2.5 border border-gray-300 ppp-lg text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 bg-white';

export default function EventTimeFields({ eventMode, formData, recurringType, monthlyPattern, onChange, onRecurringTypeChange, onMonthlyPatternChange }) {
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  if (!eventMode) return null;

  return (
    <div className="flex flex-col gap-3 pt-2">
      <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Event Time</h2>

      {eventMode === 'live' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="startedAt" className={labelClass}>Start Time <span className="text-red-500">*</span></label>
            <div className="relative">
              <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="datetime-local" id="startedAt" value={formData.startedAt}
                onChange={(e) => onChange('startedAt', e.target.value)} required min={getMinDateTime()}
                className={`${inputClass} pl-10`} />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="willEndAt" className={labelClass}>End Time <span className="text-red-500">*</span></label>
            <div className="relative">
              <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="datetime-local" id="willEndAt" value={formData.willEndAt}
                onChange={(e) => onChange('willEndAt', e.target.value)} required
                min={formData.startedAt || getMinDateTime()} className={`${inputClass} pl-10`} />
            </div>
          </div>
        </div>
      )}

      {eventMode === 'upcoming' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="willStartAt" className={labelClass}>Start Time <span className="text-red-500">*</span></label>
            <div className="relative">
              <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="datetime-local" id="willStartAt" value={formData.willStartAt}
                onChange={(e) => onChange('willStartAt', e.target.value)} required min={getMinDateTime()}
                className={`${inputClass} pl-10`} />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="willEndAt" className={labelClass}>End Time <span className="text-red-500">*</span></label>
            <div className="relative">
              <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="datetime-local" id="willEndAt" value={formData.willEndAt}
                onChange={(e) => onChange('willEndAt', e.target.value)} required
                min={formData.willStartAt || getMinDateTime()} className={`${inputClass} pl-10`} />
            </div>
          </div>
        </div>
      )}

      {eventMode === 'recurring' && (
        <>
          <div className="space-y-2">
            <label htmlFor="recurringType" className={labelClass}>Recurring Type <span className="text-red-500">*</span></label>
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
              <label htmlFor="eventStartDate" className={labelClass}>Start Date <span className="text-red-500">*</span></label>
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" id="eventStartDate" value={formData.eventStartDate}
                  onChange={(e) => onChange('eventStartDate', e.target.value)} required className={`${inputClass} pl-10`} />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="recurringEndDate" className={labelClass}>End Date <span className="text-red-500">*</span></label>
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" id="recurringEndDate" value={formData.recurringEndDate}
                  onChange={(e) => onChange('recurringEndDate', e.target.value)} required className={`${inputClass} pl-10`} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="eventStartTime" className={labelClass}>Start Time <span className="text-red-500">*</span></label>
              <div className="relative">
                <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="time" id="eventStartTime" value={formData.eventStartTime}
                  onChange={(e) => onChange('eventStartTime', e.target.value)} required className={`${inputClass} pl-10`} />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="eventEndTime" className={labelClass}>End Time <span className="text-red-500">*</span></label>
              <div className="relative">
                <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="time" id="eventEndTime" value={formData.eventEndTime}
                  onChange={(e) => onChange('eventEndTime', e.target.value)} required className={`${inputClass} pl-10`} />
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
      <label className="block text-xs font-semibold text-gray-700 mb-2">Days of Week <span className="text-red-500">*</span></label>
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
          <label key={i} className="flex items-center justify-center gap-1 p-2 border border-gray-200 ppp-lg hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={days.includes(i)} value={i}
              onChange={(e) => {
                const newDays = e.target.checked ? [...days, i] : days.filter(d => d !== i);
                onChange('weeklyDays', newDays);
              }}
              className="w-4 h-4 text-blue-600 border-gray-300 ppp focus:ring-blue-500" />
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
        <label className="block text-xs font-semibold text-gray-700 mb-2">Monthly Pattern</label>
        <select value={monthlyPattern} onChange={(e) => onPatternChange(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 ppp-lg text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200">
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
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Monthly Dates (comma-separated, 1-31) <span className="text-red-500">*</span>
          </label>
          <input type="text" value={monthlyDates}
            onChange={(e) => onChange('monthlyDates', e.target.value)}
            placeholder="1,15,30"
            className="w-full px-4 py-2.5 border border-gray-300 ppp-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200" />
        </div>
      )}
    </>
  );
}