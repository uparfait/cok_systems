const PRIMARY = "#056daa";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";

const fontHeading = "'Montserrat', sans-serif";

function formatDateAMPM(date) {
  if (!date) return '';
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = months[d.getMonth()];
  const day = d.getDate();
  const y = d.getFullYear();
  let h = d.getHours();
  const min = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${m} ${day}, ${y} ${h}:${min} ${ampm}`;
}

function SuccessScreen({ trackingCode, eventName, room, startTime, endTime }) {
  return (
    <div className="min-h-screen flex w-full items-center justify-center px-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      <div className="p-8 sm:p-12 max-w-lg w-full text-center space-y-8" style={{ backgroundColor: WHITE, boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)', border: `1px solid ${BORDER}`, borderRadius: 0 }}>
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold" style={{ color: PRIMARY, fontFamily: fontHeading, margin: 0, letterSpacing: '-0.5px' }}>Request Submitted!</h1>
          <p className="text-base sm:text-lg leading-relaxed" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading, margin: 0 }}>
            Your booking request for <span style={{ color: PRIMARY, fontWeight: 600 }}>{eventName}</span> has been submitted successfully.
          </p>
        </div>

        <div className="flex flex-col gap-6 text-left">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Tracking Code</span>
            <span className="mt-2 block font-mono font-bold text-2xl" style={{ color: PRIMARY, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>{trackingCode}</span>
          </div>

          {startTime && endTime && (
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>When</span>
              <span className="mt-2 block text-2xl" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{formatDateAMPM(startTime)} - {formatDateAMPM(endTime)}</span>
            </div>
          )}

          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Location</span>
            <span className="mt-2 block text-2xl" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{room}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SuccessScreen;
