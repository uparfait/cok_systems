import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { Link, useOutletContext, useNavigate } from "react-router-dom";
import EventAccessOverlay from "./EventAccessOverlay";
import { FiMapPin } from "react-icons/fi";

// Helper: Generates a consistent, aesthetic pastel color from a string
const generateColorFromName = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Using 75% lightness for perfect light-theme compatibility
  return `hsl(${hash % 360}, 65%, 75%)`;
};

// Helper: Calculates wise, human-readable time remaining
const calculateTimeLeft = (endTime) => {
  const totalMs = new Date(endTime).getTime() - new Date().getTime();
  
  if (totalMs <= 0) return "Ended";

  const minutes = Math.floor((totalMs / 1000 / 60) % 60);
  const hours = Math.floor((totalMs / (1000 * 60 * 60)) % 24);
  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days} day${days > 1 ? "s":""} left`;
  if (hours > 0) return `${hours} hr ${minutes} min left`;
  return `${minutes + 1} min left`;
};

const formatTime = (date) => {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export default function ShowEvent({ event }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [isClicked, setIsClicked] = useState(false);
  const [showAccessOverlay, setShowAccessOverlay] = useState(false);
  const { setActiveEvent } = useOutletContext();
  const navigate = useNavigate();

  const brandColor = generateColorFromName(event.eventName || "Event");
  const displayCount = attendeeCount > 100 ? "99+" : attendeeCount;

  // 1. Memory-Safe Live Timer Effect
  useEffect(() => {
    // Initial calculation to prevent jumpy text on mount
    setTimeLeft(calculateTimeLeft(event.willEndAt));

    const timerInterval = setInterval(() => {
      setTimeLeft(calculateTimeLeft(event.willEndAt));
    }, 60000); // Update every 60 seconds is highly optimal for memory

    return () => clearInterval(timerInterval);
  }, [event.willEndAt]);

  useEffect(() => {
    if (!event?.eventSpecialId && !event?._id) return;
    const fetchCount = () =>
      axios
        .get('/cok/api/v1/attendance', { params: { eventSpecialId: event.eventSpecialId || event._id, limit: 1, _t: Date.now() } })
        .then((res) => setAttendeeCount(res.data?.totalRecords ?? 0))
        .catch(() => {});
    fetchCount();
  }, [event?.eventSpecialId, event?._id, timeLeft ]);

  return (

    <motion.div
      onClick={() => {
        const stored = localStorage.getItem(`event_access_${event.eventSpecialId}`);
        if (stored) {
          navigate(`/event/${event.eventSpecialId}/details`);
        } else {
          setShowAccessOverlay(true);
        }
      }}
      
      className="relative w-full  max-w-3xl items-start text-left  overflow-hidden cursor-pointer transition-shadow duration-300"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Dynamic Animated Background (Triggers on Click) */}
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none"
        animate={{
          background: isClicked 
            ? `radial-gradient(circle at 50% 50%, ${brandColor} 0%, rgba(255,255,255,0) 70%)` 
            : `radial-gradient(circle at 50% 50%, ${brandColor} 0%, rgba(255,255,255,0) 70%)`
        }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        style={{ opacity: isClicked ? 0.3 : 0.3 }}
      />

      {/* Main Card Content */}
      <div className="relative z-10 flex flex-row items-center justify-between p-4 md:p-5 gap-4">
        
        {/* Left Side: Text Details */}
        <div className="flex-1  min-w-0 flex flex-col justify-center">
          
          {/* Top Section: Avatar, Event Name, & Timer */}
          <div className="flex items-center gap-3 mb-3">
            {/* Dynamic Initial Avatar */}
            <div
              className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-zinc-100 text-lg shadow-sm"
              style={{ backgroundColor: brandColor }}
            >
              {displayCount}
            </div>
            
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-zinc-900 truncate">
                {event.eventName}
              </span>
              <span className="text-xs text-zinc-500 font-medium">
                {timeLeft}
              </span>
            </div>
            
          </div>

          {/* Middle Section: Room (Title focus) */}
          <div className="flex items-center gap-2 mb-1">
            <FiMapPin className="w-4 h-4 shrink-0" style={{ color: "#34A8DB" }} />
            <h2 className="text-xl font-semibold font-mono md:text-2xl uppercase truncate" style={{ color: "#34A8DB" }}>
              {event.eventRoom}
            </h2>
          </div>

          {/* Bottom Section: Description */}
          <p className="text-sm text-zinc-600 line-clamp-2 md:line-clamp-3 leading-relaxed">
            {event.eventDescription}
          </p>
        </div>

        {/* Right Side: Time Display */}
        <div
          className="flex-shrink-0 w-24 h-24 md:w-32 md:h-32 flex flex-col items-center justify-center"
          style={{ backgroundColor: "#056daa" }}
        >
          <span className="text-white text-xs md:text-sm font-semibold">
            {formatTime(event.startedAt)}
          </span>
          <div className="w-3/4 h-px bg-white my-1" />
          <span className="text-white text-xs md:text-sm font-semibold">
            {formatTime(event.willEndAt)}
          </span>
        </div>
        
      </div>
      {showAccessOverlay && (
        <EventAccessOverlay
          event={event}
          isOpen={showAccessOverlay}
          onVerified={(accessToken) => {
            setShowAccessOverlay(false);
            navigate(`/event/${event.eventSpecialId}/details`);
          }}
          onClose={() => setShowAccessOverlay(false)}
        />
      )}
    </motion.div>

  );
}