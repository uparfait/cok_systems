import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiSlash,
  FiCalendar,
  FiMapPin,
  FiUser,
  FiMail,
  FiPhone,
  FiHome,
  FiAlertCircle,
  FiEdit2,
  FiSave,
  FiCheck,
} from "react-icons/fi";
import ConfirmModal from "../ui-components/ConfirmModal";
import CreateEventStepper from "./CreateEventStepper";
import ActivityAgenda from "./sub-components/ActivityAgenda";
import SpiralLoader from "./SpiralLoader";

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
  const config = STATUS_DETAILS[status] || STATUS_DETAILS.Pending;
  const Icon = config.icon;
  return <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium ${config.bg} ${config.text}`}><Icon className="w-4 h-4" />{config.label}</span>;
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-b-0">
      <div className="w-8 h-8 bg-gray-100 flex items-center justify-center shrink-0">{Icon && <Icon className="w-4 h-4 text-gray-500" />}</div>
      <div className="min-w-0 flex-1"><p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p><p className="text-sm text-gray-900 mt-0.5 break-words">{value || "—"}</p></div>
    </div>
  );
}

function AgendaSection({ agenda }) {
  if (!agenda || agenda.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Activity Agenda</h3>
      <div className="space-y-2">
        {agenda.map((item, idx) => (
          <div key={idx} className="bg-gray-50 border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-500">Phase {idx + 1}</span>
              {(item.fromTime || item.toTime) && <span className="text-xs text-gray-400">{item.fromTime} - {item.toTime}</span>}
            </div>
            {item.title && <p className="text-sm font-medium text-gray-800">{item.title}</p>}
            {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function EditRoomSelector({ editForm, setEditForm, requestId }) {
  const [availableRooms, setAvailableRooms] = useState([]);
  const [unavailableRooms, setUnavailableRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const hasDates = editForm.startTime && editForm.endTime;

  useEffect(() => {
    if (!hasDates) return;
    const checkRooms = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = {
          startTime: new Date(editForm.startTime).toISOString(),
          endTime: new Date(editForm.endTime).toISOString(),
          eventMode: 'upcoming',
          ...(requestId ? { requestId } : {}),
        };
        const res = await axios.get(`${BASE_URL}/rooms/available`, { params });
        const data = res.data?.data || res.data;
        setAvailableRooms(data.availableRooms || []);
        setUnavailableRooms(data.unavailableRooms || []);
        setSearched(true);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to check availability');
      } finally {
        setLoading(false);
      }
    };
    checkRooms();
  }, [editForm.startTime, editForm.endTime, hasDates, requestId]);

  const isSelected = (roomName) => editForm.eventRoom?.toLowerCase() === roomName.toLowerCase();

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Room Selection</h2>
      <p className="text-xs text-gray-500">Rooms are checked for availability based on your selected schedule.</p>
      {loading && <div className="flex items-center justify-center py-6"><div className="w-6 h-6"><SpiralLoader /></div><span className="ml-2 text-sm text-gray-500">Checking rooms...</span></div>}
      {error && <div className="bg-yellow-50 border border-yellow-200 p-3 flex items-start gap-2"><FiAlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" /><p className="text-xs text-yellow-700">{error}</p></div>}
      {!hasDates && !loading && <div className="bg-gray-50 border border-gray-200 p-4 text-center"><FiCalendar className="w-6 h-6 text-gray-300 mx-auto mb-2" /><p className="text-xs text-gray-500">Set your schedule first, then rooms will be checked automatically.</p></div>}
      {hasDates && !loading && searched && (
        <div className="space-y-3">
          {editForm.eventRoom && availableRooms.length > 0 && !availableRooms.find((r) => r.room.roomName.toLowerCase() === editForm.eventRoom.toLowerCase()) && (
            <div className="bg-yellow-50 border border-yellow-200 p-3"><p className="text-xs text-yellow-700 font-medium">Previously selected room "{editForm.eventRoom}" is no longer available.</p></div>
          )}
          {availableRooms.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-2">Available Rooms ({availableRooms.length} of {availableRooms.length + unavailableRooms.length})</p>
              <div className="space-y-2">
                {availableRooms.map((item, idx) => {
                  const selected = isSelected(item.room.roomName);
                  return (
                    <button key={idx} type="button" onClick={() => setEditForm((p) => ({ ...p, eventRoom: item.room.roomName }))}
                      className={`w-full text-left p-3 border-2 transition-all duration-200 ${selected ? "border-green-500 bg-green-50 ring-2 ring-green-200" : "border-green-200 bg-white hover:border-green-400 hover:bg-green-50/50"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <FiCheck className={`w-4 h-4 mt-0.5 shrink-0 ${selected ? "text-green-600" : "text-green-400"}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 capitalize truncate">{item.room.roomName}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3 shrink-0" />{item.room.roomLocation}</span>
                              <span>Capacity: {item.room.roomCapacity}</span>
                            </div>
                          </div>
                        </div>
                        {selected && <span className="text-xs font-bold text-green-700 bg-green-100 border border-green-300 px-2.5 py-0.5 shrink-0">Selected</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {availableRooms.length === 0 && (
            <div className="bg-orange-50 border border-orange-200 p-6 text-center">
              <FiAlertCircle className="w-10 h-10 text-orange-400 mx-auto mb-3" />
              <p className="text-sm font-bold text-orange-800 mb-1">All Rooms Are Occupied</p>
              <p className="text-xs text-orange-600 mb-3">No rooms available: {new Date(editForm.startTime).toLocaleString()} - {new Date(editForm.endTime).toLocaleString()}</p>
              <p className="text-xs text-orange-500">Please go back to Schedule step.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BookingRequestDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editStep, setEditStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, variant: "primary", title: "", message: "", onConfirm: null });

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${BASE_URL}/booking-requests/${id}`);
        if (res.data.success) {
          const r = res.data.data;
          setRequest(r);
          setEditForm({
            eventMeetingType: r.eventMeetingType || "event",
            eventName: r.eventName, eventDescription: r.eventDescription, eventType: r.eventType, eventRoom: r.eventRoom,
            organizerNames: r.eventOrganizer?.fullNames || "", organizerEmail: r.eventOrganizer?.email || "", organizerPhone: r.eventOrganizer?.phone || "", organizerInstitution: r.eventOrganizer?.institution || "",
            startTime: r.startTime ? new Date(r.startTime).toISOString().slice(0, 16) : "", endTime: r.endTime ? new Date(r.endTime).toISOString().slice(0, 16) : "",
            audience: r.expectedAudience || "",
            agenda: (r.activityAgenda && r.activityAgenda.length > 0) ? r.activityAgenda : [{ fromTime: "", toTime: "", title: "", description: "" }],
          });
        } else setError("Booking request not found");
      } catch (err) { setError(err.response?.data?.message || "Failed to load booking request details"); }
      finally { setLoading(false); }
    };
    fetchDetails();
  }, [id]);

  const handleAccept = async () => {
    setActionLoading(true); setError(null);
    try {
      const res = await axios.put(`${BASE_URL}/booking-requests/${id}/accept`);
      if (res.data.success) setRequest((prev) => ({ ...prev, status: "Accepted", acceptedEventSpecialId: res.data.data.event.eventSpecialId, acceptedEventType: "upcoming" }));
    } catch (err) { setError(err.response?.data?.message || "Failed to accept booking request"); }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading(true); setError(null);
    try {
      const res = await axios.put(`${BASE_URL}/booking-requests/${id}/reject`, { reason: rejectReason.trim() });
      if (res.data.success) { setRequest((prev) => ({ ...prev, status: "Rejected", rejectionReason: rejectReason.trim() })); setRejectModal(false); setRejectReason(""); }
    } catch (err) { setError(err.response?.data?.message || "Failed to reject"); }
    finally { setActionLoading(false); }
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
    setActionLoading(true); setEditError(null);
    try {
      const payload = {
        eventName: editForm.eventName, eventDescription: editForm.eventDescription, eventType: editForm.eventType, eventRoom: editForm.eventRoom,
        eventOrganizer: { fullNames: editForm.organizerNames, email: editForm.organizerEmail, phone: editForm.organizerPhone, institution: editForm.organizerInstitution || "" },
        startTime: editForm.startTime ? new Date(editForm.startTime).toISOString() : undefined,
        endTime: editForm.endTime ? new Date(editForm.endTime).toISOString() : undefined,
        expectedAudience: Number(editForm.audience),
        activityAgenda: showAgenda ? editForm.agenda.filter((a) => a.title?.trim()) : [],
      };
      const res = await axios.put(`${BASE_URL}/booking-requests/${id}`, payload);
      if (res.data.success) {
        setRequest((prev) => ({ ...prev, ...payload, eventOrganizer: payload.eventOrganizer, startTime: payload.startTime ? new Date(payload.startTime) : prev.startTime, endTime: payload.endTime ? new Date(payload.endTime) : prev.endTime }));
        setIsEditing(false); setEditStep(1); setCompletedSteps([]);
      }
    } catch (err) { setEditError(err.response?.data?.message || "Failed to update"); }
    finally { setActionLoading(false); }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) return <div className="p-6"><div className="max-w-3xl mx-auto"><div className="bg-white border border-gray-200 p-12 text-center"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-sm text-gray-500 mt-3">Loading...</p></div></div></div>;
  if (error && !request) return <div className="p-6"><div className="max-w-3xl mx-auto"><div className="bg-red-50 border border-red-200 p-6 text-center"><FiAlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" /><p className="text-sm text-red-600">{error}</p><button onClick={() => navigate("/event-manager/booking-requests/all")} className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"><FiArrowLeft className="w-4 h-4 inline" /> Back</button></div></div></div>;
  if (!request) return null;

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => navigate("/event-manager/booking-requests/all")} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"><FiArrowLeft className="w-4 h-4" /> Back to All Requests</button>
        {error && <div className="bg-red-50 border border-red-200 p-3 flex items-start gap-2"><FiAlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /><p className="text-sm text-red-600">{error}</p></div>}

        {!isEditing && (
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div><h1 className="text-xl font-bold text-gray-900">{request.eventName}</h1><div className="flex items-center gap-2 mt-1"><span className="text-xs font-mono font-medium text-blue-600 bg-blue-50 px-2 py-0.5">{request.trackingCode}</span><span className="text-xs text-gray-400 capitalize">({request.eventMeetingType})</span></div></div>
                <StatusBadge status={request.status} />
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div><DetailRow icon={FiCalendar} label="Event Type" value={request.eventType} /><DetailRow icon={FiMapPin} label="Room" value={request.eventRoom} /><DetailRow icon={FiCalendar} label="Start Time" value={formatDate(request.startTime)} /><DetailRow icon={FiCalendar} label="End Time" value={formatDate(request.endTime)} /><DetailRow icon={FiHome} label="Audience" value={request.expectedAudience ? `${request.expectedAudience} people` : "—"} /></div>
                <div><DetailRow icon={FiUser} label="Organizer" value={request.eventOrganizer?.fullNames} /><DetailRow icon={FiMail} label="Email" value={request.eventOrganizer?.email} /><DetailRow icon={FiPhone} label="Phone" value={request.eventOrganizer?.phone} /><DetailRow icon={FiHome} label="Institution" value={request.eventOrganizer?.institution || "—"} /></div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200"><DetailRow icon={FiCalendar} label="Description" value={request.eventDescription} /></div>
              {request.activityAgenda?.length > 0 && <div className="mt-4 pt-4 border-t border-gray-200"><AgendaSection agenda={request.activityAgenda} /></div>}
              {request.status === "Rejected" && request.rejectionReason && <div className="mt-4 pt-4 border-t border-gray-200"><div className="bg-red-50 border border-red-200 p-3"><p className="text-xs font-medium text-red-700 uppercase tracking-wider">Rejection Reason</p><p className="text-sm text-red-600 mt-1">{request.rejectionReason}</p></div></div>}
              {request.status === "Accepted" && request.acceptedEventSpecialId && <div className="mt-4 pt-4 border-t border-gray-200"><div className="bg-green-50 border border-green-200 p-3"><div className="flex items-center gap-2"><FiCheckCircle className="w-4 h-4 text-green-600" /><p className="text-sm font-medium text-green-700">Event Created</p></div><p className="text-xs text-green-600 mt-1">Event Special ID: <span className="font-mono">{request.acceptedEventSpecialId}</span></p></div></div>}
              <div className="mt-4 pt-4 border-t border-gray-200"><p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Timeline</p><p className="text-xs text-gray-500">Requested: {formatDate(request.createdAt)}</p>{request.updatedAt !== request.createdAt && <p className="text-xs text-gray-500">Updated: {formatDate(request.updatedAt)}</p>}</div>
            </div>
            {request.status === "Pending" && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                <button onClick={() => { setEditStep(1); setCompletedSteps([]); setIsEditing(true); }} className="inline-flex items-center gap-1.5 px-4 py-2 border border-blue-300 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"><FiEdit2 className="w-4 h-4" /> Edit</button>
                <button onClick={() => setRejectModal(true)} className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-300 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"><FiXCircle className="w-4 h-4" /> Reject</button>
                <button onClick={() => setConfirmModal({ isOpen: true, variant: "success", title: "Accept Booking Request", message: "This will create the event.", confirmText: "Accept & Create Event", onConfirm: handleAccept })} className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"><FiCheckCircle className="w-4 h-4" /> Accept & Create Event</button>
              </div>
            )}
          </div>
        )}

        {isEditing && (
          <div className="bg-white border border-gray-200 overflow-hidden">
            <CreateEventStepper currentStep={editStep} eventMeetingType={editForm.eventMeetingType} onStepClick={handleStepClick} completedSteps={completedSteps} />
            <div className="p-6">
              {editError && <div className="bg-red-50 border border-red-200 p-3 flex items-start gap-2 mb-4"><FiAlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /><p className="text-sm text-red-600">{editError}</p></div>}
              {editStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Name <span className="text-red-500">*</span></label><input className={inputClass} type="text" value={editForm.eventName} onChange={(e) => setEditForm((p) => ({ ...p, eventName: e.target.value }))} /></div>
                    <div><label className={labelClass}>Type <span className="text-red-500">*</span></label><select className={inputClass} value={editForm.eventType} onChange={(e) => setEditForm((p) => ({ ...p, eventType: e.target.value }))}><option value="Internal">Internal</option><option value="Joint">Joint</option><option value="External">External</option></select></div>
                  </div>
                  <div><label className={labelClass}>Audience <span className="text-red-500">*</span></label><input className={inputClass} type="number" value={editForm.audience} onChange={(e) => setEditForm((p) => ({ ...p, audience: e.target.value }))} min={1} /></div>
                  <div><label className={labelClass}>Description <span className="text-red-500">*</span></label><textarea className={`${inputClass} resize-y min-h-[80px]`} value={editForm.eventDescription} onChange={(e) => setEditForm((p) => ({ ...p, eventDescription: e.target.value }))} rows={3} /></div>
                </div>
              )}
              {editStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Full Names <span className="text-red-500">*</span></label><input className={inputClass} type="text" value={editForm.organizerNames} onChange={(e) => setEditForm((p) => ({ ...p, organizerNames: e.target.value }))} /></div>
                    <div><label className={labelClass}>Institution</label><input className={inputClass} type="text" value={editForm.organizerInstitution} onChange={(e) => setEditForm((p) => ({ ...p, organizerInstitution: e.target.value }))} /></div>
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
              {editStep === 4 && <EditRoomSelector editForm={editForm} setEditForm={setEditForm} requestId={request?._id} />}
              {editStep === 5 && showAgenda && <ActivityAgenda agenda={editForm.agenda} onChange={(agenda) => setEditForm((p) => ({ ...p, agenda }))} eventStartTime={editForm.startTime ? editForm.startTime.split("T")[1]?.substring(0, 5) : null} eventEndTime={editForm.endTime ? editForm.endTime.split("T")[1]?.substring(0, 5) : null} />}
              {editStep === 5 && !showAgenda && <div className="bg-blue-50 border border-blue-200 p-4 text-center"><p className="text-sm text-blue-700 font-medium">No agenda required</p></div>}
              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                {editStep > 1 && <button type="button" onClick={handleEditBack} className="flex-1 py-2.5 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Back</button>}
                {editStep < maxSteps ? <button type="button" onClick={handleEditNext} className={`py-2.5 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all ${editStep === 1 ? "w-full" : "flex-1"}`}>Next</button>
                  : <button type="button" onClick={handleSaveEdit} disabled={actionLoading} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all inline-flex items-center justify-center gap-2">{actionLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : <><FiSave className="w-4 h-4" /> Save Changes</>}</button>}
              </div>
            </div>
          </div>
        )}
      </div>
      <ConfirmModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false })} onConfirm={async () => { await confirmModal.onConfirm(); setConfirmModal({ isOpen: false }); }} title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText || "Confirm"} confirmVariant={confirmModal.variant} loading={actionLoading} />
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => { setRejectModal(false); setRejectReason(""); }} />
          <div className="relative bg-white border border-gray-200 p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Booking Request</h3>
            <p className="text-sm text-gray-500 mb-4">Please provide a reason.</p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter rejection reason..." rows={4} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500 resize-none" />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button onClick={() => { setRejectModal(false); setRejectReason(""); }} className="px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || actionLoading} className="px-4 py-2 bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">{actionLoading ? "Rejecting..." : "Reject"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}