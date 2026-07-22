import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const PRIMARY = "#056daa";

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MinutesList({ minutes, onView }) {
  if (!minutes || minutes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {minutes.map((m) => (
        <div
          key={m.eventSpecialId}
          className="flex items-center justify-between px-4 py-3 border rounded-none"
          style={{ borderColor: "#E0E0E0", backgroundColor: "#FFFFFF" }}
        >
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ fontFamily: "'Montserrat', sans-serif", color: "#555555" }}
          >
            {formatDate(m.meetingDate)}
          </span>
          <button
            onClick={() => onView(m.eventSpecialId)}
            className="text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-colors rounded-none"
            style={{
              color: PRIMARY,
              fontFamily: "'Montserrat', sans-serif",
              border: `1px solid ${PRIMARY}`,
              backgroundColor: "transparent",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = PRIMARY;
              e.currentTarget.style.color = "#FFFFFF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = PRIMARY;
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "translateY(1px)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Click to view
          </button>
        </div>
      ))}
    </div>
  );
}

export default function EventMinutesView({ eventSpecialId, activeEvent, accessToken }) {
  const [minutes, setMinutes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!eventSpecialId) return;

    const fetchMinutes = async () => {
      setIsLoading(true);
      setError(null);
      setMinutes([]);

      const headers = accessToken ? { "x-event-access-token": accessToken } : {};

      try {
        const seriesRes = await axios.get(
          `/cok/api/v1/events/${eventSpecialId}/minutes/series`,
          { headers }
        );

      

        if (seriesRes.data?.success) {
          setMinutes(seriesRes.data.data.minutes || []);
          return;
        }
      } catch (seriesErr) {
        if (seriesErr.response?.status !== 404) {
          console.error("Error fetching series minutes:", seriesErr);
        }
      }

      finally {
       setIsLoading(false);
       }

      // try {
      //   const singleRes = await axios.get(
      //     `/cok/api/v1/events/${eventSpecialId}/minutes`,
      //     { headers }
      //   );

      //   if (singleRes.data?.success) {
      //     const m = singleRes.data.data.minutes;
      //     setMinutes(m ? [{ ...m, eventSpecialId }] : []);
      //   } else {
      //     setError(singleRes.data?.message || "Failed to load minutes");
      //   }
      // } catch (singleErr) {
      //   console.error("Error fetching minutes:", singleErr);
      //   const msg = singleErr.response?.data?.message || "Failed to load minutes";
      //   if (msg !== "No minutes found for this event yet") {
      //     setError(msg);
      //   }
      // } finally {
      //   setIsLoading(false);
      // }
    };

    fetchMinutes();
  }, [eventSpecialId, accessToken]);

  const handleView = (id) => {
    navigate(`/event/${id}/editor`);
  };

  return (
    <div className="w-full mt-6 p-5 border rounded-none" style={{ borderColor: "#E0E0E0", backgroundColor: "#FFFFFF" }}>
      <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>
        Meeting Minutes
      </h3>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: "transparent" }} />
        </div>
      )}

      {error && !isLoading && (
        <p className="text-sm text-red-600" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          {error}
        </p>
      )}

      {!isLoading && !error && minutes.length === 0 && (
        <p className="text-sm text-zinc-500" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          No minutes recorded yet.
        </p>
      )}

      {!isLoading && !error && minutes.length > 0 && (
        <MinutesList minutes={minutes} onView={handleView} />
      )}
    </div>
  );
}
