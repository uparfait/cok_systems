import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import SpiralLoader from "../../components/SpiralLoader";
import SystemAlert from "@/core/components/SystemAlert";

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#248fc2";

export default function DesignateMinutes() {
  const { id: eventSpecialId } = useParams();
  const navigate = useNavigate();

  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [designateLoading, setDesignateLoading] = useState(false);
  const [systemAlert, setSystemAlert] = useState({ isOpen: false, type: "success", message: "" });

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
        setError("Failed to load event data or attendees");
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
    if (!email || !eventSpecialId) return;

    setDesignateLoading(true);
    try {
      const response = await axios.post(`/cok/api/v1/events/${eventSpecialId}/minutes/designate`, {
        designatedEmail: email,
        designatedName: name
      });

      if (response.data?.success) {
        setSystemAlert({ isOpen: true, type: "success", message: "Minutes responsibility designated successfully!" });
      }
    } catch (err) {
      console.error("Error designating:", err);
      setSystemAlert({ isOpen: true, type: "error", message: err.response?.data?.message || "Failed to designate minutes responsibility" });
    } finally {
      setDesignateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center" style={{ paddingTop: '80px', backgroundColor: '#F7F9FB' }}>
        <div className="flex flex-col items-center gap-4">
          <SpiralLoader color="#056daa" />
          <p className="text-sm" style={{ fontFamily: "'Montserrat', sans-serif", color: '#888888' }}>Loading attendees...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center" style={{ paddingTop: '80px', backgroundColor: '#F7F9FB' }}>
        <div className="bg-white border border-red-200 p-6 max-w-md w-full text-center" style={{ borderRadius: 0 }}>
          <p className="text-sm mb-4" style={{ color: '#C62828', fontFamily: "'Montserrat', sans-serif" }}>{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 text-white text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
            style={{ backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif", cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex justify-center" style={{ paddingTop: '80px', backgroundColor: '#F7F9FB' }}>
      <div className="w-full max-w-5xl px-4 sm:px-6 md:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-base sm:text-lg font-bold text-zinc-900 uppercase tracking-wide" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Designate
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {eventName}
          </p>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-2">
            <button
              onClick={() => setShowManualInput(false)}
              className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
              style={{
                fontFamily: "'Montserrat', sans-serif",
                backgroundColor: !showManualInput ? PRIMARY : '#FFFFFF',
                color: !showManualInput ? '#FFFFFF' : PRIMARY,
                border: `1px solid ${PRIMARY}`,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!showManualInput) e.currentTarget.style.backgroundColor = PRIMARY_HOVER;
                else { e.currentTarget.style.backgroundColor = '#F7F9FB'; }
              }}
              onMouseLeave={(e) => {
                if (!showManualInput) e.currentTarget.style.backgroundColor = PRIMARY;
                else { e.currentTarget.style.backgroundColor = '#FFFFFF'; }
              }}
            >
              From Attendees
            </button>
            <button
              onClick={() => setShowManualInput(true)}
              className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
              style={{
                fontFamily: "'Montserrat', sans-serif",
                backgroundColor: showManualInput ? PRIMARY : '#FFFFFF',
                color: showManualInput ? '#FFFFFF' : PRIMARY,
                border: `1px solid ${PRIMARY}`,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (showManualInput) e.currentTarget.style.backgroundColor = PRIMARY_HOVER;
                else { e.currentTarget.style.backgroundColor = '#F7F9FB'; }
              }}
              onMouseLeave={(e) => {
                if (showManualInput) e.currentTarget.style.backgroundColor = PRIMARY;
                else { e.currentTarget.style.backgroundColor = '#FFFFFF'; }
              }}
            >
              Manual Entry
            </button>
          </div>

          {showManualInput && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: PRIMARY }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full pl-10 pr-4 py-3 text-sm outline-none"
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: '14px',
                    fontWeight: 500,
                    letterSpacing: '0.2px',
                    lineHeight: '1.4',
                    color: '#333333',
                    backgroundColor: '#F7F9FB',
                    borderRadius: 0,
                    border: '1px solid transparent',
                    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
                    transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = PRIMARY;
                    e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)';
                  }}
                />
              </div>
              <button
                onClick={() => handleDesignate(manualEmail, manualEmail)}
                disabled={!manualEmail || designateLoading}
                className="px-6 py-3 text-white text-xs font-semibold uppercase tracking-wider rounded-none transition-colors disabled:opacity-60"
                style={{ backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif", cursor: 'pointer' }}
                onMouseEnter={(e) => { if (!manualEmail || designateLoading) return; e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                onMouseDown={(e) => { if (!designateLoading) e.currentTarget.style.transform = 'translateY(1px)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {designateLoading ? "Designating..." : "Designate"}
              </button>
            </div>
          )}
        </div>

        {!showManualInput && (
          <>
            <div className="relative mb-4">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: PRIMARY }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search attendees..."
                className="w-full pl-10 pr-4 py-3 text-sm outline-none"
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: '14px',
                  fontWeight: 500,
                  letterSpacing: '0.2px',
                  lineHeight: '1.4',
                  color: '#333333',
                  backgroundColor: '#F7F9FB',
                  borderRadius: 0,
                  border: '1px solid transparent',
                  boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
                  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = PRIMARY;
                  e.currentTarget.style.boxShadow = '0px 4px 8px rgba(52, 168, 219, 0.25)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.1)';
                }}
              />
            </div>

            <div className="block border overflow-x-auto rounded-none" style={{ borderColor: '#E0E0E0' }}>
              <table className="w-full text-sm rounded-none">
                <thead>
                  <tr style={{ backgroundColor: PRIMARY }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>Email</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendees.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center">
                        <p className="text-sm" style={{ color: '#888888', fontFamily: "'Montserrat', sans-serif" }}>No attendees found for this event</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAttendees.map((attendee) => (
                      <tr key={attendee._id} className="border-t" style={{ borderTopColor: '#E0E0E0', backgroundColor: '#FFFFFF' }}>
                        <td className="px-4 py-3 font-medium text-zinc-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{attendee.attendeeFullName}</td>
                        <td className="px-4 py-3 text-zinc-600" style={{ fontFamily: "'Montserrat', sans-serif" }}>{attendee.attendeeEmail}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDesignate(attendee.attendeeEmail, attendee.attendeeFullName)}
                            disabled={designateLoading}
                            className="px-4 py-2 text-white text-xs font-semibold uppercase tracking-wider rounded-none transition-colors disabled:opacity-60"
                            style={{ backgroundColor: PRIMARY, fontFamily: "'Montserrat', sans-serif", cursor: 'pointer' }}
                            onMouseEnter={(e) => { if (!designateLoading) e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
                            onMouseDown={(e) => { if (!designateLoading) e.currentTarget.style.transform = 'translateY(1px)'; }}
                            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                          >
                            Designate
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

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
            style={{ border: `1px solid ${PRIMARY}`, color: PRIMARY, backgroundColor: 'transparent', fontFamily: "'Montserrat', sans-serif", cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = PRIMARY; }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Cancel
          </button>
        </div>
      </div>

      <SystemAlert
        isOpen={systemAlert.isOpen}
        type={systemAlert.type}
        message={systemAlert.message}
        onClose={() => setSystemAlert((s) => ({ ...s, isOpen: false }))}
      />
    </div>
  );
}
