import { motion } from "framer-motion";

export default function ShowEventSkeleton() {
  return (
    <motion.div
      className="relative w-full max-w-3xl items-start text-left bg-white overflow-hidden pointer-events-none select-none"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background overlay mimicking the original layout's radial vibe safely */}
      <div className="absolute inset-0 z-0 bg-zinc-50/30" />

      {/* Main Card Content Container (Mirrors the flex layout exactly) */}
      <div className="relative z-10 flex flex-row items-center justify-between p-4 md:p-5 gap-4">
        
        {/* Left Side: Text Details Skeleton */}
        <div className="flex-1 min-w-0 gap-1 flex flex-col justify-center animate-pulse">
          
          {/* Top Section: Avatar, Event Name, & Timer */}
          <div className="flex items-center gap-3 mb-3">
            {/* Avatar Circle Skeleton */}
            <div className="w-10 h-10 rounded-full flex-shrink-0  bg-zinc-200" />
            
            {/* Event Name & Timer Stack */}
            <div className="flex flex-col gap-1 space-y-2 w-full max-w-[150px]">
              {/* Event Name line */}
              <div className="h-3.5 bg-zinc-200  w-3/4" />
              {/* Timer line */}
              <div className="h-3 bg-zinc-200  w-1/2" />
            </div>
          </div>

          {/* Middle Section: Room (Title focus) */}
          <div className="h-6 md:h-7 bg-zinc-200  w-1/3 mb-2" />

          {/* Bottom Section: Description (Simulates 2 lines of text) */}
          <div className="space-y-2">
            <div className="h-3 bg-zinc-200  w-full" />
            <div className="h-3 bg-zinc-200  w-5/6" />
          </div>
        </div>

        {/* Right Side: QR Code Container Skeleton */}
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="flex-shrink-0 w-24 h-24 md:w-32 md:h-32 bg-zinc-200 overflow-hidden "
        />
        
      </div>
    </motion.div>
  );
}