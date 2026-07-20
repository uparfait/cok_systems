import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PRIMARY = "#056daa";

export default function EventDetailsRightColumn({
  isUpcoming,
  countdown,
  isQrLoading,
  qrError,
  qrCodeUrl,
  isQrMaximized,
  attendeeCount,
  ActualQrCodeUrl,
  showCopiedPopup,
  setQrCodeUrl,
  setActualQrCodeUrl,
  setIsQrMaximized,
  setShowCopiedPopup,
  setQrError,
  setIsQrLoading,
  fetchQrCode,
}) {
  return (
    <div className="lg:col-span-5 flex flex-col gap-0 rounded-none">
      <div className="flex flex-col items-center justify-center py-4 px-6 rounded-none" style={{ backgroundColor: PRIMARY }}>
        <span className="text-[10px] uppercase font-bold tracking-widest text-white mb-1 rounded-none" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          {isUpcoming ? "Time Remaining Until Event Starts" : "Time Remaining"}
        </span>
        <div className="text-3xl font-black font-mono text-white tracking-widest rounded-none">
          {countdown || "00:00:00"}
        </div>
      </div>

      <div className="w-full bg-white border border-zinc-200 overflow-hidden flex flex-col items-center justify-center p-4 relative rounded-none" style={{ minHeight: "360px" }}>
        <AnimatePresence mode="wait">
          {isUpcoming ? (
            <motion.div
              key="upcoming"
              className="text-center p-4 flex flex-col items-center rounded-none"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <div className="w-12 h-12 flex items-center justify-center mb-3 rounded-none" style={{ backgroundColor: "#FFF3E0", border: "1px solid #FFE0B2" }}>
                <span className="text-xl font-bold" style={{ color: "#FF9800" }}>!</span>
              </div>
              <p className="text-sm font-semibold text-zinc-800 rounded-none" style={{ fontFamily: "'Montserrat', sans-serif" }}>No QR Code</p>
              <p className="text-xs text-zinc-500 mt-1 rounded-none" style={{ fontFamily: "'Montserrat', sans-serif" }}>Event Has Not Started.</p>
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
              <p className="text-sm font-medium text-zinc-700 mb-3 rounded-none" style={{ fontFamily: "'Montserrat', sans-serif" }}>Failed to display QR Code</p>
              <button
                onClick={() => fetchQrCode()}
                className="px-4 py-2 text-white text-xs font-medium tracking-wide shadow-sm transition-colors rounded-none"
                style={{ backgroundColor: "#333333", fontFamily: "'Montserrat', sans-serif" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#000000"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#333333"; }}
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

      <div className="p-3 bg-zinc-100 border border-t-0 border-zinc-200 flex items-center justify-between px-4 rounded-none">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider rounded-none" style={{ fontFamily: "'Montserrat', sans-serif" }}>Total Attendees</span>
        <span className="text-base font-bold text-zinc-900 font-mono rounded-none">{attendeeCount}</span>
      </div>
    </div>
  );
}
