import { FiCalendar } from 'react-icons/fi';

const PRIMARY = '#056daa';
const SUCCESS = '#4CAF50';
const WARNING = '#F39C12';
const DANGER = '#E74C3C';
const GRAY_DISABLED = '#9E9E9E';
const fontHeading = "'Montserrat', sans-serif";

const badgeColors = {
  live: SUCCESS,
  upcoming: PRIMARY,
  recurring: WARNING,
  past: GRAY_DISABLED,
};

export default function EventDetailHeader({ event, eventMode }) {
  return (
    <div className="px-4 sm:px-6 py-5 text-white" style={{ backgroundColor: PRIMARY }}>
      <div className="max-w-5xl mx-auto flex items-center gap-3">
        <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
          <FiCalendar className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-extrabold leading-tight truncate" style={{ fontFamily: fontHeading, letterSpacing: '-0.5px' }}>
            {event.eventName}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ backgroundColor: badgeColors[eventMode] || GRAY_DISABLED, fontFamily: fontHeading }}>
              {eventMode.charAt(0).toUpperCase() + eventMode.slice(1)}
            </span>
            {event.isCancelled && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ backgroundColor: DANGER, fontFamily: fontHeading }}>
                Cancelled
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
