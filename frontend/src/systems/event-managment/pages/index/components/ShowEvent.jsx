import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { Link, useOutletContext } from "react-router-dom";

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

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} left`;
  if (hours > 0) return `${hours} hr ${minutes} min left`;
  return `${minutes + 1} min left`;
};

export default function ShowEvent({ event }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [isQrLoading, setIsQrLoading] = useState(true);
  const [isClicked, setIsClicked] = useState(false);
  const { setActiveEvent } = useOutletContext();

  const brandColor = generateColorFromName(event.eventName || "Event");

  // 1. Memory-Safe Live Timer Effect
  useEffect(() => {
    // Initial calculation to prevent jumpy text on mount
    setTimeLeft(calculateTimeLeft(event.willEndAt));

    const timerInterval = setInterval(() => {
      setTimeLeft(calculateTimeLeft(event.willEndAt));
    }, 60000); // Update every 60 seconds is highly optimal for memory

    return () => clearInterval(timerInterval);
  }, [event.willEndAt]);

  // 2. Memory-Safe API Fetch for QR Code
  useEffect(() => {
    const abortController = new AbortController();

    async function fetchQrCode() {
      setIsQrLoading(true);
      try {
        const response = await axios.get(
          `/cok/api/v1/events/${event._id}/qrcode`,
          { signal: abortController.signal }
        );

        if (response.data && response.data.success) {
          setQrCodeUrl(response.data.data.qrCodeDataUrl);
        } else {
          setQrCodeUrl(null); // Explicitly null if fails
        }
      } catch (error) {
        if (!axios.isCancel(error)) {
          console.error("Failed to load QR code:", error);
          setQrCodeUrl(null);
        }
      } finally {
        setIsQrLoading(false);
      }
    }

    if (event._id) {
      fetchQrCode();
    } else {
      setIsQrLoading(false);
    }

    return () => abortController.abort(); // Cancel network request if component unmounts quickly
  }, [event._id]);

  return (

    <motion.div
      onClick={() => {
        setIsClicked(!isClicked);
        setActiveEvent(event);
      }}
      className="relative w-full max-w-3xl items-start text-left bg-white overflow-hidden cursor-pointer transition-shadow duration-300"
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
              0
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
          <h2 className="text-xl font-mono md:text-2xl text-blue-600 truncate mb-1">
            {event.eventRoom}
          </h2>

          {/* Bottom Section: Description */}
          <p className="text-sm text-zinc-600 line-clamp-2 md:line-clamp-3 leading-relaxed">
            {event.eventDescription}
          </p>
        </div>

        {/* Right Side: Dynamic QR Code Container */}
        <AnimatePresence mode="wait">
          {(isQrLoading || qrCodeUrl) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, width: 0, margin: 0 }} // Smooth collapse if QR fails
              className="flex-shrink-0 w-24 h-24 md:w-32 md:h-32 bg-zinc-50 overflow-hidden flex items-center justify-center"
            >
              {isQrLoading ? (
                // Pulse Skeleton Loader
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  className="w-full h-full bg-zinc-200"
                />
              ) : (
                // Actual QR Code
                <img
                  src={qrCodeUrl}
                  alt={`QR Code for ${event.eventName}`}
                  className="w-full h-full object-contain p-2 bg-white"
                  loading="lazy"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
      </div>
    </motion.div>

  );
}