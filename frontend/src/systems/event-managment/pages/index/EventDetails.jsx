import { useState, useEffect, useCallback } from "react";
import { useOutletContext, useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
// Helper: Eye-friendly soft pastel colors
const generateColorFromName = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${hash % 360}, 50%, 82%)`;
};

// Helper: Formats ISO timestamps cleanly for human eyes
const formatEventTimes = (start, end) => {
  if (!start || !end) return "";
  const options = { hour: "2-digit", minute: "2-digit" };
  const startTime = new Date(start).toLocaleTimeString([], options);
  const endTime = new Date(end).toLocaleTimeString([], options);
  return `${startTime} – ${endTime}`;
};

// Helper: High-precision real-time remaining countdown or setup track time
const calculateCountdown = (targetTime) => {
  const totalMs = new Date(targetTime).getTime() - new Date().getTime();
  if (totalMs <= 0) return "00:00:00";

  const seconds = Math.floor((totalMs / 1000) % 60);
  const minutes = Math.floor((totalMs / 1000 / 60) % 60);
  const hours = Math.floor((totalMs / (1000 * 60 * 60)));

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export default function EventDetails() {
  const context = useOutletContext();
  // Safe extraction of values from your parent Outlet context system
  const contextActiveEvent = context?.activeEvent;
  const setActiveEvent = context?.setActiveEvent;
  const setLiveEventsData = context?.setLiveEventsData;

  const { id: eventSpecialId } = useParams();
  const navigate = useNavigate();

  // Unified component operational states
  const [localEvent, setLocalEvent] = useState(null);
  const [isEventLoading, setIsEventLoading] = useState(false);
  const [isEventNotFound, setIsEventNotFound] = useState(false);

  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [ActualQrCodeUrl, setActualQrCodeUrl] = useState(null);
  const [isQrLoading, setIsQrLoading] = useState(true);
  const [qrError, setQrError] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [isQrMaximized, setIsQrMaximized] = useState(false);
  const [showCopiedPopup, setShowCopiedPopup] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState(0);

  // Compute the effectively loaded event metadata targeting layout details safely
  const activeEvent = contextActiveEvent || localEvent;

  // Evaluation of Event Phase Status
  const now = new Date();
  const isUpcoming = activeEvent && (!activeEvent.startedAt || new Date(activeEvent.willStartAt) > now);

  // Fetch Fallback Event Data matching specified API template setup
  useEffect(() => {
    async function fallbackFetchEvent() {
        
      if (!eventSpecialId) return;
      
      // If active event already matches current route, use it directly
      if (contextActiveEvent && contextActiveEvent.eventSpecialId === eventSpecialId) {
        setLocalEvent(contextActiveEvent);
        setIsEventNotFound(false);
        return;
      }

      try {
        setIsEventLoading(true);
        setIsEventNotFound(false);
        
        const response = await axios.get("/cok/api/v1/events/live", {
          params: {
            page: 1,
            limit: 20,
            search: eventSpecialId,
            searchField: "eventSpecialId",
          }
        });

        if (response.data && response.data.success && response.data.data.length > 0) {
          const fetchedEvent = response.data.data[0];
          setLocalEvent(fetchedEvent);
          
          // Keep parent state synced if setters are present
          if (setActiveEvent) setActiveEvent(fetchedEvent);
          if (setLiveEventsData) setLiveEventsData(response.data.data);
        } else {
          setIsEventNotFound(true);
        }
      } catch (error) {
        console.error("Error direct-fetching live event:", error);
        setIsEventNotFound(true);
      } finally {
        setIsEventLoading(false);
      }
    }

    fallbackFetchEvent();
  }, [eventSpecialId, contextActiveEvent, setActiveEvent, setLiveEventsData]);

  // Network Fetching Operation for QR Code (Isolated & Retryable)
  const fetchQrCode = useCallback(async (eventId, signal) => {
    setIsQrLoading(true);
    setQrError(false);
    try {
      const response = await axios.get(`/cok/api/v1/events/${eventId}/qrcode`, { signal });
      if (response.data?.success) {
        setQrCodeUrl(response.data.data.qrCodeDataUrl);
        setActualQrCodeUrl(response.data.data.attendanceUrl);
      } else {
        setQrError(true);
      }
    } catch (error) {
      if (!axios.isCancel(error)) {
        console.error("QR Fetch Error:", error);
        setQrError(true);
      }
    } finally {
      setIsQrLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeEvent || isUpcoming || !activeEvent._id) return;
    
    const abortController = new AbortController();
    fetchQrCode(activeEvent._id, abortController.signal);

    return () => abortController.abort();
  }, [activeEvent, isUpcoming, fetchQrCode]);

  // Fetch real attendance count — polls every 5s for live updates
  useEffect(() => {
    if (!activeEvent?.eventSpecialId || isUpcoming) return;
    const fetchCount = () =>
      axios
        .get('/cok/api/v1/attendance', { params: { eventSpecialId: activeEvent.eventSpecialId, limit: 1, _t: Date.now() } })
        .then((res) => setAttendeeCount(res.data?.totalRecords ?? 0))
        .catch(() => {});
    fetchCount();
    const timer = setInterval(fetchCount, 5000);
    return () => clearInterval(timer);
  }, [activeEvent?.eventSpecialId, isUpcoming]);

  // Dynamic Realtime Countdown Engine Switch
  useEffect(() => {
    if (!activeEvent) return;

    const targetTime = isUpcoming ? activeEvent.willStartAt : activeEvent.willEndAt;
    
    setCountdown(calculateCountdown(targetTime));
    const clockInterval = setInterval(() => {
      setCountdown(calculateCountdown(targetTime));
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [activeEvent, isUpcoming]);

  // Render Full-Screen Page Skeletons while fetching active event 
  if (isEventLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center p-6 bg-zinc-50 rounded-none">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 animate-pulse rounded-none">
          <div className="lg:col-span-7 space-y-4 rounded-none">
            <div className="h-10 bg-zinc-200 w-2/3 rounded-none" />
            <div className="h-6 bg-zinc-200 w-1/3 rounded-none" />
            <div className="h-6 bg-zinc-200 w-1/4 rounded-none" />
            <div className="h-64 bg-zinc-200 w-full rounded-none" />
          </div>
          <div className="lg:col-span-5 space-y-5 rounded-none">
            <div className="aspect-square bg-zinc-200 w-full rounded-none" />
            <div className="h-12 bg-zinc-200 w-full rounded-none" />
            <div className="h-16 bg-zinc-200 w-full rounded-none" />
          </div>
        </div>
      </div>
    );
  }

  // Render Event Not Found View state cleanly if endpoint falls blank
if (isEventNotFound || (!isEventLoading && !activeEvent)) {
  return (
    <div className="w-full min-h-[90%] flex flex-col gap-3 items-center justify-center p-6 text-center rounded-none">
      <div className="max-w-md p-8 gap-y-6 text-center flex flex-col items-center rounded-none">
        <div className="w-[300px] h-[300px] flex items-center justify-center mb-4 rounded-none">
          {/* SVG illustration */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160">
            <ellipse cx="100" cy="140" rx="80" ry="15" fill="#e0e0e0" />
            <polygon points="30,40 30,120 70,120" fill="#1a1a1a" />
            <rect x="70" y="40" width="100" height="80" rx="4" fill="#ffffff" stroke="#000000" strokeWidth="2" />
            <rect x="70" y="30" width="100" height="15" rx="4" fill="#007bff" />
            <circle cx="85" cy="37" r="3" fill="#000000" />
            <circle cx="105" cy="37" r="3" fill="#000000" />
            <circle cx="125" cy="37" r="3" fill="#000000" />
            <g fill="#66b2ff">
              <rect x="80" y="50" width="20" height="20" />
              <rect x="105" y="50" width="20" height="20" />
              <rect x="130" y="50" width="20" height="20" />
              <rect x="80" y="75" width="20" height="20" />
              <rect x="105" y="75" width="20" height="20" />
              <rect x="130" y="75" width="20" height="20" />
              <rect x="80" y="100" width="20" height="20" />
              <rect x="105" y="100" width="20" height="20" />
              <rect x="130" y="100" width="20" height="20" />
            </g>
            <circle cx="150" cy="85" r="18" fill="#007bff" stroke="#000000" strokeWidth="2" />
            <rect x="165" y="95" width="25" height="6" rx="3" fill="#000000" transform="rotate(30 165 95)" />
            <circle cx="45" cy="60" r="15" fill="#007bff" />
            <line x1="38" y1="53" x2="52" y2="67" stroke="#ffffff" strokeWidth="3" />
            <line x1="52" y1="53" x2="38" y2="67" stroke="#ffffff" strokeWidth="3" />
          </svg>
        </div>
        <p className="text-sm text-zinc-500 mb-6 rounded-none">
          The event specified could not be loaded or is no longer live.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2.5 bg-blue-500 text-white font-medium text-sm rounded-none hover:bg-blue-600 transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}


  const brandColor = generateColorFromName(activeEvent?.eventName || "Event");

  return (
    <div className="w-full min-h-screen flex justify-center rounded-none">
      <motion.div
        className="relative w-full max-w-5xl h-max overflow-hidden p-6 md:p-8 rounded-none"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Background Accent Canvas Gradient Blur */}
        <div 
          className="absolute inset-0 z-0 pointer-events-none opacity-10 rounded-none" 
          style={{ background: `radial-gradient(circle at 70% 30%, ${brandColor} 0%, rgba(255,255,255,0) 70%)` }}
        />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start rounded-none">

          {/* ── LEFT COLUMN (7/12) ── */}
          <div className="lg:col-span-7 flex flex-col gap-4 rounded-none">

            {/* Info card — bordered, matching screenshot */}
            <div className=" p-5 flex flex-col gap-3">
              {/* Title */}
              <div className="inline-block px-3 py-1.5 bg-zinc-100 max-w-max rounded-none">
                <h1 className="text-lg font-bold text-zinc-900 truncate rounded-none">
                  {activeEvent?.eventName}
                </h1>
              </div>

              {/* Room */}
              <div className="inline-block px-3 py-1 bg-zinc-100 max-w-max rounded-none">
                <span className="text-sm font-semibold font-mono text-indigo-600 rounded-none">
                  {activeEvent?.eventRoom}
                </span>
              </div>

              {/* Time */}
              <div className="inline-block px-3 py-1 bg-zinc-100 max-w-max rounded-none">
                <span className="text-xs font-medium text-zinc-600 tracking-wide rounded-none">
                  {formatEventTimes(activeEvent?.startedAt || activeEvent?.willStartAt, activeEvent?.willEndAt)}
                </span>
              </div>

              {/* About */}
              <div className="pt-2 rounded-none">
                <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-2 rounded-none">About Event</h3>
                <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line break-all rounded-none">
                  {activeEvent?.eventDescription}
                </p>
              </div>
            </div>

            {/* Three action buttons stacked below the card */}
            <div className="flex flex-col gap-2 rounded-none">
              <Link
                to={`/event/${activeEvent.eventSpecialId}/attendees`}
                className="w-full flex items-center justify-between px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 group rounded-none"
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6zM3 20v-2a3 3 0 013-3" />
                  </svg>
                  <span className="text-sm font-semibold tracking-wide">View Attendance</span>
                </div>
                <svg className="w-4 h-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              {/* Record Minutes and Designate buttons in parallel */}
              <div className="flex flex-row gap-2">
                <Link
                  to={`/event/${activeEvent.eventSpecialId}/editor`}
                  className="flex-1 flex items-center justify-between px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 group rounded-none"
                >
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="text-sm font-semibold tracking-wide">Record Minutes</span>
                  </div>
                  <svg className="w-4 h-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                
                <Link
                  to={`/event/${activeEvent.eventSpecialId}/designate`}
                  className="flex-1 flex items-center justify-between px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors duration-200 group rounded-none"
                >
                  <div className="flex items-center gap-2.5">
<svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14v7m-3 0h6" />
                     </svg>
                    <span className="text-sm font-semibold tracking-wide">Designate</span>
                  </div>
                  <svg className="w-4 h-4 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              <button
                onClick={() => navigate(`/event/${eventSpecialId}/actions`)}
                className="w-full flex items-center justify-between px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 group rounded-none"
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span className="text-sm font-semibold tracking-wide">Event Actions</span>
                </div>
                <svg className="w-4 h-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── RIGHT COLUMN (5/12) ── */}
          <div className="lg:col-span-5 flex flex-col gap-0 rounded-none">

            {/* Countdown at the very top */}
            <div className="bg-blue-600 flex flex-col items-center justify-center py-4 px-6 rounded-none">
              <span className="text-[10px] uppercase font-bold tracking-widest text-white mb-1 rounded-none">
                {isUpcoming ? "Time Remaining Until Event Starts" : "Time Remaining"}
              </span>
              <div className="text-3xl font-black font-mono text-white tracking-widest rounded-none">
                {countdown || "00:00:00"}
              </div>
            </div>

            {/* QR code fills the rest */}
            <div className="w-full bg-white border border-zinc-200 overflow-hidden flex flex-col items-center justify-center p-4 relative rounded-none" style={{ minHeight: '360px' }}>
              <AnimatePresence mode="wait">
                {isUpcoming ? (
                  <motion.div
                    key="upcoming"
                    className="text-center p-4 flex flex-col items-center rounded-none"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  >
                    <div className="w-12 h-12 bg-amber-50 border border-amber-200 flex items-center justify-center mb-3 rounded-none">
                      <span className="text-amber-600 text-xl font-bold">!</span>
                    </div>
                    <p className="text-sm font-semibold text-zinc-800 rounded-none">No QR Code</p>
                    <p className="text-xs text-zinc-500 mt-1 rounded-none">Event Has Not Started.</p>
                  </motion.div>
                ) : isQrLoading ? (
                  <motion.div
                    key="loading"
                    className="w-4/5 h-64 bg-zinc-200/80 animate-pulse rounded-none"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  />
                ) : qrError ? (
                  <motion.div
                    key="error"
                    className="text-center p-4 flex flex-col items-center rounded-none"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  >
                    <p className="text-sm font-medium text-zinc-700 mb-3 rounded-none">Failed to display QR Code</p>
                    <button
                      onClick={() => fetchQrCode(activeEvent?._id)}
                      className="px-4 py-2 bg-zinc-900 text-white text-xs font-medium tracking-wide shadow-sm hover:bg-zinc-800 transition-colors rounded-none"
                    >
                      Try Again
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="qr-interactive"
                    className="w-full cursor-zoom-in rounded-none"
                    onClick={() => setIsQrMaximized(true)}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {!isQrLoading && (
                      <img
                        src={qrCodeUrl || ""}
                        alt=""
                        className="w-full object-contain rounded-none"
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Total Attendees */}
            <div className="p-3 bg-zinc-100 border border-t-0 border-zinc-200 flex items-center justify-between px-4 rounded-none">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider rounded-none">Total Attendees</span>
              <span className="text-base font-bold text-zinc-900 font-mono rounded-none">{attendeeCount}</span>
            </div>
          </div>

        </div>
      </motion.div>


      {/* FULL SCREEN MODAL PORTAL MATCHING MOCKUP */}
      <AnimatePresence>
        {isQrMaximized && !isUpcoming && qrCodeUrl && (
          <motion.div 
            className="fixed inset-0 z-[99999] bg-white flex flex-col rounded-none select-none overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Upper Work Area: Container holding the close button and the main QR display */}
            <div className="flex-1 w-full relative flex items-center justify-center p-6 md:p-12">
              
              {/* Tactile Close Action Icon positioned exactly at top right */}
              <button
                onClick={() => setIsQrMaximized(false)}
                className="absolute top-4 right-4 md:top-8 md:right-8 text-blue-500 hover:text-blue-600 transition-colors rounded-none focus:outline-none"
                aria-label="Close Preview"
              >
                <svg className="w-10 h-10 md:w-12 md:h-12" fill="none" stroke="currentColor" strokeWidth="4.5" viewBox="0 0 24 24">
                  <path strokeLinecap="square" strokeLinejoin="miter" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* QR Image Frame expanding dynamically to consume overall center viewport area */}
              <div className="w-[50vw] min-w-[300px] relative h-[75vh] flex items-center justify-center rounded-none">
                <img 
                  src={qrCodeUrl} 
                  alt="QRCode full image" 
                  className="w-full h-full object-contain rounded-none p-2"
                />
              </div>
            </div>

            {/* Lower Header Bar Content Block displaying Total Attendees status layout */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 pb-8 pt-2 px-4 rounded-none relative">
              <div className="bg-zinc-200 text-zinc-900 px-6 py-4 text-center w-full sm:w-auto min-w-0 sm:min-w-[280px] md:min-w-[400px] border border-zinc-300 rounded-none">
                <span className="text-xl md:text-2xl font-semibold tracking-wide font-sans rounded-none">
                  Total Attendees: {attendeeCount}
                </span>
              </div>
              
              <div className="relative w-full sm:w-auto">
                <button 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-4 text-center w-full sm:w-auto min-w-0 sm:min-w-[280px] md:min-w-[400px] border border-blue-700 rounded-none transition-colors" 
                  onClick={() => {
                    const actualUrl = ActualQrCodeUrl;
                    if (actualUrl) {
                      navigator.clipboard.writeText(actualUrl).then(() => {
                        setShowCopiedPopup(true);
                        setTimeout(() => {
                          setShowCopiedPopup(false);
                        }, 2000);
                      });
                    }
                  }}
                >
                  COPY LINK URL
                </button>

                {/* Timed Popup Tooltip Indicator */}
                <AnimatePresence>
                  {showCopiedPopup && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, x: "-50%" }}
                      animate={{ opacity: 1, y: 0, x: "-50%" }}
                      exit={{ opacity: 0, y: 10, x: "-50%" }}
                      className="absolute left-1/2 -top-12 bg-zinc-900 text-white text-xs font-bold px-3 py-1.5 rounded-none shadow-md pointer-events-none whitespace-nowrap z-50"
                    >
                      Copied to Clipboard!
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
          </motion.div>
        )}
      </AnimatePresence>
       
    </div>
  );
}