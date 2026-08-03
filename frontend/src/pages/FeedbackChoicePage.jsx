import { useNavigate } from "react-router-dom";

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const NEUTRAL_DARK = "#333333";
const NEUTRAL_LIGHT = "#F7F9FB";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const fontHeading = "'Montserrat', sans-serif";

const cardStyle = {
  backgroundColor: WHITE,
  border: `1px solid ${BORDER}`,
  borderRadius: 0,
};

const optionBase = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "16px 20px",
  borderRadius: 0,
  border: `1px solid ${BORDER}`,
  backgroundColor: WHITE,
  fontFamily: fontHeading,
  cursor: "pointer",
  transition: "border-color 0.2s ease, background-color 0.2s ease",
};

export default function FeedbackChoicePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex w-full items-center justify-center px-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      <div className="cok-auth-card p-8 sm:p-10 max-w-2xl w-full" style={cardStyle}>
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-1" style={{ color: PRIMARY, fontFamily: fontHeading, letterSpacing: "-0.5px" }}>
          Submit Feedback
        </h1>
        <p className="text-sm" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
          How would you like to submit your feedback?
        </p>
        <p className="text-xs mb-6" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
          Choose the option that matches your situation
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate("/feedback/service")}
            style={optionBase}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = PRIMARY; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
          >
            <div className="flex items-start gap-3">
              <span className="text-sm font-bold" style={{ color: PRIMARY, fontFamily: fontHeading }}>I Received a Service</span>
              <div className="mt-0.5">
                <p className="text-sm" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                  I visited a department and want to rate the service I received.
                </p>
                <p className="text-xs" style={{ color: PRIMARY, fontFamily: fontHeading }}>Requires phone verification</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate("/feedback/general")}
            style={optionBase}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = PRIMARY; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
          >
            <div className="flex items-start gap-3">
              <span className="text-sm font-bold" style={{ color: PRIMARY, fontFamily: fontHeading }}>General Feedback</span>
              <div className="mt-0.5">
                <p className="text-sm" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                  No service required. Share your experience &amp; suggestion.
                </p>
                <p className="text-xs" style={{ color: PRIMARY, fontFamily: fontHeading }}>Skip phone verification, rate and send</p>
              </div>
            </div>
          </button>
        </div>

        <p className="text-[10px] font-semibold uppercase tracking-wide mt-6" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
          Step 1: Choose feedback type
        </p>
      </div>
    </div>
  );
}
