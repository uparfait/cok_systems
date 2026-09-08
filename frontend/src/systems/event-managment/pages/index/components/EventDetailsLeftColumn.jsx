const PRIMARY = "#056daa";

const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function EventDetailsLeftColumn({ activeEvent, eventSpecialId, navigate }) {
  if (!activeEvent) return null;

  const startTime = formatTime(activeEvent.startedAt || activeEvent.willStartAt || activeEvent.startTime);
  const endTime = formatTime(activeEvent.willEndAt || activeEvent.endedAt || activeEvent.expectedToEndAt || activeEvent.endTime);

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
            {startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime || ""}
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
    </div>
  );
}
