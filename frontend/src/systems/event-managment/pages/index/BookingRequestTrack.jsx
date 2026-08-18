import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import ConfirmModal from "../../ui-components/ConfirmModal";
import SystemAlert from "@/core/components/SystemAlert";
import TrackResult from "./components/TrackResult";
import CoOrganizersPanel from "./components/CoOrganizersPanel";
import { PRIMARY, DANGER, NEUTRAL_LIGHT, BORDER, fontHeading } from "./components/TrackShared";

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
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, variant: "primary", title: "", message: "", onConfirm: null });
  const [systemAlert, setSystemAlert] = useState({ isOpen: false, type: "warning", message: "" });

  const [showInvited, setShowInvited] = useState(false);
  const [invitedPeople, setInvitedPeople] = useState([]);
  const [invitedCount, setInvitedCount] = useState(0);
  const [invitedLoading, setInvitedLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
    setLoading(true); setError(null);
    try {
      const res = await axios.get(`${BASE_URL}/booking-requests/tracking/${code}`);
      if (res.data.success) {
        setRequest(res.data.data);
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
    } catch (err) {
      setAlertFromError(err, setSystemAlert);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>TRACK YOUR BOOK REQUEST</title></Helmet>
      <div className="w-full min-h-screen items-center flex flex-col mx-auto px-3 sm:px-4" style={{ backgroundColor: NEUTRAL_LIGHT, paddingTop: "110px", paddingBottom: "60px" }}>
        <div className="w-full max-w-lg overflow-hidden bg-white" style={{ border: `1px solid ${BORDER}` }}>
          <div className="px-4 sm:px-6 py-4" style={{ backgroundColor: PRIMARY }}>
            <h1 className="text-base font-bold uppercase tracking-widest text-white" style={{ fontFamily: fontHeading }}>Track Your Booking</h1>
            <p className="text-xs font-medium mt-1" style={{ color: 'rgba(255,255,255,0.75)', fontFamily: fontHeading }}>Enter your Booking ID (e.g., BRK-A1B2C3D4).</p>
          </div>
          <div className="p-4 sm:p-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input type="text" value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder="Enter your booking id"
              className="w-full sm:flex-1 min-w-0 sm:min-w-[240px] cok-auth-input pr-3 py-3 sm:py-3.5 text-sm sm:text-base"
              style={{ paddingLeft: '14px' }} />
            <button type="submit" disabled={loading || !trackingCode.trim()}
              className="cok-btn-primary sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ width: '100%', padding: '0.85rem 1.6rem' }}>
              {loading ? "Searching..." : "Track"}
            </button>
          </form>
          <button type="button" onClick={() => navigate("/book-a-room/options")} className="cok-btn-outlined mt-3 w-full" style={{ padding: '0.85rem 1.2rem' }}>
            Back
          </button>
          </div>
        </div>

        {error && <div className="mt-4 w-full max-w-lg p-3" style={{ backgroundColor: '#FFEBEE', border: `1px solid ${DANGER}` }}><p className="text-sm" style={{ color: '#C62828', fontFamily: fontHeading }}>{error}</p></div>}
        <SystemAlert isOpen={systemAlert.isOpen} type={systemAlert.type} message={systemAlert.message} onClose={() => setSystemAlert((s) => ({ ...s, isOpen: false }))} />

        {request && (
          <TrackResult
            request={request}
            onUpdated={(updated) => setRequest(updated)}
            onCancelClick={() => setConfirmModal({ isOpen: true, variant: "danger", title: "Cancel Request", message: "This cannot be undone.", confirmText: "Yes, Cancel", onConfirm: handleCancel })}
            onInvite={() => navigate(`/event/${request.acceptedEventSpecialId}/invite`)}
            loading={loading}
            showInvited={showInvited}
            invitedPeople={invitedPeople} invitedCount={invitedCount} invitedLoading={invitedLoading}
            onToggleInvited={toggleInvited} onRemoveInvited={(person) => setDeleteTarget(person)}
          />
        )}

        {request && request.status === "Accepted" && request.acceptedEventSpecialId && (
          <div className="w-full max-w-lg">
            <CoOrganizersPanel eventSpecialId={request.acceptedEventSpecialId} />
          </div>
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
