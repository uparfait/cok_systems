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
  return (
    <AnimatePresence>
      {isQrMaximized && !isUpcoming && qrCodeUrl && (
        <motion.div
          className="fixed inset-0 z-[99999] bg-white flex flex-col rounded-none select-none overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex-1 w-full relative flex items-center justify-center p-6 md:p-12">
            <button
              onClick={() => setIsQrMaximized(false)}
              className="absolute top-4 right-4 md:top-8 md:right-8 transition-colors rounded-none focus:outline-none"
              style={{ color: PRIMARY }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#033b5c"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = PRIMARY; }}
              aria-label="Close Preview"
            >
              <svg className="w-10 h-10 md:w-12 md:h-12" fill="none" stroke="currentColor" strokeWidth="4.5" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeLinejoin="miter" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="w-[50vw] min-w-[300px] relative h-[75vh] flex items-center justify-center rounded-none">
              <img
                src={qrCodeUrl}
                alt="QRCode full image"
                className="w-full h-full object-contain rounded-none p-2"
              />
            </div>
          </div>

          <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 pb-8 pt-2 px-4 rounded-none relative">
            <div className="text-zinc-900 px-6 py-4 text-center w-full sm:w-auto min-w-0 sm:min-w-[280px] md:min-w-[400px] border border-zinc-300 rounded-none" style={{ backgroundColor: "#E0E0E0" }}>
              <span className="text-xl md:text-2xl font-semibold tracking-wide font-sans rounded-none">
                Total Attendees: {attendeeCount}
              </span>
            </div>

            <div className="relative w-full sm:w-auto">
              <button
                className="text-white font-bold px-6 py-4 text-center w-full sm:w-auto min-w-0 sm:min-w-[280px] md:min-w-[400px] border rounded-none transition-colors"
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
