const PRIMARY = "#056daa";

export default function EventDetailsLeftColumn({ activeEvent, eventSpecialId, navigate, onOpenSection }) {
  if (!activeEvent) return null;

  const go = (section, path) => {
    if (onOpenSection) onOpenSection(section);
    else navigate(path);
  };

  const navBtnProps = {
    className: "flex items-center justify-between px-5 py-3 transition-colors duration-200 cursor-pointer rounded-none",
    style: { backgroundColor: PRIMARY, color: "#FFFFFF", border: 0 },
    onMouseEnter: (e) => { e.currentTarget.style.backgroundColor = "#248fc2"; },
    onMouseLeave: (e) => { e.currentTarget.style.backgroundColor = PRIMARY; },
    onMouseDown: (e) => { e.currentTarget.style.transform = "translateY(1px)"; },
    onMouseUp: (e) => { e.currentTarget.style.transform = "translateY(0)"; },
  };

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
                " - " +
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
        <button
          type="button"
          onClick={() => go("attendees", `/event/${activeEvent.eventSpecialId}/attendees`)}
          {...navBtnProps}
          className={`w-full ${navBtnProps.className}`}
        >
          <span className="text-sm font-semibold tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>View Attendance</span>
          <span style={{ color: "rgba(255,255,255,0.6)" }}>&gt;</span>
        </button>

        <div className="flex flex-row gap-2">
          <button
            type="button"
            onClick={() => go("editor", `/event/${activeEvent.eventSpecialId}/editor`)}
            {...navBtnProps}
            className={`flex-1 ${navBtnProps.className}`}
          >
            <span className="text-sm font-semibold text-white tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>Record Minutes</span>
            <span style={{ color: "rgba(255,255,255,0.6)" }}>&gt;</span>
          </button>

          <button
            type="button"
            onClick={() => go("designate", `/event/${activeEvent.eventSpecialId}/designate`)}
            {...navBtnProps}
            className={`flex-1 ${navBtnProps.className}`}
          >
            <span className="text-sm font-semibold text-white tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>Designate</span>
            <span style={{ color: "rgba(255,255,255,0.6)" }}>&gt;</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => go("actions", `/event/${eventSpecialId}/actions`)}
          {...navBtnProps}
          className={`w-full ${navBtnProps.className}`}
        >
          <span className="text-sm font-semibold tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>Event Actions</span>
          <span style={{ color: "rgba(255,255,255,0.6)" }}>&gt;</span>
        </button>
      </div>
    </div>
  );
}
