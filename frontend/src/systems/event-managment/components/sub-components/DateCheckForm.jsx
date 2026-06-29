import { FiSearch, FiCalendar, FiClock } from 'react-icons/fi';

const inputClass = 'w-full px-4 py-2.5 border border-gray-300 ppp-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200';
const labelClass = 'block text-xs font-semibold text-gray-700 mb-2';
const selectClass = 'w-full px-4 py-2.5 border border-gray-300 ppp-lg text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 bg-white';

const WEEK_DAYS = [
  { value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
];

export default function DateCheckForm({
  eventMode, setEventMode,
  formData, handleChange,
  recurringType, setRecurringType,
  monthlyPattern, setMonthlyPattern,
  weeklyDays, toggleWeeklyDay,
  monthlyDates, setMonthlyDates,
  handleSubmit, isValid, getMinDateTime,
}) {
  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 ppp-lg p-6 space-y-5">
      {/* Mode Selection */}
      <div className="space-y-2">
        <label className={labelClass}>
          Event Mode <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {['live', 'upcoming', 'recurring'].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setEventMode(mode);
                if (mode !== 'recurring') {
                  setRecurringType('');
                }
              }}
              className={`px-4 py-3 ppp-lg text-sm font-medium border-2 transition-all duration-200 capitalize ${
                eventMode === mode
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Date/Time Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="startTime" className={labelClass}>
            Start Date & Time <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="datetime-local" id="startTime"
              value={formData.startTime}
              onChange={(e) => handleChange('startTime', e.target.value)}
              required min={getMinDateTime()}
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="endTime" className={labelClass}>
            End Date & Time <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="datetime-local" id="endTime"
              value={formData.endTime}
              onChange={(e) => handleChange('endTime', e.target.value)}
              required min={formData.startTime || getMinDateTime()}
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>
      </div>

      {/* Recurring Fields */}
      {eventMode === 'recurring' && (
        <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 ppp-lg">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Recurring Configuration</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={labelClass}>Recurring Type</label>
              <select value={recurringType} onChange={(e) => setRecurringType(e.target.value)} className={selectClass}>
                <option value="">Select type</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Recurring End Date</label>
              <input type="date" value={formData.recurringEndDate} onChange={(e) => handleChange('recurringEndDate', e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={labelClass}>Daily Start Time</label>
              <input type="time" value={formData.eventStartTime} onChange={(e) => handleChange('eventStartTime', e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Daily End Time</label>
              <input type="time" value={formData.eventEndTime} onChange={(e) => handleChange('eventEndTime', e.target.value)} className={inputClass} />
            </div>
          </div>

          {recurringType === 'Weekly' && (
            <div className="space-y-2">
              <label className={labelClass}>Select Days</label>
              <div className="flex gap-2 flex-wrap">
                {WEEK_DAYS.map((day) => (
                  <button key={day.value} type="button" onClick={() => toggleWeeklyDay(day.value)}
                    className={`px-3 py-2 ppp-lg text-xs font-medium border transition-all duration-200 ${
                      weeklyDays.includes(day.value) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {recurringType === 'Monthly' && (
            <div className="space-y-2">
              <label className={labelClass}>Monthly Pattern</label>
              <select value={monthlyPattern} onChange={(e) => setMonthlyPattern(e.target.value)} className={selectClass}>
                <option value="specific">Specific Dates</option>
                <option value="firstDay">First Day</option>
                <option value="lastDay">Last Day</option>
                <option value="firstTwoWeeks">First Two Weeks</option>
                <option value="lastTwoWeeks">Last Two Weeks</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
          )}

          {(monthlyPattern === 'specific' || monthlyPattern === 'mixed') && recurringType === 'Monthly' && (
            <div className="space-y-2">
              <label className={labelClass}>Dates (comma-separated, e.g. 1,15)</label>
              <input type="text" value={monthlyDates} onChange={(e) => setMonthlyDates(e.target.value)} placeholder="e.g. 1,15" className={inputClass} />
            </div>
          )}
        </div>
      )}

      <button type="submit" disabled={!isValid()}
        className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium ppp-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 inline-flex items-center justify-center gap-2 shadow-sm"
      >
        <FiSearch className="w-4 h-4" />
        Check All Rooms
      </button>
    </form>
  );
}