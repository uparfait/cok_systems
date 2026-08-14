import { useState } from 'react';
import { FiMapPin, FiBookmark, FiUsers, FiCalendar, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import axios from 'axios';
import ChangeRoomModal from './ChangeRoomModal';
import { useToast } from '@/core/contexts/ToastContext';

const BASE_URL = '/cok/api/v1';

const PRIMARY = '#056daa';
const DANGER = '#E74C3C';
const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const GRAY_DISABLED = '#9E9E9E';
const fontHeading = "'Montserrat', sans-serif";

const inputClassName = 'w-full cok-auth-input pr-3 py-2 text-sm';

const fieldLabelStyle = {
  fontFamily: fontHeading, fontSize: '11px', fontWeight: 600,
  letterSpacing: '0.5px', textTransform: 'uppercase', color: GRAY_DISABLED,
};

function EditableDisplay({ label, value, field, icon, children, activeField, editValues, onEdit, onCancel, onSave, saving, error, isPastEvent }) {
  const isEditing = activeField === field;
  const currentEditValue = editValues[field] ?? '';

  return (
    <div className="bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {icon}
          <label style={fieldLabelStyle}>{label}</label>
        </div>
        {!isPastEvent && !isEditing && (
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
          {error && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => onSave(field, currentEditValue)} disabled={saving}
              className="cok-btn-primary inline-flex items-center gap-1 disabled:opacity-50"
              style={{ width: 'auto', padding: '0.5rem 0.9rem', fontSize: '11px' }}>
              <FiCheck className="w-3 h-3" /> Save
            </button>
            <button onClick={onCancel}
              className="cok-btn-outlined inline-flex items-center gap-1"
              style={{ padding: '0.5rem 0.9rem', fontSize: '11px' }}>
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

export default function EventDetailBasicInfo({ event, eventMode, onEventUpdated }) {
  const [activeField, setActiveField] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [changeRoomOpen, setChangeRoomOpen] = useState(false);
  const { showSuccess, showError } = useToast();

  const isPastEvent = eventMode === 'past';

  const onEdit = (field, currentValue) => {
    setActiveField(field);
    setEditValues(prev => ({ ...prev, [field]: String(currentValue || '') }));
    setError(null);
  };

  const onCancel = () => {
    setActiveField(null);
    setEditValues({});
    setError(null);
  };

  const onSave = async (field, value) => {
    setSaving(true);
    setError(null);
    try {
      const res = await axios.put(`${BASE_URL}/events/section-update`, {
        eventId: event._id,
        eventType: eventMode,
        section: 'basic',
        data: { [field]: value },
      });
      if (res.data.success) {
        showSuccess(res.data.message || 'Updated successfully');
        onEventUpdated?.(res.data.data);
        onCancel();
      } else {
        setError(res.data.message);
        showError(res.data.message || 'Failed to update');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(msg);
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const getEventTimeInfo = () => {
    switch (eventMode) {
      case 'live':
        return {
          startLabel: 'Started', startValue: event.startedAt ? new Date(event.startedAt).toLocaleString() : 'N/A',
          endLabel: 'Ends', endValue: event.willEndAt ? new Date(event.willEndAt).toLocaleString() : 'N/A',
        };
      case 'upcoming':
        return {
          startLabel: 'Starts', startValue: event.willStartAt ? new Date(event.willStartAt).toLocaleString() : 'N/A',
          endLabel: 'Ends', endValue: event.willEndAt ? new Date(event.willEndAt).toLocaleString() : 'N/A',
        };
      case 'recurring':
        return {
          startLabel: 'Time', startValue: event.eventRecurring?.eventStartTime || 'N/A',
          endLabel: 'Until', endValue: event.eventRecurring?.recurringEndDate ? new Date(event.eventRecurring.recurringEndDate).toLocaleDateString() : 'N/A',
          extraInfo: event.eventRecurring?.recurringType ? `Type: ${event.eventRecurring.recurringType}` : null,
        };
      case 'past':
        return {
          startLabel: 'Started', startValue: event.startedAt ? new Date(event.startedAt).toLocaleString() : 'N/A',
          endLabel: 'Ended', endValue: event.endedAt ? new Date(event.endedAt).toLocaleString() : 'N/A',
          extraInfo: event.isCancelled ? `Cancelled: ${event.cancellationReason || 'No reason provided'}` : null,
        };
      default:
        return { startLabel: '', startValue: '', endLabel: '', endValue: '' };
    }
  };

  const handleChangeRoomSuccess = (updatedEvent) => {
    setChangeRoomOpen(false);
    onEventUpdated?.(updatedEvent);
  };

  // Convert a stored ISO instant to local "YYYY-MM-DDTHH:MM" for the inputs
  const toLocalInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const scheduleStartIso = event.startedAt || event.willStartAt;
  const schedule = {
    date: scheduleStartIso ? toLocalInput(scheduleStartIso).slice(0, 10) : '',
    from: scheduleStartIso ? toLocalInput(scheduleStartIso).slice(11, 16) : '',
    to: event.willEndAt ? toLocalInput(event.willEndAt).slice(11, 16) : '',
  };
  const isScheduleEditable = eventMode === 'live' || eventMode === 'upcoming';

  // Save date/from/to separately — combine the edited piece with the current
  // values and let the backend re-check room conflicts before saving.
  const onSaveSchedule = async (field, value) => {
    const date = field === 'scheduleDate' ? value : schedule.date;
    const from = field === 'scheduleFrom' ? value : schedule.from;
    const to = field === 'scheduleTo' ? value : schedule.to;

    if (!date || !from || !to) { showError('Date, start and end times are all required'); return; }
    const newStart = new Date(`${date}T${from}`);
    const newEnd = new Date(`${date}T${to}`);
    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) { showError('Invalid date or time'); return; }
    if (newEnd <= newStart) { showError('End time must be after start time'); return; }

    setSaving(true);
    setError(null);
    try {
      const data = eventMode === 'live'
        ? { startedAt: newStart.toISOString(), willEndAt: newEnd.toISOString() }
        : { willStartAt: newStart.toISOString(), willEndAt: newEnd.toISOString() };
      const res = await axios.put(`${BASE_URL}/events/section-update`, {
        eventId: event._id,
        eventType: eventMode,
        section: 'schedule',
        data,
      });
      if (res.data.success) {
        showSuccess(res.data.message || 'Schedule updated successfully');
        onEventUpdated?.(res.data.data);
        onCancel();
      } else {
        setError(res.data.message);
        showError(res.data.message || 'Failed to update schedule');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(msg);
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const timeInfo = getEventTimeInfo();
  const displayProps = { activeField, editValues, onEdit, onCancel, onSave, saving, error, isPastEvent };
  const scheduleProps = { ...displayProps, onSave: onSaveSchedule };
  const currentValue = (field) => editValues[field] ?? '';

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EditableDisplay label="Event Name" value={event.eventName} field="eventName" icon={<FiBookmark className="w-4 h-4" style={{ color: PRIMARY }} />} {...displayProps}>
          <input type="text" value={currentValue('eventName')} onChange={(e) => setEditValues(p => ({ ...p, eventName: e.target.value }))}
            className={inputClassName} autoFocus />
        </EditableDisplay>

        {/* Event Type - READ ONLY, no edit button */}
        <div className="bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-2 mb-1">
            <FiBookmark className="w-4 h-4" style={{ color: PRIMARY }} />
            <label style={fieldLabelStyle}>Event Type</label>
          </div>
          <div className="text-sm break-words" style={{ color: NEUTRAL_DARK }}>{event.eventType || <span className="italic" style={{ color: GRAY_DISABLED }}>Not set</span>}</div>
        </div>

        {/* Room - Show value with Change Room button */}
        <div className="bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <FiMapPin className="w-4 h-4" style={{ color: PRIMARY }} />
              <label style={fieldLabelStyle}>Room</label>
            </div>
            {!isPastEvent && (
              <button onClick={() => setChangeRoomOpen(true)}
                className="cok-btn-primary inline-flex items-center gap-1"
                style={{ width: 'auto', padding: '0.35rem 0.7rem', fontSize: '10px' }}>
                <FiEdit2 className="w-3 h-3" /> Change Room
              </button>
            )}
          </div>
          <div className="text-sm capitalize break-words" style={{ color: NEUTRAL_DARK }}>{event.eventRoom || <span className="italic" style={{ color: GRAY_DISABLED }}>Not set</span>}</div>
        </div>

        <EditableDisplay label="Expected Audience" value={event.expectedAudience ? `${event.expectedAudience} attendees` : 'Not specified'} field="expectedAudience"
          icon={<FiUsers className="w-4 h-4" style={{ color: PRIMARY }} />} {...displayProps}>
          <input type="number" min="1" value={currentValue('expectedAudience')} onChange={(e) => setEditValues(p => ({ ...p, expectedAudience: e.target.value }))}
            className={inputClassName} autoFocus />
        </EditableDisplay>

        <div className="md:col-span-2">
          <EditableDisplay label="Description" value={event.eventDescription || 'No description provided.'} field="eventDescription"
            icon={<FiBookmark className="w-4 h-4" style={{ color: PRIMARY }} />} {...displayProps}>
            <textarea value={currentValue('eventDescription')} onChange={(e) => setEditValues(p => ({ ...p, eventDescription: e.target.value }))} rows={3}
              className={inputClassName} style={{ resize: 'vertical', minHeight: '80px' }} autoFocus />
          </EditableDisplay>
        </div>

        {isScheduleEditable ? (
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <EditableDisplay label="Date" value={schedule.date} field="scheduleDate"
              icon={<FiCalendar className="w-4 h-4" style={{ color: PRIMARY }} />} {...scheduleProps}>
              <input type="date" value={currentValue('scheduleDate')}
                onChange={(e) => setEditValues(p => ({ ...p, scheduleDate: e.target.value }))}
                className={inputClassName} autoFocus />
            </EditableDisplay>
            <EditableDisplay label="From" value={schedule.from} field="scheduleFrom"
              icon={<FiCalendar className="w-4 h-4" style={{ color: PRIMARY }} />} {...scheduleProps}>
              <input type="time" value={currentValue('scheduleFrom')}
                onChange={(e) => setEditValues(p => ({ ...p, scheduleFrom: e.target.value }))}
                className={inputClassName} autoFocus />
            </EditableDisplay>
            <EditableDisplay label="To" value={schedule.to} field="scheduleTo"
              icon={<FiCalendar className="w-4 h-4" style={{ color: PRIMARY }} />} {...scheduleProps}>
              <input type="time" value={currentValue('scheduleTo')}
                onChange={(e) => setEditValues(p => ({ ...p, scheduleTo: e.target.value }))}
                min={schedule.from || undefined}
                className={inputClassName} autoFocus />
            </EditableDisplay>
          </div>
        ) : (
          <div className="md:col-span-2 bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-2 mb-3">
              <FiCalendar className="w-4 h-4" style={{ color: PRIMARY }} />
              <label style={fieldLabelStyle}>
                {eventMode === 'recurring' ? 'Recurring Schedule' : 'Date & Time'}
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm" style={{ color: NEUTRAL_DARK }}>
                <span className="font-medium" style={{ color: GRAY_DISABLED }}>{timeInfo.startLabel}:</span>
                <span>{timeInfo.startValue}</span>
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: NEUTRAL_DARK }}>
                <span className="font-medium" style={{ color: GRAY_DISABLED }}>{timeInfo.endLabel}:</span>
                <span>{timeInfo.endValue}</span>
              </div>
              {timeInfo.extraInfo && (
                <div className="sm:col-span-2 flex items-center gap-2 text-sm" style={{ color: NEUTRAL_DARK }}>
                  <span className="font-medium" style={{ color: GRAY_DISABLED }}>Note:</span>
                  <span style={event.isCancelled ? { color: DANGER } : undefined}>{timeInfo.extraInfo}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Change Room Modal */}
      <ChangeRoomModal
        isOpen={changeRoomOpen}
        onClose={() => setChangeRoomOpen(false)}
        event={event}
        eventMode={eventMode}
        onSuccess={handleChangeRoomSuccess}
      />
    </>
  );
}