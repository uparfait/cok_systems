import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useOutletContext, useNavigate } from "react-router-dom";
import { FiMapPin } from "react-icons/fi";
import EventAccessOverlay from "./EventAccessOverlay";
import openEventAccess from "./openEventAccess";

const formatTime = (date) =>
  new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

// Helper: Generates a consistent, aesthetic pastel color from a string
const generateColorFromName = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${hash % 360}, 65%, 75%)`;
};

// Helper: Calculates wise, human-readable time until the event starts
const calculateTimeUntilStart = (startTime) => {
  const totalMs = new Date(startTime).getTime() - new Date().getTime();
  
  // If the start time has already arrived or passed, it's live!
  if (totalMs <= 0) return "Live Now";

  const minutes = Math.floor((totalMs / 1000 / 60) % 60);
  const hours = Math.floor((totalMs / (1000 * 60 * 60)) % 24);
  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));

  if (days > 0) return `Starts in ${days} day${days > 1 ? "s" : ""}`;
  if (hours > 0) return `Starts in ${hours} hr ${minutes} min`;
  return `Starts in ${minutes + 1} min`;
}; 

export default function ShowUpcoming({ event }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isClicked, setIsClicked] = useState(false);

  const [showAccessOverlay, setShowAccessOverlay] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const navigate = useNavigate();

  // The backend sends a Joint event to the public as room and time only.
  const isRestricted = event.isRestricted === true || event.eventType === "Joint";
  const brandColor = generateColorFromName(event.eventName || "Event");
  const {setActiveEvent} = useOutletContext();

  // Memory-Safe Live Timer Effect (Targeting willStartAt)
  useEffect(() => {
    // Initial calculation to prevent jumpy text on mount
    setTimeLeft(calculateTimeUntilStart(event.willStartAt));

    const timerInterval = setInterval(() => {
      setTimeLeft(calculateTimeUntilStart(event.willStartAt));
    }, 60000); // Efficient 60-second updates

    return () => clearInterval(timerInterval);
  }, [event.willStartAt]);

  return (

    <motion.div
      // Only a Joint card is clickable here: it is the one whose detail is
      // withheld, and the click is how somebody entitled to it asks by
      // email. Every other upcoming card behaves exactly as before.
      onClick={
        isRestricted
          ? async () => {
              if (isOpening) return;
              setIsOpening(true);
              try {
                if (await openEventAccess(event.eventSpecialId)) {
                  navigate(`/event/${event.eventSpecialId}/details`);
                  return;
                }
                setShowAccessOverlay(true);
              } finally {
                setIsOpening(false);
              }
            }
          : undefined
      }
      className={`relative w-full max-w-3xl items-start text-left bg-white overflow-hidden transition-shadow duration-300 ${
        isRestricted ? "cursor-pointer" : ""
      }`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Dynamic Animated Background */}
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none"
        animate={{
          background: `radial-gradient(circle at 50% 50%, ${brandColor} 0%, rgba(255,255,255,0) 70%)`
        }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        style={{ opacity: 0.3 }}
      />

      {/* Main Card Content */}
      <div className="relative z-10 flex flex-row items-center p-4 md:p-5 gap-4">
        
        {/* Full-width Details Layout */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">

          {/* A Joint event says the room is booked and when, and nothing
              else - its name and description are not in the payload at all
              (em_backend/utilities/publicEvent.js). */}
          {isRestricted ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <FiMapPin className="w-4 h-4 shrink-0" style={{ color: "#34A8DB" }} />
                <h2 className="text-xl font-mono md:text-2xl text-zinc-800 uppercase truncate">
                  {event.eventRoom}
                </h2>
              </div>
              {/* The room and the time, and nothing else. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-zinc-700 font-mono">
                  {formatTime(event.willStartAt)} - {formatTime(event.willEndAt)}
                </span>
                <span className="text-xs text-blue-600 font-semibold tracking-wide">{timeLeft}</span>
              </div>
            </>
          ) : (
          <>
          {/* Top Section: Avatar, Event Name, & Countdown Timer */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-zinc-100 text-lg shadow-sm font-semibold"
              style={{ backgroundColor: brandColor }}
            >
              {event.eventName ? event.eventName.charAt(0).toUpperCase() : "E"}
            </div>
            
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-zinc-900 truncate">
                {event.eventName}
              </span>
              <span className="text-xs text-blue-600 font-semibold tracking-wide">
                {timeLeft}
              </span>
            </div>
          </div>

          {/* Middle Section: Room Focus */}
          <h2 className="text-xl font-mono md:text-2xl text-zinc-800 truncate mb-1">
            {event.eventRoom}
          </h2>

          {/* Bottom Section: Description */}
          <p className="text-sm text-zinc-600 line-clamp-2 md:line-clamp-3 leading-relaxed">
            {event.eventDescription}
          </p>
          </>
          )}
        </div>

      </div>

      {/* Shown while the access check is in flight. */}
      {isOpening && (
        <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-white/70" style={{ backdropFilter: "blur(1px)" }}>
          <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "#056daa", borderTopColor: "transparent" }} />
          <span className="text-xs font-semibold" style={{ color: "#056daa", fontFamily: "'Montserrat', sans-serif" }}>Opening...</span>
        </div>
      )}

      {showAccessOverlay && (
        <EventAccessOverlay
          event={event}
          isOpen={showAccessOverlay}
          onVerified={() => {
            setShowAccessOverlay(false);
            navigate(`/event/${event.eventSpecialId}/details`);
          }}
          onClose={() => setShowAccessOverlay(false)}
        />
      )}
    </motion.div>

  );
}