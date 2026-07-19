import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { FiArrowLeft, FiAlertCircle } from "react-icons/fi";
import ConfirmModal from "../../ui-components/ConfirmModal";
import SystemAlert from "@/core/components/SystemAlert";
import TrackResult from "./components/TrackResult";
import TrackEditForm from "./components/TrackEditForm";
import {
  PRIMARY, PRIMARY_HOVER, DANGER, NEUTRAL_LIGHT, BORDER, WHITE, GRAY_DISABLED, fontHeading,
  CARD_SHADOW, FOCUS_SHADOW, BLUR_SHADOW, inputStyle, getBtnStyle, btnHover, btnLeavePrimary,
} from "./components/TrackShared";

const BASE_URL = "/cok/api/v1";

const setAlertFromError = (err, setSystemAlert) => {
  const status = err.response?.status;
  const message = err.response?.data?.message || err.message || "Something went wrong, try again later.";
  if (status === 500 || status === 505) setSystemAlert({ isOpen: true, type: "systemError", message });
  else if (status === 400 || status === 404) setSystemAlert({ isOpen: true, type: "warning", message });
  else setSystemAlert({ isOpen: true, type: "error", message });
};

export default function BookingRequestTrack() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCode = searchParams.get("code") || "";
  const [trackingCode, setTrackingCode] = useState(initialCode);
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editStep, setEditStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [editForm, setEditForm] = useState({});
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, variant: "primary", title: "", message: "", onConfirm: null });
  const [systemAlert, setSystemAlert] = useState({ isOpen: false, type: "error", message: "" });

  const [showInvited, setShowInvited] = useState(false);
  const [invitedPeople, setInvitedPeople] = useState([]);
  const [invitedCount, setInvitedCount] = useState(0);
  const [invitedLoading, setInvitedLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const showAgenda = editForm.eventMeetingType === "meet";
  const maxSteps = showAgenda ? 5 : 4;

  const removeInvited = async (person) => {
    try {
      await axios.delete(`${BASE_URL}/events/invited/${person._id}`);
      setInvitedPeople((prev) => prev.filter((p) => p._id !== person._id));
      setInvitedCount((c) => Math.max(0, c - 1));
    } catch (err) {
      setAlertFromError(err, setSystemAlert);
    } finally {
      setDeleteTarget(null);
    }
  };

  const fetchInvitedPeople = async (eventSpecialId) => {
    setInvitedLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/events/${eventSpecialId}/invited`, { params: { limit: 100 } });
      if (res.data?.success) {
        setInvitedPeople(res.data.data || []);
        setInvitedCount(res.data.totalRecords || 0);
      }
    } catch (err) {
      setAlertFromError(err, setSystemAlert);
    } finally {
      setInvitedLoading(false);
    }
  };

  const toggleInvited = () => {
    const next = !showInvited;
    setShowInvited(next);
    if (next && request?.acceptedEventSpecialId && invitedPeople.length === 0) {
      fetchInvitedPeople(request.acceptedEventSpecialId);
    }
  };

  useEffect(() => { if (initialCode) handleSearchWithCode(initialCode); /* eslint-disable-next-line */ }, []);

  const handleSearchWithCode = async (code) => {
    setLoading(true); setError(null); setSearched(true);
    try {
      const res = await axios.get(`${BASE_URL}/booking-requests/tracking/${code}`);
      if (res.data.success) {
        const r = res.data.data;
        setRequest(r);
        setEditForm({
          eventMeetingType: r.eventMeetingType || "event", eventName: r.eventName, eventDescription: r.eventDescription, eventType: r.eventType, eventRoom: r.eventRoom,
          organizerNames: r.eventOrganizer?.fullNames || "", organizerEmail: r.eventOrganizer?.email || "", organizerPhone: r.eventOrganizer?.phone || "", organizerInstitution: r.eventOrganizer?.institution || "",
          startTime: r.startTime ? new Date(r.startTime).toISOString().slice(0, 16) : "", endTime: r.endTime ? new Date(r.endTime).toISOString().slice(0, 16) : "",
          audience: r.expectedAudience || "",
          agenda: (r.activityAgenda && r.activityAgenda.length > 0) ? r.activityAgenda : [{ fromTime: "", toTime: "", title: "", description: "" }],
        });
      }
    } catch (err) {
      setAlertFromError(err, setSystemAlert);
      setRequest(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => { e.preventDefault(); if (trackingCode.trim()) handleSearchWithCode(trackingCode.trim()); };

  const handleCancel = async () => {
    setLoading(true);
    try {
      await axios.put(`${BASE_URL}/booking-requests/${request._id}/cancel`);
      setRequest((prev) => ({ ...prev, status: "Cancelled" }));
      setIsEditing(false);
    } catch (err) {
      setAlertFromError(err, setSystemAlert);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    setLoading(true); setEditFieldErrors({});
    try {
      const payload = {
        eventName: editForm.eventName, eventDescription: editForm.eventDescription, eventType: editForm.eventType, eventRoom: editForm.eventRoom,
        eventOrganizer: { fullNames: editForm.organizerNames, email: editForm.organizerEmail, phone: editForm.organizerPhone, institution: editForm.organizerInstitution || "" },
        startTime: editForm.startTime ? new Date(editForm.startTime).toISOString() : undefined,
        endTime: editForm.endTime ? new Date(editForm.endTime).toISOString() : undefined,
        expectedAudience: Number(editForm.audience),
        activityAgenda: showAgenda ? editForm.agenda.filter((a) => a.title?.trim()) : [],
      };
      const res = await axios.put(`${BASE_URL}/booking-requests/${request._id}`, payload);
      if (res.data.success) {
        setRequest((prev) => ({
          ...prev, ...payload, eventOrganizer: payload.eventOrganizer,
          startTime: payload.startTime ? new Date(payload.startTime) : prev.startTime,
          endTime: payload.endTime ? new Date(payload.endTime) : prev.endTime,
        }));
        setIsEditing(false); setEditStep(1); setCompletedSteps([]);
      }
    } catch (err) {
      setAlertFromError(err, setSystemAlert);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = () => { setEditStep(1); setCompletedSteps([]); setEditFieldErrors({}); setIsEditing(true); };

  return (
    <>
      <Helmet><title>TRACK YOUR BOOK REQUEST</title></Helmet>
      <div className="w-full items-center flex flex-col mx-auto mt-8 px-4">
        {!isEditing && (
          <div className="mt-4 w-full max-w-lg overflow-hidden" style={{ backgroundColor: NEUTRAL_LIGHT, boxShadow: CARD_SHADOW, border: '0', padding: '40px' }}>
            <h1 className="text-2xl sm:text-3xl font-extrabold mb-1" style={{ color: PRIMARY, fontFamily: fontHeading, letterSpacing: '-0.5px' }}>Track Your Booking</h1>
            <p className="text-xs font-medium mb-4" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Enter your Booking ID (e.g., BRK-A1B2C3D4).</p>
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input type="text" value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder="Enter your booking id"
                className="flex-1 min-w-0 px-3 py-2 text-sm focus:outline-none transition-all duration-200"
                style={{ ...inputStyle, borderColor: BORDER }}
                onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = FOCUS_SHADOW; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = BLUR_SHADOW; }} />
              <button type="submit" disabled={loading || !trackingCode.trim()} style={getBtnStyle('primary', loading || !trackingCode.trim())} className="w-full sm:w-auto"
                onMouseEnter={(e) => { if (!loading && trackingCode.trim()) btnHover(e, PRIMARY_HOVER); }}
                onMouseLeave={(e) => btnLeavePrimary(e)}>
                {loading ? "Searching..." : "Track"}
              </button>
            </form>
            <button type="button" onClick={() => navigate("/book-a-room/options")} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all" style={{ border: `1px solid ${PRIMARY}`, color: PRIMARY, backgroundColor: WHITE, fontFamily: fontHeading }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; e.currentTarget.style.color = WHITE; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = WHITE; e.currentTarget.style.color = PRIMARY; }}>
              <FiArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>
        )}

        {error && <div className="mt-4 w-full max-w-lg p-3 flex items-start gap-2" style={{ backgroundColor: '#FFEBEE', border: `1px solid ${DANGER}` }}><FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: DANGER }} /><p className="text-sm" style={{ color: '#C62828', fontFamily: fontHeading }}>{error}</p></div>}
        <SystemAlert isOpen={systemAlert.isOpen} type={systemAlert.type} message={systemAlert.message} onClose={() => setSystemAlert((s) => ({ ...s, isOpen: false }))} />

        {request && !isEditing && (
          <TrackResult
            request={request}
            onEdit={startEditing}
            onCancelClick={() => setConfirmModal({ isOpen: true, variant: "danger", title: "Cancel Request", message: "This cannot be undone.", confirmText: "Yes, Cancel", onConfirm: handleCancel })}
            onInvite={() => navigate(`/event/${request.acceptedEventSpecialId}/invite`)}
            loading={loading}
            showInvited={showInvited} setShowInvited={setShowInvited}
            invitedPeople={invitedPeople} invitedCount={invitedCount} invitedLoading={invitedLoading}
            onToggleInvited={toggleInvited} onRemoveInvited={removeInvited}
          />
        )}

        {request && isEditing && (
          <TrackEditForm
            editForm={editForm} setEditForm={setEditForm}
            editFieldErrors={editFieldErrors} setEditFieldErrors={setEditFieldErrors}
            editStep={editStep} setEditStep={setEditStep}
            completedSteps={completedSteps} setCompletedSteps={setCompletedSteps}
            maxSteps={maxSteps} showAgenda={showAgenda}
            loading={loading} requestId={request._id}
            systemAlert={systemAlert} setSystemAlert={setSystemAlert}
            onCancel={() => { setIsEditing(false); setEditStep(1); setCompletedSteps([]); setEditFieldErrors({}); }}
            onSave={handleSaveEdit}
          />
        )}

        <ConfirmModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false })} onConfirm={async () => { await confirmModal.onConfirm(); setConfirmModal({ isOpen: false }); }} title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText || "Confirm"} confirmVariant={confirmModal.variant} loading={loading} />

        <ConfirmModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => removeInvited(deleteTarget)}
          title="Remove Invite"
          message={`Remove ${deleteTarget?.email || "this person"} from the invited list?`}
          confirmText="Remove"
          confirmVariant="danger"
          loading={loading}
        />
      </div>
    </>
  );
}
