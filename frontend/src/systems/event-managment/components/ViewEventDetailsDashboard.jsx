import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiXCircle, FiUsers, FiMail, FiX, FiRefreshCw } from 'react-icons/fi';
import axios from 'axios';
import SpiralLoader from './SpiralLoader';
import EventDetailHeader from './sub-components/EventDetailHeader';
import EventDetailBasicInfo from './sub-components/EventDetailBasicInfo';
import EventDetailOrganizer from './sub-components/EventDetailOrganizer';
import EventDetailAgenda from './sub-components/EventDetailAgenda';
import CancelPostponeModal from './sub-components/CancelPostponeModal';
import AttendeesOverlay from './AttendeesOverlay';
import EventMinutesView from '../pages/index/components/EventMinutesView';
import CoOrganizersPanel from '../pages/index/components/CoOrganizersPanel';
import { useToast } from '@/core/contexts/ToastContext';

const BASE_URL = '/cok/api/v1';
const EVENT_TYPES = ['live', 'recurring', 'upcoming', 'past'];

const PRIMARY = '#056daa';
const PRIMARY_TINT = '#E3F2FD';
const DANGER = '#E74C3C';
const NEUTRAL_LIGHT = '#F7F9FB';
const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const GRAY_DISABLED = '#9E9E9E';
const fontHeading = "'Montserrat', sans-serif";

const sectionTitleStyle = { color: PRIMARY, fontFamily: fontHeading };

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
  const [removingInvite, setRemovingInvite] = useState(false);
  const [reactivatingId, setReactivatingId] = useState(null);
  const { showSuccess, showError } = useToast();

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
      showError(err.response?.data?.message || err.message);
    } finally {
      setInvitedLoading(false);
    }
  };

  // Re-activate a previously cancelled (specific-date) invite.
  const reactivateInvite = async (person) => {
    setReactivatingId(person._id);
    try {
      const res = await axios.patch(`${BASE_URL}/events/invited/${person._id}/reactivate`);
      showSuccess(res.data?.message || 'Invitation re-activated successfully');
      fetchInvitedPeople(invitedPage);
    } catch (err) {
      showError(err.response?.data?.message || err.message);
    } finally {
      setReactivatingId(null);
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <SpiralLoader />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <div className="w-full max-w-md text-center p-6 sm:p-8" style={{ backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}` }}>
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Event Not Found</h2>
          <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>{error || 'The event you are looking for does not exist.'}</p>
        </div>
      </div>
    );
  }

  const isPastEvent = eventMode === 'past';
  const canManage = !isPastEvent && !event.isCancelled;

  return (
    <div className="min-h-screen" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      {/* Header */}
      <EventDetailHeader event={event} eventMode={eventMode} />

      {/* Action Buttons */}
      {canManage && (
        <div className="max-w-5xl mx-auto px-3 sm:px-6 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <button
              onClick={() => openModal('cancel')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white text-xs font-semibold uppercase tracking-wide cursor-pointer transition-colors"
              style={{ backgroundColor: DANGER, fontFamily: fontHeading }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#C0392B')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = DANGER)}
            >
              <FiXCircle className="w-4 h-4" />
              Cancel Event
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Basic Information - Inline editable */}
        <EventDetailBasicInfo event={event} eventMode={eventMode} onEventUpdated={(updatedEvent) => {
          setEvent(updatedEvent);
          if (updatedEvent.isCancelled) setEventMode('past');
        }} />

        {/* Invited People */}
        <div className="bg-white overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
          <div className="px-4 sm:px-6 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <h3 className="text-xs font-bold uppercase tracking-wider" style={sectionTitleStyle}>Invited People</h3>
          </div>
          <div className="px-4 sm:px-6 py-4">
            <button
              onClick={() => {
                fetchInvitedPeople(1);
                setShowInvitedModal(true);
              }}
              className="inline-flex items-center gap-3 p-3 sm:p-4 border-2 hover:bg-blue-50/30 transition-all duration-200 w-full text-left group cursor-pointer"
              style={{ borderColor: BORDER }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = PRIMARY)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = BORDER)}
            >
              <div className="w-10 h-10 flex items-center justify-center shrink-0 group-hover:bg-[#056daa] transition-colors duration-200" style={{ backgroundColor: PRIMARY_TINT }}>
                <FiMail className="w-5 h-5 text-[#056daa] group-hover:text-white transition-colors duration-200" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                  Invited People ({invitedCount})
                </p>
                <p className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                  Click to view all invited people
                </p>
              </div>
              <div className="ml-auto shrink-0">
                <span className="inline-flex items-center justify-center w-8 h-8 text-[#056daa] text-sm font-bold group-hover:bg-[#056daa] group-hover:text-white transition-all" style={{ backgroundColor: PRIMARY_TINT, fontFamily: fontHeading }}>
                  {invitedCount}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Total Attended */}
        <div className="bg-white overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
          <div className="px-4 sm:px-6 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <h3 className="text-xs font-bold uppercase tracking-wider" style={sectionTitleStyle}>Attendance</h3>
          </div>
          <div className="px-4 sm:px-6 py-4">
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
              className="inline-flex items-center gap-3 p-3 sm:p-4 border-2 hover:bg-blue-50/30 transition-all duration-200 w-full text-left group cursor-pointer"
              style={{ borderColor: BORDER }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = PRIMARY)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = BORDER)}
            >
              <div className="w-10 h-10 flex items-center justify-center shrink-0 group-hover:bg-[#056daa] transition-colors duration-200" style={{ backgroundColor: PRIMARY_TINT }}>
                <FiUsers className="w-5 h-5 text-[#056daa] group-hover:text-white transition-colors duration-200" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                  Total Attended
                </p>
                <p className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                  Click to view all attendees
                </p>
              </div>
              <div className="ml-auto shrink-0">
                <span className="inline-flex items-center justify-center w-8 h-8 text-[#056daa] text-sm font-bold group-hover:bg-[#056daa] group-hover:text-white transition-all" style={{ backgroundColor: PRIMARY_TINT, fontFamily: fontHeading }}>
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

         <CoOrganizersPanel eventSpecialId={event.eventSpecialId} />

         {/* Meeting Minutes */}
         <EventMinutesView
           eventSpecialId={event.eventSpecialId}
           activeEvent={event}
           accessToken=""
         />
       </div>

      {/* Invited People Modal */}
      {showInvitedModal && (
        <div className="fixed inset-0 z-[99999] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg max-h-[80vh] flex flex-col" style={{ border: `1px solid ${BORDER}` }}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-2" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                <FiUsers className="w-5 h-5" style={{ color: PRIMARY }} />
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
                </div>
              ) : invitedPeople.length === 0 ? (
                <div className="text-center py-8">
                  <FiUsers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No one has been invited yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {invitedPeople.map((person, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ backgroundColor: PRIMARY_TINT }}>
                          <span className="text-xs font-bold" style={{ color: PRIMARY, fontFamily: fontHeading }}>
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
                              <> · {new Date(person.specificDate.start).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</>
                            )}
                          </p>
                        </div>
                      </div>
                      {person.cancelled ? (
                        <button
                          onClick={() => reactivateInvite(person)}
                          disabled={reactivatingId === person._id}
                          className="p-1.5 text-orange-500 hover:text-orange-700 hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Re-activate invitation"
                        >
                          <FiRefreshCw className={`w-4 h-4 ${reactivatingId === person._id ? 'animate-spin' : ''}`} />
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
            <div className="p-4 sm:p-5" style={{ borderTop: `1px solid ${BORDER}` }}>
              <button
                onClick={() => {
                  setShowInvitedModal(false);
                  navigate(`/event-manager/events/${event?.eventSpecialId}/invite`);
                }}
                className="cok-btn-primary"
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
          <div className="bg-white max-w-sm w-full p-5 sm:p-6" style={{ border: `1px solid ${BORDER}` }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Confirm Removal</h3>
            <p className="text-sm mb-6" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
              Are you sure you want to remove <strong style={{ color: NEUTRAL_DARK }}>{deleteConfirm.email}</strong> from the invited list?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={removingInvite}
                className="cok-btn-outlined flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setRemovingInvite(true);
                  try {
                    const res = await axios.delete(`/cok/api/v1/events/invited/${deleteConfirm._id}`);
                    showSuccess(res.data?.message || 'Invitation removed successfully');
                    setDeleteConfirm(null);
                    fetchInvitedPeople(invitedPage);
                    setInvitedCount(prev => Math.max(0, prev - 1));
                  } catch (err) {
                    showError(err.response?.data?.message || err.message);
                    setDeleteConfirm(null);
                  } finally {
                    setRemovingInvite(false);
                  }
                }}
                disabled={removingInvite}
                className="flex-1 py-2.5 text-white text-xs font-semibold uppercase tracking-wide cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: DANGER, fontFamily: fontHeading }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#C0392B')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = DANGER)}
              >
                {removingInvite ? 'Removing...' : 'Remove'}
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