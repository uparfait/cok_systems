import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiPlus, FiSave, FiUsers, FiX } from 'react-icons/fi';
import axios from 'axios';
import SpiralLoader from './SpiralLoader';
import CreateEventStepper from './CreateEventStepper';
import EventBasicFields from './sub-components/EventBasicFields';
import EventTimeFields from './sub-components/EventTimeFields';
import OrganizerFields from './sub-components/OrganizerFields';
import EventRoomSelector from './sub-components/EventRoomSelector';
import EventFormatFields from './sub-components/EventFormatFields';
import ActivityAgenda from './sub-components/ActivityAgenda';
import SuccessMessage from './sub-components/SuccessMessage';
import ErrorMessage from './sub-components/ErrorMessage';
import { getAgendaTimeBounds, validateAgendaTimes, extractOrganizer, buildRecurringConfig } from './sub-components/EventCreateHelpers';

const BASE_URL = '/cok/api/v1';

export default function CreateEvent({ eventMeetingType: initialType }) {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!eventId;

  const [pageLoading, setPageLoading] = useState(isEditMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [createdEventSpecialId, setCreatedEventSpecialId] = useState(null);
  const [step, setStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [eventMode, setEventMode] = useState('');
  const [eventMeetingType, setEventMeetingType] = useState(initialType || 'event');
  const [recurringType, setRecurringType] = useState('');
  const [monthlyPattern, setMonthlyPattern] = useState('specific');
  const [editEventType, setEditEventType] = useState('');
  const [event_id, setEvent_ID] = useState(null);

  const initialFormState = {
    eventName: '', eventDescription: '', eventType: '', expectedAudience: '',
    eventRoom: '', eventFormat: 'Physical', virtualLink: '', virtualDescription: '',
    eventOrganizer: '', organizerEmail: '', organizerPhone: '', organizerInstitution: '',
    eventDate: '', fromTime: '', toTime: '',
    startedAt: '', willEndAt: '', willStartAt: '',
    eventStartTime: '', eventEndTime: '', recurringEndDate: '', eventStartDate: '',
    weeklyDays: [], monthlyDates: '', agenda: [],
  };

  const [formData, setFormData] = useState(initialFormState);

  const type = eventMeetingType === 'meet' ? 'Meeting' : 'Event';
  const typeLower = type.toLowerCase();

  useEffect(() => {
    if (!isEditMode) return;

    const loadEvent = async () => {
      setPageLoading(true);
      try {
        const endpoints = [
          `${BASE_URL}/events/live?search=${eventId}&searchField=eventSpecialId&limit=1`,
          `${BASE_URL}/events/recurring?search=${eventId}&searchField=eventSpecialId&limit=1`,
          `${BASE_URL}/events/upcoming?search=${eventId}&searchField=eventSpecialId&limit=1`,
        ];

        let foundEvent = null;
        let foundMode = '';

        for (const [idx, endpoint] of endpoints.entries()) {
          const res = await axios.get(endpoint);
          if (res.data?.success && res.data.data?.length > 0) {
            foundEvent = res.data.data[0];
            foundMode = ['live', 'recurring', 'upcoming'][idx];
            break;
          }
        }

        if (!foundEvent) { setError('Event not found'); return; }

        setEditEventType(foundMode);
        setEventMode(foundMode);

        const org = typeof foundEvent.eventOrganizer === 'object'
          ? foundEvent.eventOrganizer
          : { fullNames: '', email: '', phone: '', institution: '' };

          setEvent_ID(foundEvent._id || null);

        const startedAtStr = foundEvent.startedAt ? new Date(foundEvent.startedAt).toISOString().slice(0, 16) : '';
        const willStartAtStr = foundEvent.willStartAt ? new Date(foundEvent.willStartAt).toISOString().slice(0, 16) : '';
        const willEndAtStr = foundEvent.willEndAt ? new Date(foundEvent.willEndAt).toISOString().slice(0, 16) : '';
        const startStr = startedAtStr || willStartAtStr;

        setFormData({
          eventMeetingType: foundEvent.eventMeetingType || 'event',
          eventName: foundEvent.eventName || '',
          eventDescription: foundEvent.eventDescription || '',
          eventType: foundEvent.eventType || 'Internal',
          expectedAudience: foundEvent.expectedAudience || '',
          eventRoom: foundEvent.eventFormat === 'Virtual' ? '' : (foundEvent.eventRoom || ''),
          eventFormat: foundEvent.eventFormat || 'Physical',
          virtualLink: foundEvent.virtualLink || '',
          virtualDescription: foundEvent.virtualDescription || '',
          eventOrganizer: org.fullNames || '',
          organizerEmail: org.email || '',
          organizerPhone: org.phone || '',
          organizerInstitution: org.institution || '',
          eventDate: startStr ? startStr.slice(0, 10) : '',
          fromTime: startStr ? startStr.slice(11, 16) : '',
          toTime: willEndAtStr ? willEndAtStr.slice(11, 16) : '',
          startedAt: startedAtStr,
          willEndAt: willEndAtStr,
          willStartAt: willStartAtStr,
          eventStartTime: foundEvent.eventRecurring?.eventStartTime || '',
          eventEndTime: foundEvent.eventRecurring?.eventEndTime || '',
          recurringEndDate: foundEvent.eventRecurring?.recurringEndDate
            ? new Date(foundEvent.eventRecurring.recurringEndDate).toISOString().slice(0, 10) : '',
          eventStartDate: '',
          weeklyDays: foundEvent.eventRecurring?.weeklyDays || [],
          monthlyDates: foundEvent.eventRecurring?.monthlyDates
            ? foundEvent.eventRecurring.monthlyDates.join(',') : '',
          agenda: foundEvent.activityAgenda || [],
        });

        if (foundMode === 'recurring') {
          setRecurringType(foundEvent.eventRecurring?.recurringType || '');
          setMonthlyPattern(foundEvent.eventRecurring?.monthlyPattern || 'specific');
        }

        setEventMeetingType(foundEvent.eventMeetingType || 'event');
        // Editing an existing event: every step already has data, allow free navigation
        setCompletedSteps([1, 2, 3, 4, 5]);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load event for editing');
      } finally {
        setPageLoading(false);
      }
    };

    loadEvent();
  }, [eventId, isEditMode]);

  const hasEventTimes = () => {
    if (eventMode === 'live') return formData.startedAt && formData.willEndAt;
    if (eventMode === 'upcoming') return formData.willStartAt && formData.willEndAt;
    if (eventMode === 'recurring') return formData.eventStartTime && formData.eventEndTime;
    return false;
  };

  const handleChange = (name, value) => {
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      // Live/upcoming schedule is captured as date + from/to times;
      // combine them into the datetime fields the rest of the flow reads.
      if (name === 'eventDate' || name === 'fromTime' || name === 'toTime') {
        const start = next.eventDate && next.fromTime ? `${next.eventDate}T${next.fromTime}` : '';
        const end = next.eventDate && next.toTime ? `${next.eventDate}T${next.toTime}` : '';
        next.startedAt = start;
        next.willStartAt = start;
        next.willEndAt = end;
      }
      // A virtual event holds no room; a physical one carries no virtual details.
      if (name === 'eventFormat') {
        if (value === 'Virtual') {
          next.eventRoom = '';
        } else {
          next.virtualLink = '';
          next.virtualDescription = '';
        }
      }
      return next;
    });
    setError(null);
    setSuccess(false);
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setEventMode('');
    setRecurringType('');
    setMonthlyPattern('specific');
    setStep(1);
    setCompletedSteps([]);
  };

  const validateStep1 = () => {
    if (!eventMode) { setError('Please select an event mode'); return false; }
    if (!formData.eventName.trim()) { setError('Event name is required'); return false; }
    if (!formData.eventType) { setError('Event type is required'); return false; }
    if (!formData.eventDescription.trim()) { setError('Description is required'); return false; }
    if (!formData.expectedAudience || formData.expectedAudience < 1) { setError('Expected audience must be at least 1'); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.eventOrganizer.trim()) { setError('Organizer full names are required'); return false; }
    if (!formData.organizerEmail.trim()) { setError('Organizer email is required'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.organizerEmail.trim())) { setError('Enter a valid email address'); return false; }
    if (!formData.organizerPhone.trim()) { setError('Organizer phone number is required'); return false; }
    return true;
  };

  const validateStep3 = () => {
    if (eventMode === 'live' || eventMode === 'upcoming') {
      if (!formData.eventDate) { setError('Date is required'); return false; }
      if (!formData.fromTime) { setError('Start time is required'); return false; }
      if (!formData.toTime) { setError('End time is required'); return false; }
      if (formData.toTime <= formData.fromTime) { setError('End time must be after start time'); return false; }
    } else if (eventMode === 'recurring') {
      if (!formData.eventStartDate) { setError('Recurring start date is required'); return false; }
      if (!formData.recurringEndDate) { setError('Recurring end date is required'); return false; }
      if (!formData.eventStartTime || !formData.eventEndTime) { setError('Start and end times are required'); return false; }
      if (formData.eventStartDate && formData.recurringEndDate && formData.eventStartDate >= formData.recurringEndDate) {
        setError('End date must be after start date'); return false;
      }
    }
    return true;
  };

  const validateStep4 = () => {
    if (formData.eventFormat === 'Virtual') {
      if (formData.virtualLink && !/^https?:\/\/\S+$/i.test(formData.virtualLink.trim())) {
        setError('Meeting link must be a valid http(s) URL');
        return false;
      }
      return true;
    }
    if (!formData.eventRoom) { setError('Please select a room'); return false; }
    return true;
  };

  const markCompleted = (s) => {
    setCompletedSteps(prev => (prev.includes(s) ? prev : [...prev, s]));
  };

  const handleNext = () => {
    setError(null);
    if (step === 1 && validateStep1()) { markCompleted(1); setStep(2); }
    else if (step === 2 && validateStep2()) { markCompleted(2); setStep(3); }
    else if (step === 3 && validateStep3()) { markCompleted(3); setStep(4); }
    else if (step === 4 && validateStep4()) {
      markCompleted(4);
      if (eventMeetingType === 'meet') setStep(5);
      else handleSubmit();
    }
  };

  const handleBack = () => {
    setError(null);
    setStep(s => s - 1);
  };

  const handleStepClick = (targetStep) => {
    if (completedSteps.includes(targetStep) || targetStep < step) {
      setError(null);
      setStep(targetStep);
    }
  };

  const buildEventData = () => {
    const isVirtual = formData.eventFormat === 'Virtual';
    const data = {
      eventMeetingType: eventMeetingType || 'event',
      eventName: formData.eventName,
      eventDescription: formData.eventDescription,
      eventType: formData.eventType,
      eventRoom: isVirtual ? 'virtual' : formData.eventRoom,
      eventFormat: formData.eventFormat || 'Physical',
      virtualLink: isVirtual ? formData.virtualLink.trim() : '',
      virtualDescription: isVirtual ? formData.virtualDescription.trim() : '',
      expectedAudience: formData.expectedAudience,
      eventOrganizer: extractOrganizer(formData),
      eventMode: eventMode,
      agenda: eventMeetingType === 'meet' ? formData.agenda.filter(a => a.title.trim()) : [],
    };

    if (eventMode === 'live') {
      data.startedAt = new Date(formData.startedAt).toISOString();
      data.willEndAt = new Date(formData.willEndAt).toISOString();
    } else if (eventMode === 'upcoming') {
      data.willStartAt = new Date(formData.willStartAt).toISOString();
      data.willEndAt = new Date(formData.willEndAt).toISOString();
    } else if (eventMode === 'recurring') {
      data.eventStartDate = new Date(formData.eventStartDate).toISOString();
      data.eventRecurring = buildRecurringConfig(formData, recurringType, monthlyPattern);
    }
    return data;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(false);

    if (eventMeetingType === 'meet' && formData.agenda.some(a => a.title.trim()) && !validateAgendaTimes(formData, eventMode, setError)) return;

    setLoading(true);
    const data = buildEventData();

    try {
      let response;
      if (isEditMode) {
        response = await axios.put(`${BASE_URL}/events/${editEventType}/${event_id}`, data);
      } else {
        response = await axios.post(`${BASE_URL}/events`, data);
      }

      if (response.data.success) {
        setSuccess(true);
        if (!isEditMode) {
          resetForm();
          // Show invite modal with the created event's special ID
          const eventSpecialId = response.data.data?.eventSpecialId;
          if (eventSpecialId) {
            setCreatedEventSpecialId(eventSpecialId);
            setTimeout(() => setShowInviteModal(true), 500);
          } else {
            setTimeout(() => navigate(-1), 1500);
          }
        } else {
          setTimeout(() => navigate(-1), 1500);
        }
      } else {
        setError(response.data.message || `Failed to ${isEditMode ? 'update' : 'create'} ${typeLower}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} ${typeLower}`);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading || loading) {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto">
          <div className="bg-white border border-gray-200 ppp-lg p-12 text-center">
            <div className="ppp-full h-8 w-8 mx-auto"><SpiralLoader /></div>
          </div>
        </div>
      </div>
    );
  }

  const { startTime: agendaStart, endTime: agendaEnd, overMidnight: agendaOverMidnight } = getAgendaTimeBounds(formData, eventMode);
  const maxSteps = eventMeetingType === 'meet' ? 5 : 4;

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto space-y-6">
          <SuccessMessage show={success} message={`${type} ${isEditMode ? 'updated' : 'created'} successfully!`} />
          <ErrorMessage message={error} />

          {/* Invite Modal */}
          {showInviteModal && (
            <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white max-w-md w-full p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    <FiUsers className="w-5 h-5" style={{ color: '#056daa' }} />
                    Invite People
                  </h3>
                  <button
                    onClick={() => { setShowInviteModal(false); navigate(-1); }}
                    className="p-1 hover:bg-zinc-100 text-zinc-500 transition-colors"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-zinc-600 mb-6">
                  Would you like to invite people to this {typeLower}?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowInviteModal(false); navigate(-1); }}
                    className="cok-btn-outlined flex-1"
                  >
                    Later
                  </button>
                  <button
                    onClick={() => {
                      setShowInviteModal(false);
                      const roleSlug = window.location.pathname.split('/')[1];
                      navigate(`/${roleSlug || 'event-manager'}/events/${createdEventSpecialId}/invite`);
                    }}
                    className="cok-btn-primary flex-1"
                    style={{ width: 'auto' }}
                  >
                    Invite Now
                  </button>
                </div>
              </div>
            </div>
          )}

        <div className="bg-white border border-gray-200 overflow-hidden">
          <CreateEventStepper currentStep={step} eventMeetingType={eventMeetingType} eventMode={eventMode} onStepClick={handleStepClick} completedSteps={completedSteps} />

          <form onSubmit={(e) => { e.preventDefault(); if (step === maxSteps) handleSubmit(e); else handleNext(); }} className="p-6 space-y-6">
            {step === 1 && (
              <EventBasicFields
                eventMeetingType={eventMeetingType}
                eventMode={eventMode}
                formData={formData}
                onEventModeChange={setEventMode}
                onChange={handleChange}
              />
            )}

            {step === 2 && (
              <OrganizerFields eventMeetingType={eventMeetingType} formData={formData} onChange={handleChange} />
            )}

            {step === 3 && (
              <EventTimeFields
                eventMode={eventMode}
                formData={formData}
                recurringType={recurringType}
                monthlyPattern={monthlyPattern}
                onChange={handleChange}
                onRecurringTypeChange={setRecurringType}
                onMonthlyPatternChange={setMonthlyPattern}
              />
            )}

            {step === 4 && (
              <div className="flex flex-col gap-4">
                <EventFormatFields
                  eventFormat={formData.eventFormat}
                  virtualLink={formData.virtualLink}
                  virtualDescription={formData.virtualDescription}
                  onChange={handleChange}
                />
                {formData.eventFormat !== 'Virtual' && (
                  <EventRoomSelector
                    eventMode={eventMode}
                    formData={formData}
                    onChange={handleChange}
                    recurringType={recurringType}
                    monthlyPattern={monthlyPattern}
                    excludeEventId={isEditMode ? eventId : null}
                  />
                )}
              </div>
            )}

            {step === 5 && eventMeetingType === 'meet' && hasEventTimes() && (
              <ActivityAgenda
                agenda={formData.agenda}
                onChange={(agenda) => handleChange('agenda', agenda)}
                eventStartTime={agendaStart}
                eventEndTime={agendaEnd}
                overMidnight={agendaOverMidnight}
              />
            )}
            {step === 5 && eventMeetingType === 'meet' && !hasEventTimes() && (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">Set your schedule first to enable agenda planning.</p>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-gray-200">
              {step > 1 && (
                <button type="button" onClick={handleBack}
                  className="cok-btn-outlined flex-1"
                >
                  Back
                </button>
              )}

              {step < maxSteps ? (
                <button type="submit"
                  className="cok-btn-primary flex-[2]"
                  style={{ width: 'auto' }}
                >
                  Next
                </button>
              ) : (
                <button type="submit"
                  disabled={loading}
                  className="cok-btn-primary flex-[2] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  style={{ width: 'auto' }}
                >
                  {isEditMode ? <FiSave className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
                  {isEditMode ? `Update ${type}` : `Create ${type}`}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}