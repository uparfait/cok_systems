import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import SpiralLoader from "../../components/SpiralLoader";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";
const BORDER = "#E0E0E0";
const NEUTRAL_DARK = "#333333";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";

export default function QrFullPage({ eventSpecialId, accessToken }) {
  const { id: routeEventId } = useParams();
  const navigate = useNavigate();
  const resolvedEventId = eventSpecialId || routeEventId;

  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [attendanceUrl, setAttendanceUrl] = useState(null);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!resolvedEventId) return;
    let alive = true;
    setLoading(true);
    setError(false);

    const headers = accessToken ? { 'x-event-access-token': accessToken } : {};

    axios.get(`/cok/api/v1/events/${resolvedEventId}/qrcode`, { headers })
      .then((res) => {
        if (alive && res.data?.success) {
          setQrCodeUrl(res.data.data.qrCodeDataUrl);
          setAttendanceUrl(res.data.data.attendanceUrl);
        } else if (alive) {
          setError(true);
        }
      })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });

    const fetchCount = () =>
      axios.get('/cok/api/v1/attendance', { params: { eventSpecialId: resolvedEventId, limit: 1, _t: Date.now() }, headers })
        .then((res) => setAttendeeCount(res.data?.totalRecords ?? 0))
        .catch(() => {});

    fetchCount();
    const timer = setInterval(fetchCount, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [resolvedEventId, accessToken]);

  const handleCopy = () => {
    if (attendanceUrl) {
      navigator.clipboard.writeText(attendanceUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center" style={{ paddingTop: '80px', backgroundColor: '#F7F9FB' }}>
      <div className="w-full max-w-2xl px-3 sm:px-6 md:px-8 py-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-base sm:text-lg font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
            QR Code
          </h1>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="cok-btn-outlined"
            style={{ padding: '0.4rem 0.8rem' }}
          >
            Back
          </button>
        </div>

        <div className="bg-white border flex flex-col items-center justify-center p-6" style={{ borderColor: BORDER, minHeight: '400px' }}>
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <SpiralLoader color={PRIMARY} />
              <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Loading QR Code...</p>
            </div>
          ) : error || !qrCodeUrl ? (
            <div className="text-center py-10">
              <p className="text-sm font-medium text-zinc-700 mb-3">Failed to display QR Code</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-white text-xs font-medium tracking-wide"
                style={{ backgroundColor: '#333333', fontFamily: fontHeading }}
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-6">
              <img
                src={qrCodeUrl}
                alt="QR Code"
                className="w-full max-w-sm object-contain"
              />
              <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="text-zinc-900 px-6 py-4 text-center w-full sm:w-auto min-w-0 sm:min-w-[280px] border border-zinc-300" style={{ backgroundColor: "#E0E0E0" }}>
                  <span className="text-xl font-semibold tracking-wide" style={{ fontFamily: fontHeading }}>
                    Total Attendees: {attendeeCount}
                  </span>
                </div>
                <div className="relative w-full sm:w-auto">
                  <button
                    className="text-white font-bold px-6 py-4 text-center w-full sm:w-auto min-w-0 sm:min-w-[280px] border transition-colors"
                    style={{ backgroundColor: PRIMARY, borderColor: PRIMARY, fontFamily: fontHeading }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#248fc2"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                    onClick={handleCopy}
                  >
                    COPY LINK URL
                  </button>
                  {copied && (
                    <div className="absolute left-1/2 -top-12 bg-zinc-900 text-white text-xs font-bold px-3 py-1.5 shadow-md pointer-events-none whitespace-nowrap z-50" style={{ fontFamily: fontHeading, transform: 'translateX(-50%)' }}>
                      Copied to Clipboard!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
