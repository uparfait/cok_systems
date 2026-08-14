import { useState } from 'react';
import { FiX, FiAlertTriangle, FiClock } from 'react-icons/fi';
import axios from 'axios';
import SpiralLoader from '../SpiralLoader';
import { useToast } from '@/core/contexts/ToastContext';

const BASE_URL = '/cok/api/v1';

const PRIMARY = '#056daa';
const DANGER = '#E74C3C';
const NEUTRAL_DARK = '#333333';
const BORDER = '#E0E0E0';
const GRAY_DISABLED = '#9E9E9E';
const WARNING = '#F39C12';
const fontHeading = "'Montserrat', sans-serif";

const inputClassName = 'w-full cok-auth-input pr-3 py-2 text-sm';

const labelStyle = {
  fontFamily: fontHeading, fontSize: '11px', fontWeight: 600,
  letterSpacing: '0.5px', textTransform: 'uppercase', color: NEUTRAL_DARK,
  display: 'block', marginBottom: '6px',
};

export default function CancelPostponeModal({
  isOpen,
  onClose,
  action, // 'cancel' or 'postpone'
  event,
  eventMode,
  onSuccess,
}) {
  const [reason, setReason] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newRecurringEnd, setNewRecurringEnd] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  if (!isOpen) return null;

  const isCancel = action === 'cancel';
  const isPostpone = action === 'postpone';

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      const res = await axios.put(`${BASE_URL}/events/cancel`, {
        eventId: event._id,
        eventType: eventMode,
        reason: reason.trim(),
      });
      if (res.data.success) {
        showSuccess(res.data.message || 'Event cancelled successfully');
        onSuccess?.(res.data.data);
        onClose();
      } else {
        showError(res.data.message || 'Failed to cancel event');
      }
    } catch (err) {
      showError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePostpone = async () => {
    const newSchedule = {};

    if (eventMode === 'live') {
      if (newStart) newSchedule.startedAt = new Date(newStart).toISOString();
      if (newEnd) newSchedule.willEndAt = new Date(newEnd).toISOString();
    } else if (eventMode === 'upcoming') {
      if (newStart) newSchedule.willStartAt = new Date(newStart).toISOString();
      if (newEnd) newSchedule.willEndAt = new Date(newEnd).toISOString();
    } else if (eventMode === 'recurring') {
      if (newStartTime) newSchedule.eventStartTime = newStartTime;
      if (newEndTime) newSchedule.eventEndTime = newEndTime;
      if (newRecurringEnd) newSchedule.recurringEndDate = new Date(newRecurringEnd).toISOString();
    }

    if (Object.keys(newSchedule).length === 0) {
      showError('Please provide at least one new date/time.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.put(`${BASE_URL}/events/postpone`, {
        eventId: event._id,
        eventType: eventMode,
        newSchedule,
      });
      if (res.data.success) {
        showSuccess(res.data.message || 'Event postponed successfully');
        onSuccess?.(res.data.data);
        onClose();
      } else {
        showError(res.data.message || 'Failed to postpone event');
      }
    } catch (err) {
      showError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="bg-white w-full max-w-lg" style={{ border: `1px solid ${BORDER}` }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-3">
            {isCancel ? (
              <FiAlertTriangle className="w-5 h-5" style={{ color: DANGER }} />
            ) : (
              <FiClock className="w-5 h-5" style={{ color: PRIMARY }} />
            )}
            <h2 className="text-base sm:text-lg font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>
              {isCancel ? 'Cancel Event' : 'Postpone Event'}
            </h2>
          </div>
          <button onClick={onClose} disabled={loading} className="p-1 cursor-pointer transition-colors disabled:opacity-50" style={{ color: GRAY_DISABLED }}>
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="p-3" style={{ backgroundColor: '#FFF3E0', border: '1px solid #FFCC80' }}>
            <p className="text-xs" style={{ color: WARNING, fontFamily: fontHeading }}>
              {isCancel
                ? `This will mark the ${eventMode} event as cancelled and move it to past events.`
                : `Set new future dates/times for this ${eventMode} event. Room availability will be checked.`}
            </p>
          </div>

          {isCancel && (
            <div>
              <label style={labelStyle}>
                Cancellation Reason <span style={{ color: GRAY_DISABLED, textTransform: 'none' }}>(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Venue maintenance, scheduling conflict..."
                rows={3}
                className={inputClassName}
                style={{ resize: 'vertical', minHeight: '80px' }}
              />
            </div>
          )}

          {isPostpone && (
            <div className="space-y-4">
              {(eventMode === 'live' || eventMode === 'upcoming') && (
                <>
                  <div>
                    <label style={labelStyle}>New Start Time</label>
                    <input
                      type="datetime-local"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                      min={getMinDateTime()}
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>New End Time</label>
                    <input
                      type="datetime-local"
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                      min={newStart || getMinDateTime()}
                      className={inputClassName}
                    />
                  </div>
                </>
              )}

              {eventMode === 'recurring' && (
                <>
                  <div>
                    <label style={labelStyle}>New Start Time</label>
                    <input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>New End Time</label>
                    <input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>New Recurring End Date</label>
                    <input
                      type="date"
                      value={newRecurringEnd}
                      onChange={(e) => setNewRecurringEnd(e.target.value)}
                      min={getMinDate()}
                      className={inputClassName}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="w-6 h-6"><SpiralLoader /></div>
              <span className="ml-2 text-sm" style={{ color: GRAY_DISABLED, fontFamily: fontHeading }}>
                {isCancel ? 'Cancelling...' : 'Postponing...'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-4 sm:px-6 py-4" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button
            onClick={onClose}
            disabled={loading}
            className="cok-btn-outlined flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Close
          </button>
          {isCancel ? (
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 py-2.5 text-white text-xs font-semibold uppercase tracking-wide cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: DANGER, fontFamily: fontHeading }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#C0392B')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = DANGER)}
            >
              {loading ? 'Processing...' : 'Confirm Cancel'}
            </button>
          ) : (
            <button
              onClick={handlePostpone}
              disabled={loading}
              className="cok-btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ width: 'auto' }}
            >
              {loading ? 'Processing...' : 'Confirm Postpone'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
