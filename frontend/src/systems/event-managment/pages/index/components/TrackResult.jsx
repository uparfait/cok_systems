import { useState, useEffect } from "react";
import { FiEdit2, FiTrash2, FiX } from "react-icons/fi";
import axios from "axios";
import { useToast } from "@/core/contexts/ToastContext";
import EventFormatFields from "../../../components/sub-components/EventFormatFields";
import TimeInput24 from "../../../components/sub-components/TimeInput24";
import SpiralLoader from "../../../components/SpiralLoader";

import {
  PRIMARY, DANGER, SUCCESS, SUCCESS_HOVER, NEUTRAL_LIGHT, NEUTRAL_DARK, BORDER, WHITE, GRAY_DISABLED, fontHeading,
  StatusBadge,
} from "./TrackShared";

const BASE_URL = "/cok/api/v1";

const inputClassName = "w-full cok-auth-input pr-3 py-2 text-sm";
const inputStyle = { paddingLeft: "12px" };

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function LocationChangeOverlay({ request, onClose, saveRequestFields, saving }) {
  const [availableRooms, setAvailableRooms] = useState([]);
  const [unavailableCount, setUnavailableCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [error, setError] = useState(null);
  const [format, setFormat] = useState(request.eventFormat || "Physical");
  const [virtualLink, setVirtualLink] = useState(request.virtualLink || "");
  const [virtualDescription, setVirtualDescription] = useState(request.virtualDescription || "");
  const [linkError, setLinkError] = useState(null);

  const isCurrentlyVirtual = request.eventFormat === "Virtual";

  useEffect(() => {
    if (format === "Virtual") return;
    let alive = true;
    const checkRooms = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = {
          startTime: new Date(request.startTime).toISOString(),
          endTime: new Date(request.endTime).toISOString(),
          eventMode: "upcoming",
          requestId: request._id,
        };
        const res = await axios.get(`${BASE_URL}/rooms/available`, { params });
        const data = res.data?.data || res.data;
        if (!alive) return;
        setAvailableRooms(data.availableRooms || []);
        setUnavailableCount((data.unavailableRooms || []).length);
      } catch (err) {
        if (alive) setError(err.response?.data?.message || err.message);
      } finally {
        if (alive) setLoading(false);
      }
    };
    checkRooms();
    return () => { alive = false; };
  }, [request._id, request.startTime, request.endTime, format]);

  const isCurrent = (roomName) => !isCurrentlyVirtual && (request.eventRoom || "").toLowerCase() === roomName.toLowerCase();

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
      if (!selectedRoom) return;
      payload = { eventFormat: "Physical", eventRoom: selectedRoom };
    }
    const ok = await saveRequestFields(payload);
    if (ok) onClose();
  };

  const canSave = format === "Virtual" ? !saving : (!saving && !!selectedRoom);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="bg-white w-full max-w-lg" style={{ border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <h2 className="text-base sm:text-lg font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Change Location</h2>
          <button type="button" onClick={onClose} disabled={saving} className="p-1 cursor-pointer transition-colors disabled:opacity-50" style={{ color: GRAY_DISABLED }}>
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto text-left">
          <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
            <p className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
              Current location: <strong className="capitalize" style={{ color: NEUTRAL_DARK }}>{isCurrentlyVirtual ? "Virtual" : request.eventRoom}</strong>. Choose a format and a new location below.
            </p>
          </div>

          <EventFormatFields
            eventFormat={format}
            virtualLink={virtualLink}
            virtualDescription={virtualDescription}
            linkError={linkError}
            onChange={handleFormatChange}
          />

          {format !== "Virtual" && loading && (
            <div className="flex items-center justify-center py-6">
              <SpiralLoader />
            </div>
          )}

          {format !== "Virtual" && !loading && error && (
            <p className="p-2 text-xs" style={{ backgroundColor: "#FDECEA", border: "1px solid #F5B7B1", color: DANGER, fontFamily: fontHeading }}>{error}</p>
          )}

          {format !== "Virtual" && !loading && !error && availableRooms.length === 0 && (
            <p className="p-3 text-xs text-center" style={{ backgroundColor: "#FFF3E0", border: "1px solid #FFCC80", color: NEUTRAL_DARK, fontFamily: fontHeading }}>
              No other rooms are available for this schedule.
            </p>
          )}

          {format !== "Virtual" && !loading && availableRooms.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {availableRooms.map((item, idx) => {
                const selected = selectedRoom.toLowerCase() === item.room.roomName.toLowerCase();
                return (
                  <button key={idx} type="button" onClick={() => setSelectedRoom(item.room.roomName)}
                    className={`w-full text-left p-3 border-2 transition-all duration-200 cursor-pointer ${selected ? "border-green-500 bg-green-50" : "border-green-200 bg-white hover:border-green-400 hover:bg-green-50/50"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold capitalize truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                          {item.room.roomName}
                          {isCurrent(item.room.roomName) && <span className="ml-2 text-[10px] font-normal" style={{ color: GRAY_DISABLED }}>(current)</span>}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs" style={{ color: GRAY_DISABLED }}>
                          <span className="capitalize">{item.room.roomLocation}</span>
                          <span>Capacity: {item.room.roomCapacity}</span>
                        </div>
                      </div>
                      {selected && <span className="text-xs font-bold text-green-700 bg-green-100 border border-green-300 px-2.5 py-0.5 shrink-0">Selected</span>}
                    </div>
                  </button>
                );
              })}
              {unavailableCount > 0 && (
                <p className="text-[11px]" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>{unavailableCount} other room(s) are occupied during this schedule.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-4 sm:px-6 py-4" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button type="button" onClick={onClose} disabled={saving}
            className="cok-btn-outlined flex-1 disabled:opacity-50 disabled:cursor-not-allowed">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={!canSave}
            className="cok-btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ width: "auto" }}>
            {saving ? "Changing..." : "Change Location"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrackResult({
  request, onUpdated, onCancelClick, onInvite, loading,
  showInvited, invitedPeople, invitedCount, invitedLoading,
  onToggleInvited, onRemoveInvited,
}) {
  const { showSuccess, showError } = useToast();

  const [activeField, setActiveField] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState(null);
  const [roomPanelOpen, setRoomPanelOpen] = useState(false);

  const canEdit = request.status === "Pending";

  const startLocal = toLocalInput(request.startTime);
  const endLocal = toLocalInput(request.endTime);
  const schedule = {
    date: startLocal.slice(0, 10),
    from: startLocal.slice(11, 16),
    to: endLocal.slice(11, 16),
  };

  const formatDateOnly = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  };

  const cancelEdit = () => {
    setActiveField(null);
    setEditValues({});
    setFieldError(null);
  };

  const saveRequestFields = async (payload) => {
    setSaving(true);
    setFieldError(null);
    try {
      const res = await axios.put(`${BASE_URL}/booking-requests/${request._id}`, payload);
      if (res.data.success) {
        showSuccess(res.data.message || "Booking request updated successfully");
        onUpdated?.(res.data.data);
        cancelEdit();
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

  const startEdit = (row) => {
    setFieldError(null);
    setRoomPanelOpen(false);
    setActiveField(row.field);
    if (row.field === "scheduleTime") {
      setEditValues({ timeFrom: schedule.from, timeTo: schedule.to });
    } else if (row.field === "scheduleDate") {
      setEditValues({ scheduleDate: schedule.date });
    } else {
      setEditValues({ [row.field]: String(row.raw ?? "") });
    }
  };

  const setEditValue = (key, val) => setEditValues((p) => ({ ...p, [key]: val }));

  const onSave = async (field) => {
    const value = editValues[field] ?? "";
    switch (field) {
      case "eventName":
        if (!value.trim()) { setFieldError("Name is required"); return; }
        return saveRequestFields({ eventName: value.trim() });
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
      case "scheduleDate": {
        const date = editValues.scheduleDate;
        if (!date || !schedule.from || !schedule.to) { setFieldError("Date, start and end times are all required"); return; }
        const newStart = new Date(`${date}T${schedule.from}`);
        const newEnd = new Date(`${date}T${schedule.to}`);
        if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) { setFieldError("Invalid date"); return; }
        if (newEnd <= newStart) { setFieldError("End time must be after start time"); return; }
        return saveRequestFields({ startTime: newStart.toISOString(), endTime: newEnd.toISOString() });
      }
      case "scheduleTime": {
        const from = editValues.timeFrom;
        const to = editValues.timeTo;
        if (!schedule.date || !from || !to) { setFieldError("Date, start and end times are all required"); return; }
        const newStart = new Date(`${schedule.date}T${from}`);
        const newEnd = new Date(`${schedule.date}T${to}`);
        if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) { setFieldError("Invalid time"); return; }
        if (newEnd <= newStart) { setFieldError("End time must be after start time"); return; }
        return saveRequestFields({ startTime: newStart.toISOString(), endTime: newEnd.toISOString() });
      }
      default:
        return;
    }
  };

  const renderEditor = (row) => {
    if (row.field === "scheduleTime") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>From (24-hour)</p>
            <TimeInput24 value={editValues.timeFrom ?? ""} onChange={(value) => setEditValue("timeFrom", value)} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>To (24-hour)</p>
            <TimeInput24 value={editValues.timeTo ?? ""} onChange={(value) => setEditValue("timeTo", value)} />
          </div>
        </div>
      );
    }
    if (row.field === "scheduleDate") {
      return <input type="date" value={editValues.scheduleDate ?? ""} onChange={(e) => setEditValue("scheduleDate", e.target.value)} className={inputClassName} style={inputStyle} autoFocus />;
    }
    if (row.input === "textarea") {
      return <textarea rows={3} value={editValues[row.field] ?? ""} onChange={(e) => setEditValue(row.field, e.target.value)} className={inputClassName} style={{ ...inputStyle, resize: "vertical", minHeight: "70px" }} autoFocus />;
    }
    return (
      <input type={row.input || "text"} min={row.input === "number" ? 1 : undefined}
        value={editValues[row.field] ?? ""} onChange={(e) => setEditValue(row.field, e.target.value)}
        className={inputClassName} style={inputStyle} autoFocus />
    );
  };

  const detailRows = [
    { label: "Name", value: request.eventName, raw: request.eventName, field: "eventName", input: "text" },
    { label: "Type", value: request.eventMeetingType === "meet" ? "Meeting" : "Event" },
    { label: "Event Type", value: request.eventType },
    { label: "Location", value: request.eventFormat === "Virtual" ? "Virtual" : request.eventRoom, roomEdit: true, isVirtual: request.eventFormat === "Virtual", virtualLink: request.virtualLink, virtualDescription: request.virtualDescription },
    { label: "Date", value: formatDateOnly(request.startTime), field: "scheduleDate" },
    { label: "Time", value: schedule.from && schedule.to ? `${schedule.from} to ${schedule.to}` : "-", field: "scheduleTime" },
    { label: "Organizer", value: request.eventOrganizer?.fullNames, raw: request.eventOrganizer?.fullNames, field: "organizerName", input: "text" },
    { label: "Email", value: request.eventOrganizer?.email, raw: request.eventOrganizer?.email, field: "organizerEmail", input: "email" },
    { label: "Phone", value: request.eventOrganizer?.phone, raw: request.eventOrganizer?.phone, field: "organizerPhone", input: "tel" },
    { label: "Institution", value: request.eventOrganizer?.institution || "-", raw: request.eventOrganizer?.institution, field: "organizerInstitution", input: "text" },
    { label: "Audience", value: request.expectedAudience ? `${request.expectedAudience} people` : "-", raw: request.expectedAudience, field: "expectedAudience", input: "number" },
    { label: "Description", value: request.eventDescription, raw: request.eventDescription, field: "eventDescription", input: "textarea" },
  ];

  return (
    <div className="mt-4 w-full max-w-lg overflow-hidden bg-white" style={{ border: `1px solid ${BORDER}` }}>
      <div className="px-4 py-3.5 flex items-start justify-between flex-wrap gap-3" style={{ backgroundColor: PRIMARY }}>
        <div className="min-w-0">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white break-words" style={{ fontFamily: fontHeading }}>{request.eventName}</h3>
          <span className="text-xs font-mono font-medium px-2 py-0.5 inline-block mt-1 text-white" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>{request.trackingCode}</span>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <table className="w-full border-collapse table-auto">
        <tbody>
          {detailRows.map((row, idx) => {
            const isEditing = activeField === row.field && row.field;
            return (
              <tr
                key={row.label}
                className={`transition-colors duration-100 ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50/50 hover:bg-blue-50'}`}
              >
                <td className="px-3 sm:px-4 py-2.5 w-24 sm:w-32 border-b border-r border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-600 align-top" style={{ fontFamily: fontHeading }}>
                  {row.label}
                </td>
                <td className={`px-3 sm:px-4 py-2.5 border-b border-gray-200 text-sm font-medium text-gray-900 ${row.label === 'Email' ? '' : 'capitalize'}`} style={{ fontFamily: fontHeading }}>
                  {isEditing ? (
                    <div className="space-y-2">
                      {renderEditor(row)}
                      {fieldError && <p className="text-xs normal-case" style={{ color: DANGER, fontFamily: fontHeading }}>{fieldError}</p>}
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => onSave(row.field)} disabled={saving}
                          className="cok-btn-primary disabled:opacity-50"
                          style={{ width: "auto", padding: "0.4rem 0.9rem", fontSize: "11px" }}>
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button type="button" onClick={cancelEdit} disabled={saving}
                          className="cok-btn-outlined disabled:opacity-50"
                          style={{ padding: "0.4rem 0.9rem", fontSize: "11px" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className={row.label === 'Email' ? 'break-all' : 'break-words'}>{row.value || "-"}</span>
                        {canEdit && (row.field || row.roomEdit) && (
                          <button
                            type="button"
                            onClick={() => (row.roomEdit ? (cancelEdit(), setRoomPanelOpen(true)) : startEdit(row))}
                            title={row.roomEdit ? "Change Location" : `Edit ${row.label}`}
                            className="p-1 shrink-0 cursor-pointer transition-colors"
                            style={{ color: GRAY_DISABLED }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = PRIMARY)}
                            onMouseLeave={(e) => (e.currentTarget.style.color = GRAY_DISABLED)}
                          >
                            <FiEdit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {row.isVirtual && row.virtualLink && (
                        <div className="mt-1 p-2" style={{ backgroundColor: NEUTRAL_LIGHT, border: `1px solid ${BORDER}` }}>
                          <a
                            href={row.virtualLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium hover:underline break-all"
                            style={{ color: PRIMARY, fontFamily: fontHeading }}
                          >
                            {row.virtualLink}
                          </a>
                          {row.virtualDescription && (
                            <p className="text-xs mt-1 text-gray-600">{row.virtualDescription}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="p-4">
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
                Your Request Has Been Accepted
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
              {showInvited ? "Hide Invited People" : `View Invited People${invitedCount ? ` (${invitedCount})` : ""}`}
            </button>

            {showInvited && (
              <div className="mt-3 border" style={{ borderColor: BORDER }}>
                {invitedLoading ? (
                  <div className="flex items-center justify-center py-6 text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                    <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin mr-2" /> Loading...
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
              className="cok-btn-primary mt-3 w-full"
              style={{ padding: '0.7rem 1rem' }}
            >
              Invite People
            </button>
          </div>
        )}
        {roomPanelOpen && (
          <LocationChangeOverlay
            request={request}
            onClose={() => setRoomPanelOpen(false)}
            saveRequestFields={saveRequestFields}
            saving={saving}
          />
        )}
        {request.status === "Pending" && (
          <div className="mt-4 pt-3 flex flex-wrap justify-end gap-2" style={{ borderTop: `1px solid ${BORDER}` }}>
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
