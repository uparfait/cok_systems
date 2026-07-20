import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const PRIMARY = "#056daa";

export default function EventDetailsLeftColumn({ activeEvent, eventSpecialId, navigate }) {
  if (!activeEvent) return null;

  return (
    <div className="lg:col-span-7 flex flex-col gap-4 rounded-none">
      <div className="p-5 flex flex-col gap-3">
        <div className="inline-block px-3 py-1.5 bg-zinc-100 max-w-max rounded-none">
          <h1 className="text-lg font-bold text-zinc-900 truncate rounded-none" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {activeEvent.eventName}
          </h1>
        </div>

        <div className="inline-block px-3 py-1 bg-zinc-100 max-w-max rounded-none">
          <span className="text-sm font-semibold font-mono uppercase rounded-none" style={{ color: PRIMARY }}>
            {activeEvent.eventRoom}
          </span>
        </div>

        <div className="inline-block px-3 py-1 bg-zinc-100 max-w-max rounded-none">
          <span className="text-xs font-medium text-zinc-600 tracking-wide rounded-none" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {activeEvent.startedAt || activeEvent.willStartAt
              ? new Date(activeEvent.startedAt || activeEvent.willStartAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
                " – " +
                new Date(activeEvent.willEndAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : ""}
          </span>
        </div>

        <div className="pt-2 rounded-none">
          <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-2 rounded-none" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            About Event
          </h3>
          <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line break-all rounded-none" style={{ fontFamily: "'Merriweather', serif" }}>
            {activeEvent.eventDescription}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-none">
        <Link
          to={`/event/${activeEvent.eventSpecialId}/attendees`}
          className="w-full flex items-center justify-between px-5 py-3 transition-colors duration-200 group rounded-none"
          style={{ backgroundColor: PRIMARY, color: '#FFFFFF' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#248fc2"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
          onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(1px)"; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
        >
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6zM3 20v-2a3 3 0 013-3" />
            </svg>
            <span className="text-sm font-semibold tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>View Attendance</span>
          </div>
          <svg className="w-4 h-4" style={{ color: "rgba(255,255,255,0.6)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        <div className="flex flex-row gap-2">
          <Link
            to={`/event/${activeEvent.eventSpecialId}/editor`}
            className="flex-1 flex items-center justify-between px-5 py-3 text-white transition-colors duration-200 group rounded-none"
            style={{ backgroundColor: PRIMARY }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#248fc2"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
            onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(1px)"; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-sm font-semibold text-white tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>Record Minutes</span>
            </div>
            <svg className="w-4 h-4" style={{ color: "rgba(255,255,255,0.6)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            to={`/event/${activeEvent.eventSpecialId}/designate`}
            className="flex-1 flex items-center justify-between px-5 py-3 text-white transition-colors duration-200 group rounded-none"
            style={{ backgroundColor: PRIMARY }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#248fc2"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
            onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(1px)"; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 text-white h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14v7m-3 0h6" />
              </svg>
              <span className="text-sm font-semibold text-white tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>Designate</span>
            </div>
            <svg className="w-4 h-4" style={{ color: "rgba(255,255,255,0.6)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <button
          onClick={() => navigate(`/event/${eventSpecialId}/actions`)}
          className="w-full flex items-center justify-between px-5 py-3 transition-colors duration-200 group rounded-none"
          style={{ backgroundColor: PRIMARY, color: '#FFFFFF' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#248fc2"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
          onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(1px)"; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
        >
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span className="text-sm font-semibold tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>Event Actions</span>
          </div>
          <svg className="w-4 h-4" style={{ color: "rgba(255,255,255,0.6)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
