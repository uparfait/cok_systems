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
  const [eventMode, setEventMode] = useState('');
  const [eventMeetingType, setEventMeetingType] = useState(initialType || 'event');
  const [recurringType, setRecurringType] = useState('');
  const [monthlyPattern, setMonthlyPattern] = useState('specific');
  const [editEventType, setEditEventType] = useState('');

  const initialFormState = {
    eventName: '', eventDescription: '', eventType: '', expectedAudience: '',
    eventRoom: '', eventOrganizer: '', organizerEmail: '', organizerPhone: '', organizerInstitution: '',
    startedAt: '', willEndAt: '', willStartAt: '',
    eventStartTime: '', eventEndTime: '', recurringEndDate: '', eventStartDate: '',
    weeklyDays: [], monthlyDates: '', agenda: [],
  };

  const [formData, setFormData] = useState(initialFormState);

  const type = eventMeetingType === 'meet' ? 'Meet' : 'Event';
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

        setFormData({
          eventMeetingType: foundEvent.eventMeetingType || 'event',
          eventName: foundEvent.eventName || '',
          eventDescription: foundEvent.eventDescription || '',
          eventType: foundEvent.eventType || 'Internal',
          expectedAudience: foundEvent.expectedAudience || '',
          eventRoom: foundEvent.eventRoom || '',
          eventOrganizer: org.fullNames || '',
          organizerEmail: org.email || '',
          organizerPhone: org.phone || '',
          organizerInstitution: org.institution || '',
          startedAt: foundEvent.startedAt ? new Date(foundEvent.startedAt).toISOString().slice(0, 16) : '',
          willEndAt: foundEvent.willEndAt ? new Date(foundEvent.willEndAt).toISOString().slice(0, 16) : '',
          willStartAt: foundEvent.willStartAt ? new Date(foundEvent.willStartAt).toISOString().slice(0, 16) : '',
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
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setEventMode('');
    setRecurringType('');
    setMonthlyPattern('specific');
    setStep(1);
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
    if (eventMode === 'live') {
      if (!formData.startedAt || !formData.willEndAt) { setError('Start and end times are required for live events'); return false; }
    } else if (eventMode === 'upcoming') {
      if (!formData.willStartAt || !formData.willEndAt) { setError('Start and end times are required for upcoming events'); return false; }
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
    if (!formData.eventRoom) { setError('Please select a room'); return false; }
    return true;
  };

  const handleNext = () => {
    setError(null);
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3 && validateStep3()) setStep(4);
    else if (step === 4 && validateStep4()) {
      if (eventMeetingType === 'meet') setStep(5);
      else handleSubmit();
    }
  };

  const handleBack = () => {
    setError(null);
    setStep(s => s - 1);
  };

  const buildEventData = () => {
    const data = {
      eventMeetingType: eventMeetingType || 'event',
      eventName: formData.eventName,
      eventDescription: formData.eventDescription,
      eventType: formData.eventType,
      eventRoom: formData.eventRoom,
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
        response = await axios.put(`${BASE_URL}/events/${editEventType}/${eventId}`, data);
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

  if (pageLoading) {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto">
          <div className="bg-white border border-gray-200 ppp-lg p-12 text-center">
            <div className="ppp-full h-8 w-8 mx-auto"><SpiralLoader /></div>
            <p className="text-sm text-gray-500 mt-3">Loading event data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto">
          <div className="bg-white border border-gray-200 ppp-lg p-12 text-center">
            <div className="ppp-full h-8 w-8 mx-auto"><SpiralLoader /></div>
            <p className="text-sm text-gray-500 mt-3">{isEditMode ? 'Updating' : 'Creating'} {typeLower}...</p>
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
                  <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                    <FiUsers className="w-5 h-5 text-blue-600" />
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
                    className="flex-1 py-2.5 border border-zinc-300 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    Later
                  </button>
                  <button
                    onClick={() => {
                      setShowInviteModal(false);
                      const roleSlug = window.location.pathname.split('/')[1];
                      navigate(`/${roleSlug || 'event-manager'}/events/${createdEventSpecialId}/invite`);
                    }}
                    className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Invite Now
                  </button>
                </div>
              </div>
            </div>
          )}

        <div className="bg-white border border-gray-200 overflow-hidden">
          <CreateEventStepper currentStep={step} eventMeetingType={eventMeetingType} eventMode={eventMode} />

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
              <EventRoomSelector
                eventMode={eventMode}
                formData={formData}
                onChange={handleChange}
                recurringType={recurringType}
                monthlyPattern={monthlyPattern}
              />
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
                  className="flex-1 py-2.5 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors ppp-lg"
                >
                  Back
                </button>
              )}

              {step < maxSteps ? (
                <button type="submit"
                  className="flex-[2] py-2.5 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all ppp-lg"
                >
                  Next
                </button>
              ) : (
                <button type="submit"
                  disabled={loading}
                  className="flex-[2] py-2.5 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all ppp-lg inline-flex items-center justify-center gap-2"
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