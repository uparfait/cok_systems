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
import { FiInfo, FiUsers, FiFileText, FiUserCheck, FiCheckSquare } from "react-icons/fi";

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

// One icon per tab for the rail. The full label still travels with it, as
// the tooltip and for screen readers, so an icon-only rail is never a
// guessing game.
const TAB_ICONS = {
  info: FiInfo,
  "view-attendance": FiUsers,
  "record-minutes": FiFileText,
  "designate-minutes": FiUserCheck,
  "event-actions": FiCheckSquare,
};

/**
 * One entry of the second sidebar: the icon, the label on hover, and for
 * attendance the count as a small badge, since that number is worth
 * seeing without opening the tab.
 */
function SideTab({ tabKey, label, badge, active, onTabChange }) {
  const Icon = TAB_ICONS[tabKey] || FiInfo;
  return (
    <button
      type="button"
      onClick={() => onTabChange(tabKey)}
      // The label is on the tooltip as well, for the narrow screens where
      // the rail shows icons alone.
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="group relative w-full flex items-center gap-3 px-0 md:px-4 justify-center md:justify-start py-3.5 cursor-pointer transition-colors"
      style={{
        color: active ? PRIMARY : "#6B7280",
        backgroundColor: active ? "rgba(5,109,170,0.10)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = "rgba(5,109,170,0.06)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {active && <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: PRIMARY }} />}
      <span className="relative flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
        {/* On the narrow rail the count rides the icon, since there is no
            room for it anywhere else. */}
        {badge > 0 && (
          <span
            className="md:hidden absolute -top-1.5 -right-2 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
            style={{ backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>

      <span
        className="hidden md:inline text-sm font-medium truncate"
        style={{ fontFamily: "'Montserrat', sans-serif" }}
      >
        {label}
      </span>
      {badge > 0 && (
        <span
          className="hidden md:flex ml-auto w-6 h-6 rounded-full items-center justify-center text-[11px] font-bold text-white shrink-0"
          style={{ backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}

      {/* Only needed while the labels are hidden. */}
      <span
        className="md:hidden pointer-events-none absolute left-full ml-2 whitespace-nowrap bg-zinc-900 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-[60]"
        style={{ fontFamily: "'Montserrat', sans-serif" }}
      >
        {label}
      </span>
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


  return (
    <>
    <Helmet>
    <title>{activeEvent?.eventName?.toUpperCase() || "Live"}</title>
        <meta
          name="description"
          content="Happening now"
        />
      </Helmet>
    {/* On /calendar this page fills <main> edge to edge: the negative
        margin cancels main's own p-3/p-4/p-6 on every side, so the tab bar
        below starts exactly where the app header ends with no strip of
        page background between them. Cancelling the padding once here is
        what makes that hold both at rest AND while scrolled - trying to
        do it on the sticky bar alone left a gap in one state or the other.
        The content further down puts the side padding back for itself. */}
    <div
      className={`w-full min-h-screen rounded-none flex flex-row items-stretch ${
        bypassAccess ? "-m-3 sm:-m-4 lg:-m-6" : ""
      }`}
    >
      {/* The same sidebar on both pages. Inside the signed-in shell it
          pins to the top of the scrolling area; on the public page the
          site header is fixed and 80px tall, so it pins just below it. */}
        <aside
          // Always there, with no way to collapse it: it is this page's
          // only navigation. Icons alone where there is no room for more,
          // icons with their labels from md up.
          //
          // Its height is the scrolling area's, not the whole window's -
          // h-screen made it taller than the space it sits in, so it slid
          // up out of view before sticking. At this height it is pinned to
          // the top from the first pixel and never moves; if it ever holds
          // more entries than fit, it scrolls inside itself rather than
          // taking the page with it.
          className={`sticky self-start overflow-y-auto w-16 md:w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col items-stretch select-none z-50 ${
            bypassAccess ? "top-0 h-[calc(100dvh-80px)]" : "top-20 h-[calc(100dvh-80px)]"
          }`}
          aria-label="Event sections"
        >
          {visibleTabs.map((tab) => (
            <SideTab
              key={tab.key}
              tabKey={tab.key}
              label={tab.label}
              badge={tab.key === "view-attendance" ? attendeeCount : 0}
              active={activeTab === tab.key}
              onTabChange={handleTabChange}
            />
          ))}
        </aside>

      {/* Beside the rail, not under it. The page cancelled main's padding
          so the rail reaches the window edge; the content puts back only
          the sides and the bottom - no padding on top, so the content
          starts level with the rail and with the app header above it
          rather than floating below a band of empty page. */}
      <div className="flex-1 min-w-0 flex flex-col items-center px-3 sm:px-4 lg:px-6 pb-3 sm:pb-4 lg:pb-6">
      <motion.div
        className="relative w-full max-w-5xl h-max rounded-none"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >

        {/* Tab Content */}
        <div className="relative z-10">
          {activeTab === "info" && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start px-6 pb-6 md:px-8 md:pb-8">
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
            <div className="px-6 pb-6 md:px-8 md:pb-8">
              <AttendeesList />
            </div>
          )}

          {!isPublic && activeTab === "record-minutes" && createPortal(
            <ShowEditor onCloseOverride={() => window.history.back()} />,
            document.body
          )}

          {!isPublic && activeTab === "designate-minutes" && (
            <div className="px-6 pb-6 md:px-8 md:pb-8">
              <DesignateMinutes onClose={() => handleTabChange("info")} />
            </div>
          )}

          {!isPublic && activeTab === "event-actions" && (
            <div className="px-6 pb-6 md:px-8 md:pb-8">
              <EventActionsPage />
            </div>
          )}
        </div>
      </motion.div>
      </div>

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
