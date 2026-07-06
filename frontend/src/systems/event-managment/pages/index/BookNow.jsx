import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiPlus,
  FiTrash2,
  FiCalendar,
  FiUsers,
  FiArrowRight,
  FiMapPin,
  FiAlertTriangle,
} from "react-icons/fi";
import SpiralLoader from "../../components/SpiralLoader";
import ActivityAgenda from "../../components/sub-components/ActivityAgenda";

const BASE_URL = "/cok/api/v1";

const STEPS = [
  { step: 1, label: "Event Info" },
  { step: 2, label: "Organizer" },
  { step: 3, label: "Schedule" },
  { step: 4, label: "Room" },
  { step: 5, label: "Agenda" },
];

const inputClass =
  "w-full px-4 py-3 border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 bg-white";
const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

function CreateEventStepper({ currentStep, eventMeetingType, onStepClick, completedSteps }) {
  const showAgenda = eventMeetingType === "meet";
  const activeSteps = showAgenda ? STEPS : STEPS.filter((s) => s.step < 5);

  return (
    <div className="flex items-center justify-center px-6 py-5 bg-white border-b border-gray-200">
      {activeSteps.map((s, idx) => {
        const done = currentStep > s.step;
        const active = currentStep === s.step;
        const canClick = completedSteps.includes(s.step) || done;
        return (
          <div key={s.step} className="flex items-center">
            <button
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onStepClick(s.step)}
              className={`flex flex-col items-center gap-1 transition-all ${canClick ? "cursor-pointer" : "cursor-default"}`}
            >
              <div
                className={`w-8 h-8 flex items-center justify-center text-xs font-bold transition-all duration-300
                ${done ? "bg-green-500 text-white" : active ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}
              >
                {done ? <FiCheckCircle className="w-4 h-4" /> : s.step}
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap
                ${done ? "text-green-600" : active ? "text-blue-600" : "text-gray-400"}`}
              >
                {s.label}
              </span>
            </button>
            {idx < activeSteps.length - 1 && (
              <div
                className={`h-0.5 w-6 sm:w-12 mx-1 mb-4 transition-all duration-300
                ${currentStep > s.step ? "bg-green-400" : "bg-gray-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function RoomSelector({ form, rooms, onChange, startTime, endTime, errors, eventMeetingType }) {
  const [availableRooms, setAvailableRooms] = useState([]);
  const [unavailableRooms, setUnavailableRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const hasDates = startTime && endTime;

  useEffect(() => {
    if (!hasDates) return;
    const checkRooms = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          eventMode: "upcoming",
        };
        const res = await axios.get(`${BASE_URL}/rooms/available`, { params });
        const data = res.data?.data || res.data;
        setAvailableRooms(data.availableRooms || []);
        setUnavailableRooms(data.unavailableRooms || []);
        setSearched(true);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to check availability");
      } finally {
        setLoading(false);
      }
    };
    checkRooms();
  }, [startTime, endTime, hasDates]);

  const isSelected = (roomName) => form.room?.toLowerCase() === roomName.toLowerCase();

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Room Selection</h2>
      <p className="text-xs text-gray-500">Rooms are checked for availability based on your selected schedule.</p>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6"><SpiralLoader /></div>
          <span className="ml-2 text-sm text-gray-500">Checking rooms...</span>
        </div>
      )}

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 p-3 flex items-start gap-2">
          <FiAlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-xs text-yellow-700">{error}</p>
        </div>
      )}

      {!hasDates && !loading && (
        <div className="bg-gray-50 border border-gray-200 p-4 text-center">
          <FiCalendar className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-500">Set your schedule first, then rooms will be checked automatically.</p>
        </div>
      )}

      {hasDates && !loading && searched && (
        <div className="space-y-3">
          {form.room && availableRooms.length > 0 && !availableRooms.find((r) => r.room.roomName.toLowerCase() === form.room.toLowerCase()) && (
            <div className="bg-yellow-50 border border-yellow-200 p-3">
              <p className="text-xs text-yellow-700 font-medium">
                Previously selected room "{form.room}" is no longer available with current settings.
              </p>
            </div>
          )}
          {availableRooms.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-2">
                Available Rooms ({availableRooms.length} of {availableRooms.length + unavailableRooms.length})
              </p>
              <div className="space-y-2">
                {availableRooms.map((item, idx) => {
                  const selected = isSelected(item.room.roomName);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onChange("room", item.room.roomName)}
                      className={`w-full text-left p-3 border-2 transition-all duration-200 ${
                        selected
                          ? "border-green-500 bg-green-50 ring-2 ring-green-200"
                          : "border-green-200 bg-white hover:border-green-400 hover:bg-green-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <FiCheckCircle className={`w-4 h-4 mt-0.5 shrink-0 ${selected ? "text-green-600" : "text-green-400"}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 capitalize truncate">{item.room.roomName}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3 shrink-0" /> {item.room.roomLocation}</span>
                              <span>Capacity: {item.room.roomCapacity}</span>
                            </div>
                          </div>
                        </div>
                        {selected && <span className="text-xs font-bold text-green-700 bg-green-100 border border-green-300 px-2.5 py-0.5 shrink-0">Selected</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {availableRooms.length === 0 && (
            <div className="bg-orange-50 border border-orange-200 p-6 text-center">
              <FiAlertCircle className="w-10 h-10 text-orange-400 mx-auto mb-3" />
              <p className="text-sm font-bold text-orange-800 mb-1">All Rooms Are Occupied</p>
              <p className="text-xs text-orange-600 mb-3">
                No rooms are available for the selected schedule: {new Date(startTime).toLocaleString()} - {new Date(endTime).toLocaleString()}
              </p>
              <p className="text-xs text-orange-500">
                Please go back to the Schedule step and choose different dates or times.
              </p>
            </div>
          )}
        </div>
      )}
      {errors.room && <p className="text-xs text-red-500">{errors.room}</p>}
    </div>
  );
}

export default function BookNow() {
  const { eventMeetingType: urlType } = useParams();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [trackingCode, setTrackingCode] = useState("");
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState({});
  const [completedSteps, setCompletedSteps] = useState([]);

  const eventMeetingType = urlType || "event";
  const showAgenda = eventMeetingType === "meet";
  const maxSteps = showAgenda ? 5 : 4;

  const [form, setForm] = useState({
    eventName: "",
    room: "",
    description: "",
    eventType: "",
    organizerNames: "",
    organizerEmail: "",
    organizerPhone: "",
    organizerInstitution: "",
    startTime: "",
    endTime: "",
    audience: "",
    agenda: [{ fromTime: "", toTime: "", title: "", description: "" }],
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: null }));
  }

  const selectedRoom = rooms?.find((r) => r.roomName === form.room);
  const audienceExceedsCapacity = selectedRoom && form.audience && Number(form.audience) > selectedRoom.roomCapacity;

  function validateStep1() {
    const errs = {};
    if (!form.eventName.trim()) errs.eventName = "Event name is required";
    if (!form.eventType) errs.eventType = "Please select an event type";
    if (!form.audience || Number(form.audience) < 1) errs.audience = "Expected audience is required";
    if (!form.description.trim()) errs.description = "Description is required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2() {
    const errs = {};
    if (!form.organizerNames.trim()) errs.organizerNames = "Full names are required";
    if (!form.organizerEmail.trim()) errs.organizerEmail = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.organizerEmail.trim()))
      errs.organizerEmail = "Enter a valid email address";
    if (!form.organizerPhone.trim()) errs.organizerPhone = "Phone number is required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep3() {
    const errs = {};
    if (!form.startTime) errs.startTime = "Start time is required";
    if (!form.endTime) errs.endTime = "End time is required";
    else if (form.startTime && new Date(form.endTime) <= new Date(form.startTime))
      errs.endTime = "End time must be after start time";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep4() {
    const errs = {};
    if (!form.room) errs.room = "Please select a room";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateAgendaTimelines() {
    if (!form.startTime || !form.endTime) return true;
    // ActivityAgenda uses fromTime/toTime; validation is handled inside that component
    // This function is kept for backward compatibility
    return true;
  }

  function handleNext() {
    setError(null);
    let valid = false;
    if (step === 1 && validateStep1()) valid = true;
    else if (step === 2 && validateStep2()) valid = true;
    else if (step === 3 && validateStep3()) valid = true;
    else if (step === 4 && validateStep4()) valid = true;

    if (valid) {
      setCompletedSteps((prev) => (prev.includes(step) ? prev : [...prev, step]));
      setStep((s) => Math.min(maxSteps, s + 1));
    }
  }

  function handleBack() {
    setError(null);
    setFieldErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  function handleStepClick(targetStep) {
    if (completedSteps.includes(targetStep) || targetStep < step) {
      setError(null);
      setFieldErrors({});
      setStep(targetStep);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (showAgenda && !validateAgendaTimelines()) {
      setError("Agenda item times must fall within the event start and end schedule.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        eventMeetingType: eventMeetingType || "event",
        eventName: form.eventName,
        eventDescription: form.description,
        eventType: form.eventType,
        eventRoom: form.room,
        eventOrganizer: {
          fullNames: form.organizerNames,
          email: form.organizerEmail,
          phone: form.organizerPhone,
          institution: form.organizerInstitution || "",
        },
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        expectedAudience: Number(form.audience),
        activityAgenda: showAgenda ? form.agenda.filter((a) => a.title.trim()) : [],
      };

      const res = await axios.post(`${BASE_URL}/booking-requests`, payload);
      if (res.data.success) {
        setTrackingCode(res.data.data.trackingCode);
        setSubmitted(true);
      } else {
        setError(res.data.message || "Failed to submit request");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Type Selection Screen - matches dashboard NewTypeSelector pattern
  if (!urlType) {
    return (
      <>
        <Helmet>
          <title>Book Now | KCE Portal</title>
          <meta name="description" content="Choose event or meeting type." />
        </Helmet>
        <div className="min-h-screen bg-gray-50 w-full max-w-[70%] min-w-[300px] flex flex-col items-center justify-start pt-20">
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <p className="text-sm text-zinc-500 font-medium">What would you like to book?</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => navigate("/book-a-room/new/event")}
                className="group relative bg-white border-2 border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all duration-200 p-8 text-left"
              >
                <div className="w-14 h-14 bg-blue-100 flex items-center justify-center mb-5 group-hover:bg-blue-600 transition-colors duration-200">
                  <FiCalendar className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors duration-200" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Event</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">
                  Book a room for an event with full scheduling capabilities.
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 bg-blue-500 inline-block rounded-full" />
                    Event scheduling & room booking
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 bg-blue-500 inline-block rounded-full" />
                    QR code attendance tracking
                  </li>
                </ul>
                <div className="flex items-center gap-1 text-sm font-semibold text-blue-600 group-hover:text-blue-700">
                  Book Event <FiArrowRight className="w-4 h-4" />
                </div>
              </button>
              <button
                onClick={() => navigate("/book-a-room/new/meet")}
                className="group relative bg-white border-2 border-gray-200 hover:border-emerald-500 hover:shadow-lg transition-all duration-200 p-8 text-left"
              >
                <div className="w-14 h-14 bg-emerald-100 flex items-center justify-center mb-5 group-hover:bg-emerald-600 transition-colors duration-200">
                  <FiUsers className="w-7 h-7 text-emerald-600 group-hover:text-white transition-colors duration-200" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Meet</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">
                  Book a room for a meeting with agenda planning.
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 bg-emerald-500 inline-block rounded-full" />
                    Meeting scheduling & room booking
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 bg-emerald-500 inline-block rounded-full" />
                    Activity agenda planning
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 bg-emerald-500 inline-block rounded-full" />
                    Action items & follow-ups
                  </li>
                </ul>
                <div className="flex items-center gap-1 text-sm font-semibold text-emerald-600 group-hover:text-emerald-700">
                  Book Meet <FiArrowRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Success Screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-gray-200 p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 flex items-center justify-center mx-auto">
            <FiCheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Request Submitted!</h2>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              Your booking request for <span className="font-semibold text-gray-700">{form.eventName}</span> has been submitted successfully.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-200 p-3 text-left text-xs text-gray-600 space-y-1">
            <p><span className="font-medium">Tracking Code:</span> <span className="font-mono font-bold text-blue-600">{trackingCode}</span></p>
            <p><span className="font-medium">Organizer:</span> {form.organizerNames}</p>
            <p><span className="font-medium">Room:</span> {selectedRoom?.roomName || form.room}</p>
          </div>
          <p className="text-xs text-gray-400">Save your tracking code to check the status later.</p>
          <button onClick={() => navigate(`/book-a-room/track?code=${trackingCode}`)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Track this booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Book Now | KCE Portal</title>
        <meta name="description" content="Request Room for your event or meeting." />
      </Helmet>

      <div className="min-h-screen bg-gray-50 w-full max-w-[70%] min-w-[300px] flex flex-col items-center justify-start">
        <div className="w-full">
          <div className="bg-blue-600 px-6 py-5 text-white mb-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-white/20 flex items-center justify-center shrink-0">
                <FiCalendar className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-blue-200 uppercase tracking-wide font-medium">Room Booking</p>
                <h1 className="text-base font-bold leading-tight">
                  {eventMeetingType === "meet" ? "Request Meeting Room" : "Request Event Room"}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-blue-100">
              <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5">City of Kigali</span>
              <span className="flex items-center gap-1">Event Management System</span>
            </div>
          </div>

          <CreateEventStepper
            currentStep={step}
            eventMeetingType={eventMeetingType}
            onStepClick={handleStepClick}
            completedSteps={completedSteps}
          />

          <form
            onSubmit={step === maxSteps ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}
            className="bg-white border border-gray-200 border-t-0 p-6 space-y-5"
          >
            {error && (
              <div className="bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                <FiAlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Step 1: Event Info */}
            {step === 1 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>{eventMeetingType === "meet" ? "Meeting" : "Event"} Name <span className="text-red-500">*</span></label>
                    <input className={`${inputClass} ${fieldErrors.eventName ? "border-red-400" : ""}`}
                      type="text" name="eventName" value={form.eventName} onChange={handleChange}
                      placeholder={`Enter ${eventMeetingType} name`} />
                    {fieldErrors.eventName && <p className="text-xs text-red-500">{fieldErrors.eventName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>{eventMeetingType === "meet" ? "Meeting" : "Event"} Type <span className="text-red-500">*</span></label>
                    <select className={`${inputClass} ${fieldErrors.eventType ? "border-red-400" : ""}`}
                      name="eventType" value={form.eventType} onChange={handleChange}>
                      <option value="" disabled>Select type</option>
                      <option value="Internal">Internal</option>
                      <option value="Joint">Joint</option>
                      <option value="External">External</option>
                    </select>
                    {fieldErrors.eventType && <p className="text-xs text-red-500">{fieldErrors.eventType}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Expected Audience <span className="text-red-500">*</span></label>
                    <input className={`${inputClass} ${fieldErrors.audience ? "border-red-400" : ""}`}
                      type="number" name="audience" value={form.audience} onChange={handleChange}
                      placeholder="Total head count" min={1} />
                    {fieldErrors.audience && <p className="text-xs text-red-500">{fieldErrors.audience}</p>}
                    {audienceExceedsCapacity && (
                      <div className="text-xs font-medium text-amber-600 flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 mt-1">
                        <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Exceeds room capacity ({selectedRoom.roomCapacity}).</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Description <span className="text-red-500">*</span></label>
                  <textarea className={`${inputClass} resize-y min-h-[80px] ${fieldErrors.description ? "border-red-400" : ""}`}
                    name="description" value={form.description} onChange={handleChange}
                    placeholder={`Describe your ${eventMeetingType}...`} rows={3} />
                  {fieldErrors.description && <p className="text-xs text-red-500">{fieldErrors.description}</p>}
                </div>
              </>
            )}

            {/* Step 2: Organizer */}
            {step === 2 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Full Names <span className="text-red-500">*</span></label>
                    <input className={`${inputClass} ${fieldErrors.organizerNames ? "border-red-400" : ""}`}
                      type="text" name="organizerNames" value={form.organizerNames} onChange={handleChange}
                      placeholder="First & Last Names" autoComplete="name" />
                    {fieldErrors.organizerNames && <p className="text-xs text-red-500">{fieldErrors.organizerNames}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Institution <span className="text-xs text-gray-400 ml-1">(optional)</span></label>
                    <input className={inputClass} type="text" name="organizerInstitution"
                      value={form.organizerInstitution} onChange={handleChange}
                      placeholder="Your institution" autoComplete="organization" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Email <span className="text-red-500">*</span></label>
                    <input className={`${inputClass} ${fieldErrors.organizerEmail ? "border-red-400" : ""}`}
                      type="email" name="organizerEmail" value={form.organizerEmail} onChange={handleChange}
                      placeholder="name@domain.com" autoComplete="email" />
                    {fieldErrors.organizerEmail && <p className="text-xs text-red-500">{fieldErrors.organizerEmail}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Phone <span className="text-red-500">*</span></label>
                    <input className={`${inputClass} ${fieldErrors.organizerPhone ? "border-red-400" : ""}`}
                      type="tel" name="organizerPhone" value={form.organizerPhone} onChange={handleChange}
                      placeholder="+250 7XX XXX XXX" autoComplete="tel" />
                    {fieldErrors.organizerPhone && <p className="text-xs text-red-500">{fieldErrors.organizerPhone}</p>}
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Schedule */}
            {step === 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>Start <span className="text-red-500">*</span></label>
                  <input className={`${inputClass} ${fieldErrors.startTime ? "border-red-400" : ""}`}
                    type="datetime-local" name="startTime" value={form.startTime} onChange={handleChange} />
                  {fieldErrors.startTime && <p className="text-xs text-red-500">{fieldErrors.startTime}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>End <span className="text-red-500">*</span></label>
                  <input className={`${inputClass} ${fieldErrors.endTime ? "border-red-400" : ""}`}
                    type="datetime-local" name="endTime" value={form.endTime} onChange={handleChange} />
                  {fieldErrors.endTime && <p className="text-xs text-red-500">{fieldErrors.endTime}</p>}
                </div>
              </div>
            )}

            {/* Step 4: Room */}
            {step === 4 && (
              <RoomSelector
                form={form}
                rooms={rooms}
                onChange={(name, val) => {
                  setForm((prev) => ({ ...prev, [name]: val }));
                  if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: null }));
                }}
                startTime={form.startTime}
                endTime={form.endTime}
                errors={fieldErrors}
                eventMeetingType={eventMeetingType}
              />
            )}

            {/* Step 5: Agenda (only for meet) */}
            {step === 5 && showAgenda && (
              <ActivityAgenda
                agenda={form.agenda}
                onChange={(agenda) => setForm((prev) => ({ ...prev, agenda }))}
                eventStartTime={form.startTime ? form.startTime.split("T")[1]?.substring(0, 5) : null}
                eventEndTime={form.endTime ? form.endTime.split("T")[1]?.substring(0, 5) : null}
              />
            )}
            {step === 5 && !showAgenda && (
              <div className="bg-blue-50 border border-blue-200 p-4 text-center">
                <p className="text-sm text-blue-700 font-medium">No agenda required</p>
                <p className="text-xs text-blue-500 mt-1">External events do not require an activity agenda.</p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-2">
              {step > 1 && (
                <button type="button" onClick={handleBack}
                  className="flex-1 py-3 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Back
                </button>
              )}
              {step < maxSteps ? (
                <button type="submit" className={`py-3 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all ${step === 1 ? "w-full" : "flex-1"}`}>
                  Next
                </button>
              ) : (
                <button type="submit" disabled={submitting}
                  className="flex-1 py-3 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                  {submitting ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting...</>
                  ) : (
                    <><FiCheckCircle className="w-4 h-4" /> Submit Booking Request</>
                  )}
                </button>
              )}
            </div>
            <p className="text-center text-xs text-gray-400">
              Fields marked with <span className="text-red-500">*</span> are required
            </p>
          </form>
          <p className="text-center text-xs text-gray-400 mt-4 pb-8">City of Kigali @ Event Management System</p>
        </div>
      </div>
    </>
  );
}