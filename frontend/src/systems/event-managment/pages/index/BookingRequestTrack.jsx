import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FiClock, FiCheckCircle, FiXCircle, FiSlash,
  FiArrowLeft, FiAlertCircle, FiEdit2, FiTrash2, FiSave,
  FiMapPin, FiCheck,
} from "react-icons/fi";
import ConfirmModal from "../../ui-components/ConfirmModal";
import CreateEventStepper from "../../components/CreateEventStepper";
import ActivityAgenda from "../../components/sub-components/ActivityAgenda";
import SpiralLoader from "../../components/SpiralLoader";

const BASE_URL = "/cok/api/v1";

const inputClass = "w-full px-4 py-3 border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 bg-white";
const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

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
  return <div className="py-2 border-b border-gray-100 last:border-b-0"><p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p><p className="text-sm text-gray-900 mt-0.5">{value || "—"}</p></div>;
}

function EditRoomSelector({ editForm, setEditForm }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRooms = async () => {
      if (!editForm.startTime || !editForm.endTime) return;
      setLoading(true);
      try {
        const res = await axios.get(`${BASE_URL}/rooms/available`, {
          params: { startTime: new Date(editForm.startTime).toISOString(), endTime: new Date(editForm.endTime).toISOString(), eventMode: "upcoming" }
        });
        const data = res.data?.data || res.data;
        setRooms(data.availableRooms || []);
      } catch (err) { setError(err.response?.data?.message || "Failed to check"); }
      finally { setLoading(false); }
    };
    fetchRooms();
  }, [editForm.startTime, editForm.endTime]);

  const isSelected = (name) => editForm.eventRoom?.toLowerCase() === name.toLowerCase();

  if (loading) return <div className="flex items-center justify-center py-6"><SpiralLoader /><span className="ml-2 text-sm text-gray-500">Checking rooms...</span></div>;
  if (error) return <div className="bg-yellow-50 border border-yellow-200 p-3"><p className="text-xs text-yellow-700">{error}</p></div>;
  if (rooms.length === 0) return <div className="bg-orange-50 border border-orange-200 p-6 text-center"><FiAlertCircle className="w-10 h-10 text-orange-400 mx-auto mb-3" /><p className="text-sm font-bold text-orange-800">All Rooms Occupied</p><p className="text-xs text-orange-500 mt-2">Change your schedule.</p></div>;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-green-700 mb-2">Available Rooms ({rooms.length})</p>
      {rooms.map((item, idx) => {
        const selected = isSelected(item.room.roomName);
        return (
          <button key={idx} type="button" onClick={() => setEditForm((p) => ({ ...p, eventRoom: item.room.roomName }))}
            className={`w-full text-left p-3 border-2 transition-all ${selected ? "border-green-500 bg-green-50 ring-2 ring-green-200" : "border-green-200 bg-white hover:border-green-400"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <FiCheck className={`w-4 h-4 mt-0.5 shrink-0 ${selected ? "text-green-600" : "text-green-400"}`} />
                <div>
                  <p className="text-sm font-semibold text-gray-900 capitalize">{item.room.roomName}</p>
                  <div className="flex gap-3 mt-0.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3" />{item.room.roomLocation}</span>
                    <span>Capacity: {item.room.roomCapacity}</span>
                  </div>
                </div>
              </div>
              {selected && <span className="text-xs font-bold text-green-700 bg-green-100 border border-green-300 px-2.5 py-0.5">Selected</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
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
    } catch (err) { setError(err.response?.data?.message || "Not found"); setRequest(null); }
    finally { setLoading(false); }
  };

  const handleSearch = async (e) => { e.preventDefault(); if (trackingCode.trim()) handleSearchWithCode(trackingCode.trim()); };
  const handleCancel = async () => {
    setLoading(true);
    try { await axios.put(`${BASE_URL}/booking-requests/${request._id}/cancel`); setRequest((prev) => ({ ...prev, status: "Cancelled" })); setIsEditing(false); }
    catch (err) { setError(err.response?.data?.message || "Failed"); }
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
    } catch (err) { setEditError(err.response?.data?.message || "Failed to update"); }
    finally { setLoading(false); }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <Helmet><title>Track Booking | KCE Portal</title></Helmet>
      <div className="w-full max-w-lg mx-auto mt-8">
        <button onClick={() => navigate("/book-a-room/options")} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"><FiArrowLeft className="w-4 h-4" /> Back</button>

        <div className="bg-white border-2 border-zinc-200 p-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-800 mb-1">Track Your Booking</h2>
          <p className="text-xs text-zinc-400 font-medium mb-4">Enter your Booking ID (e.g., BRK-A1B2C3D4).</p>
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input type="text" value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder="Enter your booking id"
              className="flex-1 min-w-0 px-3 py-2 border-2 border-zinc-200 bg-zinc-50 text-sm focus:outline-none focus:border-blue-400" />
            <button type="submit" disabled={loading || !trackingCode.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold">{loading ? "Searching..." : "Track"}</button>
          </form>
        </div>

        {error && <div className="mt-4 bg-red-50 border border-red-200 p-3 flex items-start gap-2"><FiAlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /><p className="text-sm text-red-600">{error}</p></div>}

        {request && !isEditing && (
          <div className="mt-4 bg-white border-2 border-zinc-200 overflow-hidden">
            <div className="p-4 border-b border-zinc-200">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div><h3 className="text-base font-bold text-gray-900">{request.eventName}</h3><span className="text-xs font-mono font-medium text-blue-600 bg-blue-50 px-2 py-0.5 inline-block mt-1">{request.trackingCode}</span></div>
                <StatusBadge status={request.status} />
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <div><DetailRow label="Type" value={request.eventMeetingType} /><DetailRow label="Event Type" value={request.eventType} /><DetailRow label="Room" value={request.eventRoom} /><DetailRow label="Start" value={formatDate(request.startTime)} /><DetailRow label="End" value={formatDate(request.endTime)} /></div>
                <div><DetailRow label="Organizer" value={request.eventOrganizer?.fullNames} /><DetailRow label="Email" value={request.eventOrganizer?.email} /><DetailRow label="Phone" value={request.eventOrganizer?.phone} /><DetailRow label="Institution" value={request.eventOrganizer?.institution || "—"} /><DetailRow label="Audience" value={request.expectedAudience ? `${request.expectedAudience} people` : "—"} /></div>
              </div>
              {request.eventDescription && <div className="mt-3 pt-3 border-t border-zinc-200"><DetailRow label="Description" value={request.eventDescription} /></div>}
              {request.status === "Rejected" && request.rejectionReason && <div className="mt-3 pt-3 border-t"><div className="bg-red-50 border border-red-200 p-3"><p className="text-xs font-medium text-red-700 uppercase">Reason</p><p className="text-sm text-red-600 mt-1">{request.rejectionReason}</p></div></div>}
              {request.status === "Accepted" && request.acceptedEventSpecialId && <div className="mt-3 pt-3 border-t"><div className="bg-green-50 border border-green-200 p-3"><p className="text-sm font-medium text-green-700"><FiCheckCircle className="w-4 h-4 inline" />Your Request Has Been Accepted</p></div></div>}
              {request.status === "Pending" && (
                <div className="mt-4 pt-3 border-t border-zinc-200 flex justify-end gap-2">
                  <button onClick={() => { setEditStep(1); setCompletedSteps([]); setIsEditing(true); }} className="inline-flex items-center gap-1.5 px-4 py-2 border border-blue-300 text-sm font-medium text-blue-700 hover:bg-blue-50"><FiEdit2 className="w-4 h-4" /> Edit</button>
                  <button onClick={() => setConfirmModal({ isOpen: true, variant: "danger", title: "Cancel Request", message: "This cannot be undone.", confirmText: "Yes, Cancel", onConfirm: handleCancel })}
                    disabled={loading} className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-300 text-sm font-medium text-red-700 hover:bg-red-50"><FiTrash2 className="w-4 h-4" /> Cancel</button>
                </div>
              )}
            </div>
          </div>
        )}

        {request && isEditing && (
          <div className="mt-4 bg-white border-2 border-zinc-200 overflow-hidden">
            <CreateEventStepper currentStep={editStep} eventMeetingType={editForm.eventMeetingType} onStepClick={handleStepClick} completedSteps={completedSteps} />
            <div className="p-4">
              {editError && <div className="bg-red-50 border border-red-200 p-3 flex items-start gap-2 mb-4"><FiAlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /><p className="text-sm text-red-600">{editError}</p></div>}
              {editStep === 1 && (
                <div className="space-y-4">
                  <div><label className={labelClass}>Name <span className="text-red-500">*</span></label><input className={inputClass} value={editForm.eventName} onChange={(e) => setEditForm((p) => ({ ...p, eventName: e.target.value }))} /></div>
                  <div><label className={labelClass}>Type <span className="text-red-500">*</span></label><select className={inputClass} value={editForm.eventType} onChange={(e) => setEditForm((p) => ({ ...p, eventType: e.target.value }))}><option value="Internal">Internal</option><option value="Joint">Joint</option><option value="External">External</option></select></div>
                  <div><label className={labelClass}>Audience <span className="text-red-500">*</span></label><input className={inputClass} type="number" value={editForm.audience} onChange={(e) => setEditForm((p) => ({ ...p, audience: e.target.value }))} min={1} /></div>
                  <div><label className={labelClass}>Description <span className="text-red-500">*</span></label><textarea className={`${inputClass} resize-y min-h-[80px]`} value={editForm.eventDescription} onChange={(e) => setEditForm((p) => ({ ...p, eventDescription: e.target.value }))} rows={3} /></div>
                </div>
              )}
              {editStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Name <span className="text-red-500">*</span></label><input className={inputClass} value={editForm.organizerNames} onChange={(e) => setEditForm((p) => ({ ...p, organizerNames: e.target.value }))} /></div>
                    <div><label className={labelClass}>Institution</label><input className={inputClass} value={editForm.organizerInstitution} onChange={(e) => setEditForm((p) => ({ ...p, organizerInstitution: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Email <span className="text-red-500">*</span></label><input className={inputClass} type="email" value={editForm.organizerEmail} onChange={(e) => setEditForm((p) => ({ ...p, organizerEmail: e.target.value }))} /></div>
                    <div><label className={labelClass}>Phone <span className="text-red-500">*</span></label><input className={inputClass} type="tel" value={editForm.organizerPhone} onChange={(e) => setEditForm((p) => ({ ...p, organizerPhone: e.target.value }))} /></div>
                  </div>
                </div>
              )}
              {editStep === 3 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className={labelClass}>Start <span className="text-red-500">*</span></label><input className={inputClass} type="datetime-local" value={editForm.startTime} onChange={(e) => setEditForm((p) => ({ ...p, startTime: e.target.value }))} /></div>
                  <div><label className={labelClass}>End <span className="text-red-500">*</span></label><input className={inputClass} type="datetime-local" value={editForm.endTime} onChange={(e) => setEditForm((p) => ({ ...p, endTime: e.target.value }))} /></div>
                </div>
              )}
              {editStep === 4 && <EditRoomSelector editForm={editForm} setEditForm={setEditForm} />}
              {editStep === 5 && showAgenda && <ActivityAgenda agenda={editForm.agenda} onChange={(agenda) => setEditForm((p) => ({ ...p, agenda }))} eventStartTime={editForm.startTime ? editForm.startTime.split("T")[1]?.substring(0, 5) : null} eventEndTime={editForm.endTime ? editForm.endTime.split("T")[1]?.substring(0, 5) : null} />}
              {editStep === 5 && !showAgenda && <div className="bg-blue-50 border border-blue-200 p-4 text-center"><p className="text-sm text-blue-700 font-medium">No agenda required</p></div>}
              <div className="flex gap-3 mt-4 pt-4 border-t border-zinc-200">
                {editStep > 1 && <button type="button" onClick={handleEditBack} className="flex-1 py-2.5 border border-zinc-300 text-sm font-medium text-gray-600 hover:bg-gray-50">Back</button>}
                {editStep < maxSteps ? <button type="button" onClick={handleEditNext} className={`py-2.5 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 ${editStep === 1 ? "w-full" : "flex-1"}`}>Next</button>
                  : <button type="button" onClick={handleSaveEdit} disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">{loading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : <><FiSave className="w-4 h-4" /> Save Changes</>}</button>}
              </div>
            </div>
          </div>
        )}

        <ConfirmModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false })} onConfirm={async () => { await confirmModal.onConfirm(); setConfirmModal({ isOpen: false }); }} title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText || "Confirm"} confirmVariant={confirmModal.variant} loading={loading} />
        {searched && !request && !loading && !error && <div className="mt-4 bg-gray-50 border border-zinc-200 p-6 text-center"><FiAlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-500">No request found.</p></div>}
      </div>
    </>
  );
}