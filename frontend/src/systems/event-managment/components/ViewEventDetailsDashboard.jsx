import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiEdit2, FiXCircle, FiClock, FiUsers, FiMail, FiX, FiRefreshCw } from 'react-icons/fi';
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
  const [invitedCount, setInvitedCount] = useState(0);
  const [invitedPeople, setInvitedPeople] = useState([]);
  const [showInvitedModal, setShowInvitedModal] = useState(false);
  const [invitedLoading, setInvitedLoading] = useState(false);
  const [invitedPage, setInvitedPage] = useState(1);
  const [invitedTotalPages, setInvitedTotalPages] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { _id, email }

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

  // Fetch invited people count
  useEffect(() => {
    if (!event?.eventSpecialId) return;
    axios
      .get(`${BASE_URL}/events/${event.eventSpecialId}/invited`, { params: { limit: 1 } })
      .then((res) => {
        if (res.data?.success) setInvitedCount(res.data.totalRecords || 0);
      })
      .catch(() => {});
  }, [event?.eventSpecialId]);

  // Fetch invited people list for modal
  const fetchInvitedPeople = async (page = 1) => {
    if (!event?.eventSpecialId) return;
    setInvitedLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/events/${event.eventSpecialId}/invited`, { params: { page, limit: 50 } });
      if (res.data?.success) {
        setInvitedPeople(res.data.data || []);
        setInvitedTotalPages(res.data.totalPages || 1);
        setInvitedPage(page);
      }
    } catch (err) {
      console.error("Failed to fetch invited people:", err);
    } finally {
      setInvitedLoading(false);
    }
  };

  // Re-activate a previously cancelled (specific-date) invite.
  const reactivateInvite = async (person) => {
    try {
      await axios.patch(`${BASE_URL}/events/invited/${person._id}/reactivate`);
      fetchInvitedPeople(invitedPage);
    } catch (err) {
      console.error("Failed to re-activate invitation:", err);
    }
  };

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

        {/* Invited People */}
        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Invited People</h3>
          </div>
          <div className="px-6 py-4">
            <button
              onClick={() => {
                fetchInvitedPeople(1);
                setShowInvitedModal(true);
              }}
              className="inline-flex items-center gap-3 p-4 border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 transition-all duration-200 w-full text-left group"
            >
              <div className="w-10 h-10 bg-blue-100 flex items-center justify-center group-hover:bg-blue-600 transition-colors duration-200">
                <FiMail className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors duration-200" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                  Invited People ({invitedCount})
                </p>
                <p className="text-xs text-gray-500">
                  Click to view all invited people
                </p>
              </div>
              <div className="ml-auto">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 text-sm font-bold group-hover:bg-blue-600 group-hover:text-white transition-all">
                  {invitedCount}
                </span>
              </div>
            </button>
          </div>
        </div>

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

      {/* Invited People Modal */}
      {showInvitedModal && (
        <div className="fixed inset-0 z-[99999] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FiUsers className="w-5 h-5 text-blue-600" />
                Invited People
              </h3>
              <button
                onClick={() => setShowInvitedModal(false)}
                className="p-1 hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {invitedLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 mx-auto"><SpiralLoader /></div>
                  <p className="text-sm text-gray-500 mt-3">Loading...</p>
                </div>
              ) : invitedPeople.length === 0 ? (
                <div className="text-center py-8">
                  <FiUsers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No one has been invited yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {invitedPeople.map((person, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-blue-600">
                            {person.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-800 truncate">{person.email}</p>
                            {person.cancelled && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-orange-100 text-orange-600">
                                Cancelled
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400">
                            {new Date(person.invitedAt).toLocaleDateString()}
                            {person.specificDate?.start && (
                              <> · {new Date(person.specificDate.start).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</>
                            )}
                          </p>
                        </div>
                      </div>
                      {person.cancelled ? (
                        <button
                          onClick={() => reactivateInvite(person)}
                          className="p-1.5 text-orange-500 hover:text-orange-700 hover:bg-orange-50 transition-colors"
                          title="Re-activate invitation"
                        >
                          <FiRefreshCw className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm({ _id: person._id, email: person.email })}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove invitation"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {invitedTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    disabled={invitedPage <= 1}
                    onClick={() => fetchInvitedPeople(invitedPage - 1)}
                    className="px-3 py-1 text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-gray-500">
                    Page {invitedPage} of {invitedTotalPages}
                  </span>
                  <button
                    disabled={invitedPage >= invitedTotalPages}
                    onClick={() => fetchInvitedPeople(invitedPage + 1)}
                    className="px-3 py-1 text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Footer - only show invite button for non-past events */}
            {!isPastEvent && (
            <div className="p-5 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowInvitedModal(false);
                  navigate(`/event-manager/events/${event?.eventSpecialId}/invite`);
                }}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Invite More People
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[99999] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Removal</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to remove <strong>{deleteConfirm.email}</strong> from the invited list?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await axios.delete(`/cok/api/v1/events/invited/${deleteConfirm._id}`);
                    setDeleteConfirm(null);
                    fetchInvitedPeople(invitedPage);
                    setInvitedCount(prev => Math.max(0, prev - 1));
                  } catch (err) {
                    console.error("Failed to remove invitation:", err);
                    setDeleteConfirm(null);
                  }
                }}
                className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

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