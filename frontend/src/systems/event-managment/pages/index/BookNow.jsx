import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { FiAlertCircle, FiCheckCircle, FiCalendar, FiX, FiArrowLeft } from "react-icons/fi";

import ActivityAgenda from "../../components/sub-components/ActivityAgenda";
import DashboardCalendar from "../dashboard/components/DashboardCalendar";
import TypeSelectionScreen from "./components/TypeSelectionScreen";
import SuccessScreen from "./components/SuccessScreen";
import RoomSelector from "./components/RoomSelector";
import SystemAlert from "@/core/components/SystemAlert";

const BASE_URL = "/cok/api/v1";

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const DANGER = "#E74C3C";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#388E3C";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";

const STEPS = [
  { step: 1, label: "Event Info" }, { step: 2, label: "Organizer" },
  { step: 3, label: "Schedule" }, { step: 4, label: "Room" }, { step: 5, label: "Agenda" },
];

const inputStyle = {
  fontFamily: fontHeading, fontSize: '14px', fontWeight: 500,
  letterSpacing: '0.2px', lineHeight: '1.4', width: '100%', padding: '12px 1rem',
  color: NEUTRAL_DARK, backgroundColor: NEUTRAL_LIGHT, boxSizing: 'border-box',
  border: '0', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  outline: 'none', borderStyle: 'solid', borderWidth: '1px', borderColor: BORDER,
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
};

const labelStyle = {
  fontFamily: fontHeading, fontSize: '13px', fontWeight: 600,
  letterSpacing: '0.5px', lineHeight: '1.4', display: 'block',
  color: NEUTRAL_DARK, textTransform: 'uppercase', marginBottom: '8px',
};

const getBtnStyle = (variant = 'primary', disabled = false) => {
  const base = {
    fontFamily: fontHeading, fontSize: '13px', fontWeight: 600,
    letterSpacing: '1px', lineHeight: '1.4', textTransform: 'uppercase',
    textAlign: 'center', textDecoration: 'none', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', gap: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer', boxSizing: 'border-box',
    border: '0', borderRadius: 0,
    transition: 'background-color 0.2s ease, color 0.2s ease, transform 0.1s ease, opacity 0.2s ease',
    padding: '0.9rem', opacity: disabled ? 0.6 : 1,
  };
  if (variant === 'primary') return { ...base, backgroundColor: PRIMARY, color: WHITE };
  if (variant === 'outline') return { ...base, color: PRIMARY, border: `1px solid ${PRIMARY}`, backgroundColor: 'transparent' };
  if (variant === 'danger') return { ...base, backgroundColor: DANGER, color: WHITE };
  return base;
};

function CreateEventStepper({ currentStep, eventMeetingType, onStepClick, completedSteps }) {
  const showAgenda = eventMeetingType === "meet";
  const activeSteps = showAgenda ? STEPS : STEPS.filter((s) => s.step < 5);
  const scrollRef = useRef(null);
  const stepRefs = useRef({});

  useEffect(() => {
    const el = stepRefs.current[currentStep];
    const container = scrollRef.current;
    if (el && container) {
      const scrollLeft = el.offsetLeft - (container.clientWidth - el.clientWidth) / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [currentStep, activeSteps.length]);

  return (
    <div
      ref={scrollRef}
      className="cok-stepper-scroll flex items-center justify-start sm:justify-center gap-1 sm:gap-0 overflow-x-auto touch-pan-x px-3 sm:px-6 py-3"
      style={{ backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}`, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
    >
      {activeSteps.map((s, idx) => {
        const done = currentStep > s.step;
        const active = currentStep === s.step;
        const canClick = completedSteps.includes(s.step) || done;
        return (
          <div key={s.step} ref={(el) => (stepRefs.current[s.step] = el)} className="flex items-center shrink-0">
            <button type="button" disabled={!canClick} onClick={() => canClick && onStepClick(s.step)}
              className={`flex flex-col items-center justify-center gap-1 transition-all ${canClick ? "cursor-pointer" : "cursor-default"}`}>
              <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={{ backgroundColor: done ? SUCCESS : active ? PRIMARY : '#E0E0E0', color: done || active ? WHITE : '#9E9E9E', borderRadius: 0 }}>
                {done ? <FiCheckCircle className="w-4 h-4" /> : s.step}
              </div>
              <span className="block text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap mt-1"
                style={{ color: done ? SUCCESS : active ? PRIMARY : '#9E9E9E', fontFamily: fontHeading }}>{s.label}</span>
            </button>
            {idx < activeSteps.length - 1 && (
              <div className="h-0.5 w-4 sm:w-12 mx-1 mb-4 transition-all duration-300"
                style={{ backgroundColor: currentStep > s.step ? SUCCESS : BORDER }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function BookNow() {
  const { eventMeetingType: urlType } = useParams();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [trackingCode, setTrackingCode] = useState("");
  const [systemAlert, setSystemAlert] = useState({ isOpen: false, type: "error", message: "" });
  const [step, setStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState({});
  const [completedSteps, setCompletedSteps] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());

  const eventMeetingType = urlType || "event";
  const showAgenda = eventMeetingType === "meet";
  const maxSteps = showAgenda ? 5 : 4;

  const [form, setForm] = useState({
    eventName: "", room: "", description: "", eventType: "",
    organizerNames: "", organizerEmail: "", organizerPhone: "", organizerInstitution: "",
    startTime: "", endTime: "", audience: "",
    agenda: [{ fromTime: "", toTime: "", title: "", description: "" }],
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: null }));
  }

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

  function handleNext() {
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
    setFieldErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  function handleStepClick(targetStep) {
    if (completedSteps.includes(targetStep) || targetStep < step) {
      setFieldErrors({});
      setStep(targetStep);
    }
  }

  async function fetchCalendar(year, month) {
    setCalendarLoading(true);
    try {
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const response = await axios.get(`${BASE_URL}/events/calendar?month=${encodeURIComponent(monthStr)}`);
      if (response.data?.success) setCalendarEvents(response.data.data);
      else setCalendarEvents([]);
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
      setCalendarEvents([]);
    } finally {
      setCalendarLoading(false);
    }
  }

  function handleOpenCalendar() {
    const now = new Date();
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
    setShowCalendar(true);
    fetchCalendar(now.getFullYear(), now.getMonth());
  }

  function handleCloseCalendar() {
    setShowCalendar(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        eventMeetingType: eventMeetingType || "event",
        eventName: form.eventName, eventDescription: form.description, eventType: form.eventType, eventRoom: form.room,
        eventOrganizer: { fullNames: form.organizerNames, email: form.organizerEmail, phone: form.organizerPhone, institution: form.organizerInstitution || "" },
        startTime: new Date(form.startTime).toISOString(), endTime: new Date(form.endTime).toISOString(),
        expectedAudience: Number(form.audience),
        activityAgenda: showAgenda ? form.agenda.filter((a) => a.title.trim()) : [],
      };
      const res = await axios.post(`${BASE_URL}/booking-requests`, payload);
      if (res.data.success) {
        setTrackingCode(res.data.data.trackingCode);
        setSubmitted(true);
      } else {
        setSystemAlert({ isOpen: true, type: "error", message: res.data.message || "Failed to submit request" });
      }
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || "Failed to send request. Please try again.";
      if (status === 500 || status === 505) setSystemAlert({ isOpen: true, type: "systemError", message });
      else setSystemAlert({ isOpen: true, type: "error", message });
    } finally {
      setSubmitting(false);
    }
  }

  if (!urlType) {
    return <TypeSelectionScreen onOpenCalendar={handleOpenCalendar} showCalendar={showCalendar} calendarEvents={calendarEvents} calendarLoading={calendarLoading} calendarYear={calendarYear} calendarMonth={calendarMonth} onMonthChange={(year, month) => { setCalendarYear(year); setCalendarMonth(month); fetchCalendar(year, month); }} onCloseCalendar={handleCloseCalendar} onNavigate={navigate} />;
  }

  if (submitted) {
    return <SuccessScreen trackingCode={trackingCode} eventName={form.eventName} organizerNames={form.organizerNames} room={form.room} onNavigate={navigate} />;
  }

  return (
    <>
      <Helmet><title>BOOK NOW</title><meta name="description" content="Request Room for your event or meeting." /></Helmet>
      <div className="min-h-screen w-full flex flex-col items-center pt-6 justify-center" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <div className="w-full" style={{ maxWidth: '800px' }}>
          <div className="px-6 py-6 text-white mb-0" style={{ backgroundColor: PRIMARY }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                <FiCalendar className="w-4 h-4 text-white" />
              </div>
              <div>
                {/* <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'rgba(255,255,255,0.8)', fontFamily: fontHeading }}>Room Booking</p> */}
                <h1 className="text-xl font-extrabold leading-tight" style={{ fontFamily: fontHeading, letterSpacing: '-0.5px' }}>
                  {eventMeetingType === "meet" ? "Request Meeting Room" : "Request Event Room"}</h1>
              </div>
            </div>
            
          </div>

          <CreateEventStepper currentStep={step} eventMeetingType={eventMeetingType} onStepClick={handleStepClick} completedSteps={completedSteps} />

          <form onSubmit={step === maxSteps ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}
            className="p-6 space-y-5" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderTop: '0' }}>
            <SystemAlert isOpen={systemAlert.isOpen} type={systemAlert.type} message={systemAlert.message} onClose={() => setSystemAlert((s) => ({ ...s, isOpen: false }))} />
            

            {step === 1 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label style={labelStyle}>{eventMeetingType === "meet" ? "Meeting" : "Event"} Name <span style={{ color: DANGER }}>*</span></label>
                    <input style={{ ...inputStyle, borderColor: fieldErrors.eventName ? DANGER : BORDER }}
                      type="text" name="eventName" value={form.eventName} onChange={handleChange}
                      placeholder={`Enter ${eventMeetingType} name`}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(7,142,206,0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = fieldErrors.eventName ? DANGER : BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} />
                    {fieldErrors.eventName && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.eventName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label style={labelStyle}>{eventMeetingType === "meet" ? "Meeting" : "Event"} Type <span style={{ color: DANGER }}>*</span></label>
                    <select style={{ ...inputStyle, borderColor: fieldErrors.eventType ? DANGER : BORDER }}
                      name="eventType" value={form.eventType} onChange={handleChange}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(7,142,206,0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = fieldErrors.eventType ? DANGER : BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}>
                      <option value="">Select type</option>
                      <option value="Internal">Internal</option>
                      <option value="Joint">Joint</option>
                      <option value="External">External</option>
                    </select>
                    {fieldErrors.eventType && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.eventType}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label style={labelStyle}>Expected Audience <span style={{ color: DANGER }}>*</span></label>
                    <input style={{ ...inputStyle, borderColor: fieldErrors.audience ? DANGER : BORDER }}
                      type="number" name="audience" value={form.audience} onChange={handleChange}
                      placeholder="Total head count" min={1}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(7,142,206,0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = fieldErrors.audience ? DANGER : BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} />
                    {fieldErrors.audience && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.audience}</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label style={labelStyle}>Description <span style={{ color: DANGER }}>*</span></label>
                  <textarea style={{ ...inputStyle, borderColor: fieldErrors.description ? DANGER : BORDER, resize: 'vertical', minHeight: '80px' }}
                    name="description" value={form.description} onChange={handleChange}
                    placeholder={`Describe your ${eventMeetingType}...`} rows={3}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(7,142,206,0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = fieldErrors.description ? DANGER : BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} />
                  {fieldErrors.description && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.description}</p>}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label style={labelStyle}>Full Names <span style={{ color: DANGER }}>*</span></label>
                    <input style={{ ...inputStyle, borderColor: fieldErrors.organizerNames ? DANGER : BORDER }}
                      type="text" name="organizerNames" value={form.organizerNames} onChange={handleChange}
                      placeholder="First & Last Names" autoComplete="name"
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(7,142,206,0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = fieldErrors.organizerNames ? DANGER : BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} />
                    {fieldErrors.organizerNames && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.organizerNames}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label style={labelStyle}>Institution <span className="text-xs ml-1" style={{ color: '#9E9E9E' }}>(optional)</span></label>
                    <input style={inputStyle} type="text" name="organizerInstitution"
                      value={form.organizerInstitution} onChange={handleChange}
                      placeholder="Your institution" autoComplete="organization"
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(7,142,206,0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label style={labelStyle}>Email <span style={{ color: DANGER }}>*</span></label>
                    <input style={{ ...inputStyle, borderColor: fieldErrors.organizerEmail ? DANGER : BORDER }}
                      type="email" name="organizerEmail" value={form.organizerEmail} onChange={handleChange}
                      placeholder="name@domain.com" autoComplete="email"
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(7,142,206,0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = fieldErrors.organizerEmail ? DANGER : BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} />
                    {fieldErrors.organizerEmail && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.organizerEmail}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label style={labelStyle}>Phone <span style={{ color: DANGER }}>*</span></label>
                    <input style={{ ...inputStyle, borderColor: fieldErrors.organizerPhone ? DANGER : BORDER }}
                      type="tel" name="organizerPhone" value={form.organizerPhone} onChange={handleChange}
                      placeholder="+250 7XX XXX XXX" autoComplete="tel"
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(7,142,206,0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = fieldErrors.organizerPhone ? DANGER : BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} />
                    {fieldErrors.organizerPhone && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.organizerPhone}</p>}
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <div className="grid  grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label style={labelStyle}>Start <span style={{ color: DANGER }}>*</span></label>
                  <input style={{ ...inputStyle, borderColor: fieldErrors.startTime ? DANGER : BORDER }}
                    type="datetime-local" name="startTime" value={form.startTime} onChange={handleChange}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(7,142,206,0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = fieldErrors.startTime ? DANGER : BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} />
                  {fieldErrors.startTime && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.startTime}</p>}
                </div>
                <div className="space-y-1.5">
                  <label style={labelStyle}>End <span style={{ color: DANGER }}>*</span></label>
                  <input style={{ ...inputStyle, borderColor: fieldErrors.endTime ? DANGER : BORDER }}
                    type="datetime-local"  name="endTime" value={form.endTime} onChange={handleChange}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(7,142,206,0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = fieldErrors.endTime ? DANGER : BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} />
                  {fieldErrors.endTime && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.endTime}</p>}
                </div>
              </div>
            )}

            {step === 4 && (
              <RoomSelector form={form} rooms={[]} onChange={(name, val) => {
                setForm((prev) => ({ ...prev, [name]: val }));
                if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: null }));
              }} startTime={form.startTime} endTime={form.endTime} errors={fieldErrors} eventMeetingType={eventMeetingType} onBack={handleBack} />
            )}

            {step === 5 && showAgenda && (
              <ActivityAgenda agenda={form.agenda} onChange={(agenda) => setForm((prev) => ({ ...prev, agenda }))}
                eventStartTime={form.startTime ? form.startTime.split("T")[1]?.substring(0, 5) : null}
                eventEndTime={form.endTime ? form.endTime.split("T")[1]?.substring(0, 5) : null} />
            )}
            {step === 5 && !showAgenda && (
              <div className="p-4 text-center" style={{ backgroundColor: '#E3F2FD', border: `1px solid ${BORDER}` }}>
                <p className="text-sm font-medium" style={{ color: PRIMARY, fontFamily: fontHeading }}>No agenda required</p>
                <p className="text-xs mt-1" style={{ color: '#9E9E9E', fontFamily: fontHeading }}>External events do not require an activity agenda.</p>
              </div>
            )}
            

            <div className="mt-2" style={{ borderTop: `1px solid ${BORDER}`, paddingTop: '20px' }}>
              <div className="flex items-stretch gap-3">
                <button type="button" onClick={() => navigate("/book-a-room/options")}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all shrink-0"
                  style={{ border: `1px solid ${PRIMARY}`, color: PRIMARY, backgroundColor: WHITE, fontFamily: fontHeading, borderRadius: 0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; e.currentTarget.style.color = WHITE; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = WHITE; e.currentTarget.style.color = PRIMARY; }}>
                  <FiX className="w-4 h-4" /> Cancel
                </button>
                {step < maxSteps ? (
                  <button type="submit" style={{ ...getBtnStyle('primary'), flex: 1 }}>Next</button>
                ) : (
                  <button type="submit" disabled={submitting} style={{ ...getBtnStyle('primary', submitting), flex: 1 }} className="flex items-center justify-center gap-2"
                    onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                    onMouseLeave={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = PRIMARY; }}>
                    {submitting ? (
                      <><div style={{ width: 16, height: 16, border: `2px solid ${WHITE}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '8px' }} />Submitting...</>
                    ) : (<><FiCheckCircle style={{ width: 16, height: 16 }} /> Submit Booking Request</>)}
                  </button>
                )}
              </div>
              {step > 1 && (
                <button type="button" onClick={handleBack} style={{ ...getBtnStyle('outline'), width: '100%', marginTop: '12px' }}>Back</button>
              )}
            </div>
            <p className="text-center text-xs" style={{ color: '#9E9E9E', fontFamily: fontHeading }}>
              Fields marked with <span style={{ color: DANGER }}>*</span> are required</p>
          </form>
         
        </div>
      </div>
    </>
  );
}
