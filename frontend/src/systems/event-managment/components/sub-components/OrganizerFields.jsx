import { FiUsers } from 'react-icons/fi';

const inputClass = 'w-full px-4 py-2.5 border border-gray-300 ppp-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200';
const labelClass = 'block text-xs font-semibold text-gray-700 mb-2';

export default function OrganizerFields({ eventMeetingType, formData, onChange }) {
  const displayType = eventMeetingType === 'meet' ? 'Meet' : 'Event';
  return (
    <div className="flex flex-col gap-4 pt-2">
      <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">{displayType} Organizer</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="eventOrganizer" className={labelClass}>
            Full Names <span className="text-red-500">*</span>
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
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="organizerInstitution" className={labelClass}>
            Institution / Organization
          </label>
          <input
            type="text"
            id="organizerInstitution"
            value={formData.organizerInstitution}
            onChange={(e) => onChange('organizerInstitution', e.target.value)}
            placeholder="External workspace title (Optional)"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="organizerEmail" className={labelClass}>
            Email <span className="text-red-500">*</span>
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
          <label htmlFor="organizerPhone" className={labelClass}>
            Contact Phone <span className="text-red-500">*</span>
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