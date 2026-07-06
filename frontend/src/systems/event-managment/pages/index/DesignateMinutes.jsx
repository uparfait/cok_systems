import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import SpiralLoader from "../../components/SpiralLoader";

export default function DesignateMinutes() {
  const { id: eventSpecialId } = useParams();
  const navigate = useNavigate();

  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [designateLoading, setDesignateLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch event details and attendees
  useEffect(() => {
    const fetchData = async () => {
      if (!eventSpecialId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Fetch event details
        const eventResponse = await axios.get("/cok/api/v1/events/live", {
          params: { eventSpecialId, limit: 1 }
        });
        
        if (eventResponse.data?.success && eventResponse.data.data?.length > 0) {
          setEventName(eventResponse.data.data[0].eventName || "");
        }

        // Fetch attendees for this event
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
        setSuccessMessage("Minutes responsibility designated successfully!");
        setTimeout(() => {
          navigate(-1);
        }, 2000);
      }
    } catch (err) {
      console.error("Error designating:", err);
      setError(err.response?.data?.message || "Failed to designate minutes responsibility");
    } finally {
      setDesignateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center p-6 bg-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <SpiralLoader />
          <p className="text-sm text-zinc-600">Loading attendees...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-50">
        <div className="bg-white border border-red-200 p-6 max-w-md w-full text-center">
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-zinc-100 text-zinc-700 font-medium text-sm hover:bg-zinc-200 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (successMessage) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center p-6 bg-zinc-50">
        <div className="bg-white border border-green-200 p-6 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex justify-center p-6 bg-zinc-50">
      <motion.div
        className="w-full max-w-2xl bg-white border border-gray-200 p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-zinc-900">Designate Minutes Taker</h1>
            <p className="text-sm text-zinc-500 mt-1">{eventName}</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-zinc-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toggle between attendees and manual input */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowManualInput(false)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                !showManualInput 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              From Attendees
            </button>
            <button
              onClick={() => setShowManualInput(true)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                showManualInput 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              Manual Entry
            </button>
          </div>

          {/* Manual Email Input */}
          {showManualInput && (
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-4 py-2.5 border border-gray-300 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={() => handleDesignate(manualEmail)}
                disabled={!manualEmail || designateLoading}
                className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {designateLoading ? "Designating..." : "Designate"}
              </button>
            </div>
          )}

          {/* Search for attendees */}
          {!showManualInput && (
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search attendees..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Attendees List */}
        {!showManualInput && (
          <div className="border border-gray-200 max-h-[400px] overflow-y-auto">
            {filteredAttendees.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-zinc-500">No attendees found for this event</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredAttendees.map((attendee) => (
                  <div
                    key={attendee._id}
                    className={`p-4 hover:bg-zinc-50 transition-colors cursor-pointer ${
                      selectedAttendee?._id === attendee._id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                    onClick={() => setSelectedAttendee(attendee)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-zinc-900">{attendee.attendeeFullName}</p>
                        <p className="text-sm text-zinc-500">{attendee.attendeeEmail}</p>
                        {attendee.attendeeInstitution && (
                          <p className="text-xs text-zinc-400 mt-0.5">{attendee.attendeeInstitution}</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDesignate(attendee.attendeeEmail, attendee.attendeeFullName);
                        }}
                        disabled={designateLoading}
                        className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        Designate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Back Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 border border-gray-300 text-zinc-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}