import { useState } from "react";
import { FiArrowLeft, FiAlertCircle, FiCheckCircle, FiEdit2, FiTrash2, FiMail, FiUsers, FiDroplet } from "react-icons/fi";
import axios from "axios";

import {
  PRIMARY, PRIMARY_HOVER, DANGER, SUCCESS, SUCCESS_HOVER, NEUTRAL_LIGHT, NEUTRAL_DARK, BORDER, WHITE, GRAY_DISABLED, fontHeading,
  CARD_SHADOW, getBtnStyle, btnHover, btnLeavePrimary, btnLeaveDanger, StatusBadge, DetailRow,
} from "./TrackShared";

const BASE_URL = "/cok/api/v1";

function TrackResult({
  request, onEdit, onCancelClick, onInvite, loading,
  showInvited, setShowInvited, invitedPeople, invitedCount, invitedLoading,
  onToggleInvited, onRemoveInvited,
}) {
  // Water request: only possible once the event manager accepted the request
  // and only for Internal type — the button is not rendered otherwise
  const [waterRequested, setWaterRequested] = useState(!!request?.waterRequest?.requested);
  const [waterBusy, setWaterBusy] = useState(false);
  const [waterError, setWaterError] = useState("");

  const handleRequestWater = async () => {
    setWaterBusy(true);
    setWaterError("");
    try {
      await axios.put(`${BASE_URL}/booking-requests/tracking/${request.trackingCode}/request-water`);
      setWaterRequested(true);
    } catch (err) {
      setWaterError(err.response?.data?.message || "Failed to request water. Try again.");
    } finally {
      setWaterBusy(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="mt-4 w-full max-w-lg  overflow-hidden" style={{ backgroundColor: NEUTRAL_LIGHT, boxShadow: CARD_SHADOW, border: '0' }}>
      <div className="p-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{request.eventName}</h3>
            <span className="text-xs font-mono font-medium px-2 py-0.5 inline-block mt-1" style={{ color: PRIMARY, backgroundColor: '#E3F2FD' }}>{request.trackingCode}</span>
          </div>
          <StatusBadge status={request.status} />
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <div>
            <DetailRow label="Type" value={request.eventMeetingType} />
            <DetailRow label="Event Type" value={request.eventType} />
            <DetailRow label="Room" value={request.eventRoom} />
            <DetailRow label="Start" value={formatDate(request.startTime)} />
            <DetailRow label="End" value={formatDate(request.endTime)} />
          </div>
          <div>
            <DetailRow label="Organizer" value={request.eventOrganizer?.fullNames} />
            <DetailRow label="Email" value={request.eventOrganizer?.email} />
            <DetailRow label="Phone" value={request.eventOrganizer?.phone} />
            <DetailRow label="Institution" value={request.eventOrganizer?.institution || "—"} />
            <DetailRow label="Audience" value={request.expectedAudience ? `${request.expectedAudience} people` : "—"} />
          </div>
        </div>
        {request.eventDescription && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <DetailRow label="Description" value={request.eventDescription} />
          </div>
        )}
        {request.status === "Rejected" && request.rejectionReason && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <div className="p-3" style={{ backgroundColor: '#FFEBEE', border: `1px solid ${DANGER}` }}>
              <p className="text-xs font-medium uppercase" style={{ color: '#C62828', fontFamily: fontHeading }}>Reason</p>
              <p className="text-sm mt-1" style={{ color: '#C62828', fontFamily: fontHeading }}>{request.rejectionReason}</p>
            </div>
          </div>
        )}
        {request.status === "Accepted" && request.acceptedEventSpecialId && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <div className="p-3" style={{ backgroundColor: '#E8F5E9', border: `1px solid ${SUCCESS}` }}>
              <p className="text-sm font-medium" style={{ color: SUCCESS_HOVER, fontFamily: fontHeading }}>
                <FiCheckCircle className="w-4 h-4 inline" />Your Request Has Been Accepted
              </p>
            </div>

            <button
              type="button"
              onClick={onToggleInvited}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all"
              style={{ border: `1px solid ${PRIMARY}`, color: PRIMARY, backgroundColor: WHITE, fontFamily: fontHeading }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; e.currentTarget.style.color = WHITE; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = WHITE; e.currentTarget.style.color = PRIMARY; }}
            >
              <FiUsers className="w-4 h-4" />
              {showInvited ? "Hide Invited People" : `View Invited People${invitedCount ? ` (${invitedCount})` : ""}`}
            </button>

            {showInvited && (
              <div className="mt-3 border" style={{ borderColor: BORDER }}>
                {invitedLoading ? (
                  <div className="flex items-center justify-center py-6 text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                    <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin mr-2" /> Loading…
                  </div>
                ) : invitedPeople.length === 0 ? (
                  <p className="p-4 text-sm text-center" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>No one has been invited yet.</p>
                ) : (
                  <ul className="divide-y max-h-60 overflow-y-auto" style={{ borderColor: `${BORDER}1A` }}>
                    {invitedPeople.map((person) => (
                      <li key={person._id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className={`truncate ${person.cancelled ? "line-through" : ""}`} style={{ color: person.cancelled ? GRAY_DISABLED : NEUTRAL_DARK, fontFamily: fontHeading }}>
                          {person.email}
                        </span>
                        <span className="flex items-center gap-2 ml-2 shrink-0">
                          <span className="text-[10px]" style={{ color: GRAY_DISABLED }}>
                            {person.invitedAt ? new Date(person.invitedAt).toLocaleDateString() : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveInvited(person)}
                            title="Remove invite"
                            className="transition-colors"
                            style={{ color: GRAY_DISABLED }}
                            onMouseEnter={(e) => e.currentTarget.style.color = DANGER}
                            onMouseLeave={(e) => e.currentTarget.style.color = GRAY_DISABLED}
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onInvite}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all"
              style={getBtnStyle('primary')}
              onMouseEnter={(e) => btnHover(e, PRIMARY_HOVER)}
              onMouseLeave={(e) => btnLeavePrimary(e)}
            >
              <FiMail className="w-4 h-4" /> Invite People
            </button>

            {/* Water request — only for accepted Internal meetings */}
            {request.eventType === "Internal" && (
              waterRequested ? (
                <div
                  className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium"
                  style={{ border: `1px solid ${SUCCESS}`, color: SUCCESS_HOVER, backgroundColor: '#E8F5E9', fontFamily: fontHeading }}
                >
                  <FiCheckCircle className="w-4 h-4" />
                  {request.expectedAudience
                    ? `Requested water for ${request.expectedAudience} people`
                    : "Water Requested"}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestWater}
                  disabled={waterBusy}
                  title={request.expectedAudience ? `Water will be requested for your ${request.expectedAudience} expected people` : undefined}
                  className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all"
                  style={{ border: `1px solid ${PRIMARY}`, color: PRIMARY, backgroundColor: WHITE, fontFamily: fontHeading, opacity: waterBusy ? 0.7 : 1 }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; e.currentTarget.style.color = WHITE; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = WHITE; e.currentTarget.style.color = PRIMARY; }}
                >
                  <FiDroplet className="w-4 h-4" />
                  {waterBusy
                    ? "Requesting…"
                    : request.expectedAudience
                      ? `Request Water (${request.expectedAudience} people)`
                      : "Request Water"}
                </button>
              )
            )}
            {waterError && (
              <p className="mt-2 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{waterError}</p>
            )}
          </div>
        )}
        {request.status === "Pending" && (
          <div className="mt-4 pt-3 flex flex-wrap justify-end gap-2" style={{ borderTop: `1px solid ${BORDER}` }}>
            <button onClick={onEdit} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all" style={{ border: `1px solid ${PRIMARY}`, color: PRIMARY, backgroundColor: WHITE, fontFamily: fontHeading }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; e.currentTarget.style.color = WHITE; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = WHITE; e.currentTarget.style.color = PRIMARY; }}>
              <FiEdit2 className="w-4 h-4" /> Edit
            </button>
            <button onClick={onCancelClick} disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all" style={{ border: `1px solid ${DANGER}`, color: DANGER, backgroundColor: WHITE, fontFamily: fontHeading }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DANGER; e.currentTarget.style.color = WHITE; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = WHITE; e.currentTarget.style.color = DANGER; }}>
              <FiTrash2 className="w-4 h-4" /> Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TrackResult;
