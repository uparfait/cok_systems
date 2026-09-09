import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import EventAccessOverlay from "./components/EventAccessOverlay";
import EventDetailsQrModal from "./components/EventDetailsQrModal";
import EventDetailsLeftColumn from "./components/EventDetailsLeftColumn";
import EventDetailsRightColumn from "./components/EventDetailsRightColumn";
import EventMinutesView from "./components/EventMinutesView";
import CoOrganizersPanel from "./components/CoOrganizersPanel";
import EventAgendaSection from "../../components/sub-components/EventAgendaSection";
import AttendeesList from "./AttendeesList";
import DesignateMinutes from "./DesignateMinutes";
import EventActionsPage from "./EventActionsPage";
import ShowEditor from "./components/ShowEditor";
import { Helmet } from "react-helmet-async";

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

const TABS = [
  { key: "info", label: "Info" },
  { key: "view-attendance", label: "View Attendance" },
  { key: "record-minutes", label: "View & Edit Minutes" },
  { key: "designate-minutes", label: "Designate Minutes" },
  { key: "event-actions", label: "Actions(Follow-ups)" },
];

function TabLink({ tabKey, active, children, onTabChange }) {
  return (
    <button
      type="button"
      onClick={() => onTabChange(tabKey)}
      className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors duration-300 ${
        active ? "text-[#056daa]" : "text-gray-500 hover:text-gray-700"
      }`}
      style={{ fontFamily: "'Montserrat', sans-serif", display: 'block', width: '100%', background: 'none', border: 'none' }}
    >
      {active && (
        <motion.span
          layoutId="event-tab-active"
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(5,109,170,0.1)", borderBottom: `2px solid ${PRIMARY}` }}
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

export default function EventDetails({ overlayEventId = null, onCloseOverlay = null, bypassAccess = false }) {
  const context = useOutletContext();
  const contextActiveEvent = overlayEventId ? null : context?.activeEvent;
  const setActiveEvent = overlayEventId ? null : context?.setActiveEvent;
  const setLiveEventsData = overlayEventId ? null : context?.setLiveEventsData;
  const { id: routeEventId } = useParams();
  const eventSpecialId = overlayEventId || routeEventId;
  const navigate = useNavigate();

  const isPublic = !bypassAccess;
  const visibleTabs = isPublic
    ? TABS.filter((t) => t.key === "info" || t.key === "view-attendance")
    : TABS;

  const tabFromPath = () => {
    if (isPublic) return "info";
    const path = window.location.pathname;
    const match = TABS.find((t) => t.key !== "info" && path.endsWith(`/${t.key}`));
    return match ? match.key : "info";
  };
  const [activeTab, setActiveTab] = useState(tabFromPath);

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

  const handleTabChange = useCallback((tabKey) => {
    setActiveTab(tabKey);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (isPublic) return;
    const basePath = `/calendar/${eventSpecialId}`;
    const newPath = tabKey === "info" ? basePath : `${basePath}/${tabKey}`;
    window.history.pushState(null, '', newPath);
  }, [eventSpecialId, isPublic]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const match = TABS.find((t) => t.key !== "info" && path.endsWith(`/${t.key}`));
      setActiveTab(match ? match.key : "info");
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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
        for (const status of ["live", "upcoming", "past"]) {
          try {
            const response = await axios.get(`/cok/api/v1/events/${status}`, { params, headers });
            if (response.data?.success && response.data.data.length > 0) {
              fetchedEvent = response.data.data[0];
              break;
            }
          } catch (statusErr) {
            if (statusErr.response?.status === 401) throw statusErr;
          }
        }
        if (fetchedEvent) {
          setLocalEvent(fetchedEvent);
          if (setActiveEvent) setActiveEvent(fetchedEvent);
          if (setLiveEventsData) setLiveEventsData([fetchedEvent]);
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
    if (isEnded) return;
    const timer = setInterval(fetchCount, 10000);
    return () => clearInterval(timer);
  }, [activeEvent?.eventSpecialId, isUpcoming, isEnded, accessToken, eventSpecialId, navigate, isAccessVerified]);

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
    <div className="w-full min-h-screen flex flex-col items-center rounded-none">
      {/* Sticky Tab Header: full-bleed toolbar above the content so nothing scrolls past its edges */}
      <nav
        className={`sticky z-50 bg-white border-b border-gray-200 self-stretch ${
          bypassAccess
            ? "top-0 -mt-3 sm:-mt-4 lg:-mt-6 -mx-3 sm:-mx-4 lg:-mx-6"
            : "top-[80px]"
        }`}
      >
        <div className="max-w-5xl mx-auto flex overflow-x-auto">
          {visibleTabs.map((tab) => (
            <TabLink
              key={tab.key}
              tabKey={tab.key}
              active={activeTab === tab.key}
              onTabChange={handleTabChange}
            >
              {tab.key === "view-attendance" ? `${tab.label} (${attendeeCount})` : tab.label}
            </TabLink>
          ))}
        </div>
      </nav>

      <motion.div
        className="relative w-full max-w-5xl h-max rounded-none"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-10 rounded-none"
          style={{ background: `radial-gradient(circle at 70% 30%, ${brandColor} 0%, rgba(255,255,255,0) 70%)` }}
        />

        {/* Tab Content */}
        <div className="relative z-10">
          {activeTab === "info" && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start p-6 md:p-8">
                <EventDetailsLeftColumn
                  activeEvent={activeEvent}
                  eventSpecialId={eventSpecialId}
                  navigate={navigate}
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
                  eventSpecialId={eventSpecialId}
                  navigate={navigate}
                />
              </div>
              {!isPublic && (
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
              )}
            </>
          )}

          {activeTab === "view-attendance" && (
            <div className="p-6 md:p-8">
              <AttendeesList />
            </div>
          )}

          {!isPublic && activeTab === "record-minutes" && createPortal(
            <ShowEditor onCloseOverride={() => window.history.back()} />,
            document.body
          )}

          {!isPublic && activeTab === "designate-minutes" && (
            <div className="p-6 md:p-8">
              <DesignateMinutes onClose={() => handleTabChange("info")} />
            </div>
          )}

          {!isPublic && activeTab === "event-actions" && (
            <div className="p-6 md:p-8">
              <EventActionsPage />
            </div>
          )}
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
    </div>
    </>
  );
}
