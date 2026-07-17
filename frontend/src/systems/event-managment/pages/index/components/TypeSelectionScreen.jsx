import { FiCalendar, FiUsers, FiArrowRight } from "react-icons/fi";
import DashboardCalendar from "../../dashboard/components/DashboardCalendar";

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#388E3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";

const fontHeading = "'Montserrat', sans-serif";

function TypeSelectionScreen({ onOpenCalendar, showCalendar, calendarEvents, calendarLoading, calendarYear, calendarMonth, onMonthChange, onCloseCalendar, onNavigate }) {
  return (
    <>
      {showCalendar && (
        <div className="fixed inset-0 bg-white z-[9999] flex flex-col">
          <div className="flex items-center justify-between p-4" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: WHITE }}>
            <h2 className="text-base font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Scheduled Events</h2>
            <button onClick={onCloseCalendar} className="p-1 transition-colors" style={{ color: PRIMARY }} aria-label="Close calendar">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="min-w-[700px]">
              <DashboardCalendar events={calendarEvents} loading={calendarLoading}
                onMonthChange={onMonthChange} currentYear={calendarYear} currentMonth={calendarMonth} colorMode="eventType" compact />
            </div>
          </div>
        </div>
      )}
      
      <div className="min-h-screen w-full flex flex-col items-center justify-start pt-20 px-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10">
            <button onClick={onOpenCalendar}
              className="text-xs font-semibold uppercase tracking-wide text-white px-5 py-3 transition-colors flex items-center gap-1.5 mx-auto"
              style={{ backgroundColor: PRIMARY, fontFamily: fontHeading, border: '0', borderRadius: 0 }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = PRIMARY_HOVER}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = PRIMARY}>
              <FiCalendar className="w-3.5 h-3.5" /> View Scheduled Events
            </button>
            <h1 className="pt-6 text-3xl sm:text-4xl font-extrabold" style={{ color: PRIMARY, fontFamily: fontHeading, letterSpacing: '-0.5px', margin: '0 0 12px 0' }}>
              What Would You Like To Book?
            </h1>
            <p className="text-sm font-medium" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Select a booking type to get started.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <button onClick={() => onNavigate("/book-a-room/new/event")}
              className="group relative p-6 sm:p-10 text-left transition-all duration-200"
              style={{ backgroundColor: NEUTRAL_LIGHT, boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)', border: '0', borderRadius: 0, cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 12px 48px 0 rgba(0,0,0,0.12)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 8px 40px 0 rgba(0,0,0,0.08)'}>
              <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center mb-4 sm:mb-5 transition-colors duration-200" style={{ backgroundColor: 'rgba(7,142,206,0.08)' }}>
                <FiCalendar className="w-6 h-6 sm:w-7 sm:h-7 transition-colors duration-200" style={{ color: PRIMARY }} />
              </div>
              <h2 className="text-lg sm:text-xl font-bold mb-2" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Event</h2>
              <p className="text-sm leading-relaxed mb-4" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                Book a room for an event with full scheduling capabilities.</p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-sm" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                  <span className="w-1.5 h-1.5 inline-block" style={{ backgroundColor: PRIMARY }} /> Event scheduling &amp; room booking</li>
                <li className="flex items-center gap-2 text-sm" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                  <span className="w-1.5 h-1.5 inline-block" style={{ backgroundColor: PRIMARY }} /> QR code attendance tracking</li>
              </ul>
              <div className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wide" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                Book Event <FiArrowRight className="w-4 h-4" /></div>
            </button>
            <button onClick={() => onNavigate("/book-a-room/new/meet")}
              className="group relative p-6 sm:p-10 text-left transition-all duration-200"
              style={{ backgroundColor: NEUTRAL_LIGHT, boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)', border: '0', borderRadius: 0, cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 12px 48px 0 rgba(0,0,0,0.12)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 8px 40px 0 rgba(0,0,0,0.08)'}>
              <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center mb-4 sm:mb-5 transition-colors duration-200" style={{ backgroundColor: 'rgba(76,175,80,0.08)' }}>
                <FiUsers className="w-6 h-6 sm:w-7 sm:h-7 transition-colors duration-200" style={{ color: SUCCESS }} />
              </div>
              <h2 className="text-lg sm:text-xl font-bold mb-2" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Meet</h2>
              <p className="text-sm leading-relaxed mb-4" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                Book a room for a meeting with agenda planning.</p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-sm" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                  <span className="w-1.5 h-1.5 inline-block" style={{ backgroundColor: SUCCESS }} /> Meeting scheduling &amp; room booking</li>
                <li className="flex items-center gap-2 text-sm" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                  <span className="w-1.5 h-1.5 inline-block" style={{ backgroundColor: SUCCESS }} /> Activity agenda planning</li>
                <li className="flex items-center gap-2 text-sm" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                  <span className="w-1.5 h-1.5 inline-block" style={{ backgroundColor: SUCCESS }} /> Action items &amp; follow-ups</li>
              </ul>
              <div className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wide" style={{ color: SUCCESS, fontFamily: fontHeading }}>
                Book Meet <FiArrowRight className="w-4 h-4" /></div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default TypeSelectionScreen;
