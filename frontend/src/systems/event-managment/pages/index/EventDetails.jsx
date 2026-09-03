import { useState, useEffect, useCallback } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import EventAccessOverlay from "./components/EventAccessOverlay";
import EventDetailsLeftColumn from "./components/EventDetailsLeftColumn";
import EventDetailsRightColumn from "./components/EventDetailsRightColumn";
import EventDetailsQrModal from "./components/EventDetailsQrModal";
import EventMinutesView from "./components/EventMinutesView";
import CoOrganizersPanel from "./components/CoOrganizersPanel";
import EventAgendaSection from "../../components/sub-components/EventAgendaSection";
import AttendeesList from "./AttendeesList";
import DesignateMinutes from "./DesignateMinutes";
import EventActionsPage from "./EventActionsPage";
import ShowEditor from "./components/ShowEditor";
import { FiX } from "react-icons/fi";
import { Helmet } from "react-helmet-async";

const SECTION_TITLES = {
  attendees: "Attendance",
  designate: "Designate Minutes Taker",
  actions: "Event Actions (Follow ups)",
};

function SectionOverlay({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-white overflow-y-auto" style={{ zIndex: 100000000 }}>
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3" style={{ backgroundColor: PRIMARY }}>
        <p className="text-sm font-bold text-white truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="cok-btn-outlined-reverse"
          style={{ padding: "0.4rem 0.8rem" }}
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

const generateColorFromName = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${hash % 360}, 50%, 82%)`;
};

const calculateCountdown = (targetTime) => {
  const totalMs = new Date(targetTime).getTime() - new Date().getTime();
  if (totalMs <= 0) return "00:00:00";
  const seconds = Math.floor((totalMs / 1000) % 60);
  const minutes = Math.floor((totalMs / 1000 / 60) % 60);
  const hours = Math.floor((totalMs / (1000 * 60 * 60)));
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const PRIMARY = "#056daa";

export default function EventDetails({ overlayEventId = null, onCloseOverlay = null, bypassAccess = false }) {
  const context = useOutletContext();
  const contextActiveEvent = overlayEventId ? null : context?.activeEvent;
  const setActiveEvent = overlayEventId ? null : context?.setActiveEvent;
  const setLiveEventsData = overlayEventId ? null : context?.setLiveEventsData;
  const { id: routeEventId } = useParams();
  const eventSpecialId = overlayEventId || routeEventId;
  const navigate = useNavigate();

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
  const [accessToken, setAccessToken] = useState("");
  const [isAccessVerified, setIsAccessVerified] = useState(false);
  const [showAccessOverlay, setShowAccessOverlay] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [activeSection, setActiveSection] = useState(null);

  // Hash-based navigation: map hash to section
  const SECTION_HASH_MAP = {
    "view-attendance": "attendees",
    "minutes": "editor",
    "designate": "designate",
    "event-actions-follow-ups": "actions",
  };

  // Handle hash changes to show appropriate section
  useEffect(() => {
    const hash = window.location.hash.replace(/^#\//, '').replace(/^#/, '');
    if (hash && SECTION_HASH_MAP[hash]) {
      setActiveSection(SECTION_HASH_MAP[hash]);
    }
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\//, '').replace(/^#/, '');
      if (!hash) {
        setActiveSection(null);
        setIsQrMaximized(false);
      } else if (SECTION_HASH_MAP[hash]) {
        setActiveSection(SECTION_HASH_MAP[hash]);
        setIsQrMaximized(false);
      } else if (hash === "qrcode-full") {
        setIsQrMaximized(true);
        setActiveSection(null);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const activeEvent = contextActiveEvent || localEvent;
  const now = new Date();
  const isEnded = !!activeEvent && (
    !!activeEvent.endedAt ||
    (activeEvent.willEndAt && new Date(activeEvent.willEndAt) < now)
  );
  const isUpcoming = !isEnded && activeEvent && (!activeEvent.startedAt || new Date(activeEvent.willStartAt) > now);

  useEffect(() => {
    if (bypassAccess) {
      setIsAccessVerified(true);
      setIsCheckingAccess(false);
      return;
    }
    if (!eventSpecialId) {
      setIsCheckingAccess(false);
      return;
    }
    const stored = localStorage.getItem(`event_access_${eventSpecialId}`);
    if (stored) {
      setIsVerifying(true);
      axios.post('/cok/api/v1/event-access/validate', {}, {
        headers: { 'x-event-access-token': stored },
      })
      .then((res) => {
        if (res.data?.success) {
          setAccessToken(stored);
          setIsAccessVerified(true);
        } else {
          localStorage.removeItem(`event_access_${eventSpecialId}`);
          navigate('/', { replace: true });
        }
      })
      .catch(() => {
        localStorage.removeItem(`event_access_${eventSpecialId}`);
        navigate('/', { replace: true });
      })
      .finally(() => {
        setIsVerifying(false);
        setIsCheckingAccess(false);
      });
    } else {
      navigate('/', { replace: true });
      setIsCheckingAccess(false);
    }
  }, [eventSpecialId, navigate, bypassAccess]);

  useEffect(() => {
    async function fallbackFetchEvent() {
      if (!eventSpecialId) return;
      if (contextActiveEvent && contextActiveEvent.eventSpecialId === eventSpecialId) {
        setLocalEvent(contextActiveEvent);
        setIsEventNotFound(false);
        return;
      }
      try {
        setIsEventLoading(true);
        setIsEventNotFound(false);
        const headers = accessToken ? { 'x-event-access-token': accessToken } : {};
        const params = { page: 1, limit: 20, search: eventSpecialId, searchField: "eventSpecialId" };
        let fetchedEvent = null;
        let fetchedList = null;
        for (const status of ["live", "upcoming", "past"]) {
          try {
            const response = await axios.get(`/cok/api/v1/events/${status}`, { params, headers });
            if (response.data?.success && response.data.data.length > 0) {
              fetchedEvent = response.data.data[0];
              fetchedList = response.data.data;
              break;
            }
          } catch (statusErr) {
            if (statusErr.response?.status === 401) throw statusErr;
          }
        }
        if (fetchedEvent) {
          setLocalEvent(fetchedEvent);
          if (setActiveEvent) setActiveEvent(fetchedEvent);
          if (setLiveEventsData && fetchedList) setLiveEventsData(fetchedList);
        } else {
          setIsEventNotFound(true);
        }
      } catch (error) {
        if (error.response?.status === 401) {
          localStorage.removeItem(`event_access_${eventSpecialId}`);
          navigate('/', { replace: true });
          return;
        }
        console.error("Error direct-fetching live event:", error);
        setIsEventNotFound(true);
      } finally {
        setIsEventLoading(false);
      }
    }
    if (isAccessVerified) {
      fallbackFetchEvent();
    }
  }, [eventSpecialId, contextActiveEvent, setActiveEvent, setLiveEventsData, isAccessVerified, accessToken, navigate]);

  const fetchQrCode = useCallback(async (signal) => {
    if (!activeEvent?._id) return;
    setIsQrLoading(true);
    setQrError(false);
    try {
      const headers = accessToken ? { 'x-event-access-token': accessToken } : {};
      const response = await axios.get(`/cok/api/v1/events/${activeEvent._id}/qrcode`, { signal, headers });
      if (response.data?.success) {
        setQrCodeUrl(response.data.data.qrCodeDataUrl);
        setActualQrCodeUrl(response.data.data.attendanceUrl);
      } else {
        setQrError(true);
      }
    } catch (error) {
      if (!axios.isCancel(error)) {
        if (error.response?.status === 401) {
          localStorage.removeItem(`event_access_${eventSpecialId}`);
          navigate('/', { replace: true });
          return;
        }
        console.error("QR Fetch Error:", error);
        setQrError(true);
      }
    } finally {
      setIsQrLoading(false);
    }
  }, [accessToken, activeEvent?._id, eventSpecialId, navigate]);

  useEffect(() => {
    if (!activeEvent || isUpcoming || isEnded || !activeEvent._id || !isAccessVerified) return;
    const abortController = new AbortController();
    fetchQrCode(abortController.signal);
    return () => abortController.abort();
  }, [activeEvent, isUpcoming, isEnded, fetchQrCode, isAccessVerified]);

  useEffect(() => {
    if (!activeEvent?.eventSpecialId || isUpcoming || !isAccessVerified) return;
    const headers = accessToken ? { 'x-event-access-token': accessToken } : {};
    const fetchCount = () =>
      axios
        .get('/cok/api/v1/attendance', { params: { eventSpecialId: activeEvent.eventSpecialId, limit: 1, _t: Date.now() }, headers })
        .then((res) => setAttendeeCount(res.data?.totalRecords ?? 0))
        .catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem(`event_access_${eventSpecialId}`);
            navigate('/', { replace: true });
          }
        });
    fetchCount();
    const timer = setInterval(fetchCount, 5000);
    return () => clearInterval(timer);
  }, [activeEvent?.eventSpecialId, isUpcoming, accessToken, eventSpecialId, navigate, isAccessVerified]);

  useEffect(() => {
    if (!activeEvent) return;
    if (isEnded) {
      setCountdown("00:00:00");
      return;
    }
    const targetTime = isUpcoming ? activeEvent.willStartAt : activeEvent.willEndAt;
    setCountdown(calculateCountdown(targetTime));
    const clockInterval = setInterval(() => {
      setCountdown(calculateCountdown(targetTime));
    }, 1000);
    return () => clearInterval(clockInterval);
  }, [activeEvent, isUpcoming, isEnded]);

  if (isEventLoading || isVerifying || isCheckingAccess) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center p-6  bg-zinc-50 rounded-none">
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

  if (isEventNotFound || (!isEventLoading && !activeEvent)) {
    return (
      <div className="w-full min-h-[90%] flex flex-col gap-3 items-center justify-center p-6 text-center rounded-none">
        <div className="max-w-md p-8 gap-y-6 text-center flex flex-col items-center rounded-none">
          <div className="w-[300px] h-[300px] flex items-center justify-center mb-4 rounded-none">
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
          <p className="text-sm text-zinc-500 mb-6 rounded-none" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            The event specified could not be loaded or is no longer live.
          </p>
          <button
            onClick={() => (onCloseOverlay ? onCloseOverlay() : navigate(-1))}
            className="px-6 py-2.5 text-white font-medium text-sm rounded-none transition-colors"
            style={{ backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#248fc2"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
          >
            {onCloseOverlay ? "Close" : "Go Back"}
          </button>
        </div>
      </div>
    );
  }

  const brandColor = generateColorFromName(activeEvent?.eventName || "Event");

  return (
    <>
    <Helmet>
    <title>{activeEvent?.eventName?.toUpperCase() || "Live"}</title>
        <meta
          name="description"
          content="Happening now"
        />
      </Helmet>
    <div className="w-full min-h-screen flex justify-center rounded-none">
      <motion.div
        className="relative w-full max-w-5xl h-max overflow-hidden p-6 md:p-8 rounded-none"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-10 rounded-none"
          style={{ background: `radial-gradient(circle at 70% 30%, ${brandColor} 0%, rgba(255,255,255,0) 70%)` }}
        />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start rounded-none">
          <EventDetailsLeftColumn
            activeEvent={activeEvent}
            eventSpecialId={eventSpecialId}
            navigate={navigate}
            onOpenSection={overlayEventId ? setActiveSection : undefined}
          />
          <EventDetailsRightColumn
            isUpcoming={isUpcoming}
            isEnded={isEnded}
            countdown={countdown}
            isQrLoading={isQrLoading}
            qrError={qrError}
            qrCodeUrl={qrCodeUrl}
            isQrMaximized={isQrMaximized}
            attendeeCount={attendeeCount}
            ActualQrCodeUrl={ActualQrCodeUrl}
            showCopiedPopup={showCopiedPopup}
            setIsQrMaximized={setIsQrMaximized}
            setShowCopiedPopup={setShowCopiedPopup}
            setQrError={setQrError}
            setIsQrLoading={setIsQrLoading}
            setQrCodeUrl={setQrCodeUrl}
            setActualQrCodeUrl={setActualQrCodeUrl}
            fetchQrCode={fetchQrCode}
          />
        </div>

        <div className="relative z-10 w-full">
          <EventAgendaSection
            event={activeEvent}
            isLive={!isUpcoming && !isEnded}
            canEdit={!isUpcoming && !isEnded}
            eventType="live"
            onUpdated={(updated) => {
              setLocalEvent((prev) => ({ ...(prev || {}), ...updated }));
              if (setActiveEvent) setActiveEvent((prev) => ({ ...(prev || {}), ...updated }));
            }}
          />
          <CoOrganizersPanel eventSpecialId={eventSpecialId} />
          <EventMinutesView
            eventSpecialId={eventSpecialId}
            activeEvent={activeEvent}
            accessToken={accessToken}
          />
        </div>
        
      </motion.div>

      <EventAccessOverlay
        event={activeEvent || { eventSpecialId }}
        isOpen={showAccessOverlay}
        onVerified={(accessToken) => {
          setAccessToken(accessToken);
          setIsAccessVerified(true);
          setShowAccessOverlay(false);
        }}
        onClose={() => {
          setShowAccessOverlay(false);
          navigate('/', { replace: true });
        }}
      />

      <EventDetailsQrModal
        isQrMaximized={isQrMaximized}
        isUpcoming={isUpcoming}
        qrCodeUrl={qrCodeUrl}
        attendeeCount={attendeeCount}
        ActualQrCodeUrl={ActualQrCodeUrl}
        showCopiedPopup={showCopiedPopup}
        setIsQrMaximized={setIsQrMaximized}
        setShowCopiedPopup={setShowCopiedPopup}
      />

      {overlayEventId && activeSection === "editor" && (
        <div className="fixed inset-0" style={{ zIndex: 100000000 }}>
          <ShowEditor overlayEventId={eventSpecialId} onCloseOverride={() => {
            setActiveSection(null);
            window.history.pushState(null, "", "/calendar");
          }} />
        </div>
      )}

      {overlayEventId && activeSection && activeSection !== "editor" && (
        <SectionOverlay title={SECTION_TITLES[activeSection] || ""} onClose={() => {
          setActiveSection(null);
          window.history.pushState(null, "", "/calendar");
        }}>
          {activeSection === "attendees" && <AttendeesList overlayEventId={eventSpecialId} embedded />}
          {activeSection === "designate" && <DesignateMinutes overlayEventId={eventSpecialId} />}
          {activeSection === "actions" && <EventActionsPage overlayEventId={eventSpecialId} />}
        </SectionOverlay>
      )}
    </div>
    </>
  );
}
