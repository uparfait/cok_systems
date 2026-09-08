import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { FiSearch, FiX, FiChevronLeft, FiChevronRight, FiClock, FiMapPin, FiCalendar, FiUser, FiMail, FiPhone, FiUsers } from "react-icons/fi";
import SpiralLoader from "../components/SpiralLoader";
import { useAuth } from "@/core/contexts/AuthContext";
import EventDetails from "./index/EventDetails";
import EventAgendaSection from "../components/sub-components/EventAgendaSection";

const BASE_URL = "/cok/api/v1";

const PRIMARY = "#056daa";
const PRIMARY_TINT = "#E3F2FD";
const SUCCESS = "#4CAF50";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";

// Monday-first weekdays — same as the event-manager dashboard calendar
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Same chip colors as the dashboard calendar (meetingType mode);
// events where the viewer is the designated minutes taker get a special color
function getEventColor(event) {
  if (event.isMinutesTaker) return "bg-amber-50 border-amber-400 text-amber-800";
  if (event.eventMeetingType === "meet") return "bg-blue-50 border-blue-200 text-blue-700";
  return "bg-emerald-50 border-emerald-200 text-emerald-700";
}

function formatTimeRange(startIso, endIso) {
  if (!startIso || !endIso) return "";
  const fmt = { hour: "2-digit", minute: "2-digit" };
  const start = new Date(startIso).toLocaleTimeString([], fmt);
  const end = new Date(endIso).toLocaleTimeString([], fmt);
  return `${start} - ${end}`;
}

const dateKeyOf = (iso) => (iso ? new Date(iso).toISOString().split("T")[0] : null);
const monthParam = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}-01`;

export default function CalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const userEmail = (user?.email || "").toLowerCase().trim();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState(null);
  const [highlight, setHighlight] = useState(null); // { id, dateKey }

  const isOrganizer = useCallback(
    (e) => !!userEmail && (e.eventOrganizer?.email || "").toLowerCase().trim() === userEmail,
    [userEmail]
  );
  const isCoOrganizer = useCallback(
    (e) => !!userEmail && (e.coOrganizers || []).some((c) => (c.email || "").toLowerCase().trim() === userEmail),
    [userEmail]
  );
  const isOrganizerLike = useCallback(
    (e) => isOrganizer(e) || isCoOrganizer(e),
    [isOrganizer, isCoOrganizer]
  );
  const canOpen = useCallback((e) => e.isInvited || e.isMinutesTaker || isOrganizerLike(e), [isOrganizerLike]);

  // Search
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolVersion, setPoolVersion] = useState(0);
  const [searchForced, setSearchForced] = useState(false);
  const poolRef = useRef(null);

  const openEvent = useCallback((e) => {
    const type = (e.eventType || "").toLowerCase();
    const minutesOnly = e.isMinutesTaker && !isOrganizerLike(e) && (type === "internal" || type === "joint");
    navigate(minutesOnly ? `/calendar/${e.eventSpecialId}/record-minutes` : `/calendar/${e.eventSpecialId}`);
  }, [navigate, isOrganizerLike]);

  const fetchMonth = useCallback(async (y, m, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = { month: monthParam(y, m) };
      if (userEmail) params.email = userEmail;
      const res = await axios.get(`${BASE_URL}/events/calendar`, { params });
      if (res.data?.success) setEvents(res.data.data || []);
    } catch {
      /* silent — keep the last good calendar on screen */
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => { fetchMonth(year, month); }, [year, month, fetchMonth]);

  // Silent refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchMonth(year, month, true), 10000);
    return () => clearInterval(interval);
  }, [year, month, fetchMonth]);

  // ±6-month pool, loaded once, used only for the search suggestions
  const loadSearchPool = useCallback(async () => {
    if (poolRef.current || poolLoading) return;
    setPoolLoading(true);
    try {
      const base = new Date();
      const requests = [];
      for (let off = -6; off <= 6; off++) {
        const d = new Date(base.getFullYear(), base.getMonth() + off, 1);
        const params = { month: monthParam(d.getFullYear(), d.getMonth()) };
        if (userEmail) params.email = userEmail;
        requests.push(axios.get(`${BASE_URL}/events/calendar`, { params }));
      }
      const results = await Promise.allSettled(requests);
      const all = [];
      const seen = new Set();
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        for (const e of r.value.data?.data || []) {
          const key = `${e.eventSpecialId}|${e.startTime}`;
          if (seen.has(key)) continue;
          seen.add(key);
          all.push(e);
        }
      }
      poolRef.current = all;
      setPoolVersion((v) => v + 1);
    } finally {
      setPoolLoading(false);
    }
  }, [userEmail, poolLoading]);

  const showSuggestions = searchForced ? search.trim().length >= 1 : search.trim().length >= 2;

  // Suggestions: all attributes, but only events where the user is invited or organising
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!(searchForced ? q.length >= 1 : q.length >= 2)) { setSuggestions([]); return; }
    loadSearchPool();
    const pool = poolRef.current || [];
    const matches = [];
    const seenIds = new Set();
    for (const e of pool) {
      const organizerLike = userEmail && (
        (e.eventOrganizer?.email || "").toLowerCase() === userEmail ||
        (e.coOrganizers || []).some((c) => (c.email || "").toLowerCase().trim() === userEmail)
      );
      if (!(e.isInvited || organizerLike)) continue;
      const haystack = [
        e.eventName, e.eventDescription, e.eventType, e.eventMeetingType, e.eventRoom, e.eventStatus,
        e.eventOrganizer?.fullNames, e.eventOrganizer?.email, e.eventOrganizer?.phone, e.eventOrganizer?.institution,
        String(e.expectedAudience || ""),
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) continue;
      const dedupeKey = `${e.eventSpecialId}|${dateKeyOf(e.startTime)}`;
      if (seenIds.has(dedupeKey)) continue;
      seenIds.add(dedupeKey);
      matches.push(e);
      if (matches.length >= 8) break;
    }
    setSuggestions(matches);
  }, [search, poolVersion, userEmail, loadSearchPool, searchForced]);

  const handleSearchClick = () => {
    if (!search.trim()) return;
    setSearchForced(true);
    loadSearchPool();
  };

  const clearSearch = () => {
    setSearch("");
    setSuggestions([]);
    setHighlight(null);
    setSearchForced(false);
  };

  const goToSuggestion = (e) => {
    const d = new Date(e.startTime);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    const dateKey = dateKeyOf(e.startTime);
    setHighlight({ id: e.eventSpecialId, dateKey });
    setExpandedDay(new Date(e.startTime).getDate());
    openEvent(e);
    setSuggestions([]);
  };

  const goToPrevMonth = () => {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 0) { newMonth = 11; newYear -= 1; }
    setMonth(newMonth); setYear(newYear); setExpandedDay(null);
  };
  const goToNextMonth = () => {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 11) { newMonth = 0; newYear += 1; }
    setMonth(newMonth); setYear(newYear); setExpandedDay(null);
  };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); setExpandedDay(null); };

  // Same grouping approach as the dashboard calendar
  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of events) {
      const dateKey = dateKeyOf(ev.startTime);
      if (!dateKey) continue;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(ev);
    }
    return map;
  }, [events]);

  const monthStart = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (monthStart.getDay() + 6) % 7;
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const currentDay = now.getDate();
  const monthName = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });

  const days = [];
  for (let i = 0; i < offset; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <div className="flex flex-col" style={{ backgroundColor: NEUTRAL_LIGHT, minHeight: "calc(100vh - 64px)" }}>
      {/* Search */}
      <div className="shrink-0 bg-white px-2 sm:px-4 py-2 sm:py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="relative w-full flex gap-2">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearchClick(); }}
              placeholder="Search your events (invited or organising)..."
              className="w-full cok-auth-input pr-8 py-2 text-sm"
              style={{ minHeight: "40px" }}
            />
            {search && (
              <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: GRAY_DISABLED }} title="Clear search">
                <FiX className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearchClick}
            disabled={!search.trim()}
            className="cok-btn-primary inline-flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ width: "auto", padding: "0 1.25rem", minHeight: "40px" }}
          >
            <FiSearch className="w-4 h-4" />
            <span className="hidden sm:inline">Search</span>
          </button>

          {showSuggestions && (
            <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white max-h-72 overflow-y-auto border border-gray-200">
              {poolLoading && !poolRef.current ? (
                <div className="flex items-center gap-2 p-3">
                  <div className="w-4 h-4"><SpiralLoader /></div>
                  <span className="text-xs text-gray-500" style={{ fontFamily: fontHeading }}>Searching your events...</span>
                </div>
              ) : suggestions.length === 0 ? (
                <p className="p-3 text-xs text-gray-500" style={{ fontFamily: fontHeading }}>No matching events where you are invited or organising.</p>
              ) : (
                suggestions.map((s, i) => (
                  <button
                    key={`${s.eventSpecialId}-${s.startTime}-${i}`}
                    onClick={() => goToSuggestion(s)}
                    className="w-full text-left px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <p className="text-sm font-semibold text-gray-800 truncate" style={{ fontFamily: fontHeading }}>{s.eventName}</p>
                    <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500 mt-0.5">
                      <span className="inline-flex items-center gap-1"><FiCalendar className="w-3 h-3" />{dateKeyOf(s.startTime)}</span>
                      <span className="inline-flex items-center gap-1"><FiClock className="w-3 h-3" />{formatTimeRange(s.startTime, s.endTime)}</span>
                      <span className="inline-flex items-center gap-1 capitalize"><FiMapPin className="w-3 h-3" />{s.eventRoom}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Calendar — same structure as the event-manager dashboard calendar */}
      <div className="flex-1 min-h-0 p-1 sm:p-3 flex flex-col">
        <div className="bg-white border border-gray-200 flex flex-col flex-1 relative">
          {/* Header bar */}
          <div className="flex items-center justify-between p-3 sm:p-4 cok-blue-bg-primary">
            <h3 className="text-xs sm:text-sm font-semibold text-white" style={{ fontFamily: fontHeading }}>Calendar</h3>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={goToPrevMonth}
                className="p-1 sm:p-1.5 border border-white hover:bg-white text-white hover:text-[#056daa] transition-colors cursor-pointer"
                aria-label="Previous month"
              >
                <FiChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs sm:text-sm font-medium text-white min-w-[110px] sm:min-w-[160px] text-center">{monthName}</span>
              <button
                onClick={goToNextMonth}
                className="p-1 sm:p-1.5 border border-white hover:bg-white text-white hover:text-[#056daa] transition-colors cursor-pointer"
                aria-label="Next month"
              >
                <FiChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={goToday}
                className="px-2 py-1 sm:py-1.5 border border-white hover:bg-white text-white hover:text-[#056daa] transition-colors cursor-pointer text-[10px] sm:text-xs font-semibold uppercase tracking-wide"
                style={{ fontFamily: fontHeading }}
              >
                Today
              </button>
            </div>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-1.5 sm:py-2 text-center font-semibold text-gray-600 border-r border-gray-100 last:border-r-0" style={{ fontSize: "clamp(8px, 1.4vw, 12px)" }}>
                {day}
              </div>
            ))}
          </div>

          {loading && events.length === 0 ? (
            <div className="flex-1 min-h-[300px] flex items-center justify-center">
              <SpiralLoader />
            </div>
          ) : (
            <div className="grid grid-cols-7 flex-1 auto-rows-fr">
              {days.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="border-r border-b border-gray-100 bg-gray-50/50" style={{ minHeight: "clamp(56px, 13vw, 120px)" }} />;
                }

                const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayEvents = eventsByDate[dateKey] || [];
                const isToday = isCurrentMonth && day === currentDay;
                const isExpanded = expandedDay === day;
                const visibleEvents = isExpanded ? dayEvents : dayEvents.slice(0, 2);
                const remaining = dayEvents.length - 2;

                return (
                  <div
                    key={day}
                    id={`${isToday ? "ToDayAnimatedCalenderBg" : ""}`}
                    className={`border-r border-b border-gray-100 p-0.5 sm:p-1.5 md:p-2 last:border-r-0 ${isToday ? "bg-blue-50/40" : ""}`}
                    style={{ minHeight: "clamp(56px, 13vw, 120px)" }}
                  >
                    <div className={`mb-0.5 sm:mb-1 ${isToday ? "font-bold text-blue-600" : "font-semibold text-gray-700"}`} style={{ fontSize: "clamp(8px, 1.5vw, 12px)" }}>
                      {day}
                    </div>
                    <div className="space-y-0.5 sm:space-y-1">
                      {visibleEvents.map((ev, i) => {
                        const clickable = canOpen(ev);
                        const isHighlighted = highlight && highlight.id === ev.eventSpecialId && highlight.dateKey === dateKey;
                        const timeRange = formatTimeRange(ev.startTime, ev.endTime);
                        return (
                          <button
                            key={(ev._id || ev.eventSpecialId) + (ev.occurrenceDate || "") + i}
                            onClick={() => clickable && openEvent(ev)}
                            className={`w-full text-left leading-tight px-0.5 sm:px-1.5 py-0.5 sm:py-1 border ${getEventColor(ev)} ${clickable ? "cursor-pointer hover:opacity-80" : "cursor-default"} ${isHighlighted ? "ring-2 ring-amber-400" : ""}`}
                            style={{ fontSize: "clamp(7px, 1.4vw, 11px)" }}
                            title={clickable ? `${ev.eventName}\n${timeRange}\n${ev.eventRoom}` : `${timeRange}\n${ev.eventRoom}`}
                          >
                            {/* Event name only when the user is invited or the organiser —
                                everyone else sees just the schedule and the room */}
                            {clickable && (
                              <div className="flex items-start gap-1">
                                <span className="font-medium break-words min-w-0">{ev.eventName}</span>
                              </div>
                            )}
                            <div className="flex items-start gap-1 opacity-80 mt-0.5" style={{ fontSize: "clamp(6px, 1.2vw, 10px)" }}>
                              <FiClock className="shrink-0" style={{ width: "1em", height: "1em", marginTop: "0.15em" }} />
                              <span className="break-words min-w-0">{timeRange}</span>
                            </div>
                            <div className="flex items-start gap-1 opacity-80" style={{ fontSize: "clamp(6px, 1.2vw, 10px)" }}>
                              <FiMapPin className="shrink-0" style={{ width: "1em", height: "1em", marginTop: "0.15em" }} />
                              <span className="break-words min-w-0 capitalize">{ev.eventRoom}</span>
                            </div>
                            {(ev.isInvited || ev.isMinutesTaker || isOrganizerLike(ev)) && (
                              <div className="flex flex-wrap gap-0.5 mt-0.5">
                                {ev.isInvited && (
                                  <span className="px-1 py-px font-bold uppercase tracking-wide text-white" style={{ backgroundColor: SUCCESS, fontFamily: fontHeading, fontSize: "clamp(5.5px, 1vw, 8px)" }}>
                                    You are invited
                                  </span>
                                )}
                                {isOrganizer(ev) && (
                                  <span className="px-1 py-px font-bold uppercase tracking-wide text-white" style={{ backgroundColor: PRIMARY, fontFamily: fontHeading, fontSize: "clamp(5.5px, 1vw, 8px)" }}>
                                    Organiser
                                  </span>
                                )}
                                {!isOrganizer(ev) && isCoOrganizer(ev) && (
                                  <span className="px-1 py-px font-bold uppercase tracking-wide text-white" style={{ backgroundColor: "#7C3AED", fontFamily: fontHeading, fontSize: "clamp(5.5px, 1vw, 8px)" }}>
                                    Co-organiser
                                  </span>
                                )}
                                {ev.isMinutesTaker && (
                                  <span className="px-1 py-px font-bold uppercase tracking-wide text-white" style={{ backgroundColor: "#F39C12", fontFamily: fontHeading, fontSize: "clamp(5.5px, 1vw, 8px)" }}>
                                    Minutes taker
                                  </span>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                      {!isExpanded && remaining > 0 && (
                        <button
                          onClick={() => setExpandedDay(day)}
                          className="text-gray-500 hover:text-gray-700 px-0.5 sm:px-1.5 font-medium cursor-pointer"
                          style={{ fontSize: "clamp(7px, 1.3vw, 11px)" }}
                        >
                          +{remaining} more
                        </button>
                      )}
                      {isExpanded && dayEvents.length > 2 && (
                        <button
                          onClick={() => setExpandedDay(null)}
                          className="text-gray-500 hover:text-gray-700 px-0.5 sm:px-1.5 font-medium cursor-pointer"
                          style={{ fontSize: "clamp(7px, 1.3vw, 11px)" }}
                        >
                          Show less
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
