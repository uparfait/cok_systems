import { useState } from 'react';
import { FiClock, FiEdit2, FiCheck, FiX, FiPlus, FiUser } from 'react-icons/fi';
import axios from 'axios';
import { useToast } from '@/core/contexts/ToastContext';
import ActivityAgenda from './ActivityAgenda';
import { getAgendaTimeBounds, validateAgendaTimes } from './EventCreateHelpers';

const BASE_URL = '/cok/api/v1';

const PRIMARY = '#056daa';
const DANGER = '#E74C3C';
const NEUTRAL_LIGHT = '#F7F9FB';
const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const GRAY_DISABLED = '#9E9E9E';
const fontHeading = "'Montserrat', sans-serif";

// Convert a stored ISO instant to local "YYYY-MM-DDTHH:MM" so the agenda
// time bounds match what the user sees on the schedule cards.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function EventDetailAgenda({ event, eventMode, onEventUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editAgenda, setEditAgenda] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { showSuccess, showError } = useToast();

  const agenda = event.activityAgenda || [];
  const isPastEvent = eventMode === 'past';

  // Event time window the agenda items must fit inside (HH:MM local),
  // including overnight events that cross midnight.
  const boundsFormData = {
    startedAt: toLocalInput(event.startedAt),
    willStartAt: toLocalInput(event.willStartAt),
    willEndAt: toLocalInput(event.willEndAt),
    eventStartTime: event.eventRecurring?.eventStartTime || '',
    eventEndTime: event.eventRecurring?.eventEndTime || '',
  };
  const bounds = getAgendaTimeBounds(boundsFormData, eventMode);

  const startEditing = () => {
    setEditAgenda(agenda.map(a => ({
      fromTime: a.fromTime || '',
      toTime: a.toTime || '',
      title: a.title || '',
      description: a.description || '',
      presenter: a.presenter || null,
    })));
    setIsEditing(true);
    setError(null);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    const validItems = editAgenda
      .filter(a => a.title?.trim() || a.description?.trim())
      .map(a => ({
        fromTime: a.fromTime || '',
        toTime: a.toTime || '',
        title: a.title || '',
        description: a.description || '',
        presenter: a.presenter || null,
      }));

    // Enforce the event's time window on every kept item before saving
    const timesOk = validateAgendaTimes(
      { ...boundsFormData, agenda: validItems },
      eventMode,
      (msg) => { setError(msg); showError(msg); }
    );
    if (!timesOk) return;

    setSaving(true);
    setError(null);
    try {
      const res = await axios.put(`${BASE_URL}/events/section-update`, {
        eventId: event._id,
        eventType: eventMode,
        section: 'agenda',
        data: { activityAgenda: validItems },
      });
      if (res.data.success) {
        showSuccess(res.data.message || 'Agenda updated successfully');
        onEventUpdated?.(res.data.data);
        setIsEditing(false);
      } else {
        setError(res.data.message);
        showError(res.data.message || 'Failed to update agenda');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(msg);
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isEditing && agenda.length === 0) {
    return (
      <div className="bg-white p-4 sm:p-5" style={{ border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: PRIMARY, fontFamily: fontHeading }}>
            <FiClock className="w-4 h-4" />
            Activity Agenda
          </h3>
          {!isPastEvent && (
            <button onClick={startEditing}
              className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide cursor-pointer hover:underline"
              style={{ color: PRIMARY, fontFamily: fontHeading }}>
              <FiPlus className="w-3.5 h-3.5" /> Add
            </button>
          )}
        </div>
        <p className="text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>No agenda items for this event.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 sm:p-5" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: PRIMARY, fontFamily: fontHeading }}>
          <FiClock className="w-4 h-4" />
          Activity Agenda {!isEditing && `(${agenda.length})`}
        </h3>
        {!isPastEvent && !isEditing && (
          <button onClick={startEditing}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide cursor-pointer hover:underline"
            style={{ color: PRIMARY, fontFamily: fontHeading }}>
            <FiEdit2 className="w-3.5 h-3.5" /> Edit
          </button>
        )}
        {isEditing && (
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: PRIMARY, fontFamily: fontHeading }}>Editing...</span>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          {bounds.startTime && bounds.endTime && (
            <p className="text-xs" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
              Agenda items must fit within the event time: <strong style={{ color: NEUTRAL_DARK }}>{bounds.startTime} — {bounds.endTime}{bounds.overMidnight ? ' (next day)' : ''}</strong>
            </p>
          )}
          <ActivityAgenda
            agenda={editAgenda}
            onChange={setEditAgenda}
            eventStartTime={bounds.startTime}
            eventEndTime={bounds.endTime}
            overMidnight={bounds.overMidnight}
          />
          {error && <p className="text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="cok-btn-primary inline-flex items-center gap-1 disabled:opacity-50"
              style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '11px' }}>
              <FiCheck className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Agenda'}
            </button>
            <button onClick={cancelEditing}
              className="cok-btn-outlined inline-flex items-center gap-1"
              style={{ padding: '0.5rem 1rem', fontSize: '11px' }}>
              <FiX className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {[...agenda]
            .sort((a, b) => (a.fromTime || '99:99').localeCompare(b.fromTime || '99:99'))
            .map((item, idx) => (
              <div key={idx} style={{ border: `1px solid ${BORDER}` }}>
                {/* Header: from — to */}
                <div className="flex items-center gap-2 px-3 sm:px-4 py-2" style={{ backgroundColor: NEUTRAL_LIGHT, borderBottom: `1px solid ${BORDER}` }}>
                  <FiClock className="w-3.5 h-3.5" style={{ color: PRIMARY }} />
                  <span className="text-xs font-bold tracking-wide" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                    {item.fromTime || '--:--'} — {item.toTime || '--:--'}
                  </span>
                </div>
                {/* Body: title and description only */}
                <div className="px-3 sm:px-4 py-3 bg-white">
                  <p className="text-sm font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
                    {item.title || `Agenda item ${idx + 1}`}
                  </p>
                  {item.description && (
                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#555555' }}>{item.description}</p>
                  )}
                  {item.presenter && item.presenter.name && (
                    <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                      <FiUser className="w-3 h-3" />
                      <span className="font-semibold">Presenter:</span> {item.presenter.name}
                      {item.presenter.role && <span className="text-gray-500"> ({item.presenter.role})</span>}
                    </p>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}