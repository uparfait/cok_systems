import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

const PRIMARY = "#056daa";

export default function EventDetailsQrModal({
  isQrMaximized,
  isUpcoming,
  qrCodeUrl,
  attendeeCount,
  ActualQrCodeUrl,
  showCopiedPopup,
  setIsQrMaximized,
  setShowCopiedPopup,
}) {
  const containerRef = useRef(null);
  const isOpen = isQrMaximized && !isUpcoming && !!qrCodeUrl;

  useEffect(() => {
    if (!isOpen) return;
    const el = containerRef.current;
    if (el && !document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setIsQrMaximized(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [isOpen, setIsQrMaximized]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          className="fixed inset-0 z-[999999999] bg-white flex flex-col rounded-none select-none overflow-y-auto overflow-x-hidden"
          style={{ margin: 0, padding: 0 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <img
            src={qrCodeUrl}
            alt="QRCode full image"
            className="rounded-none shrink-0 block"
            style={{ width: "100vw", height: "100vh", objectFit: "fill", maxWidth: "none", margin: 0, padding: 0 }}
          />

          <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 pb-8 pt-4 px-4 rounded-none relative">
            <div className="text-zinc-900 px-6 py-4 text-center w-full sm:w-auto min-w-0 sm:min-w-[280px] md:min-w-[400px] border border-zinc-300 rounded-none" style={{ backgroundColor: "#E0E0E0" }}>
              <span className="text-xl md:text-2xl font-semibold tracking-wide font-sans rounded-none">
                Total Attendees: {attendeeCount}
              </span>
            </div>

            <div className="relative w-full sm:w-auto">
              <button
                className="text-white font-bold px-6 py-4 text-center w-full sm:w-auto min-w-0 sm:min-w-[280px] md:min-w-[400px] border rounded-none transition-colors cursor-pointer"
                style={{ backgroundColor: PRIMARY, borderColor: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#248fc2"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
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

              <AnimatePresence>
                {showCopiedPopup && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, x: "-50%" }}
                    animate={{ opacity: 1, y: 0, x: "-50%" }}
                    exit={{ opacity: 0, y: 10, x: "-50%" }}
                    className="absolute left-1/2 -top-12 bg-zinc-900 text-white text-xs font-bold px-3 py-1.5 rounded-none shadow-md pointer-events-none whitespace-nowrap z-50"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    Copied to Clipboard!
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setIsQrMaximized(false)}
              className="font-bold px-6 py-4 text-center w-full sm:w-auto min-w-0 sm:min-w-[280px] md:min-w-[400px] border rounded-none transition-colors cursor-pointer"
              style={{ backgroundColor: "transparent", borderColor: PRIMARY, color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; e.currentTarget.style.color = "#FFFFFF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = PRIMARY; }}
            >
              CLOSE
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
