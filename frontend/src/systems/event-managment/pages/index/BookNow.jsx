import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { FiCheckCircle, FiCalendar, FiX, FiUser, FiMail, FiPhone, FiMapPin } from "react-icons/fi";

import ActivityAgenda from "../../components/sub-components/ActivityAgenda";
import EventFormatFields from "../../components/sub-components/EventFormatFields";
import TimeInput24 from "../../components/sub-components/TimeInput24";
import DashboardCalendar from "../dashboard/components/DashboardCalendar";
import TypeSelectionScreen from "./components/TypeSelectionScreen";
import SuccessScreen from "./components/SuccessScreen";
import RoomSelector from "./components/RoomSelector";
import { useToast } from "@/core/contexts/ToastContext";


const BASE_URL = "/cok/api/v1";

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const DANGER = "#E74C3C";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#388D3C";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";

const buildSteps = (eventMeetingType) => [
  { step: 1, label: `${eventMeetingType === "meet" ? "Meeting" : "Event"} Info` }, { step: 2, label: "Organizer" },
  { step: 3, label: "Schedule" }, { step: 4, label: "Location" }, { step: 5, label: "Agenda" },
];

const labelStyle = {
  fontFamily: fontHeading, fontSize: '13px', fontWeight: 600,
  letterSpacing: '0.5px', lineHeight: '1.4', display: 'block',
  color: NEUTRAL_DARK, textTransform: 'uppercase', marginBottom: '8px',
};

const inputClassName = "w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base";

function CreateEventStepper({ currentStep, eventMeetingType, onStepClick, completedSteps }) {
  const showAgenda = eventMeetingType === "meet";
  const steps = buildSteps(eventMeetingType);
  const activeSteps = showAgenda ? steps : steps.filter((s) => s.step < 5);
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
              className="flex flex-col items-center justify-center gap-1 transition-all cursor-pointer">
              <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={{ backgroundColor: done ? SUCCESS : active ? PRIMARY : '#E0E0E0', color: done || active ? WHITE : '#9E9E9E', borderRadius: '50%' }}>
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
  const [scheduleStart, setScheduleStart] = useState(null);
  const [scheduleEnd, setScheduleEnd] = useState(null);
  const [trackingCode, setTrackingCode] = useState("");
  const [step, setStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState({});
  const [completedSteps, setCompletedSteps] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());

  const { showError, showSuccess } = useToast();

  const eventMeetingType = urlType || "event";
  const typeWord = eventMeetingType === "meet" ? "meeting" : "event";
  const showAgenda = eventMeetingType === "meet";
  const maxSteps = showAgenda ? 5 : 4;

  const [form, setForm] = useState({
    eventName: "", room: "", description: "", eventType: "",
    eventFormat: "Physical", virtualLink: "", virtualDescription: "",
    organizerNames: "", organizerEmail: "", organizerPhone: "", organizerInstitution: "",
    eventDate: "", fromTime: "", toTime: "", audience: "",
    agenda: [{ fromTime: "", toTime: "", title: "", description: "" }],
  });

  const computeSchedule = (snapshot = form) => {
    if (!snapshot.eventDate || !snapshot.fromTime || !snapshot.toTime) {
      return { start: null, end: null };
    }
    const start = new Date(`${snapshot.eventDate}T${snapshot.fromTime}`);
    const end = new Date(`${snapshot.eventDate}T${snapshot.toTime}`);
    return { start, end };
  };

  const validateField = (name, value, snapshot) => {
    const f = { ...snapshot, [name]: value };
    switch (name) {
      case 'eventName':
        return value.trim() ? null : 'Event name is required';
      case 'eventType':
        return value ? null : 'Please select an event type';
      case 'audience':
        if (!value || Number(value) < 1) return 'Expected audience is required';
        return null;
      case 'description':
        return value.trim() ? null : 'Description is required';
      case 'organizerNames':
        return value.trim() ? null : 'Full names are required';
      case 'organizerEmail':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address';
        return null;
      case 'organizerPhone':
        return value.trim() ? null : 'Phone number is required';
      case 'eventDate':
        return f.eventDate ? null : 'Date is required';
      case 'fromTime':
        return f.fromTime ? null : 'Start time is required';
      case 'toTime':
        if (!f.toTime) return 'End time is required';
        if (f.fromTime && f.toTime) {
          const { start, end } = computeSchedule(f);
          if (start && end && (isNaN(start.getTime()) || isNaN(end.getTime()))) return 'Invalid time';
          if (start && end && end <= start) return 'End time must be after start time';
        }
        return null;
      case 'room':
        if (f.eventFormat === 'Virtual') return null;
        return value ? null : 'Please select a room';
      case 'virtualLink':
        if (f.eventFormat === 'Virtual' && value && !/^https?:\/\/\S+$/i.test(value.trim())) {
          return 'Meeting link must be a valid http(s) URL';
        }
        return null;
      default:
        return null;
    }
  };

  const validateStep1 = () => {
    const names = ['eventName', 'eventType', 'audience', 'description'];
    const errs = {};
    names.forEach((n) => { errs[n] = validateField(n, form[n], form); });
    setFieldErrors(errs);
    const first = names.map((n) => errs[n]).find((e) => e);
    return !first;
  };

  const validateStep2 = () => {
    const names = ['organizerNames', 'organizerEmail', 'organizerPhone'];
    const errs = {};
    names.forEach((n) => { errs[n] = validateField(n, form[n], form); });
    setFieldErrors(errs);
    const first = names.map((n) => errs[n]).find((e) => e);
    return !first;
  };

  const validateStep3 = () => {
    const names = ['eventDate', 'fromTime', 'toTime'];
    const errs = {};
    names.forEach((n) => { errs[n] = validateField(n, form[n], form); });
    setFieldErrors(errs);
    const first = names.map((n) => errs[n]).find((e) => e);
    return !first;
  };

  const validateStep4 = () => {
    const errs = {};
    errs.room = validateField('room', form.room, form);
    errs.virtualLink = validateField('virtualLink', form.virtualLink, form);
    setFieldErrors(errs);
    return !errs.room && !errs.virtualLink;
  };

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "eventType") {
        if (value === "Internal" && !prev.organizerInstitution.trim()) {
          next.organizerInstitution = "City of Kigali";
        } else if (value !== "Internal" && prev.organizerInstitution === "City of Kigali") {
          next.organizerInstitution = "";
        }
      }
      return next;
    });

    if (name === 'eventDate' || name === 'fromTime' || name === 'toTime') {
      const snapshot = { ...form, [name]: value };
      const scheduleErrs = {};
      ['eventDate', 'fromTime', 'toTime'].forEach((n) => { scheduleErrs[n] = validateField(n, snapshot[n], snapshot); });
      setFieldErrors((prev) => ({ ...prev, ...scheduleErrs }));
    } else {
      const msg = validateField(name, value, form);
      setFieldErrors((prev) => ({ ...prev, [name]: msg }));
    }
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
      const response = await axios.get(`${BASE_URL}/events/calendar/availability?month=${encodeURIComponent(monthStr)}`);
      if (response.data?.success) setCalendarEvents(response.data.data);
      else setCalendarEvents([]);
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
      showError(err.response?.data?.message || err.message);
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
    const ok = validateStep1() && validateStep2() && validateStep3() && validateStep4();
    if (!ok) return;

    setSubmitting(true);
    try {
      const { start, end } = computeSchedule();
      const isVirtual = form.eventFormat === "Virtual";
      const payload = {
        eventMeetingType: eventMeetingType || "event",
        eventName: form.eventName,
        eventDescription: form.description,
        eventType: form.eventType,
        eventRoom: isVirtual ? "virtual" : form.room,
        eventFormat: form.eventFormat || "Physical",
        virtualLink: isVirtual ? form.virtualLink.trim() : "",
        virtualDescription: isVirtual ? form.virtualDescription.trim() : "",
        eventOrganizer: {
          fullNames: form.organizerNames,
          email: form.organizerEmail,
          phone: form.organizerPhone,
          institution: form.organizerInstitution || "",
        },
        startTime: start ? start.toISOString() : null,
        endTime: end ? end.toISOString() : null,
        expectedAudience: Number(form.audience),
        activityAgenda: showAgenda
          ? form.agenda.filter((a) => a.title?.trim() || a.description?.trim() || a.fromTime?.trim() || a.toTime?.trim())
          : [],
      };
      const res = await axios.post(`${BASE_URL}/booking-requests`, payload);
      if (res.data.success) {
        setTrackingCode(res.data.data.trackingCode);
        setScheduleStart(start);
        setScheduleEnd(end);
        setSubmitted(true);
        showSuccess(res.data.message || 'Booking request submitted successfully');
      } else {
        showError(res.data.message || 'Failed to submit request');
      }
    } catch (err) {
      showError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!urlType) {
    return <TypeSelectionScreen onOpenCalendar={handleOpenCalendar} showCalendar={showCalendar} calendarEvents={calendarEvents} calendarLoading={calendarLoading} calendarYear={calendarYear} calendarMonth={calendarMonth} onMonthChange={(year, month) => { setCalendarYear(year); setCalendarMonth(month); fetchCalendar(year, month); }} onCloseCalendar={handleCloseCalendar} onNavigate={navigate} />;
  }

  if (submitted) {
    return <SuccessScreen trackingCode={trackingCode} eventName={form.eventName} room={form.eventFormat === "Virtual" ? "Virtual" : form.room} startTime={scheduleStart} endTime={scheduleEnd} />;
  }

  const { start, end } = computeSchedule();

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
                <h1 className="text-xl font-extrabold leading-tight" style={{ fontFamily: fontHeading, letterSpacing: '-0.5px' }}>
                  {eventMeetingType === "meet" ? "Request Meeting Room" : "Request Event Room"}</h1>
              </div>
            </div>
          </div>

          <div className="px-6 py-3 text-center" style={{ backgroundColor: WHITE, borderLeft: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}` }}>
            <p className="text-xs font-medium" style={{ color: '#9E9E9E', fontFamily: fontHeading }}>
              Fields marked with <span style={{ color: DANGER }}>*</span> are required</p>
          </div>

          <CreateEventStepper currentStep={step} eventMeetingType={eventMeetingType} onStepClick={handleStepClick} completedSteps={completedSteps} />

          <form onSubmit={step === maxSteps ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}
            className="p-6 space-y-5 text-left" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderTop: '0' }}>
            {step === 1 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label style={labelStyle}>{eventMeetingType === "meet" ? "Meeting" : "Event"} Name <span style={{ color: DANGER }}>*</span></label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5" style={{ color: GRAY_DISABLED }} />
                      <input
                        type="text" name="eventName" value={form.eventName} onChange={handleChange}
                        placeholder={`Enter ${typeWord} name`}
                        className={inputClassName}
                        style={{ borderColor: fieldErrors.eventName ? DANGER : undefined }}
                      />
                    </div>
                    {fieldErrors.eventName && <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.eventName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label style={labelStyle}>{eventMeetingType === "meet" ? "Meeting" : "Event"} Type <span style={{ color: DANGER }}>*</span></label>
                    <select
                      name="eventType" value={form.eventType} onChange={handleChange}
                      className={inputClassName}
                      style={{ borderColor: fieldErrors.eventType ? DANGER : undefined }}
                    >
                      <option value="">Select type</option>
                      <option value="Internal">Internal</option>
                      <option value="Joint">Joint</option>
                      <option value="External">External</option>
                    </select>
                    {fieldErrors.eventType && <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.eventType}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label style={labelStyle}>Expected Audience <span style={{ color: DANGER }}>*</span></label>
                    <input
                      type="number" name="audience" value={form.audience} onChange={handleChange}
                      placeholder="Total head count" min={1}
                      className={inputClassName}
                      style={{ borderColor: fieldErrors.audience ? DANGER : undefined }}
                    />
                    {fieldErrors.audience && <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.audience}</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label style={labelStyle}>Description <span style={{ color: DANGER }}>*</span></label>
                  <textarea
                    name="description" value={form.description} onChange={handleChange}
                    placeholder={`Describe your ${typeWord}...`} rows={3}
                    className={inputClassName}
                    style={{ resize: 'vertical', minHeight: '80px', borderColor: fieldErrors.description ? DANGER : undefined }}
                  />
                  {fieldErrors.description && <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.description}</p>}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label style={labelStyle}>Full Names <span style={{ color: DANGER }}>*</span></label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5" style={{ color: GRAY_DISABLED }} />
                      <input
                        type="text" name="organizerNames" value={form.organizerNames} onChange={handleChange}
                        placeholder="First & Last Names" autoComplete="name"
                        className={inputClassName}
                        style={{ borderColor: fieldErrors.organizerNames ? DANGER : undefined }}
                      />
                    </div>
                    {fieldErrors.organizerNames && <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.organizerNames}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label style={labelStyle}>Institution / Unit <span className="text-xs ml-1" style={{ color: '#9E9E9E' }}>(optional)</span></label>
                    <div className="relative">
                      <FiMapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5" style={{ color: GRAY_DISABLED }} />
                      <input
                        type="text" name="organizerInstitution" value={form.organizerInstitution} onChange={handleChange}
                        placeholder="e.g. a department or a unit" autoComplete="organization"
                        className={inputClassName}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label style={labelStyle}>Email <span style={{ color: DANGER }}>*</span></label>
                    <div className="relative">
                      <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5" style={{ color: GRAY_DISABLED }} />
                      <input
                        type="email" name="organizerEmail" value={form.organizerEmail} onChange={handleChange}
                        placeholder="name@domain.com" autoComplete="email"
                        className={inputClassName}
                        style={{ borderColor: fieldErrors.organizerEmail ? DANGER : undefined }}
                      />
                    </div>
                    {fieldErrors.organizerEmail && <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.organizerEmail}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label style={labelStyle}>Phone <span style={{ color: DANGER }}>*</span></label>
                    <div className="relative">
                      <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5" style={{ color: GRAY_DISABLED }} />
                      <input
                        type="tel" name="organizerPhone" value={form.organizerPhone} onChange={handleChange}
                        placeholder="+250 7XX XXX XXX" autoComplete="tel"
                        className={inputClassName}
                        style={{ borderColor: fieldErrors.organizerPhone ? DANGER : undefined }}
                      />
                    </div>
                    {fieldErrors.organizerPhone && <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.organizerPhone}</p>}
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label style={labelStyle}>Date <span style={{ color: DANGER }}>*</span></label>
                  <input
                    type="date" name="eventDate" value={form.eventDate} onChange={handleChange}
                    className={inputClassName}
                    style={{ borderColor: fieldErrors.eventDate ? DANGER : undefined }}
                  />
                  {fieldErrors.eventDate && <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.eventDate}</p>}
                </div>
                <div className="space-y-1.5">
                  <label style={labelStyle}>From (24-hour) <span style={{ color: DANGER }}>*</span></label>
                  <TimeInput24
                    value={form.fromTime}
                    hasError={!!fieldErrors.fromTime}
                    onChange={(value) => handleChange({ target: { name: 'fromTime', value } })}
                  />
                  {fieldErrors.fromTime && <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.fromTime}</p>}
                </div>
                <div className="space-y-1.5">
                  <label style={labelStyle}>To (24-hour) <span style={{ color: DANGER }}>*</span></label>
                  <TimeInput24
                    value={form.toTime}
                    hasError={!!fieldErrors.toTime}
                    onChange={(value) => handleChange({ target: { name: 'toTime', value } })}
                  />
                  {fieldErrors.toTime && <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.toTime}</p>}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col gap-4">
                <EventFormatFields
                  eventFormat={form.eventFormat}
                  virtualLink={form.virtualLink}
                  virtualDescription={form.virtualDescription}
                  linkError={fieldErrors.virtualLink}
                  onChange={(name, val) => {
                    setForm((prev) => {
                      const next = { ...prev, [name]: val };
                      if (name === 'eventFormat') {
                        if (val === 'Virtual') next.room = '';
                        else { next.virtualLink = ''; next.virtualDescription = ''; }
                      }
                      return next;
                    });
                    setFieldErrors((prev) => ({ ...prev, room: null, virtualLink: null }));
                  }}
                />
                {form.eventFormat !== 'Virtual' && (
                  <RoomSelector
                    form={form}
                    rooms={[]}
                    audience={form.audience}
                    onChange={(name, val) => {
                      setForm((prev) => ({ ...prev, [name]: val }));
                      setFieldErrors((prev) => ({ ...prev, [name]: null }));
                    }}
                    startTime={start ? start.toISOString() : null}
                    endTime={end ? end.toISOString() : null}
                    eventMeetingType={eventMeetingType}
                    onBack={handleBack}
                  />
                )}
                {fieldErrors.room && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldErrors.room}</p>}
              </div>
            )}

            {step === 5 && showAgenda && (
              <ActivityAgenda
                agenda={form.agenda}
                onChange={(agenda) => setForm((prev) => ({ ...prev, agenda }))}
                eventStartTime={form.fromTime || null}
                eventEndTime={form.toTime || null}
              />
            )}
            {step === 5 && !showAgenda && (
              <div className="p-4 text-center" style={{ backgroundColor: '#E3F2FD', border: `1px solid ${BORDER}` }}>
                <p className="text-sm font-medium" style={{ color: PRIMARY, fontFamily: fontHeading }}>No agenda required</p>
                <p className="text-xs mt-1" style={{ color: '#9E9E9E', fontFamily: fontHeading }}>Events do not require a meeting agenda.</p>
              </div>
            )}

            <div className="mt-2" style={{ borderTop: `1px solid ${BORDER}`, paddingTop: '20px' }}>
              <div className="flex items-stretch gap-3">
                <button type="button" onClick={() => navigate("/book-a-room/options")}
                  className="cok-btn-outlined inline-flex items-center justify-center gap-1.5 text-sm shrink-0"
                  style={{ fontFamily: fontHeading }}>
                  <FiX className="w-4 h-4" /> Cancel
                </button>
                {step < maxSteps ? (
                  <button type="submit" className="cok-btn-primary" style={{ flex: 1, fontFamily: fontHeading }}>
                    Next
                  </button>
                ) : (
                  <button type="submit" disabled={submitting}
                    className="cok-btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ flex: 1 }}
                  >
                    {submitting ? (
                      <div style={{ width: 16, height: 16, border: `2px solid ${WHITE}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    ) : (<><FiCheckCircle style={{ width: 16, height: 16 }} /> Submit Booking Request</>)}
                  </button>
                )}
              </div>
              {step > 1 && (
                <button type="button" onClick={handleBack} className="cok-btn-outlined w-full mt-3" style={{ fontFamily: fontHeading }}>
                  Back
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
