import { FiCheckCircle } from "react-icons/fi";

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";

const fontHeading = "'Montserrat', sans-serif";

function SuccessScreen({ trackingCode, eventName, organizerNames, room, onNavigate }) {
  return (
    <div className="min-h-screen flex w-full items-center justify-center px-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      <div className="p-8 sm:p-10 max-w-sm w-full text-center space-y-4" style={{ backgroundColor: NEUTRAL_LIGHT, boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)', border: '0', borderRadius: 0 }}>
        <div className="w-16 h-16 flex items-center justify-center mx-auto" style={{ backgroundColor: '#E8F5E9' }}>
          <FiCheckCircle className="w-8 h-8" style={{ color: SUCCESS }} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: PRIMARY, fontFamily: fontHeading, margin: '0 0 12px 0', letterSpacing: '-0.5px' }}>Request Submitted!</h1>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: '#555555', fontFamily: fontHeading }}>
            Your booking request for <span className="font-semibold" style={{ color: NEUTRAL_DARK }}>{eventName}</span> has been submitted successfully.</p>
        </div>
        <div className="p-4 text-left text-xs space-y-2" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0 }}>
          <p style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}><span className="font-semibold uppercase text-[11px] tracking-wide" style={{ color: TERTIARY }}>Tracking Code</span> <br /><span className="font-mono font-bold text-sm" style={{ color: PRIMARY }}>{trackingCode}</span></p>
          <p style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}><span className="font-semibold uppercase text-[11px] tracking-wide" style={{ color: TERTIARY }}>Organizer</span> <br />{organizerNames}</p>
          <p style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}><span className="font-semibold uppercase text-[11px] tracking-wide" style={{ color: TERTIARY }}>Room</span> <br />{room}</p>
        </div>
        <p className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Save your tracking code to check the status later.</p>
        <button onClick={() => onNavigate(`/book-a-room/track?code=${trackingCode}`)}
          className="text-sm cursor-pointer font-semibold uppercase tracking-wide w-full py-3 transition-colors"
          style={{ color: WHITE, backgroundColor: PRIMARY, fontFamily: fontHeading, border: '0', borderRadius: 0 }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = PRIMARY_HOVER}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = PRIMARY}>
          Track This Booking</button>
      </div>
    </div>
  );
}

export default SuccessScreen;
