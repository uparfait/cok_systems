import { FiType, FiFileText, FiUsers } from 'react-icons/fi';

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
        <label htmlFor="eventMode" style={labelStyle}>
          {type} Mode <span style={{ color: DANGER }}>*</span>
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
          <label htmlFor="eventName" style={labelStyle}>
            {type} Name <span style={{ color: DANGER }}>*</span>
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
              className={inputClass}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="eventType" style={labelStyle}>
            {type} Type <span style={{ color: DANGER }}>*</span>
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
        <label htmlFor="eventDescription" style={labelStyle}>
          Description <span style={{ color: DANGER }}>*</span>
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
            className={inputClass}
            style={{ resize: 'vertical', minHeight: '80px' }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="expectedAudience" style={labelStyle}>
            Expected Audience <span style={{ color: DANGER }}>*</span>
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
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </>
  );
}