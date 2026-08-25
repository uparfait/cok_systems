import { FiUsers } from 'react-icons/fi';

const PRIMARY = '#056daa';
const DANGER = '#E74C3C';
const NEUTRAL_DARK = '#333333';
const fontHeading = "'Montserrat', sans-serif";

const inputClass = 'w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base';

const labelStyle = {
  fontFamily: fontHeading, fontSize: '13px', fontWeight: 600,
  letterSpacing: '0.5px', lineHeight: '1.4', display: 'block',
  color: NEUTRAL_DARK, textTransform: 'uppercase', marginBottom: '8px',
};

export default function OrganizerFields({ eventMeetingType, formData, onChange }) {
  const displayType = eventMeetingType === 'meet' ? 'Meeting' : 'Event';
  return (
    <div className="flex flex-col gap-4 pt-2">
      <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY, fontFamily: fontHeading }}>{displayType} Organizer</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="eventOrganizer" style={labelStyle}>
            Full Names <span style={{ color: DANGER }}>*</span>
          </label>
          <div className="relative">
            <FiUsers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              id="eventOrganizer"
              value={formData.eventOrganizer}
              onChange={(e) => onChange('eventOrganizer', e.target.value)}
              required
              placeholder="First & Last Names"
              className={inputClass}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="organizerInstitution" style={labelStyle}>
            Institution / Unit
          </label>
          <input
            type="text"
            id="organizerInstitution"
            value={formData.organizerInstitution}
            onChange={(e) => onChange('organizerInstitution', e.target.value)}
            placeholder="e.g. a department or a unit (Optional)"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="organizerEmail" style={labelStyle}>
            Email <span style={{ color: DANGER }}>*</span>
          </label>
          <input
            type="email"
            id="organizerEmail"
            value={formData.organizerEmail}
            onChange={(e) => onChange('organizerEmail', e.target.value)}
            required
            placeholder="name@domain.com"
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="organizerPhone" style={labelStyle}>
            Contact Phone <span style={{ color: DANGER }}>*</span>
          </label>
          <input
            type="tel"
            id="organizerPhone"
            value={formData.organizerPhone}
            onChange={(e) => onChange('organizerPhone', e.target.value)}
            required
            placeholder="+250 7XX XXX XXX"
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}