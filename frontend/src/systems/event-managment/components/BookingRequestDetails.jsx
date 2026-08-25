import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import {
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
  FiCheck,
  FiX,
  FiBookmark,
  FiUsers,
} from "react-icons/fi";
import ConfirmModal from "../ui-components/ConfirmModal";
import SpiralLoader from "./SpiralLoader";
import TimeInput24 from "./sub-components/TimeInput24";
import EventFormatFields from "./sub-components/EventFormatFields";
import { useToast } from "@/core/contexts/ToastContext";

const BASE_URL = "/cok/api/v1";

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const DANGER = "#E74C3C";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";

const inputClassName = "w-full cok-auth-input pr-3 py-2 text-sm";

const fieldLabelStyle = {
  fontFamily: fontHeading, fontSize: "11px", fontWeight: 600,
  letterSpacing: "0.5px", textTransform: "uppercase", color: GRAY_DISABLED,
};

const STATUS_DETAILS = {
  Pending: { color: WARNING, icon: FiClock, label: "Pending" },
  Accepted: { color: SUCCESS, icon: FiCheckCircle, label: "Accepted" },
  Rejected: { color: DANGER, icon: FiXCircle, label: "Rejected" },
  Cancelled: { color: GRAY_DISABLED, icon: FiSlash, label: "Cancelled" },
};

// Convert a stored ISO instant to local "YYYY-MM-DDTHH:MM"
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function StatusBadge({ status }) {
  const config = STATUS_DETAILS[status] || STATUS_DETAILS.Pending;
  const Icon = config.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white" style={{ backgroundColor: config.color, fontFamily: fontHeading }}>
      <Icon className="w-4 h-4" />
      {config.label}
    </span>
  );
}

// Inline editable card — same interaction pattern as the event details page
function EditableDisplay({ label, value, field, icon, children, activeField, editValues, onEdit, onCancel, onSave, saving, fieldError, canEdit }) {
  const isEditing = activeField === field;
  const currentEditValue = editValues[field] ?? "";

  return (
    <div className="bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {icon}
          <label style={fieldLabelStyle}>{label}</label>
        </div>
        {canEdit && !isEditing && (
          <button onClick={() => onEdit(field, value)}
            className="p-1 cursor-pointer transition-colors" title={`Edit ${label}`}
            style={{ color: GRAY_DISABLED }}
            onMouseEnter={(e) => (e.currentTarget.style.color = PRIMARY)}
            onMouseLeave={(e) => (e.currentTarget.style.color = GRAY_DISABLED)}>
            <FiEdit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-2">
          {children}
          {fieldError && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldError}</p>}
          <div className="flex gap-2">
            <button onClick={() => onSave(field, currentEditValue)} disabled={saving}
              className="cok-btn-primary inline-flex items-center gap-1 disabled:opacity-50"
              style={{ width: "auto", padding: "0.5rem 0.9rem", fontSize: "11px" }}>
              <FiCheck className="w-3 h-3" /> {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={onCancel} disabled={saving}
              className="cok-btn-outlined inline-flex items-center gap-1 disabled:opacity-50"
              style={{ padding: "0.5rem 0.9rem", fontSize: "11px" }}>
              <FiX className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm break-words" style={{ color: NEUTRAL_DARK }}>{value || <span className="italic" style={{ color: GRAY_DISABLED }}>Not set</span>}</div>
      )}
    </div>
  );
}

// Location picker panel — Physical/Virtual toggle; physical checks room
// availability for this request's window, excluding itself
function RoomChangePanel({ request, onSaved, onClose, saveRequestFields, saving }) {
  const [availableRooms, setAvailableRooms] = useState([]);
  const [unavailableRooms, setUnavailableRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [format, setFormat] = useState(request.eventFormat || "Physical");
  const [virtualLink, setVirtualLink] = useState(request.virtualLink || "");
  const [virtualDescription, setVirtualDescription] = useState(request.virtualDescription || "");
  const [linkError, setLinkError] = useState(null);
  const { showError } = useToast();

  const isCurrentlyVirtual = request.eventFormat === "Virtual";

  useEffect(() => {
    if (format === "Virtual") return;
    const checkRooms = async () => {
      setLoading(true);
      try {
        const params = {
          startTime: new Date(request.startTime).toISOString(),
          endTime: new Date(request.endTime).toISOString(),
          eventMode: "upcoming",
          requestId: request._id,
        };
        const res = await axios.get(`${BASE_URL}/rooms/available`, { params });
        const data = res.data?.data || res.data;
        setAvailableRooms(data.availableRooms || []);
        setUnavailableRooms(data.unavailableRooms || []);
      } catch (err) {
        showError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    checkRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request._id, request.startTime, request.endTime, format]);

  const isSelected = (roomName) => selectedRoom.toLowerCase() === roomName.toLowerCase();
  const isCurrent = (roomName) => !isCurrentlyVirtual && request.eventRoom?.toLowerCase() === roomName.toLowerCase();

  const handleFormatChange = (name, value) => {
    if (name === "eventFormat") {
      setFormat(value);
      setLinkError(null);
      if (value === "Virtual") setSelectedRoom("");
    } else if (name === "virtualLink") {
      setVirtualLink(value);
      setLinkError(null);
    } else if (name === "virtualDescription") {
      setVirtualDescription(value);
    }
  };

  const handleSave = async () => {
    let payload;
    if (format === "Virtual") {
      if (virtualLink && !/^https?:\/\/\S+$/i.test(virtualLink.trim())) {
        setLinkError("Meeting link must be a valid http(s) URL");
        return;
      }
      payload = {
        eventFormat: "Virtual",
        virtualLink: virtualLink.trim(),
        virtualDescription: virtualDescription.trim(),
      };
    } else {
      if (!selectedRoom) { showError("Please select a room"); return; }
      payload = { eventFormat: "Physical", eventRoom: selectedRoom };
    }
    const ok = await saveRequestFields(payload);
    if (ok) { onSaved?.(); onClose(); }
  };

  return (
    <div className="p-3 sm:p-4 space-y-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
      <EventFormatFields
        eventFormat={format}
        virtualLink={virtualLink}
        virtualDescription={virtualDescription}
        linkError={linkError}
        onChange={handleFormatChange}
      />

      {format !== "Virtual" && (
        <p className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
          Rooms are checked for availability against this request's schedule.
        </p>
      )}

      {format !== "Virtual" && loading && (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6"><SpiralLoader /></div>
        </div>
      )}

      {format !== "Virtual" && !loading && availableRooms.length === 0 && (
        <div className="p-4 text-center" style={{ backgroundColor: "#FFF3E0", border: "1px solid #FFCC80" }}>
          <FiAlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color: WARNING }} />
          <p className="text-xs font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>No other rooms are available for this schedule.</p>
        </div>
      )}

      {format !== "Virtual" && !loading && availableRooms.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {availableRooms.map((item, idx) => {
            const selected = isSelected(item.room.roomName);
            return (
              <button key={idx} type="button" onClick={() => setSelectedRoom(item.room.roomName)}
                className={`w-full text-left p-3 border-2 transition-all duration-200 cursor-pointer ${selected ? "border-green-500 bg-green-50" : "border-green-200 bg-white hover:border-green-400 hover:bg-green-50/50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <FiCheck className={`w-4 h-4 mt-0.5 shrink-0 ${selected ? "text-green-600" : "text-green-400"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold capitalize truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                        {item.room.roomName}
                        {isCurrent(item.room.roomName) && <span className="ml-2 text-[10px] font-normal" style={{ color: GRAY_DISABLED }}>(current)</span>}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs" style={{ color: GRAY_DISABLED }}>
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
          {unavailableRooms.length > 0 && (
            <p className="text-[11px]" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>{unavailableRooms.length} other room(s) are occupied during this schedule.</p>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={saving || (format !== "Virtual" && !selectedRoom)}
          className="cok-btn-primary inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ width: "auto", padding: "0.5rem 1rem", fontSize: "11px" }}>
          {saving ? "Saving..." : "Save Location"}
        </button>
        <button onClick={onClose} disabled={saving}
          className="cok-btn-outlined disabled:opacity-50"
          style={{ padding: "0.5rem 1rem", fontSize: "11px" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function BookingRequestDetails() {
  const { id } = useParams();
  const { showSuccess, showError } = useToast();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, variant: "primary", title: "", message: "", onConfirm: null });

  // Inline field editing
  const [activeField, setActiveField] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState(null);
  const [roomPanelOpen, setRoomPanelOpen] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${BASE_URL}/booking-requests/${id}`);
        if (res.data.success) setRequest(res.data.data);
        else setError("Booking request not found");
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const isPending = request?.status === "Pending";

  const onEdit = (field, currentValue) => {
    setActiveField(field);
    setEditValues({ [field]: String(currentValue ?? "") });
    setFieldError(null);
  };

  const onCancel = () => {
    setActiveField(null);
    setEditValues({});
    setFieldError(null);
  };

  // Send a partial update; the backend re-checks room conflicts on any time change
  const saveRequestFields = async (payload) => {
    setSaving(true);
    setFieldError(null);
    try {
      const res = await axios.put(`${BASE_URL}/booking-requests/${id}`, payload);
      if (res.data.success) {
        showSuccess(res.data.message || "Booking request updated successfully");
        setRequest(res.data.data);
        onCancel();
        return true;
      }
      setFieldError(res.data.message);
      showError(res.data.message || "Failed to update");
      return false;
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setFieldError(msg);
      showError(msg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startLocal = toLocalInput(request?.startTime);
  const endLocal = toLocalInput(request?.endTime);
  const schedule = {
    date: startLocal.slice(0, 10),
    from: startLocal.slice(11, 16),
    to: endLocal.slice(11, 16),
  };

  const onSave = async (field, value) => {
    switch (field) {
      case "eventName":
        if (!value.trim()) { setFieldError("Name is required"); return; }
        return saveRequestFields({ eventName: value.trim() });
      case "eventType":
        if (!value) { setFieldError("Type is required"); return; }
        return saveRequestFields({ eventType: value });
      case "expectedAudience": {
        const val = Number(value);
        if (!val || val < 1) { setFieldError("Audience must be at least 1"); return; }
        return saveRequestFields({ expectedAudience: val });
      }
      case "eventDescription":
        if (!value.trim()) { setFieldError("Description is required"); return; }
        return saveRequestFields({ eventDescription: value.trim() });
      case "organizerName":
        if (!value.trim()) { setFieldError("Name is required"); return; }
        return saveRequestFields({ eventOrganizer: { fullNames: value.trim() } });
      case "organizerEmail":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) { setFieldError("Enter a valid email"); return; }
        return saveRequestFields({ eventOrganizer: { email: value.trim() } });
      case "organizerPhone":
        if (!value.trim()) { setFieldError("Phone is required"); return; }
        return saveRequestFields({ eventOrganizer: { phone: value.trim() } });
      case "organizerInstitution":
        return saveRequestFields({ eventOrganizer: { institution: value.trim() } });
      case "scheduleDate":
      case "scheduleFrom":
      case "scheduleTo": {
        const date = field === "scheduleDate" ? value : schedule.date;
        const from = field === "scheduleFrom" ? value : schedule.from;
        const to = field === "scheduleTo" ? value : schedule.to;
        if (!date || !from || !to) { setFieldError("Date, start and end times are all required"); return; }
        const newStart = new Date(`${date}T${from}`);
        const newEnd = new Date(`${date}T${to}`);
        if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) { setFieldError("Invalid date or time"); return; }
        if (newEnd <= newStart) { setFieldError("End time must be after start time"); return; }
        return saveRequestFields({ startTime: newStart.toISOString(), endTime: newEnd.toISOString() });
      }
      default:
        return;
    }
  };

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      const res = await axios.put(`${BASE_URL}/booking-requests/${id}/accept`);
      if (res.data.success) {
        showSuccess(res.data.message || "Booking request accepted");
        setRequest((prev) => ({ ...prev, status: "Accepted", acceptedEventSpecialId: res.data.data.event.eventSpecialId, acceptedEventType: "upcoming" }));
      } else {
        showError(res.data.message || "Failed to accept booking request");
      }
    } catch (err) {
      showError(err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await axios.put(`${BASE_URL}/booking-requests/${id}/reject`, { reason: rejectReason.trim() });
      if (res.data.success) {
        showSuccess(res.data.message || "Booking request rejected");
        setRequest((prev) => ({ ...prev, status: "Rejected", rejectionReason: rejectReason.trim() }));
        setRejectModal(false);
        setRejectReason("");
      } else {
        showError(res.data.message || "Failed to reject");
      }
    } catch (err) {
      showError(err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-GB", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <SpiralLoader />
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <div className="w-full max-w-md text-center p-6 sm:p-8" style={{ backgroundColor: "#FFFFFF", border: `1px solid ${BORDER}` }}>
          <FiAlertCircle className="w-12 h-12 mx-auto mb-3" style={{ color: DANGER }} />
          <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!request) return null;

  const displayProps = { activeField, editValues, onEdit, onCancel, onSave, saving, fieldError, canEdit: isPending };
  const currentValue = (field) => editValues[field] ?? "";
  const setEditValue = (field, val) => setEditValues((p) => ({ ...p, [field]: val }));

  return (
    <div className="min-h-screen" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      {/* Header banner */}
      <div className="px-4 sm:px-6 py-5 text-white" style={{ backgroundColor: PRIMARY }}>
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
              <FiCalendar className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold leading-tight truncate" style={{ fontFamily: fontHeading, letterSpacing: "-0.5px" }}>
                {request.eventName}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs font-mono font-semibold px-2 py-0.5" style={{ color: PRIMARY, backgroundColor: "#FFFFFF" }}>{request.trackingCode}</span>
                <span className="text-xs capitalize" style={{ color: "rgba(255,255,255,0.85)", fontFamily: fontHeading }}>({request.eventMeetingType === "meet" ? "meeting" : "event"})</span>
              </div>
            </div>
          </div>
          <div className="shrink-0 self-start sm:self-auto"><StatusBadge status={request.status} /></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Basic details — inline editable */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EditableDisplay label="Name" value={request.eventName} field="eventName"
            icon={<FiBookmark className="w-4 h-4" style={{ color: PRIMARY }} />} {...displayProps}>
            <input type="text" value={currentValue("eventName")} onChange={(e) => setEditValue("eventName", e.target.value)} className={inputClassName} autoFocus />
          </EditableDisplay>

          <EditableDisplay label="Type" value={request.eventType} field="eventType"
            icon={<FiBookmark className="w-4 h-4" style={{ color: PRIMARY }} />} {...displayProps}>
            <select value={currentValue("eventType")} onChange={(e) => setEditValue("eventType", e.target.value)} className={inputClassName} autoFocus>
              <option value="Internal">Internal</option>
              <option value="Joint">Joint</option>
              <option value="External">External</option>
            </select>
          </EditableDisplay>

          <EditableDisplay label="Expected Audience" value={request.expectedAudience ? `${request.expectedAudience} people` : ""} field="expectedAudience"
            icon={<FiUsers className="w-4 h-4" style={{ color: PRIMARY }} />} {...displayProps}>
            <input type="number" min="1" value={currentValue("expectedAudience")} onChange={(e) => setEditValue("expectedAudience", e.target.value)} className={inputClassName} autoFocus />
          </EditableDisplay>

          {/* Room — change via availability panel */}
          <div className="bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <FiMapPin className="w-4 h-4" style={{ color: PRIMARY }} />
                <label style={fieldLabelStyle}>Location</label>
              </div>
              {isPending && !roomPanelOpen && (
                <button onClick={() => setRoomPanelOpen(true)}
                  className="cok-btn-primary inline-flex items-center gap-1"
                  style={{ width: "auto", padding: "0.35rem 0.7rem", fontSize: "10px" }}>
                  <FiEdit2 className="w-3 h-3" /> Change Location
                </button>
              )}
            </div>
            <div className="text-sm capitalize break-words" style={{ color: NEUTRAL_DARK }}>{request.eventFormat === "Virtual" ? "Virtual" : (request.eventRoom || <span className="italic" style={{ color: GRAY_DISABLED }}>Not set</span>)}</div>
            {roomPanelOpen && (
              <div className="mt-3">
                <RoomChangePanel request={request} onClose={() => setRoomPanelOpen(false)} saveRequestFields={saveRequestFields} saving={saving} />
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <EditableDisplay label="Description" value={request.eventDescription} field="eventDescription"
              icon={<FiBookmark className="w-4 h-4" style={{ color: PRIMARY }} />} {...displayProps}>
              <textarea rows={3} value={currentValue("eventDescription")} onChange={(e) => setEditValue("eventDescription", e.target.value)} className={inputClassName} style={{ resize: "vertical", minHeight: "80px" }} autoFocus />
            </EditableDisplay>
          </div>

          {/* Schedule — date and times editable separately; backend re-checks conflicts */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <EditableDisplay label="Date" value={schedule.date} field="scheduleDate"
              icon={<FiCalendar className="w-4 h-4" style={{ color: PRIMARY }} />} {...displayProps}>
              <input type="date" value={currentValue("scheduleDate")} onChange={(e) => setEditValue("scheduleDate", e.target.value)} className={inputClassName} autoFocus />
            </EditableDisplay>
            <EditableDisplay label="From (24-hour)" value={schedule.from} field="scheduleFrom"
              icon={<FiCalendar className="w-4 h-4" style={{ color: PRIMARY }} />} {...displayProps}>
              <TimeInput24 value={currentValue("scheduleFrom")} onChange={(value) => setEditValue("scheduleFrom", value)} />
            </EditableDisplay>
            <EditableDisplay label="To (24-hour)" value={schedule.to} field="scheduleTo"
              icon={<FiCalendar className="w-4 h-4" style={{ color: PRIMARY }} />} {...displayProps}>
              <TimeInput24 value={currentValue("scheduleTo")} onChange={(value) => setEditValue("scheduleTo", value)} />
            </EditableDisplay>
          </div>
        </div>

        {/* Organizer — inline editable */}
        <div className="bg-white p-4 sm:p-5" style={{ border: `1px solid ${BORDER}` }}>
          <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-4" style={{ color: PRIMARY, fontFamily: fontHeading }}>
            <FiUser className="w-4 h-4" />
            Organizer Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EditableDisplay label="Full Names" value={request.eventOrganizer?.fullNames} field="organizerName"
              icon={<FiUser className="w-4 h-4" style={{ color: PRIMARY }} />} {...displayProps}>
              <input type="text" value={currentValue("organizerName")} onChange={(e) => setEditValue("organizerName", e.target.value)} className={inputClassName} autoFocus />
            </EditableDisplay>
            <EditableDisplay label="Email" value={request.eventOrganizer?.email} field="organizerEmail"
              icon={<FiMail className="w-4 h-4" style={{ color: PRIMARY }} />} {...displayProps}>
              <input type="email" value={currentValue("organizerEmail")} onChange={(e) => setEditValue("organizerEmail", e.target.value)} className={inputClassName} autoFocus />
            </EditableDisplay>
            <EditableDisplay label="Phone" value={request.eventOrganizer?.phone} field="organizerPhone"
              icon={<FiPhone className="w-4 h-4" style={{ color: PRIMARY }} />} {...displayProps}>
              <input type="tel" value={currentValue("organizerPhone")} onChange={(e) => setEditValue("organizerPhone", e.target.value)} className={inputClassName} autoFocus />
            </EditableDisplay>
            <EditableDisplay label="Institution" value={request.eventOrganizer?.institution} field="organizerInstitution"
              icon={<FiHome className="w-4 h-4" style={{ color: PRIMARY }} />} {...displayProps}>
              <input type="text" value={currentValue("organizerInstitution")} onChange={(e) => setEditValue("organizerInstitution", e.target.value)} className={inputClassName} autoFocus />
            </EditableDisplay>
          </div>
        </div>

        {/* Agenda — read only, card style */}
        {request.activityAgenda?.length > 0 && (
          <div className="bg-white p-4 sm:p-5" style={{ border: `1px solid ${BORDER}` }}>
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-4" style={{ color: PRIMARY, fontFamily: fontHeading }}>
              <FiClock className="w-4 h-4" />
              Activity Agenda ({request.activityAgenda.length})
            </h3>
            <div className="space-y-3">
              {request.activityAgenda.map((item, idx) => (
                <div key={idx} style={{ border: `1px solid ${BORDER}` }}>
                  <div className="flex items-center gap-2 px-3 sm:px-4 py-2" style={{ backgroundColor: NEUTRAL_LIGHT, borderBottom: `1px solid ${BORDER}` }}>
                    <FiClock className="w-3.5 h-3.5" style={{ color: PRIMARY }} />
                    <span className="text-xs font-bold tracking-wide" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                      {item.fromTime || "--:--"} — {item.toTime || "--:--"}
                    </span>
                  </div>
                  <div className="px-3 sm:px-4 py-3 bg-white">
                    <p className="text-sm font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{item.title || `Agenda item ${idx + 1}`}</p>
                    {item.description && <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "#555555" }}>{item.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status extras */}
        {request.status === "Rejected" && request.rejectionReason && (
          <div className="p-4" style={{ backgroundColor: "#FDECEA", border: "1px solid #F5B7B1" }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: DANGER, fontFamily: fontHeading }}>Rejection Reason</p>
            <p className="text-sm mt-1" style={{ color: DANGER }}>{request.rejectionReason}</p>
          </div>
        )}
        {request.status === "Accepted" && request.acceptedEventSpecialId && (
          <div className="p-4" style={{ backgroundColor: "#E8F5E9", border: "1px solid #A5D6A7" }}>
            <div className="flex items-center gap-2">
              <FiCheckCircle className="w-4 h-4" style={{ color: SUCCESS }} />
              <p className="text-sm font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Event Created</p>
            </div>
            <p className="text-xs mt-1" style={{ color: GRAY_DISABLED }}>Event Special ID: <span className="font-mono" style={{ color: NEUTRAL_DARK }}>{request.acceptedEventSpecialId}</span></p>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: PRIMARY, fontFamily: fontHeading }}>Timeline</p>
          <p className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Requested: {formatDateTime(request.createdAt)}</p>
          {request.updatedAt !== request.createdAt && <p className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Updated: {formatDateTime(request.updatedAt)}</p>}
        </div>

        {/* Actions — Edit button removed; fields are edited inline above */}
        {isPending && (
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <button onClick={() => setRejectModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white text-xs font-semibold uppercase tracking-wide cursor-pointer transition-colors"
              style={{ backgroundColor: DANGER, fontFamily: fontHeading }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#C0392B")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = DANGER)}>
              <FiXCircle className="w-4 h-4" /> Reject
            </button>
            <button
              onClick={() => setConfirmModal({ isOpen: true, variant: "success", title: "Accept Booking Request", message: "This will create the event.", confirmText: "Accept & Create Event", onConfirm: handleAccept })}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white text-xs font-semibold uppercase tracking-wide cursor-pointer transition-colors"
              style={{ backgroundColor: SUCCESS, fontFamily: fontHeading }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#388D3C")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = SUCCESS)}>
              <FiCheckCircle className="w-4 h-4" /> Accept & Create Event
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={async () => { await confirmModal.onConfirm(); setConfirmModal({ isOpen: false }); }}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText || "Confirm"}
        confirmVariant={confirmModal.variant}
        loading={actionLoading}
      />

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => { if (!actionLoading) { setRejectModal(false); setRejectReason(""); } }} />
          <div className="relative bg-white p-5 sm:p-6 max-w-md w-full" style={{ border: `1px solid ${BORDER}` }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Reject Booking Request</h3>
            <p className="text-sm mb-4" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>Please provide a reason.</p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter rejection reason..." rows={4}
              className={inputClassName} style={{ resize: "vertical", minHeight: "90px" }} />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button onClick={() => { setRejectModal(false); setRejectReason(""); }} disabled={actionLoading}
                className="cok-btn-outlined disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || actionLoading}
                className="px-4 py-2.5 text-white text-xs font-semibold uppercase tracking-wide cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: DANGER, fontFamily: fontHeading }}>
                {actionLoading ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
