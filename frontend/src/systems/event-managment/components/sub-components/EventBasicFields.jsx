import { FiType, FiFileText, FiUsers } from 'react-icons/fi';

const inputClass = 'w-full px-4 py-2.5 border border-gray-300 ppp-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200';
const labelClass = 'block text-xs font-semibold text-gray-700 mb-2';
const selectClass = 'w-full px-4 py-2.5 border border-gray-300 ppp-lg text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 bg-white';

export default function EventBasicFields({ eventMeetingType, eventMode, formData, onEventModeChange, onChange }) {
  const type = eventMeetingType === 'meet' ? 'Meet' : 'Event';
  const typeLower = type.toLowerCase();

  const EVENT_TYPES = [
    { value: 'Internal', label: `Internal ${type}` },
    { value: 'Joint', label: `Joint ${type}` },
    { value: 'External', label: `External ${type}` },
  ];

  return (
    <>
      <div className="space-y-2">
        <label htmlFor="eventMode" className={labelClass}>
          {type} Mode <span className="text-red-500">*</span>
        </label>
        <select
          id="eventMode"
          value={eventMode}
          onChange={(e) => onEventModeChange(e.target.value)}
          required
          className={selectClass}
        >
          <option value="">Select mode</option>
          <option value="live">Live {type}</option>
          <option value="upcoming">Upcoming {type}</option>
          <option value="recurring">Recurring {type}</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="eventName" className={labelClass}>
            {type} Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FiType className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              id="eventName"
              value={formData.eventName}
              onChange={(e) => onChange('eventName', e.target.value)}
              required
              placeholder={`Enter ${typeLower} title`}
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="eventType" className={labelClass}>
            {type} Type <span className="text-red-500">*</span>
          </label>
          <select
            id="eventType"
            value={formData.eventType}
            onChange={(e) => onChange('eventType', e.target.value)}
            required
            className={selectClass}
          >
            <option value="">Select {typeLower} type</option>
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="eventDescription" className={labelClass}>
          Description <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <FiFileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <textarea
            id="eventDescription"
            value={formData.eventDescription}
            onChange={(e) => onChange('eventDescription', e.target.value)}
            required
            rows="3"
            placeholder="Outline core requirements or high-level strategic summaries..."
            className={`${inputClass} pl-10 resize-y min-h-[80px]`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="expectedAudience" className={labelClass}>
            Expected Audience <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FiUsers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="number"
              id="expectedAudience"
              value={formData.expectedAudience || ''}
              onChange={(e) => onChange('expectedAudience', e.target.value ? parseInt(e.target.value) : '')}
              required
              min="1"
              placeholder="Total expected attendees"
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>
      </div>
    </>
  );
}