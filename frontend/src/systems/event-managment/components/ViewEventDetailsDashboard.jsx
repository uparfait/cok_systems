import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiEdit2, FiXCircle, FiClock, FiUsers } from 'react-icons/fi';
import axios from 'axios';
import SpiralLoader from './SpiralLoader';
import EventDetailHeader from './sub-components/EventDetailHeader';
import EventDetailBasicInfo from './sub-components/EventDetailBasicInfo';
import EventDetailOrganizer from './sub-components/EventDetailOrganizer';
import EventDetailAgenda from './sub-components/EventDetailAgenda';
import CancelPostponeModal from './sub-components/CancelPostponeModal';
import AttendeesOverlay from './AttendeesOverlay';

const BASE_URL = '/cok/api/v1';
const EVENT_TYPES = ['live', 'recurring', 'upcoming', 'past'];

export default function ViewEventDetailsDashboard() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventMode, setEventMode] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState('cancel'); // 'cancel' | 'postpone'
  const [attendeesOverlayOpen, setAttendeesOverlayOpen] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState(null);

  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoints = [
          `${BASE_URL}/events/live?search=${eventId}&searchField=eventSpecialId&limit=1`,
          `${BASE_URL}/events/recurring?search=${eventId}&searchField=eventSpecialId&limit=1`,
          `${BASE_URL}/events/upcoming?search=${eventId}&searchField=eventSpecialId&limit=1`,
          `${BASE_URL}/events/past?search=${eventId}&searchField=eventSpecialId&limit=1`,
        ];

        let foundEvent = null;
        let foundMode = '';

        for (const [index, endpoint] of endpoints.entries()) {
          try {
            const response = await axios.get(endpoint);
            if (response.data?.success && response.data.data?.length > 0) {
              foundEvent = response.data.data[0];
              
              foundMode = EVENT_TYPES[index] || 'live';
              break;
            }
          } catch {
            // continue to next endpoint
          }
        }

        if (foundEvent) {
          setEvent(foundEvent);
          setEventMode(foundMode);
        } else {
          setError('Event not found');
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load event');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  const openModal = (action) => {
    setModalAction(action);
    setModalOpen(true);
  };

  const handleManagementSuccess = (updatedEvent) => {
    if (updatedEvent) {
      setEvent(updatedEvent);
      if (updatedEvent.isCancelled) {
        setEventMode('past');
      }
    }
   
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <SpiralLoader />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Event Not Found</h2>
          <p className="text-gray-500 mb-6">{error || 'The event you are looking for does not exist.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 bg-blue-600 text-white ppp-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const isPastEvent = eventMode === 'past';
  const canManage = !isPastEvent && !event.isCancelled;
  const canPostpone = canManage && eventMode !== 'recurring';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <EventDetailHeader event={event} eventMode={eventMode} navigate={navigate} />

      {/* Action Buttons */}
      {canManage && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => openModal('cancel')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white ppp-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <FiXCircle className="w-4 h-4" />
              Cancel Event
            </button>
            {canPostpone && (
              <button
                onClick={() => openModal('postpone')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white ppp-lg text-sm font-medium hover:bg-amber-700 transition-colors"
              >
                <FiClock className="w-4 h-4" />
                Postpone Event
              </button>
            )}
            <button
              onClick={() => navigate(`/event-manager/events/${eventId}/edit`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white ppp-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <FiEdit2 className="w-4 h-4" />
              Edit Event
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Basic Information - Inline editable */}
        <EventDetailBasicInfo event={event} eventMode={eventMode} onEventUpdated={(updatedEvent) => {
          setEvent(updatedEvent);
          if (updatedEvent.isCancelled) setEventMode('past');
        }} />

        {/* Total Attended */}
        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Attendance</h3>
          </div>
          <div className="px-6 py-4">
            <button
              onClick={async () => {
                try {
                  const res = await axios.get(`${BASE_URL}/attendance`, {
                    params: { eventSpecialId: event.eventSpecialId, limit: 1 },
                  });
                  setAttendeeCount(res.data?.totalRecords || 0);
                } catch { setAttendeeCount(0); }
                setAttendeesOverlayOpen(true);
              }}
              className="inline-flex items-center gap-3 p-4 border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 transition-all duration-200 w-full text-left group"
            >
              <div className="w-10 h-10 bg-blue-100 flex items-center justify-center group-hover:bg-blue-600 transition-colors duration-200">
                <FiUsers className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors duration-200" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                  Total Attended
                </p>
                <p className="text-xs text-gray-500">
                  Click to view all attendees
                </p>
              </div>
              <div className="ml-auto">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 text-sm font-bold group-hover:bg-blue-600 group-hover:text-white transition-all">
                  {attendeeCount !== null ? attendeeCount : "—"}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Organizer - Inline editable */}
        <EventDetailOrganizer event={event} eventMode={eventMode} onEventUpdated={(updatedEvent) => {
          setEvent(updatedEvent);
        }} />

        {/* Activity Agenda - Inline editable */}
        <EventDetailAgenda event={event} eventMode={eventMode} onEventUpdated={(updatedEvent) => {
          setEvent(updatedEvent);
        }} />
      </div>

      {/* Attendees Overlay */}
      {attendeesOverlayOpen && (
        <AttendeesOverlay
          eventSpecialId={event.eventSpecialId}
          eventName={event.eventName}
          onClose={() => setAttendeesOverlayOpen(false)}
        />
      )}

      {/* Cancel/Postpone Modal */}
      <CancelPostponeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        action={modalAction}
        event={event}
        eventMode={eventMode}
        onSuccess={handleManagementSuccess}
      />
    </div>
  );
}