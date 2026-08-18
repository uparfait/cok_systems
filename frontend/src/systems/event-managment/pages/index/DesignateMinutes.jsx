import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { FiSearch, FiMail, FiUsers } from "react-icons/fi";
import { useToast } from "@/core/contexts/ToastContext";
import { useAuth } from "@/core/contexts/AuthContext";
import SpiralLoader from "../../components/SpiralLoader";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";
const BORDER = "#E0E0E0";
const NEUTRAL_DARK = "#333333";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";

export default function DesignateMinutes({ overlayEventId = null }) {
  const { id: routeEventId } = useParams();
  const eventSpecialId = overlayEventId || routeEventId;
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();

  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [designatingEmail, setDesignatingEmail] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!eventSpecialId) return;

      setLoading(true);
      setError(null);

      try {
        const eventResponse = await axios.get("/cok/api/v1/events/live", {
          params: { eventSpecialId, limit: 1 }
        });

        if (eventResponse.data?.success && eventResponse.data.data?.length > 0) {
          setEventName(eventResponse.data.data[0].eventName || "");
        }

        const attendeesResponse = await axios.get("/cok/api/v1/attendance", {
          params: { eventSpecialId, limit: 100 }
        });

        if (attendeesResponse.data?.success) {
          setAttendees(attendeesResponse.data.data || []);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err.response?.data?.message || "Failed to load event data or attendees");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventSpecialId]);

  const filteredAttendees = attendees.filter((a) => {
    const q = searchTerm.toLowerCase();
    return (
      !q ||
      a.attendeeFullName?.toLowerCase().includes(q) ||
      a.attendeeEmail?.toLowerCase().includes(q) ||
      a.attendeePosition?.toLowerCase().includes(q) ||
      a.attendeeInstitution?.toLowerCase().includes(q)
    );
  });

  const handleDesignate = async (email, name) => {
    if (!email || !eventSpecialId || designatingEmail) return;

    setDesignatingEmail(email);
    try {
      const response = await axios.post(`/cok/api/v1/events/${eventSpecialId}/minutes/designate`, {
        designatedEmail: email,
        designatedName: name
      });

      if (response.data?.success) {
        showSuccess(response.data.message || "Minutes responsibility designated");
        setManualEmail("");

        try {
          const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          await axios.post("/cok/api/v1/event-actions", {
            title: `Edit meeting minutes${eventName ? ` for "${eventName}"` : ""}`,
            actionDescription: `You have been designated to take and edit the meeting minutes${eventName ? ` for "${eventName}"` : ""}.`,
            assignedPerson: {
              name: name || email,
              email,
              role: "Minutes Taker",
              institution: "City of Kigali",
            },
            createdBy: {
              name: user?.fullName || "System",
              email: user?.email || "system@kigalicity.gov.rw",
              role: user?.role || "",
              institution: "City of Kigali",
            },
            dueDate: tomorrow,
            currentStatus: { status: "Pending", description: "Designated as minutes taker" },
            eventSpecialId,
          });
        } catch (taskErr) {
          showError(taskErr.response?.data?.message || "Designated, but failed to create the follow-up task");
        }
      } else {
        showError(response.data?.message || "Failed to designate minutes responsibility");
      }
    } catch (err) {
      console.error("Error designating:", err);
      showError(err.response?.data?.message || err.message || "Failed to designate minutes responsibility");
    } finally {
      setDesignatingEmail(null);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center px-4" style={{ paddingTop: "80px", backgroundColor: "#F7F9FB" }}>
        <div className="bg-white flex items-center justify-center gap-3 py-14 max-w-sm w-full" style={{ border: `1px solid ${BORDER}` }}>
          <SpiralLoader color={PRIMARY} />
          <p className="text-sm" style={{ fontFamily: fontHeading, color: GRAY_DISABLED }}>Loading attendees...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center px-4" style={{ paddingTop: "80px", backgroundColor: "#F7F9FB" }}>
        <div className="bg-white p-6 max-w-sm w-full text-center" style={{ border: `1px solid ${BORDER}` }}>
          <p className="text-sm mb-4" style={{ color: DANGER, fontFamily: fontHeading }}>{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="cok-btn-primary"
            style={{ width: "auto", padding: "0.6rem 1.4rem" }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex justify-center" style={{ paddingTop: "80px", backgroundColor: "#F7F9FB" }}>
      <div className="w-full max-w-5xl px-3 sm:px-6 md:px-8 py-6">
        {/* Header bar, same component pattern as the attendance form */}
        <div className="px-4 sm:px-5 py-4 text-white mb-5" style={{ backgroundColor: PRIMARY }}>
          <h1 className="text-base sm:text-lg font-bold truncate" style={{ fontFamily: fontHeading }} title={eventName}>
            Designate Minutes Taker
          </h1>
          {eventName && (
            <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
              {eventName}
            </p>
          )}
        </div>

        {/* Mode toggle: full-width segmented control on phones */}
        <div className="grid grid-cols-2 gap-2 mb-5 sm:max-w-sm">
          <button
            onClick={() => setShowManualInput(false)}
            className={!showManualInput ? "cok-btn-primary" : "cok-btn-outlined"}
            style={{ width: "100%", padding: "0.6rem 1rem" }}
          >
            From Attendees
          </button>
          <button
            onClick={() => setShowManualInput(true)}
            className={showManualInput ? "cok-btn-primary" : "cok-btn-outlined"}
            style={{ width: "100%", padding: "0.6rem 1rem" }}
          >
            Manual Entry
          </button>
        </div>

        {showManualInput ? (
          <div className="bg-white p-4 sm:p-5" style={{ border: `1px solid ${BORDER}` }}>
            <label
              className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}
            >
              Email Address
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: PRIMARY }} />
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full cok-auth-input pr-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={() => handleDesignate(manualEmail.trim(), manualEmail.trim())}
                disabled={!manualEmail.trim() || !!designatingEmail}
                className="cok-btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ width: "auto", padding: "0.6rem 1.4rem" }}
              >
                {designatingEmail ? "Designating..." : "Designate"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative mb-4">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: PRIMARY }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, position, institution..."
                className="w-full cok-auth-input pr-3 py-2 text-sm"
              />
            </div>

            {/* Mobile: stacked cards, no sideways scrolling needed */}
            <div className="sm:hidden space-y-2">
              {filteredAttendees.length === 0 ? (
                <div className="bg-white py-10 text-center" style={{ border: `1px solid ${BORDER}` }}>
                  <FiUsers className="w-8 h-8 mx-auto mb-3" style={{ color: "#CCCCCC" }} />
                  <p className="text-sm px-4" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                    {searchTerm ? "No results match your search." : "No attendees found for this event"}
                  </p>
                </div>
              ) : (
                filteredAttendees.map((attendee) => (
                  <div key={attendee._id} className="bg-white p-3" style={{ border: `1px solid ${BORDER}` }}>
                    <p className="text-sm font-semibold break-words" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                      {attendee.attendeeFullName}
                    </p>
                    <p className="text-xs mt-0.5 break-all" style={{ color: GRAY_DISABLED }}>
                      {attendee.attendeeEmail || "No email provided"}
                    </p>
                    <button
                      onClick={() => handleDesignate(attendee.attendeeEmail, attendee.attendeeFullName)}
                      disabled={!!designatingEmail || !attendee.attendeeEmail}
                      className="cok-btn-primary mt-3 disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ padding: "0.55rem 1rem" }}
                    >
                      {designatingEmail === attendee.attendeeEmail ? "Designating..." : "Designate"}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto bg-white" style={{ border: `1px solid ${BORDER}` }}>
              <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: PRIMARY }}>
                    {["Name", "Email", ""].map((h, i) => (
                      <th
                        key={i}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: "#FFFFFF", fontFamily: fontHeading }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendees.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center">
                        <FiUsers className="w-8 h-8 mx-auto mb-3" style={{ color: "#CCCCCC" }} />
                        <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                          {searchTerm ? "No results match your search." : "No attendees found for this event"}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredAttendees.map((attendee, i) => (
                      <tr
                        key={attendee._id}
                        style={{
                          backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#F7F9FB",
                          borderBottom: `1px solid ${BORDER}`,
                        }}
                      >
                        <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                          {attendee.attendeeFullName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#555555" }}>
                          {attendee.attendeeEmail || "-"}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDesignate(attendee.attendeeEmail, attendee.attendeeFullName)}
                            disabled={!!designatingEmail || !attendee.attendeeEmail}
                            className="cok-btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{ width: "auto", padding: "0.45rem 0.9rem" }}
                          >
                            {designatingEmail === attendee.attendeeEmail ? "Designating..." : "Designate"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
