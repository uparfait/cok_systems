import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FiClock, FiCheckCircle, FiXCircle, FiSlash,
  FiArrowLeft, FiAlertCircle, FiEdit2, FiTrash2, FiSave,
  FiMail, FiUsers,
} from "react-icons/fi";
import ConfirmModal from "../../ui-components/ConfirmModal";
import CreateEventStepper from "../../components/CreateEventStepper";
import ActivityAgenda from "../../components/sub-components/ActivityAgenda";
import SpiralLoader from "../../components/SpiralLoader";

import EditRoomSelector from "./components/EditRoomSelector";
import SystemAlert from "@/core/components/SystemAlert";

const BASE_URL = "/cok/api/v1";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";

const fontHeading = "'Montserrat', sans-serif";

const inputStyle = {
  fontFamily: fontHeading,
  fontSize: '14px',
  fontWeight: 500,
  letterSpacing: '0.2px',
  lineHeight: '1.4',
  width: '100%',
  padding: '12px 1rem',
  color: NEUTRAL_DARK,
  backgroundColor: NEUTRAL_LIGHT,
  boxSizing: 'border-box',
  border: '0',
  borderRadius: 0,
  boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  outline: 'none',
  borderStyle: 'solid',
  borderWidth: '1px',
  borderColor: 'transparent',
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
};

const labelStyle = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  lineHeight: '1.4',
  display: 'block',
  color: '#CDB896',
  textTransform: 'uppercase',
  marginBottom: '8px',
};

const getBtnStyle = (variant = 'primary', disabled = false) => {
  const base = {
    fontFamily: fontHeading,
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '1px',
    lineHeight: '1.4',
    textTransform: 'uppercase',
    textAlign: 'center',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxSizing: 'border-box',
    border: '0',
    borderRadius: 0,
    transition: 'background-color 0.2s ease, color 0.2s ease, transform 0.1s ease, opacity 0.2s ease',
    padding: '0.9rem',
    opacity: disabled ? 0.6 : 1,
  };

  if (variant === 'primary') {
    return { ...base, backgroundColor: PRIMARY, color: WHITE };
  }
  if (variant === 'outline') {
    return { ...base, color: PRIMARY, border: `1px solid ${PRIMARY}`, backgroundColor: 'transparent' };
  }
  if (variant === 'danger') {
    return { ...base, backgroundColor: DANGER, color: WHITE };
  }
  return base;
};

const STATUS_DETAILS = {
  Pending: { bg: "bg-yellow-100", text: "text-yellow-800", icon: FiClock, label: "Pending" },
  Accepted: { bg: "bg-green-100", text: "text-green-800", icon: FiCheckCircle, label: "Accepted" },
  Rejected: { bg: "bg-red-100", text: "text-red-800", icon: FiXCircle, label: "Rejected" },
  Cancelled: { bg: "bg-gray-100", text: "text-gray-800", icon: FiSlash, label: "Cancelled" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_DETAILS[status] || STATUS_DETAILS.Pending;
  const Icon = cfg.icon;
  return <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium ${cfg.bg} ${cfg.text}`}><Icon className="w-4 h-4" />{cfg.label}</span>;
}

function DetailRow({ label, value }) {
  return <div className="py-2 border-b" style={{ borderColor: BORDER }}><p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#CDB896', fontFamily: fontHeading }}>{label}</p><p className="text-sm mt-0.5" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{value || "—"}</p></div>;
}

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
  const [editError, setEditError] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, variant: "primary", title: "", message: "", onConfirm: null });
  const [systemAlert, setSystemAlert] = useState({ isOpen: false, type: "error", message: "" });

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
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || "Something got wrong try again later."
      if (status === 500 || status === 505) {
        setSystemAlert({ isOpen: true, type: "systemError", message });
      } else if(status === 400 || status === 404) {
        setSystemAlert({ isOpen: true, type: "warning", message });
      }
      
      else {
        setSystemAlert({ isOpen: true, type: "error", message });
      }
    } finally {
      setDeleteTarget(null);
    }
  };

  const fetchInvitedPeople = async (eventSpecialId) => {
    setInvitedLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/events/${eventSpecialId}/invited`, {
        params: { limit: 100 },
      });
      if (res.data?.success) {
        setInvitedPeople(res.data.data || []);
        setInvitedCount(res.data.totalRecords || 0);
      }
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || "Something got wrong try again later."
      if (status === 500 || status === 505) {
        setSystemAlert({ isOpen: true, type: "systemError", message });
      } else if(status === 400 || status === 404) {
        setSystemAlert({ isOpen: true, type: "warning", message });
      }
      
      else {
        setSystemAlert({ isOpen: true, type: "error", message });
      }
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

  useEffect(() => { if (initialCode) handleSearchWithCode(initialCode); }, []);

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
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || "Something got wrong try again later."
      if (status === 500 || status === 505) {
        setSystemAlert({ isOpen: true, type: "systemError", message });
      } else if(status === 400 || status === 404) {
        setSystemAlert({ isOpen: true, type: "warning", message });
      }
      
      else {
        setSystemAlert({ isOpen: true, type: "error", message });
      }
      setRequest(null);
    }
    finally { setLoading(false); }
  };

  const handleSearch = async (e) => { e.preventDefault(); if (trackingCode.trim()) handleSearchWithCode(trackingCode.trim()); };
  const handleCancel = async () => {
    setLoading(true);
    try { await axios.put(`${BASE_URL}/booking-requests/${request._id}/cancel`); setRequest((prev) => ({ ...prev, status: "Cancelled" })); setIsEditing(false); }
    catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || "Something got wrong try again later."
      if (status === 500 || status === 505) {
        setSystemAlert({ isOpen: true, type: "systemError", message });
      } else if(status === 400 || status === 404) {
        setSystemAlert({ isOpen: true, type: "warning", message });
      }
      
      else {
        setSystemAlert({ isOpen: true, type: "error", message });
      }
      }
    finally { setLoading(false); }
  };

  const showAgenda = editForm.eventMeetingType === "meet";
  const maxSteps = showAgenda ? 5 : 4;

  function validateEditStep() {
    const errs = {};
    if (editStep === 1) {
      if (!editForm.eventName?.trim()) errs.eventName = "Name required";
      if (!editForm.eventType) errs.eventType = "Type required";
      if (!editForm.audience || Number(editForm.audience) < 1) errs.audience = "Audience required";
      if (!editForm.eventDescription?.trim()) errs.eventDescription = "Description required";
    } else if (editStep === 2) {
      if (!editForm.organizerNames?.trim()) errs.organizerNames = "Name required";
      if (!editForm.organizerEmail?.trim()) errs.organizerEmail = "Email required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.organizerEmail.trim())) errs.organizerEmail = "Invalid email";
      if (!editForm.organizerPhone?.trim()) errs.organizerPhone = "Phone required";
    } else if (editStep === 3) {
      if (!editForm.startTime) errs.startTime = "Start required";
      if (!editForm.endTime) errs.endTime = "End required";
      else if (new Date(editForm.endTime) <= new Date(editForm.startTime)) errs.endTime = "End after start";
    } else if (editStep === 4) {
      if (!editForm.eventRoom?.trim()) errs.eventRoom = "Room required";
    }
    return errs;
  }

  function handleEditNext() {
    const errs = validateEditStep();
    if (Object.keys(errs).length > 0) { setEditError(Object.values(errs).join(", ")); return; }
    setEditError(null);
    setCompletedSteps((prev) => (prev.includes(editStep) ? prev : [...prev, editStep]));
    setEditStep((s) => Math.min(maxSteps, s + 1));
  }
  function handleEditBack() { setEditError(null); setEditStep((s) => Math.max(1, s - 1)); }
  function handleStepClick(targetStep) { if (completedSteps.includes(targetStep) || targetStep < editStep) { setEditError(null); setEditStep(targetStep); } }

  async function handleSaveEdit() {
    setLoading(true); setEditError(null);
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
        setRequest((prev) => ({ ...prev, ...payload, eventOrganizer: payload.eventOrganizer, startTime: payload.startTime ? new Date(payload.startTime) : prev.startTime, endTime: payload.endTime ? new Date(payload.endTime) : prev.endTime }));
        setIsEditing(false); setEditStep(1); setCompletedSteps([]);
      }
    } catch (err) { 
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || "Something got wrong try again later."
      if (status === 500 || status === 505) {
        setSystemAlert({ isOpen: true, type: "systemError", message });
      } else if(status === 400 || status === 404) {
        setSystemAlert({ isOpen: true, type: "warning", message });
      }
      
      else {
        setSystemAlert({ isOpen: true, type: "error", message });
      }
    }
    finally { setLoading(false); }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
    
      <Helmet><title>TRACK YOUR BOOK REQUEST</title></Helmet>
      <div className="w-full max-w-lg mx-auto mt-8">
        <div className="mt-4 overflow-hidden" style={{ backgroundColor: NEUTRAL_LIGHT, boxShadow: '0 5084rem 1.1419rem 2.5rem 0 rgb(0 0 0 / 8%)', border: '0', padding: '40px' }}>
          <h2 className="text-sm font-black uppercase tracking-widest mb-1" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Track Your Booking</h2>
          <p className="text-xs font-medium mb-4" style={{ color: '#9E9E9E', fontFamily: fontHeading }}>Enter your Booking ID (e.g., BRK-A1B2C3D4).</p>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input type="text" value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder="Enter your booking id"
              className="flex-1 min-w-0 px-3 py-2 text-sm focus:outline-none transition-all duration-200"
              style={{ ...inputStyle, borderColor: BORDER }}
              onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} />
            <button type="submit" disabled={loading || !trackingCode.trim()} style={getBtnStyle('primary', loading || !trackingCode.trim())} className="w-full sm:w-auto">
              {loading ? "Searching..." : "Track"}
            </button>
          </form>
          <button type="button" onClick={() => navigate("/book-a-room/options")} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all" style={{ border: `1px solid ${PRIMARY}`, color: PRIMARY, backgroundColor: WHITE, fontFamily: fontHeading }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; e.currentTarget.style.color = WHITE; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = WHITE; e.currentTarget.style.color = PRIMARY; }}>
            <FiArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        {error && <div className="mt-4 p-3 flex items-start gap-2" style={{ backgroundColor: '#FFEBEE', border: `1px solid ${DANGER}` }}><FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: DANGER }} /><p className="text-sm" style={{ color: '#C62828', fontFamily: fontHeading }}>{error}</p></div>}
        <SystemAlert isOpen={systemAlert.isOpen} type={systemAlert.type} message={systemAlert.message} onClose={() => setSystemAlert((s) => ({ ...s, isOpen: false }))} />

        {request && !isEditing && (
          <div className="mt-4 overflow-hidden" style={{ backgroundColor: NEUTRAL_LIGHT, boxShadow: '0 5084rem 1.1419rem 2.5rem 0 rgb(0 0 0 / 8%)', border: '0' }}>
            <div className="p-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div><h3 className="text-base font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{request.eventName}</h3><span className="text-xs font-mono font-medium px-2 py-0.5 inline-block mt-1" style={{ color: PRIMARY, backgroundColor: '#E3F2FD' }}>{request.trackingCode}</span></div>
                <StatusBadge status={request.status} />
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <div><DetailRow label="Type" value={request.eventMeetingType} /><DetailRow label="Event Type" value={request.eventType} /><DetailRow label="Room" value={request.eventRoom} /><DetailRow label="Start" value={formatDate(request.startTime)} /><DetailRow label="End" value={formatDate(request.endTime)} /></div>
                <div><DetailRow label="Organizer" value={request.eventOrganizer?.fullNames} /><DetailRow label="Email" value={request.eventOrganizer?.email} /><DetailRow label="Phone" value={request.eventOrganizer?.phone} /><DetailRow label="Institution" value={request.eventOrganizer?.institution || "—"} /><DetailRow label="Audience" value={request.expectedAudience ? `${request.expectedAudience} people` : "—"} /></div>
              </div>
              {request.eventDescription && <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}><DetailRow label="Description" value={request.eventDescription} /></div>}
              {request.status === "Rejected" && request.rejectionReason && <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}><div className="p-3" style={{ backgroundColor: '#FFEBEE', border: `1px solid ${DANGER}` }}><p className="text-xs font-medium uppercase" style={{ color: '#C62828', fontFamily: fontHeading }}>Reason</p><p className="text-sm mt-1" style={{ color: '#C62828', fontFamily: fontHeading }}>{request.rejectionReason}</p></div></div>}
              {request.status === "Accepted" && request.acceptedEventSpecialId && (
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <div className="p-3" style={{ backgroundColor: '#E8F5E9', border: `1px solid ${SUCCESS}` }}>
                    <p className="text-sm font-medium" style={{ color: '#2E7D32', fontFamily: fontHeading }}><FiCheckCircle className="w-4 h-4 inline" />Your Request Has Been Accepted</p>
                  </div>

                  <button
                    type="button"
                    onClick={toggleInvited}
                    className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors"
                    style={{ border: `1px solid ${PRIMARY}`, color: PRIMARY, backgroundColor: WHITE, fontFamily: fontHeading }}
                  >
                    <FiUsers className="w-4 h-4" />
                    {showInvited ? "Hide Invited People" : `View Invited People${invitedCount ? ` (${invitedCount})` : ""}`}
                  </button>

                  {showInvited && (
                    <div className="mt-3 border" style={{ borderColor: BORDER }}>
                      {invitedLoading ? (
                        <div className="flex items-center justify-center py-6 text-sm" style={{ color: '#9E9E9E', fontFamily: fontHeading }}>
                          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin mr-2" /> Loading…
                        </div>
                      ) : invitedPeople.length === 0 ? (
                        <p className="p-4 text-sm text-center" style={{ color: '#9E9E9E', fontFamily: fontHeading }}>No one has been invited yet.</p>
                      ) : (
                        <ul className="divide-y max-h-60 overflow-y-auto" style={{ borderColor: `${BORDER}1A` }}>
                          {invitedPeople.map((person) => (
                            <li key={person._id} className="flex items-center justify-between px-3 py-2 text-sm">
                              <span className={`truncate ${person.cancelled ? "line-through" : ""}`} style={{ color: person.cancelled ? '#9E9E9E' : NEUTRAL_DARK, fontFamily: fontHeading }}>
                                {person.email}
                              </span>
                              <span className="flex items-center gap-2 ml-2 shrink-0">
                                <span className="text-[10px]" style={{ color: '#9E9E9E' }}>
                                  {person.invitedAt ? new Date(person.invitedAt).toLocaleDateString() : ""}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(person)}
                                  title="Remove invite"
                                  className="transition-colors"
                                  style={{ color: '#9E9E9E' }}
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
                    onClick={() => navigate(`/event/${request.acceptedEventSpecialId}/invite`)}
                    className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all"
                    style={getBtnStyle('primary')}
                  >
                    <FiMail className="w-4 h-4" /> Invite People
                  </button>
                </div>
              )}
              {request.status === "Pending" && (
                <div className="mt-4 pt-3 flex justify-end gap-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <button onClick={() => { setEditStep(1); setCompletedSteps([]); setIsEditing(true); }} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors" style={{ border: `1px solid ${PRIMARY}`, color: PRIMARY, fontFamily: fontHeading }}><FiEdit2 className="w-4 h-4" /> Edit</button>
                  <button onClick={() => setConfirmModal({ isOpen: true, variant: "danger", title: "Cancel Request", message: "This cannot be undone.", confirmText: "Yes, Cancel", onConfirm: handleCancel })}
                    disabled={loading} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors" style={{ border: `1px solid ${DANGER}`, color: DANGER, fontFamily: fontHeading }}><FiTrash2 className="w-4 h-4" /> Cancel</button>
                </div>
              )}
            </div>
          </div>
        )}

        {request && isEditing && (
          <div style={{ backgroundColor: NEUTRAL_LIGHT, boxShadow: '0 8px 40px 0 rgba(0,0,0,0.08)', border: '0', overflow: 'hidden', maxWidth: '800px', width: '100%', margin: '24px auto 0' }}>
            <CreateEventStepper currentStep={editStep} eventMeetingType={editForm.eventMeetingType} onStepClick={handleStepClick} completedSteps={completedSteps} />
            <div style={{ padding: '24px' }}>
              {editError && (<div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', backgroundColor: '#FFEBEE', border: `1px solid ${DANGER}`, padding: '12px', marginBottom: '20px' }}>
                <FiAlertCircle style={{ width: 16, height: 16, color: DANGER, marginTop: '2px', flexShrink: 0 }} />
                <p style={{ fontFamily: fontHeading, fontSize: '13px', color: '#C62828', margin: 0 }}>{editError}</p>
              </div>)}
              {editStep === 1 && (<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div><label style={labelStyle}>Name <span style={{ color: DANGER }}>*</span></label>
                  <input style={{ ...inputStyle, borderColor: BORDER }} value={editForm.eventName} onChange={(e) => setEditForm((p) => ({ ...p, eventName: e.target.value }))}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} /></div>
                <div><label style={labelStyle}>Type <span style={{ color: DANGER }}>*</span></label>
                  <select style={{ ...inputStyle, borderColor: BORDER }} value={editForm.eventType} onChange={(e) => setEditForm((p) => ({ ...p, eventType: e.target.value }))}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}>
                    <option value="">Select type</option><option value="Internal">Internal</option><option value="Joint">Joint</option><option value="External">External</option>
                  </select></div>
                <div><label style={labelStyle}>Audience <span style={{ color: DANGER }}>*</span></label>
                  <input style={{ ...inputStyle, borderColor: BORDER }} type="number" value={editForm.audience} onChange={(e) => setEditForm((p) => ({ ...p, audience: e.target.value }))} min={1}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} /></div>
                <div><label style={labelStyle}>Description <span style={{ color: DANGER }}>*</span></label>
                  <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '80px', borderColor: BORDER }} value={editForm.eventDescription} onChange={(e) => setEditForm((p) => ({ ...p, eventDescription: e.target.value }))} rows={3}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} /></div>
              </div>)}
              {editStep === 2 && (<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  <div><label style={labelStyle}>Name <span style={{ color: DANGER }}>*</span></label>
                    <input style={{ ...inputStyle, borderColor: BORDER }} value={editForm.organizerNames} onChange={(e) => setEditForm((p) => ({ ...p, organizerNames: e.target.value }))}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} /></div>
                  <div><label style={labelStyle}>Institution</label>
                    <input style={{ ...inputStyle, borderColor: BORDER }} value={editForm.organizerInstitution} onChange={(e) => setEditForm((p) => ({ ...p, organizerInstitution: e.target.value }))}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  <div><label style={labelStyle}>Email <span style={{ color: DANGER }}>*</span></label>
                    <input style={{ ...inputStyle, borderColor: BORDER }} type="email" value={editForm.organizerEmail} onChange={(e) => setEditForm((p) => ({ ...p, organizerEmail: e.target.value }))}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} /></div>
                  <div><label style={labelStyle}>Phone <span style={{ color: DANGER }}>*</span></label>
                    <input style={{ ...inputStyle, borderColor: BORDER }} type="tel" value={editForm.organizerPhone} onChange={(e) => setEditForm((p) => ({ ...p, organizerPhone: e.target.value }))}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} /></div>
                </div>
              </div>)}
              {editStep === 3 && (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div><label style={labelStyle}>Start <span style={{ color: DANGER }}>*</span></label>
                  <input style={{ ...inputStyle, borderColor: BORDER }} type="datetime-local" value={editForm.startTime} onChange={(e) => setEditForm((p) => ({ ...p, startTime: e.target.value }))}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} /></div>
                <div><label style={labelStyle}>End <span style={{ color: DANGER }}>*</span></label>
                  <input style={{ ...inputStyle, borderColor: BORDER }} type="datetime-local" value={editForm.endTime} onChange={(e) => setEditForm((p) => ({ ...p, endTime: e.target.value }))}
                    onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }} /></div>
              </div>)}
              {editStep === 4 && (<EditRoomSelector editForm={editForm} setEditForm={setEditForm} requestId={request._id} />)}
              {editStep === 5 && (<ActivityAgenda agenda={editForm.agenda} setAgenda={(agenda) => setEditForm((p) => ({ ...p, agenda }))} />)}
              <div className="flex gap-3 mt-4 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                {editStep > 1 && <button type="button" onClick={handleEditBack} style={getBtnStyle('outline')}>Back</button>}
                {editStep < maxSteps && <button type="button" onClick={handleEditNext} style={{ ...getBtnStyle('primary'), flex: 1 }}>Next</button>}
                {editStep === maxSteps && <button type="button" onClick={handleSaveEdit} disabled={loading} style={getBtnStyle('primary', loading)}>
                  {loading ? (<><div style={{ width: 16, height: 16, border: `2px solid ${WHITE}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '8px' }} />Saving...</>) : (<><FiSave style={{ width: 16, height: 16 }} /> Save Changes</>)}
                </button>}
              </div>
            </div>
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
