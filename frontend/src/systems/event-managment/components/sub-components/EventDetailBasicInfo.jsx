import { useState } from 'react';
import { FiMapPin, FiBookmark, FiUsers, FiCalendar, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import axios from 'axios';
import ChangeRoomModal from './ChangeRoomModal';

const BASE_URL = '/cok/api/v1';

function EditableDisplay({ label, value, field, icon, children, activeField, editValues, onEdit, onCancel, onSave, saving, error, isPastEvent }) {
  const isEditing = activeField === field;
  const currentEditValue = editValues[field] ?? '';

  return (
    <div className="bg-white ppp-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {icon}
          <label className="text-xs font-semibold text-gray-500 uppercase">{label}</label>
        </div>
        {!isPastEvent && !isEditing && (
          <button onClick={() => onEdit(field, value)}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title={`Edit ${label}`}>
            <FiEdit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-2">
          {children}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => onSave(field, currentEditValue)} disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white ppp text-xs hover:bg-blue-700 disabled:opacity-50">
              <FiCheck className="w-3 h-3" /> Save
            </button>
            <button onClick={onCancel}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 ppp text-xs hover:bg-gray-50">
              <FiX className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-900 break-words">{value || <span className="text-gray-400 italic">Not set</span>}</div>
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
        onEventUpdated?.(res.data.data);
        onCancel();
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update');
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

  const timeInfo = getEventTimeInfo();
  const displayProps = { activeField, editValues, onEdit, onCancel, onSave, saving, error, isPastEvent };
  const currentValue = (field) => editValues[field] ?? '';

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EditableDisplay label="Event Name" value={event.eventName} field="eventName" icon={<FiBookmark className="w-4 h-4 text-blue-500" />} {...displayProps}>
          <input type="text" value={currentValue('eventName')} onChange={(e) => setEditValues(p => ({ ...p, eventName: e.target.value }))}
            className="w-full px-3 py-2 border border-blue-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500" autoFocus />
        </EditableDisplay>

        {/* Event Type - READ ONLY, no edit button */}
        <div className="bg-white ppp-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <FiBookmark className="w-4 h-4 text-purple-500" />
            <label className="text-xs font-semibold text-gray-500 uppercase">Event Type</label>
          </div>
          <div className="text-sm text-gray-900 break-words">{event.eventType || <span className="text-gray-400 italic">Not set</span>}</div>
        </div>

        {/* Room - Show value with Change Room button */}
        <div className="bg-white ppp-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <FiMapPin className="w-4 h-4 text-red-500" />
              <label className="text-xs font-semibold text-gray-500 uppercase">Room</label>
            </div>
            {!isPastEvent && (
              <button onClick={() => setChangeRoomOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white ppp text-xs font-medium hover:bg-blue-700 transition-colors">
                <FiEdit2 className="w-3 h-3" /> Change Room
              </button>
            )}
          </div>
          <div className="text-sm text-gray-900 capitalize break-words">{event.eventRoom || <span className="text-gray-400 italic">Not set</span>}</div>
        </div>

        <EditableDisplay label="Expected Audience" value={event.expectedAudience ? `${event.expectedAudience} attendees` : 'Not specified'} field="expectedAudience"
          icon={<FiUsers className="w-4 h-4 text-green-500" />} {...displayProps}>
          <input type="number" min="1" value={currentValue('expectedAudience')} onChange={(e) => setEditValues(p => ({ ...p, expectedAudience: e.target.value }))}
            className="w-full px-3 py-2 border border-blue-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500" autoFocus />
        </EditableDisplay>

        <div className="md:col-span-2">
          <EditableDisplay label="Description" value={event.eventDescription || 'No description provided.'} field="eventDescription"
            icon={<FiBookmark className="w-4 h-4 text-gray-400" />} {...displayProps}>
            <textarea value={currentValue('eventDescription')} onChange={(e) => setEditValues(p => ({ ...p, eventDescription: e.target.value }))} rows={3}
              className="w-full px-3 py-2 border border-blue-300 ppp-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none" autoFocus />
          </EditableDisplay>
        </div>

        <div className="md:col-span-2 bg-white ppp-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <FiCalendar className="w-4 h-4 text-orange-500" />
            <label className="text-xs font-semibold text-gray-500 uppercase">
              {eventMode === 'recurring' ? 'Recurring Schedule' : 'Date & Time'}
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium text-gray-500">{timeInfo.startLabel}:</span>
              <span>{timeInfo.startValue}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium text-gray-500">{timeInfo.endLabel}:</span>
              <span>{timeInfo.endValue}</span>
            </div>
            {timeInfo.extraInfo && (
              <div className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium text-gray-500">Note:</span>
                <span className={event.isCancelled ? 'text-red-600' : ''}>{timeInfo.extraInfo}</span>
              </div>
            )}
          </div>
        </div>
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