import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';
import { FiPlus, FiTrash2, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

const BASE_URL = '/cok/api/v1';

const EVENT_TYPES = [
  { value: 'internal', label: 'Internal Meeting' },
  { value: 'external', label: 'External Meeting' },
  { value: 'joint', label: 'Joint Meeting (Internal & External)' },
];

const inputClass =
  'w-full px-4 py-3 border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 bg-white';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

const STEPS = [
  { number: 1, label: 'Event Info' },
  { number: 2, label: 'Organizer' },
  { number: 3, label: 'Schedule' },
  { number: 4, label: 'Agenda' },
];

function ProgressBar({ currentStep }) {
  return (
    <div className="flex items-center justify-center px-6 py-5 bg-white border-b border-gray-200">
      {STEPS.map((step, idx) => {
        const done = currentStep > step.number;
        const active = currentStep === step.number;
        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 flex items-center justify-center text-xs font-bold transition-all duration-300
                  ${done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap
                ${done ? 'text-green-600' : active ? 'text-blue-600' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-0.5 w-6 sm:w-12 mx-1 mb-4 transition-all duration-300
                ${currentStep > step.number ? 'bg-green-400' : 'bg-gray-200'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function BookNow() {
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState({});

  const [form, setForm] = useState({
    eventName: '',
    room: '',
    description: '',
    eventType: '',
    organizerEmail: '',
    organizerPhone: '',
    organizerNames: '',
    organizerInstitution: '',
    startTime: '',
    endTime: '',
    audience: '',
    agenda: [{ startTime: '', endTime: '', title: '', description: '' }],
  });

  useEffect(() => {
    async function fetchRooms() {
      try {
        const res = await axios.get(`${BASE_URL}/rooms/status/active`);
        setRooms(res.data?.data || []);
      } catch {
        setRooms([]);
      } finally {
        setRoomsLoading(false);
      }
    }
    fetchRooms();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: null }));
  }

  function handleAgendaChange(index, field, value) {
    setForm((prev) => {
      const updated = [...prev.agenda];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, agenda: updated };
    });
  }

  function addAgendaItem() {
    setForm((prev) => ({
      ...prev,
      agenda: [...prev.agenda, { startTime: '', endTime: '', title: '', description: '' }],
    }));
  }

  function removeAgendaItem(index) {
    setForm((prev) => ({
      ...prev,
      agenda: prev.agenda.filter((_, i) => i !== index),
    }));
  }

  const showAgenda = form.eventType === 'internal' || form.eventType === 'joint';
  const selectedRoom = rooms.find((r) => r._id === form.room);
  const audienceExceedsCapacity =
    selectedRoom && form.audience && Number(form.audience) > selectedRoom.roomCapacity;

  function validateStep1() {
    const errs = {};
    if (!form.eventName.trim()) errs.eventName = 'Event name is required';
    if (!form.room) errs.room = 'Please select a room';
    if (!form.eventType) errs.eventType = 'Please select an event type';
    if (!form.audience || Number(form.audience) < 1) errs.audience = 'Expected audience is required';
    if (!form.description.trim()) errs.description = 'Description is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2() {
    const errs = {};
    if (!form.organizerNames.trim()) errs.organizerNames = 'Full names are required';
    if (!form.organizerEmail.trim()) errs.organizerEmail = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.organizerEmail.trim()))
      errs.organizerEmail = 'Enter a valid email address';
    if (!form.organizerPhone.trim()) errs.organizerPhone = 'Phone number is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateAgendaTimelines() {
    if (!form.startTime || !form.endTime) return true;
    const overallStart = new Date(form.startTime).getTime();
    const overallEnd = new Date(form.endTime).getTime();
    if (isNaN(overallStart) || isNaN(overallEnd)) return true;
    for (const item of form.agenda) {
      if (!item.startTime || !item.endTime) continue;
      const aStart = new Date(`${form.startTime.split('T')[0]}T${item.startTime}`).getTime();
      const aEnd = new Date(`${form.startTime.split('T')[0]}T${item.endTime}`).getTime();
      if (isNaN(aStart) || isNaN(aEnd)) continue;
      if (aStart < overallStart || aStart > overallEnd) return false;
      if (aEnd < overallStart || aEnd > overallEnd) return false;
      if (aStart >= aEnd) return false;
    }
    return true;
  }

  function validateStep3() {
    const errs = {};
    if (!form.startTime) errs.startTime = 'Start time is required';
    if (!form.endTime) errs.endTime = 'End time is required';
    else if (form.startTime && new Date(form.endTime) <= new Date(form.startTime))
      errs.endTime = 'End time must be after start time';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    setError(null);
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3 && validateStep3()) setStep(4);
  }

  function handleBack() {
    setError(null);
    setFieldErrors({});
    setStep((s) => s - 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (showAgenda && !validateAgendaTimelines()) {
      setError('Agenda item times must fall within the event start and end schedule.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${BASE_URL}/rooms/booking-request`, {
        ...form,
        agenda: showAgenda ? form.agenda.filter((a) => a.title.trim()) : [],
      });
      setSubmitted(true);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to send request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Success
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
              Your booking request for <span className="font-semibold text-gray-700">{form.eventName}</span> has been forwarded successfully.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-200 p-3 text-left text-xs text-gray-600 space-y-1">
            <p><span className="font-medium">Organizer:</span> {form.organizerNames}</p>
            <p><span className="font-medium">Room:</span> {selectedRoom?.roomName || form.room}</p>
            <p><span className="font-medium">Type:</span> {EVENT_TYPES.find(t => t.value === form.eventType)?.label}</p>
          </div>
          <p className="text-xs text-gray-400">You may now close this page.</p>
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

          {/* Blue header — identical pattern to AttendanceForm */}
          <div className="bg-blue-600 px-6 py-5 text-white mb-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-white/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-blue-200 uppercase tracking-wide font-medium">Room Booking</p>
                <h1 className="text-base font-bold leading-tight">Request Room</h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-blue-100">
              <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5">
                City of Kigali
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Event Management System
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <ProgressBar currentStep={step} />

          {/* Form card */}
          <form
            onSubmit={step === 4 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}
            className="bg-white border border-gray-200 border-t-0 p-6 space-y-5"
          >
            {error && (
              <div className="bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                <FiAlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/*  STEP 1: Event Info  */}
            {step === 1 && (
              <>
                {/* Event Name + Room  side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Event Name <span className="text-red-500">*</span></label>
                    <input
                      className={`${inputClass} ${fieldErrors.eventName ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                      type="text"
                      name="eventName"
                      value={form.eventName}
                      onChange={handleChange}
                      placeholder="Enter event designation"
                    />
                    {fieldErrors.eventName && <p className="text-xs text-red-500">{fieldErrors.eventName}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Target Room Space <span className="text-red-500">*</span></label>
                    <select
                      className={`${inputClass} ${fieldErrors.room ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                      name="room"
                      value={form.room}
                      onChange={handleChange}
                    >
                      <option value="" disabled>
                        {roomsLoading ? 'Loading rooms…' : 'Select workspace'}
                      </option>
                      {rooms.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.roomName} (Max: {r.roomCapacity})
                        </option>
                      ))}
                    </select>
                    {fieldErrors.room && <p className="text-xs text-red-500">{fieldErrors.room}</p>}
                  </div>
                </div>

                {/* Event Type + Audience  side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Event Structural Type <span className="text-red-500">*</span></label>
                    <select
                      className={`${inputClass} ${fieldErrors.eventType ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                      name="eventType"
                      value={form.eventType}
                      onChange={handleChange}
                    >
                      <option value="" disabled>Select event type</option>
                      {EVENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    {fieldErrors.eventType && <p className="text-xs text-red-500">{fieldErrors.eventType}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Expected Audience <span className="text-red-500">*</span></label>
                    <input
                      className={`${inputClass} ${fieldErrors.audience ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                      type="number"
                      name="audience"
                      value={form.audience}
                      onChange={handleChange}
                      placeholder="Total head count"
                      min={1}
                    />
                    {fieldErrors.audience && <p className="text-xs text-red-500">{fieldErrors.audience}</p>}
                    {audienceExceedsCapacity && (
                      <div className="mt-1 text-xs font-medium text-amber-600 flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5">
                        <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Exceeds room capacity ({selectedRoom.roomCapacity}).</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description  full width */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Operational Scope Description <span className="text-red-500">*</span></label>
                  <textarea
                    className={`${inputClass} resize-y min-h-[80px] ${fieldErrors.description ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Outline core requirements or high-level strategic summaries..."
                    rows={3}
                  />
                  {fieldErrors.description && <p className="text-xs text-red-500">{fieldErrors.description}</p>}
                </div>
              </>
            )}

            {/* STEP 2: Organizer */}
            {step === 2 && (
              <>
                {/* Full Names + Institution — side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Full Names <span className="text-red-500">*</span></label>
                    <input
                      className={`${inputClass} ${fieldErrors.organizerNames ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                      type="text"
                      name="organizerNames"
                      value={form.organizerNames}
                      onChange={handleChange}
                      placeholder="First & Last Names"
                      autoComplete="name"
                    />
                    {fieldErrors.organizerNames && <p className="text-xs text-red-500">{fieldErrors.organizerNames}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>
                      Institution
                      <span className="ml-1.5 text-xs font-normal text-gray-400">(optional)</span>
                    </label>
                    <input
                      className={inputClass}
                      type="text"
                      name="organizerInstitution"
                      value={form.organizerInstitution}
                      onChange={handleChange}
                      placeholder="External workspace title"
                      autoComplete="organization"
                    />
                  </div>
                </div>

                {/* Email + Phone — side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Email <span className="text-red-500">*</span></label>
                    <input
                      className={`${inputClass} ${fieldErrors.organizerEmail ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                      type="email"
                      name="organizerEmail"
                      value={form.organizerEmail}
                      onChange={handleChange}
                      placeholder="name@domain.com"
                      autoComplete="email"
                    />
                    {fieldErrors.organizerEmail && <p className="text-xs text-red-500">{fieldErrors.organizerEmail}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Contact Phone <span className="text-red-500">*</span></label>
                    <input
                      className={`${inputClass} ${fieldErrors.organizerPhone ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                      type="tel"
                      name="organizerPhone"
                      value={form.organizerPhone}
                      onChange={handleChange}
                      placeholder="+250 7XX XXX XXX"
                      autoComplete="tel"
                    />
                    {fieldErrors.organizerPhone && <p className="text-xs text-red-500">{fieldErrors.organizerPhone}</p>}
                  </div>
                </div>
              </>
            )}

            {/* STEP 3: Schedule */}
            {step === 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>Start <span className="text-red-500">*</span></label>
                  <input
                    className={`${inputClass} ${fieldErrors.startTime ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                    type="datetime-local"
                    name="startTime"
                    value={form.startTime}
                    onChange={handleChange}
                  />
                  {fieldErrors.startTime && <p className="text-xs text-red-500">{fieldErrors.startTime}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>End <span className="text-red-500">*</span></label>
                  <input
                    className={`${inputClass} ${fieldErrors.endTime ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                    type="datetime-local"
                    name="endTime"
                    value={form.endTime}
                    onChange={handleChange}
                  />
                  {fieldErrors.endTime && <p className="text-xs text-red-500">{fieldErrors.endTime}</p>}
                </div>
              </div>
            )}

            {/* STEP 4: Activity Agenda */}
            {step === 4 && (
              showAgenda ? (
                <div className="space-y-4">
                  {form.agenda.map((a, i) => (
                    <div key={i} className="p-4 bg-gray-50 border border-gray-200 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500">Phase {i + 1}</span>
                        {form.agenda.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeAgendaItem(i)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors border border-transparent hover:border-gray-200 hover:bg-white"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-gray-500">From</label>
                          <input type="time" className={inputClass} value={a.startTime}
                            onChange={(e) => handleAgendaChange(i, 'startTime', e.target.value)} required />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-gray-500">To</label>
                          <input type="time" className={inputClass} value={a.endTime}
                            onChange={(e) => handleAgendaChange(i, 'endTime', e.target.value)} required />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-gray-500">Title</label>
                        <input type="text" className={inputClass} value={a.title}
                          onChange={(e) => handleAgendaChange(i, 'title', e.target.value)}
                          placeholder="e.g. Introduction" required />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-gray-500">Description</label>
                        <textarea className={`${inputClass} resize-y min-h-[60px]`} value={a.description}
                          onChange={(e) => handleAgendaChange(i, 'description', e.target.value)}
                          placeholder="Agenda item details..." rows={2} required />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addAgendaItem}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                    <FiPlus className="w-3.5 h-3.5" />
                    Add phase
                  </button>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 p-4 text-center">
                  <p className="text-sm text-blue-700 font-medium">No agenda required</p>
                  <p className="text-xs text-blue-500 mt-1">External meetings do not require an activity agenda.</p>
                </div>
              )
            )}

            {/* Navigation buttons */}
            <div className="flex gap-3 mt-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 py-3 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}

              {step < 4 ? (
                <button
                  type="submit"
                  className={`py-3 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center justify-center gap-2 ${step === 1 ? 'w-full' : 'flex-1'}`}
                >
                  {step === 1 ? 'Next.. Organizer' : step === 2 ? 'Next — Schedule' : 'Next — Agenda'}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Submit Booking Request
                    </>
                  )}
                </button>
              )}
            </div>

            <p className="text-center text-xs text-gray-400">
              Fields marked with <span className="text-red-500">*</span> are required
            </p>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4 pb-8">
            City of Kigali@Event Management System
          </p>
        </div>
      </div>
    </>
  );
}
